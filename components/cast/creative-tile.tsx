"use client"

import * as React from "react"

import { ComplianceBadgePill } from "@/components/cast/compliance-badge-pill"
import { CreativeSourcePill } from "@/components/cast/creative-source-pill"
import { aspectClassForRatio } from "@/lib/cast/creative-aspect-class"
import { buildCreativeProxyUrl } from "@/lib/cast/creative-proxy-url"
import type { Creative } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface CreativeTileProps {
  creative: Creative
  campaign: string
  onClick: () => void
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
 * The image URL is built from the public proxy at `/api/outputs/[...path]`
 * (which whitelists `.png` and reads from `outputs/` outside the static
 * tree). `loading="lazy"` keeps the initial paint cheap for large grids.
 */
export function CreativeTile({ creative, campaign, onClick }: CreativeTileProps) {
  const aspectClass = aspectClassForRatio(creative.ratio)

  const failed = creative.path === null
  const badge: "OK" | "WARN" | "FAIL" =
    failed ? "FAIL" : (creative.compliance?.badge ?? "OK")

  const src = failed
    ? null
    : buildCreativeProxyUrl(campaign, creative.market, creative.product, creative.ratio)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-2 text-left transition hover:border-fg-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="h-full w-full object-cover"
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
        <div className="absolute right-1 top-1">
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
  )
}
