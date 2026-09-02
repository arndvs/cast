/**
 * Creative display-status classification — the single definition of how a
 * creative's *effective* status (`OK` / `WARN` / `FAIL`) is derived.
 *
 * Previously the `path === null ? "FAIL" : (compliance?.badge ?? "OK")`
 * ternary was re-derived at five client sites (filter, tile, list, dialog,
 * checks) plus a hand-rolled variant in manifest-counts. A change to what
 * counts as `FAIL` had to touch every site consistently.
 *
 * Client-safe: no node deps, no zod.
 */

import type { Creative } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// Display status
// ---------------------------------------------------------------------------

/** The effective post-run status shown across the grid, filter, and dialog. */
export type DisplayStatus = "OK" | "WARN" | "FAIL"

/**
 * The single place encoding the display-status rule:
 *   - `creative.path === null` (hard pipeline failure) → `FAIL`
 *   - otherwise the compliance badge, defaulting to `OK` when omitted
 *     (matches the UI fallback so `ok + warn + fail === requested`).
 *
 * Note: a stubbed creative has `path === null && stubbed === true` — it is
 * still a hard failure (placeholder tile), so it classifies as `FAIL`.
 */
export function displayStatusOf(creative: Creative): DisplayStatus {
  return creative.path === null ? "FAIL" : (creative.compliance?.badge ?? "OK")
}

/** The `StatusFilter` values — the display-status set plus "ALL". */
export const STATUS_FILTER_OPTIONS = ["ALL", "OK", "WARN", "FAIL"] as const
export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number]