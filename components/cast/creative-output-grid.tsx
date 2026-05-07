"use client"

import * as React from "react"
import { Download, FolderOpen, Pencil } from "lucide-react"
import { toast } from "sonner"

import { revealOutputFolder } from "@/app/actions/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CreativeCountsSummaryCard } from "@/components/cast/creative-counts-summary-card"
import { CreativeFilterSelect } from "@/components/cast/creative-filter-select"
import { CreativeTile } from "@/components/cast/creative-tile"
import { Wordmark } from "@/components/cast/wordmark"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { downloadJson } from "@/lib/cast/download-json"
import { type StatusFilter, type RatioFilter, type MarketCodeFilter, creativeMatchesFilters } from "@/lib/cast/filter-creatives"
import { groupCreativesByMarket } from "@/lib/cast/group-creatives-by-market"
import { deriveCounts } from "@/lib/cast/manifest-counts"
import type { Manifest } from "@/lib/cast/schemas"

interface CreativeOutputGridProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
}

/**
 * Output grid.
 *
 * Mounts when `state.screen === "output-grid"`. Reads `state.manifest` (the run
 * manifest === report.json === the `complete` event payload) and renders:
 *
 *   - a header with brand/campaign crumbs + brief.json/report.json downloads
 *     and a stub "Reveal in folder" button (wires the revealOutputFolder server action),
 *   - six summary cards (requested / succeeded / reused / generated / WARN /
 *     FAIL) with a tooltip on WARN explaining the flagged invariant,
 *   - a filter bar (status / ratio / market) backed by three local
 *     `useState`s,
 *   - a market-grouped grid of `<CreativeTile>` thumbnails.
 *
 * The dialog itself mounts via `CreativeDetailDialog` — clicking a tile dispatches `open-detail`,
 * which the reducer stores.
 */
export function CreativeOutputGrid({ state, dispatch }: CreativeOutputGridProps) {
  const { manifest } = state

  // Defensive: the shell only mounts this view when `screen === "output-grid"`, which the
  // reducer only transitions to from the terminal `complete` event (which
  // sets `manifest`). This guard keeps the component honest if those
  // invariants ever drift.
  if (!manifest) {
    return (
      <Card className="p-6 text-sm text-fg-3">
        Manifest not available — return to the run view.
      </Card>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <CreativeOutputGridContent state={state} dispatch={dispatch} manifest={manifest} />
    </TooltipProvider>
  )
}

function CreativeOutputGridContent({
  state,
  dispatch,
  manifest,
}: CreativeOutputGridProps & { manifest: Manifest }) {
  const { brief, brandSlug } = state
  const counts = React.useMemo(() => deriveCounts(manifest), [manifest])

  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [ratio, setRatio] = React.useState<RatioFilter>("ALL")
  const [market, setMarket] = React.useState<MarketCodeFilter>("ALL")

  const filtered = React.useMemo(
    () => manifest.creatives.filter((creative) => creativeMatchesFilters(creative, { status, ratio, market })),
    [manifest.creatives, status, ratio, market],
  )

  const grouped = React.useMemo(() => groupCreativesByMarket(filtered), [filtered])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Wordmark className="text-lg" />
          <span className="text-fg-3">·</span>
          <span className="text-sm text-fg-2">{brandSlug}</span>
          <span className="text-fg-3">/</span>
          <span className="font-mono text-sm text-fg-1">{brief.campaign}</span>
          <Badge variant="secondary" className="bg-ok/15 text-ok">
            ✓ run complete
          </Badge>
          <div className="grow" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: "goto-edit" })}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit brief
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadJson(`${brief.campaign}-brief.json`, brief)}
          >
            <Download className="mr-1 h-3 w-3" />
            brief.json
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadJson(`${brief.campaign}-report.json`, manifest)}
          >
            <Download className="mr-1 h-3 w-3" />
            report.json
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await revealOutputFolder({ campaign: brief.campaign })
                if (res.ok) {
                  toast.success("Folder revealed")
                } else {
                  toast.error(res.error)
                }
              } catch (err) {
                // The server action's contract is to never throw, but a
                // network or runtime failure on the action transport itself
                // would surface here — surface it instead of swallowing.
                toast.error(err instanceof Error ? err.message : "Failed to reveal folder")
              }
            }}
          >
            <FolderOpen className="mr-1 h-3 w-3" />
            Reveal in folder
          </Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <CreativeCountsSummaryCard label="requested" value={counts.requested} />
        <CreativeCountsSummaryCard label="succeeded" value={counts.succeeded} tone="ok" />
        <CreativeCountsSummaryCard label="reused" value={counts.reused} />
        <CreativeCountsSummaryCard label="generated" value={counts.generated} />
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CreativeCountsSummaryCard label="WARN" value={counts.warn} tone="warn" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            WARN + FAIL on succeeded = {manifest.counts.flagged} flagged
          </TooltipContent>
        </Tooltip>
        <CreativeCountsSummaryCard label="FAIL" value={counts.fail} tone="bad" />
      </div>

      {/* Filter bar */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-xs uppercase tracking-wider text-fg-3">filter</span>
        <CreativeFilterSelect
          label="status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={["ALL", "OK", "WARN", "FAIL"]}
        />
        <CreativeFilterSelect
          label="ratio"
          value={ratio}
          onChange={(v) => setRatio(v as RatioFilter)}
          options={["ALL", ...brief.ratios]}
        />
        <CreativeFilterSelect
          label="market"
          value={market}
          onChange={(v) => setMarket(v as MarketCodeFilter)}
          options={["ALL", ...brief.markets]}
        />
        <span className="grow" />
        <span className="font-mono text-xs text-fg-3">
          {filtered.length} / {manifest.creatives.length} tiles
        </span>
      </Card>

      {/* Grid */}
      {grouped.length === 0 ? (
        <Card className="p-6 text-center text-sm text-fg-3">
          No creatives match the current filters.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([marketCode, tiles]) => (
            <section key={marketCode} className="flex flex-col gap-2">
              <h2 className="font-mono text-xs uppercase tracking-wider text-fg-3">
                {marketCode}{" "}
                <span className="text-fg-4">· {tiles.length} creatives</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {tiles.map((creative) => (
                  <CreativeTile
                    key={`${creative.product}/${creative.market}/${creative.ratio}`}
                    creative={creative}
                    campaign={brief.campaign}
                    onClick={() => dispatch({ type: "open-detail", creative })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Reveal-strip footer */}
      <div className="border-t border-border pt-3">
        <p className="font-mono text-[11px] text-fg-3">
          outputs/{brief.campaign}/[market]/[product]/[ratio].png
        </p>
      </div>
    </div>
  )
}
