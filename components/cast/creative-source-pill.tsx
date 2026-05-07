import { cn } from "@/lib/utils"

interface CreativeSourcePillProps {
  source: "local" | "genai"
}

export function CreativeSourcePill({ source }: CreativeSourcePillProps) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        source === "local"
          ? "bg-brand-cyan/15 text-fg-1"
          : "bg-brand-lime/20 text-fg-1",
      )}
    >
      {source}
    </span>
  )
}
