/**
 * Brand profile loader — reads brand, voice, logo, and banned-words fixtures.
 *
 * Reads `inputs/brands/[slug]/{brand,voice,banned-words}.json` + `logos/logos.json`,
 * validates against `brandProfileSchema`, returns a hydrated `BrandProfile`.
 *
 * - 90 s in-process Map cache, no mtime invalidation.
 * - Throws `BrandNotFoundError` / `BrandIncompleteError` / `BrandInvalidError`;
 *   route handlers map `BrandNotFoundError` to 404 and the other two to 400,
 *   each with a structured `{ errors: [...] }` body.
 * - Banned-words list is the **union** of `getDefaultBannedWords()` + brand file
 *   (deduped, lowercased). Defaults always apply; missing brand file is allowed.
 * - All file I/O goes through StorageAdapter (local FS or Azure Blob).
 */

import type { ZodType } from "zod"
import {
  brandJsonSchema,
  voiceJsonSchema,
  bannedWordsSchema,
  logosManifestSchema,
  productsManifestSchema,
  backgroundsManifestSchema,
  SLUG_RE,
  type BrandProfile,
} from "@/lib/cast/schemas"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"
import { getDefaultBannedWords } from "@/lib/cast/banned-words"
import { getStorageAdapter, StorageNotFoundError, type StorageAdapter } from "@/lib/cast/server/storage-adapter"

const CACHE_TTL_MS = 90_000

type CacheEntry = { profile: BrandProfile; expiresAt: number }
const cache = new Map<string, CacheEntry>()

/** Test-only: clear the in-process cache. Not exported through index. */
export function _clearBrandCache(): void {
  cache.clear()
}

/**
 * Discriminated result type for `tryLoadBrand`. Surfaces the same three
 * brand-load errors the throwing `loadBrandProfile` raises, but as a
 * value so server components can render fallback UI without try/catch.
 */
export type BrandLoadError =
  | BrandNotFoundError
  | BrandIncompleteError
  | BrandInvalidError

export type TryLoadBrandResult =
  | { ok: true; profile: BrandProfile }
  | { ok: false; error: BrandLoadError }

/**
 * Non-throwing wrapper around `loadBrandProfile`. Returns the profile or
 * the typed error so server components and route handlers can render a
 * banner / actionable response instead of crashing the request. Unexpected
 * (non-brand) errors still throw — those are bugs, not user-facing states.
 */
export async function tryLoadBrand(slug: string): Promise<TryLoadBrandResult> {
  try {
    const profile = await loadBrandProfile(slug)
    return { ok: true, profile }
  } catch (err) {
    if (
      err instanceof BrandNotFoundError ||
      err instanceof BrandIncompleteError ||
      err instanceof BrandInvalidError
    ) {
      return { ok: false, error: err }
    }
    throw err
  }
}

/**
 * One-shot warning state. We log once per process when `listBrandSlugs()`
 * returns an empty array so operators see it in their console without
 * spamming on every request. Reset via `_resetBrandWarnings()` in tests.
 */
let warnedNoBrands = false

/** Test-only: reset the one-shot warning flag. Not exported through index. */
export function _resetBrandWarnings(): void {
  warnedNoBrands = false
}

