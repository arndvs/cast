/**
 * Creative output address — one named type spanning the four surface values
 * a creative's output location is projected into:
 *
 *   (campaign, market, product, ratio) --> stored path  outputs/c/m/p/1x1.png   [manifest / disk]
 *                                      --> proxy URL    /api/outputs/c/m/p/1x1.png [browser img]
 *                                      --> absolute path .../cast/outputs/c/m/p/1x1.png [clipboard]
 *                                      --> adapter publicUrl (SAS url in azure mode)
 *
 * Previously each surface re-derived the same coordinate with its own key
 * shape and validation, so nothing protected their agreement. This module is
 * the single named abstraction the manifest, the tile URLs, the copy-path
 * button, and the storage adapter all derive from.
 *
 * Client-safe: no node deps, no zod.
 */

import { RATIO_ORDER, type AspectRatio } from "@/lib/cast/slot-grid"

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

/** The canonical creative output coordinate. */
export interface CreativeOutputAddress {
  campaign: string
  market: string
  product: string
  ratio: AspectRatio
}

/**
 * Validate an address's components against the canonical slugs/regexes.
 * Returns an error string when invalid, `null` when valid.
 */
export function validateAddress(addr: CreativeOutputAddress): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(addr.campaign)) {
    return "invalid campaign slug"
  }
  if (!/^[a-z]{2}-[a-z]{2}$/.test(addr.market)) {
    return "invalid market code"
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(addr.product)) {
    return "invalid product slug"
  }
  if (!(addr.ratio in RATIO_ORDER)) {
    return "invalid ratio"
  }
  return null
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

/**
 * The repo-relative stored path — `outputs/{campaign}/{market}/{product}/{ratio}.png`.
 * This is what `creative.path` carries on the wire and on disk.
 */
export function repoRelativePath(addr: CreativeOutputAddress): string {
  return `outputs/${addr.campaign}/${addr.market}/${addr.product}/${addr.ratio}.png`
}

/**
 * The browser proxy URL — `/api/outputs/.../ratio.png`, percent-encoding
 * each segment. Centralizes what `buildCreativeProxyUrl` did today.
 */
export function proxyUrl(addr: CreativeOutputAddress): string {
  return `/api/outputs/${[
    addr.campaign,
    addr.market,
    addr.product,
    `${addr.ratio}.png`,
  ]
    .map((seg) => encodeURIComponent(seg))
    .join("/")}`
}

/**
 * The OS-absolute copy-path — used only by the server reveal/copy actions.
 * `outputsRoot` is the absolute path to the outputs directory on this OS.
 * The caller SHOULD still pass the result through `safeJoin` (the reveal
 * action does) for traversal defense; this projection only composes the
 * address onto the root.
 */
export function absolutePathOnFs(addr: CreativeOutputAddress, outputsRoot: string): string {
  const root = outputsRoot.replace(/[\\/]+$/, "")
  return `${root}/${addr.campaign}/${addr.market}/${addr.product}/${addr.ratio}.png`
}