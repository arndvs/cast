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
 *
 * V2 only ships the `editing` slice. `running`, `complete`, `failed`,
 * `detailOpen`, and `pipeline-event` land in V4/V5.
 */

import { ALL_RATIOS, type AspectRatio } from "@/lib/cast/ratios"
import { getMarket } from "@/lib/cast/markets"
import { type Brief } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type RunState = "editing" | "running" | "complete" | "failed"

export type LogoVariantId =
  | "primary-on-light"
  | "primary-on-dark"
  | "mono-white"
  | "mono-black"

/**
 * In-memory upload preview for V2.
 *
 * V2 has no upload route — the dropzone holds an object-URL preview in this
 * map. V3 swaps the preview for a real `/api/upload` POST and replaces the
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

export interface S1State {
  /** Slug of the active brand (`brisa`, `volt`, …). */
  brandSlug: string
  /** The brief being edited — same shape as `briefSchema`. */
  brief: Brief
  runState: RunState
  /** Per-product slug → preview. Slug is derived via `slugify(product.name)`. */
  uploads: Record<string, UploadPreview>
  /** Sidebar logo-variant picker — surfaces as `brief.logoVariant` on submit. */
  logoVariant: LogoVariantId
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type S1Action =
  | { type: "setBrand"; slug: string; brief: Brief }
  | { type: "setField"; field: "campaign" | "audience"; value: string }
  | { type: "setLocaleMessage"; lang: string; value: string }
  | { type: "toggleMarket"; code: string }
  | { type: "toggleRatio"; value: AspectRatio }
  | { type: "addProduct"; product: { name: string; sku: string } }
  | { type: "removeProduct"; sku: string }
  | { type: "setLogoVariant"; id: LogoVariantId }
  | { type: "upload"; productSlug: string; preview: UploadPreview }
  | { type: "removeUpload"; productSlug: string }
  | { type: "replaceBrief"; brief: Brief }
  | { type: "generate" }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function s1Reducer(state: S1State, action: S1Action): S1State {
  switch (action.type) {
    case "setBrand":
      // Brand swap discards uploads — different products, different slugs.
      return {
        ...state,
        brandSlug: action.slug,
        brief: action.brief,
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
      // Seed an empty message slot for any newly added language (D11 — locale
      // completeness is enforced by the schema; prefill keeps the UI honest).
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
      return { ...state, logoVariant: action.id }
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
      // V4 will flip this to runState='running' + open the NDJSON stream.
      return { ...state, runState: "running" }
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
