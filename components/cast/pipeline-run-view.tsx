"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, Pencil, RotateCcw, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { PipelineLogLine } from "@/components/cast/pipeline-log-line"
import { PipelineRunStatusBadge } from "@/components/cast/pipeline-run-status-badge"
import { Wordmark } from "@/components/cast/wordmark"
import { formatRunTime } from "@/lib/cast/format-run-time"

interface PipelineRunViewProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Set by `useRunController`; calling it aborts the in-flight fetch. */
  cancelRef: React.RefObject<(() => void) | null>
}

/**
 * Pipeline run view.
 *
 * Mounts when `state.screen === "pipeline-run"`. Renders the live NDJSON tape from
 * `state.events`, a progress bar driven by event count, and run-state-driven
 * action rows ("Cancel run" while running, "Edit brief"/"Retry" on failure,
 * "Edit brief"/"View output grid →" on completion).
 *
 * The progress estimator assumes ~6 `step` events per creative slot
 * (one per pipeline stage). It's rough, but it gives the user something to
 * watch while dall-e-3 takes its time.
 */
export function PipelineRunView({ state, dispatch, cancelRef }: PipelineRunViewProps) {
  const { brief, brandSlug, runState, events, runError, runStartedAt } = state

  const total = brief.products.length * brief.markets.length * brief.ratios.length
  const expected = Math.max(1, total * 6)
  const rawPct = (events.length / expected) * 100
  const pct = runState === "complete" ? 100 : Math.min(99, rawPct)

  // Back-scan without copying the events array — cheap on every render even
  // when the log grows into the hundreds.
  const lastStep = React.useMemo(() => {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const ev = events[i]
      if (ev.type === "step") return ev
    }
    return undefined
  }, [events])
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
          <Wordmark className="text-lg" generating={runState === "running"} />
          <span className="text-fg-3">·</span>
          <span className="text-sm text-fg-2">{brandSlug}</span>
          <span className="text-fg-3">/</span>
          <span className="font-mono text-sm text-fg-1">{brief.campaign}</span>
          <PipelineRunStatusBadge runState={runState} />
          <div className="grow" />
          <span className="font-mono text-xs text-fg-3">
            started {formatRunTime(runStartedAt)}
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
            events.map((ev, i) => <PipelineLogLine key={i} event={ev} />)
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
