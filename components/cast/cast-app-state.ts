/**
 * S1 brief-editor state machine and reducer.
 *
 * Ports `docs/prototype/cast-app.jsx` reducer to TypeScript and adapts it to
 * the locked `briefSchema` shape (the prototype's `messageByLocale` /
 * `headline` / `subheadline` / `cta` are prototype-only — the schema's
 * `message: Record<lang, string>` IS the per-locale headline).
 *
 * State machine:
 *   editing → running → (complete | failed)
 *               ↑___________________________|   (retry)

 */

import { ALL_RATIOS, type AspectRatio } from "@/lib/cast/ratios"
import { getMarket } from "@/lib/cast/markets"
import {
  type Brief,
  type Creative,
  type ErrorStage,
  type Manifest,
} from "@/lib/cast/schemas"
import type { PipelineEvent } from "@/lib/cast/events"

/**
 * Reasons a run can terminally fail. Pipeline-stage failures map to the
 * canonical `ErrorStage` enum; `"stream"` covers transport-level faults the
 * client synthesizes (idle abort, NDJSON parse errors, content-type mismatch);
 * `"validation"` covers server-side 4xx responses where the server returned
 * JSON instead of opening the NDJSON stream.
 */
export type RunErrorStage = ErrorStage | "stream" | "validation"
// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type RunState = "editing" | "running" | "complete" | "failed"

/**
 * Which screen is mounted. Independent of `runState` — the terminal
 * `complete` event leaves `screen: "pipeline-run"` until the user clicks
 * "view output grid →" (matches prototype). `goto-edit` resets both.
 */
export type AppScreen = "brief-editor" | "pipeline-run" | "output-grid"

/**
 * Logo variant id. Each brand's `logos.json` manifest declares its own
 * variant ids; the type is intentionally `string` (validated against
 * `SLUG_RE` at boundaries) so manifests with N variants are accepted.
 */

/**
 * Client-safe logo variant. The server's `BrandProfile.logoVariants[*]`
 * carries an absolute filesystem `path` resolved via `safeJoin` — that
 * field must NOT cross the server→client boundary. The page-level server
 * component projects to this shape before passing to `CastAppShell`.
 */
export interface ClientLogoVariant {
  id: string
  displayName: string
  theme?: "light" | "dark"
}

/**
 * In-memory upload preview.
 *
 * The dropzone holds an object-URL preview in this
 * map. The upload route replaces the
 * `objectUrl` with a `savedAs` path returned by the server.
 *
 * The object URL must be revoked on remove (handled in the dropzone unmount /
 * `removeUpload` action consumer).
 */
export interface UploadPreview {
  fileName: string
  /** `URL.createObjectURL(file)` — local-only, revoke before discarding. */
  objectUrl: string
  size: number
  type: string
}

