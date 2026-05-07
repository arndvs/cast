"use client"

import * as React from "react"
import { toast } from "sonner"

import { BriefEditor } from "@/components/cast/brief-editor"
import { BriefSummaryStrip } from "@/components/cast/brief-summary-strip"
import { PipelineRunView } from "@/components/cast/pipeline-run-view"
import { CreativeOutputGrid } from "@/components/cast/creative-output-grid"
import { CreativeDetailDialog } from "@/components/cast/creative-detail-dialog"
import { MissingBrandBanner } from "@/components/cast/missing-brand-banner"
import {
  castAppReducer,
  type CastAppAction,
  type CastAppState,
} from "@/components/cast/cast-app-state"
import { useRunController } from "@/components/cast/use-run-controller"
import type { Brief } from "@/lib/cast/schemas"
import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import type { BrandLoadErrorInfo } from "@/lib/cast/brand-hints"
import {
  containsBannedWord,
  getDefaultBannedWords,
} from "@/lib/cast/banned-words"

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
}: CastAppShellProps) {
  const [state, dispatch] = React.useReducer(
    castAppReducer,
    { brief: initialBrief, defaultLogoId: brand?.defaultLogoId ?? "" },
    makeInitial
  )
  const cancelRef = React.useRef<(() => void) | null>(null)
  useRunController(state, dispatch, cancelRef)

  // Re-fetch the brand profile whenever the user switches brands client-side.
  // The server-provided `brand` prop is a snapshot of the initial slug only —
  // switching brands dispatches setBrand which changes state.brandSlug, but the
  // prop never updates. Without this effect bannedList and logoVariants stay
  // bound to the initial brand and the compliance gate silently uses the wrong
  // word list desync).
  const [activeBrand, setActiveBrand] = React.useState(brand)
  const [activeBrandLoadError, setActiveBrandLoadError] =
    React.useState<BrandLoadErrorInfo | null>(brandLoadError ?? null)
  // Tracks which slug the current activeBrand/activeBrandLoadError was
  // fetched for. While a slug change is in-flight, loadedSlug differs from
  // state.brandSlug — derived values treat the brand as unavailable without
  // needing a synchronous setState in the effect body.
  const [loadedSlug, setLoadedSlug] = React.useState(initialBrief.brand)

  React.useEffect(() => {
    // Fetch on every brandSlug change (including mount). The brand loader has
    // a 90 s in-memory cache, so the initial mount fetch is cheap.
    // Staleness: AbortController cancels the in-flight request on rapid slug
    // changes; the cancelled boolean guards .then() for the window between
    // fetch-resolved and abort (abort() does not cancel an already-resolved promise).
    // Immediate-clear window: while loadedSlug !== state.brandSlug the derived
    // brandLoadable/bannedList treat the brand as unavailable — no synchronous
    // setState needed (which would violate react-hooks/set-state-in-effect).
    const controller = new AbortController()
    let cancelled = false
    const slug = state.brandSlug
    fetch(`/api/brands/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as {
            kind?: "notFound" | "incomplete" | "invalid"
            missing?: string
            file?: string
            errors?: { path?: (string | number)[]; message: string }[]
          }
          if (cancelled) return
          const message = body.errors?.[0]?.message ??
            `Failed to load brand "${slug}" (HTTP ${res.status})`
          setActiveBrand(null)
          if (body.kind === "incomplete" && typeof body.missing === "string") {
            setActiveBrandLoadError({ kind: "incomplete", slug, message, missing: body.missing })
          } else if (body.kind === "invalid" && typeof body.file === "string") {
            const issues = (body.errors ?? []).map((e) => ({
              path: (e.path ?? []).slice(2),
              message: e.message,
            }))
            setActiveBrandLoadError({ kind: "invalid", slug, message, file: body.file, issues })
          } else {
            setActiveBrandLoadError({ kind: "notFound", slug, message })
          }
          setLoadedSlug(slug)
          return
        }
        const data = await res.json() as {
          bannedWords: readonly string[]
          logos: {
            default: string
            variants: Array<{ id: string; displayName: string; theme?: "light" | "dark" }>
          }
        }
        if (cancelled) return
        setActiveBrand({
          defaultLogoId: data.logos.default,
          logoVariants: data.logos.variants.map(({ id, displayName, theme }) => ({
            id,
            displayName,
            theme,
          })),
          bannedWords: data.bannedWords,
        })
        setActiveBrandLoadError(null)
        setLoadedSlug(slug)
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return
        if (cancelled) return
        setActiveBrand(null)
        setActiveBrandLoadError({
          kind: "notFound",
          slug,
          message: err instanceof Error ? err.message : `Network error loading brand "${slug}"`,
        })
        setLoadedSlug(slug)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [state.brandSlug])
  // One toast per `run-error` transition. The reducer assigns a fresh
  // `runError` object each time, so identity-keyed effect deps fire exactly
  // once per failure. Surviving a screen switch is intentional — the toast
  // is fired from the shell so it's visible from the run view and from any
  // future edit-after-fail flow.
  React.useEffect(() => {
    if (!state.runError) return
    toast.error(state.runError.message, { description: state.runError.stage })
  }, [state.runError])

  // Gated on loadedSlug match so the in-flight window after a brand switch
  // is treated as unavailable (Generate stays blocked until fetch settles).
  const brandLoadable = loadedSlug === state.brandSlug && activeBrandLoadError == null

  // Single source of truth for the banned-word list. The server
  // already merges `getDefaultBannedWords()` with the brand fixture at
  // `inputs/brands/[slug]/banned-words.json` inside `loadBrandProfile`,
  // so we just forward `activeBrand.bannedWords` here. When the brand fixture
  // failed to load, fall back to the universal floor so the gate still
  // catches obvious hits even though Generate is already blocked by
  // `brandLoadable`. `activeBrand` is kept in sync with `state.brandSlug`
  // via the useEffect above, so brand switches update both lists together.
  const bannedList = React.useMemo<readonly string[]>(
    () =>
      loadedSlug === state.brandSlug
        ? (activeBrand?.bannedWords ?? getDefaultBannedWords())
        : getDefaultBannedWords(),
    [activeBrand?.bannedWords, loadedSlug, state.brandSlug]
  )
  // The editor and the summary strip both read from the same list above:
  // the strip via `bannedHits`, the editor via the `bannedList` prop. This
  // keeps the inline ⚠ badge and the Generate gate consistent and prevents
  // the "generation succeeded, compliance FAILED, demo wasted" loop.
  const bannedHits = React.useMemo(() => {
    const haystack = [
      state.brief.audience,
      ...Object.values(state.brief.message),
    ].join(" ")
    return containsBannedWord(haystack, bannedList)
  }, [bannedList, state.brief.audience, state.brief.message])

  return (
    <>
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
  return {
    brandSlug: brief.brand,
    brief,
    runState: "editing",
    uploads: {},
    logoVariant: defaultLogoId,
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
