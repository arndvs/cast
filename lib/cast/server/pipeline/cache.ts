/**
 * Persistent cross-run master cache (S3).
 *
 * MCRDSE's asset-first reuse proven: re-running an unchanged brief must not
 * re-pay for identical generations. Cast's existing `baseImageCache` is a
 * per-request Map; this adds a DISK cache keyed by a hash of the prompt text,
 * so a second run of the same campaign with the same brief skips the genai
 * call entirely.
 *
 * Design:
 *   - Keys: `sha1(prompt).slice(0, 16)` — the prompt fully determines the
 *     image (mode + revisedPrompt recorded in the sidecar meta for audit).
 *   - Location: `outputs/[campaign]/.pipeline-cache/<hash>.png` +
 *     `<hash>.meta.json`, via the StorageAdapter (local FS or Azure Blob).
 *   - `clearCampaignOutput` EXEMPTS `.pipeline-cache/` — the cache is
 *     append-only per campaign until an explicit prune.
 *   - The in-process Map remains the fast path; this module is the slow-path
 *     persistence backing it on first touch.
 */

import { createHash } from "node:crypto"
import { getStorageAdapter } from "@/lib/cast/server/storage-adapter"

const CACHE_DIR = ".pipeline-cache"

export interface CachedMasterMeta {
  model: string | null
  revisedPrompt: string | null
  promptUsed: string
  mode: "default" | "cheap"
  cachedAt: string
}

export interface CachedMaster {
  png: Buffer
  meta: CachedMasterMeta
}

/** Stable 16-char key for a prompt. */
export function cacheKey(prompt: string): string {
  return createHash("sha1").update(prompt).digest("hex").slice(0, 16)
}

/**
 * Look up a cached master for a prompt.
 * Returns null when missing (adapter ENOENT) or the meta can't be read —
 * a cache miss must never throw.
 */
export async function lookupCachedMaster(
  campaign: string,
  prompt: string,
): Promise<CachedMaster | null> {
  const key = cacheKey(prompt)
  const adapter = await getStorageAdapter()
  const pngKey = `${campaign}/${CACHE_DIR}/${key}.png`
  try {
    if (!(await adapter.fileExists("outputs", pngKey))) return null
    const [png, metaRaw] = await Promise.all([
      adapter.readFile("outputs", pngKey),
      adapter.readFile("outputs", `${campaign}/${CACHE_DIR}/${key}.meta.json`),
    ])
    const meta = JSON.parse(metaRaw.toString("utf8")) as CachedMasterMeta
    return { png, meta }
  } catch {
    return null
  }
}

/**
 * Write a generated master + meta into the cache. Best-effort: failure to
 * cache must never fail the run.
 */
export async function writeCachedMaster(
  campaign: string,
  prompt: string,
  png: Buffer,
  meta: Omit<CachedMasterMeta, "cachedAt">,
): Promise<void> {
  const key = cacheKey(prompt)
  const adapter = await getStorageAdapter()
  const payload: CachedMasterMeta = { ...meta, cachedAt: new Date().toISOString() }
  try {
    await Promise.all([
      adapter.writeFile("outputs", `${campaign}/${CACHE_DIR}/${key}.png`, png, "image/png"),
      adapter.writeFile(
        "outputs",
        `${campaign}/${CACHE_DIR}/${key}.meta.json`,
        JSON.stringify(payload, null, 2) + "\n",
        "application/json",
      ),
    ])
  } catch {
    // Cache is a performance optimization, not a correctness dependency.
  }
}

/**
 * Prune the campaign cache (opt-in per brief via `prunePipelineCache`).
 */
export async function clearPipelineCache(campaign: string): Promise<void> {
  try {
    const adapter = await getStorageAdapter()
    await adapter.deletePrefix("outputs", `${campaign}/${CACHE_DIR}/`)
  } catch {
    // No-op on missing prefix.
  }
}

export { CACHE_DIR }