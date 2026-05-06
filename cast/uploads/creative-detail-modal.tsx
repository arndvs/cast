"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, XCircle, Download, Copy, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { Creative, ComplianceStatus } from "@/lib/cast/types"

interface CreativeDetailModalProps {
  creative: Creative | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusIcons = {
  OK: CheckCircle2,
  WARN: AlertTriangle,
  FAIL: XCircle,
}

const statusColors = {
  OK: "text-emerald-500",
  WARN: "text-yellow-500",
  FAIL: "text-destructive",
}

const statusBgColors = {
  OK: "bg-emerald-500/10",
  WARN: "bg-yellow-500/10",
  FAIL: "bg-destructive/10",
}

function getAspectRatioClass(ratio: string): string {
  switch (ratio) {
    case "1:1":
      return "aspect-square"
    case "9:16":
      return "aspect-[9/16] max-h-[400px]"
    case "16:9":
      return "aspect-video"
    default:
      return "aspect-square"
  }
}

export function CreativeDetailModal({
  creative,
  open,
  onOpenChange,
}: CreativeDetailModalProps) {
  if (!creative) return null

  const StatusIcon = statusIcons[creative.compliance.status]

  const handleCopyPath = () => {
    const path = `outputs/campaign-001/${creative.market.code}/${creative.productSku}/${creative.aspectRatio.replace(":", "x")}.png`
    navigator.clipboard.writeText(path)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {creative.productName}
            <Badge
              variant="outline"
              className={cn(
                statusBgColors[creative.compliance.status],
                statusColors[creative.compliance.status]
              )}
            >
              <StatusIcon className="mr-1 size-3" />
              {creative.compliance.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {creative.market.name} ({creative.market.code}) • {creative.aspectRatio}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Preview */}
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                "w-full overflow-hidden rounded-lg border bg-muted",
                getAspectRatioClass(creative.aspectRatio)
              )}
            >
              <img
                src={creative.outputUrl}
                alt={`${creative.productName} creative`}
                className="size-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopyPath}>
                <Copy className="size-4" />
                Copy Path
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="size-4" />
                Download
              </Button>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4">
            {/* Metadata */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Metadata</h4>
              <div className="rounded-lg border bg-muted/20 p-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Product SKU</dt>
                  <dd className="font-mono">{creative.productSku}</dd>
                  <dt className="text-muted-foreground">Market</dt>
                  <dd>{creative.market.name}</dd>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd>{creative.market.language}</dd>
                  <dt className="text-muted-foreground">Aspect Ratio</dt>
                  <dd>{creative.aspectRatio}</dd>
                  <dt className="text-muted-foreground">Generated</dt>
                  <dd>{new Date(creative.generatedAt).toLocaleString()}</dd>
                </dl>
              </div>
            </div>

            <Separator />

            {/* Compliance Checks */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Compliance Checks</h4>
              <div className="flex flex-col gap-2">
                {creative.compliance.checks.map((check, index) => {
                  const CheckIcon = statusIcons[check.status]
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        statusBgColors[check.status]
                      )}
                    >
                      <CheckIcon
                        className={cn("mt-0.5 size-4 shrink-0", statusColors[check.status])}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{check.name}</p>
                        {check.message && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {check.message}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0", statusColors[check.status])}
                      >
                        {check.status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Output Path */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Output Path</h4>
              <div className="rounded-lg border bg-muted/20 p-3">
                <code className="break-all text-xs text-muted-foreground">
                  outputs/campaign-001/{creative.market.code}/{creative.productSku}/
                  {creative.aspectRatio.replace(":", "x")}.png
                </code>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
