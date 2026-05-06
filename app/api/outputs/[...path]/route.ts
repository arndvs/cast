import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import nodePath from "node:path"
import { safeJoin, PathTraversalError } from "@/lib/cast/server/safe-join"

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
 *   - Cache-Control: public, max-age=3600, immutable — outputs are
 *     write-once-per-run; campaign slug + ratio is the cache key
 *
 * TODO(symlink-hardening): re-validate the resolved path with realpath.
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
      "Cache-Control": "public, max-age=3600, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}
