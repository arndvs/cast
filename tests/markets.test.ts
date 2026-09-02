import { describe, it, expect } from "vitest"
import { getMarket, activeLanguages } from "@/lib/cast/markets"

describe("getMarket", () => {
  it("returns a known market by code, undefined for unknown codes", () => {
    expect(getMarket("us-en")).toEqual({
      code: "us-en",
      name: "United States · English",
      language: "en",
    })
    expect(getMarket("xx-yy")).toBeUndefined()
  })
})

describe("activeLanguages", () => {
  it("deduplicates languages, preserving first-seen order", () => {
    const result = activeLanguages(["de-de", "us-en", "de-de", "fr-fr"])
    expect(result.map((m) => m.language)).toEqual(["de", "en", "fr"])
  })

  it("synthesizes a market for unknown codes and dedupes against known ones", () => {
    expect(activeLanguages([])).toEqual([])
    const synthesized = activeLanguages(["jp-ja"])
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0]).toEqual({
      code: "jp-ja",
      name: "jp-ja",
      language: "ja",
    })
    // "us-en" is known (language "en"), "gb-en" is synthetic (language "en")
    expect(activeLanguages(["us-en", "gb-en"])).toHaveLength(1)
  })
})
