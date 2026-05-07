import { describe, it, expect } from "vitest"
import {
  getMarket,
  activeLanguages,
  ALL_MARKETS,
} from "@/lib/cast/markets"

describe("getMarket", () => {
  it("returns a known market by code", () => {
    const m = getMarket("us-en")
    expect(m).toEqual({ code: "us-en", name: "United States · English", language: "en" })
  })

  it("returns undefined for unknown code", () => {
    expect(getMarket("xx-yy")).toBeUndefined()
  })
})

describe("activeLanguages", () => {
  it("returns empty for no markets", () => {
    expect(activeLanguages([])).toEqual([])
  })

  it("deduplicates languages", () => {
    const result = activeLanguages(["us-en", "us-en"])
    expect(result).toHaveLength(1)
    expect(result[0].language).toBe("en")
  })

  it("returns languages in first-seen order", () => {
    const result = activeLanguages(["de-de", "us-en", "fr-fr"])
    expect(result.map((m) => m.language)).toEqual(["de", "en", "fr"])
  })

  it("synthesizes market for unknown codes", () => {
    const result = activeLanguages(["jp-ja"])
    expect(result).toHaveLength(1)
    expect(result[0].language).toBe("ja")
    expect(result[0].code).toBe("jp-ja")
  })

  it("deduplicates across known and synthetic", () => {
    // "us-en" is known (language "en"), "gb-en" is synthetic (language "en")
    const result = activeLanguages(["us-en", "gb-en"])
    expect(result).toHaveLength(1)
    expect(result[0].language).toBe("en")
  })
})

describe("ALL_MARKETS", () => {
  it("is frozen", () => {
    expect(() => (ALL_MARKETS as unknown as { push: (v: unknown) => void }).push({ code: "x", name: "x", language: "x" })).toThrow()
  })
})
