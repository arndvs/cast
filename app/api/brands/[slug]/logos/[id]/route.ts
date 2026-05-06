import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import { loadBrandProfile } from "@/lib/cast/server/brand-loader"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"

export const runtime = "nodejs"

/**
 * GET /api/brands/[slug]/logos/[id] — safeJoin proxy for a logo PNG.
 *
 * `inputs/` is NOT exposed as a static tree (per system-map). Every byte of
 * brand-owned imagery passes through this handler so paths can be validated
 * against the brand profile's declared variants list and the safeJoin guard.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse | Response> {
  const { slug, id } = await params

  let profile
  try {
    profile = await loadBrandProfile(slug)
  } catch (err) {
    if (err instanceof BrandNotFoundError) {
      return NextResponse.json(
        { errors: [{ path: ["brand"], message: err.message }] },
        { status: 404 },
      )
    }
    if (err instanceof BrandIncompleteError || err instanceof BrandInvalidError) {
      return NextResponse.json(
        { errors: [{ path: ["brand"], message: err.message }] },
        { status: 400 },
      )
    }
    throw err
  }

  // Variant id must match a declared variant — defense-in-depth on top of safeJoin.
  const variant = profile.logoVariants.find((v) => v.id === id)
  if (!variant) {
    return NextResponse.json(
      { errors: [{ path: ["logo", id], message: `unknown logo variant: ${id}` }] },
      { status: 404 },
    )
  }

  // TODO(symlink-hardening): variant.path was safeJoin-validated by the loader;
  // re-validate with realpath when production hardening lands.
  const buf = await fs.readFile(variant.path)
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
