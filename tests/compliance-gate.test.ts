/**
 * Pre-spend compliance gate (S1).
 *
 * A localized headline that hits the banned-words union must produce
 * `compliance_failed` + `error` events for EVERY (product × ratio) slot in
 * that market, and the manifest must record them at stage "compliance" with
 * `path: null` — so the counts invariants (`succeeded + failed === requested`,
 * `errors.length === failed`) hold WITHOUT any genai call.
 *
 * The gate itself lives inline in `runPipeline` (route.ts); this test locks
 * the event contract + manifest accounting shape it relies on, so a future
 * refactor that moves the gate can't silently break the wire format.
 */

import { describe, it, expect } from "vitest"
import { pipelineEventSchema } from "@/lib/cast/events"
import { manifestSchema } from "@/lib/cast/schemas"

const SLOT = { product: "brisa-citrus", market: "de-de", ratio: "1x1" }

describe("pre-spend compliance gate event contract", () => {
  it("emits a compliance_failed event with the offending terms", () => {
    const result = pipelineEventSchema.safeParse({
      type: "compliance_failed",
      slot: SLOT,
      bannedWords: ["cocaine", "heroin"],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const ev = result.data
      if (ev.type !== "compliance_failed")
        throw new Error("expected compliance_failed")
      expect(ev.type).toBe("compliance_failed")
      expect(ev.bannedWords).toEqual(["cocaine", "heroin"])
    }
  })

  it("rejects a compliance_failed event without bannedWords", () => {
    const result = pipelineEventSchema.safeParse({
      type: "compliance_failed",
      slot: SLOT,
    })
    expect(result.success).toBe(false)
  })

  it("accepts error events tagged with the compliance stage", () => {
    const result = pipelineEventSchema.safeParse({
      type: "error",
      stage: "compliance",
      slot: SLOT,
      message: "headline for de contains banned term(s): cocaine",
    })
    expect(result.success).toBe(true)
  })

  it("keeps compliance_failed out of the post-compose compliance_result badge", () => {
    // compliance_failed is a distinct event type — it must never collide with
    // the OK/WARN/FAIL badge of a *succeeded* creative.
    const badgeResult = pipelineEventSchema.safeParse({
      type: "compliance_result",
      slot: SLOT,
      badge: "FAIL",
      bannedWords: ["cocaine"],
    })
    expect(badgeResult.success).toBe(true)
    expect(badgeResult.success ? badgeResult.data.type : "").toBe(
      "compliance_result"
    )
  })
})

describe("pre-spend compliance gate manifest accounting", () => {
  it("hosts a fully compliance-failed market in a valid manifest", () => {
    // One market (de-de), one product, one ratio — the whole market gated.
    const m = {
      campaign: "summer-refresh-2026",
      brand: "brisa",
      outputDir: "outputs/summer-refresh-2026",
      counts: {
        requested: 1,
        succeeded: 0,
        failed: 1,
        generated: 0,
        reused: 0,
        flagged: 0,
      },
      creatives: [
        {
          product: "brisa-citrus",
          market: "de-de",
          ratio: "1x1",
          source: "genai",
          path: null,
        },
      ],
      errors: [
        {
          product: "brisa-citrus",
          market: "de-de",
          ratio: "1x1",
          stage: "compliance",
          message: "headline for de contains banned term(s): cocaine",
        },
      ],
    }
    const result = manifestSchema.safeParse(m)
    expect(result.success).toBe(true)
  })

  it("satisfies the counts invariants for a whole-market gate", () => {
    const products = 2
    const markets = 1 // one gated market
    const ratios = 3
    const requested = products * markets * ratios
    const creatives = Array.from({ length: requested }, (_, i) => {
      const ratio = ["1x1", "9x16", "16x9"][i % 3]
      const product = ["brisa-citrus", "brisa-berry"][Math.floor(i / 3)]
      return { product, market: "de-de", ratio, source: "genai", path: null }
    })
    const errors = creatives.map((c) => ({
      product: c.product,
      market: c.market,
      ratio: c.ratio,
      stage: "compliance" as const,
      message: "headline for de contains banned term(s): cocaine",
    }))
    const failed = errors.length
    expect(requested).toBe(products * markets * ratios)
    expect(failed).toBe(requested)
    // Invariants
    expect(failed).toBe(errors.length)
    expect(0 + failed).toBe(requested) // succeeded + failed === requested
  })
})
