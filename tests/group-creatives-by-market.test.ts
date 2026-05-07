import { describe, it, expect } from "vitest"
import { groupCreativesByMarket } from "@/lib/cast/group-creatives-by-market"
import type { Creative } from "@/lib/cast/schemas"

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    product: "sunscreen",
    market: "us-en",
    ratio: "1x1",
    source: "genai",
    path: "outputs/summer/us-en/sunscreen-1x1.png",
    ...overrides,
  }
}

describe("groupCreativesByMarket", () => {
  it("returns empty array for empty input", () => {
    expect(groupCreativesByMarket([])).toEqual([])
  })

  it("groups all creatives under a single market", () => {
    const creatives = [
      makeCreative({ product: "a", market: "us-en" }),
      makeCreative({ product: "b", market: "us-en" }),
    ]
    const result = groupCreativesByMarket(creatives)
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe("us-en")
    expect(result[0][1]).toHaveLength(2)
  })

  it("preserves insertion order of markets", () => {
    const creatives = [
      makeCreative({ market: "de-de" }),
      makeCreative({ market: "us-en" }),
      makeCreative({ market: "de-de", product: "b" }),
    ]
    const result = groupCreativesByMarket(creatives)
    expect(result.map(([code]) => code)).toEqual(["de-de", "us-en"])
  })

  it("sorts within market by product then by ratio order", () => {
    const creatives = [
      makeCreative({ product: "z", market: "us-en", ratio: "16x9" }),
      makeCreative({ product: "a", market: "us-en", ratio: "9x16" }),
      makeCreative({ product: "a", market: "us-en", ratio: "1x1" }),
    ]
    const result = groupCreativesByMarket(creatives)
    const sorted = result[0][1]
    // "a" before "z", then 1x1 before 9x16
    expect(sorted[0].product).toBe("a")
    expect(sorted[0].ratio).toBe("1x1")
    expect(sorted[1].product).toBe("a")
    expect(sorted[1].ratio).toBe("9x16")
    expect(sorted[2].product).toBe("z")
  })
})
