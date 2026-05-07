/**
 * NDJSON emit helpers — server-side typed event encoder.
 *
 * Each helper returns a `Uint8Array` containing exactly one JSON object
 * followed by `\n`, ready to push into a `ReadableStream` controller.
 *
 * The event union itself is defined in `lib/cast/events.ts` (client-shared).
 */

import type {
  AssetResolvedEvent,
  CompleteEvent,
  ComplianceResultEvent,
  CreativeReadyEvent,
  ErrorEvent,
  PipelineEvent,
  Slot,
  StepEvent,
} from "@/lib/cast/events"
import type { ComplianceBadge, ErrorStage, Manifest } from "@/lib/cast/schemas"

const encoder = new TextEncoder()

function serializeEvent(event: PipelineEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n")
}

export function emitStep(stage: ErrorStage, slot: Slot, message?: string): Uint8Array {
  const event: StepEvent = { type: "step", stage, slot, ...(message ? { message } : {}) }
  return serializeEvent(event)
}

export function emitAssetResolved(
  product: string,
  source: "local" | "genai",
  file?: string,
): Uint8Array {
  const event: AssetResolvedEvent = {
    type: "asset_resolved",
    product,
    source,
    ...(file ? { file } : {}),
  }
  return serializeEvent(event)
}

export function emitCreativeReady(
  slot: Slot,
  path: string,
  source: "local" | "genai",
): Uint8Array {
  const event: CreativeReadyEvent = { type: "creative_ready", slot, path, source }
  return serializeEvent(event)
}

export function emitComplianceResult(
  slot: Slot,
  badge: ComplianceBadge,
  bannedWords: string[],
): Uint8Array {
  const event: ComplianceResultEvent = {
    type: "compliance_result",
    slot,
    badge,
    bannedWords,
  }
  return serializeEvent(event)
}

export function emitError(
  stage: ErrorStage | "stream",
  message: string,
  slot?: Slot,
): Uint8Array {
  const event: ErrorEvent = { type: "error", stage, message, ...(slot ? { slot } : {}) }
  return serializeEvent(event)
}

export function emitComplete(manifest: Manifest): Uint8Array {
  const event: CompleteEvent = { type: "complete", manifest }
  return serializeEvent(event)
}
