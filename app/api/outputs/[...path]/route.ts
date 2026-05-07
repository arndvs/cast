import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import nodePath from "node:path"
import { safeJoin, PathTraversalError } from "@/lib/cast/server/safe-join"
import { isENOENT } from "@/lib/cast/server/api-helpers"

export const runtime = "nodejs"

/**
 * GET /api/outputs/[...path] — read-only proxy for `outputs/`.
 *
 * `outputs/` lives outside the static tree so the bundler doesn't ship every
 * prior run; this route is the only way the browser can pull a generated PNG.
 *
 * Hardening:
 *   - safeJoin against ROOTS.outputs (rejects `..`, absolute, null bytes)
 *   - .png whitelist — anything else 404s, never reveals MIME of other files
 *   - X-Content-Type-Options: nosniff so a malicious upstream can't trick
 *     the browser into rendering the bytes as HTML/JS
 *   - Cache-Control: no-store — `clearCampaignOutput` (lib/cast/server/
 *     storage.ts) wipes and rewrites outputs/[campaign]/ on each run, so the
 *     same URL can map to different bytes after a re-run. Without ETag/mtime
 *     revalidation, `immutable` would serve stale tiles for up to an hour.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params

  if (!Array.isArray(segments) || segments.length === 0) {
    return new NextResponse(null, { status: 404 })
  }

  // Whitelist: only .png leaves are served. Reject anything else before we
  // even hit the filesystem so we don't accidentally serve report.json etc.
  const last = segments[segments.length - 1]
  if (!last.toLowerCase().endsWith(".png")) {
    return new NextResponse(null, { status: 404 })
  }

  let resolved: string
  try {
    // TODO(symlink-hardening): re-validate with realpath before readFile.
    resolved = safeJoin("outputs", ...segments)
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return new NextResponse(null, { status: 404 })
    }
    throw err
  }

  // Defense in depth — safeJoin already rejected absolute/.. but extension
  // check ran on the raw segment. Re-check on the resolved path too.
  if (nodePath.extname(resolved).toLowerCase() !== ".png") {
    return new NextResponse(null, { status: 404 })
  }

  let bytes: Buffer
  try {
    bytes = await fs.readFile(resolved)
  } catch (err) {
    if (isENOENT(err)) {
      return new NextResponse(null, { status: 404 })
    }
    return new NextResponse(null, { status: 500 })
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}


