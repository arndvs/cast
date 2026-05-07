"use client"

import * as React from "react"
import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { SLUG_RE } from "@/lib/cast/schemas"

interface BriefSummaryStripProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /**
   * `false` when the brand fixture failed to load. Forces Generate disabled
   * regardless of axis counts — the run can't succeed without the brand
   * profile, so we surface the gate up-front rather than waiting for the
   * 400 from /api/generate.
   */
  brandLoadable?: boolean
  /**
   * Precomputed banned-list hits across audience + every locale message,
   * supplied by the shell. The shell builds its list from
   * `BrandProfile.bannedWords` (default floor ∪ brand fixture, dedup +
   * lowercased on the server in `loadBrandProfile`) so this gate uses the
   * same list `/api/generate`'s compliance pass uses (D29). When non-empty,
   * Generate is disabled — failing closed at S1 prevents the "generation
   * succeeded, compliance FAILED, demo wasted" loop where the operator
   * only learns the brief was non-compliant after the API spend has
   * already happened.
   */
  bannedHits?: readonly string[]
}

/**
 * Sticky bottom strip — running total + Generate CTA.
 *
 * Total = products × markets × ratios. Generate is disabled when:
 * - any axis is empty (total === 0), or
 * - the campaign slug is invalid, or
 * - the brand fixture failed to load (`brandLoadable === false`), or
 * - the brief contains a banned-list term (`bannedHits.length > 0`), or
 * - the run is already in flight.
 *
 * The full schema validation runs server-side in V4 — this strip just
 * surfaces the cheap, deterministic gates.
 */
export function BriefSummaryStrip({
  state,
  dispatch,
  brandLoadable = true,
  bannedHits = [],
}: BriefSummaryStripProps) {
  const { brief, runState } = state
  const total = brief.products.length * brief.markets.length * brief.ratios.length
  const slugInvalid = !SLUG_RE.test(brief.campaign || "")
  const hasBanned = bannedHits.length > 0
  const disabled =
    runState !== "editing" ||
    total === 0 ||
    slugInvalid ||
    !brandLoadable ||
    hasBanned

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <p className="font-mono text-xs text-fg-3">
        <strong className="font-sans text-fg-1">{brief.products.length}</strong> products
        · <strong className="font-sans text-fg-1">{brief.markets.length}</strong> markets
        · <strong className="font-sans text-fg-1">{brief.ratios.length}</strong> ratios
        ={" "}
        <strong className="font-sans text-fg-1">{total}</strong> creatives
        {slugInvalid && <span className="ml-2 text-bad">· fix slug to enable</span>}
        {!brandLoadable && (
          <span className="ml-2 text-bad">· brand fixture missing</span>
        )}
        {hasBanned && (
          <span className="ml-2 text-bad">
            · remove banned word{bannedHits.length > 1 ? "s" : ""} to enable
          </span>
        )}
      </p>
      <div className="grow" />
      <Button
        type="button"
        disabled={disabled}
        onClick={() => dispatch({ type: "generate" })}
        className="bg-gradient-to-r from-brand-cyan to-brand-lime text-fg-1 hover:opacity-90"
      >
        <Play className="mr-1 h-3 w-3" />
        Generate
      </Button>
    </div>
  )
}
