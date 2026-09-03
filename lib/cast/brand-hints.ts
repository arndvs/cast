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
 * Serialization-safe descriptor for a brand-load failure. The thrown
 * `BrandLoadError` instances carry runtime-only state (Error stack, class
 * identity) that React refuses to serialize across the server→client
 * boundary; this is the plain-object shape the banner consumes.
 */
export type BrandLoadErrorInfo =
  | { kind: "notFound"; slug: string; message: string }
  | { kind: "incomplete"; slug: string; message: string; missing: string }
  | {
      kind: "invalid"
      slug: string
      message: string
      file: string
      issues: { path: (string | number)[]; message: string }[]
    }

export function toBrandLoadErrorInfo(error: BrandLoadError): BrandLoadErrorInfo {
  if (error instanceof BrandNotFoundError) {
    return { kind: "notFound", slug: error.slug, message: error.message }
  }
  if (error instanceof BrandIncompleteError) {
    return {
      kind: "incomplete",
      slug: error.slug,
      message: error.message,
      missing: error.missing,
    }
  }
  if (error instanceof BrandInvalidError) {
    return {
      kind: "invalid",
      slug: error.slug,
      message: error.message,
      file: error.file,
      issues: error.issues,
    }
  }
  const _exhaustive: never = error
  void _exhaustive
  throw new Error("unreachable")
}

/**
 * Map a thrown brand-load error to its HTTP status + canonical body.
 *
 * The single named helper every brand-facing route calls instead of hand-
 * writing an `instanceof BrandXError` cascade. Body is the `kind`-tagged
 * `BrandLoadErrorInfo` union so the wire contract is one discriminated shape
 * (what the missing-brand banner already consumes):
 *   - notFound    → 404
 *   - incomplete  → 400
 *   - invalid     → 400
 *
 * Accepts `unknown` so routes can pass the raw catch-bind directly; any
 * non-brand error is rethrown so unrelated failures aren't swallowed.
 */
export function brandLoadErrorToResponse(error: unknown): {
  status: number
  body: BrandLoadErrorInfo
} {
  if (
    !(
      error instanceof BrandNotFoundError ||
      error instanceof BrandIncompleteError ||
      error instanceof BrandInvalidError
    )
  ) {
    throw error
  }
  const info = toBrandLoadErrorInfo(error)
  const status = info.kind === "notFound" ? 404 : 400
  return { status, body: info }
}
