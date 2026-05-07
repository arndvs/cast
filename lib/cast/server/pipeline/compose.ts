/**
 * Compose stage — `compose`.
 *
 * Sharp composite: base photo → headline text overlay (SVG) → corner logo.
 *
 * Subhead/CTA at the compose stage is an open design decision. Currently
 * we render headline only; the SVG renderer
 * leaves room for `subheadline` / `cta` once that lands.
 */

import sharp from "sharp"
import type { AspectRatio } from "@/lib/cast/schemas"
import { RATIO_PIXELS } from "@/lib/cast/ratios"

export interface ComposeArgs {
  /** Base PNG already at target ratio dims. */
  base: Buffer
  ratio: AspectRatio
  headline: string
  /** Absolute path to the chosen logo variant PNG. */
  logoPath: string
  /**
   * Hex of the brand primary — used to tint a translucent text panel behind
   * the headline so the type stays legible across photo backgrounds.
   */
  primaryHex: string
}

export async function composeCreative(args: ComposeArgs): Promise<Buffer> {
  const { width, height } = RATIO_PIXELS[args.ratio]

  // 1. Normalize the base to the target dim (defensive — resize stage should
  //    have done this already, but composite() refuses mismatched canvases).
  const base = await sharp(args.base)
    .resize({ width, height, fit: "cover", position: "centre" })
    .png()
    .toBuffer()

  // 2. Render headline as an SVG overlay (full canvas). Sharp scales SVG
  //    according to its own width/height, so we author it at the canvas size.
  const headlineSvg = renderHeadlineSvg({
    width,
    height,
    text: args.headline,
    primaryHex: args.primaryHex,
  })

  // 3. Logo: load + resize to ~12% of the longest side, drop into bottom-right
  //    with a 4% margin.
  const logoSize = Math.round(Math.max(width, height) * 0.12)
  const margin = Math.round(Math.max(width, height) * 0.04)
  const logo = await sharp(args.logoPath)
    .resize({
      width: logoSize,
      height: logoSize,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()
  const logoMeta = await sharp(logo).metadata()
  const logoLeft = width - (logoMeta.width ?? logoSize) - margin
  const logoTop = height - (logoMeta.height ?? logoSize) - margin

  return sharp(base)
    .composite([
      { input: Buffer.from(headlineSvg), top: 0, left: 0 },
      { input: logo, top: logoTop, left: logoLeft },
    ])
    .png()
    .toBuffer()
}

function renderHeadlineSvg(args: {
  width: number
  height: number
  text: string
  primaryHex: string
}): string {
  const { width, height, text, primaryHex } = args
  const fontSize = Math.round(Math.min(width, height) * 0.075)
  const panelHeight = Math.round(fontSize * 2.4)
  const panelTop = Math.round(height * 0.08)
  const panelOpacity = 0.78
  const safeText = escapeXml(text)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="${panelTop}" width="${width}" height="${panelHeight}" fill="${primaryHex}" fill-opacity="${panelOpacity}"/>
  <text
    x="${Math.round(width / 2)}"
    y="${panelTop + Math.round(panelHeight / 2) + Math.round(fontSize / 3)}"
    font-family="DM Sans, system-ui, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="#ffffff"
    text-anchor="middle"
  >${safeText}</text>
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
