import { NextResponse } from "next/server"
import { detectAssetFiles } from "@/lib/cast/server/storage"
import { SLUG_RE } from "@/lib/cast/schemas"

export const runtime = "nodejs"

/**
 * GET /api/detected-assets?slugs=brisa-citrus,brisa-berry
 *
 * Returns [{ slug, foundFile | null }] for the Detected Assets panel.
 * Resolver lookup order: png, jpg, jpeg, webp (first hit wins).
 *
 * Every slug is SLUG_RE-validated before any filesystem call. Lookups go
 * through the StorageAdapter via `detectAssetFiles`.
 */

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const slugsParam = url.searchParams.get("slugs") ?? ""
  const slugs = slugsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  for (const slug of slugs) {
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        {
          errors: [
            {
              path: ["slugs"],
              message: `invalid slug: "${slug}" must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
            },
          ],
        },
        { status: 400 },
      )
    }
  }

  const results = await detectAssetFiles(slugs)

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  })
}


