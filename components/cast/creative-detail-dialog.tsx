"use client"

import * as React from "react"
import { Check, Copy, Download, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resolveCreativeAbsolutePath } from "@/app/actions/reveal"
import { getMarket } from "@/lib/cast/markets"
import { type Creative, type ErrorStage } from "@/lib/cast/schemas"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"
import { cn } from "@/lib/utils"

interface CreativeDetailDialogProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
}

/**
 * Pipeline stages, in canonical order — used by the error breadcrumb.
 *
 * The literal must stay in lockstep with `errorStageSchema.options`
 * (enforced by `tests/creative-detail-breadcrumb.test.ts`). The `satisfies`
 * clause below catches a stage being *removed* at compile-time; the test
 * catches a stage being *added* at run-time.
 */
export const PIPELINE_STAGES = [
  "resolve",
  "genai",
  "resize",
  "compose",
  "compliance",
  "write",
] as const satisfies readonly ErrorStage[]

/**
 * Creative detail dialog.
 *
 * Mounts above the output grid whenever `state.detailOpen !== null` (the reducer owns
 * the open/close transitions). Two render modes:
 *
 *   - **Compliance** (`creative.path !== null`): preview via the outputs
 *     proxy, meta grid, the four compliance checks, copy-path + download.
 *   - **Error** (`creative.path === null`): placeholder + a
 *     pipeline-stage breadcrumb sourced from `manifest.errors`.
 */
export function CreativeDetailDialog({ state, dispatch }: CreativeDetailDialogProps) {
  const creative = state.detailOpen
  // Belt-and-braces — the shell only mounts this dialog when detailOpen is non-null,
  // but unmounting on close is handled by Radix so we keep the guard local.
  const open = creative !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dispatch({ type: "close-detail" })
      }}
    >
      {creative && (
        <CreativeDetailDialogBody creative={creative} state={state} dispatch={dispatch} />
      )}
    </Dialog>
  )
}

function CreativeDetailDialogBody({
  creative,
  state,
  dispatch,
}: {
  creative: Creative
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
}) {
  const { brief, manifest } = state
  const failed = creative.path === null
  const language = getMarket(creative.market)?.language ?? creative.market.split("-").pop() ?? "—"

  // Same URL the tile uses — the proxy whitelists `.png` and reads from
  // outputs/ outside the static tree.
  const proxyUrl = `/api/outputs/${encodeURIComponent(brief.campaign)}/${encodeURIComponent(
    creative.market,
  )}/${encodeURIComponent(creative.product)}/${creative.ratio}.png`

  const downloadName = `${brief.campaign}-${creative.market}-${creative.product}-${creative.ratio}.png`

  const errorEntry = failed
    ? (manifest?.errors.find(
        (e) =>
          e.product === creative.product &&
          e.market === creative.market &&
          e.ratio === creative.ratio,
      ) ?? null)
    : null

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="font-mono text-sm">
          {creative.product}{" "}
          <span className="text-fg-3">·</span> {creative.market}{" "}
          <span className="text-fg-3">·</span> {creative.ratio}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {failed ? "Pipeline failure detail" : "Creative compliance detail"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Preview */}
        <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {failed ? (
            <div
              className="flex aspect-square w-full items-center justify-center"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, var(--bad) 0 8px, transparent 8px 16px)",
                backgroundColor:
                  "color-mix(in oklab, var(--bad) 8%, transparent)",
              }}
            >
              <span className="rounded bg-card/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-bad">
                failed · no preview
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- proxy serves dynamic per-run PNGs; next/image static analysis isn't useful here
            <img
              src={proxyUrl}
              alt={`${creative.product} ${creative.market} ${creative.ratio}`}
              className="h-auto w-full object-contain"
            />
          )}
        </div>

        {/* Right column — meta + checks/error */}
        <div className="flex flex-col gap-4">
          <MetaGrid
            rows={[
              ["product", creative.product],
              ["market", creative.market],
              ["language", language],
              ["ratio", creative.ratio],
              ["source", creative.source],
            ]}
          />

          {failed ? (
            <ErrorPanel
              stage={errorEntry?.stage ?? null}
              message={errorEntry?.message ?? "unknown failure"}
            />
          ) : (
            <ComplianceChecks creative={creative} />
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "close-detail" })}
        >
          <X className="mr-1 h-3 w-3" />
          Close
        </Button>
        {!failed && (
          <>
            <CopyPathButton
              campaign={brief.campaign}
              market={creative.market}
              product={creative.product}
              ratio={creative.ratio}
            />
            <Button asChild type="button" size="sm">
              <a href={proxyUrl} download={downloadName}>
                <Download className="mr-1 h-3 w-3" />
                Download PNG
              </a>
            </Button>
          </>
        )}
      </div>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function MetaGrid({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="uppercase tracking-wider text-fg-3">{k}</dt>
          <dd className="text-fg-1">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function ComplianceChecks({ creative }: { creative: Creative }) {
  const checks = creative.compliance?.checks
  const badge = creative.compliance?.badge ?? "OK"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          compliance
        </span>
        <BadgePill badge={badge} />
      </div>
      {checks ? (
        <ul className="flex flex-col gap-1 text-sm">
          <CheckRow ok={checks.logoPresent} label="logo present" />
          <CheckRow ok={checks.colorsOk} label="brand colors within tolerance" />
          <CheckRow
            ok={checks.bannedWords.length === 0}
            label={
              checks.bannedWords.length === 0
                ? "no banned words"
                : `banned words: ${checks.bannedWords.join(", ")}`
            }
          />
        </ul>
      ) : (
        <p className="text-xs text-fg-3">No compliance data on this creative.</p>
      )}
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad",
        )}
        aria-hidden="true"
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className={cn("text-sm", ok ? "text-fg-1" : "text-bad")}>{label}</span>
    </li>
  )
}

