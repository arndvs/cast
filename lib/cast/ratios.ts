/**
 * Canonical aspect-ratio enum and pixel dims.
 *
 * The schema in `./schemas.ts` already enforces the closed enum on `briefSchema`.
 * This file is the typed surface for any consumer that needs the pixel dims —
 * currently just the renderer (prompt preview, future tile sizing) and
 * the GenAI client which calls dall-e-3 at native sizes.
 */

import type { AspectRatio } from "./schemas"

export type { AspectRatio }

export const ALL_RATIOS = ["1x1", "9x16", "16x9"] as const satisfies readonly AspectRatio[]

/** Native dall-e-3 dimensions for each ratio. `gpt-image-1` cheap mode crops from 1024². */
export const RATIO_PIXELS = {
  "1x1": { width: 1024, height: 1024 },
  "9x16": { width: 1024, height: 1792 },
  "16x9": { width: 1792, height: 1024 },
} as const satisfies Record<AspectRatio, { width: number; height: number }>

export const RATIO_LABELS = {
  "1x1": "1:1 · Square",
  "9x16": "9:16 · Story",
  "16x9": "16:9 · Landscape",
} as const satisfies Record<AspectRatio, string>
