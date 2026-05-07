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

describe("creativeMatchesFilters", () => {
  describe("ratio filter", () => {
    it("passes ALL", () => {
      expect(
        creativeMatchesFilters(makeCreative({ ratio: "9x16" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
        }),
      ).toBe(true)
    })

    it("matches exact ratio", () => {
      expect(
        creativeMatchesFilters(makeCreative({ ratio: "9x16" }), {
          status: "ALL",
          ratio: "9x16",
          market: "ALL",
        }),
      ).toBe(true)
    })

    it("rejects mismatched ratio", () => {
      expect(
        creativeMatchesFilters(makeCreative({ ratio: "1x1" }), {
          status: "ALL",
          ratio: "16x9",
          market: "ALL",
        }),
      ).toBe(false)
    })
  })

  describe("market filter", () => {
    it("passes ALL", () => {
      expect(
        creativeMatchesFilters(makeCreative({ market: "de-de" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
        }),
      ).toBe(true)
    })

    it("matches exact market", () => {
      expect(
        creativeMatchesFilters(makeCreative({ market: "de-de" }), {
          status: "ALL",
          ratio: "ALL",
          market: "de-de",
        }),
      ).toBe(true)
    })

    it("rejects mismatched market", () => {
      expect(
        creativeMatchesFilters(makeCreative({ market: "us-en" }), {
          status: "ALL",
          ratio: "ALL",
          market: "fr-fr",
        }),
      ).toBe(false)
    })
  })

  describe("status filter", () => {
    it("passes ALL regardless of badge", () => {
      expect(
        creativeMatchesFilters(
          makeCreative({ compliance: { badge: "WARN", checks: { logoPresent: true, colorsOk: true, bannedWords: [] } } }),
          { status: "ALL", ratio: "ALL", market: "ALL" },
        ),
      ).toBe(true)
    })

    it("treats null path as FAIL", () => {
      expect(
        creativeMatchesFilters(makeCreative({ path: null }), {
          status: "FAIL",
          ratio: "ALL",
          market: "ALL",
        }),
      ).toBe(true)
    })

    it("treats null path as not OK", () => {
      expect(
        creativeMatchesFilters(makeCreative({ path: null }), {
          status: "OK",
          ratio: "ALL",
          market: "ALL",
        }),
      ).toBe(false)
    })

    it("treats missing compliance as OK", () => {
      expect(
        creativeMatchesFilters(makeCreative({ compliance: undefined }), {
          status: "OK",
          ratio: "ALL",
          market: "ALL",
        }),
      ).toBe(true)
    })

    it("matches WARN badge", () => {
      expect(
        creativeMatchesFilters(
          makeCreative({ compliance: { badge: "WARN", checks: { logoPresent: true, colorsOk: true, bannedWords: ["free"] } } }),
          { status: "WARN", ratio: "ALL", market: "ALL" },
        ),
      ).toBe(true)
    })
  })

  describe("combined filters", () => {
    it("all filters must pass", () => {
      const creative = makeCreative({ market: "us-en", ratio: "9x16" })
      expect(
        creativeMatchesFilters(creative, {
          status: "OK",
          ratio: "9x16",
          market: "us-en",
        }),
      ).toBe(true)
    })

    it("rejects when one filter fails", () => {
      const creative = makeCreative({ market: "us-en", ratio: "9x16" })
      expect(
        creativeMatchesFilters(creative, {
          status: "OK",
          ratio: "1x1",
          market: "us-en",
        }),
      ).toBe(false)
    })
  })

  describe("query filter", () => {
    it("matches product substring", () => {
      expect(
        creativeMatchesFilters(makeCreative({ product: "sunscreen" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "sun",
        }),
      ).toBe(true)
    })

    it("matches market substring", () => {
      expect(
        creativeMatchesFilters(makeCreative({ market: "de-de" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "de-de",
        }),
      ).toBe(true)
    })

    it("matches ratio", () => {
      expect(
        creativeMatchesFilters(makeCreative({ ratio: "9x16" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "9x16",
        }),
      ).toBe(true)
    })

    it("matches source", () => {
      expect(
        creativeMatchesFilters(makeCreative({ source: "genai" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "genai",
        }),
      ).toBe(true)
    })

    it("is case-insensitive", () => {
      expect(
        creativeMatchesFilters(makeCreative({ product: "sunscreen" }), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "SUNSCREEN",
        }),
      ).toBe(true)
    })

    it("rejects when query matches nothing", () => {
      expect(
        creativeMatchesFilters(makeCreative(), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "nonexistent",
        }),
      ).toBe(false)
    })

    it("passes all when query is empty", () => {
      expect(
        creativeMatchesFilters(makeCreative(), {
          status: "ALL",
          ratio: "ALL",
          market: "ALL",
          query: "",
        }),
      ).toBe(true)
    })

    it("combines with other filters", () => {
      expect(
        creativeMatchesFilters(makeCreative({ product: "sunscreen", ratio: "9x16" }), {
          status: "OK",
          ratio: "9x16",
          market: "ALL",
          query: "sun",
        }),
      ).toBe(true)

      expect(
        creativeMatchesFilters(makeCreative({ product: "sunscreen", ratio: "9x16" }), {
          status: "OK",
          ratio: "1x1",
          market: "ALL",
          query: "sun",
        }),
      ).toBe(false)
    })
  })
})
