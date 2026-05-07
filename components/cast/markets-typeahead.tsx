"use client"

import * as React from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"

import { ALL_MARKETS } from "@/lib/cast/markets"
import { MARKET_RE } from "@/lib/cast/schemas"
import { cn } from "@/lib/utils"

interface MarketsTypeaheadProps {
  /** Markets already in the brief — excluded from the suggestion list. */
  selected: readonly string[]
  /** Called when the user picks a suggestion or commits a custom code via Enter. */
  onAdd: (code: string) => void
}

/**
 * `cmdk`-driven market picker (per docs/prototype/README.md decision).
 *
 * Behavior:
 * - Suggestions match against `code`, `name`, or `language` (case-insensitive).
 * - Already-selected markets are filtered out.
 * - Enter on the top suggestion adds it.
 * - Enter on free text that matches `MARKET_RE` adds it as a custom market.
 * - Free text that doesn't match shows an inline error.
 */
export function MarketsTypeahead({ selected, onAdd }: MarketsTypeaheadProps) {
  const [query, setQuery] = React.useState("")
  const [err, setErr] = React.useState("")
  const queryLower = query.trim().toLowerCase()

  const suggestions = React.useMemo(() => {
    if (!queryLower) return []
    return ALL_MARKETS.filter((m) => {
      if (selected.includes(m.code)) return false
      return (
        m.code.includes(queryLower) ||
        m.name.toLowerCase().includes(queryLower) ||
        m.language.toLowerCase().includes(queryLower)
      )
    }).slice(0, 6)
  }, [queryLower, selected])

  const selectMarket = (code: string) => {
    onAdd(code)
    setQuery("")
    setErr("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (suggestions[0]) return selectMarket(suggestions[0].code)
    if (MARKET_RE.test(queryLower)) return selectMarket(queryLower)
    setErr(`expected lowercase "xx-yy" (e.g. de-de), got "${query}"`)
  }

  return (
    <div className="relative">
      <Command shouldFilter={false} className="overflow-visible">
        <CommandInput
          value={query}
          onValueChange={(v) => {
            setQuery(v)
            setErr("")
          }}
          onKeyDown={handleKeyDown}
          placeholder="add market — type code or country (e.g. de-de, japan)"
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            "font-mono",
          )}
        />
        {queryLower && (
          <CommandList className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <CommandEmpty className="px-3 py-2 text-xs text-muted-foreground">
              {MARKET_RE.test(queryLower)
                ? `press Enter to add "${queryLower}" as custom`
                : "no matches — try a country name or xx-yy code"}
            </CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((m) => (
                  <CommandItem
                    key={m.code}
                    value={m.code}
                    onSelect={() => selectMarket(m.code)}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm aria-selected:bg-accent"
                  >
                    <span className="font-mono text-xs text-fg-3">{m.code}</span>
                    <span className="text-fg-2">{m.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  )
}
