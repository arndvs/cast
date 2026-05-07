"use client"

import * as React from "react"

import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import type { BrandLoadErrorInfo } from "@/lib/cast/brand-hints"
import {
  containsBannedWord,
  getDefaultBannedWords,
} from "@/lib/cast/banned-words"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandSnapshot {
  defaultLogoId: string
  logoVariants: readonly ClientLogoVariant[]
  bannedWords: readonly string[]
}

interface UseBrandProfileArgs {
  /** Current brand slug from state — triggers re-fetch on change. */
  brandSlug: string
  /** Server-loaded brand snapshot (initial render only). */
  initialBrand: BrandSnapshot | null
  /** Server-loaded error info (initial render only). */
  initialBrandLoadError: BrandLoadErrorInfo | null
  /** Slug the server snapshot was loaded for (usually `initialBrief.brand`). */
  initialSlug: string
  /** Brief audience string — checked against banned words. */
  audience: string
  /** Brief locale→message map — checked against banned words. */
  message: Record<string, string>
  /** Fires after a brand profile is fetched — use to auto-select the default logo. */
  onBrandLoaded?: (brand: BrandSnapshot) => void
}

interface UseBrandProfileResult {
  activeBrand: BrandSnapshot | null
  activeBrandLoadError: BrandLoadErrorInfo | null
  brandLoadable: boolean
  bannedList: readonly string[]
  bannedHits: string[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the brand profile lifecycle: fetches/re-fetches when `brandSlug`
 * changes, derives the merged banned-word list, and pre-flights the brief
 * text for banned-word hits.
 */
export function useBrandProfile({
  brandSlug,
  initialBrand,
  initialBrandLoadError,
  initialSlug,
  audience,
  message,
  onBrandLoaded,
}: UseBrandProfileArgs): UseBrandProfileResult {
  // Store callback in a ref so the fetch effect only re-runs on brandSlug
  // changes, not when the caller passes a new function identity.
  const onBrandLoadedRef = React.useRef(onBrandLoaded)
  React.useEffect(() => {
    onBrandLoadedRef.current = onBrandLoaded
  })

  const [activeBrand, setActiveBrand] = React.useState(initialBrand)
  const [activeBrandLoadError, setActiveBrandLoadError] =
    React.useState<BrandLoadErrorInfo | null>(initialBrandLoadError)
  const [loadedSlug, setLoadedSlug] = React.useState(initialSlug)

  React.useEffect(() => {
    // Skip fetch when initial server data already matches the current slug
    if (brandSlug === loadedSlug) return

    const controller = new AbortController()
    let cancelled = false
    fetch(`/api/brands/${encodeURIComponent(brandSlug)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            kind?: "notFound" | "incomplete" | "invalid"
            missing?: string
            file?: string
            errors?: { path?: (string | number)[]; message: string }[]
          }
          if (cancelled) return
          const errorMessage =
            body.errors?.[0]?.message ??
            `Failed to load brand "${brandSlug}" (HTTP ${res.status})`
          setActiveBrand(null)
          if (body.kind === "incomplete" && typeof body.missing === "string") {
            setActiveBrandLoadError({
              kind: "incomplete",
              slug: brandSlug,
              message: errorMessage,
              missing: body.missing,
            })
          } else if (
            body.kind === "invalid" &&
            typeof body.file === "string"
          ) {
            const issues = (body.errors ?? []).map((e) => ({
              path: (e.path ?? []).slice(2),
              message: e.message,
            }))
            setActiveBrandLoadError({
              kind: "invalid",
              slug: brandSlug,
              message: errorMessage,
              file: body.file,
              issues,
            })
          } else {
            setActiveBrandLoadError({
              kind: "notFound",
              slug: brandSlug,
              message: errorMessage,
            })
          }
          setLoadedSlug(brandSlug)
          return
        }
        const data = (await res.json()) as {
          bannedWords: readonly string[]
          logos: {
            default: string
            variants: Array<{
              id: string
              displayName: string
              theme?: "light" | "dark"
              url?: string
            }>
          }
        }
        if (cancelled) return
        const snapshot: BrandSnapshot = {
          defaultLogoId: data.logos.default,
          logoVariants: data.logos.variants.map(
            ({ id, displayName, theme, url }) => ({ id, displayName, theme, url }),
          ),
          bannedWords: data.bannedWords,
        }
        setActiveBrand(snapshot)
        setActiveBrandLoadError(null)
        setLoadedSlug(brandSlug)
        onBrandLoadedRef.current?.(snapshot)
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return
        if (cancelled) return
        setActiveBrand(null)
        setActiveBrandLoadError({
          kind: "notFound",
          slug: brandSlug,
          message:
            err instanceof Error
              ? err.message
              : `Network error loading brand "${brandSlug}"`,
        })
        setLoadedSlug(brandSlug)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [brandSlug])

  const brandLoadable =
    loadedSlug === brandSlug && activeBrandLoadError == null

  const bannedList = React.useMemo<readonly string[]>(
    () =>
      loadedSlug === brandSlug
        ? (activeBrand?.bannedWords ?? getDefaultBannedWords())
        : getDefaultBannedWords(),
    [activeBrand?.bannedWords, loadedSlug, brandSlug],
  )

  const bannedHits = React.useMemo(() => {
    const haystack = [audience, ...Object.values(message)].join(" ")
    return containsBannedWord(haystack, bannedList)
  }, [bannedList, audience, message])

  return {
    activeBrand,
    activeBrandLoadError,
    brandLoadable,
    bannedList,
    bannedHits,
  }
}
