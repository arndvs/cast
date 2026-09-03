/**
 * Pipeline storage helpers — delegates all I/O to the active StorageAdapter.
 *
 * Public API is unchanged — callers import the same named functions. Internally,
 * every operation flows through `getStorageAdapter()` so swapping from local
 * filesystem to Azure Blob (Slice 2) requires zero changes here.
 *
 * All callers MUST validate `campaign` / `market` / `productSlug` against the
 * canonical regexes BEFORE invoking these helpers.
 */

import path from "node:path"
import { getStorageAdapter } from "@/lib/cast/server/storage-adapter"
import { PathTraversalError } from "@/lib/cast/server/safe-join"
import { CACHE_DIR } from "@/lib/cast/server/pipeline/cache"
import type { AspectRatio } from "@/lib/cast/schemas"
import {
  ASSET_EXTS,
  assetKeysFor,
  type AssetExt,
} from "@/lib/cast/asset-files"

/**
 * Scan `inputs/assets/` for a product photo named after `productSlug`.
 * Returns the **repo-relative** path (`inputs/assets/foo.png`) or `null`.
 */
export async function findLocalAsset(productSlug: string): Promise<string | null> {
  const adapter = await getStorageAdapter()
  for (const ext of ASSET_EXTS) {
    const key = `assets/${productSlug}.${ext}`
    if (await adapter.fileExists("inputs", key)) {
      return path.posix.join("inputs", key)
    }
  }
  return null
}

/** Read an asset as a Buffer (caller already resolved via findLocalAsset). */
export async function readAsset(repoRelativePath: string): Promise<Buffer> {
  const segments = repoRelativePath.split(/[/\\]/).filter(Boolean)
  const container = segments.shift()
  if (container !== "inputs") {
    throw new Error(`expected inputs-rooted path, got "${repoRelativePath}"`)
  }
  const key = segments.join("/")
  return (await getStorageAdapter()).readFile("inputs", key)
}

/**
 * Wipe `outputs/[campaign]/` before writing anything for run idempotency —
 * EXCEPT `.pipeline-cache/` (S3). The persistent master cache must survive
 * the idempotent wipe so re-running an unchanged brief skips genai entirely;
 * it's only removed by the opt-in `prunePipelineCache` brief flag.
 * Safe on first run (no-op if prefix doesn't exist).
 */
export async function clearCampaignOutput(campaign: string): Promise<void> {
  const adapter = await getStorageAdapter()
  // Enumerate everything under the campaign; delete per-market/product
  // subtree prefixes, then the campaign-root files (brief.json), leaving
  // `.pipeline-cache/` untouched.
  const files = await adapter.listFiles("outputs", campaign + "/")
  const marketPrefixes = new Set<string>()
  const rootFiles: string[] = []
  for (const key of files) {
    const rest = key.slice(campaign.length + 1) // after "campaign/"
    const top = rest.split("/")[0]
    if (!top) continue
    if (top === CACHE_DIR) continue // exempt
    if (rest.includes("/")) marketPrefixes.add(top)
    else rootFiles.push(key)
  }
  await Promise.all(
    [...marketPrefixes].map((m) =>
      adapter.deletePrefix("outputs", `${campaign}/${m}/`),
    ),
  )
  for (const f of rootFiles) {
    await adapter.deleteFile("outputs", f)
  }
}

/**
 * Write `outputs/[campaign]/[market]/[product]/[ratio].png` and return the
 * repo-relative path string (for the manifest).
 */
export async function writeCreative(
  campaign: string,
  market: string,
  productSlug: string,
  ratio: AspectRatio,
  png: Buffer,
): Promise<string> {
  const key = `${campaign}/${market}/${productSlug}/${ratio}.png`
  await (await getStorageAdapter()).writeFile("outputs", key, png, "image/png")
  return path.posix.join("outputs", key)
}

/**
 * Write a 1×1 transparent PNG stub at the slot path (S7). Used on final
 * genai failure so the outputs grid shows a placeholder tile instead of a
 * silent gap. The manifest still records `path: null` + `stubbed: true` —
 * a stub is never counted as a succeeded creative.
 */
const STUB_PNG_HEX =
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
  "0000000a49444154789c626000000002000198e7399f0000000049454e44ae426082"

export async function writeCreativeStub(
  campaign: string,
  market: string,
  productSlug: string,
  ratio: AspectRatio,
): Promise<string> {
  const key = `${campaign}/${market}/${productSlug}/${ratio}.png`
  try {
    await (await getStorageAdapter()).writeFile(
      "outputs",
      key,
      Buffer.from(STUB_PNG_HEX, "hex"),
      "image/png",
    )
  } catch {
    // Stub write is best-effort — a failure to place the placeholder must not
    // mask the underlying genai error already recorded.
  }
  return path.posix.join("outputs", key)
}

