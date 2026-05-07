/**
 * Build the proxy URL used by the tile and detail dialog to display a
 * generated creative. Each segment is percent-encoded so the resulting
 * path is safe for use as an <img> `src`.
 */
export function buildCreativeProxyUrl(
  campaign: string,
  market: string,
  product: string,
  ratio: string,
): string {
  return `/api/outputs/${encodeURIComponent(campaign)}/${encodeURIComponent(
    market,
  )}/${encodeURIComponent(product)}/${ratio}.png`
}
