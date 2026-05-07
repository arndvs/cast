"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import {
  Check,
  Clock,
  CloudUpload,
  Download,
  FolderOpen,
  Pencil,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { revealOutputFolder } from "@/app/actions/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CastAppAction } from "@/components/cast/cast-app-state"
import { downloadJson } from "@/lib/cast/download-json"
import type { Brief, Manifest } from "@/lib/cast/schemas"

interface ResultsHeaderProps {
  brandSlug: string
  brief: Brief
  manifest: Manifest
  failCount: number
  successCount: number
  totalCount: number
  dispatch: React.Dispatch<CastAppAction>
}

export function ResultsHeader({
  brandSlug,
  brief,
  manifest,
  failCount,
  successCount,
  totalCount,
  dispatch,
}: ResultsHeaderProps) {
  const [dropboxReady, setDropboxReady] = useState(typeof Dropbox !== "undefined")

  useEffect(() => {
    if (dropboxReady) return
    // Poll briefly for lazy-loaded Dropbox script
    const id = setInterval(() => {
      if (typeof Dropbox !== "undefined") {
        setDropboxReady(true)
        clearInterval(id)
      }
    }, 500)
    return () => clearInterval(id)
  }, [dropboxReady])

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex flex-wrap items-center gap-3 px-6 py-3">
        {/* Brand crumbs */}

        <span className="text-sm text-muted-foreground">{brandSlug}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-sm">{brief.campaign}</span>

        <div className="grow" />

        {/* Status badge */}
        {failCount > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            {failCount} failed
          </Badge>
        ) : (
          <Badge className="gap-1 bg-ok/15 text-ok">
            <Check className="h-3 w-3" />
            completed
          </Badge>
        )}

        {/* Time range */}
        {manifest.startedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">
              {new Date(manifest.startedAt).toLocaleTimeString()}
            </span>
            {manifest.completedAt && (
              <>
                <span>→</span>
                <span className="font-mono">
                  {new Date(manifest.completedAt).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        )}

        {/* Edit brief */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "goto-edit" })}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Edit brief
        </Button>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-6 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => downloadJson(`${brief.campaign}-brief.json`, brief)}
        >
          <Download className="mr-1 h-3 w-3" />
          brief.json
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            downloadJson(`${brief.campaign}-report.json`, manifest)
          }
        >
          <Download className="mr-1 h-3 w-3" />
          report.json
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              const res = await revealOutputFolder({ campaign: brief.campaign })
              if (res.ok) {
                toast.success("Folder revealed")
              } else {
                toast.error(res.error)
              }
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Failed to reveal folder"
              )
            }
          }}
        >
          <FolderOpen className="mr-1 h-3 w-3" />
          Reveal in folder
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!dropboxReady}
          onClick={() => {
            if (typeof Dropbox === "undefined") {
              toast.error(
                "Dropbox Saver not loaded — set NEXT_PUBLIC_DROPBOX_APP_KEY"
              )
              return
            }
            const files = manifest.creatives
              .filter((c) => c.path)
              .map((c) => {
                const rel = c.path!.replace(/^outputs\//, "")
                return {
                  url: `${window.location.origin}/api/outputs/${rel}`,
                  filename: rel,
                }
              })
            if (files.length === 0) {
              toast.error("No output files to export")
              return
            }
            Dropbox.save({
              files,
              success: () =>
                toast.success(`${files.length} files saved to Dropbox`),
              cancel: () => toast.info("Dropbox export cancelled"),
              error: (msg: string) => toast.error(`Dropbox error: ${msg}`),
            })
          }}
        >
          <CloudUpload className="mr-1 h-3 w-3" />
          Export to Dropbox
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className={`h-full transition-all ${failCount > 0 ? "bg-amber-500 dark:bg-amber-400" : "bg-ok"}`}
          style={{ width: `${totalCount > 0 ? ((successCount + failCount) / totalCount) * 100 : 0}%` }}
        />
      </div>
    </header>
  )
}
