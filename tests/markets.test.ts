import { describe, it, expect } from "vitest"
import { getMarket, activeLanguages, languageOf, regionOf } from "@/lib/cast/markets"

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

describe("languageOf", () => {
  it("returns the catalog language for known markets", () => {
    expect(languageOf("us-en")).toBe("en")
    expect(languageOf("de-de")).toBe("de")
  })

  it("falls back to the locale suffix for unknown markets", () => {
    expect(languageOf("jp-ja")).toBe("ja")
    expect(languageOf("gb-en")).toBe("en")
  })

  it("handles edge cases", () => {
    expect(languageOf("us")).toBe("us")
    expect(languageOf("")).toBe("")
  })
})

describe("regionOf", () => {
  it("returns the region prefix", () => {
    expect(regionOf("us-en")).toBe("us")
    expect(regionOf("mx-es")).toBe("mx")
  })

  it("handles edge cases", () => {
    expect(regionOf("us")).toBe("us")
    expect(regionOf("")).toBe("")
  })
})
