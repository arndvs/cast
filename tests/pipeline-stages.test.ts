/**
 * Pipeline stage enum is closed.
 *
 * Drift surfaces as a Zod parse failure here long before it reaches a route
 * handler. `errorStageSchema` is the single source of truth — if a new stage
 * is added, this test must be updated in the same commit.
 */

import { describe, it, expect } from "vitest"
import { errorStageSchema } from "@/lib/cast/schemas"
import { pipelineEventSchema } from "@/lib/cast/events"

const EXPECTED_STAGES = [
  "resolve",
  "genai",
  "resize",
  "compose",
  "compliance",
  "write",
] as const

describe("pipeline stage enum (closed)", () => {
  it("errorStageSchema accepts exactly the documented stages", () => {
    for (const stage of EXPECTED_STAGES) {
      expect(errorStageSchema.safeParse(stage).success).toBe(true)
    }
    for (const bogus of ["render", "upload", "scan", "STAGE_NEW", ""]) {
      expect(errorStageSchema.safeParse(bogus).success).toBe(false)
    }
  })

  it("step events accept every stage", () => {
    for (const stage of EXPECTED_STAGES) {
      const result = pipelineEventSchema.safeParse({
        type: "step",
        stage,
        slot: { product: "brisa-citrus", market: "us-en", ratio: "1x1" },
      })
      expect(result.success).toBe(true)
    }
  })

  it("error events allow the synthesized 'stream' stage", () => {
    const result = pipelineEventSchema.safeParse({
      type: "error",
      stage: "stream",
      message: "stream idle for 90s",
    })
    expect(result.success).toBe(true)
  })

  it("rejects unrecognized event types", () => {
    const result = pipelineEventSchema.safeParse({
      type: "tickLog",
      message: "hi",
    })
    expect(result.success).toBe(false)
  })
})
