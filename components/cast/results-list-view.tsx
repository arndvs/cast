"use client"

import * as React from "react"
import { Check, ImageIcon, MoreHorizontal } from "lucide-react"

import { ComplianceBadgePill } from "@/components/cast/compliance-badge-pill"
import { buildCreativeProxyUrl } from "@/lib/cast/creative-proxy-url"
import { regionOf } from "@/lib/cast/markets"
import type { Creative } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface ResultsListViewProps {
  creatives: Creative[]
  campaign: string
  logoVariant: string
  selected: Set<string>
  onToggleSelect: (key: string) => void
  onSelectAll: () => void
  isAllSelected: boolean
  onOpenDetail: (creative: Creative) => void
}

function creativeKey(c: Creative): string {
  return `${c.product}/${c.market}/${c.ratio}`
}

export function ResultsListView({
  creatives,
  campaign,
  logoVariant,
  selected,
  onToggleSelect,
  onSelectAll,
  isAllSelected,
  onOpenDetail,
}: ResultsListViewProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-10 p-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={isAllSelected}
                onClick={onSelectAll}
                aria-label={isAllSelected ? "Deselect all" : "Select all"}
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                  isAllSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}
              >
                {isAllSelected && <Check className="h-2.5 w-2.5" />}
              </button>
            </th>
            <th className="p-3 text-left font-medium text-muted-foreground">Preview</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Product</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Market</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Ratio</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Source</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Logo</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="p-3 text-left font-medium text-muted-foreground">Time</th>
            <th className="w-10 p-3" />
          </tr>
        </thead>
        <tbody>
          {creatives.map((creative) => {
            const key = creativeKey(creative)
            const isSelected = selected.has(key)
            const failed = creative.path === null && !creative.stubbed
            const stubbed = creative.path === null && creative.stubbed === true
            const qualityFail = creative.quality === "fail"
            const badge: "OK" | "WARN" | "FAIL" =
              failed ? "FAIL" : (creative.compliance?.badge ?? "OK")

            return (
              <tr
                key={key}
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-muted/30",
                  isSelected && "bg-primary/5",
                  stubbed && "text-muted-foreground/70",
                )}
              >
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(key)}
                    aria-label={isSelected ? `Deselect ${creative.product} ${creative.market} ${creative.ratio}` : `Select ${creative.product} ${creative.market} ${creative.ratio}`}
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" />}
                  </button>
                </td>
                <td className="p-3">
                  <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                    {!failed ? (
                      // eslint-disable-next-line @next/next/no-img-element -- proxy serves dynamic per-run PNGs
                      <img
                        src={buildCreativeProxyUrl(campaign, creative.market, creative.product, creative.ratio)}
                        alt=""
                        loading="lazy"
                        className={cn("h-full w-full object-cover", stubbed && "opacity-40")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{creative.product}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-muted font-mono text-[0.5rem] uppercase">
                      {regionOf(creative.market)}
                    </span>
                    <span>{creative.market}</span>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{creative.ratio}</td>
                <td className="p-3 text-xs text-muted-foreground">{creative.source}</td>
                <td className="p-3 text-xs text-muted-foreground">{logoVariant || "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    {stubbed && (
                      <span
                        className="rounded bg-bad/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white"
                        title="Generation failed — placeholder stub"
                      >
                        stub
                      </span>
                    )}
                    {qualityFail && (
                      <span
                        className="rounded bg-warn/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-black"
                        title="Failed the output quality gate"
                      >
                        quality
                      </span>
                    )}
                    <ComplianceBadgePill badge={badge} />
                  </div>
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {creative.duration != null ? `${creative.duration.toFixed(1)}s` : "—"}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    aria-label={`Open details for ${creative.product} ${creative.market} ${creative.ratio}`}
                    onClick={() => onOpenDetail(creative)}
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
