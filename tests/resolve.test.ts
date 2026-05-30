/**
 * `resolveAsset` — three-way resolution: local flat bucket, brand can
 * variants, and GenAI fallback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/cast/server/storage", () => ({
  findLocalAsset: vi.fn(),
}))

import { findLocalAsset } from "@/lib/cast/server/storage"
import { resolveAsset } from "@/lib/cast/server/pipeline/resolve"
import type { BrandProfile } from "@/lib/cast/schemas"

const mockedFind = findLocalAsset as ReturnType<typeof vi.fn>

function makeBrand(canVariants: BrandProfile["canVariants"] = []): BrandProfile {
  return {
    slug: "acme",
    brand: { displayName: "Acme", colors: { primary: "#000000", accent: "#ffffff" } },
    voice: { tone: "test", do: [], dont: [], promptFragments: [], negativePromptFragments: [], moodKeywords: [] },
    bannedWords: [],
    logoVariants: [],
    defaultLogoId: "primary",
    fontPath: "/abs/font.otf",
    canVariants,
    backgroundVariants: [],
  }
}

beforeEach(() => {
  mockedFind.mockReset()
})

describe("resolveAsset — local flat bucket wins", () => {
  it("returns source:local when findLocalAsset finds a match", async () => {
    mockedFind.mockResolvedValue("inputs/assets/my-product.png")
    const result = await resolveAsset("my-product", "SKU-001", makeBrand())
    expect(result).toEqual({ source: "local", file: "inputs/assets/my-product.png" })
  })

  it("flat-bucket hit takes precedence over brand can variant", async () => {
    mockedFind.mockResolvedValue("inputs/assets/my-product.png")
    const brand = makeBrand([
      { id: "can-x", sku: "SKU-001", file: "/abs/products/can.png", pose: "upright-center", detail: "clean" },
    ])
    const result = await resolveAsset("my-product", "SKU-001", brand)
    expect(result.source).toBe("local")
  })
})

describe("resolveAsset — brand can variants", () => {
  it("returns source:products when a matching SKU variant is found", async () => {
    mockedFind.mockResolvedValue(null)
    const brand = makeBrand([
      { id: "citrus-front", sku: "BRS-CIT-12", file: "/abs/products/can-citrus.png", pose: "upright-center", detail: "clean" },
    ])
    const result = await resolveAsset("brisa-citrus", "BRS-CIT-12", brand)
    expect(result).toEqual({
      source: "products",
      file: "/abs/products/can-citrus.png",
      pose: "upright-center",
      detail: "clean",
    })
  })

  it("returns source:genai when SKU does not match any variant", async () => {
    mockedFind.mockResolvedValue(null)
    const brand = makeBrand([
      { id: "citrus-front", sku: "BRS-CIT-12", file: "/abs/products/can.png", pose: "upright-center", detail: "clean" },
    ])
    const result = await resolveAsset("brisa-berry", "BRS-BRY-12", brand)
    expect(result.source).toBe("genai")
  })

  it("returns source:genai when brand has empty canVariants", async () => {
    mockedFind.mockResolvedValue(null)
    const result = await resolveAsset("volt-zero", "VLT-ZRO-12", makeBrand([]))
    expect(result.source).toBe("genai")
  })
})

describe("resolveAsset — GenAI fallback", () => {
  it("returns source:genai when no local asset and no sku provided", async () => {
    mockedFind.mockResolvedValue(null)
    const result = await resolveAsset("unknown-product")
    expect(result.source).toBe("genai")
  })

  it("returns source:genai when no local asset and no brand provided", async () => {
    mockedFind.mockResolvedValue(null)
    const result = await resolveAsset("unknown-product", "SKU-001")
    expect(result.source).toBe("genai")
  })
})
