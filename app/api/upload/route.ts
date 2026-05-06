import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import { safeJoin } from "@/lib/cast/server/safe-join"
import { SLUG_RE } from "@/lib/cast/schemas"

/**
 * POST /api/upload — multipart upload of a product photo (D4, D5, D26).
 *
 * Constraints (per flow-diagrams §4.2):
 *   - productSlug must match SLUG_RE → 400
 *   - Content-Length ≤ 5 MB → 413 (also enforced via final byte count)
 *   - MIME ∈ {image/png, image/jpeg, image/webp} → 415
 *   - Animated formats (gif/mp4/webm) → 415
 *   - Extension is canonical-mapped from MIME (png→.png, jpeg→.jpg, webp→.webp)
 *   - Delete-then-write any existing inputs/assets/[slug].{png,jpg,jpeg,webp}
 *     so one slug owns one file at a time.
 */

const MAX_BYTES = 5 * 1024 * 1024
const MIME_TO_EXT: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const ALL_EXTS = ["png", "jpg", "jpeg", "webp"] as const

export async function POST(req: Request): Promise<NextResponse> {
  const declared = req.headers.get("content-length")
  if (declared && Number(declared) > MAX_BYTES) {
    return jsonError(413, [{ path: ["file"], message: "file exceeds 5 MB limit" }])
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonError(400, [{ path: [], message: "invalid multipart body" }])
  }

  const productSlug = form.get("productSlug")
  const file = form.get("file")

  if (typeof productSlug !== "string" || !SLUG_RE.test(productSlug)) {
    return jsonError(400, [
      { path: ["productSlug"], message: "productSlug must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/" },
    ])
  }
  if (!(file instanceof File)) {
    return jsonError(400, [{ path: ["file"], message: "file is required" }])
  }
  if (file.size > MAX_BYTES) {
    return jsonError(413, [{ path: ["file"], message: "file exceeds 5 MB limit" }])
  }

  const mime = (file.type || "").toLowerCase()
  const ext = MIME_TO_EXT[mime]
  if (!ext) {
    return jsonError(415, [
      {
        path: ["file"],
        message: `unsupported MIME "${mime}" — allowed: image/png, image/jpeg, image/webp`,
      },
    ])
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) {
    return jsonError(413, [{ path: ["file"], message: "file exceeds 5 MB limit" }])
  }

  // Ensure inputs/assets/ exists.
  // TODO(symlink-hardening): re-validate assetsDir with realpath
  const assetsDir = safeJoin("inputs", "assets")
  await fs.mkdir(assetsDir, { recursive: true })

  // Delete-then-write: clear any existing variant for this slug.
  for (const e of ALL_EXTS) {
    // TODO(symlink-hardening): re-validate with realpath
    const existing = safeJoin("inputs", "assets", `${productSlug}.${e}`)
    try {
      await fs.unlink(existing)
    } catch (err) {
      if (!isENOENT(err)) throw err
    }
  }

  // TODO(symlink-hardening): re-validate target with realpath
  const target = safeJoin("inputs", "assets", `${productSlug}.${ext}`)
  await fs.writeFile(target, bytes)

  return NextResponse.json(
    {
      ok: true,
      productSlug,
      savedAs: `inputs/assets/${productSlug}.${ext}`,
      size: bytes.byteLength,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

function jsonError(
  status: number,
  errors: { path: (string | number)[]; message: string }[],
): NextResponse {
  return NextResponse.json({ errors }, { status })
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  )
}
