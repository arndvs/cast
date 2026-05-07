/**
 * `deriveCounts` — UI-facing breakdown derived from the run manifest.
 *
 * The helper has two contracts to keep:
 *   1. Mirror the canonical mass counts (requested / succeeded / reused /
 *      generated) from `manifest.counts`.
 *   2. Compute the visual badge totals (`ok / warn / fail`) where `fail`
 *      includes both hard pipeline failures (`path === null`) and
 *      compliance-FAILed successes (`badge === "FAIL"`), and `flagged`
 *      is the helper-local `warn + fail` sum used by the WARN tooltip.
 *
 * For the WARN+FAIL-on-succeeded case the helper's `flagged` matches
 * `manifest.counts.flagged` (the canonical invariant). For all-failed runs the
 * helper's `fail` reports the visible failure count even though
 * `manifest.counts.flagged` is `0` (because the invariant only counts succeeded).
 */

import { describe, it, expect } from "vitest"

import { deriveCounts } from "@/lib/cast/manifest-counts"
import type { Creative, Manifest } from "@/lib/cast/schemas"

function mkManifest(creatives: Creative[], partialCounts: Partial<Manifest["counts"]> = {}): Manifest {
  const succeeded = creatives.filter((c) => c.path !== null).length
  const failed = creatives.length - succeeded
  const flagged = creatives.filter(
    (c) =>
      c.path !== null &&
      (c.compliance?.badge === "WARN" || c.compliance?.badge === "FAIL"),
  ).length
  return {
    campaign: "test-campaign",
    brand: "brisa",
    outputDir: "outputs/test-campaign",
    counts: {
      requested: creatives.length,
      succeeded,
      failed,
      generated: succeeded,
      reused: 0,
      flagged,
      ...partialCounts,
    },
    creatives,
    errors: creatives
      .filter((c) => c.path === null)
      .map((c) => ({
        product: c.product,
        market: c.market,
        ratio: c.ratio,
        stage: "compose" as const,
        message: "stub",
      })),
  }
}

function ok(product: string, market = "us-en", ratio: "1x1" | "9x16" | "16x9" = "1x1"): Creative {
  return {
    product,
    market,
    ratio,
    source: "local",
    path: `outputs/test-campaign/${market}/${product}/${ratio}.png`,
    compliance: {
      badge: "OK",
      checks: { logoPresent: true, bannedWords: [] },
    },
  }
}

function warn(product: string): Creative {
  return {
    ...ok(product),
    compliance: {
      badge: "WARN",
      checks: { logoPresent: true, bannedWords: [] },
    },
  }
}

function failCompliance(product: string): Creative {
  return {
    ...ok(product),
    compliance: {
      badge: "FAIL",
      checks: { logoPresent: false, bannedWords: ["bad"] },
    },
  }
}

function hardFail(product: string): Creative {
  return {
    product,
    market: "us-en",
    ratio: "1x1",
    source: "genai",
    path: null,
  }
}

describe("deriveCounts", () => {
  it("OK-only manifest: warn=0, fail=0, flagged=0", () => {
    const m = mkManifest([ok("a"), ok("b"), ok("c")])
    const d = deriveCounts(m)
    expect(d).toMatchObject({ ok: 3, warn: 0, fail: 0, flagged: 0 })
    expect(d.flagged).toBe(m.counts.flagged)
  })

  it("WARN+FAIL mixed (compliance-fail on succeeded): flagged matches manifest.counts.flagged", () => {
    const m = mkManifest([ok("a"), warn("b"), failCompliance("c"), warn("d")])
    const d = deriveCounts(m)
    expect(d).toMatchObject({ ok: 1, warn: 2, fail: 1 })
    expect(d.flagged).toBe(d.warn + d.fail)
    // counts.flagged counts WARN+FAIL on succeeded only — matches the
    // helper's flagged here because every entry has `path !== null`.
    expect(d.flagged).toBe(m.counts.flagged)
  })

  it("all-failed manifest: fail counts every creative; helper.flagged > manifest.counts.flagged", () => {
    const m = mkManifest([hardFail("a"), hardFail("b"), hardFail("c")])
    const d = deriveCounts(m)
    expect(d).toMatchObject({ ok: 0, warn: 0, fail: 3, flagged: 3 })
    // The canonical invariant only counts WARN+FAIL on succeeded creatives, so the manifest's
    // own `flagged` is 0 here. The helper's `flagged` is the visible
    // total (warn+fail) — the WARN tooltip surfaces this number.
    expect(m.counts.flagged).toBe(0)
    expect(d.flagged).toBe(d.warn + d.fail)
  })

  it("mirrors mass counts (requested/succeeded/reused/generated) from manifest.counts", () => {
    const m = mkManifest([ok("a"), ok("b")], { reused: 1, generated: 1 })
    const d = deriveCounts(m)
    expect(d.requested).toBe(m.counts.requested)
    expect(d.succeeded).toBe(m.counts.succeeded)
    expect(d.reused).toBe(m.counts.reused)
    expect(d.generated).toBe(m.counts.generated)
  })

  it("mixed hard-fail and compliance-fail: fail = path-null + badge-FAIL", () => {
    const m = mkManifest([ok("a"), failCompliance("b"), hardFail("c"), hardFail("d")])
    const d = deriveCounts(m)
    expect(d).toMatchObject({ ok: 1, warn: 0, fail: 3, flagged: 3 })
  })

  it("succeeded creative with omitted compliance counts as OK (matches UI fallback)", () => {
    // The schema marks `compliance` optional and `CreativeTile` / status
    // filter both fall back to "OK" when absent. The helper must agree so
    // ok + warn + fail === requested holds and summary cards don't undercount.
    const noBadge: Creative = {
      product: "a",
      market: "us-en",
      ratio: "1x1",
      source: "local",
      path: "outputs/test-campaign/us-en/a/1x1.png",
    }
    const m = mkManifest([noBadge, ok("b"), warn("c"), hardFail("d")])
    const d = deriveCounts(m)
    expect(d).toMatchObject({ ok: 2, warn: 1, fail: 1 })
    expect(d.ok + d.warn + d.fail).toBe(m.counts.requested)
  })

  it("averageDuration: computes mean of succeeded creatives with duration", () => {
    const a: Creative = { ...ok("a"), duration: 2.0 }
    const b: Creative = { ...ok("b"), duration: 4.0 }
    const c: Creative = { ...ok("c"), duration: 3.0 }
    const m = mkManifest([a, b, c])
    const d = deriveCounts(m)
    expect(d.averageDuration).toBe(3.0)
  })

  it("averageDuration: null when no creatives have duration", () => {
    const m = mkManifest([ok("a"), ok("b")])
    const d = deriveCounts(m)
    expect(d.averageDuration).toBeNull()
  })

  it("averageDuration: excludes failed creatives (path === null)", () => {
    const a: Creative = { ...ok("a"), duration: 2.0 }
    const b: Creative = { ...hardFail("b"), duration: 10.0 }
    const m = mkManifest([a, b])
    const d = deriveCounts(m)
    expect(d.averageDuration).toBe(2.0)
  })
})
