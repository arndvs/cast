"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Dropzone, type DropzoneFile } from "@/components/cast/dropzone"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { buildPromptPreview } from "@/lib/cast/prompt"
import type { AspectRatio } from "@/lib/cast/ratios"
import { slugify } from "@/lib/cast/schemas"
import type { SeedBrand } from "@/lib/cast/seed-brands"

interface BriefProductRowProps {
  product: { name: string; sku: string }
  /** Seed-brand data; absent for non-seed fixtures. */
  brand?: SeedBrand
  brief: CastAppState["brief"]
  upload: CastAppState["uploads"][string] | null
  dispatch: React.Dispatch<CastAppAction>
}

export function BriefProductRow({ product, brand, brief, upload, dispatch }: BriefProductRowProps) {
  const slug = slugify(product.name)
  const swatch = brand?.products.find((p) => p.sku === product.sku)
  const previewMarket = brief.markets[0] || "us-en"
  const previewRatio: AspectRatio = brief.ratios[0] ?? "1x1"
  const promptPreview = brand
    ? buildPromptPreview({
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
    : null

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
            {(brand?.displayName ?? product.name).slice(0, 1)}
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
          Show prompt · {previewMarket} · {previewRatio}
        </summary>
        {promptPreview ? (
          <pre className="mt-2 overflow-auto rounded bg-muted/40 p-3 font-mono text-[0.6875rem] leading-relaxed text-fg-2">
            {promptPreview}
          </pre>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Prompt preview unavailable — brand voice data not loaded.
          </p>
        )}
      </details>
    </div>
  )
}
