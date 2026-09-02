/**
 * Asset-file format contract — single source of truth for the accepted
 * product-asset formats, their MIME↔extension mapping, and magic-byte
 * validation.
 *
 * Previously the same closed set (`image/png | image/jpeg | image/webp`) was
 * re-declared in four places — `storage.ts` (ext set + AssetExt type),
 * `upload/route.ts` (MIME_TO_EXT), `magic-bytes.ts` (byte signatures), and
 * `dropzone.tsx` (client accept list) — each of which could drift silently.
 *
 * Client-safe: no node deps, no zod. Both the server upload path and the
 * client dropzone derive from this one module.
 */

// ---------------------------------------------------------------------------
// Canonical format set
// ---------------------------------------------------------------------------

/** Closed, ordered set of accepted asset MIME types. */
export const ASSET_MIMES = ["image/png", "image/jpeg", "image/webp"] as const
export type AssetMime = (typeof ASSET_MIMES)[number]

/**
 * Canonical extensions, in discovery priority order. `jpeg` is included for
 * disk discovery (an uploaded `.jpg` normalizes to `.jpg`, but a `.jpeg`
 * already on disk remains findable and deletable).
 */
export const ASSET_EXTS = ["png", "jpg", "jpeg", "webp"] as const
export type AssetExt = (typeof ASSET_EXTS)[number]

// ---------------------------------------------------------------------------
// MIME ↔ extension mapping
// ---------------------------------------------------------------------------

const MIME_TO_EXT: Record<AssetMime, AssetExt> = {
  "image/png": "png",
  "image/jpeg": "jpg", // uploads canonicalize jpeg → jpg
  "image/webp": "webp",
}

export function isSupportedMime(mime: string): mime is AssetMime {
  return (ASSET_MIMES as readonly string[]).includes(mime)
}

/**
 * Canonical extension for a MIME — the single answer to "which filename
 * extension an upload becomes". `image/jpeg` maps to `jpg` (normalize-on-save);
 * `image/jpg` is not a valid MIME and returns `null`.
 */
export function mimeToExt(mime: string): AssetExt | null {
  return isSupportedMime(mime) ? MIME_TO_EXT[mime] : null
}

// ---------------------------------------------------------------------------
// Magic-byte validation
// ---------------------------------------------------------------------------

/**
 * Verify the leading bytes of `bytes` match the declared `mime`.
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - WebP: "RIFF" .... "WEBP"
 */
export function magicBytesMatch(bytes: Uint8Array, mime: string): boolean {
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

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Every `assets/[slug].{ext}` key variant for a product slug — the set
 * `saveAssetFile`'s delete-all loop and `findLocalAsset`'s discovery share.
 * Keeps the "one slug owns one input file" invariant beside the format
 * definitions.
 */
export function assetKeysFor(productSlug: string): string[] {
  return ASSET_EXTS.map((ext) => `assets/${productSlug}.${ext}`)
}

// ---------------------------------------------------------------------------
// Dropzone accept map
// ---------------------------------------------------------------------------

/**
 * react-dropzone `accept` object — MIME → extension list, derived from the
 * canonical format set. The client file-picker's accept list and the server
 * upload validation key off the same constants, so "client accepts what the
 * server rejects" can't happen for a format in this module.
 */
export function assetAcceptMap(): Record<string, string[]> {
  return {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
  }
}