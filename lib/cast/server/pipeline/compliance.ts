/**
 * Compliance stage — `compliance`.
 *
 * Banned-words union (default floor + brand list, deduped, lowercased) is
 * already pre-computed by the brand-loader. This stage just runs the headline
 * through the **same** `containsBannedWord` symbol the client imports —
 * referential identity. The parity test asserts the import is the
 * same module instance.
 *
 * Logo presence is always `true` because the compose stage always drops the
 * brand logo. Kept on the result type so downstream UI stays stable.
 *
 * Color validation (headline bar vs brand primary) is v2 — see
 * flow-diagrams.md §8.
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
      bannedWords: hits,
    },
  }
}
