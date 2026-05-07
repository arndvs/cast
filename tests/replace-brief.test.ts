import { afterEach, describe, expect, it, vi } from "vitest"

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
    { name: "Brisa Berry", sku: "BRS-BRY-12" },
  ],
  markets: ["us-en", "mx-es"],
  audience: "18-34, urban, health-conscious",
  message: { en: "Crack open something brighter.", es: "Abre algo más brillante." },
  ratios: ["1x1", "9x16", "16x9"],
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

describe("replaceBrief", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("replaces the entire brief in state", () => {
    const state = makeState()
    const next: Brief = {
      ...baseBrief,
      campaign: "volt-launch-2026",
      brand: "volt",
      products: [{ name: "Volt Zero", sku: "VLT-Z-12" }],
      markets: ["us-en"],
      message: { en: "Feel the charge." },
      ratios: ["9x16"],
    }

    const result = castAppReducer(state, { type: "replaceBrief", brief: next })

    expect(result.brief).toEqual(next)
    expect(result.brandSlug).toBe("volt")
  })

  it("syncs logoVariant from the new brief", () => {
    const state = makeState()
    const next: Brief = { ...baseBrief, logoVariant: "light" }

    const result = castAppReducer(state, { type: "replaceBrief", brief: next })

    expect(result.logoVariant).toBe("light")
  })

  it("clears logoVariant when new brief omits it", () => {
    const state = makeState({ logoVariant: "dark" })
    const { logoVariant: _drop, ...briefNoLogo } = baseBrief
    void _drop
    const next: Brief = { ...briefNoLogo }

    const result = castAppReducer(state, { type: "replaceBrief", brief: next })

    expect(result.logoVariant).toBe("")
  })

  it("revokes and clears uploads when brief is replaced", () => {
    const revokeUrl = vi.fn()
    vi.stubGlobal("URL", { ...globalThis.URL, revokeObjectURL: revokeUrl })

    const state = makeState({
      uploads: {
        "brisa-citrus": { fileName: "a.png", objectUrl: "blob:a", size: 1, type: "image/png" },
        "brisa-berry": { fileName: "b.png", objectUrl: "blob:b", size: 1, type: "image/png" },
      },
    })
    const next: Brief = { ...baseBrief, products: [{ name: "New Product", sku: "NP-1" }] }

    const result = castAppReducer(state, { type: "replaceBrief", brief: next })

    expect(result.uploads).toEqual({})
    expect(revokeUrl).toHaveBeenCalledWith("blob:a")
    expect(revokeUrl).toHaveBeenCalledWith("blob:b")
  })
})
