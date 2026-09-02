/**
 * Pipeline orchestrator — plan-then-execute.
 *
 * Separates the *plan* (which slots to run, in what order, with what
 * resolution strategy and cache grouping) from the *execution* (the
 * imperative run loop in `app/api/generate/route.ts`).
 *
 * `buildExecutionPlan` is pure — it declares the per-slot contract the
 * orchestrator executes by, without running any I/O. The cache-group strings
 * make the mode-dependent keying explicit and testable: cheap mode shares one
 * master per product across all ratios; default mode keys one master per
 * (product × ratio).
 */

import type { Slot } from "@/lib/cast/slot-grid"
import { slugify } from "@/lib/cast/identifiers"
import type { Brief } from "@/lib/cast/schemas"
import type { GenAIMode } from "@/lib/cast/server/pipeline/genai"

// ---------------------------------------------------------------------------
// Plan types
// ---------------------------------------------------------------------------

/** Resolution strategy for one slot's master image. */
export type SlotSource = "local" | "products" | "genai"

/**
 * One executable unit — a single (product × market × ratio) coordinate with
 * its execution strategy pre-declared.
 */
export interface SlotPlan {
  slot: Slot
  /** Slugified product name — matches the wire `Slot`. */
  productSlug: string
  /** Resolution strategy (matches `ResolvedAsset.source`). */
  source: SlotSource
  /**
   * Cache-group string — the identity of the master image this slot reuses.
   * Cheap mode: `cheap:{market}:{productSlug}` (one master per product×market).
   * Default mode: `default:{market}:{productSlug}:{ratio}` (one per ratio).
   * Local/products: `disk:{market}:{productSlug}` (no generation).
   */
  cacheGroup: string
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

/**
 * Build the execution plan for a brief — one entry per (product × market ×
 * ratio) in canonical order, with its resolution strategy and cache group.
 *
 * Pure: no I/O. The route never resolves assets here — the `source` is a
 * plan-time *declaration* (refined at execute time by the resolver); the plan
 * exists to make the cache-keying contract explicit and testable.
 *
 * @param mode genai mode — determines the cache grouping (cheap shares a
 *   master per product, default keys per ratio).
 */
export function buildExecutionPlan(brief: Brief, mode: GenAIMode): SlotPlan[] {
  const plan: SlotPlan[] = []
  for (const product of brief.products) {
    const productSlug = slugify(product.name)
    for (const market of brief.markets) {
      for (const ratio of brief.ratios) {
        const slot: Slot = { product: productSlug, market, ratio }
        const cacheGroup =
          mode === "cheap"
            ? `cheap:${market}:${productSlug}`
            : `default:${market}:${productSlug}:${ratio}`
        plan.push({ slot, productSlug, source: "genai", cacheGroup })
      }
    }
  }
  return plan
}