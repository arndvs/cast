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
  it("groups by market, preserving insertion order", () => {
    const creatives = [
      makeCreative({ market: "de-de" }),
      makeCreative({ market: "us-en" }),
      makeCreative({ market: "de-de", product: "b" }),
    ]
    const result = groupCreativesByMarket(creatives)
    expect(result.map(([code]) => code)).toEqual(["de-de", "us-en"])
    expect(result[0][1]).toHaveLength(2)
  })

  it("sorts within market by product then by canonical ratio order", () => {
    const creatives = [
      makeCreative({ product: "z", market: "us-en", ratio: "16x9" }),
      makeCreative({ product: "a", market: "us-en", ratio: "9x16" }),
      makeCreative({ product: "a", market: "us-en", ratio: "1x1" }),
    ]
    const sorted = groupCreativesByMarket(creatives)[0][1]
    expect(sorted.map((c) => `${c.product}/${c.ratio}`)).toEqual([
      "a/1x1",
      "a/9x16",
      "z/16x9",
    ])
  })
})
