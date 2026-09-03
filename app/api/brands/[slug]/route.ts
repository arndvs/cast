import { NextResponse } from "next/server"
import { loadBrandProfile } from "@/lib/cast/server/brand-loader"
import { brandLoadErrorToResponse } from "@/lib/cast/brand-hints"

export const runtime = "nodejs"

/**
 * GET /api/brands/[slug] — return the validated profile for one brand.
 *
 * Response shape (per flow-diagrams §4.3):
 *   {
 *     slug, displayName, colors, tokens, voice, bannedWords,
 *     logos: {
 *       default,
 *       variants: [{ id, displayName, theme?: "light" | "dark", url }]
 *     }
 *   }
 *
 * `theme` is optional (declared per-variant in `logos.json`) and drives the
 * editor's swatch background. Logo `url` points at the proxy
 * (`/api/brands/[slug]/logos/[id]`); the absolute filesystem path stays
 * server-side.
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
    // Single mapper centralizes the error-kind → status mapping; this route
    // keeps its `kind`-tagged envelope (with `errors` list) byte-identical.
    const { status, body } = brandLoadErrorToResponse(err)
    if (body.kind === "notFound") {
      return NextResponse.json(
        { kind: "notFound", errors: [{ path: ["brand"], message: body.message }] },
        { status },
      )
    }
    if (body.kind === "incomplete") {
      return NextResponse.json(
        {
          kind: "incomplete",
          missing: body.missing,
          errors: [{ path: ["brand", body.missing], message: body.message }],
        },
        { status },
      )
    }
    return NextResponse.json(
      {
        kind: "invalid",
        file: body.file,
        errors: body.issues.map((i) => ({
          path: ["brand", body.file, ...i.path],
          message: i.message,
        })),
      },
      { status },
    )
  }
}
