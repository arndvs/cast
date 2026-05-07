import type { PipelineEvent } from "@/lib/cast/events"

export function eventLabel(event: PipelineEvent): string {
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

export function eventDetail(event: PipelineEvent): string {
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

export function slotLabel(slot: {
  product: string
  market: string
  ratio: string
}): string {
  return `${slot.product}/${slot.market}/${slot.ratio}`
}
