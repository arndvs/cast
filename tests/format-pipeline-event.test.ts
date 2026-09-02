import { describe, it, expect } from "vitest"
import {
  eventLabel,
  eventDetail,
  slotLabel,
} from "@/lib/cast/format-pipeline-event"
import type { PipelineEvent } from "@/lib/cast/events"

const slot = { product: "sunscreen", market: "us-en", ratio: "1x1" as const }

/** Build a terminal `complete` event carrying a manifest snapshot. */
function completeEvent(counts: {
  requested: number
  succeeded: number
  failed: number
}): PipelineEvent {
  return {
    type: "complete",
    manifest: {
      campaign: "summer",
      brand: "acme",
      outputDir: "outputs/summer",
      counts: { ...counts, generated: 1, reused: 0, flagged: 1 },
      creatives: [],
      errors: [],
    },
  }
}

describe("slotLabel", () => {
  it("formats as product/market/ratio", () => {
    expect(slotLabel(slot)).toBe("sunscreen/us-en/1x1")
  })
})

describe("eventLabel", () => {
  it("maps each event type to its short label", () => {
    expect(eventLabel({ type: "step", stage: "resolve", slot })).toBe("resolve")
    expect(
      eventLabel({
        type: "asset_resolved",
        product: "sunscreen",
        source: "local",
        file: "inputs/assets/sunscreen.png",
      })
    ).toBe("asset")
    expect(
      eventLabel({
        type: "creative_ready",
        slot,
        path: "outputs/summer/us-en/sunscreen-1x1.png",
        source: "genai",
      })
    ).toBe("ready")
    expect(
      eventLabel({
        type: "compliance_result",
        slot,
        badge: "WARN",
        bannedWords: ["free"],
      })
    ).toBe("WARN")
    expect(
      eventLabel({ type: "error", stage: "compose", slot, message: "x" })
    ).toBe("err:compose")
    expect(
      eventLabel({
        type: "quality_result",
        slot,
        badge: "pass",
        failures: [],
        retried: false,
      })
    ).toBe("pass")
    expect(
      eventLabel(completeEvent({ requested: 1, succeeded: 1, failed: 0 }))
    ).toBe("complete")
  })
})

describe("eventDetail", () => {
  it("formats step events with optional message suffix", () => {
    expect(eventDetail({ type: "step", stage: "resize", slot })).toBe(
      "sunscreen/us-en/1x1"
    )
    expect(
      eventDetail({ type: "step", stage: "resize", slot, message: "1024×1024" })
    ).toBe("sunscreen/us-en/1x1 — 1024×1024")
  })

  it("formats asset_resolved and creative_ready with their fields", () => {
    expect(
      eventDetail({
        type: "asset_resolved",
        product: "sunscreen",
        source: "local",
        file: "inputs/assets/sunscreen.png",
      })
    ).toBe("sunscreen · local · inputs/assets/sunscreen.png")
    expect(
      eventDetail({
        type: "creative_ready",
        slot,
        path: "outputs/summer/us-en/sunscreen-1x1.png",
        source: "genai",
      })
    ).toBe("sunscreen/us-en/1x1 · outputs/summer/us-en/sunscreen-1x1.png")
  })

  it("formats compliance_result, adding banned words when present", () => {
    const ok: PipelineEvent = {
      type: "compliance_result",
      slot,
      badge: "OK",
      bannedWords: [],
    }
    expect(eventDetail(ok)).toBe("sunscreen/us-en/1x1")
    const warn: PipelineEvent = {
      type: "compliance_result",
      slot,
      badge: "WARN",
      bannedWords: ["free", "guarantee"],
    }
    expect(eventDetail(warn)).toBe(
      "sunscreen/us-en/1x1 · banned=[free,guarantee]"
    )
  })

  it("formats error events with or without a slot", () => {
    expect(
      eventDetail({
        type: "error",
        stage: "compose",
        slot,
        message: "canvas error",
      })
    ).toBe("sunscreen/us-en/1x1 · canvas error")
    expect(
      eventDetail({
        type: "error",
        stage: "resolve",
        message: "file not found",
      })
    ).toBe("file not found")
  })

  it("formats complete with the run counts", () => {
    expect(
      eventDetail(completeEvent({ requested: 6, succeeded: 5, failed: 1 }))
    ).toBe("5/6 succeeded · 1 failed · 1 flagged")
  })
})
