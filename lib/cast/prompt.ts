/**
 * `buildPromptPreview` — pure, deterministic prompt the renderer would send to
 * dall-e-3 for a missing product asset (D18). Surfaced via the S1 "Show prompt"
 * disclosure and reused verbatim by the V4 GenAI client.
 *
 * Ported from `docs/prototype/cast-data.jsx::buildPromptPreview`.
 */

import type { AspectRatio } from "./ratios"

export interface PromptPreviewBrand {
  displayName: string
  /** Voice fragments — short adjectives/scene cues. */
  voice: readonly string[]
  /** Up to 4 colors in palette order; only the first 3 surface in the prompt. */
  paletteHexes: readonly string[]
  bannedWords: readonly string[]
}

export interface PromptPreviewProduct {
  name: string
  sku: string
}

export interface PromptPreviewArgs {
  brand: PromptPreviewBrand
  product: PromptPreviewProduct
  market: string
  ratio: AspectRatio
}

const RATIO_HINT: Record<AspectRatio, string> = {
  "1x1": "square",
  "9x16": "tall (story format)",
  "16x9": "wide (landscape)",
}

export function buildPromptPreview({ brand, product, market, ratio }: PromptPreviewArgs): string {
  const lang = market.split("-").pop() ?? "en"
  const palette = brand.paletteHexes.length > 0
    ? brand.paletteHexes.slice(0, 3).join(", ")
    : "brand palette"
  const voice = brand.voice.length > 0 ? brand.voice.join(", ") : "on-brand"
  const ratioHint = RATIO_HINT[ratio]
  return [
    `Hero product photo of ${product.name} (${product.sku}).`,
    `Brand: ${brand.displayName} — ${voice}.`,
    `Color palette: ${palette}.`,
    `Composition: clean studio background, room for headline overlay, ${ratioHint} (${ratio}).`,
    `Locale: ${market} (${lang}). No on-image text — text is composited at the resize step.`,
    `Avoid: ${brand.bannedWords.slice(0, 4).join(", ")}.`,
  ].join(" ")
}
