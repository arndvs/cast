"use client"

import * as React from "react"
import { useDropzone } from "react-dropzone"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ACCEPT = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — matches the V3 /api/upload contract.

export interface DropzoneFile {
  fileName: string
  objectUrl: string
  size: number
  type: string
}

interface DropzoneProps {
  /** Currently-uploaded preview, if any. Driven from reducer state. */
  preview: DropzoneFile | null
  onUpload: (file: DropzoneFile) => void
  onRemove: () => void
  className?: string
}

/**
 * V2 dropzone — local preview only via `URL.createObjectURL`. V3 wires the
 * actual `/api/upload` POST and replaces `objectUrl` with `savedAs`.
 *
 * The reducer revokes the object URL when the preview is replaced or removed
 * (see `s1-state.ts::removeUpload`).
 */
export function Dropzone({ preview, onUpload, onRemove, className }: DropzoneProps) {
  const [error, setError] = React.useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    multiple: false,
    onDrop: (accepted, rejected) => {
      setError(null)
      if (rejected.length > 0) {
        const first = rejected[0]?.errors?.[0]
        setError(first?.message ?? "rejected — wrong type or too large")
        return
      }
      const file = accepted[0]
      if (!file) return
      onUpload({
        fileName: file.name,
        objectUrl: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
      })
    },
  })

  return (
    <div className={cn("relative", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex aspect-square min-h-[112px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 transition-colors",
          isDragActive && "border-brand-cyan bg-brand-cyan/10",
          preview && "border-solid",
        )}
        style={
          preview
            ? {
                backgroundImage: `url(${preview.objectUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <input {...getInputProps()} />
        {!preview && (
          <span className="px-3 text-center font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
            {isDragActive ? "drop here" : "drop hero · or generate"}
          </span>
        )}
        {preview && (
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-center font-mono text-[0.625rem] uppercase tracking-[0.1em] text-white">
            {preview.fileName}
          </span>
        )}
      </div>
      {preview && (
        <button
          type="button"
          aria-label="remove upload"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
