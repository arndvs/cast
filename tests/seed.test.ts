/**
 * Deterministic seeds (S4).
 *
 * deriveSeed must be stable (same inputs → same seed), differ across inputs,
 * and stay within the 31-bit positive range accepted by dall-e-3.
 */

import { describe, it, expect } from "vitest"
import { deriveSeed, seedForSlot } from "@/lib/cast/server/pipeline/seed"

describe("deriveSeed", () => {
  it("is deterministic for identical inputs", () => {
    expect(deriveSeed("hero product photo", "1x1")).toBe(
      deriveSeed("hero product photo", "1x1"),
    )
  })

  it("differs across prompts", () => {
    expect(deriveSeed("prompt A", "1x1")).not.toBe(deriveSeed("prompt B", "1x1"))
  })

  it("differs across ratios for the same prompt", () => {
    expect(deriveSeed("prompt", "1x1")).not.toBe(deriveSeed("prompt", "9x16"))
  })

  it("stays within 31-bit positive range", () => {
    for (let i = 0; i < 100; i++) {
      const seed = deriveSeed(`prompt ${i}`, `${i}`, "extra")
      expect(Number.isSafeInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(0x7fffffff)
    }
  })

  it("seedForSlot keys by prompt + ratio", () => {
    expect(seedForSlot("same", "1x1")).toBe(seedForSlot("same", "1x1"))
    expect(seedForSlot("same", "1x1")).not.toBe(seedForSlot("same", "16x9"))
  })
})