/**
 * `buildPromptPreview` — per-SKU fragments, negative prompts, and mood keywords.
 */

import { describe, it, expect } from "vitest"
import { buildPromptPreview, type PromptPreviewBrand, type PromptPreviewProduct } from "@/lib/cast/prompt"

function makeBrand(overrides: Partial<PromptPreviewBrand> = {}): PromptPreviewBrand {
  return {
    displayName: "Brisa",
    voice: ["mineral palette", "morning light"],
    paletteHexes: ["#FFFFFF", "#000000"],
    bannedWords: ["guarantee", "free"],
    ...overrides,
  }
}

function makeProduct(overrides: Partial<PromptPreviewProduct> = {}): PromptPreviewProduct {
  return { name: "Brisa Citrus", sku: "BRS-CIT-12", ...overrides }
}

describe("buildPromptPreview — baseline", () => {
  it("includes product name and SKU", () => {
    const prompt = buildPromptPreview({ brand: makeBrand(), product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("Brisa Citrus")
    expect(prompt).toContain("BRS-CIT-12")
  })

  it("includes brand display name", () => {
    const prompt = buildPromptPreview({ brand: makeBrand(), product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("Brisa")
  })

  it("includes the ratio hint", () => {
    const prompt = buildPromptPreview({ brand: makeBrand(), product: makeProduct(), market: "us-en", ratio: "9x16" })
    expect(prompt).toContain("9x16")
    expect(prompt).toContain("story")
  })

  it("includes locale marker", () => {
    const prompt = buildPromptPreview({ brand: makeBrand(), product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("us-en")
  })
})

describe("buildPromptPreview — skuFragments", () => {
  it("prepends SKU prompt fragments before brand voice", () => {
    const product = makeProduct({
      skuFragments: { promptFragments: ["sharp citrus zest", "morning light"] },
    })
    const prompt = buildPromptPreview({ brand: makeBrand(), product, market: "us-en", ratio: "1x1" })
    const voiceIdx = prompt.indexOf("mineral palette")
    const skuIdx = prompt.indexOf("sharp citrus zest")
    expect(skuIdx).toBeGreaterThan(-1)
    expect(skuIdx).toBeLessThan(voiceIdx)
  })

  it("includes sceneMood in the prompt", () => {
    const product = makeProduct({ skuFragments: { sceneMood: "morning · meal · move" } })
    const prompt = buildPromptPreview({ brand: makeBrand(), product, market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("morning · meal · move")
  })

  it("produces same output when skuFragments is undefined", () => {
    const promptWith = buildPromptPreview({
      brand: makeBrand(), product: makeProduct({ skuFragments: undefined }), market: "us-en", ratio: "1x1",
    })
    const promptWithout = buildPromptPreview({
      brand: makeBrand(), product: makeProduct(), market: "us-en", ratio: "1x1",
    })
    expect(promptWith).toBe(promptWithout)
  })
})

describe("buildPromptPreview — negativePromptFragments", () => {
  it("includes negative prompt fragments in the avoid line", () => {
    const brand = makeBrand({ negativePromptFragments: ["no candy-pastel backgrounds", "no dessert composition"] })
    const prompt = buildPromptPreview({ brand, product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("no candy-pastel backgrounds")
    expect(prompt).toContain("no dessert composition")
  })

  it("still includes banned words alongside negative fragments", () => {
    const brand = makeBrand({
      bannedWords: ["guarantee"],
      negativePromptFragments: ["no gym equipment"],
    })
    const prompt = buildPromptPreview({ brand, product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("guarantee")
    expect(prompt).toContain("no gym equipment")
  })

  it("omits avoid line when no banned words and no negative fragments", () => {
    const brand = makeBrand({ bannedWords: [], negativePromptFragments: [] })
    const prompt = buildPromptPreview({ brand, product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).not.toContain("Avoid:")
  })
})

describe("buildPromptPreview — moodKeywords", () => {
  it("includes mood keywords in the prompt", () => {
    const brand = makeBrand({ moodKeywords: ["mineral", "airy"] })
    const prompt = buildPromptPreview({ brand, product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).toContain("mineral")
    expect(prompt).toContain("airy")
  })

  it("omits mood line when moodKeywords is absent", () => {
    const brand = makeBrand({ moodKeywords: undefined })
    const prompt = buildPromptPreview({ brand, product: makeProduct(), market: "us-en", ratio: "1x1" })
    expect(prompt).not.toContain("Mood:")
  })
})
