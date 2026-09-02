/**
 * NDJSON wire contract — round-trip tests for the server emitters.
 *
 * The NDJSON stream is the runtime contract between `POST /api/generate`
 * (server, `lib/cast/server/ndjson-emit.ts`) and the run UI (client,
 * `useRunController` → `pipelineEventSchema.safeParse`). These tests pin
 * that every emitted event survives the JSON round-trip and still parses
 * through the exact decoder the client uses — so server and client can
 * only diverge by failing this test, never silently.
 */

import { describe, expect, it } from "vitest"

import { pipelineEventSchema } from "@/lib/cast/events"
import type { Manifest } from "@/lib/cast/schemas"
import {
  emitAssetResolved,
  emitComplete,
  emitComplianceFailed,
  emitComplianceResult,
  emitCreativeReady,
  emitCreativeStub,
  emitError,
  emitQualityResult,
  emitStep,
} from "@/lib/cast/server/ndjson-emit"

const slot = { product: "sunscreen", market: "us-en", ratio: "1x1" as const }

function decode(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes))
}

describe("NDJSON round-trip contract", () => {
  it("every emitted event decodes and re-parses through pipelineEventSchema", () => {
    const emitted: Uint8Array[] = [
      emitStep("resolve", slot),
      emitStep("genai", slot, "generating 1x1 native"),
      emitAssetResolved("sunscreen", "local", "inputs/assets/sunscreen.png"),
      emitAssetResolved("sunscreen", "genai"),
      emitCreativeReady(slot, "outputs/summer/us-en/sunscreen/1x1.png", "genai"),
      emitComplianceResult(slot, "WARN", ["free"]),
      emitComplianceFailed(slot, ["free"]),
      emitQualityResult(slot, "fail", ["luma-band"], true),
      emitCreativeStub(slot, "genai failed after retries"),
      emitError("genai", "API failure", slot),
      emitError("stream", "idle timeout"),
    ]

    for (const bytes of emitted) {
      const parsed = decode(bytes)
      const result = pipelineEventSchema.safeParse(parsed)
      expect(result.success, `failed to parse: ${JSON.stringify(parsed)}`).toBe(true)
    }
  })

  it("every emitted line ends with exactly one trailing newline", () => {
    const lines = [emitStep("resolve", slot), emitError("stream", "x")]
    for (const bytes of lines) {
      const text = new TextDecoder().decode(bytes)
      expect(text.endsWith("\n")).toBe(true)
      expect(text.split("\n").length).toBe(2)
    }
  })
})

describe("emitComplete round-trip", () => {
  it("round-trips a manifest byte-identically (report.json == complete event)", () => {
    const manifest: Manifest = {
      campaign: "summer",
      brand: "sunkiss",
      outputDir: "outputs/summer",
      counts: {
        requested: 1,
        succeeded: 1,
        failed: 0,
        generated: 1,
        reused: 0,
        flagged: 0,
        quality_flag: 0,
      },
      creatives: [
        {
          product: "sunscreen",
          market: "us-en",
          ratio: "1x1",
          path: "outputs/summer/us-en/sunscreen/1x1.png",
          source: "genai",
          compliance: {
            badge: "OK",
            checks: { logoPresent: true, bannedWords: [] },
          },
        },
      ],
      errors: [],
    }

    const bytes = emitComplete(manifest)
    const decoded = decode(bytes)
    const result = pipelineEventSchema.safeParse(decoded)
    expect(result.success).toBe(true)
    if (result.success && result.data.type === "complete") {
      expect(result.data.manifest).toEqual(manifest)
    }
  })
})