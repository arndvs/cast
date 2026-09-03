import { RATIO_ORDER } from "@/lib/cast/slot-grid"
import type { Creative } from "@/lib/cast/schemas"

/** Group an array of creatives by market code, preserving insertion order. */
export function groupCreativesByMarket(
  creatives: readonly Creative[],
): [string, Creative[]][] {
  const byMarket = new Map<string, Creative[]>()
  for (const creative of creatives) {
    const list = byMarket.get(creative.market) ?? []
    list.push(creative)
    byMarket.set(creative.market, list)
  }
  // Stable order — markets in first-seen order, then by product+ratio inside.
  // Ratios sort by canonical pipeline order (1x1 → 9x16 → 16x9), not
  // lexicographic, so tiles match the operator's mental model.
  return [...byMarket.entries()].map(([marketCode, list]) => [
    marketCode,
    [...list].sort((a, b) => {
      if (a.product !== b.product) return a.product.localeCompare(b.product)
      return RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
    }),
  ])
}
