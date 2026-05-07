"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CreativeCountsSummaryCard } from "@/components/cast/creative-counts-summary-card"
import { CreativeTile } from "@/components/cast/creative-tile"
import { ResultsHeader } from "@/components/cast/results-header"
import { ResultsToolbar, type ViewMode } from "@/components/cast/results-toolbar"
import { ResultsListView } from "@/components/cast/results-list-view"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { type StatusFilter, type RatioFilter, type MarketCodeFilter, creativeMatchesFilters } from "@/lib/cast/filter-creatives"
import { groupCreativesByMarket } from "@/lib/cast/group-creatives-by-market"
import { deriveCounts } from "@/lib/cast/manifest-counts"
import type { Creative, Manifest } from "@/lib/cast/schemas"

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

function creativeKey(c: Creative): string {
  return `${c.product}/${c.market}/${c.ratio}`
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
  const [query, setQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const filtered = React.useMemo(
    () => manifest.creatives.filter((creative) => creativeMatchesFilters(creative, { status, ratio, market, query })),
    [manifest.creatives, status, ratio, market, query],
  )

  const grouped = React.useMemo(() => groupCreativesByMarket(filtered), [filtered])

  const filteredKeys = React.useMemo(() => new Set(filtered.map(creativeKey)), [filtered])
  const isAllSelected = filteredKeys.size > 0 && filteredKeys.size === selected.size && [...filteredKeys].every((k) => selected.has(k))

  const toggleSelect = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSelectAll = React.useCallback(() => {
    if (isAllSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredKeys))
    }
  }, [isAllSelected, filteredKeys])

  return (
    <div className="flex flex-col gap-0">
      {/* Sticky header */}
      <ResultsHeader
        brandSlug={brandSlug}
        brief={brief}
        manifest={manifest}
        failCount={counts.fail}
        successCount={counts.succeeded}
        totalCount={counts.requested}
        dispatch={dispatch}
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CreativeCountsSummaryCard label="Total" value={counts.requested} />
            <CreativeCountsSummaryCard label="Complete" value={counts.succeeded} tone="ok" />
            <CreativeCountsSummaryCard label="Failed" value={counts.fail} tone={counts.fail > 0 ? "bad" : undefined} />
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CreativeCountsSummaryCard
                    label="Avg Time"
                    value={counts.averageDuration != null ? `${counts.averageDuration.toFixed(1)}s` : "—"}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Reused: {counts.reused} · Generated: {counts.generated} · Flagged: {counts.flagged}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Toolbar: search + filters + view toggle + batch actions */}
          <ResultsToolbar
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            ratio={ratio}
            onRatioChange={setRatio}
            market={market}
            onMarketChange={setMarket}
            ratioOptions={brief.ratios}
            marketOptions={brief.markets}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filteredCount={filtered.length}
            totalCount={manifest.creatives.length}
            selectedCount={selected.size}
            onSelectAll={toggleSelectAll}
            isAllSelected={isAllSelected}
          />

          {/* View content */}
          {viewMode === "list" ? (
            <ResultsListView
              creatives={filtered}
              campaign={brief.campaign}
              logoVariant={state.logoVariant}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectAll={toggleSelectAll}
              isAllSelected={isAllSelected}
              onOpenDetail={(creative) => dispatch({ type: "open-detail", creative })}
            />
          ) : grouped.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No creatives match the current filters.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map(([marketCode, tiles]) => (
                <section key={marketCode} className="flex flex-col gap-2">
                  <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {marketCode}{" "}
                    <span className="text-muted-foreground/60">· {tiles.length} creatives</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {tiles.map((creative) => {
                      const key = creativeKey(creative)
                      return (
                        <CreativeTile
                          key={key}
                          creative={creative}
                          campaign={brief.campaign}
                          selected={selected.has(key)}
                          onSelect={() => toggleSelect(key)}
                          onClick={() => dispatch({ type: "open-detail", creative })}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-3">
            <p className="font-mono text-[11px] text-muted-foreground">
              outputs/{brief.campaign}/[market]/[product]/[ratio].png
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
