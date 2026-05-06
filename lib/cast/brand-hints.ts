/**
 * Canonical operator-facing hint copy for brand-load failures.
 *
 * Used by:
 *   - `app/api/generate` — appended to the JSON error body so API consumers
 *     get an actionable message instead of just the raw class message.
 *   - `components/cast/missing-brand-banner.tsx` — the editor banner that
 *     replaces the logo grid when a brand fails to load.
 *
 * Kept in a tiny standalone module so both the server route handler and the
 * UI component can import without pulling the full schema graph.
 */

import {
  BrandIncompleteError,
  BrandInvalidError,
  BrandNotFoundError,
} from "@/lib/cast/errors"
import type { BrandLoadError } from "@/lib/cast/server/brand-loader"

export const BRAND_HINTS = {
  notFound:
    "Add a fixture under `inputs/brands/<slug>/` (brand.json, voice.json, logos/logos.json, font.ttf|otf). See docs/brand-extraction.md.",
  incomplete:
    "Brand fixture is missing a required file. Each brand needs brand.json, voice.json, logos/logos.json, and font.ttf or font.otf.",
  invalid:
    "Brand fixture failed schema validation. Compare against docs/brand-extraction.md and fix the listed paths.",
} as const

/**
 * Map a thrown brand error to its canonical hint. Returns `null` for any
 * other error so callers can `?? defaultHint` or skip appending.
 */
export function brandHintFor(error: BrandLoadError): string {
  if (error instanceof BrandNotFoundError) return BRAND_HINTS.notFound
  if (error instanceof BrandIncompleteError) return BRAND_HINTS.incomplete
  if (error instanceof BrandInvalidError) return BRAND_HINTS.invalid
  // Exhaustiveness check — BrandLoadError is a closed union.
  const _exhaustive: never = error
  void _exhaustive
  return BRAND_HINTS.invalid
}
