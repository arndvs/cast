import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

import { briefSchema, slugify } from "@/lib/cast/schemas"

const briefJsonPath = path.resolve(process.cwd(), "inputs/brief.json")

describe("briefSchema", () => {
  it("parses inputs/brief.json (golden)", () => {
    const raw = JSON.parse(readFileSync(briefJsonPath, "utf8"))
    const result = briefSchema.safeParse(raw)
    if (!result.success) {
      // Surface the first issue path for fast debugging.
      throw new Error(
        `briefSchema rejected golden inputs/brief.json: ${JSON.stringify(
          result.error.issues,
          null,
          2,
        )}`,
      )
    }
    expect(result.data.campaign).toBe("summer-refresh-2026")
    expect(result.data.brand).toBe("brisa")
    expect(result.data.markets).toEqual(["us-en", "mx-es"])
    expect(result.data.ratios).toEqual(["1x1", "9x16", "16x9"])
  })

  it("rejects a brief whose markets reference a missing locale", () => {
    const bad = {
      campaign: "x",
      brand: "brisa",
      products: [{ name: "A", sku: "A-1" }],
      markets: ["us-en"],
      audience: "test",
      message: { es: "hola" }, // missing `en` for `us-en`
      ratios: ["1x1"],
    }
    const result = briefSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes('message["en"]'),
        ),
      ).toBe(true)
    }
  })

  it("rejects products whose names slug-collide", () => {
    const bad = {
      campaign: "x",
      brand: "brisa",
      products: [
        { name: "Brisa Citrus", sku: "A-1" },
        { name: "Brisa  Citrus", sku: "A-2" }, // double-space → same slug
      ],
      markets: ["us-en"],
      audience: "test",
      message: { en: "hi" },
      ratios: ["1x1"],
    }
    const result = briefSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})

describe("slugify", () => {
  it("matches the resolver / upload contract", () => {
    expect(slugify("Brisa Citrus")).toBe("brisa-citrus")
    expect(slugify("  Brisa  Citrus  ")).toBe("brisa-citrus")
    expect(slugify("Brisa & Berry!")).toBe("brisa-berry")
  })
})
