import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { type ErrorStage, PIPELINE_STAGES } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface PipelineErrorPanelProps {
  stage: ErrorStage | null
  message: string
}

export function PipelineErrorPanel({ stage, message }: PipelineErrorPanelProps) {
  const failedIndex = stage !== null ? PIPELINE_STAGES.indexOf(stage) : -1

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          pipeline stage
        </span>
        {stage && <Badge variant="destructive">{stage}</Badge>}
      </div>

      <ol className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
        {PIPELINE_STAGES.map((s, i) => {
          const isFailed = s === stage
          const isPast = failedIndex > i
          return (
            <React.Fragment key={s}>
              <li
                className={cn(
                  "rounded px-1.5 py-0.5",
                  isFailed && "bg-bad/15 text-bad",
                  !isFailed && isPast && "bg-ok/10 text-ok",
                  !isFailed && !isPast && "bg-muted text-fg-3",
                )}
              >
                {s}
              </li>
              {i < PIPELINE_STAGES.length - 1 && (
                <span className="text-fg-4" aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          )
        })}
      </ol>

      <div className="rounded-md border border-bad/40 bg-bad/5 p-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          message
        </span>
        <p className="mt-1 wrap-break-word text-sm text-fg-1">{message}</p>
      </div>
    </div>
  )
}
