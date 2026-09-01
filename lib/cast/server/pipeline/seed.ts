/**
 * Deterministic seeds (S4) — ported from MCRDSE-Content-Ship's `seed.mjs`.
 *
 * Derive a stable 31-bit seed from the prompt + ratio so the same brief
 * reproduces the same images in default (dall-e-3) mode. gpt-image-1
 * (cheap mode) ignores seeds, so the caller must not send one there.
 */

/**
 * DJB2-style hash → positive 31-bit integer.
 * Same algorithm MCRDSE uses (`seed.mjs`), extended to accept multiple
 * parts so prompt + ratio join the key.
 */
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return (h & 0x7fffffff) >>> 0
}

/**
 * Derive a deterministic seed for image generation.
 * @param parts  components of the seed key (e.g. prompt, ratio)
 * @returns positive 31-bit integer
 */
export function deriveSeed(...parts: string[]): number {
  return hash(parts.join("|") + "|")
}

/**
 * Convenience: the seed for a (prompt, ratio) slot.
 */
export function seedForSlot(prompt: string, ratio: string): number {
  return deriveSeed(prompt, ratio)
}