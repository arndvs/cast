"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, Pencil, RotateCcw, Square } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { S1Action, S1State } from "@/components/cast/s1-state"
import { Wordmark } from "@/components/cast/wordmark"
import type { PipelineEvent } from "@/lib/cast/events"
import { cn } from "@/lib/utils"

interface S2RunViewProps {
  state: S1State
  dispatch: React.Dispatch<S1Action>
  /** Set by `useRunController`; calling it aborts the in-flight fetch. */
  cancelRef: React.RefObject<(() => void) | null>
}

/**
 * S2 — pipeline run view.
 *
 * Mounts when `state.screen === "S2"`. Renders the live NDJSON tape from
 * `state.events`, a progress bar driven by event count, and run-state-driven
 * action rows ("Cancel run" while running, "Edit brief"/"Retry" on failure,
 * "Edit brief"/"View output grid →" on completion).
 *
 * The progress estimator assumes ~6 `step` events per creative slot
 * (one per pipeline stage). It's rough, but it gives the user something to
 * watch while dall-e-3 takes its time.
 */
export function S2RunView({ state, dispatch, cancelRef }: S2RunViewProps) {
  const { brief, brandSlug, runState, events, runError } = state

  // Snapshot the wall-clock the first time S2 mounts for this run.
  const [startedAt] = React.useState(() => new Date())

  const total = brief.products.length * brief.markets.length * brief.ratios.length
  const expected = Math.max(1, total * 6)
  const rawPct = (events.length / expected) * 100
  const pct = runState === "complete" ? 100 : Math.min(99, rawPct)

  const lastStep = [...events].reverse().find((e) => e.type === "step")
  const currentStage =
    runState === "complete" ? "complete" : lastStep?.stage ?? "…"

  // Auto-scroll the log to the bottom as new events arrive.
  const logRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length])

  return (
    <div className="flex flex-col gap-4">
      {/* Status header */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Wordmark className="text-lg" />
          <span className="text-fg-3">·</span>
          <span className="text-sm text-fg-2">{brandSlug}</span>
          <span className="text-fg-3">/</span>
          <span className="font-mono text-sm text-fg-1">{brief.campaign}</span>
          <RunStateBadge runState={runState} />
          <div className="grow" />
          <span className="font-mono text-xs text-fg-3">
            started {formatTime(startedAt)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="w-40 shrink-0 text-right font-mono text-xs text-fg-3">
            {Math.round(pct)}% · stage{" "}
            <strong className="font-sans text-fg-1">{currentStage}</strong>
          </span>
        </div>
      </Card>

      {/* Fail banner */}
      {runState === "failed" && runError && (
        <Card className="flex flex-col gap-3 border-bad/40 bg-bad/5 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-bad" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-fg-1">Run failed</p>
            <p className="font-mono text-xs text-fg-3">
              stage={runError.stage} — {runError.message}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "goto-edit" })}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit brief
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => dispatch({ type: "generate" })}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Log card */}
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="text-sm font-medium text-fg-1">Pipeline log</span>
          <span className="font-mono text-xs text-fg-3">
            NDJSON streaming · {events.length} entries
          </span>
        </div>
        <div
          ref={logRef}
          className="max-h-[480px] min-h-[240px] overflow-y-auto bg-card font-mono text-xs"
        >
          {events.length === 0 ? (
            <div className="px-4 py-6 text-fg-3">waiting for first event…</div>
          ) : (
            events.map((ev, i) => <LogLine key={i} event={ev} />)
          )}
          {runState === "running" && (
            <div className="px-4 py-1 text-fg-3">
              <span className="inline-block h-3 w-2 animate-pulse bg-brand-lime" />
            </div>
          )}
        </div>
      </Card>

      {/* Bottom actions */}
      <div className="flex items-center justify-end gap-2">
        {runState === "running" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cancelRef.current?.()}
          >
            <Square className="mr-1 h-3 w-3" />
            Cancel run
          </Button>
        )}
        {runState === "complete" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "goto-edit" })}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit brief
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => dispatch({ type: "goto-grid" })}
              className="bg-gradient-to-r from-brand-cyan to-brand-lime text-fg-1 hover:opacity-90"
            >
              View output grid
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function RunStateBadge({ runState }: { runState: S1State["runState"] }) {
  if (runState === "running") {
    return (
      <Badge variant="secondary" className="bg-brand-cyan/15 text-fg-1">
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-cyan" />
        running
      </Badge>
    )
  }
  if (runState === "complete") {
    return (
      <Badge variant="secondary" className="bg-ok/15 text-ok">
        ✓ completed
      </Badge>
    )
  }
  if (runState === "failed") {
    return (
      <Badge variant="destructive">✕ failed</Badge>
    )
  }
  return <Badge variant="outline">editing</Badge>
}

function LogLine({ event }: { event: PipelineEvent }) {
  const tint =
    event.type === "step"
      ? "text-fg-2"
      : event.type === "creative_ready"
        ? "text-ok"
        : event.type === "compliance_result"
          ? "text-fg-2"
          : event.type === "asset_resolved"
            ? "text-fg-3"
            : event.type === "error"
              ? "text-bad"
              : event.type === "complete"
                ? "text-ok font-semibold"
                : "text-fg-2"

  return (
    <div className={cn("flex gap-3 border-b border-border/40 px-4 py-1", tint)}>
      <span className="w-20 shrink-0 text-fg-3">{eventLabel(event)}</span>
      <span className="flex-1 truncate">{eventDetail(event)}</span>
    </div>
  )
}

function eventLabel(event: PipelineEvent): string {
  switch (event.type) {
    case "step":
      return event.stage
    case "asset_resolved":
      return "asset"
    case "creative_ready":
      return "ready"
    case "compliance_result":
      return event.badge
    case "error":
      return `err:${event.stage}`
    case "complete":
      return "complete"
  }
}

function eventDetail(event: PipelineEvent): string {
  switch (event.type) {
    case "step":
      return `${slotLabel(event.slot)}${event.message ? " — " + event.message : ""}`
    case "asset_resolved":
      return `${event.product} · ${event.source}${event.file ? " · " + event.file : ""}`
    case "creative_ready":
      return `${slotLabel(event.slot)} · ${event.path}`
    case "compliance_result": {
      const banned = event.bannedWords.length
        ? ` · banned=[${event.bannedWords.join(",")}]`
        : ""
      return `${slotLabel(event.slot)}${banned}`
    }
    case "error":
      return `${event.slot ? slotLabel(event.slot) + " · " : ""}${event.message}`
    case "complete":
      return `${event.manifest.counts.succeeded}/${event.manifest.counts.requested} succeeded · ${event.manifest.counts.failed} failed · ${event.manifest.counts.flagged} flagged`
  }
}

function slotLabel(slot: { product: string; market: string; ratio: string }): string {
  return `${slot.product}/${slot.market}/${slot.ratio}`
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour12: false })
}
