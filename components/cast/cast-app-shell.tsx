"use client"

import * as React from "react"
import { toast } from "sonner"

import { BriefEditor } from "@/components/cast/brief-editor"
import { BriefSummaryStrip } from "@/components/cast/brief-summary-strip"
import { PipelineRunView } from "@/components/cast/pipeline-run-view"
import { CreativeOutputGrid } from "@/components/cast/creative-output-grid"
import { CreativeDetailDialog } from "@/components/cast/creative-detail-dialog"
import { MissingBrandBanner } from "@/components/cast/missing-brand-banner"
import { Topbar } from "@/components/cast/topbar"
import {
  castAppReducer,
  type CastAppAction,
  type CastAppState,
} from "@/components/cast/cast-app-state"
import { useRunController } from "@/hooks/use-run-controller"
import { useBrandProfile } from "@/hooks/use-brand-profile"
import type { Brief } from "@/lib/cast/schemas"
import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import type { BrandLoadErrorInfo } from "@/lib/cast/brand-hints"

interface CastAppShellProps {
  /** Server-loaded, schema-validated brief — feeds the reducer's initial state. */
  initialBrief: Brief
  /**
   * Logo variants + default id from the loaded brand profile. The page-level
   * server component is responsible for loading these via `loadBrandProfile`.
   * `null` when the brand fixture is missing or invalid — the editor renders
   * without the logo grid in that case and a `MissingBrandBanner` appears.
   *
   * `bannedWords` is the server-merged union of `getDefaultBannedWords()` +
   * `inputs/brands/[slug]/banned-words.json` (deduped, lowercased) — the
   * exact list `/api/generate`'s compliance pass will run against. The shell
   * uses it to pre-flight the brief and gate Generate before any spend.
   */
  brand: {
    defaultLogoId: string
    logoVariants: readonly ClientLogoVariant[]
    bannedWords: readonly string[]
  } | null
  /**
   * Serialization-safe descriptor of the brand-load failure (when `brand`
   * is `null`). Drives the banner rendered above the editor and gates the
   * Generate button. `null` when the brand loaded cleanly.
   */
  brandLoadError?: BrandLoadErrorInfo | null
  /** Slugs of brands present on disk — surfaced to the operator in the banner. */
  brandsAvailable?: readonly string[]
  /** Topbar crumb — forwarded from the server component. */
  crumb?: string
}

/**
 * Client shell — mounts the brief editor, pipeline run view, and output grid.
 *
 * Holds the reducer plus the run controller — when the user
 * hits Generate, `useRunController` POSTs the brief to `/api/generate`,
 * decodes the NDJSON stream, and dispatches each event back through the
 * reducer.
 *
 * Screen routing (`state.screen`), an explicit cancel ref handed
 * to the controller, and a `runError` toast effect.
 */
export function CastAppShell({
  initialBrief,
  brand,
  brandLoadError = null,
  brandsAvailable = [],
  crumb,
}: CastAppShellProps) {
  const [state, dispatch] = React.useReducer(
    castAppReducer,
    { brief: initialBrief, defaultLogoId: brand?.defaultLogoId ?? "" },
    makeInitial
  )
  const cancelRef = React.useRef<(() => void) | null>(null)
  useRunController(state, dispatch, cancelRef)

  const {
    activeBrand,
    activeBrandLoadError,
    brandLoadable,
    bannedList,
    bannedHits,
  } = useBrandProfile({
    brandSlug: state.brandSlug,
    initialBrand: brand,
    initialBrandLoadError: brandLoadError ?? null,
    initialSlug: initialBrief.brand,
    audience: state.brief.audience,
    message: state.brief.message,
  })

  // One toast per `run-error` transition. The reducer assigns a fresh
  // `runError` object each time, so identity-keyed effect deps fire exactly
  // once per failure. Surviving a screen switch is intentional — the toast
  // is fired from the shell so it's visible from the run view and from any
  // future edit-after-fail flow.
  React.useEffect(() => {
    if (!state.runError) return
    toast.error(state.runError.message, { description: state.runError.stage })
  }, [state.runError])

  return (
    <>
      <Topbar crumb={crumb} generating={state.runState === "running"} />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl">
          {state.screen === "brief-editor" && (
            <>
              {activeBrandLoadError && (
                <MissingBrandBanner
                  error={activeBrandLoadError}
                  brandsAvailable={brandsAvailable}
                />
              )}
              <BriefEditor
                state={state}
                dispatch={dispatch}
                logoVariants={activeBrand?.logoVariants ?? []}
                bannedList={bannedList}
                availableBrands={brandsAvailable}
              />
            </>
          )}
          {state.screen === "pipeline-run" && (
            <PipelineRunView
              state={state}
              dispatch={dispatch}
              cancelRef={cancelRef}
            />
          )}
          {state.screen === "output-grid" && (
            <CreativeOutputGrid state={state} dispatch={dispatch} />
          )}
        </div>
        {state.detailOpen !== null && (
          <CreativeDetailDialog state={state} dispatch={dispatch} />
        )}
      </main>
      {state.screen === "brief-editor" && (
        <BriefSummaryStrip
          state={state}
          dispatch={dispatch}
          brandLoadable={brandLoadable}
          bannedHits={bannedHits}
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
}): CastAppState {
  const logoVariant = brief.logoVariant ?? defaultLogoId
  return {
    brandSlug: brief.brand,
    brief: { ...brief, logoVariant },
    runState: "editing",
    uploads: {},
    logoVariant,
    events: [],
    manifest: null,
    runError: null,
    runStartedAt: new Date(),
    screen: "brief-editor",
    detailOpen: null,
  }
}

// Re-export for tree-shake-friendly imports from sibling components.
export type { CastAppAction, CastAppState }
