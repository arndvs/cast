/**
 * Cast — Zod contracts.
 *
 * Single source of truth for the brief, the brand profile, and the run
 * manifest (== `report.json` on disk == the `complete` event payload).
 *
 * Ported verbatim from docs/flow-diagrams.md Appendix A. Do not hand-edit
 * one without updating the other; flow-diagrams.md is canonical.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MARKET_RE = /^[a-z]{2}-[a-z]{2}$/ // <region>-<lang>, e.g. us-en
export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export const ratioSchema = z.enum(["1x1", "9x16", "16x9"])
export type AspectRatio = z.infer<typeof ratioSchema>

// ---------------------------------------------------------------------------
// Brief (editor input → /api/generate body)
// ---------------------------------------------------------------------------

/**
 * Same `slugify` shape used by `/api/upload` and the Asset Resolver:
 * lowercase, non-alphanumeric runs collapsed to `-`, leading/trailing `-`
 * stripped. One implementation, one import path.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const briefSchema = z
  .object({
    campaign: z.string().regex(SLUG_RE),
    brand: z.string().regex(SLUG_RE),
    products: z
      .array(
        z.object({
          name: z.string().min(1),
          sku: z.string().min(1),
          promptOverrides: z
            .object({
              environment: z.string().optional(),
              mood: z.array(z.string()).optional(),
            })
            .optional(),
        }),
      )
      .min(1),
    markets: z.array(z.string().regex(MARKET_RE)).min(1),
    audience: z.string().min(1).max(500),
    message: z.record(z.string().regex(/^[a-z]{2}$/), z.string().min(1)),
    ratios: z.array(ratioSchema).min(1),
    // Optional logo variant id; cross-validated against the loaded brand
    // at /api/generate entry (briefSchema alone has no brand state). When
    // omitted, the orchestrator falls back to `brandProfile.defaultLogoId`.
    logoVariant: z.string().regex(SLUG_RE).optional(),
  })
  .superRefine((brief, ctx) => {
    // Every market's locale (suffix after `-`) must have a message string.
    for (const market of brief.markets) {
      const locale = market.split("-").pop()!
      if (!(locale in brief.message)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["message"],
          message: `market ${market} requires message["${locale}"]`,
        })
      }
    }
    // Derived product slugs must be unique — same slug means same upload
    // target, same resolver hit, same output folder.
    const seen = new Map<string, number>()
    brief.products.forEach((p, i) => {
      const slug = slugify(p.name)
      if (slug.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", i, "name"],
          message: `product name "${p.name}" slugs to an empty string; need at least one [a-z0-9] character`,
        })
        return
      }
      if (seen.has(slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", i, "name"],
          message: `product name slugs to "${slug}" which collides with products[${seen.get(slug)}].name`,
        })
      } else {
        seen.set(slug, i)
      }
    })
  })

export type Brief = z.infer<typeof briefSchema>

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

export const brandColorsSchema = z.object({
  primary: z.string().regex(HEX_RE),
  accent: z.string().regex(HEX_RE),
  background: z.string().regex(HEX_RE).optional(),
  text: z.string().regex(HEX_RE).optional(),
})

export const brandJsonSchema = z.object({
  displayName: z.string().min(1),
  colors: brandColorsSchema,
  tokens: z.record(z.string(), z.string()).optional(),
})

export const voiceJsonSchema = z.object({
  tone: z.string().min(1),
  do: z.array(z.string()).default([]),
  dont: z.array(z.string()).default([]),
  promptFragments: z.array(z.string()).default([]),
})

export const bannedWordsSchema = z.array(z.string().min(1))

export const logoVariantSchema = z.object({
  id: z.string().regex(SLUG_RE),
  displayName: z.string().min(1),
  file: z.string().regex(/^[a-z0-9-]+\.png$/),
  /** Optional swatch hint for the editor preview. Defaults to "light". */
  theme: z.enum(["light", "dark"]).optional(),
})

export const logosManifestSchema = z
  .object({
    default: z.string().regex(SLUG_RE),
    variants: z.array(logoVariantSchema).min(1),
  })
  .superRefine((m, ctx) => {
    const ids = new Set(m.variants.map((v) => v.id))
    if (!ids.has(m.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["default"],
        message: `default "${m.default}" not found in variants[]`,
      })
    }
    const seen = new Set<string>()
    m.variants.forEach((v, i) => {
      if (seen.has(v.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", i, "id"],
          message: `duplicate variant id "${v.id}"`,
        })
      }
      seen.add(v.id)
    })
  })

export const brandProfileSchema = z.object({
  brand: brandJsonSchema,
  voice: voiceJsonSchema,
  bannedWords: bannedWordsSchema.default([]),
  logos: logosManifestSchema,
})

export type BrandProfile = {
  slug: string
  brand: z.infer<typeof brandJsonSchema>
  voice: z.infer<typeof voiceJsonSchema>
  bannedWords: string[]
  logoVariants: {
    id: string
    displayName: string
    path: string
    theme?: "light" | "dark"
  }[]
  defaultLogoId: string
  /** Absolute path to the brand's display font. `font.ttf` or `font.otf`. */
  fontPath: string
}

// ---------------------------------------------------------------------------
// Run manifest (== report.json == `complete` event payload)
// ---------------------------------------------------------------------------

export const errorStageSchema = z.enum([
  "resolve",
  "genai",
  "resize",
  "compose",
  "compliance",
  "write",
])
export type ErrorStage = z.infer<typeof errorStageSchema>

/**
 * Ordered pipeline stages — used in the creative detail dialog breadcrumb
 * and for error attribution in the manifest.
 */
export const PIPELINE_STAGES = [
  "resolve",
  "genai",
  "resize",
  "compose",
  "compliance",
  "write",
] as const satisfies readonly ErrorStage[]

export const complianceBadgeSchema = z.enum(["OK", "WARN", "FAIL"])
export type ComplianceBadge = z.infer<typeof complianceBadgeSchema>

export const complianceSchema = z.object({
  badge: complianceBadgeSchema,
  checks: z.object({
    logoPresent: z.boolean(),
    colorsOk: z.boolean(),
    bannedWords: z.array(z.string()),
  }),
})

export const creativeSchema = z.object({
  product: z.string(),
  market: z.string().regex(MARKET_RE),
  ratio: ratioSchema,
  source: z.enum(["local", "genai"]),
  path: z.string().nullable(), // null on failure (write stage skips compliance)
  compliance: complianceSchema.optional(),
  duration: z.number().nonnegative().optional(),
})

export const manifestErrorSchema = z.object({
  product: z.string(),
  market: z.string().regex(MARKET_RE),
  ratio: ratioSchema,
  stage: errorStageSchema,
  message: z.string(),
})

export const countsSchema = z.object({
  requested: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  generated: z.number().int().nonnegative(),
  reused: z.number().int().nonnegative(),
  flagged: z.number().int().nonnegative(),
})

export const manifestSchema = z.object({
  campaign: z.string().regex(SLUG_RE),
  brand: z.string().regex(SLUG_RE),
  outputDir: z.string(),
  counts: countsSchema,
  creatives: z.array(creativeSchema),
  errors: z.array(manifestErrorSchema),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
})

export type Manifest = z.infer<typeof manifestSchema>
export type Creative = z.infer<typeof creativeSchema>
export type ManifestError = z.infer<typeof manifestErrorSchema>
export type Counts = z.infer<typeof countsSchema>
