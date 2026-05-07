"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { BriefPickChip } from "@/components/cast/brief-pick-chip"
import { BriefProductRow } from "@/components/cast/brief-product-row"
import { CatalogAddDropdown } from "@/components/cast/catalog-add-dropdown"
import { MarketsTypeahead } from "@/components/cast/markets-typeahead"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { ALL_RATIOS, RATIO_LABELS } from "@/lib/cast/ratios"
import { ALL_MARKETS, activeLanguages } from "@/lib/cast/markets"
import { containsBannedWord, getDefaultBannedWords } from "@/lib/cast/banned-words"
import { SEED_BRANDS, getSeedBrand, type SeedBrand } from "@/lib/cast/seed-brands"
import { SLUG_RE, slugify } from "@/lib/cast/schemas"
import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import { cn } from "@/lib/utils"

/**
 * Manifest-driven logo variants. The editor renders one tile per entry in
 * `brand.logoVariants` from `loadBrandProfile` (projected to a client-safe
 * shape at the server→client boundary). Brands may declare any number of
 * variants. When no brand profile is available (e.g. fixture missing on
 * disk), the grid is hidden entirely.
 */

interface BriefEditorProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Logo variants from the loaded brand profile. Empty when no brand on disk. */
  logoVariants: readonly ClientLogoVariant[]
  /**
   * Banned-word list to match against. Supplied by the shell so the
   * inline ⚠ badge and the Generate gate read from the same merged source
   * (default floor ∪ brand fixture). Falls back to the universal floor when
   * omitted (e.g. unit tests rendering the editor in isolation).
   */
  bannedList?: readonly string[]
  /**
   * Brand slugs available on disk (from listBrandSlugs / /api/brands).
   * Drives the brand picker so it reflects the on-disk registry rather than
   * the hardcoded demo list. Falls back to the demo-brand slugs when omitted.
   */
  availableBrands?: readonly string[]
}

