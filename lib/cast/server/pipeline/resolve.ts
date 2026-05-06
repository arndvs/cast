/**
 * Asset resolver — pipeline stage `resolve`.
 *
 * Looks for `inputs/assets/[productSlug].{png,jpg,jpeg,webp}`. If a local
 * photo exists the pipeline reuses it; otherwise the GenAI stage fills in.
 *
 * Repo-relative path is returned (manifest-friendly); the orchestrator can
 * call `readAsset` to materialize the buffer.
 */

import { findLocalAsset } from "@/lib/cast/server/storage"

export type ResolvedAsset =
  | { source: "local"; file: string }
  | { source: "genai" }

export async function resolveAsset(productSlug: string): Promise<ResolvedAsset> {
  const file = await findLocalAsset(productSlug)
  if (file) return { source: "local", file }
  return { source: "genai" }
}
