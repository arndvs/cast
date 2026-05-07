/**
 * Market catalog used by the brief editor typeahead and locale derivation.
 *
 * The schema only enforces the `xx-yy` shape — this
 * list is editorial (which markets are *suggested* in the typeahead).
 */

export interface Market {
  /** `<region>-<lang>`, lowercase, matches `MARKET_RE`. */
  code: string
  /** Display name shown in the typeahead. */
  name: string
  /** Two-letter language tag — the key under `brief.message`. */
  language: string
}

export const ALL_MARKETS: readonly Market[] = Object.freeze([
  { code: "us-en", name: "United States · English", language: "en" },
  { code: "mx-es", name: "Mexico · Spanish", language: "es" },
  { code: "de-de", name: "Germany · German", language: "de" },
  { code: "fr-fr", name: "France · French", language: "fr" },
  { code: "br-pt", name: "Brazil · Portuguese", language: "pt" },
])

export function getMarket(code: string): Market | undefined {
  return ALL_MARKETS.find((m) => m.code === code)
}

/**
 * Active languages for a set of markets, in order of first appearance, deduped.
 * Used by the brief editor to render one headline row per language.
 *
 * `MARKET_RE` lets users add custom markets the catalog doesn't know about
 * (e.g. `jp-ja`); we still need a headline row for those, so fall back to the
 * locale suffix when the catalog has no entry.
 */
export function activeLanguages(marketCodes: readonly string[]): Market[] {
  const seen = new Set<string>()
  const out: Market[] = []
  for (const code of marketCodes) {
    const m = getMarket(code) ?? syntheticMarket(code)
    if (m && !seen.has(m.language)) {
      seen.add(m.language)
      out.push(m)
    }
  }
  return out
}

function syntheticMarket(code: string): Market | undefined {
  const lang = code.split("-").pop()
  if (!lang) return undefined
  return { code, name: code, language: lang }
}
