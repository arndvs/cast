/**
 * Shared UI types used across CAST components. Extracted from
 * `cast-app-state.ts` so consumers can import lightweight type-only
 * modules without pulling in the reducer.
 */

export type RunState = "editing" | "running" | "complete" | "failed"

/**
 * Which screen is mounted. Independent of `runState` — the terminal
 * `complete` event leaves `screen: "pipeline-run"` until the user clicks
 * "view output grid →" (matches prototype). `goto-edit` resets both.
 */
export type AppScreen = "brief-editor" | "pipeline-run" | "output-grid"

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
  /** Proxy URL that serves the logo PNG — e.g. `/api/brands/{slug}/logos/{id}`. */
  url?: string
}

/**
 * In-memory upload preview.
 *
 * The dropzone holds an object-URL preview in this map. The upload route
 * replaces the `objectUrl` with a `savedAs` path returned by the server.
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
