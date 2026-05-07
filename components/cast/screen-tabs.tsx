"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { AppScreen, RunState } from "@/lib/cast/app-types"
import type { CastAppAction } from "@/components/cast/cast-app-state"

interface ScreenTabsProps {
  screen: AppScreen
  runState: RunState
  outputCount?: number
  dispatch: React.Dispatch<CastAppAction>
}

const TABS: { id: AppScreen; label: string }[] = [
  { id: "brief-editor", label: "Brief" },
  { id: "pipeline-run", label: "Run" },
  { id: "output-grid", label: "Outputs" },
]

export function ScreenTabs({ screen, runState, outputCount, dispatch }: ScreenTabsProps) {
  return (
    <nav className="sticky top-0 z-10 flex h-10 items-center border-b border-border bg-background px-8">
      {TABS.map((tab) => {
        const isActive = screen === tab.id
        const isDisabled =
          (tab.id === "pipeline-run" && runState === "editing") ||
          (tab.id === "output-grid" && runState !== "complete")

        return (
          <button
            key={tab.id}
            className={cn(
              "relative inline-flex h-10 items-center gap-2 border-b-2 px-4 text-[13px] font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
              isDisabled && "pointer-events-none opacity-40",
            )}
            disabled={isDisabled}
            onClick={() => dispatch({ type: "set-screen", screen: tab.id })}
          >
            {tab.label}
            {tab.id === "pipeline-run" && <RunDot runState={runState} />}
            {tab.id === "output-grid" && outputCount != null && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-[10px] leading-4">
                {outputCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

function RunDot({ runState }: { runState: RunState }) {
  if (runState === "editing") return null

  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        runState === "running" && "animate-pulse bg-primary",
        runState === "complete" && "bg-ok",
        runState === "failed" && "bg-bad",
      )}
    />
  )
}
