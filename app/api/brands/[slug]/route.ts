import { NextResponse } from "next/server"
import { loadBrandProfile } from "@/lib/cast/server/brand-loader"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"

export const runtime = "nodejs"

/**
 * GET /api/brands/[slug] — return the validated profile for one brand.
 *
 * Response shape (per flow-diagrams §4.3):
 *   {
 *     slug, displayName, colors, voice, bannedWords,
 *     logos: { default, variants: [{ id, displayName, url }] }
 *   }
 *
 * Logo `url` points at the proxy (`/api/brands/[slug]/logos/[id]`); the
 * absolute filesystem path stays server-side.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params
  try {
    const profile = await loadBrandProfile(slug)
    return NextResponse.json(
      {
        slug: profile.slug,
        displayName: profile.brand.displayName,
        colors: profile.brand.colors,
        tokens: profile.brand.tokens,
        voice: profile.voice,
        bannedWords: profile.bannedWords,
        logos: {
          default: profile.defaultLogoId,
          variants: profile.logoVariants.map((v) => ({
            id: v.id,
            displayName: v.displayName,
            theme: v.theme,
            url: `/api/brands/${profile.slug}/logos/${v.id}`,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    if (err instanceof BrandNotFoundError) {
      return NextResponse.json(
        { errors: [{ path: ["brand"], message: err.message }] },
        { status: 404 },
      )
    }
    if (err instanceof BrandIncompleteError) {
      return NextResponse.json(
        {
          errors: [
            { path: ["brand", err.missing], message: err.message },
          ],
        },
        { status: 400 },
      )
    }
    if (err instanceof BrandInvalidError) {
      return NextResponse.json(
        {
          errors: err.issues.map((i) => ({
            path: ["brand", err.file, ...i.path],
            message: i.message,
          })),
        },
        { status: 400 },
      )
    }
    throw err
  }
}