export async function loadBrandProfile(slug: string): Promise<BrandProfile> {
  if (!SLUG_RE.test(slug)) {
    throw new BrandNotFoundError(slug)
  }
  const cached = cache.get(slug)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile
  }

  const storage = await getStorageAdapter()

  // Distinguish "brand directory doesn't exist" (BrandNotFoundError) from
  // "directory exists but brand.json is missing" (BrandIncompleteError).
  const brandDirKey = `brands/${slug}`
  if (!(await storage.fileExists("inputs", `${brandDirKey}/brand.json`))) {
    const slugs = await storage.listPrefixes("inputs", "brands")
    if (!slugs.includes(slug)) throw new BrandNotFoundError(slug)
    throw new BrandIncompleteError(slug, "brand.json")
  }

  const brandJson = await readJson(storage, slug, "brand.json")
  const voiceJson = await readJson(storage, slug, "voice.json")
  const logosJson = await readJson(storage, slug, "logos/logos.json")

  // banned-words.json is optional
  let bannedWordsRaw: unknown[] = []
  try {
    bannedWordsRaw = (await readJson(storage, slug, "banned-words.json")) as unknown[]
  } catch (err) {
    if (!(err instanceof BrandIncompleteError)) throw err
  }

  // products.json is optional — present for Brisa, absent for Volt
  let productsRaw: unknown = null
  try {
    productsRaw = await readJson(storage, slug, "products.json")
  } catch (err) {
    if (!(err instanceof BrandIncompleteError)) throw err
  }

  // backgrounds.json is optional — present for Brisa, absent for Volt
  let backgroundsRaw: unknown = null
  try {
    backgroundsRaw = await readJson(storage, slug, "backgrounds.json")
  } catch (err) {
    if (!(err instanceof BrandIncompleteError)) throw err
  }

  // font.ttf / font.otf is existence-checked only — either filename is accepted.
  const fontKey = await resolveFontKey(storage, slug)

  const brand = parse(slug, "brand.json", brandJsonSchema, brandJson)
  const voice = parse(slug, "voice.json", voiceJsonSchema, voiceJson)
  const bannedFromFile = parse(
    slug,
    "banned-words.json",
    bannedWordsSchema,
    bannedWordsRaw,
  )
  const logos = parse(slug, "logos/logos.json", logosManifestSchema, logosJson)

  // Verify each declared logo variant file actually exists.
  const logoVariants: BrandProfile["logoVariants"] = []
  for (const variant of logos.variants) {
    const variantKey = `brands/${slug}/logos/${variant.file}`
    await assertExists(storage, variantKey, slug, `logos/${variant.file}`)
    logoVariants.push({
      id: variant.id,
      displayName: variant.displayName,
      path: variantKey,
      theme: variant.theme,
    })
  }

  const bannedWords = unionLowercase(getDefaultBannedWords(), bannedFromFile)

  // Resolve can variant keys (container-relative)
  const canVariants: BrandProfile["canVariants"] = []
  if (productsRaw !== null) {
    const productsManifest = parse(
      slug,
      "products.json",
      productsManifestSchema,
      productsRaw,
    )
    for (const item of productsManifest.items) {
      const segments = validateItemFile(slug, "products.json", item.file)
      const itemKey = `brands/${slug}/${segments.join("/")}`
      await assertExists(storage, itemKey, slug, item.file)
      canVariants.push({
        id: item.id,
        sku: item.sku,
        file: itemKey,
        pose: item.pose,
        detail: item.detail,
      })
    }
  }

  // Resolve background variant keys (container-relative)
  const backgroundVariants: BrandProfile["backgroundVariants"] = []
  if (backgroundsRaw !== null) {
    const backgroundsManifest = parse(
      slug,
      "backgrounds.json",
      backgroundsManifestSchema,
      backgroundsRaw,
    )
    for (const item of backgroundsManifest.items) {
      const segments = validateItemFile(slug, "backgrounds.json", item.file)
      const itemKey = `brands/${slug}/${segments.join("/")}`
      await assertExists(storage, itemKey, slug, item.file)
      backgroundVariants.push({
        id: item.id,
        file: itemKey,
        ratio: item.ratio,
        sku: item.sku,
        luminance: item.luminance,
      })
    }
  }

  const profile: BrandProfile = {
    slug,
    brand,
    voice,
    bannedWords,
    logoVariants,
    defaultLogoId: logos.default,
    fontPath: fontKey,
    canVariants,
    backgroundVariants,
  }

  cache.set(slug, { profile, expiresAt: Date.now() + CACHE_TTL_MS })
  return profile
}

