import * as React from "react"

import { Wordmark } from "@/components/cast/wordmark"
import { cn } from "@/lib/utils"

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Breadcrumb / route label rendered in mono next to the wordmark. */
  crumb?: string
  /** When true, the wordmark shows "Casting..." with animated dots. */
  generating?: boolean
}

/**
 * Cast topbar — wordmark + studio tagline on the left, mono crumb on
 * the right.
 */
export function Topbar({ crumb, generating, className, ...props }: TopbarProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-6 border-b border-border bg-background px-8 py-4",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-6">
        <Wordmark generating={generating} />
      </div>
      <div className="flex items-center gap-3">
        {crumb ? (
          <span className="truncate font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {crumb}
          </span>
        ) : null}
      </div>
    </header>
  )
}
