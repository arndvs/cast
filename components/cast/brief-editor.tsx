"use client"

import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { BriefEditorSidebar } from "@/components/cast/brief-editor-sidebar"
import { BriefEditorFormView } from "@/components/cast/brief-editor-form-view"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import type { ClientLogoVariant } from "@/components/cast/cast-app-state"
import { containsBannedWord, getDefaultBannedWords } from "@/lib/cast/banned-words"
import { SEED_BRANDS, getSeedBrand } from "@/lib/cast/seed-brands"
import { briefSchema, SLUG_RE } from "@/lib/cast/schemas"

interface BriefEditorProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
  /** Logo variants from the loaded brand profile. Empty when no brand on disk. */
  logoVariants: readonly ClientLogoVariant[]
  /**
   * Banned-word list to match against. Supplied by the shell so the
   * inline ⚠ badge and the Generate gate read from the same merged source
   * (default floor ∪ brand fixture). Falls back to the universal floor when
   * omitted (e.g. unit tests rendering the editor in isolation).
   */
  bannedList?: readonly string[]
  /**
   * Brand slugs available on disk (from listBrandSlugs / /api/brands).
   * Drives the brand picker so it reflects the on-disk registry rather than
   * the hardcoded demo list. Falls back to the demo-brand slugs when omitted.
   */
  availableBrands?: readonly string[]
}

export function BriefEditor({ state, dispatch, logoVariants, bannedList, availableBrands }: BriefEditorProps) {
  const [jsonMode, setJsonMode] = React.useState(false)
  const seedBrand = getSeedBrand(state.brandSlug) ?? undefined

  // --- JSON editor local state ---
  const [jsonText, setJsonText] = React.useState(() => JSON.stringify(state.brief, null, 2))
  const [jsonErrors, setJsonErrors] = React.useState<string[]>([])
  const [jsonDirty, setJsonDirty] = React.useState(false)

  // Re-sync jsonText from state.brief when entering JSON mode clean,
  // or when the brief changes externally (e.g. brand switch) while in form mode.
  const briefRef = React.useRef(state.brief)

  React.useEffect(() => {
    if (briefRef.current !== state.brief && !jsonDirty) {
      setJsonText(JSON.stringify(state.brief, null, 2))
      setJsonErrors([])
    }
    briefRef.current = state.brief
  }, [state.brief, jsonDirty])

  function handleTabSwitch(v: string) {
    const switchingToJson = v === "json"
    if (!switchingToJson && jsonDirty) {
      if (!window.confirm("Discard unsaved JSON changes?")) return
    }
    if (switchingToJson) {
      setJsonText(JSON.stringify(state.brief, null, 2))
      setJsonErrors([])
      setJsonDirty(false)
    }
    setJsonMode(switchingToJson)
  }

  function handleJsonApply() {
    let parsed: unknown

    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      setJsonErrors([(e as SyntaxError).message])
      return
    }
    const result = briefSchema.safeParse(parsed)
    if (!result.success) {
      setJsonErrors(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`))
      return
    }
    setJsonErrors([])
    setJsonDirty(false)
    dispatch({ type: "replaceBrief", brief: result.data })
  }

  function handleJsonReset() {
    setJsonText(JSON.stringify(state.brief, null, 2))
    setJsonErrors([])
    setJsonDirty(false)
  }

  const effectiveBannedList = React.useMemo<readonly string[]>(
    () => bannedList ?? getDefaultBannedWords(),
    [bannedList],
  )

  const haystack = [
    state.brief.audience,
    ...Object.values(state.brief.message),
  ].join(" ")
  const bannedHits = containsBannedWord(haystack, effectiveBannedList)
  const slugInvalid = !SLUG_RE.test(state.brief.campaign || "")

  const brandList = availableBrands ?? SEED_BRANDS.map((brand) => brand.slug)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <BriefEditorSidebar state={state} dispatch={dispatch} brand={seedBrand} logoVariants={logoVariants} availableBrands={brandList} />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Tabs
            value={jsonMode ? "json" : "form"}
            onValueChange={handleTabSwitch}
          >
            <TabsList>
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grow" />
          {bannedHits.length > 0 && (
            <Badge className="bg-warn/15 text-warn-foreground" variant="outline">
              ⚠ banned: {bannedHits.join(", ")}
            </Badge>
          )}
        </div>

        {jsonMode ? (
          <Card>
            <CardContent className="p-4">
              <textarea
                className="min-h-100 w-full resize-y rounded bg-muted/50 p-4 font-mono text-xs leading-relaxed text-fg-2 focus:outline-none focus:ring-1 focus:ring-ring"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value)
                  setJsonDirty(true)
                }}
                spellCheck={false}
              />
              {jsonErrors.length > 0 && (
                <div className="mt-2 space-y-1 rounded bg-destructive/10 p-3 text-xs text-destructive">
                  {jsonErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleJsonApply} disabled={!jsonDirty}>
                  Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={handleJsonReset} disabled={!jsonDirty}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <BriefEditorFormView
            state={state}
            dispatch={dispatch}
            brand={seedBrand}
            bannedList={effectiveBannedList}
            slugInvalid={slugInvalid}
          />
        )}
      </div>
    </div>
  )
}