export interface CastAppState {
  /** Slug of the active brand (`brisa`, `volt`, …). */
  brandSlug: string
  /** The brief being edited — same shape as `briefSchema`. */
  brief: Brief
  runState: RunState
  /** Per-product slug → preview. Slug is derived via `slugify(product.name)`. */
  uploads: Record<string, UploadPreview>
  /** Sidebar logo-variant picker — surfaces as `brief.logoVariant` on submit. */
  logoVariant: string
  /** NDJSON event tape from `/api/generate`. The pipeline run view renders this. */
  events: PipelineEvent[]
  /** Final run manifest — set when the terminal `complete` event arrives. */
  manifest: Manifest | null
  /** Last terminal failure (network, validation, idle abort). */
  runError: { stage: RunErrorStage; message: string } | null
  /** Wall-clock timestamp of the most recent run start — set when `generate` dispatches. */
  runStartedAt: Date
  /** Which screen is mounted. Default `"brief-editor"`. */
  screen: AppScreen
  /**
   * Detail dialog target. `null` when closed. The reducer owns the
   * open/close transitions.
   */
  detailOpen: Creative | null
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type CastAppAction =
  | { type: "setBrand"; slug: string; brief: Brief }
  | { type: "setField"; field: "campaign" | "audience"; value: string }
  | { type: "setLocaleMessage"; lang: string; value: string }
  | { type: "toggleMarket"; code: string }
  | { type: "toggleRatio"; value: AspectRatio }
  | { type: "addProduct"; product: { name: string; sku: string } }
  | { type: "removeProduct"; sku: string }
  | { type: "setLogoVariant"; id: string }
  | { type: "upload"; productSlug: string; preview: UploadPreview }
  | { type: "removeUpload"; productSlug: string }
  | { type: "replaceBrief"; brief: Brief }
  | { type: "generate" }
  | { type: "pipeline-event"; event: PipelineEvent }
  | { type: "run-error"; stage: RunErrorStage; message: string }
  | { type: "run-reset" }
  | { type: "goto-run" }
  | { type: "goto-grid" }
  | { type: "goto-edit" }
  | { type: "open-detail"; creative: Creative }
  | { type: "close-detail" }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function castAppReducer(state: CastAppState, action: CastAppAction): CastAppState {
  switch (action.type) {
    case "setBrand":
      // Brand swap discards uploads — different products, different slugs.
      // Normalize `brief.brand` to the selected slug so the JSON mirror and a
      // submitted brief never disagree with `brandSlug`.
      return {
        ...state,
        brandSlug: action.slug,
        brief: { ...action.brief, brand: action.slug },
        uploads: revokeAll(state.uploads),
        runState: "editing",
      }
    case "setField":
      return { ...state, brief: { ...state.brief, [action.field]: action.value } }
    case "setLocaleMessage":
      return {
        ...state,
        brief: {
          ...state.brief,
          message: { ...state.brief.message, [action.lang]: action.value },
        },
      }
    case "toggleMarket": {
      const { code } = action
      const has = state.brief.markets.includes(code)
      const markets = has
        ? state.brief.markets.filter((m) => m !== code)
        : [...state.brief.markets, code]
      // Seed an empty message slot for any newly added language — locale
      // completeness is enforced by the schema; prefill keeps the UI honest.
      const message = { ...state.brief.message }
      if (!has) {
        const lang = getMarket(code)?.language ?? code.split("-").pop()
        if (lang && !(lang in message)) message[lang] = ""
      }
      return { ...state, brief: { ...state.brief, markets, message } }
    }
    case "toggleRatio": {
      const has = state.brief.ratios.includes(action.value)
      // Preserve canonical order rather than insertion order.
      const ratios = has
        ? state.brief.ratios.filter((r) => r !== action.value)
        : ALL_RATIOS.filter((r) => state.brief.ratios.includes(r) || r === action.value)
      return { ...state, brief: { ...state.brief, ratios } }
    }
    case "addProduct": {
      if (state.brief.products.some((p) => p.sku === action.product.sku)) return state
      return {
        ...state,
        brief: {
          ...state.brief,
          products: [...state.brief.products, action.product],
        },
      }
    }
    case "removeProduct": {
      // Also drop any preview for products no longer in the brief.
      const stillUsed = new Set(
        state.brief.products
          .filter((p) => p.sku !== action.sku)
          .map((p) => slugifyName(p.name)),
      )
      const uploads: Record<string, UploadPreview> = {}
      for (const [slug, prev] of Object.entries(state.uploads)) {
        if (stillUsed.has(slug)) uploads[slug] = prev
        else URL.revokeObjectURL(prev.objectUrl)
      }
      return {
        ...state,
        brief: {
          ...state.brief,
          products: state.brief.products.filter((p) => p.sku !== action.sku),
        },
        uploads,
      }
    }
    case "setLogoVariant":
      // Mirror the picker selection into `brief.logoVariant` so the
      // submitted brief carries it through to `/api/generate`. Schema
      // already validates against `SLUG_RE`; the editor still keeps
      // `state.logoVariant` as the canonical UI source.
      return {
        ...state,
        logoVariant: action.id,
        brief: { ...state.brief, logoVariant: action.id },
      }
    case "upload": {
      // Replace any existing preview for that slug, revoking the old URL.
      const prev = state.uploads[action.productSlug]
      if (prev) URL.revokeObjectURL(prev.objectUrl)
      return {
        ...state,
        uploads: { ...state.uploads, [action.productSlug]: action.preview },
      }
    }
    case "removeUpload": {
      const prev = state.uploads[action.productSlug]
      if (!prev) return state
      URL.revokeObjectURL(prev.objectUrl)
      const { [action.productSlug]: _drop, ...rest } = state.uploads
      void _drop
      return { ...state, uploads: rest }
    }
    case "replaceBrief":
      return { ...state, brief: action.brief }
    case "generate":
    case "goto-run":
      // Flip to running and clear any previous run's artifacts. The
      // shell's run-effect picks up the transition and opens the NDJSON
      // stream against `/api/generate`. Also flip the screen to pipeline-run
      // so the run view mounts as the network call starts.
      return {
        ...state,
        runState: "running",
        runStartedAt: new Date(),
        events: [],
        manifest: null,
        runError: null,
        screen: "pipeline-run",
      }
    case "goto-grid":
      // Only meaningful once the run has terminally completed. Ignored
      // otherwise so a stray dispatch can't strand the user on an empty grid.
      if (state.runState !== "complete") return state
      return { ...state, screen: "output-grid" }
    case "goto-edit":
      // Discard the prior run's artifacts and return the editor to the
      // initial `editing` state. Brief, brand, uploads stay intact.
      // Also close any open detail dialog so it doesn't reappear on re-run.
      return {
        ...state,
        screen: "brief-editor",
        runState: "editing",
        events: [],
        manifest: null,
        runError: null,
        detailOpen: null,
      }
    case "open-detail":
      return { ...state, detailOpen: action.creative }
    case "close-detail":
      return { ...state, detailOpen: null }
    case "pipeline-event": {
      const events = [...state.events, action.event]
      if (action.event.type === "complete") {
        return {
          ...state,
          events,
          manifest: action.event.manifest,
          runState: "complete",
        }
      }
      return { ...state, events }
    }
    case "run-error":
      return {
        ...state,
        runState: "failed",
        runError: { stage: action.stage, message: action.message },
      }
    case "run-reset":
      return {
        ...state,
        runState: "editing",
        events: [],
        manifest: null,
        runError: null,
      }
    default: {
      const _exhaustive: never = action
      void _exhaustive
      return state
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revokeAll(uploads: Record<string, UploadPreview>): Record<string, UploadPreview> {
  for (const prev of Object.values(uploads)) URL.revokeObjectURL(prev.objectUrl)
  return {}
}

/**
 * Inline copy of `slugify` to avoid importing `lib/cast/schemas` (and zod)
 * into hot reducer paths — the canonical implementation lives there.
 */
function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
