/**
 * `buildPromptPreview` — pure, deterministic prompt the renderer would send to
 * dall-e-3 for a missing product asset. Surfaced via the brief editor's "Show prompt"
 * disclosure and reused verbatim by the GenAI client.
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
  /** Visual negative-prompt fragments — what to avoid in the image. */
  negativePromptFragments?: readonly string[]
  /** Mood keywords — short scene-setting adjectives. */
  moodKeywords?: readonly string[]
  /**
   * S5: cross-frame identity lock — a sentence appended to every prompt so a
   * campaign's 1:1 / 9:16 / 16:9 renditions share subject, palette, and
   * lighting language (port of MCRDSE brand.mjs identityLock).
   */
  identityLock?: string
}

export interface PromptPreviewProduct {
  name: string
  sku: string
  /** Per-SKU visual fragments that override / extend the brand-level voice. */
  skuFragments?: {
    promptFragments?: readonly string[]
    accentHex?: string
    sceneMood?: string
  }
}

export interface PromptPreviewArgs {
  brand: PromptPreviewBrand
  product: PromptPreviewProduct
  market: string
  ratio: AspectRatio
  /**
   * S6: this slot's job in the ratio series — `hero` (first / primary),
   * `mid` (supporting), `payoff` (closing). Port of MCRDSE's per-frame role
   * clause (Serial Position / Peak-End applied to prompts).
   */
  frameRole?: "hero" | "mid" | "payoff"
}

const RATIO_HINT: Record<AspectRatio, string> = {
  "1x1": "square",
  "9x16": "tall (story format)",
  "16x9": "wide (landscape)",
}

const FRAME_ROLE_CLAUSE: Record<"hero" | "mid" | "payoff", string> = {
  hero: "This is the primary hero visual of the set — bold, must stop the scroll.",
  mid: "This is a supporting frame in the set — keep it visually consistent with the hero.",
  payoff: "This is the closing visual of the set — quiet, minimal, room for the call-to-action.",
}

export function buildPromptPreview({ brand, product, market, ratio, frameRole }: PromptPreviewArgs): string {
  const lang = market.split("-").pop() ?? "en"
  const paletteHexes = product.skuFragments?.accentHex
    ? [
        product.skuFragments.accentHex,
        ...brand.paletteHexes.filter(
          (hex) => hex.toLowerCase() !== product.skuFragments?.accentHex?.toLowerCase(),
        ),
      ]
    : brand.paletteHexes
  const palette = paletteHexes.length > 0
    ? paletteHexes.slice(0, 3).join(", ")
    : "brand palette"

  // Merge brand voice fragments with per-SKU overrides (SKU frags take
  // precedence, placed first so they land at the start of the clause).
  const skuFragments = product.skuFragments?.promptFragments ?? []
  const voiceFragments = brand.voice.length > 0 ? brand.voice : []
  const allVoiceFrags = [...skuFragments, ...voiceFragments]
  const voice = allVoiceFrags.length > 0 ? allVoiceFrags.join(", ") : "on-brand"

  const ratioHint = RATIO_HINT[ratio]
  const sceneMood = product.skuFragments?.sceneMood
    ? ` Scene mood: ${product.skuFragments.sceneMood}.`
    : ""
  const moodLine = brand.moodKeywords && brand.moodKeywords.length > 0
    ? ` Mood: ${brand.moodKeywords.join(", ")}.`
    : ""

  // Build the avoid line: brand banned-words cap + visual negative fragments.
  const avoidWords = brand.bannedWords.slice(0, 4)
  const negFrags = brand.negativePromptFragments ?? []
  const avoidParts = [...avoidWords, ...negFrags]
  const avoidLine = avoidParts.length > 0 ? `Avoid: ${avoidParts.join("; ")}.` : ""

  // S6: frame-role clause (when present).
  const frameLine = frameRole ? FRAME_ROLE_CLAUSE[frameRole] : null

  // S5: cross-frame identity lock (when present).
  const identityLine = brand.identityLock
    ? `Identity lock: ${brand.identityLock}`
    : null

  return [
    `Hero product photo of ${product.name} (${product.sku}).`,
    `Brand: ${brand.displayName} — ${voice}.`,
    `Color palette: ${palette}.`,
    `Composition: clean studio background, room for headline overlay, ${ratioHint} (${ratio}).`,
    `Locale: ${market} (${lang}). No on-image text — text is composited at the compose step.`,
    moodLine ? moodLine.trim() : null,
    sceneMood ? sceneMood.trim() : null,
    frameLine,
    avoidLine,
    identityLine,
  ].filter(Boolean).join(" ")
}
