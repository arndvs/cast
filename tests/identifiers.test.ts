import { describe, expect, it } from "vitest"

import {
  ALL_RATIOS,
  HEX_RE,
  MARKET_RE,
  SLUG_RE,
  slugify,
} from "@/lib/cast/identifiers"

describe("slugify", () => {
  it("matches the resolver / upload contract", () => {
    expect(slugify("Brisa Citrus")).toBe("brisa-citrus")
    expect(slugify("  Brisa  Citrus  ")).toBe("brisa-citrus")
    expect(slugify("Brisa & Berry!")).toBe("brisa-berry")
  })

  it("collapses non-alphanumeric runs and strips edges", () => {
    expect(slugify("---Foo---Bar---")).toBe("foo-bar")
    expect(slugify("Foo.Bar_Baz")).toBe("foo-bar-baz")
    expect(slugify("123")).toBe("123")
  })

  it("handles empty and whitespace-only input", () => {
    expect(slugify("")).toBe("")
    expect(slugify("   ")).toBe("")
  })
})

describe("SLUG_RE", () => {
  it("accepts canonical slugs", () => {
    expect(SLUG_RE.test("brisa-citrus")).toBe(true)
    expect(SLUG_RE.test("a")).toBe(true)
    expect(SLUG_RE.test("a1-b2")).toBe(true)
  })

  it("rejects non-slug shapes", () => {
    expect(SLUG_RE.test("Brisa")).toBe(false)
    expect(SLUG_RE.test("brisa_citrus")).toBe(false)
    expect(SLUG_RE.test("-brisa")).toBe(false)
    expect(SLUG_RE.test("brisa-")).toBe(false)
    expect(SLUG_RE.test("brisa citrus")).toBe(false)
    expect(SLUG_RE.test("")).toBe(false)
  })
})

describe("MARKET_RE", () => {
  it("accepts <region>-<lang> codes", () => {
    expect(MARKET_RE.test("us-en")).toBe(true)
    expect(MARKET_RE.test("mx-es")).toBe(true)
    expect(MARKET_RE.test("de-de")).toBe(true)
  })

  it("rejects malformed market codes", () => {
    expect(MARKET_RE.test("us")).toBe(false)
    expect(MARKET_RE.test("us-en-gb")).toBe(false)
    expect(MARKET_RE.test("US-EN")).toBe(false)
    expect(MARKET_RE.test("us_en")).toBe(false)
    expect(MARKET_RE.test("")).toBe(false)
  })
})

describe("HEX_RE", () => {
  it("accepts 6-digit hex colors", () => {
    expect(HEX_RE.test("#ffffff")).toBe(true)
    expect(HEX_RE.test("#FF00AA")).toBe(true)
    expect(HEX_RE.test("#1a2b3c")).toBe(true)
  })

  it("rejects malformed colors", () => {
    expect(HEX_RE.test("fff")).toBe(false)
    expect(HEX_RE.test("#ffff")).toBe(false)
    expect(HEX_RE.test("#fffffff")).toBe(false)
    expect(HEX_RE.test("ffffff")).toBe(false)
    expect(HEX_RE.test("#gggggg")).toBe(false)
  })
})

describe("ALL_RATIOS", () => {
  it("is the canonical ordered ratio set", () => {
    expect(ALL_RATIOS).toEqual(["1x1", "9x16", "16x9"])
  })
})