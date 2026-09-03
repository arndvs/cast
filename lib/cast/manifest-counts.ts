/**
 * Pure derivation of UI-facing counts from a run manifest — the single source
 * of truth for `fail` / `flagged` run accounting.
 *
 * The manifest's `counts` block carries the canonical structural invariants —
 * `succeeded + failed === requested`, `generated + reused === succeeded`.
 * This helper derives the visual badge totals (`ok / warn / fail`) and the
 * operator-visible `flagged` (`warn + fail` over ALL creatives, including
 * hard `path === null` failures) that the summary cards, WARN tooltip, and
 * streamed `complete` log line share. The manifest no longer carries a
 * divergent `counts.flagged` — this is the one definition.
 *
 * `fail` is both hard pipeline failures (`creative.path === null`) and
 * successful creatives that failed compliance (`badge === "FAIL"`).
 *
 * Pure: no I/O, no React. Safe to import from server and client.
 */

import type { Manifest } from "@/lib/cast/schemas"
import { displayStatusOf } from "@/lib/cast/creative-display-status"

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
   * Operator-visible flagged total — `warn + fail` over ALL creatives
   * (including hard failures). Surfaced in summary cards, the WARN tooltip,
   * and the streamed `complete` log line.
   */
  flagged: number
  /** Mean duration (seconds) across succeeded creatives with `duration` set. `null` when none have timing. */
  averageDuration: number | null
  /** S2: succeeded creatives that tripped the output quality gate (quality === "fail"). */
  qualityFlagged: number
}

export function deriveCounts(manifest: Manifest): DerivedCounts {
  let ok = 0
  let warn = 0
  let fail = 0
  let durationSum = 0
  let durationCount = 0
  let qualityFlagged = 0

  for (const c of manifest.creatives) {
    // Single display-status classification — includes hard failures
    // (path === null) as FAIL and defaults missing compliance to OK, so
    // ok + warn + fail always equals manifest.counts.requested.
    const badge = displayStatusOf(c)
    if (badge === "FAIL") fail += 1
    else if (badge === "WARN") warn += 1
    else ok += 1

    if (c.quality === "fail") qualityFlagged += 1

    // averageDuration only over succeeded creatives (hard failures excluded).
    if (c.path !== null && c.duration != null) {
      durationSum += c.duration
      durationCount += 1
    }
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
    averageDuration: durationCount > 0 ? durationSum / durationCount : null,
    qualityFlagged,
  }
}
