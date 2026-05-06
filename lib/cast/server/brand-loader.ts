/**
 * Brand profile loader — D11, D27, D28.
 *
 * Reads `inputs/brands/[slug]/{brand,voice,banned-words}.json` + `logos/logos.json`,
 * validates against `brandProfileSchema`, returns a hydrated `BrandProfile`.
 *
 * - 90 s in-process Map cache, no mtime invalidation (per system-map / D11).
 * - Throws `BrandNotFoundError` / `BrandIncompleteError` / `BrandInvalidError`;
 *   route handlers map `BrandNotFoundError` to 404 and the other two to 400,
 *   each with a structured `{ errors: [...] }` body.
 * - Banned-words list is the **union** of `getDefaultBannedWords()` + brand file
 *   (deduped, lowercased). Defaults always apply; missing brand file is allowed.
 * - Every disk read goes through `safeJoin("inputs", ...)`.
 */

import fs from "node:fs/promises"
import type { ZodType } from "zod"
import {
  brandJsonSchema,
  voiceJsonSchema,
  bannedWordsSchema,
  logosManifestSchema,
  SLUG_RE,
  type BrandProfile,
} from "@/lib/cast/schemas"
import {
  BrandNotFoundError,
  BrandIncompleteError,
  BrandInvalidError,
} from "@/lib/cast/errors"
import { safeJoin } from "@/lib/cast/server/safe-join"
import { getDefaultBannedWords } from "@/lib/cast/banned-words"

const CACHE_TTL_MS = 90_000

type CacheEntry = { profile: BrandProfile; expiresAt: number }
const cache = new Map<string, CacheEntry>()

/** Test-only: clear the in-process cache. Not exported through index. */
export function _clearBrandCache(): void {
  cache.clear()
}

export async function loadBrandProfile(slug: string): Promise<BrandProfile> {
  if (!SLUG_RE.test(slug)) {
    throw new BrandNotFoundError(slug)
  }
  const cached = cache.get(slug)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile
  }

  // TODO(symlink-hardening): re-validate with realpath after lexical safeJoin.
  const brandDir = safeJoin("inputs", "brands", slug)
  await assertExists(brandDir, slug, slug)

  const brandJson = await readJson(slug, "brand.json")
  const voiceJson = await readJson(slug, "voice.json")
  const logosJson = await readJson(slug, "logos/logos.json")

  // banned-words.json is optional
  let bannedWordsRaw: unknown[] = []
  try {
    bannedWordsRaw = (await readJson(slug, "banned-words.json")) as unknown[]
  } catch (err) {
    if (!(err instanceof BrandIncompleteError)) throw err
  }

  // font.ttf / font.otf is existence-checked only — either filename is accepted.
  // TODO(symlink-hardening): re-validate fontPath with realpath
  const fontPath = await resolveFontPath(slug)

  const brand = parse(slug, "brand.json", brandJsonSchema, brandJson)
  const voice = parse(slug, "voice.json", voiceJsonSchema, voiceJson)
  const bannedFromFile = parse(
    slug,
    "banned-words.json",
    bannedWordsSchema,
    bannedWordsRaw,
  )
  const logos = parse(slug, "logos/logos.json", logosManifestSchema, logosJson)

  // Verify each declared logo variant file actually exists on disk.
  const logoVariants: BrandProfile["logoVariants"] = []
  for (const variant of logos.variants) {
    // TODO(symlink-hardening): re-validate variant.path with realpath
    const variantPath = safeJoin("inputs", "brands", slug, "logos", variant.file)
    await assertExists(variantPath, slug, `logos/${variant.file}`)
    logoVariants.push({
      id: variant.id,
      displayName: variant.displayName,
      path: variantPath,
    })
  }

  const bannedWords = unionLowercase(getDefaultBannedWords(), bannedFromFile)

  const profile: BrandProfile = {
    slug,
    brand,
    voice,
    bannedWords,
    logoVariants,
    defaultLogoId: logos.default,
    fontPath,
  }

  cache.set(slug, { profile, expiresAt: Date.now() + CACHE_TTL_MS })
  return profile
}

/** List every brand directory under inputs/brands/. Returns sorted slugs. */
export async function listBrandSlugs(): Promise<string[]> {
  // TODO(symlink-hardening): re-validate with realpath
  const dir = safeJoin("inputs", "brands")
  let entries: import("node:fs").Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    // Missing inputs/brands/ is allowed; permission/IO errors must surface.
    if (isENOENT(err)) return []
    throw err
  }
  return entries
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => e.name)
    .sort()
}

// ---------------------------------------------------------------------------

async function readJson(slug: string, rel: string): Promise<unknown> {
  // rel is a controlled internal constant ("brand.json", "voice.json", ...).
  // We still safeJoin to be defensive.
  const segments = rel.split("/").filter(Boolean)
  // TODO(symlink-hardening): re-validate with realpath
  const filePath = safeJoin("inputs", "brands", slug, ...segments)
  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf8")
  } catch (err) {
    if (isENOENT(err)) {
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
  absPath: string,
  slug: string,
  rel: string,
): Promise<void> {
  try {
    await fs.access(absPath)
  } catch (err) {
    if (isENOENT(err)) {
      // brand-dir miss is "not found"; child miss is "incomplete"
      if (rel === slug) throw new BrandNotFoundError(slug)
      throw new BrandIncompleteError(slug, rel)
    }
    throw err
  }
}

/**
 * Resolve the brand's display font. Existence-checked only; either
 * `font.ttf` or `font.otf` is accepted. If neither exists, throw
 * `BrandIncompleteError` against `font.ttf` (canonical name in the contract).
 */
async function resolveFontPath(slug: string): Promise<string> {
  for (const file of ["font.ttf", "font.otf"] as const) {
    const candidate = safeJoin("inputs", "brands", slug, file)
    try {
      await fs.access(candidate)
      return candidate
    } catch (err) {
      if (!isENOENT(err)) throw err
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

function unionLowercase(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set<string>()
  for (const s of [...a, ...b]) {
    const w = s.toLowerCase().trim()
    if (w) set.add(w)
  }
  return [...set].sort()
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  )
}
