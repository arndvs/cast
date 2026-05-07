/**
 * Seed brand fixtures — Brisa and Volt product catalogs.
 *
 * This module exposes inline brand data so the brand sidebar,
 * palette chips, and product catalog have something to render.
 * The brand-loader/route response supplements this with on-disk profiles.
 */

export interface DemoBrandProduct {
  name: string
  sku: string
  /** 2-stop swatch gradient — matches the prototype's product chip. */
  swatch: readonly [string, string]
  /** Foreground hex used on top of the swatch (CTA pill, corner mark). */
  hex: string
}

export interface DemoBrand {
  slug: string
  displayName: string
  /** Tagline — purely visual, sub-line of the sidebar card. */
  sub: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  voice: readonly string[]
  bannedWords: readonly string[]
  products: readonly DemoBrandProduct[]
}

export const DEMO_BRANDS: readonly DemoBrand[] = Object.freeze([
  {
    slug: "brisa",
    displayName: "Brisa",
    sub: "sparkling water",
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
  },
  {
    slug: "volt",
    displayName: "Volt",
    sub: "energy drink",
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
  },
])

export function getDemoBrand(slug: string): DemoBrand | undefined {
  return DEMO_BRANDS.find((b) => b.slug === slug)
}
