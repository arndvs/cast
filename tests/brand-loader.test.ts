import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { StorageAdapter } from "@/lib/cast/server/storage-adapter"

// Mock getStorageAdapter to return a controllable adapter.
const mockAdapter: {
  readFile: ReturnType<typeof vi.fn>
  fileExists: ReturnType<typeof vi.fn>
  listFiles: ReturnType<typeof vi.fn>
  writeFile: ReturnType<typeof vi.fn>
  deleteFile: ReturnType<typeof vi.fn>
  deletePrefix: ReturnType<typeof vi.fn>
  getPublicUrl: ReturnType<typeof vi.fn>
} = {
  readFile: vi.fn(),
  fileExists: vi.fn(),
  listFiles: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  deletePrefix: vi.fn(),
  getPublicUrl: vi.fn(),
}

vi.mock("@/lib/cast/server/storage-adapter", () => ({
  getStorageAdapter: vi.fn(async () => mockAdapter as unknown as StorageAdapter),
}))

import {
  loadBrandProfile,
  listBrandSlugs,
  tryLoadBrand,
  _clearBrandCache,
  _resetBrandWarnings,
} from "@/lib/cast/server/brand-loader"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"

const VALID_BRAND = {
  displayName: "Acme",
  colors: { primary: "#000000", accent: "#ff00ff" },
  tokens: { headlineFont: "font.ttf" },
}
const VALID_VOICE = {
  tone: "confident",
  do: ["be bold"],
  dont: ["hedge"],
  promptFragments: [],
}
const VALID_LOGOS = {
  default: "primary",
  variants: [
    { id: "primary", displayName: "Primary", file: "primary.png" },
  ],
}

function enoent(): NodeJS.ErrnoException {
  const err = new Error("ENOENT") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

function mountValidBrandFixture(slug = "acme"): void {
  mockAdapter.fileExists.mockImplementation(async (_c: string, key: string) => {
    // brand.json existence check (brand dir proxy) + font + logo variants
    if (key === `brands/${slug}/brand.json`) return true
    if (key === `brands/${slug}/font.ttf`) return true
    if (key === `brands/${slug}/logos/primary.png`) return true
    return false
  })
  mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
    if (key === `brands/${slug}/brand.json`) return Buffer.from(JSON.stringify(VALID_BRAND))
    if (key === `brands/${slug}/voice.json`) return Buffer.from(JSON.stringify(VALID_VOICE))
    if (key === `brands/${slug}/logos/logos.json`) return Buffer.from(JSON.stringify(VALID_LOGOS))
    if (key === `brands/${slug}/banned-words.json`) throw enoent()
    if (key === `brands/${slug}/products.json`) throw enoent()
    if (key === `brands/${slug}/backgrounds.json`) throw enoent()
    throw enoent()
  })
}

