import { describe, expect, it } from "vitest"

import { displayStatusOf, STATUS_FILTER_OPTIONS } from "@/lib/cast/creative-display-status"
import { creativeMatchesFilters } from "@/lib/cast/filter-creatives"
import { deriveCounts } from "@/lib/cast/manifest-counts"
import type { Creative, Manifest } from "@/lib/cast/schemas"

function ok(product = "a"): Creative {
  return {
    product,
    market: "us-en",
    ratio: "1x1",
    source: "local",
    path: `outputs/test/us-en/${product}/1x1.png`,
    compliance: { badge: "OK", checks: { logoPresent: true, bannedWords: [] } },
  }
}

function warn(product = "b"): Creative {
  return {
    ...ok(product),
    compliance: { badge: "WARN", checks: { logoPresent: true, bannedWords: [] } },
  }
}

function failCompliance(product = "c"): Creative {
  return {
    ...ok(product),
    compliance: { badge: "FAIL", checks: { logoPresent: false, bannedWords: ["bad"] } },
  }
}

function hardFail(product = "d"): Creative {
  return { product, market: "us-en", ratio: "1x1", source: "genai", path: null }
}

function mkManifest(creatives: Creative[]): Manifest {
  return {
    campaign: "test",
    brand: "brisa",
    outputDir: "outputs/test",
    counts: {
      requested: creatives.length,
      succeeded: creatives.filter((c) => c.path !== null).length,
      failed: creatives.filter((c) => c.path === null).length,
      generated: 0,
      reused: 0,
    },
    creatives,
    errors: creatives
      .filter((c) => c.path === null)
      .map((c) => ({ product: c.product, market: c.market, ratio: c.ratio, stage: "compose" as const, message: "stub" })),
  }
}

describe("displayStatusOf", () => {
  it("classifies hard failures as FAIL", () => {
    expect(displayStatusOf(hardFail())).toBe("FAIL")
  })

  it("passes through compliance badges", () => {
    expect(displayStatusOf(ok())).toBe("OK")
    expect(displayStatusOf(warn())).toBe("WARN")
    expect(displayStatusOf(failCompliance())).toBe("FAIL")
  })

  it("defaults missing compliance to OK", () => {
    const noBadge: Creative = { product: "a", market: "us-en", ratio: "1x1", source: "local", path: "x.png" }
    expect(displayStatusOf(noBadge)).toBe("OK")
  })

  it("stubbed creatives are still FAIL (placeholder tile)", () => {
    const stub: Creative = { product: "a", market: "us-en", ratio: "1x1", source: "genai", path: null, stubbed: true }
    expect(displayStatusOf(stub)).toBe("FAIL")
  })
})

describe("STATUS_FILTER_OPTIONS", () => {
  it("is the canonical options list", () => {
    expect(STATUS_FILTER_OPTIONS).toEqual(["ALL", "OK", "WARN", "FAIL"])
  })
})

describe("cross-scheme invariant (filter ↔ tile ↔ counts)", () => {
  it("a hard-failed creative reports FAIL through filter and counts simultaneously", () => {
    const creatives = [ok("a"), warn("b"), failCompliance("c"), hardFail("d")]
    const m = mkManifest(creatives)
    const counts = deriveCounts(m)

    // counts agree
    expect(counts).toMatchObject({ ok: 1, warn: 1, fail: 2, flagged: 3 })

    // filter agrees — FAIL filter matches exactly the two FAIL creatives
    const failFiltered = creatives.filter((c) =>
      creativeMatchesFilters(c, { status: "FAIL", ratio: "ALL", market: "ALL" }),
    )
    expect(failFiltered.map((c) => c.product).sort()).toEqual(["c", "d"])

    // WARN filter matches exactly the WARN creative
    const warnFiltered = creatives.filter((c) =>
      creativeMatchesFilters(c, { status: "WARN", ratio: "ALL", market: "ALL" }),
    )
    expect(warnFiltered.map((c) => c.product)).toEqual(["b"])
  })

  it("displayStatusOf and deriveCounts agree on every creative", () => {
    const creatives = [ok("a"), warn("b"), failCompliance("c"), hardFail("d")]
    const m = mkManifest(creatives)
    const counts = deriveCounts(m)
    const byStatus = { OK: 0, WARN: 0, FAIL: 0 } as Record<string, number>
    for (const c of creatives) byStatus[displayStatusOf(c)] += 1
    expect(byStatus.OK).toBe(counts.ok)
    expect(byStatus.WARN).toBe(counts.warn)
    expect(byStatus.FAIL).toBe(counts.fail)
  })
})