/** List every brand directory under inputs/brands/. Returns sorted slugs. */
export async function listBrandSlugs(): Promise<string[]> {
  const storage = await getStorageAdapter()
  const dirs = await storage.listPrefixes("inputs", "brands")
  if (dirs.length === 0) {
    maybeWarnNoBrands("missing")
    return []
  }
  const slugs = dirs.filter((name) => SLUG_RE.test(name)).sort()
  if (slugs.length === 0) maybeWarnNoBrands("empty")
  return slugs
}

function maybeWarnNoBrands(reason: "missing" | "empty"): void {
  if (warnedNoBrands) return
  warnedNoBrands = true
  const lead =
    reason === "missing"
      ? "inputs/brands/ does not exist."
      : "inputs/brands/ contains no valid brand fixtures (directory names must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/)."
  console.warn(
    `[cast] ${lead} Drop a brand directory there (see docs/brand-extraction.md) so the editor can render logo variants.`,
  )
}

// ---------------------------------------------------------------------------

async function readJson(storage: StorageAdapter, slug: string, rel: string): Promise<unknown> {
  const key = `brands/${slug}/${rel}`
  let raw: string
  try {
    const buf = await storage.readFile("inputs", key)
    raw = buf.toString("utf8")
  } catch (err) {
    if (err instanceof StorageNotFoundError) {
      throw new BrandIncompleteError(slug, rel)
    }
    throw err
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new BrandInvalidError(slug, rel, [
      { path: [], message: `invalid JSON: ${(err as Error).message}` },
    ])
  }
}

async function assertExists(
  storage: StorageAdapter,
  key: string,
  slug: string,
  rel: string,
): Promise<void> {
  if (!(await storage.fileExists("inputs", key))) {
    // brand-dir miss is "not found"; child miss is "incomplete"
    if (rel === slug) throw new BrandNotFoundError(slug)
    throw new BrandIncompleteError(slug, rel)
  }
}

/**
 * Resolve the brand's display font. Existence-checked only; either
 * `font.ttf` or `font.otf` is accepted. If neither exists, throw
 * `BrandIncompleteError` against `font.ttf` (canonical name in the contract).
 */
async function resolveFontKey(storage: StorageAdapter, slug: string): Promise<string> {
  for (const file of ["font.ttf", "font.otf"] as const) {
    const key = `brands/${slug}/${file}`
    if (await storage.fileExists("inputs", key)) {
      return key
    }
  }
  throw new BrandIncompleteError(slug, "font.ttf")
}

function parse<T>(
  slug: string,
  file: string,
  schema: ZodType<T>,
  data: unknown,
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new BrandInvalidError(
      slug,
      file,
      result.error.issues.map((i) => ({
        path: i.path.filter(
          (p): p is string | number => typeof p === "string" || typeof p === "number",
        ),
        message: i.message,
      })),
    )
  }
  return result.data
}

/**
 * Reject item.file values containing backslashes, traversal segments (.., .),
 * or absolute paths. Container keys use forward slashes only — any backslash
 * is rejected outright. Surfaces violations as BrandInvalidError so callers
 * get a clear 400 instead of an unexpected PathTraversalError from the adapter.
 */
function validateItemFile(slug: string, manifestFile: string, raw: string): string[] {
  if (raw.includes("\\")) {
    throw new BrandInvalidError(slug, manifestFile, [
      { path: ["file"], message: `backslashes not allowed in container key: "${raw}"` },
    ])
  }
  const segments = raw.split("/").filter(Boolean)
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      throw new BrandInvalidError(slug, manifestFile, [
        { path: ["file"], message: `path traversal segment "${seg}" in "${raw}"` },
      ])
    }
  }
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith("/")) {
    throw new BrandInvalidError(slug, manifestFile, [
      { path: ["file"], message: `absolute path not allowed: "${raw}"` },
    ])
  }
  if (segments.length === 0) {
    throw new BrandInvalidError(slug, manifestFile, [
      { path: ["file"], message: `empty container key: "${raw}"` },
    ])
  }
  return segments
}

function unionLowercase(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set<string>()
  for (const s of [...a, ...b]) {
    const w = s.toLowerCase().trim()
    if (w) set.add(w)
  }
  return [...set].sort()
}