beforeEach(() => {
  _clearBrandCache()
  _resetBrandWarnings()
  mockAdapter.readFile.mockReset()
  mockAdapter.fileExists.mockReset()
  mockAdapter.listFiles.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("loadBrandProfile", () => {
  it("rejects slugs that fail SLUG_RE", async () => {
    await expect(loadBrandProfile("INVALID_SLUG!")).rejects.toBeInstanceOf(
      BrandNotFoundError,
    )
  })

  it("throws BrandNotFoundError when brand dir is missing", async () => {
    mockAdapter.fileExists.mockResolvedValue(false)
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(BrandNotFoundError)
  })

  it("throws BrandIncompleteError when a required file is missing", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/voice.json") throw enoent()
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      throw enoent()
    })
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(
      BrandIncompleteError,
    )
  })

  it("throws BrandInvalidError on JSON parse failure", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockResolvedValue(Buffer.from("{ this is not json"))
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(BrandInvalidError)
  })

  it("loads a valid profile and unions defaults into bannedWords", async () => {
    mountValidBrandFixture()
    const profile = await loadBrandProfile("acme")
    expect(profile.slug).toBe("acme")
    expect(profile.brand.displayName).toBe("Acme")
    expect(profile.bannedWords).toContain("kill") // from defaults
    expect(profile.logoVariants).toHaveLength(1)
    expect(profile.defaultLogoId).toBe("primary")
  })

  it("returns the cached profile on a second call within TTL", async () => {
    mountValidBrandFixture()
    const a = await loadBrandProfile("acme")
    const readsAfterFirst = mockAdapter.readFile.mock.calls.length
    const b = await loadBrandProfile("acme")
    expect(b).toBe(a) // referentially identical → from cache
    expect(mockAdapter.readFile.mock.calls.length).toBe(readsAfterFirst)
  })

  it("re-reads after TTL expiry (90 s)", async () => {
    vi.useFakeTimers()
    mountValidBrandFixture()
    await loadBrandProfile("acme")
    const readsAfterFirst = mockAdapter.readFile.mock.calls.length
    vi.advanceTimersByTime(90_001)
    await loadBrandProfile("acme")
    expect(mockAdapter.readFile.mock.calls.length).toBeGreaterThan(readsAfterFirst)
  })

  it("re-reads after _clearBrandCache()", async () => {
    mountValidBrandFixture()
    await loadBrandProfile("acme")
    const readsAfterFirst = mockAdapter.readFile.mock.calls.length
    _clearBrandCache()
    await loadBrandProfile("acme")
    expect(mockAdapter.readFile.mock.calls.length).toBeGreaterThan(readsAfterFirst)
  })

  it("accepts font.otf when font.ttf is absent", async () => {
    mockAdapter.fileExists.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/font.ttf") return false
      return true
    })
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/voice.json") return Buffer.from(JSON.stringify(VALID_VOICE))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      if (key === "brands/acme/banned-words.json") throw enoent()
      if (key === "brands/acme/products.json") throw enoent()
      if (key === "brands/acme/backgrounds.json") throw enoent()
      throw enoent()
    })
    const profile = await loadBrandProfile("acme")
    expect(profile.fontPath).toBe("brands/acme/font.otf")
  })

  it("throws BrandIncompleteError when neither font.ttf nor font.otf exists", async () => {
    mockAdapter.fileExists.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/font.ttf") return false
      if (key === "brands/acme/font.otf") return false
      return true
    })
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/voice.json") return Buffer.from(JSON.stringify(VALID_VOICE))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      if (key === "brands/acme/banned-words.json") throw enoent()
      if (key === "brands/acme/products.json") throw enoent()
      if (key === "brands/acme/backgrounds.json") throw enoent()
      throw enoent()
    })
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(
      BrandIncompleteError,
    )
  })
})

describe("listBrandSlugs", () => {
  it("returns sorted slugs that match SLUG_RE", async () => {
    mockAdapter.listFiles.mockResolvedValue([
      "brands/zeta/brand.json",
      "brands/alpha/brand.json",
      "brands/INVALID/brand.json", // fails SLUG_RE
    ])
    const slugs = await listBrandSlugs()
    expect(slugs).toEqual(["alpha", "zeta"])
  })

  it("returns [] when inputs/brands/ is missing (empty listFiles)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockAdapter.listFiles.mockResolvedValue([])
    expect(await listBrandSlugs()).toEqual([])
    warn.mockRestore()
  })

  it("re-throws non-ENOENT errors (e.g. EACCES)", async () => {
    const eacces = new Error("EACCES") as NodeJS.ErrnoException
    eacces.code = "EACCES"
    mockAdapter.listFiles.mockRejectedValue(eacces)
    await expect(listBrandSlugs()).rejects.toThrow("EACCES")
  })
})

describe("listBrandSlugs warn-once", () => {
  it("warns exactly once when inputs/brands/ is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockAdapter.listFiles.mockResolvedValue([])
    await listBrandSlugs()
    await listBrandSlugs()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("does not exist")
    warn.mockRestore()
  })

  it("warns exactly once when no slugs match SLUG_RE", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockAdapter.listFiles.mockResolvedValue([
      "brands/INVALID/brand.json",
    ])
    await listBrandSlugs()
    await listBrandSlugs()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("no valid brand fixtures")
    warn.mockRestore()
  })

  it("does NOT warn when at least one valid slug is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockAdapter.listFiles.mockResolvedValue([
      "brands/acme/brand.json",
    ])
    await listBrandSlugs()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("tryLoadBrand", () => {
  it("returns { ok: true, profile } on success", async () => {
    mountValidBrandFixture()
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.profile.slug).toBe("acme")
  })

  it("returns { ok: false, error: BrandNotFoundError } when brand dir is missing", async () => {
    mockAdapter.fileExists.mockResolvedValue(false)
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandNotFoundError)
  })

  it("returns { ok: false, error: BrandIncompleteError } on missing required file", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/voice.json") throw enoent()
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      throw enoent()
    })
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandIncompleteError)
  })

  it("returns { ok: false, error: BrandInvalidError } on parse failure", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockResolvedValue(Buffer.from("{ not json"))
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandInvalidError)
  })

  it("re-throws non-brand errors (e.g. EACCES)", async () => {
    const eacces = new Error("EACCES") as NodeJS.ErrnoException
    eacces.code = "EACCES"
    mockAdapter.fileExists.mockRejectedValue(eacces)
    await expect(tryLoadBrand("acme")).rejects.toThrow("EACCES")
  })
})

