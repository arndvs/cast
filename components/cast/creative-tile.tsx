"use client"

import * as React from "react"
import { Check, Download, ExternalLink } from "lucide-react"

import { ComplianceBadgePill } from "@/components/cast/compliance-badge-pill"
import { CreativeSourcePill } from "@/components/cast/creative-source-pill"
import { aspectClassForRatio } from "@/lib/cast/creative-aspect-class"
import { buildCreativeProxyUrl } from "@/lib/cast/creative-proxy-url"
import { displayStatusOf, type DisplayStatus } from "@/lib/cast/creative-display-status"
import type { Creative } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface CreativeTileProps {
  creative: Creative
  campaign: string
  onClick: () => void
  selected?: boolean
  onSelect?: () => void
}

/**
 * A single creative cell in the output grid.
 *
 * The tile is purely a view of `creative` — no fetching, no badge logic
 * beyond mapping the schema's `compliance.badge` to a colour. When
 * `creative.path === null` (hard pipeline failure) the tile renders a
 * candy-stripe placeholder and an implicit FAIL badge instead of an
 * `<img>` so the grid never shows a broken image.
 *
 * S7 stubs: a `stubbed` creative has `path: null` in the manifest BUT a
 * 1×1 placeholder PNG was written at the real slot path — we render it via
 * the proxy with a "stub" chip so the operator sees a visible placeholder
 * tile rather than a bare stripe.
 *
 * S2 quality-fail: a succeeded creative with `quality === "fail"` gets a
 * warn-tinted border + a small "quality" chip so flagged output is
 * distinguishable from clean output at a glance.
 *
 * The image URL is built from the public proxy at `/api/outputs/[...path]`
 * (which whitelists `.png` and reads from `outputs/` outside the static
 * tree). `loading="lazy"` keeps the initial paint cheap for large grids.
 */
export function CreativeTile({ creative, campaign, onClick, selected, onSelect }: CreativeTileProps) {
  const aspectClass = aspectClassForRatio(creative.ratio)

  const failed = creative.path === null && !creative.stubbed
  const stubbed = creative.path === null && creative.stubbed === true
  const qualityFail = creative.quality === "fail"
  const badge: DisplayStatus = displayStatusOf(creative)

  // A stub has a real (1×1) file at the slot path — the proxy can serve it.
  const src = failed
    ? null
    : buildCreativeProxyUrl(campaign, creative.market, creative.product, creative.ratio)

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border bg-card p-2 transition",
        selected ? "border-primary" : "border-border hover:border-fg-3",
        qualityFail && !selected && "border-warn/50 hover:border-warn/70",
        stubbed && !selected && "border-bad/40 hover:border-bad/60",
      )}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={cn(
            "absolute left-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/70 bg-black/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          aria-label={selected ? `Deselect ${creative.product}` : `Select ${creative.product}`}
          role="checkbox"
          aria-checked={!!selected}
        >
          {selected && <Check className="h-3 w-3" />}
        </button>
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${creative.product} · ${creative.market} · ${creative.ratio}`}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-lg bg-muted",
            aspectClass,
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxy serves dynamic per-run PNGs; next/image static analysis isn't useful here
            <img
              src={src}
              alt={`${creative.product} ${creative.market} ${creative.ratio}`}
              loading="lazy"
              className={cn("h-full w-full object-cover", stubbed && "opacity-50")}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, var(--bad) 0 8px, transparent 8px 16px)",
                backgroundColor: "color-mix(in oklab, var(--bad) 8%, transparent)",
              }}
            >
              <span className="rounded bg-card/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-bad">
                failed
              </span>
            </div>
          )}
          <div className="absolute right-1 top-1 flex items-center gap-1">
            {qualityFail && (
              <span
                className="rounded bg-warn/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-black"
                title="Failed the output quality gate"
              >
                quality
              </span>
            )}
            {stubbed && (
              <span
                className="rounded bg-bad/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white"
                title="Generation failed — placeholder stub"
              >
                stub
              </span>
            )}
            <ComplianceBadgePill badge={badge} />
          </div>

        </div>
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className="truncate font-medium text-fg-1">{creative.product}</span>
          <CreativeSourcePill source={creative.source} />
          <span className="grow" />
          <span className="font-mono text-[10px] text-fg-3">
            {creative.market} · {creative.ratio}
          </span>
        </div>
      </button>

      {/* Hover overlay with actions — outside the button to avoid nested interactive elements */}
      {src && (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-center gap-2 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" style={{ bottom: "calc(0.5rem + 1.5rem + 0.5rem)" }}>
          <a
            href={src}
            download
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto rounded-full bg-white/90 p-2 text-black transition hover:bg-white dark:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Download ${creative.product}`}
            tabIndex={-1}
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClick}
            className="pointer-events-auto rounded-full bg-white/90 p-2 text-black transition hover:bg-white dark:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open details for ${creative.product}`}
            tabIndex={-1}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
