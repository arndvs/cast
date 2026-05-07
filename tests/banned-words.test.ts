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

  it("returns [] for empty text", () => {
    expect(containsBannedWord("", list)).toEqual([])
  })

  it("returns [] when nothing matches", () => {
    expect(containsBannedWord("ordinary marketing copy", list)).toEqual([])
  })

  it("matches whole words case-insensitively", () => {
    expect(containsBannedWord("100% GUARANTEE included", list)).toEqual([
      "guarantee",
    ])
  })

  it("does not match substrings (word boundaries)", () => {
    // "freelance" must NOT trigger "free"
    expect(containsBannedWord("freelance designer", list)).toEqual([])
  })

  it("returns multiple distinct hits", () => {
    const hits = containsBannedWord("our miracle product is free", list)
    expect(hits.sort()).toEqual(["free", "miracle"])
  })

  it("ignores empty / whitespace list entries", () => {
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
