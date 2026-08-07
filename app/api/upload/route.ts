import { NextResponse } from "next/server"
import { saveAssetFile } from "@/lib/cast/server/storage"
import { jsonError } from "@/lib/cast/server/api-helpers"
import { magicBytesMatch } from "@/lib/cast/server/magic-bytes"
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_DISPLAY } from "@/lib/cast/upload-constraints"
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
    return jsonError(413, [{ path: ["file"], message: `file exceeds ${UPLOAD_MAX_DISPLAY} limit` }])
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
    return jsonError(413, [{ path: ["file"], message: `file exceeds ${UPLOAD_MAX_DISPLAY} limit` }])
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
    return jsonError(413, [{ path: ["file"], message: `file exceeds ${UPLOAD_MAX_DISPLAY} limit` }])
  }

  // Defense-in-depth: file.type comes from the user-supplied multipart header
  // and can be spoofed. Verify the leading bytes match the declared MIME so a
  // browser-trusted .png header can't smuggle non-image content into inputs/.
  if (!magicBytesMatch(bytes, mime)) {
    return jsonError(415, [
      { path: ["file"], message: `file contents do not match declared MIME "${mime}"` },
    ])
  }

  // Save via StorageAdapter — deletes any existing variant, then writes the new file.
  const savedAs = await saveAssetFile(productSlug, ext, bytes)

  return NextResponse.json(
    {
      ok: true,
      productSlug,
      savedAs,
      size: bytes.byteLength,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
