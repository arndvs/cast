import { describe, it, expect } from "vitest"
import { creativeMatchesFilters } from "@/lib/cast/filter-creatives"
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

const PASS_ALL = {
  status: "ALL" as const,
  ratio: "ALL" as const,
  market: "ALL" as const,
}

describe("creativeMatchesFilters", () => {
  it("passes every creative under ALL filters", () => {
    expect(
      creativeMatchesFilters(
        makeCreative({ market: "de-de", ratio: "9x16" }),
        PASS_ALL
      )
    ).toBe(true)
  })

  it("matches exact ratio and market, rejects mismatches", () => {
    const base = makeCreative({ market: "de-de", ratio: "9x16" })
    expect(creativeMatchesFilters(base, { ...PASS_ALL, ratio: "9x16" })).toBe(
      true
    )
    expect(creativeMatchesFilters(base, { ...PASS_ALL, ratio: "1x1" })).toBe(
      false
    )
    expect(creativeMatchesFilters(base, { ...PASS_ALL, market: "de-de" })).toBe(
      true
    )
    expect(creativeMatchesFilters(base, { ...PASS_ALL, market: "fr-fr" })).toBe(
      false
    )
  })

  it("classifies status from path and compliance badge", () => {
    const ok = makeCreative()
    const warn = makeCreative({
      compliance: {
        badge: "WARN",
        checks: { logoPresent: true, bannedWords: ["free"] },
      },
    })
    const failed = makeCreative({ path: null })
    const noCompliance = makeCreative({ compliance: undefined })

    expect(creativeMatchesFilters(ok, { ...PASS_ALL, status: "OK" })).toBe(true)
    expect(creativeMatchesFilters(warn, { ...PASS_ALL, status: "WARN" })).toBe(
      true
    )
    expect(
      creativeMatchesFilters(noCompliance, { ...PASS_ALL, status: "OK" })
    ).toBe(true)
    // Null path is FAIL — never OK.
    expect(
      creativeMatchesFilters(failed, { ...PASS_ALL, status: "FAIL" })
    ).toBe(true)
    expect(creativeMatchesFilters(failed, { ...PASS_ALL, status: "OK" })).toBe(
      false
    )
    expect(creativeMatchesFilters(ok, { ...PASS_ALL, status: "ALL" })).toBe(
      true
    )
  })

  it("combines all filters, requiring every one to pass", () => {
    const creative = makeCreative({ market: "us-en", ratio: "9x16" })
    const filters = {
      status: "OK" as const,
      ratio: "9x16" as const,
      market: "us-en" as const,
    }
    expect(creativeMatchesFilters(creative, filters)).toBe(true)
    expect(creativeMatchesFilters(creative, { ...filters, ratio: "1x1" })).toBe(
      false
    )
  })

  it("matches the query across product, market, ratio, and source, case-insensitively", () => {
    const creative = makeCreative({
      product: "sunscreen",
      market: "de-de",
      ratio: "9x16",
    })
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "sun" })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "SUNSCREEN" })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "de-de" })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "9x16" })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "genai" })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, { ...PASS_ALL, query: "nonexistent" })
    ).toBe(false)
    expect(creativeMatchesFilters(creative, { ...PASS_ALL, query: "" })).toBe(
      true
    )
  })

  it("applies the query on top of the other filters", () => {
    const creative = makeCreative({ product: "sunscreen", ratio: "9x16" })
    expect(
      creativeMatchesFilters(creative, {
        status: "OK",
        ratio: "9x16",
        market: "ALL",
        query: "sun",
      })
    ).toBe(true)
    expect(
      creativeMatchesFilters(creative, {
        status: "OK",
        ratio: "1x1",
        market: "ALL",
        query: "sun",
      })
    ).toBe(false)
  })
})
