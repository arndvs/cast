"use client"

import { Check, Clock, Loader2, X } from "lucide-react"
import type { CreativeSlotInfo, SlotStatus } from "@/lib/cast/derive-creative-statuses"
import { cn } from "@/lib/utils"

interface JobCreativeBadgeProps {
  slot: CreativeSlotInfo
}

const statusStyles: Record<SlotStatus, string> = {
  complete: "bg-ok/10 text-ok border-ok/20",
  generating: "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20",
  failed: "bg-bad/10 text-bad border-bad/20",
  queued: "bg-muted text-fg-3 border-border",
}

function StatusIcon({ status }: { status: SlotStatus }) {
  switch (status) {
    case "complete":
      return <Check className="h-3 w-3" />
    case "generating":
      return <Loader2 className="h-3 w-3 animate-spin" />
    case "failed":
      return <X className="h-3 w-3" />
    case "queued":
      return <Clock className="h-3 w-3" />
  }
}

/**
 * Per-creative status pill — shows market · ratio · duration with a
 * colour-coded border matching the slot's current status.
 */
export function JobCreativeBadge({ slot }: JobCreativeBadgeProps) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", statusStyles[slot.status])}>
      <StatusIcon status={slot.status} />
      <span className="font-mono">{slot.market}</span>
      <span className="text-fg-3/60">·</span>
      <span>{slot.ratio.replace("x", ":")}</span>
      {slot.duration !== null && (
        <>
          <span className="text-fg-3/60">·</span>
          <span className="text-fg-3">{slot.duration.toFixed(1)}s</span>
        </>
      )}
    </div>
  )
}
