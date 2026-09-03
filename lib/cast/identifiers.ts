/**
 * Pure identifiers and format constants — zero dependencies.
 *
 * Hoisted out of `schemas.ts` so client-only modules (reducers, status
 * derivations) can import `slugify` and the regexes without pulling `zod`
 * into their bundle. `schemas.ts` re-exports everything here, so existing
 * server-side imports are unaffected.
 */

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MARKET_RE = /^[a-z]{2}-[a-z]{2}$/ // <region>-<lang>, e.g. us-en
export const HEX_RE = /^#[0-9a-fA-F]{6}$/

// ---------------------------------------------------------------------------
// Aspect ratio — plain const + type (no zod)
// ---------------------------------------------------------------------------

export const ALL_RATIOS = ["1x1", "9x16", "16x9"] as const
export type AspectRatio = (typeof ALL_RATIOS)[number]

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

/**
 * Same `slugify` shape used by `/api/upload` and the Asset Resolver:
 * lowercase, non-alphanumeric runs collapsed to `-`, leading/trailing `-`
 * stripped. One implementation, one import path.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}