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
  ComplianceFailedEvent,
  ComplianceResultEvent,
  CreativeReadyEvent,
  CreativeStubEvent,
  ErrorEvent,
  PipelineEvent,
  QualityResultEvent,
  Slot,
  StepEvent,
} from "@/lib/cast/events"
import type { ComplianceBadge, ErrorStage, Manifest } from "@/lib/cast/schemas"

const encoder = new TextEncoder()

/**
 * Encode a single pipeline event as NDJSON bytes: one JSON object followed
 * by `\n`, ready to push into a `ReadableStream` controller. This is the
 * single seam between the server emitters and the client decoder — every
 * `emit*` helper funnels through it, and the round-trip contract test
 * (`tests/ndjson-contract.test.ts`) pins that `JSON.parse` +
 * `pipelineEventSchema.safeParse` succeeds for every emitted event.
 */
export function encodePipelineEvent(event: PipelineEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n")
}

export function emitStep(stage: ErrorStage, slot: Slot, message?: string): Uint8Array {
  const event: StepEvent = { type: "step", stage, slot, ...(message ? { message } : {}) }
  return encodePipelineEvent(event)
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
  return encodePipelineEvent(event)
}

export function emitCreativeReady(
  slot: Slot,
  path: string,
  source: "local" | "genai",
): Uint8Array {
  const event: CreativeReadyEvent = { type: "creative_ready", slot, path, source }
  return encodePipelineEvent(event)
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
  return encodePipelineEvent(event)
}

export function emitComplianceFailed(
  slot: Slot,
  bannedWords: string[],
): Uint8Array {
  const event: ComplianceFailedEvent = {
    type: "compliance_failed",
    slot,
    bannedWords,
  }
  return encodePipelineEvent(event)
}

export function emitQualityResult(
  slot: Slot,
  badge: "pass" | "fail",
  failures: string[],
  retried: boolean,
): Uint8Array {
  const event: QualityResultEvent = {
    type: "quality_result",
    slot,
    badge,
    failures,
    retried,
  }
  return encodePipelineEvent(event)
}

export function emitCreativeStub(
  slot: Slot,
  message: string,
): Uint8Array {
  const event: CreativeStubEvent = {
    type: "creative_stub",
    slot,
    message,
  }
  return encodePipelineEvent(event)
}

export function emitError(
  stage: ErrorStage | "stream",
  message: string,
  slot?: Slot,
): Uint8Array {
  const event: ErrorEvent = { type: "error", stage, message, ...(slot ? { slot } : {}) }
  return encodePipelineEvent(event)
}

export function emitComplete(manifest: Manifest): Uint8Array {
  const event: CompleteEvent = { type: "complete", manifest }
  return encodePipelineEvent(event)
}
