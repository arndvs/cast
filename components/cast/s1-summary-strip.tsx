"use client"

import * as React from "react"
import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { S1Action, S1State } from "@/components/cast/s1-state"
import { SLUG_RE } from "@/lib/cast/schemas"

interface S1SummaryStripProps {
  state: S1State
  dispatch: React.Dispatch<S1Action>
  /**
   * `false` when the brand fixture failed to load. Forces Generate disabled
   * regardless of axis counts — the run can't succeed without the brand
   * profile, so we surface the gate up-front rather than waiting for the
   * 400 from /api/generate.
   */
  brandLoadable?: boolean
}

/**
 * Sticky bottom strip — running total + Generate CTA.
 *
 * Total = products × markets × ratios. Generate is disabled when:
 * - any axis is empty (total === 0), or
 * - the campaign slug is invalid, or
 * - the brand fixture failed to load (`brandLoadable === false`), or
 * - the run is already in flight.
 *
 * The full schema validation runs server-side in V4 — this strip just
 * surfaces the cheap, deterministic gates.
 */
export function S1SummaryStrip({
  state,
  dispatch,
  brandLoadable = true,
}: S1SummaryStripProps) {
  const { brief, runState } = state
  const total = brief.products.length * brief.markets.length * brief.ratios.length
  const slugInvalid = !SLUG_RE.test(brief.campaign || "")
  const disabled =
    runState !== "editing" || total === 0 || slugInvalid || !brandLoadable

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
