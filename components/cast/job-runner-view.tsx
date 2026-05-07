"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Pencil, RotateCcw, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { JobVariantRow } from "@/components/cast/job-variant-row"
import { PipelineLogLine } from "@/components/cast/pipeline-log-line"
import { PipelineRunStatusBadge } from "@/components/cast/pipeline-run-status-badge"
import { Wordmark } from "@/components/cast/wordmark"
import { formatRunTime } from "@/lib/cast/format-run-time"
import { deriveCreativeStatuses, groupByProduct, countTerminal } from "@/lib/cast/derive-creative-statuses"

interface JobRunnerViewProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  cancelRef: React.RefObject<(() => void) | null>
}

/**
 * Job Runner View — structured replacement for `PipelineRunView`.
 *
 * Shows per-product variant rows with live creative-level status derived
 * from the NDJSON event tape. Progress bar tracks completed creatives
 * (not raw event count). A collapsible "Raw log" section preserves the
 * flat event log for debugging.
 */
export function JobRunnerView({ state, dispatch, cancelRef }: JobRunnerViewProps) {
  const { brief, brandSlug, runState, events, runError, runStartedAt } = state
  const [logOpen, setLogOpen] = React.useState(false)

  // Derive structured statuses from the live event tape.
  const statusMap = React.useMemo(() => deriveCreativeStatuses(events, brief), [events, brief])
  const productGroups = React.useMemo(() => groupByProduct(statusMap, brief), [statusMap, brief])
  const { completed, failed, total } = React.useMemo(() => countTerminal(statusMap), [statusMap])

  const pct = runState === "complete" ? 100 : total > 0 ? Math.min(99, ((completed + failed) / total) * 100) : 0

  // Auto-scroll the raw log to the bottom as new events arrive.
  const logRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!logOpen) return
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length, logOpen])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Wordmark className="text-lg" />
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

        {/* Progress bar */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="w-40 shrink-0 text-right font-mono text-xs text-fg-3">
            {completed + failed} of {total} done
          </span>
        </div>

        {/* Variant rows */}
        <div>
          {productGroups.map((group) => (
            <JobVariantRow key={group.product} group={group} />
          ))}
        </div>

        {/* Footer actions */}
        {runState === "complete" && (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
            <span className="text-sm text-fg-3">
              {failed > 0
                ? `${completed} of ${total} creatives generated · ${failed} failed`
                : `All ${total} creatives generated successfully`}
            </span>
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
                onClick={() => dispatch({ type: "goto-grid" })}
                className="bg-gradient-to-r from-brand-cyan to-brand-lime text-fg-1 hover:opacity-90"
              >
                View output grid
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
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

      {/* Running actions */}
      {runState === "running" && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cancelRef.current?.()}
          >
            <Square className="mr-1 h-3 w-3" />
            Cancel run
          </Button>
        </div>
      )}

      {/* Collapsible raw log */}
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setLogOpen(!logOpen)}
          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/50"
        >
          {logOpen ? (
            <ChevronDown className="h-4 w-4 text-fg-3" />
          ) : (
            <ChevronRight className="h-4 w-4 text-fg-3" />
          )}
          <span className="text-sm font-medium text-fg-1">Pipeline log</span>
          <span className="font-mono text-xs text-fg-3">
            {events.length} events
          </span>
        </button>
        {logOpen && (
          <div className="border-t border-border">
            <div
              ref={logRef}
              className="max-h-[360px] min-h-[120px] overflow-y-auto bg-card font-mono text-xs"
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
          </div>
        )}
      </Card>
    </div>
  )
}
