"use client"

import * as React from "react"
import { CheckCircle2, AlertCircle, Info, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { PipelineState, PipelineLogEntry } from "@/lib/cast/types"

interface RunViewProps {
  state: PipelineState
}

const levelIcons = {
  info: Info,
  warn: AlertCircle,
  error: XCircle,
  success: CheckCircle2,
}

const levelColors = {
  info: "text-muted-foreground",
  warn: "text-yellow-500",
  error: "text-destructive",
  success: "text-emerald-500",
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function LogEntry({ entry }: { entry: PipelineLogEntry }) {
  const Icon = levelIcons[entry.level]
  
  return (
    <div className="flex items-start gap-3 py-2 font-mono text-sm">
      <span className="shrink-0 text-muted-foreground">
        {formatTimestamp(entry.timestamp)}
      </span>
      <Icon className={cn("mt-0.5 size-4 shrink-0", levelColors[entry.level])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {entry.step}
          </Badge>
          <span className={cn(levelColors[entry.level])}>{entry.message}</span>
        </div>
        {entry.details && (
          <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export function RunView({ state }: RunViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.logs.length])

  const statusLabel = {
    idle: "Ready",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
  }

  const statusColor = {
    idle: "bg-muted text-muted-foreground",
    running: "bg-primary text-primary-foreground",
    completed: "bg-emerald-500 text-white",
    failed: "bg-destructive text-white",
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Pipeline Run</CardTitle>
              <Badge className={statusColor[state.status]}>
                {state.status === "running" && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                {statusLabel[state.status]}
              </Badge>
            </div>
            <CardDescription>
              {state.startedAt && (
                <>Started: {new Date(state.startedAt).toLocaleString()}</>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {state.status === "running" ? state.currentStep : "Pipeline progress"}
              </span>
              <span className="font-medium">{state.progress}%</span>
            </div>
            <Progress value={state.progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Log Output */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Pipeline Log</CardTitle>
          <CardDescription>
            Real-time NDJSON streaming output
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] rounded-md border bg-muted/20 p-4" ref={scrollRef}>
            <div className="flex flex-col divide-y divide-border">
              {state.logs.map((entry, index) => (
                <LogEntry key={index} entry={entry} />
              ))}
            </div>
            {state.logs.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No logs yet. Start a pipeline run to see output.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error Display */}
      {state.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="size-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Pipeline Error</p>
                <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {state.status === "completed" && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-500">Pipeline Completed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All creatives have been generated successfully.
                  {state.completedAt && (
                    <> Completed at {new Date(state.completedAt).toLocaleTimeString()}.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
