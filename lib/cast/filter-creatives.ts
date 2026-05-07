import type { AspectRatio, Creative } from "@/lib/cast/schemas"

export type StatusFilter = "ALL" | "OK" | "WARN" | "FAIL"
export type RatioFilter = "ALL" | AspectRatio
export type MarketCodeFilter = "ALL" | string

export function creativeMatchesFilters(
  creative: Creative,
  filters: { status: StatusFilter; ratio: RatioFilter; market: MarketCodeFilter; query?: string },
): boolean {
  if (filters.ratio !== "ALL" && creative.ratio !== filters.ratio) return false
  if (filters.market !== "ALL" && creative.market !== filters.market) return false
  if (filters.status !== "ALL") {
    const badge: "OK" | "WARN" | "FAIL" =
      creative.path === null ? "FAIL" : (creative.compliance?.badge ?? "OK")
    if (badge !== filters.status) return false
  }
  if (filters.query) {
    const q = filters.query.toLowerCase()
    const haystack = `${creative.product} ${creative.market} ${creative.ratio} ${creative.source}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}
