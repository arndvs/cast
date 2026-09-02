import { describe, it, expect } from "vitest"
import {
  containsBannedWord,
  getDefaultBannedWords,
} from "@/lib/cast/banned-words"

describe("getDefaultBannedWords", () => {
  it("returns a non-empty frozen list", () => {
    const list = getDefaultBannedWords()
    expect(list.length).toBeGreaterThan(0)
    expect(() => (list as string[]).push("x")).toThrow()
  })
})

describe("containsBannedWord", () => {
  const list = ["guarantee", "miracle", "free"]

  it("matches whole words case-insensitively, not substrings", () => {
    expect(containsBannedWord("100% GUARANTEE included", list)).toEqual([
      "guarantee",
    ])
    // "freelance" must NOT trigger "free"
    expect(containsBannedWord("freelance designer", list)).toEqual([])
    expect(containsBannedWord("", list)).toEqual([])
  })

  it("returns multiple distinct hits", () => {
    expect(
      containsBannedWord("our miracle product is free", list).sort()
    ).toEqual(["free", "miracle"])
  })

  it("skips empty and whitespace list entries", () => {
    expect(containsBannedWord("free trial", ["", "  ", "free"])).toEqual([
      "free",
    ])
  })

  it("escapes regex metacharacters in list entries", () => {
    // A list with regex metacharacters must not blow up; literal match only.
    expect(containsBannedWord("a+b", ["a+b"])).toEqual(["a+b"])
    expect(containsBannedWord("axb", ["a+b"])).toEqual([])
  })
})
