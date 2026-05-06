import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock node:fs/promises before importing the loader.
vi.mock("node:fs/promises", () => {
  return {
    default: {
      readFile: vi.fn(),
      access: vi.fn(),
      readdir: vi.fn(),
    },
  }
})

import fs from "node:fs/promises"
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

const mockedFs = fs as unknown as {
  readFile: ReturnType<typeof vi.fn>
  access: ReturnType<typeof vi.fn>
  readdir: ReturnType<typeof vi.fn>
}

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
  mockedFs.access.mockImplementation(async () => undefined)
  mockedFs.readFile.mockImplementation(async (p: string) => {
    const path = String(p).replace(/\\/g, "/")
    if (path.endsWith(`brands/${slug}/brand.json`)) return JSON.stringify(VALID_BRAND)
    if (path.endsWith(`brands/${slug}/voice.json`)) return JSON.stringify(VALID_VOICE)
    if (path.endsWith(`brands/${slug}/logos/logos.json`)) return JSON.stringify(VALID_LOGOS)
    if (path.endsWith(`brands/${slug}/banned-words.json`)) throw enoent()
    throw enoent()
  })
}

beforeEach(() => {
  _clearBrandCache()
  _resetBrandWarnings()
  mockedFs.readFile.mockReset()
  mockedFs.access.mockReset()
  mockedFs.readdir.mockReset()
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
    mockedFs.access.mockRejectedValue(enoent())
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(BrandNotFoundError)
  })

  it("throws BrandIncompleteError when a required file is missing", async () => {
    mockedFs.access.mockResolvedValue(undefined)
    mockedFs.readFile.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (path.endsWith("voice.json")) throw enoent()
      if (path.endsWith("brand.json")) return JSON.stringify(VALID_BRAND)
      if (path.endsWith("logos/logos.json")) return JSON.stringify(VALID_LOGOS)
      throw enoent()
    })
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(
      BrandIncompleteError,
    )
  })

  it("throws BrandInvalidError on JSON parse failure", async () => {
    mockedFs.access.mockResolvedValue(undefined)
    mockedFs.readFile.mockImplementation(async () => "{ this is not json")
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
    const readsAfterFirst = mockedFs.readFile.mock.calls.length
    const b = await loadBrandProfile("acme")
    expect(b).toBe(a) // referentially identical → from cache
    expect(mockedFs.readFile.mock.calls.length).toBe(readsAfterFirst)
  })

  it("re-reads after TTL expiry (90 s)", async () => {
    vi.useFakeTimers()
    mountValidBrandFixture()
    await loadBrandProfile("acme")
    const readsAfterFirst = mockedFs.readFile.mock.calls.length
    vi.advanceTimersByTime(90_001)
    await loadBrandProfile("acme")
    expect(mockedFs.readFile.mock.calls.length).toBeGreaterThan(readsAfterFirst)
  })

  it("re-reads after _clearBrandCache()", async () => {
    mountValidBrandFixture()
    await loadBrandProfile("acme")
    const readsAfterFirst = mockedFs.readFile.mock.calls.length
    _clearBrandCache()
    await loadBrandProfile("acme")
    expect(mockedFs.readFile.mock.calls.length).toBeGreaterThan(readsAfterFirst)
  })

  it("accepts font.otf when font.ttf is absent", async () => {
    mockedFs.access.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (path.endsWith("/font.ttf")) throw enoent()
      return undefined
    })
    mockedFs.readFile.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (path.endsWith("brands/acme/brand.json")) return JSON.stringify(VALID_BRAND)
      if (path.endsWith("brands/acme/voice.json")) return JSON.stringify(VALID_VOICE)
      if (path.endsWith("brands/acme/logos/logos.json")) return JSON.stringify(VALID_LOGOS)
      if (path.endsWith("brands/acme/banned-words.json")) throw enoent()
      throw enoent()
    })
    const profile = await loadBrandProfile("acme")
    expect(profile.fontPath.replace(/\\/g, "/")).toMatch(/\/font\.otf$/)
  })

  it("throws BrandIncompleteError when neither font.ttf nor font.otf exists", async () => {
    mockedFs.access.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (/\/font\.(ttf|otf)$/.test(path)) throw enoent()
      return undefined
    })
    mockedFs.readFile.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (path.endsWith("brands/acme/brand.json")) return JSON.stringify(VALID_BRAND)
      if (path.endsWith("brands/acme/voice.json")) return JSON.stringify(VALID_VOICE)
      if (path.endsWith("brands/acme/logos/logos.json")) return JSON.stringify(VALID_LOGOS)
      if (path.endsWith("brands/acme/banned-words.json")) throw enoent()
      throw enoent()
    })
    await expect(loadBrandProfile("acme")).rejects.toBeInstanceOf(
      BrandIncompleteError,
    )
  })
})

