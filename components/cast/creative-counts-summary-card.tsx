import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CreativeCountsSummaryCardProps {
  label: string
  value: number
  tone?: "ok" | "warn" | "bad"
}

export function CreativeCountsSummaryCard({ label, value, tone }: CreativeCountsSummaryCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-1 p-3",
        tone === "ok" && "border-ok/30",
        tone === "warn" && "border-warn/40",
        tone === "bad" && "border-bad/40",
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
        {label}
      </span>
      <span
        className={cn(
          "font-display text-2xl",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          !tone && "text-fg-1",
        )}
      >
        {value}
      </span>
    </Card>
  )
}