function BadgePill({ badge }: { badge: "OK" | "WARN" | "FAIL" }) {
  if (badge === "OK") {
    return <Badge className="bg-ok/15 text-ok hover:bg-ok/15">OK</Badge>
  }
  if (badge === "WARN") {
    return <Badge className="bg-warn/15 text-warn hover:bg-warn/15">WARN</Badge>
  }
  return <Badge variant="destructive">FAIL</Badge>
}

function ErrorPanel({
  stage,
  message,
}: {
  stage: ErrorStage | null
  message: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          pipeline stage
        </span>
        {stage && <Badge variant="destructive">{stage}</Badge>}
      </div>

      <ol className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
        {PIPELINE_STAGES.map((s, i) => {
          const isFailed = s === stage
          const isPast = stage !== null && PIPELINE_STAGES.indexOf(stage) > i
          return (
            <React.Fragment key={s}>
              <li
                className={cn(
                  "rounded px-1.5 py-0.5",
                  isFailed && "bg-bad/15 text-bad",
                  !isFailed && isPast && "bg-ok/10 text-ok",
                  !isFailed && !isPast && "bg-muted text-fg-3",
                )}
              >
                {s}
              </li>
              {i < PIPELINE_STAGES.length - 1 && (
                <span className="text-fg-4" aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          )
        })}
      </ol>

      <div className="rounded-md border border-bad/40 bg-bad/5 p-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-3">
          message
        </span>
        <p className="mt-1 wrap-break-word text-sm text-fg-1">{message}</p>
      </div>
    </div>
  )
}

function CopyPathButton({
  campaign,
  market,
  product,
  ratio,
}: {
  campaign: string
  market: string
  product: string
  ratio: Creative["ratio"]
}) {
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          const res = await resolveCreativeAbsolutePath({
            campaign,
            market,
            product,
            ratio,
          })
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          await navigator.clipboard.writeText(res.path)
          toast.success("Path copied")
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err))
        } finally {
          setPending(false)
        }
      }}
    >
      <Copy className="mr-1 h-3 w-3" />
      Copy path
    </Button>
  )
}
