"use client"

import * as React from "react"

import { S1BriefEditor } from "@/components/cast/s1-brief-editor"
import { S1SummaryStrip } from "@/components/cast/s1-summary-strip"
import { s1Reducer, type S1State } from "@/components/cast/s1-state"
import type { Brief } from "@/lib/cast/schemas"

interface S1ShellProps {
  /** Server-loaded, schema-validated brief — feeds the reducer's initial state. */
  initialBrief: Brief
}

/**
 * Client shell for S1.
 *
 * Holds the reducer (the contract is the prototype's reducer; see
 * `components/cast/s1-state.ts`). V4 will lift the run controller (`fetch`
 * to `/api/generate`, NDJSON pipe) up to here.
 */
export function S1Shell({ initialBrief }: S1ShellProps) {
  const [state, dispatch] = React.useReducer(s1Reducer, initialBrief, makeInitial)

  return (
    <>
      <main className="flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <S1BriefEditor state={state} dispatch={dispatch} />
        </div>
      </main>
      <S1SummaryStrip state={state} dispatch={dispatch} />
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
  }
}
