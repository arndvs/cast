import type {
  Brief,
  ComplianceBadge,
  Creative,
  Manifest,
  ManifestError,
} from "@/lib/cast/schemas"
import type { runCompliance } from "@/lib/cast/server/pipeline/compliance"
import { gridSize, slotOrder } from "@/lib/cast/slot-grid"

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
  const requested = gridSize(brief)
  const generated = succeededList.filter((c) => c.source === "genai").length
  const reused = succeededList.filter((c) => c.source === "local").length
  const quality_flag = succeededList.filter((c) => c.quality === "fail").length

  return {
    campaign: brief.campaign,
    brand: brief.brand,
    outputDir: `outputs/${brief.campaign}`,
    counts: { requested, succeeded, failed, generated, reused, quality_flag },
    creatives,
    errors,
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
  }
}

// ---------------------------------------------------------------------------
// Deterministic sort comparators
// ---------------------------------------------------------------------------

export function byCreative(a: Creative, b: Creative): number {
  return slotOrder(
    { product: a.product, market: a.market, ratio: a.ratio },
    { product: b.product, market: b.market, ratio: b.ratio },
  )
}

export function byError(a: ManifestError, b: ManifestError): number {
  return slotOrder(
    { product: a.product, market: a.market, ratio: a.ratio },
    { product: b.product, market: b.market, ratio: b.ratio },
  )
}
