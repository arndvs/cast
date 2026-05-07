"use client"

import * as React from "react"
import { Check, Download, Grid3X3, List, RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreativeFilterSelect } from "@/components/cast/creative-filter-select"
import type { StatusFilter, RatioFilter, MarketCodeFilter } from "@/lib/cast/filter-creatives"
import type { AspectRatio } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

interface ResultsToolbarProps {
  query: string
  onQueryChange: (q: string) => void
  status: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  ratio: RatioFilter
  onRatioChange: (r: RatioFilter) => void
  market: MarketCodeFilter
  onMarketChange: (m: MarketCodeFilter) => void
  ratioOptions: readonly AspectRatio[]
  marketOptions: readonly string[]
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  filteredCount: number
  totalCount: number
  selectedCount: number
  onSelectAll: () => void
  isAllSelected: boolean
}

export function ResultsToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  ratio,
  onRatioChange,
  market,
  onMarketChange,
  ratioOptions,
  marketOptions,
  viewMode,
  onViewModeChange,
  filteredCount,
  totalCount,
  selectedCount,
  onSelectAll,
  isAllSelected,
}: ResultsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Select all checkbox */}
        <button
          type="button"
          onClick={onSelectAll}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border transition-colors",
            isAllSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:border-primary",
          )}
          aria-label={isAllSelected ? "Deselect all" : "Select all"}
        >
          {isAllSelected && <Check className="h-3 w-3" />}
        </button>

        {/* Search */}
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search creatives..."
            aria-label="Search creatives"
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <CreativeFilterSelect
          label="status"
          value={status}
          onChange={(v) => onStatusChange(v as StatusFilter)}
          options={["ALL", "OK", "WARN", "FAIL"]}
        />
        <CreativeFilterSelect
          label="ratio"
          value={ratio}
          onChange={(v) => onRatioChange(v as RatioFilter)}
          options={["ALL", ...ratioOptions]}
        />
        <CreativeFilterSelect
          label="market"
          value={market}
          onChange={(v) => onMarketChange(v as MarketCodeFilter)}
          options={["ALL", ...marketOptions]}
        />

        <div className="grow" />

        {/* Tile count */}
        <span className="font-mono text-xs text-muted-foreground">
          {filteredCount} / {totalCount} creatives
        </span>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50",
            )}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "list" ? "bg-muted" : "hover:bg-muted/50",
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Batch actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" disabled title="Coming soon">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled title="Coming soon">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Failed
          </Button>
        </div>
      )}
    </div>
  )
}
