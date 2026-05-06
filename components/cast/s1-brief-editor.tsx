"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Dropzone, type DropzoneFile } from "@/components/cast/dropzone"
import { MarketsTypeahead } from "@/components/cast/markets-typeahead"
import type { LogoVariantId, S1Action, S1State } from "@/components/cast/s1-state"
import { ALL_RATIOS, RATIO_LABELS, type AspectRatio } from "@/lib/cast/ratios"
import { ALL_MARKETS, activeLanguages, getMarket } from "@/lib/cast/markets"
import { containsBannedWord, getDefaultBannedWords } from "@/lib/cast/banned-words"
import { DEMO_BRANDS, getDemoBrand, type DemoBrand } from "@/lib/cast/demo-brands"
import { buildPromptPreview } from "@/lib/cast/prompt"
import { SLUG_RE, slugify } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

const LOGO_VARIANTS: ReadonlyArray<{
  id: LogoVariantId
  label: string
  light: boolean
}> = [
  { id: "primary-on-light", label: "Primary · light", light: true },
  { id: "primary-on-dark", label: "Primary · dark", light: false },
  { id: "mono-white", label: "Mono white", light: false },
  { id: "mono-black", label: "Mono black", light: true },
]

interface S1BriefEditorProps {
  state: S1State
  dispatch: React.Dispatch<S1Action>
}

export function S1BriefEditor({ state, dispatch }: S1BriefEditorProps) {
  const [jsonMode, setJsonMode] = React.useState(false)
  const brand = getDemoBrand(state.brandSlug)

  // Banned-word check across the audience field + every locale message.
  // Uses the union of the default list and the current brand's list — this
  // matches what `/api/generate` will do at compliance time (D29 parity).
  const bannedList = React.useMemo(() => {
    const merged = new Set<string>()
    for (const w of getDefaultBannedWords()) merged.add(w.toLowerCase())
    for (const w of brand?.bannedWords ?? []) merged.add(w.toLowerCase())
    return [...merged]
  }, [brand])

  const haystack = [
    state.brief.audience,
    ...Object.values(state.brief.message),
  ].join(" ")
  const bannedHits = containsBannedWord(haystack, bannedList)
  const slugInvalid = !SLUG_RE.test(state.brief.campaign || "")

  if (!brand) {
    return (
      <div className="p-6 text-sm text-bad">
        Unknown brand: <code>{state.brandSlug}</code>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar state={state} dispatch={dispatch} brand={brand} />

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
            brand={brand}
            bannedList={bannedList}
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
}: {
  state: S1State
  dispatch: React.Dispatch<S1Action>
  brand: DemoBrand
}) {
  return (
    <aside className="flex flex-col gap-5">
      <Section title="Brand">
        <div className="flex flex-col gap-2">
          {DEMO_BRANDS.map((b) => {
            const active = state.brandSlug === b.slug
            return (
              <button
                key={b.slug}
                type="button"
                onClick={() => {
                  // V2 keeps the same brief shape across brand swaps so we
                  // emit an action with the same brief — V3 will swap to a
                  // brand-specific default brief from `inputs/brands/[slug]/`.
                  dispatch({ type: "setBrand", slug: b.slug, brief: state.brief })
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors",
                  active && "ring-2 ring-brand-cyan",
                )}
              >
                <div className="flex h-8 w-8 overflow-hidden rounded">
                  <span className="h-full w-1/3" style={{ background: b.colors.primary }} />
                  <span className="h-full w-1/3" style={{ background: b.colors.secondary }} />
                  <span className="h-full w-1/3" style={{ background: b.colors.accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b.displayName}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.sub}</div>
                </div>
                {active && <span className="text-brand-cyan">✓</span>}
              </button>
            )
          })}
        </div>
      </Section>

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

      <Section title="Logo variant">
        <div className="grid grid-cols-2 gap-2">
          {LOGO_VARIANTS.map((v) => {
            const active = state.logoVariant === v.id
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
                    background: v.light ? "#ffffff" : "#222",
                    color: v.light ? brand.colors.primary : "#ffffff",
                  }}
                >
                  {brand.displayName.slice(0, 1)}
                </div>
                <div className="text-[0.625rem] leading-tight text-muted-foreground">
                  {v.label}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

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
  state: S1State
  dispatch: React.Dispatch<S1Action>
  brand: DemoBrand
  bannedList: readonly string[]
  slugInvalid: boolean
}) {
  const { brief } = state
  const langs = React.useMemo(() => activeLanguages(brief.markets), [brief.markets])

  const inBriefSkus = new Set(brief.products.map((p) => p.sku))
  const availableCatalog = brand.products.filter((p) => !inBriefSkus.has(p.sku))

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
                <PickChip
                  key={m.code}
                  on={on}
                  onClick={() => dispatch({ type: "toggleMarket", code: m.code })}
                >
                  {m.name}
                </PickChip>
              )
            })}
            {brief.markets
              .filter((c) => !ALL_MARKETS.some((m) => m.code === c))
              .map((c) => (
                <PickChip
                  key={c}
                  on
                  onClick={() => dispatch({ type: "toggleMarket", code: c })}
                  title={`custom market — click to remove`}
                >
                  <span className="font-mono">{c}</span>{" "}
                  <Badge variant="outline" className="ml-1 text-[0.625rem]">
                    custom
                  </Badge>
                </PickChip>
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
                <PickChip
                  key={r}
                  on={on}
                  onClick={() => dispatch({ type: "toggleRatio", value: r })}
                >
                  {RATIO_LABELS[r]}
                </PickChip>
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
              <span className="font-sans text-xs font-normal text-muted-foreground">
                · picked from {brand.displayName} catalog
              </span>
            </CardTitle>
            <CatalogAdd
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
            <ProductRow
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

function PickChip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        on
          ? "border-brand-cyan bg-brand-cyan/10 text-fg-1"
          : "border-border bg-card text-fg-3 hover:bg-accent",
      )}
    >
      {on && <span className="text-brand-cyan">✓</span>}
      {children}
    </button>
  )
}

