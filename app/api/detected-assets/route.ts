import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import { safeJoin } from "@/lib/cast/server/safe-join"
import { isENOENT } from "@/lib/cast/server/api-helpers"
import { SLUG_RE } from "@/lib/cast/schemas"

export const runtime = "nodejs"

/**
 * GET /api/detected-assets?slugs=brisa-citrus,brisa-berry
 *
 * Returns [{ slug, foundFile | null }] for the Detected Assets panel.
 * Resolver lookup order: png, jpg, jpeg, webp (first hit wins).
 *
 * Every slug is SLUG_RE-validated before any filesystem call. Lookups go
 * through safeJoin('inputs', 'assets', ...).
 */

const LOOKUP_ORDER = ["png", "jpg", "jpeg", "webp"] as const

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

  const results: { slug: string; foundFile: string | null }[] = []
  for (const slug of slugs) {
    let found: string | null = null
    for (const ext of LOOKUP_ORDER) {
      // TODO(symlink-hardening): re-validate with realpath
      const candidate = safeJoin("inputs", "assets", `${slug}.${ext}`)
      try {
        await fs.access(candidate)
        found = `${slug}.${ext}`
        break
      } catch (err) {
        if (!isENOENT(err)) throw err
        // miss — try next ext
      }
    }
    results.push({ slug, foundFile: found })
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  })
}