describe("listBrandSlugs", () => {
  it("returns sorted slugs that match SLUG_RE", async () => {
    mockedFs.readdir.mockResolvedValue([
      { name: "zeta", isDirectory: () => true },
      { name: "alpha", isDirectory: () => true },
      { name: "INVALID", isDirectory: () => true }, // fails SLUG_RE
      { name: "not-a-dir", isDirectory: () => false },
    ] as unknown as never)
    const slugs = await listBrandSlugs()
    expect(slugs).toEqual(["alpha", "zeta"])
  })

  it("returns [] when inputs/brands/ is missing (ENOENT)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockedFs.readdir.mockRejectedValue(enoent())
    expect(await listBrandSlugs()).toEqual([])
    warn.mockRestore()
  })

  it("re-throws non-ENOENT errors (e.g. EACCES)", async () => {
    const eacces = new Error("EACCES") as NodeJS.ErrnoException
    eacces.code = "EACCES"
    mockedFs.readdir.mockRejectedValue(eacces)
    await expect(listBrandSlugs()).rejects.toThrow("EACCES")
  })
})

describe("listBrandSlugs warn-once", () => {
  it("warns exactly once when inputs/brands/ is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockedFs.readdir.mockRejectedValue(enoent())
    await listBrandSlugs()
    await listBrandSlugs()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("No brand fixtures found")
    warn.mockRestore()
  })

  it("warns exactly once when no slugs match SLUG_RE", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockedFs.readdir.mockResolvedValue([
      { name: "INVALID", isDirectory: () => true },
    ] as unknown as never)
    await listBrandSlugs()
    await listBrandSlugs()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("does NOT warn when at least one valid slug is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockedFs.readdir.mockResolvedValue([
      { name: "acme", isDirectory: () => true },
    ] as unknown as never)
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
    mockedFs.access.mockRejectedValue(enoent())
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandNotFoundError)
  })

  it("returns { ok: false, error: BrandIncompleteError } on missing required file", async () => {
    mockedFs.access.mockResolvedValue(undefined)
    mockedFs.readFile.mockImplementation(async (p: string) => {
      const path = String(p).replace(/\\/g, "/")
      if (path.endsWith("voice.json")) throw enoent()
      if (path.endsWith("brand.json")) return JSON.stringify(VALID_BRAND)
      if (path.endsWith("logos/logos.json")) return JSON.stringify(VALID_LOGOS)
      throw enoent()
    })
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandIncompleteError)
  })

  it("returns { ok: false, error: BrandInvalidError } on parse failure", async () => {
    mockedFs.access.mockResolvedValue(undefined)
    mockedFs.readFile.mockImplementation(async () => "{ not json")
    const result = await tryLoadBrand("acme")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeInstanceOf(BrandInvalidError)
  })

  it("re-throws non-brand errors (e.g. EACCES)", async () => {
    const eacces = new Error("EACCES") as NodeJS.ErrnoException
    eacces.code = "EACCES"
    mockedFs.access.mockRejectedValue(eacces)
    await expect(tryLoadBrand("acme")).rejects.toThrow("EACCES")
  })
})
