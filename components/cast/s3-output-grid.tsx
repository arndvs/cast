"use client"

import * as React from "react"
import { Download, FolderOpen, Pencil } from "lucide-react"
import { toast } from "sonner"

import { revealOutputFolder } from "@/app/actions/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CreativeTile } from "@/components/cast/creative-tile"
import { Wordmark } from "@/components/cast/wordmark"
import type { S1Action, S1State } from "@/components/cast/s1-state"
import { deriveCounts } from "@/lib/cast/manifest-counts"
import { ALL_RATIOS, type AspectRatio } from "@/lib/cast/ratios"
import type { Creative, Manifest } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface S3OutputGridProps {
  state: S1State
  dispatch: React.Dispatch<S1Action>
}

type StatusFilter = "ALL" | "OK" | "WARN" | "FAIL"
type RatioFilter = "ALL" | string
type MarketFilter = "ALL" | string

/**
 * S3 — output grid.
 *
 * Mounts when `state.screen === "S3"`. Reads `state.manifest` (the run
 * manifest === report.json === the `complete` event payload) and renders:
 *
 *   - a header with brand/campaign crumbs + brief.json/report.json downloads
 *     and a stub "Reveal in folder" button (V5e wires the server action),
 *   - six summary cards (requested / succeeded / reused / generated / WARN /
 *     FAIL) with a tooltip on WARN explaining the D3 flagged invariant,
 *   - a filter bar (status / ratio / market) backed by three local
 *     `useState`s,
 *   - a market-grouped grid of `<CreativeTile>` thumbnails.
 *
 * The dialog itself (S4) is V5e — clicking a tile dispatches `open-detail`,
 * which the reducer stores. V5d ships the dispatch wired up but doesn't
 * mount the dialog.
 */
export function S3OutputGrid({ state, dispatch }: S3OutputGridProps) {
  const { manifest } = state

  // Defensive: the shell only mounts S3 when `screen === "S3"`, which the
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
      <S3OutputGridInner state={state} dispatch={dispatch} manifest={manifest} />
    </TooltipProvider>
  )
}

function S3OutputGridInner({
  state,
  dispatch,
  manifest,
}: S3OutputGridProps & { manifest: Manifest }) {
  const { brief, brandSlug } = state
  const counts = React.useMemo(() => deriveCounts(manifest), [manifest])

  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [ratio, setRatio] = React.useState<RatioFilter>("ALL")
  const [market, setMarket] = React.useState<MarketFilter>("ALL")

  const filtered = React.useMemo(
    () => manifest.creatives.filter((c) => matches(c, { status, ratio, market })),
    [manifest.creatives, status, ratio, market],
  )

  const grouped = React.useMemo(() => groupByMarket(filtered), [filtered])

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
        <SummaryCard label="requested" value={counts.requested} />
        <SummaryCard label="succeeded" value={counts.succeeded} tone="ok" />
        <SummaryCard label="reused" value={counts.reused} />
        <SummaryCard label="generated" value={counts.generated} />
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SummaryCard label="WARN" value={counts.warn} tone="warn" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            WARN + FAIL on succeeded = {manifest.counts.flagged} flagged (D3)
          </TooltipContent>
        </Tooltip>
        <SummaryCard label="FAIL" value={counts.fail} tone="bad" />
      </div>

      {/* Filter bar */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-xs uppercase tracking-wider text-fg-3">filter</span>
        <FilterSelect
          label="status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={["ALL", "OK", "WARN", "FAIL"]}
        />
        <FilterSelect
          label="ratio"
          value={ratio}
          onChange={(v) => setRatio(v as RatioFilter)}
          options={["ALL", ...brief.ratios]}
        />
        <FilterSelect
          label="market"
          value={market}
          onChange={(v) => setMarket(v as MarketFilter)}
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
          {grouped.map(([mkt, tiles]) => (
            <section key={mkt} className="flex flex-col gap-2">
              <h2 className="font-mono text-xs uppercase tracking-wider text-fg-3">
                {mkt}{" "}
                <span className="text-fg-4">· {tiles.length} creatives</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {tiles.map((c) => (
                  <CreativeTile
                    key={`${c.product}/${c.market}/${c.ratio}`}
                    creative={c}
                    campaign={brief.campaign}
                    onClick={() => dispatch({ type: "open-detail", creative: c })}
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

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "ok" | "warn" | "bad"
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-1 p-3",
        tone === "ok" && "border-ok/30",
        tone === "warn" && "border-warn/40",
        tone === "bad" && "border-bad/40",
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
        {label}
      </span>
      <span
        className={cn(
          "font-display text-2xl",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          !tone && "text-fg-1",
        )}
      >
        {value}
      </span>
    </Card>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  options: readonly string[]
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-fg-3">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="min-w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matches(
  c: Creative,
  filters: { status: StatusFilter; ratio: RatioFilter; market: MarketFilter },
): boolean {
  if (filters.ratio !== "ALL" && c.ratio !== filters.ratio) return false
  if (filters.market !== "ALL" && c.market !== filters.market) return false
  if (filters.status !== "ALL") {
    const badge: "OK" | "WARN" | "FAIL" =
      c.path === null ? "FAIL" : (c.compliance?.badge ?? "OK")
    if (badge !== filters.status) return false
  }
  return true
}

function groupByMarket(creatives: readonly Creative[]): [string, Creative[]][] {
  const byMarket = new Map<string, Creative[]>()
  for (const c of creatives) {
    const list = byMarket.get(c.market) ?? []
    list.push(c)
    byMarket.set(c.market, list)
  }
  // Stable order — markets in first-seen order, then by product+ratio inside.
  // Ratios sort by canonical pipeline order (1x1 → 9x16 → 16x9), not
  // lexicographic, so tiles match the operator's mental model.
  const ratioOrder = new Map<AspectRatio, number>(
    ALL_RATIOS.map((r, i) => [r, i]),
  )
  return [...byMarket.entries()].map(([mkt, list]) => [
    mkt,
    [...list].sort((a, b) => {
      if (a.product !== b.product) return a.product.localeCompare(b.product)
      return (
        (ratioOrder.get(a.ratio) ?? 0) - (ratioOrder.get(b.ratio) ?? 0)
      )
    }),
  ])
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
