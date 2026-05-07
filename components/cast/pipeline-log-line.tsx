import type { PipelineEvent } from "@/lib/cast/events"
import { eventLabel, eventDetail } from "@/lib/cast/format-pipeline-event"
import { cn } from "@/lib/utils"

interface PipelineLogLineProps {
  event: PipelineEvent
}

export function PipelineLogLine({ event }: PipelineLogLineProps) {
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
