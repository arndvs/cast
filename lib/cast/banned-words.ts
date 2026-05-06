/**
 * Banned-words helpers (D21, D29).
 *
 * D29 — referential identity: S1 (client) and `/api/generate` (server) MUST
 * import `containsBannedWord` from this same module. The V4 parity test
 * asserts `import.s1 === import.server`. Do not re-implement either side.
 *
 * Default list is the conservative POC seed; the brand profile's
 * `banned-words.json` is unioned in at the call site (V4 compliance stage).
 */

const DEFAULT_BANNED_WORDS: readonly string[] = Object.freeze([
  "guarantee",
  "miracle",
  "instant",
  "cure",
  "free",
])

/** Stable, deduped, lowercase default list. */
export function getDefaultBannedWords(): readonly string[] {
  return DEFAULT_BANNED_WORDS
}

/**
 * Whole-word, case-insensitive containment check.
 *
 * Matches on word boundaries so "energy" doesn't trigger on "energetic" — but
 * the runtime intentionally keeps the list short and literal; any nuance
 * (stems, locale-specific morphology) is the brand owner's problem.
 */
export function containsBannedWord(text: string, list: readonly string[]): string[] {
  if (!text) return []
  const haystack = text.toLowerCase()
  const hits: string[] = []
  for (const word of list) {
    const w = word.toLowerCase().trim()
    if (!w) continue
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`)
    if (re.test(haystack)) hits.push(w)
  }
  return hits
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
