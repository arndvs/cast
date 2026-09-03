import type { AspectRatio } from "@/lib/cast/schemas"
import { proxyUrl as addressProxyUrl } from "@/lib/cast/creative-output-address"

/**
 * Build the proxy URL used by the tile and detail dialog to display a
 * generated creative. Each segment is percent-encoded so the resulting
 * path is safe for use as an <img> `src`.
 *
 * Delegates to the canonical `proxyUrl` projection in
 * `creative-output-address.ts` so every surface derives the same address.
 */
export function buildCreativeProxyUrl(
  campaign: string,
  market: string,
  product: string,
  ratio: AspectRatio,
): string {
  return addressProxyUrl({ campaign, market, product, ratio })
}
