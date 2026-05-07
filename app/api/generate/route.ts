/**
 * `POST /api/generate` — orchestrate the pipeline, stream NDJSON progress
 * events, and write `outputs/[campaign]/` (brief.json, per-creative PNGs,
 * report.json).
 *
 * Flow:
 *   1. Validate body against `briefSchema`. 400 on failure.
 *   2. Load brand profile (`BrandNotFoundError` → 404, others → 400).
 *      Loader errors come back as plain JSON, NOT a stream — the client can
 *      branch on `Content-Type` to decide whether to attach the NDJSON reader.
 *   3. Wipe `outputs/[campaign]/` for idempotency, then write brief.json.
 *   4. Open the stream. For each market sequentially (to avoid concurrent filesystem writes), for each product,
 *      for each ratio in parallel: resolve → genai → resize → compose →
 *      compliance → write. Emit step + asset_resolved + creative_ready +
 *      compliance_result events as we go.
 *   5. On per-creative failure: record `errors[]`, omit compliance from the
 *      creative entry **unless** the failure is at the write stage (compliance
 *      had already run in that case).
 *      Continue with remaining work.
 *   6. Write `report.json`. Emit terminal `complete` event with the manifest.
 */

import { NextResponse } from "next/server"
import {
  BrandIncompleteError,
  BrandInvalidError,
  BrandNotFoundError,
} from "@/lib/cast/errors"
import { BRAND_HINTS } from "@/lib/cast/brand-hints"
import {
  briefSchema,
  slugify,
  type AspectRatio,
  type Brief,
  type BrandProfile,
  type ComplianceBadge,
  type Creative,
  type ErrorStage,
  type Manifest,
  type ManifestError,
} from "@/lib/cast/schemas"
import { loadBrandProfile } from "@/lib/cast/server/brand-loader"
import { resolveAsset } from "@/lib/cast/server/pipeline/resolve"
import {
  generateImage,
  getGenAIMode,
  type GenAIMode,
} from "@/lib/cast/server/pipeline/genai"
import { resizeForRatio } from "@/lib/cast/server/pipeline/resize"
import { composeCreative } from "@/lib/cast/server/pipeline/compose"
import { runCompliance } from "@/lib/cast/server/pipeline/compliance"
import { writeCreativeOutput } from "@/lib/cast/server/pipeline/write"
import {
  clearCampaignOutput,
  readAsset,
  writeBriefSnapshot,
  writeReport,
} from "@/lib/cast/server/storage"
import {
  emitAssetResolved,
  emitComplete,
  emitComplianceResult,
  emitCreativeReady,
  emitError,
  emitStep,
} from "@/lib/cast/server/ndjson-emit"
import { buildPromptPreview } from "@/lib/cast/prompt"
import type { Slot } from "@/lib/cast/events"

export const runtime = "nodejs"
// Generation can take minutes; opt out of the default Vercel/Next.js
// per-route timeout for this POC.
export const maxDuration = 600

