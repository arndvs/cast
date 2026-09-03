/**
 * Wire-level tape projection test (#78 AC3).
 *
 * Runs the actual NDJSON emission helpers over a canonical run shape,
 * decodes each line with the client decoder path (`pipelineEventSchema`,
 * the same one `useRunController` uses), and asserts that:
 *   - the derived status model (`deriveCreativeStatuses`) reaches every slot
 *     of the shared slot-count derivation (`gridSize` / `gridSlots`)
 *   - the run-view estimator (`estimateProgress`) consumes the same
 *     (stage × slot) budget as the status model
 *
 * This is the guard that makes the shared projection durable — a stage or
 * event-shape change that desynchronizes the run view, status model, and
 * manifest counts fails here instead of silently.
 */

import { describe, expect, it } from "vitest"

import { pipelineEventSchema } from "@/lib/cast/events"
import {
  emitAssetResolved,
  emitComplianceResult,
  emitCreativeReady,
  emitStep,
} from "@/lib/cast/server/ndjson-emit"
import { deriveCreativeStatuses } from "@/lib/cast/derive-creative-statuses"
import { estimateProgress, STEPS_PER_SLOT } from "@/lib/cast/pipeline-progress"
import { gridSize, gridSlots, slotKey } from "@/lib/cast/slot-grid"
import type { Brief } from "@/lib/cast/schemas"

function mkBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    campaign: "summer",
    brand: "brisa",
    products: [
      { name: "Brisa Citrus", sku: "BRS-001" },
      { name: "Lime Fizz", sku: "BRS-002" },
    ],
    markets: ["us-en", "de-de"],
    audience: "Fitness",
    message: { en: "Stay fresh", de: "Bleib frisch" },
    ratios: ["1x1", "9x16"],
    ...overrides,
  }
}

/** Decode NDJSON bytes through the client decoder path. */
function decode(bytes: Uint8Array): ReturnType<typeof pipelineEventSchema.parse> {
  const raw = JSON.parse(new TextDecoder().decode(bytes))
  return pipelineEventSchema.parse(raw)
}

describe("wire-level tape projection (emit → decode → derive)", () => {
  it("a full default-mode run reaches every slot of the shared grid", () => {
    const brief = mkBrief()
    const slots = gridSlots(brief)
    const total = gridSize(brief)
    expect(total).toBe(8)

    // Emit a canonical default-mode tape: per slot, resolve → genai → resize
    // → compose → quality → compliance → write steps + ready + compliance.
    const events: ReturnType<typeof pipelineEventSchema.parse>[] = []
    for (const slot of slots) {
      events.push(decode(emitStep("resolve", slot)))
      events.push(decode(emitStep("genai", slot, "generating 1x1 native")))
      events.push(decode(emitStep("resize", slot)))
      events.push(decode(emitStep("compose", slot)))
      events.push(decode(emitStep("quality", slot)))
      events.push(decode(emitStep("compliance", slot)))
      events.push(decode(emitStep("write", slot)))
      events.push(
        decode(
          emitCreativeReady(
            slot,
            `outputs/summer/${slot.market}/${slot.product}/${slot.ratio}.png`,
            "genai",
          ),
        ),
      )
      events.push(decode(emitComplianceResult(slot, "OK", [])))
    }
    // Plus one asset_resolved per product.
    events.push(decode(emitAssetResolved("brisa-citrus", "genai")))
    events.push(decode(emitAssetResolved("lime-fizz", "genai")))

    // Status model reaches every slot as complete.
    const statusMap = deriveCreativeStatuses(events, brief)
    expect(statusMap.size).toBe(total)
    for (const slot of slots) {
      const info = statusMap.get(slotKey(slot.product, slot.market, slot.ratio))
      expect(info?.status).toBe("complete")
    }

    // Estimator: 7 steps × 8 slots = 56 step events → 100%.
    const stepCount = events.filter((e) => e.type === "step").length
    expect(stepCount).toBe(total * STEPS_PER_SLOT)
    expect(estimateProgress(stepCount, total)).toBe(1)
  })

  it("cheap mode (no genai step) still reaches every slot and estimates correctly", () => {
    const brief = mkBrief()
    const slots = gridSlots(brief)
    const total = gridSize(brief)

    // Cheap mode: no genai step per slot (single master per product).
    const events: ReturnType<typeof pipelineEventSchema.parse>[] = []
    for (const slot of slots) {
      events.push(decode(emitStep("resolve", slot)))
      events.push(decode(emitStep("resize", slot)))
      events.push(decode(emitStep("compose", slot)))
      events.push(decode(emitStep("quality", slot)))
      events.push(decode(emitStep("compliance", slot)))
      events.push(decode(emitStep("write", slot)))
      events.push(
        decode(
          emitCreativeReady(
            slot,
            `outputs/summer/${slot.market}/${slot.product}/${slot.ratio}.png`,
            "genai",
          ),
        ),
      )
    }

    const statusMap = deriveCreativeStatuses(events, brief)
    expect(statusMap.size).toBe(total)
    for (const slot of slots) {
      expect(
        statusMap.get(slotKey(slot.product, slot.market, slot.ratio))?.status,
      ).toBe("complete")
    }

    // 6 steps per slot (genai omitted) — estimator treats genai as optional.
    const stepCount = events.filter((e) => e.type === "step").length
    expect(stepCount).toBe(total * (STEPS_PER_SLOT - 1))
    expect(estimateProgress(stepCount, total)).toBeLessThan(1)
  })
})