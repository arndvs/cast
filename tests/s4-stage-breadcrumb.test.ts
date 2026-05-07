/**
 * Compile-time + run-time guard for the S4 error breadcrumb.
 *
 * `PIPELINE_STAGES` is a hard-coded literal (so React keys, transitions,
 * and the `cn(...)` styling can stay typed against a tuple). The
 * `satisfies readonly ErrorStage[]` clause catches stages being *removed*
 * from the schema. This test catches stages being *added* to the schema
 * — without it, a new pipeline stage would land in `errorStageSchema`
 * and silently drop out of the breadcrumb.
 */

import { describe, it, expect } from "vitest"

import { PIPELINE_STAGES } from "@/components/cast/s4-creative-detail"
import { errorStageSchema } from "@/lib/cast/schemas"

describe("S4 pipeline breadcrumb stays in sync with errorStageSchema", () => {
  it("has the same length as errorStageSchema.options", () => {
    expect(PIPELINE_STAGES.length).toBe(errorStageSchema.options.length)
  })

  it("contains exactly the same set of stages", () => {
    expect(new Set(PIPELINE_STAGES)).toEqual(new Set(errorStageSchema.options))
  })

  it("preserves canonical pipeline order", () => {
    // Equal sets + equal length + same order → identical sequence.
    expect([...PIPELINE_STAGES]).toEqual([...errorStageSchema.options])
  })
})