function CatalogAdd({
  available,
  onAdd,
}: {
  available: DemoBrand["products"]
  onAdd: (p: DemoBrand["products"][number]) => void
}) {
  const [open, setOpen] = React.useState(false)
  if (available.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        all catalog products in brief
      </span>
    )
  }
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="mr-1 h-3 w-3" /> Add product
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover shadow-md">
          {available.map((p) => (
            <button
              key={p.sku}
              type="button"
              onClick={() => {
                onAdd(p)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span
                className="h-6 w-6 shrink-0 rounded"
                style={{
                  background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})`,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name}</span>
                <span className="block truncate font-mono text-[0.625rem] text-muted-foreground">
                  {p.sku}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({
  product,
  brand,
  brief,
  upload,
  dispatch,
}: {
  product: { name: string; sku: string }
  brand: DemoBrand
  brief: S1State["brief"]
  upload: S1State["uploads"][string] | null
  dispatch: React.Dispatch<S1Action>
}) {
  const slug = slugify(product.name)
  const swatch = brand.products.find((p) => p.sku === product.sku)
  const previewMarket = brief.markets[0] || "us-en"
  const previewRatio: AspectRatio = brief.ratios[0] ?? "1x1"
  const promptPreview = buildPromptPreview({
    brand: {
      displayName: brand.displayName,
      voice: brand.voice,
      paletteHexes: Object.values(brand.colors),
      bannedWords: brand.bannedWords,
    },
    product,
    market: previewMarket,
    ratio: previewRatio,
  })

  const dropFile: DropzoneFile | null = upload
    ? {
        fileName: upload.fileName,
        objectUrl: upload.objectUrl,
        size: upload.size,
        type: upload.type,
      }
    : null

  return (
    <div className="grid grid-cols-1 items-start gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_140px_auto]">
      <div className="flex items-center gap-3">
        {swatch && (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded font-display text-lg font-bold"
            style={{
              background: `linear-gradient(135deg, ${swatch.swatch[0]}, ${swatch.swatch[1]})`,
              color: swatch.hex,
            }}
          >
            {brand.displayName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{product.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">
            {product.sku}
          </div>
          <div className="truncate font-mono text-[0.6875rem] text-muted-foreground">
            slug: {slug}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Dropzone
          preview={dropFile}
          onUpload={(f) =>
            dispatch({
              type: "upload",
              productSlug: slug,
              preview: {
                fileName: f.fileName,
                objectUrl: f.objectUrl,
                size: f.size,
                type: f.type,
              },
            })
          }
          onRemove={() => dispatch({ type: "removeUpload", productSlug: slug })}
        />
        <Badge variant="outline" className="self-center text-[0.625rem]">
          {upload ? "local" : "→ GenAI"}
        </Badge>
      </div>
      <button
        type="button"
        aria-label={`remove ${product.name}`}
        onClick={() => dispatch({ type: "removeProduct", sku: product.sku })}
        className="self-start rounded p-1 text-muted-foreground hover:bg-accent hover:text-bad"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <details className="sm:col-span-3">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-fg-1">
          Show prompt (D18) · {previewMarket} · {previewRatio}
        </summary>
        <pre className="mt-2 overflow-auto rounded bg-muted/40 p-3 font-mono text-[0.6875rem] leading-relaxed text-fg-2">
          {promptPreview}
        </pre>
      </details>
    </div>
  )
}

// Re-export getMarket for tree-shaking guarantees in test env.
export { getMarket }
