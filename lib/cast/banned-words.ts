/**
 * Banned-words helpers — shared between client (inline badge) and server (compliance).
 *
 * Referential identity: client and server MUST import `containsBannedWord` from this same
 * module. The parity test asserts referential identity. Do not
 * re-implement substring matching, normalization, or list composition
 * anywhere else.
 *
 * `getDefaultBannedWords()` is the universal floor (violence, hate, NSFW,
 * weapons, drugs, self-harm). Brand-specific terms in
 * `inputs/brands/[brand]/banned-words.json` are unioned in by the brand
 * loader; defaults always apply.
 */

const DEFAULT_BANNED_WORDS: readonly string[] = Object.freeze([
  // Violence / harm
  "murder",
  "kill",
  "assault",
  "torture",
  "gore",
  "mutilate",
  "dismember",
  "decapitate",
  "slaughter",
  "massacre",
  "genocide",
  // Hate speech
  "nazi",
  "swastika",
  "white supremacy",
  "ethnic cleansing",
  // Sexual / explicit
  "pornography",
  "nude",
  "naked",
  "explicit",
  "nsfw",
  "hentai",
  // Weapons / drugs
  "bomb",
  "explosive",
  "meth",
  "cocaine",
  "heroin",
  "fentanyl",
  // Self-harm
  "suicide",
  "self-harm",
  "cutting",
])

/** Frozen, deduped, lowercase universal floor. */
export function getDefaultBannedWords(): readonly string[] {
  return DEFAULT_BANNED_WORDS
}

/**
 * Return every banned-list term that appears in `text`.
 *
 * - Pure-word terms (`/^\w+$/`) match on word boundaries so "skill"
 *   doesn't match "kill".
 * - Anything else (phrases with spaces, hyphenated terms like "self-harm",
 *   anything containing punctuation) matches as an escaped substring —
 *   `\b` doesn't compose cleanly across non-word characters.
 * - Case-insensitive throughout. Empty/whitespace list entries are skipped.
 *
 * Returns `[]` when nothing matches; never throws.
 */
export function containsBannedWord(
  text: string,
  list: readonly string[],
): string[] {
  if (!text) return []
  const hits: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const word = raw.toLowerCase().trim()
    if (!word || seen.has(word)) continue
    seen.add(word)
    if (buildMatcher(word).test(text)) hits.push(word)
  }
  return hits
}

function buildMatcher(word: string): RegExp {
  // Word boundaries only behave intuitively when the term is purely word
  // characters. Hyphens, spaces, and other punctuation create a non-word →
  // word transition that confuses `\b`, so fall back to escaped substring.
  if (/^\w+$/.test(word)) {
    return new RegExp(`\\b${escapeRegex(word)}\\b`, "i")
  }
  return new RegExp(escapeRegex(word), "i")
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
