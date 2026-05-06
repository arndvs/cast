"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, XCircle, Filter, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Creative, ComplianceStatus, AspectRatio } from "@/lib/cast/types"

interface OutputGridProps {
  creatives: Creative[]
  onCreativeSelect: (creative: Creative) => void
  onRevealInFolder: () => void
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

const statusBadgeVariants: Record<ComplianceStatus, "secondary" | "outline" | "destructive"> = {
  OK: "secondary",
  WARN: "outline",
  FAIL: "destructive",
}

function getAspectRatioClass(ratio: AspectRatio): string {
  switch (ratio) {
    case "1:1":
      return "aspect-square"
    case "9:16":
      return "aspect-[9/16]"
    case "16:9":
      return "aspect-video"
  }
}

function CreativeCard({
  creative,
  onClick,
}: {
  creative: Creative
  onClick: () => void
}) {
  const StatusIcon = statusIcons[creative.compliance.status]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group cursor-pointer rounded-lg border bg-card transition-all hover:border-primary hover:shadow-md"
    >
      <div className="relative overflow-hidden rounded-t-lg bg-muted">
        <div className={cn("w-full", getAspectRatioClass(creative.aspectRatio))}>
          <img
            src={creative.thumbnailUrl}
            alt={`${creative.productName} - ${creative.aspectRatio}`}
            className="size-full object-cover"
          />
        </div>
        {/* Compliance Badge Overlay */}
        <div className="absolute top-2 right-2">
          <Badge
            variant={statusBadgeVariants[creative.compliance.status]}
            className={cn(
              "gap-1",
              creative.compliance.status === "OK" && "bg-emerald-500/90 text-white",
              creative.compliance.status === "WARN" && "bg-yellow-500/90 text-black"
            )}
          >
            <StatusIcon className="size-3" />
            {creative.compliance.status}
          </Badge>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium truncate">{creative.productName}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{creative.market.code}</span>
          <span>•</span>
          <span>{creative.aspectRatio}</span>
        </div>
      </div>
    </div>
  )
}

export function OutputGrid({ creatives, onCreativeSelect, onRevealInFolder }: OutputGridProps) {
  const [statusFilter, setStatusFilter] = React.useState<ComplianceStatus | "ALL">("ALL")
  const [ratioFilter, setRatioFilter] = React.useState<AspectRatio | "ALL">("ALL")
  const [marketFilter, setMarketFilter] = React.useState<string>("ALL")

  // Get unique markets from creatives
  const markets = React.useMemo(() => {
    const uniqueMarkets = new Map<string, string>()
    creatives.forEach((c) => {
      uniqueMarkets.set(c.market.code, c.market.name)
    })
    return Array.from(uniqueMarkets.entries()).map(([code, name]) => ({ code, name }))
  }, [creatives])

  // Filter creatives
  const filteredCreatives = React.useMemo(() => {
    return creatives.filter((c) => {
      if (statusFilter !== "ALL" && c.compliance.status !== statusFilter) return false
      if (ratioFilter !== "ALL" && c.aspectRatio !== ratioFilter) return false
      if (marketFilter !== "ALL" && c.market.code !== marketFilter) return false
      return true
    })
  }, [creatives, statusFilter, ratioFilter, marketFilter])

  // Stats
  const stats = React.useMemo(() => {
    const ok = creatives.filter((c) => c.compliance.status === "OK").length
    const warn = creatives.filter((c) => c.compliance.status === "WARN").length
    const fail = creatives.filter((c) => c.compliance.status === "FAIL").length
    return { ok, warn, fail, total: creatives.length }
  }, [creatives])

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header with Stats and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generated Creatives</CardTitle>
              <CardDescription>
                {stats.total} creatives generated
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onRevealInFolder}>
              <FolderOpen className="size-4" />
              Reveal in Folder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-sm font-medium">{stats.ok} OK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-yellow-500" />
                <span className="text-sm font-medium">{stats.warn} Warnings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="size-4 text-destructive" />
                <span className="text-sm font-medium">{stats.fail} Failed</span>
              </div>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ComplianceStatus | "ALL")}>
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="WARN">Warnings</SelectItem>
                    <SelectItem value="FAIL">Failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={ratioFilter} onValueChange={(v) => setRatioFilter(v as AspectRatio | "ALL")}>
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue placeholder="Ratio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All Ratios</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={marketFilter} onValueChange={setMarketFilter}>
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue placeholder="Market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All Markets</SelectItem>
                    {markets.map((market) => (
                      <SelectItem key={market.code} value={market.code}>
                        {market.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-4 pr-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredCreatives.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              onClick={() => onCreativeSelect(creative)}
            />
          ))}
        </div>
        {filteredCreatives.length === 0 && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No creatives match the current filters.
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
