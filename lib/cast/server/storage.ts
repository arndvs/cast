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
import type { AspectRatio } from "@/lib/cast/schemas"

const ASSET_EXTS = ["png", "jpg", "jpeg", "webp"] as const
type AssetExt = (typeof ASSET_EXTS)[number]

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
 * Wipe `outputs/[campaign]/` before writing anything for run idempotency.
 * Safe on first run (no-op if prefix doesn't exist).
 */
export async function clearCampaignOutput(campaign: string): Promise<void> {
  await (await getStorageAdapter()).deletePrefix("outputs", `${campaign}/`)
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

/**
 * Detect which asset files exist for the given product slugs.
 * Returns `{ slug, foundFile }` pairs where `foundFile` is the filename
 * (e.g. `"slug.png"`) or `null` if no asset was found.
 */
export async function detectAssetFiles(
  slugs: string[],
): Promise<{ slug: string; foundFile: string | null }[]> {
  return Promise.all(
    slugs.map(async (slug) => {
      const found = await findLocalAsset(slug)
      return { slug, foundFile: found ? path.posix.basename(found) : null }
    }),
  )
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
  for (const e of ASSET_EXTS) {
    await adapter.deleteFile("inputs", `assets/${productSlug}.${e}`)
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
    if (!seg || path.isAbsolute(seg)) {
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