export function BriefEditor({ state, dispatch, logoVariants, bannedList, availableBrands }: BriefEditorProps) {
  const [jsonMode, setJsonMode] = React.useState(false)
  // Seed-brand data provides rich visual display (colors, products, voice).
  // Non-seed slugs (or newly added on-disk fixtures) render without it.
  const seedBrand = getSeedBrand(state.brandSlug) ?? undefined

  // Banned-word check across the audience field + every locale message.
  // Prefer the shell-supplied `bannedList` (default floor ∪ brand fixture
  // from `loadBrandProfile`, the *exact* list `/api/generate` compliance
  // uses). Falls back to the universal floor when the prop isn't supplied.
  const effectiveBannedList = React.useMemo<readonly string[]>(
    () => bannedList ?? getDefaultBannedWords(),
    [bannedList],
  )

  const haystack = [
    state.brief.audience,
    ...Object.values(state.brief.message),
  ].join(" ")
  const bannedHits = containsBannedWord(haystack, effectiveBannedList)
  const slugInvalid = !SLUG_RE.test(state.brief.campaign || "")

  // Fallback: if no availableBrands list supplied, use the seed-brand slugs.
  const brandList = availableBrands ?? SEED_BRANDS.map((b) => b.slug)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar state={state} dispatch={dispatch} brand={seedBrand} logoVariants={logoVariants} availableBrands={brandList} />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Tabs
            value={jsonMode ? "json" : "form"}
            onValueChange={(v) => setJsonMode(v === "json")}
          >
            <TabsList>
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grow" />
          {bannedHits.length > 0 && (
            <Badge className="bg-warn/15 text-warn-foreground" variant="outline">
              ⚠ banned: {bannedHits.join(", ")}
            </Badge>
          )}
        </div>

        {jsonMode ? (
          <Card>
            <CardContent className="p-4">
              <pre className="overflow-auto rounded bg-muted/50 p-4 font-mono text-xs leading-relaxed text-fg-2">
                {JSON.stringify(state.brief, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <FormView
            state={state}
            dispatch={dispatch}
            brand={seedBrand}
            bannedList={effectiveBannedList}
            slugInvalid={slugInvalid}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({
  state,
  dispatch,
  brand,
  logoVariants,
  availableBrands,
}: {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Seed-brand data for visual display; absent for non-seed fixtures. */
  brand?: SeedBrand
  logoVariants: readonly ClientLogoVariant[]
  /** Slug list from the on-disk registry — drives the brand picker. */
  availableBrands: readonly string[]
}) {
  return (
    <aside className="flex flex-col gap-5">
      <Section title="Brand">
        <div className="flex flex-col gap-2">
          {availableBrands.map((slug) => {
            const b = getSeedBrand(slug)
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
                {b ? (
                  <div className="flex h-8 w-8 overflow-hidden rounded">
                    <span className="h-full w-1/3" style={{ background: b.colors.primary }} />
                    <span className="h-full w-1/3" style={{ background: b.colors.secondary }} />
                    <span className="h-full w-1/3" style={{ background: b.colors.accent }} />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-muted font-mono text-[0.6875rem] uppercase">
                    {slug.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b?.displayName ?? slug}</div>
                  {b?.tagline && (
                    <div className="truncate text-xs text-muted-foreground">{b.tagline}</div>
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
            {logoVariants.map((v) => {
              const active = state.logoVariant === v.id
              const isLight = v.theme !== "dark"
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => dispatch({ type: "setLogoVariant", id: v.id })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center transition-colors",
                    active && "ring-2 ring-brand-cyan",
                  )}
                >
                  <div
                    className="flex h-10 w-full items-center justify-center rounded font-display text-base font-bold"
                    style={{
                      background: isLight ? "#ffffff" : "#222",
                      color: isLight ? (brand?.colors.primary ?? "currentColor") : "#ffffff",
                    }}
                  >
                    {(brand?.displayName ?? state.brandSlug).slice(0, 1)}
                  </div>
                  <div className="text-[0.625rem] leading-tight text-muted-foreground">
                    {v.displayName}
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
          {brand.products.map((p) => {
            const slug = slugify(p.name)
            const upload = state.uploads[slug]
            const inBrief = state.brief.products.some((bp) => bp.sku === p.sku)
            return (
              <li
                key={p.sku}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5",
                  !inBrief && "opacity-50",
                )}
              >
                <span className={cn("font-mono", upload ? "text-ok" : "text-fg-3")}>
                  {upload ? "✓" : "→"}
                </span>
                <span className="flex-1 truncate">
                  {upload ? upload.fileName : `${slug} — will generate`}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
// Main form
// ---------------------------------------------------------------------------

function FormView({
  state,
  dispatch,
  brand,
  bannedList,
  slugInvalid,
}: {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Seed-brand data; absent for non-seed fixtures. */
  brand?: SeedBrand
  bannedList: readonly string[]
  slugInvalid: boolean
}) {
  const { brief } = state
  const langs = React.useMemo(() => activeLanguages(brief.markets), [brief.markets])

  const inBriefSkus = new Set(brief.products.map((p) => p.sku))
  const availableCatalog = (brand?.products ?? []).filter((p) => !inBriefSkus.has(p.sku))

  return (
    <div className="flex flex-col gap-4">
      {/* Campaign card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Campaign</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="campaign-slug">Slug</Label>
            <Input
              id="campaign-slug"
              className={cn("font-mono", slugInvalid && "border-bad")}
              value={brief.campaign}
              onChange={(e) =>
                dispatch({ type: "setField", field: "campaign", value: e.target.value })
              }
            />
            {slugInvalid && (
              <p className="text-xs text-bad">
                slug must match{" "}
                <code className="rounded bg-muted px-1 font-mono">
                  [a-z0-9]+(-[a-z0-9]+)*
                </code>{" "}
                — lowercase, hyphens only
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="audience">Audience</Label>
            <Input
              id="audience"
              value={brief.audience}
              onChange={(e) =>
                dispatch({ type: "setField", field: "audience", value: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Headlines per locale */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Headlines{" "}
            <span className="font-sans text-xs font-normal text-muted-foreground">
              · one row per active language
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {langs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              add at least one market to localize your headline
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {langs.map((m) => {
                const value = brief.message[m.language] ?? ""
                const localBanned = containsBannedWord(value, bannedList)
                return (
                  <div key={m.language} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 rounded bg-muted px-2 py-1.5 text-center font-mono text-xs">
                      {m.language}
                    </span>
                    <Input
                      value={value}
                      placeholder="headline for this locale"
                      className={cn(localBanned.length > 0 && "border-warn")}
                      onChange={(e) =>
                        dispatch({
                          type: "setLocaleMessage",
                          lang: m.language,
                          value: e.target.value,
                        })
                      }
                    />
                    {localBanned.length > 0 && (
                      <span className="shrink-0 font-mono text-[0.6875rem] text-warn">
                        ⚠ {localBanned.join(", ")}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Markets */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Markets{" "}
            <span className="font-sans text-xs font-normal text-muted-foreground">
              · target locales
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <MarketsTypeahead
            selected={brief.markets}
            onAdd={(code) => dispatch({ type: "toggleMarket", code })}
          />
          <div className="flex flex-wrap gap-2">
            {ALL_MARKETS.map((m) => {
              const on = brief.markets.includes(m.code)
              return (
                <BriefPickChip
                  key={m.code}
                  on={on}
                  onClick={() => dispatch({ type: "toggleMarket", code: m.code })}
                >
                  {m.name}
                </BriefPickChip>
              )
            })}
            {brief.markets
              .filter((c) => !ALL_MARKETS.some((m) => m.code === c))
              .map((c) => (
                <BriefPickChip
                  key={c}
                  on
                  onClick={() => dispatch({ type: "toggleMarket", code: c })}
                  title={`custom market — click to remove`}
                >
                  <span className="font-mono">{c}</span>{" "}
                  <Badge variant="outline" className="ml-1 text-[0.625rem]">
                    custom
                  </Badge>
                </BriefPickChip>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Aspect ratios */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Aspect ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ALL_RATIOS.map((r) => {
              const on = brief.ratios.includes(r)
              return (
                <BriefPickChip
                  key={r}
                  on={on}
                  onClick={() => dispatch({ type: "toggleRatio", value: r })}
                >
                  {RATIO_LABELS[r]}
                </BriefPickChip>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-lg">
              Products{" "}
              {brand && (
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  · picked from {brand.displayName} catalog
                </span>
              )}
            </CardTitle>
            <CatalogAddDropdown
              available={availableCatalog}
              onAdd={(p) => dispatch({ type: "addProduct", product: { name: p.name, sku: p.sku } })}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {brief.products.length < 2 && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              ↑ docs recommend ≥ 2 products per brief
            </p>
          )}
          {brief.products.map((p) => (
            <BriefProductRow
              key={p.sku}
              product={p}
              brand={brand}
              brief={brief}
              upload={state.uploads[slugify(p.name)] ?? null}
              dispatch={dispatch}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
