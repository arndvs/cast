"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import { BriefPickChip } from "@/components/cast/brief-pick-chip"
import { BriefProductRow } from "@/components/cast/brief-product-row"
import { CatalogAddDropdown } from "@/components/cast/catalog-add-dropdown"
import { MarketsTypeahead } from "@/components/cast/markets-typeahead"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { ALL_RATIOS, RATIO_LABELS } from "@/lib/cast/ratios"
import { ALL_MARKETS, activeLanguages } from "@/lib/cast/markets"
import { containsBannedWord } from "@/lib/cast/banned-words"
import { type SeedBrand } from "@/lib/cast/seed-brands"
import { slugify } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// FormView
// ---------------------------------------------------------------------------

interface BriefEditorFormViewProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Seed-brand data; absent for non-seed fixtures. */
  brand?: SeedBrand
  bannedList: readonly string[]
  slugInvalid: boolean
}

export function BriefEditorFormView({
  state,
  dispatch,
  brand,
  bannedList,
  slugInvalid,
}: BriefEditorFormViewProps) {
  const { brief } = state
  const langs = React.useMemo(
    () => activeLanguages(brief.markets),
    [brief.markets],
  )

  const inBriefSkus = new Set(brief.products.map((product) => product.sku))
  const availableCatalog = (brand?.products ?? []).filter(
    (product) => !inBriefSkus.has(product.sku),
  )

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
                dispatch({
                  type: "setField",
                  field: "campaign",
                  value: e.target.value,
                })
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
                dispatch({
                  type: "setField",
                  field: "audience",
                  value: e.target.value,
                })
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
              {langs.map((market) => {
                const value = brief.message[market.language] ?? ""
                const localBanned = containsBannedWord(value, bannedList)
                const isEmpty = value.length === 0
                return (
                  <div key={market.language} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 rounded bg-muted px-2 py-1.5 text-center font-mono text-xs">
                      {market.language}
                    </span>
                    <Input
                      value={value}
                      placeholder="headline for this locale"
                      className={cn(isEmpty && "border-bad", localBanned.length > 0 && "border-warn")}
                      onChange={(e) =>
                        dispatch({
                          type: "setLocaleMessage",
                          lang: market.language,
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
            {ALL_MARKETS.map((market) => {
              const on = brief.markets.includes(market.code)
              return (
                <BriefPickChip
                  key={market.code}
                  on={on}
                  onClick={() =>
                    dispatch({ type: "toggleMarket", code: market.code })
                  }
                >
                  {market.name}
                </BriefPickChip>
              )
            })}
            {brief.markets
              .filter(
                (code) => !ALL_MARKETS.some((market) => market.code === code),
              )
              .map((code) => (
                <BriefPickChip
                  key={code}
                  on
                  onClick={() => dispatch({ type: "toggleMarket", code })}
                  title={`custom market — click to remove`}
                >
                  <span className="font-mono">{code}</span>{" "}
                  <Badge
                    variant="outline"
                    className="ml-1 text-[0.625rem]"
                  >
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
            {ALL_RATIOS.map((ratio) => {
              const on = brief.ratios.includes(ratio)
              return (
                <BriefPickChip
                  key={ratio}
                  on={on}
                  onClick={() =>
                    dispatch({ type: "toggleRatio", value: ratio })
                  }
                >
                  {RATIO_LABELS[ratio]}
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
              onAdd={(product) =>
                dispatch({
                  type: "addProduct",
                  product: { name: product.name, sku: product.sku },
                })
              }
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {brief.products.length < 2 && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              ↑ docs recommend ≥ 2 products per brief
            </p>
          )}
          {brief.products.map((product) => (
            <BriefProductRow
              key={product.sku}
              product={product}
              brand={brand}
              brief={brief}
              upload={state.uploads[slugify(product.name)] ?? null}
              dispatch={dispatch}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
