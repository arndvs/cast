"use client"

import * as React from "react"
import { toast } from "sonner"

import { S1BriefEditor } from "@/components/cast/s1-brief-editor"
import { S1SummaryStrip } from "@/components/cast/s1-summary-strip"
import { S2RunView } from "@/components/cast/s2-run-view"
import { s1Reducer, type S1Action, type S1State } from "@/components/cast/s1-state"
import { useRunController } from "@/components/cast/use-run-controller"
import type { Brief } from "@/lib/cast/schemas"

interface S1ShellProps {
  /** Server-loaded, schema-validated brief — feeds the reducer's initial state. */
  initialBrief: Brief
}

/**
 * Client shell for S1/S2/S3.
 *
 * Holds the reducer (the contract is the prototype's reducer; see
 * `components/cast/s1-state.ts`) plus the V4 run controller — when the user
 * hits Generate, `useRunController` POSTs the brief to `/api/generate`,
 * decodes the NDJSON stream, and dispatches each event back through the
 * reducer.
 *
 * V5c adds screen routing (`state.screen`), an explicit cancel ref handed
 * to the controller, and a `runError` toast effect.
 */
export function S1Shell({ initialBrief }: S1ShellProps) {
  const [state, dispatch] = React.useReducer(s1Reducer, initialBrief, makeInitial)
  const cancelRef = React.useRef<(() => void) | null>(null)
  useRunController(state, dispatch, cancelRef)

  // One toast per `run-error` transition. The reducer assigns a fresh
  // `runError` object each time, so identity-keyed effect deps fire exactly
  // once per failure. Surviving a screen switch is intentional — the toast
  // is fired from the shell so it's visible from S2 and from any future S1
  // edit-after-fail flow.
  React.useEffect(() => {
    if (!state.runError) return
    toast.error(state.runError.message, { description: state.runError.stage })
  }, [state.runError])

  return (
    <>
      <main className="flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {state.screen === "S1" && (
            <S1BriefEditor state={state} dispatch={dispatch} />
          )}
          {state.screen === "S2" && (
            <S2RunView state={state} dispatch={dispatch} cancelRef={cancelRef} />
          )}
          {state.screen === "S3" && null}
        </div>
      </main>
      {state.screen === "S1" && <S1SummaryStrip state={state} dispatch={dispatch} />}
    </>
  )
}

function makeInitial(brief: Brief): S1State {
  return {
    brandSlug: brief.brand,
    brief,
    runState: "editing",
    uploads: {},
    logoVariant: "primary-on-light",
    events: [],
    manifest: null,
    runError: null,
    screen: "S1",
  }
}

// Re-export for tree-shake-friendly imports from sibling components.
export type { S1Action, S1State }