export async function POST(req: Request): Promise<Response> {
  // 1. Parse + validate body.
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, [{ path: [], message: "request body is not valid JSON" }])
  }
  const parsed = briefSchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(
      400,
      parsed.error.issues.map((i) => ({
        path: i.path.filter(
          (p): p is string | number =>
            typeof p === "string" || typeof p === "number",
        ),
        message: i.message,
      })),
    )
  }
  const brief = parsed.data

  // 2. Load brand profile.
  let brand: BrandProfile
  try {
    brand = await loadBrandProfile(brief.brand)
  } catch (err) {
    if (err instanceof BrandNotFoundError) {
      return jsonError(404, [
        { path: ["brand"], message: err.message },
        { path: ["brand"], message: BRAND_HINTS.notFound },
      ])
    }
    if (err instanceof BrandIncompleteError) {
      return jsonError(400, [
        { path: ["brand"], message: err.message },
        { path: ["brand"], message: `missing: ${err.missing}` },
        { path: ["brand"], message: BRAND_HINTS.incomplete },
      ])
    }
    if (err instanceof BrandInvalidError) {
      return jsonError(400, [
        ...err.issues.map((i) => ({ path: ["brand", err.file, ...i.path], message: i.message })),
        { path: ["brand"], message: BRAND_HINTS.invalid },
      ])
    }
    throw err
  }

  // 2b. Cross-validate logoVariant.
  const logoVariantId = brief.logoVariant ?? brand.defaultLogoId
  const logo = brand.logoVariants.find((v) => v.id === logoVariantId)
  if (!logo) {
    return jsonError(400, [
      {
        path: ["logoVariant"],
        message: `unknown logo variant "${logoVariantId}" — known: ${brand.logoVariants.map((v) => v.id).join(", ")}`,
      },
    ])
  }

  // 3. Idempotency + brief snapshot.
  await clearCampaignOutput(brief.campaign)
  await writeBriefSnapshot(brief.campaign, brief)

  // 4. Open stream.
  const mode = getGenAIMode()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const manifest = await runPipeline({
          brief,
          brand,
          logoPath: logo.path,
          mode,
          emit: (chunk) => controller.enqueue(chunk),
        })
        await writeReport(brief.campaign, manifest)
        controller.enqueue(emitComplete(manifest))
      } catch (err) {
        // Last-resort safety net — per-creative failures are caught inside
        // runPipeline. Anything reaching here is an orchestrator-level fault.
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(emitError("write", `pipeline aborted: ${message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator — exported for unit testing.
// ---------------------------------------------------------------------------

interface RunPipelineArgs {
  brief: Brief
  brand: BrandProfile
  logoPath: string
  mode: GenAIMode
  emit: (chunk: Uint8Array) => void
}

interface FailedAt {
  stage: ErrorStage
  message: string
}

/**
 * Sentinel thrown from the per-creative pipeline so the catch block can
 * attribute the right `stage` without having to introspect the underlying
 * error. Each stage call site sets `currentStage` immediately before its
 * await, so an in-flight throw is always tagged with the stage that owned it.
 */
class StageError extends Error {
  constructor(
    public readonly stage: ErrorStage,
    public readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = "StageError"
  }
}

export async function runPipeline(args: RunPipelineArgs): Promise<Manifest> {
  const { brief, brand, logoPath, mode, emit } = args

  const creatives: Creative[] = []
  const errors: ManifestError[] = []

  for (const market of brief.markets) {
    const locale = market.split("-").pop()!
    const headline = brief.message[locale] ?? ""

    // Per-MARKET master cache. The genai prompt embeds the market
    // (`buildPromptPreview` writes "Locale: us-en (en)"), so a master
    // generated for one market is NOT reusable across markets. Default mode
    // also keys by ratio because dall-e-3 native sizes differ per ratio.
    // Cheap mode keys by productSlug only (single 1024² master per product).
    const baseImageCache = new Map<string, Buffer>()

    for (const product of brief.products) {
      const productSlug = slugify(product.name)
      let resolved: Awaited<ReturnType<typeof resolveAsset>>
      try {
        resolved = await resolveAsset(productSlug)
      } catch (err) {
        // Non-ENOENT fs errors (EACCES, EPERM, EIO, …) bubble up from
        // findLocalAsset. Attribute them to the resolve stage per slot so
        // the run continues and the manifest reflects which (product × market
        // × ratio) failed, instead of aborting the whole pipeline.
        const message = errMessage(err)
        for (const ratio of brief.ratios) {
          const slot: Slot = { product: productSlug, market, ratio }
          emit(emitError("resolve", message, slot))
          errors.push({ ...slot, stage: "resolve", message })
          creatives.push({
            product: productSlug,
            market,
            ratio,
            source: "local",
            path: null,
          })
        }
        continue
      }
      emit(
        emitAssetResolved(
          productSlug,
          resolved.source,
          resolved.source === "local" ? resolved.file : undefined,
        ),
      )

      // Materialize the master once per product (per market). For local
      // assets, one disk read. For cheap-mode genai, one 1024² generation
      // here — done OUTSIDE the per-ratio Promise.all so the prompt is
      // deterministic (ratio "1x1" stands in for the canonical square master).
      // Default-mode genai is per-ratio and stays inside the ratio loop.
      let localBaseImage: Buffer | undefined
      let baseImageGenerationError: { stage: ErrorStage; message: string } | undefined
      if (resolved.source === "local") {
        try {
          localBaseImage = await readAsset(resolved.file)
        } catch (err) {
          const message = errMessage(err)
          for (const ratio of brief.ratios) {
            const slot: Slot = { product: productSlug, market, ratio }
            emit(emitError("resolve", message, slot))
            errors.push({ ...slot, stage: "resolve", message })
            creatives.push({
              product: productSlug,
              market,
              ratio,
              source: "local",
              path: null,
            })
          }
          continue
        }
      } else if (mode === "cheap") {
        try {
          const master = await generateImage({
            prompt: buildPrompt(brief, brand, product, market, "1x1"),
            mode: "cheap",
          })
          baseImageCache.set(productSlug, master)
        } catch (err) {
          // Defer attribution to the per-ratio loop so each (market × ratio)
          // gets its own error event + manifest entry.
          baseImageGenerationError = { stage: "genai", message: errMessage(err) }
        }
      }

      // Per ratio in parallel.
      await Promise.all(
        brief.ratios.map(async (ratio) => {
          const slot: Slot = { product: productSlug, market, ratio }
          let failedAt: FailedAt | null = null
          let compliance: ReturnType<typeof runCompliance> | null = null
          let outputPath: string | null = null
          let currentStage: ErrorStage = "resolve"

          // Cheap-mode master generation already failed for this product;
          // every ratio fails the same way without spending more API calls.
          if (baseImageGenerationError) {
            emit(emitError(baseImageGenerationError.stage, baseImageGenerationError.message, slot))
            errors.push({ ...slot, ...baseImageGenerationError })
            creatives.push({
              product: productSlug,
              market,
              ratio,
              source: "genai",
              path: null,
            })
            return
          }

          try {
            // ---- resolve already done above; emit the stage marker ----
            currentStage = "resolve"
            emit(emitStep("resolve", slot))

            // ---- genai (only if missing) ----
            let master: Buffer
            if (resolved.source === "local") {
              master = localBaseImage!
            } else if (mode === "cheap") {
              // Already in cache (generated outside the ratio loop above).
              master = baseImageCache.get(productSlug)!
            } else {
              currentStage = "genai"
              const cacheKey = `${productSlug}|${ratio}`
              const cached = baseImageCache.get(cacheKey)
              if (cached) {
                master = cached
              } else {
                emit(emitStep("genai", slot, `generating ${ratio} native`))
                master = await runStage("genai", () =>
                  generateImage({
                    prompt: buildPrompt(brief, brand, product, market, ratio),
                    ratio,
                    mode: "default",
                  }),
                )
                baseImageCache.set(cacheKey, master)
              }
            }

            // ---- resize ----
            currentStage = "resize"
            emit(emitStep("resize", slot))
            const sized = await runStage("resize", () =>
              resizeForRatio(master, ratio),
            )

            // ---- compose ----
            currentStage = "compose"
            emit(emitStep("compose", slot))
            const composed = await runStage("compose", () =>
              composeCreative({
                base: sized,
                ratio,
                headline,
                logoPath,
                primaryHex: brand.brand.colors.primary,
              }),
            )

            // ---- compliance ----
            currentStage = "compliance"
            emit(emitStep("compliance", slot))
            compliance = runCompliance({
              headline,
              bannedWords: brand.bannedWords,
            })
            emit(
              emitComplianceResult(slot, compliance.badge, compliance.checks.bannedWords),
            )

            // ---- write ----
            currentStage = "write"
            emit(emitStep("write", slot))
            outputPath = await runStage("write", () =>
              writeCreativeOutput({
                campaign: brief.campaign,
                market,
                productSlug,
                ratio,
                png: composed,
              }),
            )
            emit(emitCreativeReady(slot, outputPath, resolved.source))
          } catch (err) {
            failedAt =
              err instanceof StageError
                ? { stage: err.stage, message: err.message }
                : { stage: currentStage, message: errMessage(err) }
            emit(emitError(failedAt.stage, failedAt.message, slot))
          }

          if (failedAt) {
            errors.push({ ...slot, stage: failedAt.stage, message: failedAt.message })
            // Omit `compliance` from the creative entry unless the
            // failure was at the `write` stage (compliance had already run).
            const entry: Creative = {
              product: productSlug,
              market,
              ratio,
              source: resolved.source,
              path: null,
              ...(failedAt.stage === "write" && compliance
                ? { compliance: toComplianceField(compliance) }
                : {}),
            }
            creatives.push(entry)
          } else {
            creatives.push({
              product: productSlug,
              market,
              ratio,
              source: resolved.source,
              path: outputPath,
              ...(compliance ? { compliance: toComplianceField(compliance) } : {}),
            })
          }
        }),
      )
    }
  }

  // Sort for deterministic output (Promise.all completion order is racey).
  creatives.sort(byCreative)
  errors.sort(byError)

  return buildManifest(brief, creatives, errors)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(
  brief: Brief,
  brand: BrandProfile,
  product: { name: string; sku: string },
  market: string,
  ratio: AspectRatio,
): string {
  return buildPromptPreview({
    brand: {
      displayName: brand.brand.displayName,
      voice: brand.voice.promptFragments,
      paletteHexes: [
        brand.brand.colors.primary,
        brand.brand.colors.accent,
        brand.brand.colors.background ?? "",
      ].filter(Boolean),
      bannedWords: brand.bannedWords,
    },
    product,
    market,
    ratio,
  })
}

/**
 * Wrap a stage's awaited work so any thrown error carries its `stage` tag.
 * The catch block in the per-creative loop prefers `StageError` over the
 * bare `currentStage` fallback when both are available — they should always
 * agree, but the tag survives accidental re-wrapping by intermediate code.
 */
async function runStage<T>(stage: ErrorStage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof StageError) throw err
    throw new StageError(stage, err)
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function toComplianceField(c: ReturnType<typeof runCompliance>): {
  badge: ComplianceBadge
  checks: { logoPresent: boolean; colorsOk: boolean; bannedWords: string[] }
} {
  return { badge: c.badge, checks: c.checks }
}

function buildManifest(
  brief: Brief,
  creatives: Creative[],
  errors: ManifestError[],
): Manifest {
  const succeededList = creatives.filter((c) => c.path !== null)
  const succeeded = succeededList.length
  const failed = errors.length
  const requested = brief.products.length * brief.markets.length * brief.ratios.length
  const generated = succeededList.filter((c) => c.source === "genai").length
  const reused = succeededList.filter((c) => c.source === "local").length
  const flagged = succeededList.filter(
    (c) => c.compliance?.badge === "WARN" || c.compliance?.badge === "FAIL",
  ).length

  return {
    campaign: brief.campaign,
    brand: brief.brand,
    outputDir: `outputs/${brief.campaign}`,
    counts: { requested, succeeded, failed, generated, reused, flagged },
    creatives,
    errors,
  }
}

const RATIO_ORDER: Record<AspectRatio, number> = { "1x1": 0, "9x16": 1, "16x9": 2 }
function byCreative(a: Creative, b: Creative): number {
  return (
    a.market.localeCompare(b.market) ||
    a.product.localeCompare(b.product) ||
    RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
  )
}
function byError(a: ManifestError, b: ManifestError): number {
  return (
    a.market.localeCompare(b.market) ||
    a.product.localeCompare(b.product) ||
    RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
  )
}

function jsonError(
  status: number,
  errors: { path: (string | number)[]; message: string }[],
): NextResponse {
  return NextResponse.json({ errors }, { status })
}
