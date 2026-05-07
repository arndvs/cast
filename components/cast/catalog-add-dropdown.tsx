"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SeedBrandProduct } from "@/lib/cast/seed-brands"

interface CatalogAddDropdownProps {
  available: readonly SeedBrandProduct[]
  onAdd: (p: SeedBrandProduct) => void
}

export function CatalogAddDropdown({ available, onAdd }: CatalogAddDropdownProps) {
  const [open, setOpen] = React.useState(false)
  if (available.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        all catalog products in brief
      </span>
    )
  }
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="mr-1 h-3 w-3" /> Add product
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover shadow-md">
          {available.map((p) => (
            <button
              key={p.sku}
              type="button"
              onClick={() => {
                onAdd(p)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span
                className="h-6 w-6 shrink-0 rounded"
                style={{
                  background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})`,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name}</span>
                <span className="block truncate font-mono text-[0.625rem] text-muted-foreground">
                  {p.sku}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
