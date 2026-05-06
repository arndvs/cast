/**
 * Pipeline event union — client-shared, NO node deps.
 *
 * One discriminated event type per line of the NDJSON stream emitted by
 * `POST /api/generate`. The closed `stage` enum lives in `./schemas.ts`
 * (`errorStageSchema`) — drift surfaces as a type error.
 *
 * The `complete` event payload is the run manifest (== `report.json` on disk).
 *
 * Server emitters: `lib/cast/server/ndjson-emit.ts`.
 * Client decoder: `S1Shell` (V4 wiring).
 */

import { z } from "zod"
import {
  errorStageSchema,
  manifestSchema,
  ratioSchema,
  MARKET_RE,
  complianceBadgeSchema,
} from "./schemas"

// ---------------------------------------------------------------------------
// Event schemas
// ---------------------------------------------------------------------------

/** Per-creative coordinate. `product` is a slug. */
const slotSchema = z.object({
  product: z.string(),
  market: z.string().regex(MARKET_RE),
  ratio: ratioSchema,
})

/** A pipeline stage entered for a given creative slot. */
export const stepEventSchema = z.object({
  type: z.literal("step"),
  stage: errorStageSchema,
  slot: slotSchema,
  /** Free-form human-readable status for the log view. */
  message: z.string().optional(),
})

export const assetResolvedEventSchema = z.object({
  type: z.literal("asset_resolved"),
  product: z.string(),
  source: z.enum(["local", "genai"]),
  /** Repo-relative path when source === 'local'; absent when 'genai'. */
  file: z.string().optional(),
})

export const creativeReadyEventSchema = z.object({
  type: z.literal("creative_ready"),
  slot: slotSchema,
  /** Repo-relative path under outputs/. */
  path: z.string(),
  source: z.enum(["local", "genai"]),
})

export const complianceResultEventSchema = z.object({
  type: z.literal("compliance_result"),
  slot: slotSchema,
  badge: complianceBadgeSchema,
  bannedWords: z.array(z.string()),
})

export const errorEventSchema = z.object({
  type: z.literal("error"),
  /** `'stream'` is reserved for the client-side idle abort (D30). */
  stage: z.union([errorStageSchema, z.literal("stream")]),
  slot: slotSchema.optional(),
  message: z.string(),
})

export const completeEventSchema = z.object({
  type: z.literal("complete"),
  manifest: manifestSchema,
})

export const pipelineEventSchema = z.discriminatedUnion("type", [
  stepEventSchema,
  assetResolvedEventSchema,
  creativeReadyEventSchema,
  complianceResultEventSchema,
  errorEventSchema,
  completeEventSchema,
])

export type PipelineEvent = z.infer<typeof pipelineEventSchema>
export type StepEvent = z.infer<typeof stepEventSchema>
export type AssetResolvedEvent = z.infer<typeof assetResolvedEventSchema>
export type CreativeReadyEvent = z.infer<typeof creativeReadyEventSchema>
export type ComplianceResultEvent = z.infer<typeof complianceResultEventSchema>
export type ErrorEvent = z.infer<typeof errorEventSchema>
export type CompleteEvent = z.infer<typeof completeEventSchema>
export type Slot = z.infer<typeof slotSchema>
