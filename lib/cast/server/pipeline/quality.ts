/**
 * Output quality stage — `quality`.
 *
 * Three server-side checks on the composed PNG before it's written, so a
 * broken/blank/garbled creative never reaches the outputs grid:
 *
 *   1. Byte-size floor   — reject suspiciously small images (corrupt/blank).
 *   2. Mean luma band    — reject crushed-dark or blown-out-white frames.
 *   3. Text-leak density — flag sharp-edge density in the bottom text zone
 *                          (the model baked text the compositor shouldn't need).
 *
 * Cast already depends on `sharp`, so we decode to raw RGB via
 * `sharp(...).raw()` and run the heuristics over pixels — no PNG parser
 * needed.
 */

import sharp from "sharp"

/** Minimum acceptable file size in bytes (10 KB). */
export const MIN_BYTES = 10_240

/** Mean luma must be within [lo, hi] (0–255 scale). */
export const LUMA_LO = 15
export const LUMA_HI = 245

/** Sharp-edge density threshold in the bottom text zone (0–1). */
export const EDGE_DENSITY_THRESHOLD = 0.12

/** Fraction of the frame treated as the "text zone" from the bottom. */
export const TEXT_ZONE_BOTTOM_FRACTION = 0.45

export interface QualityResult {
  pass: boolean
  failures: string[]
}

/**
 * Run all quality checks on a composed PNG buffer.
 * Never throws — on decode failure returns `{ pass: false, failures: ["decode-error"] }`
 * so the pipeline can decide (retry-once) rather than crash.
 */
export async function checkComposedPng(buf: Buffer): Promise<QualityResult> {
  const failures: string[] = []

  // 1. Byte-size floor
  if (buf.length < MIN_BYTES) {
    failures.push(`too-small: ${buf.length} bytes < ${MIN_BYTES} minimum`)
  }

  // 2+3. Decode raw pixels for luma + edge checks.
  let raw: { data: Buffer; info: sharp.OutputInfo }
  try {
    raw = await sharp(buf)
      .raw()
      .toBuffer({ resolveWithObject: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    failures.push(`decode-error: ${message}`)
    return { pass: false, failures }
  }

  const { data, info } = raw
  const { width, height, channels } = info
  if (width === 0 || height === 0) {
    failures.push("decode-error: zero-size frame")
    return { pass: false, failures }
  }

  // 2. Mean luma (BT.601) across all pixels.
  const luma = meanLuma(data, width, height, channels)
  if (luma < LUMA_LO) {
    failures.push(`crushed-dark: mean luma ${luma.toFixed(1)} < ${LUMA_LO}`)
  } else if (luma > LUMA_HI) {
    failures.push(`white-out: mean luma ${luma.toFixed(1)} > ${LUMA_HI}`)
  }

  // 3. Text-leak: check the bottom text zone.
  const density = edgeDensity(data, width, height, channels)
  if (density > EDGE_DENSITY_THRESHOLD) {
    failures.push(`text-leak: edge density ${density.toFixed(3)} > ${EDGE_DENSITY_THRESHOLD} in text zone`)
  }

  return { pass: failures.length === 0, failures }
}

/**
 * Mean luma (BT.601) across all pixels: Y = 0.299R + 0.587G + 0.114B.
 */
export function meanLuma(
  pixels: Buffer | Uint8Array,
  width: number,
  height: number,
  channels: number,
): number {
  if (width === 0 || height === 0) return 0
  const total = width * height
  let sum = 0
  for (let i = 0; i < total; i++) {
    const off = i * channels
    sum +=
      0.299 * pixels[off] +
      0.587 * pixels[off + 1] +
      0.114 * pixels[off + 2]
  }
  return sum / total
}

/**
 * Horizontal-gradient sharp-edge density in the bottom TEXT_ZONE_BOTTOM_FRACTION
 * of the frame. Thresholded at a 40-luma-delta.
 */
export function edgeDensity(
  pixels: Buffer | Uint8Array,
  width: number,
  height: number,
  channels: number,
): number {
  const startRow = Math.floor(height * (1 - TEXT_ZONE_BOTTOM_FRACTION))
  const zonePools = (height - startRow) * width
  if (zonePools === 0 || width < 2) return 0

  let edgeCount = 0
  for (let y = startRow; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const idx = (y * width + x) * channels
      const prevIdx = idx - channels
      const lumaHere =
        0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
      const lumaPrev =
        0.299 * pixels[prevIdx] +
        0.587 * pixels[prevIdx + 1] +
        0.114 * pixels[prevIdx + 2]
      if (Math.abs(lumaHere - lumaPrev) > 40) edgeCount++
    }
  }
  return edgeCount / zonePools
}