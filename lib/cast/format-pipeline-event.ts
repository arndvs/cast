import type { PipelineEvent } from "@/lib/cast/events"
import { deriveCounts } from "@/lib/cast/manifest-counts"

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
    case "compliance_failed":
      return "blocked"
    case "quality_result":
      return event.badge
    case "creative_stub":
      return "stub"
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
    case "compliance_failed": {
      const banned = event.bannedWords.length
        ? ` · banned=[${event.bannedWords.join(",")}]`
        : ""
      return `${slotLabel(event.slot)}${banned} · pre-spend gate`
    }
    case "quality_result": {
      const failDetail = event.failures.length ? ` · ${event.failures.join("; ")}` : ""
      const retryNote = event.retried ? " · retried" : ""
      return `${slotLabel(event.slot)}${failDetail}${retryNote}`
    }
    case "creative_stub":
      return `${slotLabel(event.slot)} · stub: ${event.message}`
    case "error":
      return `${event.slot ? slotLabel(event.slot) + " · " : ""}${event.message}`
    case "complete": {
      // Derive the operator-visible flagged count (warn + fail over ALL
      // creatives, including hard failures) through the shared derivation —
      // the manifest no longer carries a divergent `counts.flagged`.
      const { succeeded, requested, flagged } = deriveCounts(event.manifest)
      const failed = event.manifest.counts.failed
      return `${succeeded}/${requested} succeeded · ${failed} failed · ${flagged} flagged`
    }
  }
}

export function slotLabel(slot: {
  product: string
  market: string
  ratio: string
}): string {
  return `${slot.product}/${slot.market}/${slot.ratio}`
}
