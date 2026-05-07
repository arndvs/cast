import { Badge } from "@/components/ui/badge"
import type { RunState } from "@/components/cast/cast-app-state"

interface PipelineRunStatusBadgeProps {
  runState: RunState
}

export function PipelineRunStatusBadge({ runState }: PipelineRunStatusBadgeProps) {
  if (runState === "running") {
    return (
      <Badge variant="secondary" className="bg-brand-cyan/15 text-fg-1">
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-cyan" />
        running
      </Badge>
    )
  }
  if (runState === "complete") {
    return (
      <Badge variant="secondary" className="bg-ok/15 text-ok">
        ✓ completed
      </Badge>
    )
  }
  if (runState === "failed") {
    return (
      <Badge variant="destructive">✕ failed</Badge>
    )
  }
  return <Badge variant="outline">editing</Badge>
}
