import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/cast/theme-toggle"
import { Wordmark } from "@/components/cast/wordmark"
import { cn } from "@/lib/utils"

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Breadcrumb / route label rendered in mono next to the wordmark. */
  crumb?: string
}

/**
 * Cast topbar — wordmark on the left, mono crumb in the middle,
 * GenAI mode badge on the right. Mode reads from
 * NEXT_PUBLIC_CAST_GENAI_MODE at build time (default: "default").
 */
export function Topbar({ crumb, className, ...props }: TopbarProps) {
  const mode = process.env.NEXT_PUBLIC_CAST_GENAI_MODE ?? "default"

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-6 border-b border-border bg-background px-8 py-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-6 min-w-0">
        <Wordmark />
        {crumb ? (
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground truncate">
            {crumb}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Badge
          variant="outline"
          className="font-mono text-[0.6875rem] uppercase tracking-[0.12em]"
        >
          mode · {mode}
        </Badge>
      </div>
    </header>
  )
}
