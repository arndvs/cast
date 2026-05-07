"use client"

import * as React from "react"
import { Download, X } from "lucide-react"

import { ComplianceChecksList } from "@/components/cast/compliance-checks-list"
import { CopyPathButton } from "@/components/cast/copy-path-button"
import { CreativeMetaGrid } from "@/components/cast/creative-meta-grid"
import { PipelineErrorPanel } from "@/components/cast/pipeline-error-panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMarket } from "@/lib/cast/markets"
import { buildCreativeProxyUrl } from "@/lib/cast/creative-proxy-url"
import type { Creative } from "@/lib/cast/schemas"
import type { CastAppAction, CastAppState } from "@/components/cast/cast-app-state"

interface CreativeDetailDialogProps {
  state: CastAppState
  dispatch: React.Dispatch<CastAppAction>
}

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

  const proxyUrl = buildCreativeProxyUrl(brief.campaign, creative.market, creative.product, creative.ratio)

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
          <CreativeMetaGrid
            rows={[
              ["product", creative.product],
              ["market", creative.market],
              ["language", language],
              ["ratio", creative.ratio],
              ["source", creative.source],
            ]}
          />

          {failed ? (
            <PipelineErrorPanel
              stage={errorEntry?.stage ?? null}
              message={errorEntry?.message ?? "unknown failure"}
            />
          ) : (
            <ComplianceChecksList creative={creative} />
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
