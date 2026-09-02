import { describe, expect, it } from "vitest"

import { gridSize, gridSlots, RATIO_ORDER, slotKey, slotOrder } from "@/lib/cast/slot-grid"
import { deriveCreativeStatuses } from "@/lib/cast/derive-creative-statuses"
import type { Brief } from "@/lib/cast/schemas"

function mkBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    campaign: "summer",
    brand: "brisa",
    products: [
      { name: "Brisa Citrus", sku: "BRS-001" },
      { name: "Lime Fizz", sku: "BRS-002" },
    ],
    markets: ["us-en", "de-de"],
    audience: "Fitness enthusiasts",
    message: { en: "Stay fresh", de: "Bleib frisch" },
    ratios: ["1x1", "9x16", "16x9"],
    ...overrides,
  }
}

describe("slotKey", () => {
  it("builds the canonical product/market/ratio key", () => {
    expect(slotKey("brisa-citrus", "us-en", "1x1")).toBe("brisa-citrus/us-en/1x1")
  })
})

describe("gridSize", () => {
  it("computes products × markets × ratios", () => {
    expect(gridSize(mkBrief())).toBe(2 * 2 * 3)
  })

  it("handles single-product briefs", () => {
    const brief = mkBrief({ products: [{ name: "One", sku: "O-1" }] })
    expect(gridSize(brief)).toBe(1 * 2 * 3)
  })
})

describe("gridSlots", () => {
  it("iterates every coordinate in canonical order", () => {
    const slots = gridSlots(mkBrief())
    expect(slots).toHaveLength(12)
    // Product order: brief order; market order: brief order; ratio order: canonical.
    expect(slots[0]).toEqual({ product: "brisa-citrus", market: "us-en", ratio: "1x1" })
    expect(slots[1]).toEqual({ product: "brisa-citrus", market: "us-en", ratio: "9x16" })
    expect(slots[2]).toEqual({ product: "brisa-citrus", market: "us-en", ratio: "16x9" })
    expect(slots[3]).toEqual({ product: "brisa-citrus", market: "de-de", ratio: "1x1" })
    expect(slots[6]).toEqual({ product: "lime-fizz", market: "us-en", ratio: "1x1" })
  })

  it("slugifies product names (matches server slugify)", () => {
    const slots = gridSlots(mkBrief())
    const products = [...new Set(slots.map((s) => s.product))]
    expect(products).toEqual(["brisa-citrus", "lime-fizz"])
  })
})

describe("RATIO_ORDER / slotOrder", () => {
  it("orders ratios 1x1 → 9x16 → 16x9", () => {
    expect(RATIO_ORDER).toEqual({ "1x1": 0, "9x16": 1, "16x9": 2 })
    const ratios = ["16x9", "1x1", "9x16"] as const
    const sorted = [...ratios].sort(
      (a, b) => RATIO_ORDER[a] - RATIO_ORDER[b],
    )
    expect(sorted).toEqual(["1x1", "9x16", "16x9"])
  })

  it("sorts slots by product → market → ratio", () => {
    const slots = [
      { product: "b", market: "us-en", ratio: "1x1" as const },
      { product: "a", market: "us-en", ratio: "16x9" as const },
      { product: "a", market: "de-de", ratio: "1x1" as const },
      { product: "a", market: "us-en", ratio: "9x16" as const },
    ]
    const sorted = [...slots].sort(slotOrder)
    expect(sorted[0]).toEqual({ product: "a", market: "de-de", ratio: "1x1" })
    expect(sorted[1]).toEqual({ product: "a", market: "us-en", ratio: "9x16" })
    expect(sorted[2]).toEqual({ product: "a", market: "us-en", ratio: "16x9" })
    expect(sorted[3]).toEqual({ product: "b", market: "us-en", ratio: "1x1" })
  })
})

describe("cross-boundary slot identity", () => {
  it("client status keys line up with gridSlots coordinates", () => {
    const brief = mkBrief()
    const statusMap = deriveCreativeStatuses([], brief)
    // Every grid slot must be present as a queued entry keyed by slotKey.
    for (const slot of gridSlots(brief)) {
      const key = slotKey(slot.product, slot.market, slot.ratio)
      expect(statusMap.get(key)).toBeDefined()
      expect(statusMap.get(key)?.status).toBe("queued")
    }
    // No extra slots beyond the grid.
    expect(statusMap.size).toBe(gridSize(brief))
  })
})