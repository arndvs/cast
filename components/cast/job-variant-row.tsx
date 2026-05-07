"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { JobCreativeBadge } from "@/components/cast/job-creative-badge"
import type { ProductGroup, CreativeSlotInfo } from "@/lib/cast/derive-creative-statuses"

interface JobVariantRowProps {
  group: ProductGroup
}

/**
 * Expandable row for a single product in the Job Runner View.
 *
 * Collapsed: product name + compact per-market status indicators + count.
 * Expanded: market-grouped creative badges with status, ratio, and duration.
 */
export function JobVariantRow({ group }: JobVariantRowProps) {
  const [expanded, setExpanded] = useState(false)

  const completedCount = group.slots.filter((s) => s.status === "complete").length
  const failedCount = group.slots.filter((s) => s.status === "failed").length
  const allTerminal = completedCount + failedCount === group.slots.length
  const allComplete = completedCount === group.slots.length

  // Group slots by market for the expanded view.
  const byMarket = new Map<string, CreativeSlotInfo[]>()
  for (const slot of group.slots) {
    const list = byMarket.get(slot.market) ?? []
    list.push(slot)
    byMarket.set(slot.market, list)
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-fg-3" />
        ) : (
          <ChevronRight className="h-4 w-4 text-fg-3" />
        )}

        <span className="font-mono text-sm text-fg-1">{group.product}</span>

        <div className="ml-auto flex items-center gap-3">
          {/* Compact per-market indicators when collapsed */}
          {!expanded && (
            <div className="flex gap-1">
              {[...byMarket.entries()].map(([market, slots]) => {
                const marketComplete = slots.every((s) => s.status === "complete")
                const marketFailed = slots.some((s) => s.status === "failed")
                return (
                  <div
                    key={market}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] ${
                      marketComplete
                        ? "bg-ok/10 text-ok"
                        : marketFailed
                          ? "bg-bad/10 text-bad"
                          : "bg-brand-cyan/10 text-brand-cyan"
                    }`}
                  >
                    {marketComplete ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    )}
                    <span className="font-mono uppercase">{market.split("-")[0]}</span>
                  </div>
                )
              })}
            </div>
          )}

          <span className="font-mono text-xs text-fg-3">
            {completedCount}/{group.slots.length}
          </span>

          {allComplete && (
            <Badge className="bg-ok/15 text-ok hover:bg-ok/20">
              <Check className="mr-1 h-3 w-3" />
              done
            </Badge>
          )}

          {failedCount > 0 && allTerminal && !allComplete && (
            <Badge variant="destructive" className="bg-bad/15 text-bad hover:bg-bad/20">
              {failedCount} failed
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="space-y-3">
            {[...byMarket.entries()].map(([market, slots]) => (
              <div key={market} className="flex items-start gap-3">
                <span className="w-12 shrink-0 font-mono text-xs uppercase text-fg-3">
                  {market.split("-")[0]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <JobCreativeBadge key={`${slot.market}/${slot.ratio}`} slot={slot} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
