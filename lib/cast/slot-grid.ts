/**
 * Slot grid — the canonical (product × market × ratio) coordinate space.
 *
 * The Cartesian slot grid is the load-bearing structural contract between
 * the server orchestrator (`app/api/generate/route.ts`) and the client
 * status/progress derivations. It was previously re-derived in five modules
 * with divergent ordering and key-building. This module is the single home
 * for the iteration, ordering, key, and count.
 *
 * Client-safe: no node deps, no zod.
 */

import { slugify } from "@/lib/cast/identifiers"
import { ALL_RATIOS, type AspectRatio } from "@/lib/cast/ratios"
import type { Brief } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// Slot coordinate
// ---------------------------------------------------------------------------

/** Per-creative coordinate. `product` is a slug. */
export interface Slot {
  product: string
  market: string
  ratio: AspectRatio
}

// ---------------------------------------------------------------------------
// Key
// ---------------------------------------------------------------------------

/**
 * Canonical slot key — `product/market/ratio`. The single string identity
 * used by the client status map and matched against server-emitted `Slot`s.
 */
export function slotKey(product: string, market: string, ratio: string): string {
  return `${product}/${market}/${ratio}`
}

// ---------------------------------------------------------------------------
// Ratio ordering
// ---------------------------------------------------------------------------

/** Canonical ratio sort order — 1x1 → 9x16 → 16x9 (registration order). */
export const RATIO_ORDER: Record<AspectRatio, number> = {
  "1x1": 0,
  "9x16": 1,
  "16x9": 2,
}

/** Canonical product → market → ratio sort comparator. */
export function slotOrder(a: Slot, b: Slot): number {
  return (
    a.product.localeCompare(b.product) ||
    a.market.localeCompare(b.market) ||
    RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
  )
}

// ---------------------------------------------------------------------------
// Grid iteration
// ---------------------------------------------------------------------------

/**
 * The single Cartesian iterator — every `(product × market × ratio)`
 * coordinate derived from the brief, in canonical order (products in brief
 * order → markets in brief order → ratios in `ALL_RATIOS` registration
 * order). `product` is the slugified product name, matching what the
 * orchestrator emits on the wire.
 */
export function gridSlots(brief: Brief): Slot[] {
  const slots: Slot[] = []
  for (const product of brief.products) {
    const slug = slugify(product.name)
    for (const market of brief.markets) {
      for (const ratio of brief.ratios) {
        slots.push({ product: slug, market, ratio })
      }
    }
  }
  return slots
}

/** Total slot count — `products × markets × ratios`. */
export function gridSize(brief: Brief): number {
  return brief.products.length * brief.markets.length * brief.ratios.length
}

// ---------------------------------------------------------------------------
// Re-exports (convenience)
// ---------------------------------------------------------------------------

export { ALL_RATIOS }
export type { AspectRatio }