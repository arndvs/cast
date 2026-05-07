/**
 * Derive per-creative slot statuses from the live NDJSON event tape.
 *
 * Pure function — no I/O, no React. Scans `events[]` and returns a
 * structured status for every slot coordinate (`product/market/ratio`)
 * in the brief. Used by the Job Runner View to show structured progress
 * instead of a flat event log.
 *
 * Client-only — never import on the server.
 */

import type { PipelineEvent } from "@/lib/cast/events"
import type { Brief, AspectRatio, ComplianceBadge } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotStatus = "queued" | "generating" | "complete" | "failed"

export interface CreativeSlotInfo {
  product: string
  market: string
  ratio: AspectRatio
  status: SlotStatus
  /** Seconds elapsed from first `step` event to `creative_ready`. `null` while in-progress or on failure. */
  duration: number | null
  /** Source resolution — `null` until `creative_ready` arrives. */
  source: "local" | "genai" | null
  /** Compliance badge — `null` until `compliance_result` arrives. */
  badge: ComplianceBadge | null
  /** Client-side timestamp (ms) of the first `step` event for this slot. */
  startedAt: number | null
  /** Client-side timestamp (ms) of the `creative_ready` event. */
  completedAt: number | null
}

export interface ProductGroup {
  product: string
  slots: CreativeSlotInfo[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotKey(product: string, market: string, ratio: string): string {
  return `${product}/${market}/${ratio}`
}

// ---------------------------------------------------------------------------
// Main derivation
// ---------------------------------------------------------------------------

/**
 * Build a `Map<slotKey, CreativeSlotInfo>` from the events tape + brief.
 *
 * Every slot in the brief's cartesian product (products × markets × ratios)
 * is initialised as `"queued"`. Events are scanned in order to promote
 * each slot through `generating → complete` (or `→ failed`).
 *
 * Timestamps use `Date.now()` at call time as a proxy — the events don't
 * carry server-side timestamps. For completed creatives the `duration` is
 * computed from the first `step` to `creative_ready` receive-time delta
 * stored in the accumulator.
 */
export function deriveCreativeStatuses(events: readonly PipelineEvent[], brief: Brief): Map<string, CreativeSlotInfo> {
  const map = new Map<string, CreativeSlotInfo>()

  // Seed every slot from the brief's cartesian product.
  for (const product of brief.products) {
    const slug = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    for (const market of brief.markets) {
      for (const ratio of brief.ratios) {
        const key = slotKey(slug, market, ratio)
        map.set(key, {
          product: slug,
          market,
          ratio,
          status: "queued",
          duration: null,
          source: null,
          badge: null,
          startedAt: null,
          completedAt: null,
        })
      }
    }
  }

  // Walk events in order, updating the slot map.
  for (const event of events) {
    switch (event.type) {
      case "step": {
        const key = slotKey(event.slot.product, event.slot.market, event.slot.ratio)
        const slot = map.get(key)
        if (!slot) break
        if (slot.status === "queued") {
          slot.status = "generating"
          slot.startedAt = Date.now()
        }
        break
      }
      case "creative_ready": {
        const key = slotKey(event.slot.product, event.slot.market, event.slot.ratio)
        const slot = map.get(key)
        if (!slot) break
        slot.status = "complete"
        slot.source = event.source
        slot.completedAt = Date.now()
        if (slot.startedAt !== null) {
          slot.duration = (slot.completedAt - slot.startedAt) / 1000
        }
        break
      }
      case "compliance_result": {
        const key = slotKey(event.slot.product, event.slot.market, event.slot.ratio)
        const slot = map.get(key)
        if (!slot) break
        slot.badge = event.badge
        break
      }
      case "error": {
        if (!event.slot) break
        const key = slotKey(event.slot.product, event.slot.market, event.slot.ratio)
        const slot = map.get(key)
        if (!slot) break
        slot.status = "failed"
        break
      }
    }
  }

  return map
}

/**
 * Group a slot status map by product, preserving brief product order.
 *
 * Each `ProductGroup` contains all slots for that product across all
 * markets and ratios — the shape consumed by `<JobVariantRow>`.
 */
export function groupByProduct(statusMap: Map<string, CreativeSlotInfo>, brief: Brief): ProductGroup[] {
  const groups: ProductGroup[] = []

  for (const product of brief.products) {
    const slug = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const slots: CreativeSlotInfo[] = []
    for (const market of brief.markets) {
      for (const ratio of brief.ratios) {
        const key = slotKey(slug, market, ratio)
        const info = statusMap.get(key)
        if (info) slots.push(info)
      }
    }
    groups.push({ product: slug, slots })
  }

  return groups
}

/**
 * Count completed + failed creatives (terminal states) from the status map.
 * Used for the progress bar: `terminalCount / totalSlots`.
 */
export function countTerminal(statusMap: Map<string, CreativeSlotInfo>): { completed: number; failed: number; total: number } {
  let completed = 0
  let failed = 0

  for (const slot of statusMap.values()) {
    if (slot.status === "complete") completed++
    if (slot.status === "failed") failed++
  }

  return { completed, failed, total: statusMap.size }
}
