import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Cast wordmark — geometric, Outfit 900, with the trailing lime dot
 * that is the system signature (per docs/design/cast-brand-guidelines.html).
 */
export function Wordmark({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "font-display text-[1.75rem] font-black tracking-[-0.04em] leading-none",
        className,
      )}
      {...props}
    >
      Cast<span style={{ color: "var(--brand-lime-hex)" }}>.</span>
    </span>
  )
}
