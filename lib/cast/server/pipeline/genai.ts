/**
 * GenAI client — pipeline stage `genai`.
 *
 * Generates a product photo via OpenAI Images. Mode is selected by env:
 *   - `CAST_GENAI_MODE` unset/anything → default → `dall-e-3`, native per-ratio sizes (3 calls / product)
 *   - `CAST_GENAI_MODE=cheap`           →  cheap  → `gpt-image-1`, single 1024² master (1 call / product)
 *
 * Wrapped in `retry()` (3 attempts, jittered 1s/4s/16s, `Retry-After`
 * honored ≤ 30 s, only on 429/5xx/ETIMEDOUT/ECONNRESET).
 */

import OpenAI from "openai"
import type { AspectRatio } from "@/lib/cast/schemas"
import { RATIO_PIXELS } from "@/lib/cast/ratios"
import { retry, type RetryableError } from "@/lib/cast/server/retry"
import {
  getGenAIMode as getConfigGenAIMode,
  getOpenAIClient,
} from "@/lib/cast/server/config"

export type GenAIMode = "default" | "cheap"

export function getGenAIMode(): GenAIMode {
  return getConfigGenAIMode()
}

export interface GenerateImageArgs {
  prompt: string
  /** Required in default mode; ignored in cheap mode (always 1024²). */
  ratio?: AspectRatio
  mode?: GenAIMode
  /**
   * Deterministic seed (S4). Sent only in default (dall-e-3) mode — gpt-image-1
   * (cheap mode) ignores seeds, so omitting it there keeps the request valid
   * and honest.
   */
  seed?: number
  /** Test seam — inject a mocked client. */
  client?: OpenAI
  /** Test seam — passed through to `retry`. */
  retryDeps?: { sleep?: (ms: number) => Promise<void>; random?: () => number }
}

export interface GenerationResult {
  png: Buffer
  meta: {
    model: string
    revisedPrompt: string | null
    size: string
    /** The seed sent with the request, or null in cheap mode (no seed support). */
    seedUsed: number | null
  }
}

/**
 * Returns the raw PNG bytes and generation metadata for a single image
 * generation. Throws after exhausting retries.
 */
export async function generateImage(args: GenerateImageArgs): Promise<GenerationResult> {
  const mode = args.mode ?? getGenAIMode()
  const client = args.client ?? (await getOpenAIClient())

  return retry(async () => {
    const size = pickSize(mode, args.ratio)
    const model = mode === "cheap" ? "gpt-image-1" : "dall-e-3"
    // Only dall-e-3 honors seeds; gpt-image-1 (cheap) has no seed parameter.
    const seedUsed = mode === "default" && args.seed !== undefined ? args.seed : null
    let response: OpenAI.Images.ImagesResponse
    try {
      const result = await client.images.generate({
        model,
        prompt: args.prompt,
        size,
        n: 1,
        ...(seedUsed !== null ? { seed: seedUsed } : {}),
        // dall-e-3 returns a URL by default; force base64 so we don't add an
        // extra HTTP fetch (and another retry surface).
        response_format: model === "dall-e-3" ? "b64_json" : undefined,
      } as OpenAI.Images.ImageGenerateParams)
      // The overload type includes a streaming variant (Stream<ImageGenStreamEvent>)
      // that we never request — narrow back to ImagesResponse for downstream use.
      response = result as OpenAI.Images.ImagesResponse
    } catch (err) {
      throw normalizeOpenAIError(err)
    }
    const imageData = response.data?.[0]
    const base64Image = imageData?.b64_json
    if (!base64Image) {
      throw normalizeOpenAIError(
        new Error(`OpenAI images response missing b64_json (model=${model})`),
      )
    }
    return {
      png: Buffer.from(base64Image, "base64"),
      meta: {
        model,
        revisedPrompt: imageData.revised_prompt ?? null,
        size,
        seedUsed,
      },
    }
  }, args.retryDeps)
}

function pickSize(
  mode: GenAIMode,
  ratio: AspectRatio | undefined,
): `${number}x${number}` {
  if (mode === "cheap") return "1024x1024"
  if (!ratio) {
    throw new Error("ratio is required in default mode")
  }
  const { width, height } = RATIO_PIXELS[ratio]
  return `${width}x${height}`
}

/**
 * Map an OpenAI SDK / fetch error into a `RetryableError`-shaped Error so the
 * retry helper's classifier can see `status` / `code` / `retryAfterSeconds`.
 *
 * Format per slices doc:
 *   - HTTP error → `<status> <provider error string>`
 *   - non-HTTP   → `OpenAI <code>: <message>`
 */
function normalizeOpenAIError(err: unknown): RetryableError {
  if (err && typeof err === "object") {
    const anyErr = err as {
      status?: number
      message?: string
      code?: string
      headers?: Headers | Record<string, string | undefined>
      error?: { message?: string }
    }
    const status = typeof anyErr.status === "number" ? anyErr.status : undefined
    const providerMessage = anyErr.error?.message ?? anyErr.message ?? "unknown error"
    const out: RetryableError =
      status !== undefined
        ? Object.assign(new Error(`${status} ${providerMessage}`), { status })
        : Object.assign(
            new Error(`OpenAI ${anyErr.code ?? "ERR"}: ${providerMessage}`),
            anyErr.code ? { code: anyErr.code } : {},
          )
    // Pull Retry-After if the SDK surfaced response headers.
    const retryAfter = readRetryAfter(anyErr.headers)
    if (retryAfter !== undefined) out.retryAfterSeconds = retryAfter
    return out
  }
  return Object.assign(new Error(`OpenAI ERR: ${String(err)}`), { code: "ERR" })
}

function readRetryAfter(
  headers: Headers | Record<string, string | undefined> | undefined,
): number | undefined {
  if (!headers) return undefined
  const raw =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("retry-after")
      : (headers as Record<string, string | undefined>)["retry-after"]
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}
