import { NextResponse } from "next/server"
import { listBrandSlugs, loadBrandProfile } from "@/lib/cast/server/brand-loader"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"

export const runtime = "nodejs"

/**
 * GET /api/brands — enumerate brand profiles under inputs/brands/.
 *
 * For each directory whose name matches SLUG_RE, attempts to load the profile.
 * Directories that are missing required files (BrandIncomplete) or have
 * invalid JSON / schema (BrandInvalid) are silently skipped — they'd surface
 * as a 4xx response if a user actually selected them via /api/brands/[slug].
 *
 * Response: [{ slug, displayName }]
 */
export async function GET(): Promise<NextResponse> {
  const slugs = await listBrandSlugs()
  const results: { slug: string; displayName: string }[] = []
  for (const slug of slugs) {
    try {
      const profile = await loadBrandProfile(slug)
      results.push({ slug, displayName: profile.brand.displayName })
    } catch (err) {
      if (
        err instanceof BrandNotFoundError ||
        err instanceof BrandIncompleteError ||
        err instanceof BrandInvalidError
      ) {
        // skip — not a valid brand profile
        continue
      }
      throw err
    }
  }
  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  })
}
