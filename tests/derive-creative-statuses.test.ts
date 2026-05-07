/**
 * `deriveCreativeStatuses` — structured slot status from NDJSON event tape.
 *
 * Tests cover: empty events (all queued), partial progress (mixed statuses),
 * all-complete, mixed failures, compliance badge propagation, and the
 * groupByProduct / countTerminal helpers.
 */

import { describe, it, expect } from "vitest"

import {
  deriveCreativeStatuses,
  groupByProduct,
  countTerminal,
  type CreativeSlotInfo,
} from "@/lib/cast/derive-creative-statuses"
import type { PipelineEvent } from "@/lib/cast/events"
import type { Brief } from "@/lib/cast/schemas"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    campaign: "test-campaign",
    brand: "brisa",
    products: [
      { name: "Berry", sku: "BRS-001" },
      { name: "Lime", sku: "BRS-002" },
    ],
    markets: ["us-en", "de-de"],
    audience: "Fitness enthusiasts",
    message: { en: "Stay fresh", de: "Bleib frisch" },
    ratios: ["1x1", "9x16"],
    ...overrides,
  }
}

function stepEvent(product: string, market: string, ratio: "1x1" | "9x16" | "16x9", stage = "resolve" as const): PipelineEvent {
  return { type: "step", stage, slot: { product, market, ratio } }
}

function readyEvent(product: string, market: string, ratio: "1x1" | "9x16" | "16x9", source: "local" | "genai" = "genai"): PipelineEvent {
  return { type: "creative_ready", slot: { product, market, ratio }, path: `outputs/test/${market}/${product}/${ratio}.png`, source }
}

function complianceEvent(product: string, market: string, ratio: "1x1" | "9x16" | "16x9", badge: "OK" | "WARN" | "FAIL" = "OK"): PipelineEvent {
  return { type: "compliance_result", slot: { product, market, ratio }, badge, bannedWords: badge === "OK" ? [] : ["bad"] }
}

function errorEvent(product: string, market: string, ratio: "1x1" | "9x16" | "16x9"): PipelineEvent {
  return { type: "error", stage: "genai", slot: { product, market, ratio }, message: "API failure" }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deriveCreativeStatuses", () => {
  it("initialises all slots as queued when events is empty", () => {
    const brief = mkBrief()
    const map = deriveCreativeStatuses([], brief)

    // 2 products × 2 markets × 2 ratios = 8 slots
    expect(map.size).toBe(8)
    for (const slot of map.values()) {
      expect(slot.status).toBe("queued")
      expect(slot.duration).toBeNull()
      expect(slot.source).toBeNull()
      expect(slot.badge).toBeNull()
    }
  })

  it("promotes to generating on first step event", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("berry", "us-en", "1x1"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    expect(map.get("berry/us-en/1x1")?.status).toBe("generating")
    expect(map.get("berry/us-en/9x16")?.status).toBe("queued")
  })

  it("promotes to complete on creative_ready", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("berry", "us-en", "1x1"),
      readyEvent("berry", "us-en", "1x1", "local"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    const slot = map.get("berry/us-en/1x1")!
    expect(slot.status).toBe("complete")
    expect(slot.source).toBe("local")
  })

  it("marks failed on error event", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("lime", "de-de", "9x16"),
      errorEvent("lime", "de-de", "9x16"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    expect(map.get("lime/de-de/9x16")?.status).toBe("failed")
  })

  it("records compliance badge", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("berry", "us-en", "1x1"),
      complianceEvent("berry", "us-en", "1x1", "WARN"),
      readyEvent("berry", "us-en", "1x1"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    expect(map.get("berry/us-en/1x1")?.badge).toBe("WARN")
  })

  it("handles mixed statuses across slots", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("berry", "us-en", "1x1"),
      readyEvent("berry", "us-en", "1x1"),
      stepEvent("berry", "us-en", "9x16"),
      stepEvent("lime", "us-en", "1x1"),
      errorEvent("lime", "us-en", "1x1"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    expect(map.get("berry/us-en/1x1")?.status).toBe("complete")
    expect(map.get("berry/us-en/9x16")?.status).toBe("generating")
    expect(map.get("lime/us-en/1x1")?.status).toBe("failed")
    expect(map.get("lime/de-de/1x1")?.status).toBe("queued")
  })

  it("ignores events for unknown slots", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("unknown-product", "us-en", "1x1"),
    ]
    const map = deriveCreativeStatuses(events, brief)

    expect(map.size).toBe(8)
    expect(map.has("unknown-product/us-en/1x1")).toBe(false)
  })
})

describe("groupByProduct", () => {
  it("groups slots by product preserving brief order", () => {
    const brief = mkBrief()
    const map = deriveCreativeStatuses([], brief)
    const groups = groupByProduct(map, brief)

    expect(groups).toHaveLength(2)
    expect(groups[0].product).toBe("berry")
    expect(groups[1].product).toBe("lime")
    // Each product has 2 markets × 2 ratios = 4 slots
    expect(groups[0].slots).toHaveLength(4)
    expect(groups[1].slots).toHaveLength(4)
  })
})

describe("countTerminal", () => {
  it("counts completed and failed separately", () => {
    const brief = mkBrief()
    const events: PipelineEvent[] = [
      stepEvent("berry", "us-en", "1x1"),
      readyEvent("berry", "us-en", "1x1"),
      stepEvent("lime", "us-en", "1x1"),
      errorEvent("lime", "us-en", "1x1"),
    ]
    const map = deriveCreativeStatuses(events, brief)
    const counts = countTerminal(map)

    expect(counts.completed).toBe(1)
    expect(counts.failed).toBe(1)
    expect(counts.total).toBe(8)
  })

  it("returns all zeros for empty events", () => {
    const brief = mkBrief()
    const map = deriveCreativeStatuses([], brief)
    const counts = countTerminal(map)

    expect(counts.completed).toBe(0)
    expect(counts.failed).toBe(0)
    expect(counts.total).toBe(8)
  })
})
