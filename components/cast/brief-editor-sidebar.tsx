"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"

import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import { getSeedBrand, type SeedBrand } from "@/lib/cast/seed-brands"
import { slugify } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Section (small helper — co-located)
// ---------------------------------------------------------------------------

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface BriefEditorSidebarProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Seed-brand data for visual display; absent for non-seed fixtures. */
  brand?: SeedBrand
  logoVariants: readonly ClientLogoVariant[]
  /** Slug list from the on-disk registry — drives the brand picker. */
  availableBrands: readonly string[]
}

export function BriefEditorSidebar({
  state,
  dispatch,
  brand,
  logoVariants,
  availableBrands,
}: BriefEditorSidebarProps) {
  return (
    <aside className="flex flex-col gap-5">
      <Section title="Brand">
        <div className="flex flex-col gap-2">
          {availableBrands.map((slug) => {
            const seedBrand = getSeedBrand(slug)
            const active = state.brandSlug === slug
            return (
              <button
                key={slug}
                type="button"
                onClick={() =>
                  dispatch({ type: "setBrand", slug, brief: state.brief })
                }
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors",
                  active && "ring-2 ring-brand-cyan",
                )}
              >
                {seedBrand ? (
                  <div className="flex h-8 w-8 overflow-hidden rounded">
                    <span
                      className="h-full w-1/3"
                      style={{ background: seedBrand.colors.primary }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ background: seedBrand.colors.secondary }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ background: seedBrand.colors.accent }}
                    />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-muted font-mono text-[0.6875rem] uppercase">
                    {slug.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {seedBrand?.displayName ?? slug}
                  </div>
                  {seedBrand?.tagline && (
                    <div className="truncate text-xs text-muted-foreground">
                      {seedBrand.tagline}
                    </div>
                  )}
                </div>
                {active && <span className="text-brand-cyan">✓</span>}
              </button>
            )
          })}
        </div>
      </Section>

      {brand?.colors && (
        <Section title="Brand colors">
          <div className="flex flex-wrap gap-2">
            {Object.entries(brand.colors).map(([name, hex]) => (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-xs"
              >
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ background: hex }}
                />
                {name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {logoVariants.length > 0 && (
        <Section title="Logo variant">
          <div className="grid grid-cols-2 gap-2">
            {logoVariants.map((variant) => {
              const active = state.logoVariant === variant.id
              const isLight = variant.theme !== "dark"
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() =>
                    dispatch({ type: "setLogoVariant", id: variant.id })
                  }
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center transition-colors",
                    active && "ring-2 ring-brand-cyan",
                  )}
                >
                  <div
                    className="flex h-10 w-full items-center justify-center rounded font-display text-base font-bold"
                    style={{
                      background: isLight ? "#ffffff" : "#222",
                      color: isLight
                        ? (brand?.colors.primary ?? "currentColor")
                        : "#ffffff",
                    }}
                  >
                    {(brand?.displayName ?? state.brandSlug).slice(0, 1)}
                  </div>
                  <div className="text-[0.625rem] leading-tight text-muted-foreground">
                    {variant.displayName}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {brand?.products && (
        <Section title="Detected input assets">
          <ul className="flex flex-col gap-1.5 text-xs">
            {brand.products.map((product) => {
              const productSlug = slugify(product.name)
              const upload = state.uploads[productSlug]
              const inBrief = state.brief.products.some(
                (bp) => bp.sku === product.sku,
              )
              return (
                <li
                  key={product.sku}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5",
                    !inBrief && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono",
                      upload ? "text-ok" : "text-fg-3",
                    )}
                  >
                    {upload ? "✓" : "→"}
                  </span>
                  <span className="flex-1 truncate">
                    {upload
                      ? upload.fileName
                      : `${productSlug} — will generate`}
                  </span>
                  <Badge variant="outline" className="text-[0.625rem]">
                    {upload ? "uploaded" : "→ genai"}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <Section title="GenAI mode">
        <Badge variant="outline" className="font-mono text-[0.6875rem]">
          {process.env.NEXT_PUBLIC_CAST_GENAI_MODE === "cheap"
            ? "gpt-image-1 · 1 master + Sharp"
            : "dall-e-3 · 3 native sizes"}
        </Badge>
      </Section>
    </aside>
  )
}
