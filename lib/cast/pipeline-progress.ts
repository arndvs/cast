/**
 * Pipeline progress model — the client↔server "a slot emits this many
 * `step` events" contract, derived from the canonical stage sequence.
 *
 * The progress estimator previously hardcoded `total * 6` with a comment
 * "~6 steps per creative slot". That number was a magic constant — adding a
 * 7th pipeline stage to `PIPELINE_STAGES` would silently distort the
 * progress bar with a green test suite. This module derives the budget from
 * the same constant the server emits by, so a stage addition changes the
 * estimator automatically.
 *
 * Client-safe: no node deps, no zod import beyond the stage constant.
 */

import { PIPELINE_STAGES } from "@/lib/cast/schemas"

/**
 * Steps a single creative slot emits on the NDJSON stream — one `step`
 * event per pipeline stage. Derived from `PIPELINE_STAGES.length`.
 *
 * The `genai` step is conditional (absent in cheap mode), so the per-slot
 * budget is `STEPS_PER_SLOT` with `genai` treated as optional (≤1).
 */
export const STEPS_PER_SLOT = PIPELINE_STAGES.length

/** Stages that always emit a `step` for a slot (genai is conditional). */
export const ALWAYS_EMITTING_STAGES = PIPELINE_STAGES.filter((s) => s !== "genai")
export const STEPS_WITHOUT_GENAI = ALWAYS_EMITTING_STAGES.length

/**
 * Progress estimator — divide `step`-typed events only into
 * `slotCount * STEPS_PER_SLOT`, treating `genai` as optional toward the
 * budget. Clamps to [0, 1].
 *
 * @param stepEventCount number of `step`-typed events seen so far
 * @param slotCount      total creative slots (products × markets × ratios)
 */
export function estimateProgress(stepEventCount: number, slotCount: number): number {
  if (slotCount <= 0) return 0
  const budget = slotCount * STEPS_PER_SLOT
  if (budget <= 0) return 0
  return Math.min(1, stepEventCount / budget)
}