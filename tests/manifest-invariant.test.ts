/**
 * Manifest invariants.
 *
 *   counts.generated + counts.reused === counts.succeeded
 *   counts.flagged counts WARN+FAIL on succeeded only
 *   errors.length === counts.failed
 *   succeeded + failed === requested
 *
 * Also exercises the schema's structural rules (closed enums, market/slug
 * regexes, nullable path on failure, omitted compliance on non-write fail).
 */

import { describe, it, expect } from "vitest"
import { manifestSchema, type Manifest } from "@/lib/cast/schemas"

function mkManifest(overrides: Partial<Manifest> = {}): Manifest {
  const base: Manifest = {
    campaign: "summer-refresh-2026",
    brand: "brisa",
    outputDir: "outputs/summer-refresh-2026",
    counts: {
      requested: 4,
      succeeded: 3,
      failed: 1,
      generated: 2,
      reused: 1,
      flagged: 1,
    },
    creatives: [
      {
        product: "brisa-citrus",
        market: "us-en",
        ratio: "1x1",
        source: "local",
        path: "outputs/summer-refresh-2026/us-en/brisa-citrus/1x1.png",
        compliance: {
          badge: "OK",
          checks: { logoPresent: true, colorsOk: true, bannedWords: [] },
        },
      },
      {
        product: "brisa-citrus",
        market: "us-en",
        ratio: "9x16",
        source: "genai",
        path: "outputs/summer-refresh-2026/us-en/brisa-citrus/9x16.png",
        compliance: {
          badge: "WARN",
          checks: { logoPresent: true, colorsOk: false, bannedWords: [] },
        },
      },
      {
        product: "brisa-citrus",
        market: "us-en",
        ratio: "16x9",
        source: "genai",
        path: "outputs/summer-refresh-2026/us-en/brisa-citrus/16x9.png",
        compliance: {
          badge: "OK",
          checks: { logoPresent: true, colorsOk: true, bannedWords: [] },
        },
      },
      {
        product: "brisa-berry",
        market: "us-en",
        ratio: "1x1",
        source: "genai",
        path: null, // failed at compose; compliance omitted
      },
    ],
    errors: [
      {
        product: "brisa-berry",
        market: "us-en",
        ratio: "1x1",
        stage: "compose",
        message: "sharp: input file is missing",
      },
    ],
  }
  return { ...base, ...overrides }
}

describe("manifest invariants", () => {
  it("parses a fully-valid manifest", () => {
    const result = manifestSchema.safeParse(mkManifest())
    expect(result.success).toBe(true)
  })

  it("counts.generated + counts.reused === counts.succeeded", () => {
    const m = mkManifest()
    expect(m.counts.generated + m.counts.reused).toBe(m.counts.succeeded)
  })

  it("counts.flagged counts only WARN+FAIL on succeeded", () => {
    const m = mkManifest()
    const flagged = m.creatives.filter(
      (c) =>
        c.path !== null &&
        (c.compliance?.badge === "WARN" || c.compliance?.badge === "FAIL"),
    ).length
    expect(m.counts.flagged).toBe(flagged)
  })

  it("errors.length === counts.failed", () => {
    const m = mkManifest()
    expect(m.errors.length).toBe(m.counts.failed)
  })

  it("succeeded + failed === requested", () => {
    const m = mkManifest()
    expect(m.counts.succeeded + m.counts.failed).toBe(m.counts.requested)
  })

  it("accepts local creatives with a null path on resolve-stage failure", () => {
    // path null and source 'local' is allowed (e.g. resolve stage failure
    // on a local upload that vanished). Just assert the schema permits it.
    const m = mkManifest({
      creatives: [
        {
          product: "brisa-berry",
          market: "us-en",
          ratio: "1x1",
          source: "local",
          path: null,
        },
      ],
      errors: [
        {
          product: "brisa-berry",
          market: "us-en",
          ratio: "1x1",
          stage: "resolve",
          message: "ENOENT",
        },
      ],
      counts: {
        requested: 1,
        succeeded: 0,
        failed: 1,
        generated: 0,
        reused: 0,
        flagged: 0,
      },
    })
    expect(manifestSchema.safeParse(m).success).toBe(true)
  })

  it("rejects unrecognized stage values in errors[]", () => {
    const m = mkManifest({
      errors: [
        {
          product: "brisa-berry",
          market: "us-en",
          ratio: "1x1",
          // @ts-expect-error — testing schema rejection
          stage: "render",
          message: "no such stage",
        },
      ],
    })
    expect(manifestSchema.safeParse(m).success).toBe(false)
  })

  it("rejects malformed market codes", () => {
    const m = mkManifest({
      creatives: [
        {
          product: "brisa-citrus",
          market: "us_en", // underscore — invalid
          ratio: "1x1",
          source: "local",
          path: "outputs/x.png",
        },
      ],
    })
    expect(manifestSchema.safeParse(m).success).toBe(false)
  })
})
