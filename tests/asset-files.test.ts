import { describe, expect, it } from "vitest"

import {
  ASSET_EXTS,
  ASSET_MIMES,
  assetAcceptMap,
  assetKeysFor,
  isSupportedMime,
  magicBytesMatch,
  mimeToExt,
} from "@/lib/cast/asset-files"

// Actual byte headers for the three formats.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
])

describe("mimeToExt", () => {
  it("maps every supported MIME to its canonical extension", () => {
    expect(mimeToExt("image/png")).toBe("png")
    expect(mimeToExt("image/jpeg")).toBe("jpg") // normalize-on-save
    expect(mimeToExt("image/webp")).toBe("webp")
  })

  it("round-trips every ASSET_MIMES", () => {
    for (const mime of ASSET_MIMES) {
      expect(mimeToExt(mime)).not.toBeNull()
    }
  })

  it("returns null for unsupported MIMEs", () => {
    expect(mimeToExt("image/gif")).toBeNull()
    expect(mimeToExt("image/jpg")).toBeNull() // non-canonical alias
    expect(mimeToExt("")).toBeNull()
  })
})

describe("isSupportedMime", () => {
  it("accepts the canonical set", () => {
    for (const mime of ASSET_MIMES) expect(isSupportedMime(mime)).toBe(true)
  })

  it("rejects anything outside it", () => {
    expect(isSupportedMime("image/gif")).toBe(false)
    expect(isSupportedMime("image/jpg")).toBe(false)
  })
})

describe("magicBytesMatch", () => {
  it("matches PNG magic bytes", () => {
    expect(magicBytesMatch(PNG, "image/png")).toBe(true)
  })

  it("matches JPEG magic bytes", () => {
    expect(magicBytesMatch(JPEG, "image/jpeg")).toBe(true)
  })

  it("matches WebP magic bytes", () => {
    expect(magicBytesMatch(WEBP, "image/webp")).toBe(true)
  })

  it("rejects mismatched bytes", () => {
    expect(magicBytesMatch(new Uint8Array([0x00, 0x01, 0x02]), "image/png")).toBe(false)
    expect(magicBytesMatch(JPEG, "image/png")).toBe(false)
    expect(magicBytesMatch(new Uint8Array([]), "image/jpeg")).toBe(false)
  })
})

describe("assetKeysFor", () => {
  it("yields every extension variant for a slug", () => {
    expect(assetKeysFor("brisa")).toEqual([
      "assets/brisa.png",
      "assets/brisa.jpg",
      "assets/brisa.jpeg",
      "assets/brisa.webp",
    ])
  })
})

describe("parity — client accept list vs server validation", () => {
  it("the dropzone accept map keys equal ASSET_MIMES", () => {
    expect(Object.keys(assetAcceptMap()).sort()).toEqual([...ASSET_MIMES].sort())
  })

  it("every accept-map entry's extensions resolve via ASSET_EXTS", () => {
    const flat = Object.values(assetAcceptMap()).flat().map((e) => e.replace(".", ""))
    for (const ext of flat) {
      expect(ASSET_EXTS).toContain(ext)
    }
  })

  it("every writeable extension is also discoverable", () => {
    // jpeg is discoverable on disk but uploads canonicalize to jpg — the
    // asymmetry is intentional (normalize-on-save), and every ext that a
    // canonical upload produces is in the discovery set.
    const writable = ASSET_MIMES.map((m) => mimeToExt(m)).filter(Boolean)
    for (const ext of writable) {
      expect(ASSET_EXTS).toContain(ext)
    }
  })
})