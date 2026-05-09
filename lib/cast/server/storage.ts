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
import type { AspectRatio } from "@/lib/cast/schemas"

const ASSET_EXTS = ["png", "jpg", "jpeg", "webp"] as const

/**
 * Scan `inputs/assets/` for a product photo named after `productSlug`.
 * Returns the **repo-relative** path (`inputs/assets/foo.png`) or `null`.
 */
export async function findLocalAsset(productSlug: string): Promise<string | null> {
  const adapter = getStorageAdapter()
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
  return getStorageAdapter().readFile("inputs", key)
}

/**
 * Wipe `outputs/[campaign]/` before writing anything for run idempotency.
 * Safe on first run (no-op if prefix doesn't exist).
 */
export async function clearCampaignOutput(campaign: string): Promise<void> {
  await getStorageAdapter().deletePrefix("outputs", campaign)
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
  await getStorageAdapter().writeFile("outputs", key, png, "image/png")
  return path.posix.join("outputs", key)
}

/** Write the brief snapshot at `outputs/[campaign]/brief.json`. */
export async function writeBriefSnapshot(
  campaign: string,
  brief: unknown,
): Promise<string> {
  const key = `${campaign}/brief.json`
  const data = JSON.stringify(brief, null, 2) + "\n"
  await getStorageAdapter().writeFile("outputs", key, data, "application/json")
  return path.posix.join("outputs", key)
}

/** Write the run manifest at `outputs/[campaign]/report.json`. */
export async function writeReport(
  campaign: string,
  manifest: unknown,
): Promise<string> {
  const key = `${campaign}/report.json`
  const data = JSON.stringify(manifest, null, 2) + "\n"
  await getStorageAdapter().writeFile("outputs", key, data, "application/json")
  return path.posix.join("outputs", key)
}