describe("canVariants — products.json", () => {
  const VALID_PRODUCTS = {
    items: [
      { id: "citrus-front", sku: "TST-CIT-12", file: "products/can-citrus.png", pose: "upright-center", detail: "clean" },
      { id: "citrus-tilt",  sku: "TST-CIT-12", file: "products/can-citrus-tilt.png", pose: "tilt-left", detail: "clean" },
    ],
  }

  it("populates canVariants when products.json is present", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/voice.json") return Buffer.from(JSON.stringify(VALID_VOICE))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      if (key === "brands/acme/products.json") return Buffer.from(JSON.stringify(VALID_PRODUCTS))
      if (key === "brands/acme/banned-words.json") throw enoent()
      if (key === "brands/acme/backgrounds.json") throw enoent()
      throw enoent()
    })
    const profile = await loadBrandProfile("acme")
    expect(profile.canVariants).toHaveLength(2)
    expect(profile.canVariants[0].sku).toBe("TST-CIT-12")
    expect(profile.canVariants[0].pose).toBe("upright-center")
    expect(profile.canVariants[0].file).toBe("brands/acme/products/can-citrus.png")
  })

  it("returns empty canVariants when products.json is absent", async () => {
    mountValidBrandFixture()
    const profile = await loadBrandProfile("acme")
    expect(profile.canVariants).toEqual([])
  })

  it("throws BrandInvalidError when products.json has invalid schema", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/voice.json") return Buffer.from(JSON.stringify(VALID_VOICE))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      if (key === "brands/acme/products.json") return Buffer.from(JSON.stringify({ items: [] })) // min(1) violation
      if (key === "brands/acme/banned-words.json") throw enoent()
      if (key === "brands/acme/backgrounds.json") throw enoent()
      throw enoent()
    })
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(BrandInvalidError)
  })
})

describe("backgroundVariants — backgrounds.json", () => {
  const VALID_BACKGROUNDS = {
    items: [
      { id: "studio-1x1", file: "backgrounds/bg-studio.png", ratio: "1x1", sku: "TST-CIT-12", luminance: "light" },
      { id: "story-9x16", file: "backgrounds/bg-story.png",  ratio: "9x16", sku: "TST-BRY-12", luminance: "dark"  },
    ],
  }

  it("populates backgroundVariants when backgrounds.json is present", async () => {
    mockAdapter.fileExists.mockResolvedValue(true)
    mockAdapter.readFile.mockImplementation(async (_c: string, key: string) => {
      if (key === "brands/acme/brand.json") return Buffer.from(JSON.stringify(VALID_BRAND))
      if (key === "brands/acme/voice.json") return Buffer.from(JSON.stringify(VALID_VOICE))
      if (key === "brands/acme/logos/logos.json") return Buffer.from(JSON.stringify(VALID_LOGOS))
      if (key === "brands/acme/backgrounds.json") return Buffer.from(JSON.stringify(VALID_BACKGROUNDS))
      if (key === "brands/acme/banned-words.json") throw enoent()
      if (key === "brands/acme/products.json") throw enoent()
      throw enoent()
    })
    const profile = await loadBrandProfile("acme")
    expect(profile.backgroundVariants).toHaveLength(2)
    expect(profile.backgroundVariants[0].ratio).toBe("1x1")
    expect(profile.backgroundVariants[0].luminance).toBe("light")
    expect(profile.backgroundVariants[1].luminance).toBe("dark")
  })

  it("returns empty backgroundVariants when backgrounds.json is absent", async () => {
    mountValidBrandFixture()
    const profile = await loadBrandProfile("acme")
    expect(profile.backgroundVariants).toEqual([])
  })
})
