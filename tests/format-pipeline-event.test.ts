import { describe, it, expect } from "vitest"
import {
  eventLabel,
  eventDetail,
  slotLabel,
} from "@/lib/cast/format-pipeline-event"
import type { PipelineEvent } from "@/lib/cast/events"

const slot = { product: "sunscreen", market: "us-en", ratio: "1x1" as const }

describe("slotLabel", () => {
  it("formats as product/market/ratio", () => {
    expect(slotLabel(slot)).toBe("sunscreen/us-en/1x1")
  })
})

describe("eventLabel", () => {
  it("returns stage for step events", () => {
    const event: PipelineEvent = { type: "step", stage: "resolve", slot }
    expect(eventLabel(event)).toBe("resolve")
  })

  it("returns 'asset' for asset_resolved", () => {
    const event: PipelineEvent = {
      type: "asset_resolved",
      product: "sunscreen",
      source: "local",
      file: "inputs/assets/sunscreen.png",
    }
    expect(eventLabel(event)).toBe("asset")
  })

  it("returns 'ready' for creative_ready", () => {
    const event: PipelineEvent = {
      type: "creative_ready",
      slot,
      path: "outputs/summer/us-en/sunscreen-1x1.png",
      source: "genai",
    }
    expect(eventLabel(event)).toBe("ready")
  })

  it("returns badge for compliance_result", () => {
    const event: PipelineEvent = {
      type: "compliance_result",
      slot,
      badge: "WARN",
      bannedWords: ["free"],
    }
    expect(eventLabel(event)).toBe("WARN")
  })

  it("returns err:stage for error events", () => {
    const event: PipelineEvent = {
      type: "error",
      stage: "compose",
      slot,
      message: "canvas error",
    }
    expect(eventLabel(event)).toBe("err:compose")
  })

  it("returns 'complete' for complete events", () => {
    const event: PipelineEvent = {
      type: "complete",
      manifest: {
        campaign: "summer",
        brand: "acme",
        outputDir: "outputs/summer",
        counts: { requested: 1, succeeded: 1, failed: 0, generated: 1, reused: 0, flagged: 0 },
        creatives: [],
        errors: [],
      },
    }
    expect(eventLabel(event)).toBe("complete")
  })
})

describe("eventDetail", () => {
  it("formats step with slot and message", () => {
    const event: PipelineEvent = {
      type: "step",
      stage: "resize",
      slot,
      message: "1024×1024",
    }
    expect(eventDetail(event)).toBe("sunscreen/us-en/1x1 — 1024×1024")
  })

  it("formats step without message", () => {
    const event: PipelineEvent = {
      type: "step",
      stage: "resolve",
      slot,
    }
    expect(eventDetail(event)).toBe("sunscreen/us-en/1x1")
  })

  it("formats asset_resolved with file", () => {
    const event: PipelineEvent = {
      type: "asset_resolved",
      product: "sunscreen",
      source: "local",
      file: "inputs/assets/sunscreen.png",
    }
    expect(eventDetail(event)).toBe("sunscreen · local · inputs/assets/sunscreen.png")
  })

  it("formats asset_resolved without file", () => {
    const event: PipelineEvent = {
      type: "asset_resolved",
      product: "sunscreen",
      source: "genai",
    }
    expect(eventDetail(event)).toBe("sunscreen · genai")
  })

  it("formats creative_ready", () => {
    const event: PipelineEvent = {
      type: "creative_ready",
      slot,
      path: "outputs/summer/us-en/sunscreen-1x1.png",
      source: "genai",
    }
    expect(eventDetail(event)).toBe(
      "sunscreen/us-en/1x1 · outputs/summer/us-en/sunscreen-1x1.png",
    )
  })

  it("formats compliance_result with banned words", () => {
    const event: PipelineEvent = {
      type: "compliance_result",
      slot,
      badge: "WARN",
      bannedWords: ["free", "guarantee"],
    }
    expect(eventDetail(event)).toBe(
      "sunscreen/us-en/1x1 · banned=[free,guarantee]",
    )
  })

  it("formats compliance_result without banned words", () => {
    const event: PipelineEvent = {
      type: "compliance_result",
      slot,
      badge: "OK",
      bannedWords: [],
    }
    expect(eventDetail(event)).toBe("sunscreen/us-en/1x1")
  })

  it("formats error with slot", () => {
    const event: PipelineEvent = {
      type: "error",
      stage: "compose",
      slot,
      message: "canvas error",
    }
    expect(eventDetail(event)).toBe("sunscreen/us-en/1x1 · canvas error")
  })

  it("formats error without slot", () => {
    const event: PipelineEvent = {
      type: "error",
      stage: "resolve",
      message: "file not found",
    }
    expect(eventDetail(event)).toBe("file not found")
  })

  it("formats complete with counts", () => {
    const event: PipelineEvent = {
      type: "complete",
      manifest: {
        campaign: "summer",
        brand: "acme",
        outputDir: "outputs/summer",
        counts: { requested: 6, succeeded: 5, failed: 1, generated: 3, reused: 2, flagged: 1 },
        creatives: [],
        errors: [],
      },
    }
    expect(eventDetail(event)).toBe("5/6 succeeded · 1 failed · 1 flagged")
  })
})
