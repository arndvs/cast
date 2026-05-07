/**
 * Pure derivation of UI-facing counts from a run manifest.
 *
 * The manifest's `counts` block already carries the canonical accounting
 * invariants (D3) — `succeeded + failed === requested`,
 * `generated + reused === succeeded`, `flagged === WARN+FAIL on succeeded
 * only`. The S3 grid surfaces a slightly different breakdown that includes
 * the visual badge totals (`ok / warn / fail`) used by the summary cards
 * and the WARN tooltip.
 *
 * `fail` here is the *visible* failure count — both hard pipeline failures
 * (`creative.path === null`) and successful creatives that failed compliance
 * (`badge === "FAIL"`). `flagged` is the helper-local sum (`warn + fail`).
 *
 * Pure: no I/O, no React. Safe to import from server and client.
 */

import type { Manifest } from "@/lib/cast/schemas"

export interface DerivedCounts {
  /** Mirror of `manifest.counts.requested`. */
  requested: number
  /** Mirror of `manifest.counts.succeeded`. */
  succeeded: number
  /** Mirror of `manifest.counts.reused`. */
  reused: number
  /** Mirror of `manifest.counts.generated`. */
  generated: number
  /** Creatives with `compliance.badge === "OK"`. */
  ok: number
  /** Creatives with `compliance.badge === "WARN"`. */
  warn: number
  /** `path === null` (hard fail) OR `compliance.badge === "FAIL"`. */
  fail: number
  /**
   * UI-local total of `warn + fail`. Surfaced in S3 summary cards and
   * WARN tooltip as the operator-visible flagged count. This may differ
   * from `manifest.counts.flagged`, which counts WARN+FAIL on succeeded
   * creatives only (D3) and excludes hard pipeline failures. Use
   * `manifest.counts.flagged` directly when the D3 invariant matters.
   */
  flagged: number
}

export function deriveCounts(manifest: Manifest): DerivedCounts {
  let ok = 0
  let warn = 0
  let fail = 0

  for (const c of manifest.creatives) {
    if (c.path === null) {
      fail += 1
      continue
    }
    // Succeeded creatives default to OK when compliance is omitted — mirrors
    // the UI fallback in `CreativeTile` and the S3 status filter (`?? "OK"`)
    // so `ok + warn + fail` always equals `manifest.counts.requested`.
    const badge = c.compliance?.badge ?? "OK"
    if (badge === "FAIL") fail += 1
    else if (badge === "WARN") warn += 1
    else ok += 1
  }

  return {
    requested: manifest.counts.requested,
    succeeded: manifest.counts.succeeded,
    reused: manifest.counts.reused,
    generated: manifest.counts.generated,
    ok,
    warn,
    fail,
    flagged: warn + fail,
  }
}
