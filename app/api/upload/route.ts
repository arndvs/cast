import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import { safeJoin } from "@/lib/cast/server/safe-join"
import { isENOENT, jsonError } from "@/lib/cast/server/api-helpers"
import { UPLOAD_MAX_BYTES } from "@/lib/cast/upload-constraints"
import { SLUG_RE } from "@/lib/cast/schemas"

export const runtime = "nodejs"

/**
 * POST /api/upload — multipart upload of a product photo.
 *
 * Constraints (per flow-diagrams §4.2):
 *   - productSlug must match SLUG_RE → 400
 *   - Content-Length header is required and must be ≤ 5 MB → 411 / 413
 *   - MIME ∈ {image/png, image/jpeg, image/webp} → 415
 *   - Magic bytes must match the declared MIME → 415
 *   - Animated formats (gif/mp4/webm) → 415
 *   - Extension is canonical-mapped from MIME (png→.png, jpeg→.jpg, webp→.webp)
 *   - Delete-then-write any existing inputs/assets/[slug].{png,jpg,jpeg,webp}
 *     so one slug owns one file at a time.
 */

const MIME_TO_EXT: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const ALL_EXTS = ["png", "jpg", "jpeg", "webp"] as const

export async function POST(req: Request): Promise<NextResponse> {
  // Require Content-Length so we can short-circuit oversize bodies before
  // formData() buffers the whole request. Parse strictly: only a non-negative
  // base-10 integer is accepted. `Number("1.5")` and `Number("1e6")` would
  // otherwise sneak past `Number.isFinite` and either misreport the size or
  // overflow the comparison. Missing or malformed → 411.
  const declared = req.headers.get("content-length")
  if (declared === null || !/^\d+$/.test(declared)) {
    return jsonError(411, [
      {
        path: ["content-length"],
        message: "Content-Length header is missing or invalid",
      },
    ])
  }
  const declaredBytes = Number(declared)
  if (!Number.isSafeInteger(declaredBytes)) {
    return jsonError(411, [
      {
        path: ["content-length"],
        message: "Content-Length header is missing or invalid",
      },
    ])
  }
  if (declaredBytes > UPLOAD_MAX_BYTES) {
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
  if (file.size > UPLOAD_MAX_BYTES) {
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
  if (bytes.byteLength > UPLOAD_MAX_BYTES) {
    return jsonError(413, [{ path: ["file"], message: "file exceeds 5 MB limit" }])
  }

  // Defense-in-depth: file.type comes from the user-supplied multipart header
  // and can be spoofed. Verify the leading bytes match the declared MIME so a
  // browser-trusted .png header can't smuggle non-image content into inputs/.
  if (!magicBytesMatch(bytes, mime)) {
    return jsonError(415, [
      { path: ["file"], message: `file contents do not match declared MIME "${mime}"` },
    ])
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



/**
 * Verify the leading bytes of `bytes` match the declared `mime`.
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - WebP: "RIFF" .... "WEBP"
 */
function magicBytesMatch(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }
  if (mime === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
  }
  if (mime === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 //   P
    )
  }
  return false
}
