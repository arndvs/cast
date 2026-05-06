/**
 * Compliance stage — `compliance`.
 *
 * Banned-words union (default floor + brand list, deduped, lowercased) is
 * already pre-computed by the brand-loader. This stage just runs the headline
 * through the **same** `containsBannedWord` symbol the S1 client imports —
 * D29 referential identity. The V4 parity test asserts the import is the
 * same module instance.
 *
 * Color check is a placeholder for the POC — we composite in our own brand
 * colors via the SVG overlay, so `colorsOk` is always `true`. A real
 * post-render pixel sample lands later.
 *
 * Logo presence is always `true` because the compose stage always drops the
 * brand logo. Kept on the result type so downstream UI stays stable.
 */

import { containsBannedWord } from "@/lib/cast/banned-words"
import type { ComplianceBadge } from "@/lib/cast/schemas"

export interface ComplianceInput {
  headline: string
  bannedWords: readonly string[]
}

export interface ComplianceResult {
  badge: ComplianceBadge
  checks: {
    logoPresent: boolean
    colorsOk: boolean
    bannedWords: string[]
  }
}

export function runCompliance(input: ComplianceInput): ComplianceResult {
  const hits = containsBannedWord(input.headline, input.bannedWords)
  const badge: ComplianceBadge = hits.length > 0 ? "FAIL" : "OK"
  return {
    badge,
    checks: {
      logoPresent: true,
      colorsOk: true,
      bannedWords: hits,
    },
  }
}
