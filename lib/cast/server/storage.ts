/**
 * LocalFsStorage — single point of contact between the pipeline and disk.
 *
 * Every path passes through `safeJoin` (D12, D13). All callers MUST validate
 * `campaign` / `market` / `productSlug` against the canonical regexes BEFORE
 * invoking these helpers. The pipeline writer relies on this — it does not
 * re-validate per write.
 */

import fs from "node:fs/promises"
import path from "node:path"
import { safeJoin } from "@/lib/cast/server/safe-join"
import type { AspectRatio } from "@/lib/cast/schemas"

const ASSET_EXTS = ["png", "jpg", "jpeg", "webp"] as const

/**
 * Scan `inputs/assets/` for a product photo named after `productSlug`.
 * Returns the **repo-relative** path (`inputs/assets/foo.png`) or `null`.
 */
export async function findLocalAsset(productSlug: string): Promise<string | null> {
  for (const ext of ASSET_EXTS) {
    // TODO(symlink-hardening): re-validate with realpath
    const abs = safeJoin("inputs", "assets", `${productSlug}.${ext}`)
    try {
      await fs.access(abs)
      return path.posix.join("inputs", "assets", `${productSlug}.${ext}`)
    } catch {
      // try next ext
    }
  }
  return null
}

/** Read a local asset as a Buffer (caller already resolved via findLocalAsset). */
export async function readAsset(repoRelativePath: string): Promise<Buffer> {
  const segments = repoRelativePath.split(/[/\\]/).filter(Boolean)
  if (segments.shift() !== "inputs") {
    throw new Error(`expected inputs-rooted path, got "${repoRelativePath}"`)
  }
  // TODO(symlink-hardening): re-validate with realpath
  const abs = safeJoin("inputs", ...segments)
  return fs.readFile(abs)
}

/**
 * Idempotency (D15): wipe `outputs/[campaign]/` before writing anything.
 * Safe on first run (ENOENT swallowed).
 */
export async function clearCampaignOutput(campaign: string): Promise<void> {
  // TODO(symlink-hardening): re-validate with realpath
  const dir = safeJoin("outputs", campaign)
  await fs.rm(dir, { recursive: true, force: true })
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
  // TODO(symlink-hardening): re-validate with realpath
  const dir = safeJoin("outputs", campaign, market, productSlug)
  await fs.mkdir(dir, { recursive: true })
  // TODO(symlink-hardening): re-validate with realpath
  const abs = safeJoin("outputs", campaign, market, productSlug, `${ratio}.png`)
  await fs.writeFile(abs, png)
  return path.posix.join("outputs", campaign, market, productSlug, `${ratio}.png`)
}

/** Write the brief snapshot at `outputs/[campaign]/brief.json`. */
export async function writeBriefSnapshot(
  campaign: string,
  brief: unknown,
): Promise<string> {
  // TODO(symlink-hardening): re-validate with realpath
  const dir = safeJoin("outputs", campaign)
  await fs.mkdir(dir, { recursive: true })
  const abs = safeJoin("outputs", campaign, "brief.json")
  await fs.writeFile(abs, JSON.stringify(brief, null, 2) + "\n", "utf8")
  return path.posix.join("outputs", campaign, "brief.json")
}

/** Write the run manifest at `outputs/[campaign]/report.json`. */
export async function writeReport(
  campaign: string,
  manifest: unknown,
): Promise<string> {
  // TODO(symlink-hardening): re-validate with realpath
  const dir = safeJoin("outputs", campaign)
  await fs.mkdir(dir, { recursive: true })
  const abs = safeJoin("outputs", campaign, "report.json")
  await fs.writeFile(abs, JSON.stringify(manifest, null, 2) + "\n", "utf8")
  return path.posix.join("outputs", campaign, "report.json")
}
