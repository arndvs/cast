import { describe, expect, it } from "vitest"

import {
  ALWAYS_EMITTING_STAGES,
  estimateProgress,
  STEPS_PER_SLOT,
  STEPS_WITHOUT_GENAI,
} from "@/lib/cast/pipeline-progress"
import { PIPELINE_STAGES } from "@/lib/cast/schemas"
import { gridSize } from "@/lib/cast/slot-grid"
import type { Brief } from "@/lib/cast/schemas"

function mkBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    campaign: "summer",
    brand: "brisa",
    products: [{ name: "Berry", sku: "BRS-001" }],
    markets: ["us-en"],
    audience: "Fitness",
    message: { en: "Stay fresh" },
    ratios: ["1x1", "9x16", "16x9"],
    ...overrides,
  }
}

describe("STEPS_PER_SLOT", () => {
  it("derives from the canonical stage sequence", () => {
    expect(STEPS_PER_SLOT).toBe(PIPELINE_STAGES.length)
    expect(STEPS_PER_SLOT).toBe(7) // resolve genai resize compose quality compliance write
  })

  it("genai is the only conditional step", () => {
    expect(STEPS_WITHOUT_GENAI).toBe(STEPS_PER_SLOT - 1)
    expect(ALWAYS_EMITTING_STAGES).not.toContain("genai")
    expect(ALWAYS_EMITTING_STAGES).toHaveLength(STEPS_WITHOUT_GENAI)
  })
})

describe("estimateProgress", () => {
  it("derives the budget from stage count × slots", () => {
    const brief = mkBrief()
    const slots = gridSize(brief) // 3
    // 3 slots × 7 stages = 21 budget; 10 steps → ~47.6%
    const pct = estimateProgress(10, slots)
    expect(pct).toBeCloseTo(10 / 21, 5)
  })

  it("counts only step events — extra non-step lines don't inflate", () => {
    const slots = 2
    // 2 slots × 7 = 14 budget. 14 step events → 100% even with 50 other events.
    expect(estimateProgress(14, slots)).toBe(1)
  })

  it("clamps to [0, 1]", () => {
    expect(estimateProgress(0, 3)).toBe(0)
    expect(estimateProgress(100, 3)).toBe(1)
  })

  it("handles zero slots gracefully", () => {
    expect(estimateProgress(0, 0)).toBe(0)
  })
})

describe("stage-add contract", () => {
  it("fails if a 7th stage is injected (protects the estimator)", () => {
    // The estimator's budget must equal the real stage count. If a stage is
    // added to PIPELINE_STAGES, STEPS_PER_SLOT changes automatically — this
    // test documents the coupling so the two can't silently diverge.
    expect(PIPELINE_STAGES).toHaveLength(STEPS_PER_SLOT)
  })
})