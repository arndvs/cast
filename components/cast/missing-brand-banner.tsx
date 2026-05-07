import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  BRAND_HINTS,
  type BrandLoadErrorInfo,
} from "@/lib/cast/brand-hints"
import { cn } from "@/lib/utils"

interface MissingBrandBannerProps {
  error: BrandLoadErrorInfo
  /** Slugs of brands present on disk — surfaced to the operator as a fallback list. */
  brandsAvailable: readonly string[]
}

/**
 * Editor-level banner shown when `loadBrandProfile(brief.brand)` failed.
 *
 * Renders an actionable hint per error kind plus the list of brand slugs
 * that DID load, so the operator can either fix the offending fixture or
 * point the brief at a working slug. Pure presentation — no client state.
 */
export function MissingBrandBanner({
  error,
  brandsAvailable,
}: MissingBrandBannerProps) {
  const hint = BRAND_HINTS[error.kind]
  // `notFound` is recoverable (pick a different slug); `incomplete` and
  // `invalid` indicate a broken fixture and warrant the louder red treatment.
  const severity = error.kind === "notFound" ? "warn" : "bad"

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex flex-col gap-2 rounded-md border p-4",
        severity === "warn"
          ? "border-warn/40 bg-warn/10 text-warn-foreground"
          : "border-bad/40 bg-bad/10 text-bad",
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <strong className="font-mono text-xs uppercase tracking-[0.12em]">
          Brand fixture {labelForKind(error.kind)}
        </strong>
        <code className="rounded bg-background/50 px-1.5 py-0.5 font-mono text-[0.6875rem]">
          {error.slug}
        </code>
      </div>
      <p className="text-sm">{error.message}</p>
      {error.kind === "incomplete" && (
        <p className="font-mono text-xs">
          missing: <span className="font-bold">{error.missing}</span>
        </p>
      )}
      {error.kind === "invalid" && error.issues.length > 0 && (
        <ul className="ml-4 list-disc font-mono text-xs">
          {error.issues.slice(0, 5).map((issue, i) => (
            <li key={i}>
              <span className="opacity-70">
                {[error.file, ...issue.path].join(".")}
              </span>{" "}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">{hint}</p>
      {brandsAvailable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="opacity-70">Available brands:</span>
          {brandsAvailable.map((s) => (
            <Badge key={s} variant="outline" className="font-mono text-[0.6875rem]">
              {s}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs opacity-80">
        Generate is disabled until the brand loads. Edit{" "}
        <code className="font-mono">inputs/brief.json</code> or fix the fixture
        under <code className="font-mono">inputs/brands/{error.slug}/</code>.
      </p>
    </div>
  )
}

function labelForKind(kind: BrandLoadErrorInfo["kind"]): string {
  switch (kind) {
    case "notFound":
      return "not found"
    case "incomplete":
      return "incomplete"
    case "invalid":
      return "invalid"
  }
}