/** Write metadata sidecar at `outputs/[campaign]/[market]/[product]/[ratio].metadata.json`. */
export async function writeMetadata(
  campaign: string,
  market: string,
  productSlug: string,
  ratio: AspectRatio,
  metadata: unknown,
): Promise<string> {
  const key = `${campaign}/${market}/${productSlug}/${ratio}.metadata.json`
  const data = JSON.stringify(metadata, null, 2) + "\n"
  await (await getStorageAdapter()).writeFile("outputs", key, data, "application/json")
  return path.posix.join("outputs", key)
}

/** Write the brief snapshot at `outputs/[campaign]/brief.json`. */
export async function writeBriefSnapshot(
  campaign: string,
  brief: unknown,
): Promise<string> {
  const key = `${campaign}/brief.json`
  const data = JSON.stringify(brief, null, 2) + "\n"
  await (await getStorageAdapter()).writeFile("outputs", key, data, "application/json")
  return path.posix.join("outputs", key)
}

/** Write the run manifest at `outputs/[campaign]/report.json`. */
export async function writeReport(
  campaign: string,
  manifest: unknown,
): Promise<string> {
  const key = `${campaign}/report.json`
  const data = JSON.stringify(manifest, null, 2) + "\n"
  await (await getStorageAdapter()).writeFile("outputs", key, data, "application/json")
  return path.posix.join("outputs", key)
}

/** Max concurrent storage lookups in detectAssetFiles to avoid throttling. */
const DETECT_CONCURRENCY = 8

/**
 * Detect which asset files exist for the given product slugs.
 * Returns `{ slug, foundFile }` pairs where `foundFile` is the filename
 * (e.g. `"slug.png"`) or `null` if no asset was found.
 *
 * Concurrency is capped at {@link DETECT_CONCURRENCY} to prevent unbounded
 * fan-out against Azure Blob Storage on large requests.
 */
export async function detectAssetFiles(
  slugs: string[],
): Promise<{ slug: string; foundFile: string | null }[]> {
  const results: { slug: string; foundFile: string | null }[] = []
  for (let i = 0; i < slugs.length; i += DETECT_CONCURRENCY) {
    const batch = slugs.slice(i, i + DETECT_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (slug) => {
        const found = await findLocalAsset(slug)
        return { slug, foundFile: found ? path.posix.basename(found) : null }
      }),
    )
    results.push(...batchResults)
  }
  return results
}

/**
 * Save an uploaded asset file, replacing any existing variant for the slug.
 * Deletes all existing extensions first, then writes the new file.
 * Returns the repo-relative path (e.g. `"inputs/assets/slug.png"`).
 */
export async function saveAssetFile(
  productSlug: string,
  ext: AssetExt,
  bytes: Uint8Array,
): Promise<string> {
  if (!(ASSET_EXTS as readonly string[]).includes(ext)) {
    throw new Error(`invalid asset extension "${ext}" — allowed: ${ASSET_EXTS.join(", ")}`)
  }
  const adapter = await getStorageAdapter()
  // Delete every variant so one slug owns one file at a time.
  for (const key of assetKeysFor(productSlug)) {
    await adapter.deleteFile("inputs", key)
  }
  const key = `assets/${productSlug}.${ext}`
  await adapter.writeFile("inputs", key, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return path.posix.join("inputs", key)
}

/**
 * Read a file from the outputs container.
 * Validates individual path segments before delegating to the adapter —
 * rejects absolute paths, parent traversal, and null bytes.
 * Throws if the file does not exist (ENOENT) or the path is invalid.
 */
export async function readOutputFile(...segments: string[]): Promise<Buffer> {
  // Reject obviously invalid raw segments before normalization.
  for (const seg of segments) {
    if (!seg || path.isAbsolute(seg) || path.win32.isAbsolute(seg)) {
      throw new PathTraversalError(`invalid output path segment: "${seg}"`)
    }
  }
  // Normalize: split on both / and \ so embedded separators can't smuggle
  // traversal components past the per-segment check.
  const parts = segments.flatMap((s) => s.split(/[/\\]/)).filter(Boolean)
  for (const part of parts) {
    if (part === "." || part === ".." || part.includes("\0")) {
      throw new PathTraversalError(`invalid output path segment: "${part}"`)
    }
  }
  const key = parts.join("/")
  return (await getStorageAdapter()).readFile("outputs", key)
}
