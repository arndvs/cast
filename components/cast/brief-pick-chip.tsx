import type * as React from "react"
import { cn } from "@/lib/utils"

interface BriefPickChipProps {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}

export function BriefPickChip({ on, onClick, children, title }: BriefPickChipProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        on
          ? "border-brand-cyan bg-brand-cyan/10 text-fg-1"
          : "border-border bg-card text-fg-3 hover:bg-accent",
      )}
    >
      {on && <span className="text-brand-cyan">✓</span>}
      {children}
    </button>
  )
}
