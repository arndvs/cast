"use client"

import { Check, X } from "lucide-react"
import { ComplianceBadgePill } from "@/components/cast/compliance-badge-pill"
import type { Creative } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface ComplianceChecksListProps {
  creative: Creative
}

export function ComplianceChecksList({ creative }: ComplianceChecksListProps) {
  const checks = creative.compliance?.checks
  const badge = creative.compliance?.badge ?? "OK"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          compliance
        </span>
        <ComplianceBadgePill badge={badge} />
      </div>
      {checks ? (
        <ul className="flex flex-col gap-1 text-sm">
          <CheckRow ok={checks.logoPresent} label="logo present" />
          <CheckRow
            ok={checks.bannedWords.length === 0}
            label={
              checks.bannedWords.length === 0
                ? "no banned words"
                : `banned words: ${checks.bannedWords.join(", ")}`
            }
          />
        </ul>
      ) : (
        <p className="text-xs text-fg-3">No compliance data on this creative.</p>
      )}
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad",
        )}
        aria-hidden="true"
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className={cn("text-sm", ok ? "text-fg-1" : "text-bad")}>{label}</span>
    </li>
  )
}
