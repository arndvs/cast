"use client"

import * as React from "react"
import { toast } from "sonner"

import { S1BriefEditor } from "@/components/cast/s1-brief-editor"
import { S1SummaryStrip } from "@/components/cast/s1-summary-strip"
import { S2RunView } from "@/components/cast/s2-run-view"
import { MissingBrandBanner } from "@/components/cast/missing-brand-banner"
import { s1Reducer, type S1Action, type S1State } from "@/components/cast/s1-state"
import { useRunController } from "@/components/cast/use-run-controller"
import type { Brief } from "@/lib/cast/schemas"
import type { ClientLogoVariant } from "@/components/cast/s1-state"
import type { BrandLoadErrorInfo } from "@/lib/cast/brand-hints"

interface S1ShellProps {
  /** Server-loaded, schema-validated brief — feeds the reducer's initial state. */
  initialBrief: Brief
  /**
   * Logo variants + default id from the loaded brand profile. The page-level
   * server component is responsible for loading these via `loadBrandProfile`.
   * `null` when the brand fixture is missing or invalid — the editor renders
   * without the logo grid in that case and a `MissingBrandBanner` appears.
   */
  brand: { defaultLogoId: string; logoVariants: readonly ClientLogoVariant[] } | null
  /**
   * Serialization-safe descriptor of the brand-load failure (when `brand`
   * is `null`). Drives the banner rendered above the editor and gates the
   * Generate button. `null` when the brand loaded cleanly.
   */
  brandLoadError?: BrandLoadErrorInfo | null
  /** Slugs of brands present on disk — surfaced to the operator in the banner. */
  brandsAvailable?: readonly string[]
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
export function S1Shell({
  initialBrief,
  brand,
  brandLoadError = null,
  brandsAvailable = [],
}: S1ShellProps) {
  const [state, dispatch] = React.useReducer(
    s1Reducer,
    { brief: initialBrief, defaultLogoId: brand?.defaultLogoId ?? "" },
    makeInitial,
  )
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

  const brandLoadable = brandLoadError == null

  return (
    <>
      <main className="flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {state.screen === "S1" && (
            <>
              {brandLoadError && (
                <MissingBrandBanner
                  error={brandLoadError}
                  brandsAvailable={brandsAvailable}
                />
              )}
              <S1BriefEditor
                state={state}
                dispatch={dispatch}
                logoVariants={brand?.logoVariants ?? []}
              />
            </>
          )}
          {state.screen === "S2" && (
            <S2RunView state={state} dispatch={dispatch} cancelRef={cancelRef} />
          )}
          {state.screen === "S3" && null}
        </div>
      </main>
      {state.screen === "S1" && (
        <S1SummaryStrip
          state={state}
          dispatch={dispatch}
          brandLoadable={brandLoadable}
        />
      )}
    </>
  )
}

function makeInitial({
  brief,
  defaultLogoId,
}: {
  brief: Brief
  defaultLogoId: string
}): S1State {
  return {
    brandSlug: brief.brand,
    brief,
    runState: "editing",
    uploads: {},
    logoVariant: defaultLogoId,
    events: [],
    manifest: null,
    runError: null,
    screen: "S1",
  }
}

// Re-export for tree-shake-friendly imports from sibling components.
export type { S1Action, S1State }
