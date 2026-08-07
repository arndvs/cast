/**
 * Asset resolver — pipeline stage `resolve`.
 *
 * Resolution order:
 *   1. `inputs/assets/[productSlug].{png,jpg,jpeg,webp}` — flat upload bucket
 *      (source: "local")
 *   2. Brand products manifest can variants — `inputs/brands/[slug]/products/`
 *      matched by SKU (source: "products")
 *   3. No local asset found → GenAI fill (source: "genai")
 *
 * Repo-relative path is returned for "local"; container-relative key for
 * "products" (brand-loader already resolved them). The orchestrator reads
 * both types via StorageAdapter.
 */

import type { BrandProfile } from "@/lib/cast/schemas"
import { findLocalAsset } from "@/lib/cast/server/storage"

export type ResolvedAsset =
  | { source: "local"; file: string }
  | { source: "products"; file: string; pose: string; detail: string }
  | { source: "genai" }

export async function resolveAsset(
  productSlug: string,
  sku?: string,
  brand?: BrandProfile,
): Promise<ResolvedAsset> {
  // 1. Check inputs/assets/ flat bucket first (manually uploaded photos take
  //    precedence over brand-embedded can PNGs).
  const file = await findLocalAsset(productSlug)
  if (file) return { source: "local", file }

  // 2. Check brand can variants matched by SKU.
  if (sku && brand && brand.canVariants.length > 0) {
    const variant = brand.canVariants.find((c) => c.sku === sku)
    if (variant) {
      return {
        source: "products",
        file: variant.file,
        pose: variant.pose,
        detail: variant.detail,
      }
    }
  }

  // 3. Fall through to GenAI.
  return { source: "genai" }
}
