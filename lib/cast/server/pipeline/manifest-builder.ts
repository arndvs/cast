import type {
  AspectRatio,
  Brief,
  ComplianceBadge,
  Creative,
  Manifest,
  ManifestError,
} from "@/lib/cast/schemas"
import type { runCompliance } from "@/lib/cast/server/pipeline/compliance"

// ---------------------------------------------------------------------------
// Compliance reshaper
// ---------------------------------------------------------------------------

export function toComplianceField(c: ReturnType<typeof runCompliance>): {
  badge: ComplianceBadge
  checks: { logoPresent: boolean; bannedWords: string[] }
} {
  return { badge: c.badge, checks: c.checks }
}

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

export function buildManifest(
  brief: Brief,
  creatives: Creative[],
  errors: ManifestError[],
  startedAt?: string,
  completedAt?: string,
): Manifest {
  const succeededList = creatives.filter((c) => c.path !== null)
  const succeeded = succeededList.length
  const failed = errors.length
  const requested =
    brief.products.length * brief.markets.length * brief.ratios.length
  const generated = succeededList.filter((c) => c.source === "genai").length
  const reused = succeededList.filter((c) => c.source === "local").length
  const flagged = succeededList.filter(
    (c) => c.compliance?.badge === "WARN" || c.compliance?.badge === "FAIL",
  ).length

  return {
    campaign: brief.campaign,
    brand: brief.brand,
    outputDir: `outputs/${brief.campaign}`,
    counts: { requested, succeeded, failed, generated, reused, flagged },
    creatives,
    errors,
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}

// ---------------------------------------------------------------------------
// Deterministic sort comparators
// ---------------------------------------------------------------------------

const RATIO_ORDER: Record<AspectRatio, number> = {
  "1x1": 0,
  "9x16": 1,
  "16x9": 2,
}

export function byCreative(a: Creative, b: Creative): number {
  return (
    a.market.localeCompare(b.market) ||
    a.product.localeCompare(b.product) ||
    RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
  )
}

export function byError(a: ManifestError, b: ManifestError): number {
  return (
    a.market.localeCompare(b.market) ||
    a.product.localeCompare(b.product) ||
    RATIO_ORDER[a.ratio] - RATIO_ORDER[b.ratio]
  )
}
