/**
 * Seed brand fixtures — Brisa and Volt product catalogs.
 *
 * This module exposes inline brand data so the brand sidebar,
 * palette chips, and product catalog have something to render.
 * The brand-loader/route response supplements this with on-disk profiles.
 *
 * Each brand also carries a `defaultBrief` — the canonical starting brief
 * that the reducer swaps in on brand change so products, audience, headlines,
 * and markets reset to brand-appropriate defaults.
 */

import type { AspectRatio } from "@/lib/cast/ratios"

/** Brief-compatible product shape (no swatch/hex — those are UI-only). */
export interface SeedBriefProduct {
  name: string
  sku: string
}

/** Full Brief minus `logoVariant` (logo is resolved separately on switch). */
export interface SeedDefaultBrief {
  campaign: string
  brand: string
  products: readonly SeedBriefProduct[]
  markets: readonly string[]
  audience: string
  message: Readonly<Record<string, string>>
  ratios: readonly AspectRatio[]
}

export interface SeedBrandProduct {
  name: string
  sku: string
  /** 2-stop swatch gradient — matches the prototype's product chip. */
  swatch: readonly [string, string]
  /** Foreground hex used on top of the swatch (CTA pill, corner mark). */
  hex: string
}

export interface SeedBrand {
  slug: string
  displayName: string
  /** Tagline — purely visual, sub-line of the sidebar card. */
  tagline: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  voice: readonly string[]
  bannedWords: readonly string[]
  products: readonly SeedBrandProduct[]
  /** Canonical starting brief — swapped in on brand change. */
  defaultBrief: SeedDefaultBrief
}

export const SEED_BRANDS: readonly SeedBrand[] = Object.freeze([
  {
    slug: "brisa",
    displayName: "Brisa",
    tagline: "sparkling water",
    colors: { primary: "#0F6E56", secondary: "#9FE1CB", accent: "#F4C0D1" },
    voice: ["soft natural lighting", "citrus tones", "condensation on glass"],
    bannedWords: ["healthy", "cure", "energy", "guarantee", "miracle", "instant"],
    products: [
      {
        name: "Brisa Citrus",
        sku: "BRS-CIT-12",
        swatch: ["#9FE1CB", "#E1F5EE"],
        hex: "#0F6E56",
      },
      {
        name: "Brisa Berry",
        sku: "BRS-BRY-12",
        swatch: ["#F4C0D1", "#FBEAF0"],
        hex: "#993556",
      },
    ],
    defaultBrief: {
      campaign: "summer-refresh-2026",
      brand: "brisa",
      products: [
        { name: "Brisa Citrus", sku: "BRS-CIT-12" },
        { name: "Brisa Berry", sku: "BRS-BRY-12" },
      ],
      markets: ["us-en", "mx-es"],
      audience:
        "18-34, urban, health-conscious; values clean ingredients and bold flavor; shops weekly at convenience stores and online grocery",
      message: {
        en: "Crack open something brighter.",
        es: "Abre algo más brillante.",
      } as Record<string, string>,
      ratios: ["1x1", "9x16", "16x9"],
    },
  },
  {
    slug: "volt",
    displayName: "Volt",
    tagline: "energy drink",
    colors: { primary: "#1A1A18", secondary: "#FAC775", accent: "#7DD3FC" },
    voice: ["dramatic lighting", "high contrast", "kinetic energy"],
    bannedWords: ["bro", "hustle", "grind", "pumped", "free", "guarantee"],
    products: [
      {
        name: "Volt Original",
        sku: "VLT-ORG-12",
        swatch: ["#FAC775", "#1A1A18"],
        hex: "#FAC775",
      },
      {
        name: "Volt Zero",
        sku: "VLT-ZRO-12",
        swatch: ["#7DD3FC", "#0C1A2A"],
        hex: "#7DD3FC",
      },
    ],
    defaultBrief: {
      campaign: "volt-launch-2026",
      brand: "volt",
      products: [
        { name: "Volt Original", sku: "VLT-ORG-12" },
        { name: "Volt Zero", sku: "VLT-ZRO-12" },
      ],
      markets: ["us-en"],
      audience:
        "18-34, urban, performance-driven; high-intensity lifestyle, convenience-store shoppers",
      message: { en: "Fuel what's next." } as Record<string, string>,
      ratios: ["1x1", "9x16", "16x9"],
    },
  },
])

export function getSeedBrand(slug: string): SeedBrand | undefined {
  return SEED_BRANDS.find((b) => b.slug === slug)
}

/**
 * Return a fresh default brief for the given brand slug — ready to be
 * spread into state. Returns `undefined` for unknown brands.
 */
export function getDefaultBrief(slug: string): SeedDefaultBrief | undefined {
  return getSeedBrand(slug)?.defaultBrief
}
