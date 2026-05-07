import { describe, expect, it } from "vitest"

import { castAppReducer, type CastAppState } from "@/components/cast/cast-app-state"
import type { Brief } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseBrief: Brief = {
  campaign: "summer-refresh-2026",
  brand: "brisa",
  products: [
    { name: "Brisa Citrus", sku: "BRS-CIT-12" },
  ],
  markets: ["us-en", "mx-es"],
  audience: "18-34, urban, health-conscious",
  message: { en: "Crack open something brighter.", es: "Abre algo más brillante." },
  ratios: ["1x1"],
}

function makeState(overrides?: Partial<CastAppState>): CastAppState {
  return {
    brandSlug: "brisa",
    brief: { ...baseBrief },
    runState: "editing",
    uploads: {},
    logoVariant: "",
    events: [],
    manifest: null,
    runError: null,
    runStartedAt: new Date(),
    screen: "brief-editor",
    detailOpen: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("toggleMarket", () => {
  describe("adding a market", () => {
    it("adds the market code to markets", () => {
      const state = makeState({ brief: { ...baseBrief, markets: ["us-en"] } })

      const result = castAppReducer(state, { type: "toggleMarket", code: "mx-es" })

      expect(result.brief.markets).toContain("mx-es")
    })

    it("seeds an empty message key for a newly added language", () => {
      const state = makeState({
        brief: { ...baseBrief, markets: ["us-en"], message: { en: "Hello" } },
      })

      const result = castAppReducer(state, { type: "toggleMarket", code: "mx-es" })

      expect(result.brief.message).toHaveProperty("es", "")
    })

    it("does not overwrite an existing message key when adding a market for the same language", () => {
      const state = makeState({
        brief: {
          ...baseBrief,
          markets: ["us-en"],
          message: { en: "Hello" },
        },
      })

      // gb-en is not in the catalog — falls back to code.split("-").pop() = "en"
      const result = castAppReducer(state, { type: "toggleMarket", code: "gb-en" })

      expect(result.brief.message.en).toBe("Hello")
    })
  })

  describe("removing a market", () => {
    it("removes the market code from markets", () => {
      const state = makeState()

      const result = castAppReducer(state, { type: "toggleMarket", code: "mx-es" })

      expect(result.brief.markets).not.toContain("mx-es")
    })

    it("drops the auto-seeded empty message key when the last market for that language is removed", () => {
      // mx-es is the only Spanish market; value is still the auto-seeded "" → key is deleted
      const state = makeState({
        brief: { ...baseBrief, message: { en: "Crack open something brighter.", es: "" } },
      })

      const result = castAppReducer(state, { type: "toggleMarket", code: "mx-es" })

      expect(result.brief.message).not.toHaveProperty("es")
    })

    it("retains a non-empty message key even when the last market for that language is removed", () => {
      // User typed a headline for es; toggling mx-es off should preserve their content
      const state = makeState()

      const result = castAppReducer(state, { type: "toggleMarket", code: "mx-es" })

      expect(result.brief.message).toHaveProperty("es", "Abre algo más brillante.")
    })

    it("retains the message key when another market still uses that language", () => {
      // us-en and gb-en both map to language "en"; removing us-en should keep message.en
      const state = makeState({
        brief: {
          ...baseBrief,
          markets: ["us-en", "gb-en"],
          message: { en: "Hello" },
        },
      })

      const result = castAppReducer(state, { type: "toggleMarket", code: "us-en" })

      expect(result.brief.message).toHaveProperty("en", "Hello")
    })
  })
})
