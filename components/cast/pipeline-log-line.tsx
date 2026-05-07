import type { PipelineEvent } from "@/lib/cast/events"
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
