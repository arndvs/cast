import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Cast wordmark — geometric, Outfit 900, with the trailing lime dot
 * that is the system signature (per docs/design/cast-brand-guidelines.html).
 *
 * When `generating` is true the text reads "Casting" and the dot becomes an
 * animated three-dot typing indicator (iMessage-style "...") to communicate
 * that the pipeline is actively running.
 */
export function Wordmark({
  generating = false,
  className,
  ...props
}: { generating?: boolean } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "font-display text-[1.75rem] font-black tracking-[-0.04em] leading-none",
        className,
      )}
      aria-label={generating ? "Cast — generating" : undefined}
      {...props}
    >
      {generating ? "Casting" : "Cast"}
      {generating ? (
        <span className="inline-flex gap-[1px]" aria-hidden="true">
          <span className="animate-dot-pulse text-[var(--brand-lime-hex)]" style={{ animationDelay: "0ms" }}>.</span>
          <span className="animate-dot-pulse text-[var(--brand-lime-hex)]" style={{ animationDelay: "150ms" }}>.</span>
          <span className="animate-dot-pulse text-[var(--brand-lime-hex)]" style={{ animationDelay: "300ms" }}>.</span>
        </span>
      ) : (
        <span style={{ color: "var(--brand-lime-hex)" }}>.</span>
      )}
    </span>
  )
}
