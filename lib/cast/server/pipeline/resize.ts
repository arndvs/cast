/**
 * Resize stage — `resize`.
 *
 * Normalize a master buffer (local upload, dall-e-3 native, or cheap-mode
 * 1024²) to the ratio's exact pixel dim via `sharp.cover` center-crop. Always
 * runs regardless of mode — local uploads can be any dim, and we want a
 * single deterministic surface for downstream `compose`.
 */

import sharp from "sharp"
import type { AspectRatio } from "@/lib/cast/schemas"
import { RATIO_PIXELS } from "@/lib/cast/ratios"

export async function resizeForRatio(
  masterPng: Buffer,
  ratio: AspectRatio,
): Promise<Buffer> {
  const { width, height } = RATIO_PIXELS[ratio]
  return sharp(masterPng)
    .resize({ width, height, fit: "cover", position: "centre" })
    .png()
    .toBuffer()
}
