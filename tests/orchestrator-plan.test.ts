import { describe, expect, it } from "vitest"

import { buildExecutionPlan } from "@/lib/cast/server/pipeline/orchestrator"
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
    audience: "Fitness",
    message: { en: "Stay fresh", de: "Bleib frisch" },
    ratios: ["1x1", "9x16"],
    ...overrides,
  }
}

describe("buildExecutionPlan", () => {
  it("produces one plan entry per (product × market × ratio) in canonical order", () => {
    const plan = buildExecutionPlan(mkBrief(), "default")
    expect(plan).toHaveLength(2 * 2 * 2) // 8 slots

    // product order → market order → ratio order
    expect(plan[0].slot).toEqual({ product: "brisa-citrus", market: "us-en", ratio: "1x1" })
    expect(plan[1].slot).toEqual({ product: "brisa-citrus", market: "us-en", ratio: "9x16" })
    expect(plan[2].slot).toEqual({ product: "brisa-citrus", market: "de-de", ratio: "1x1" })
    expect(plan[4].slot).toEqual({ product: "lime-fizz", market: "us-en", ratio: "1x1" })
  })

  it("default mode keys one cache group per product × ratio", () => {
    const plan = buildExecutionPlan(mkBrief(), "default")
    const groups = plan.map((p) => p.cacheGroup)
    // 2 products × 2 markets × unique-per-ratio = every slot has a distinct group.
    expect(new Set(groups).size).toBe(8)
    expect(plan[0].cacheGroup).toBe("default:us-en:brisa-citrus:1x1")
    expect(plan[1].cacheGroup).toBe("default:us-en:brisa-citrus:9x16")
  })

  it("cheap mode shares one cache group per product within a market", () => {
    const plan = buildExecutionPlan(mkBrief(), "cheap")
    expect(plan[0].cacheGroup).toBe("cheap:us-en:brisa-citrus")
    expect(plan[1].cacheGroup).toBe("cheap:us-en:brisa-citrus") // same group across ratios
    // Distinct across markets and products.
    expect(plan[2].cacheGroup).toBe("cheap:de-de:brisa-citrus")
    expect(plan[4].cacheGroup).toBe("cheap:us-en:lime-fizz")
    // 2 products × 2 markets = 4 distinct groups.
    expect(new Set(plan.map((p) => p.cacheGroup)).size).toBe(4)
  })

  it("slugifies product names to wire slots", () => {
    const plan = buildExecutionPlan(mkBrief(), "default")
    const products = [...new Set(plan.map((p) => p.productSlug))]
    expect(products).toEqual(["brisa-citrus", "lime-fizz"])
  })
})