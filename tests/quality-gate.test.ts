/**
 * Output quality gate (S2) — unit tests for the sharp-based quality module
 * and the `quality_result` event contract.
 *
 * The pipeline wiring (retry-once in route.ts) is covered by typecheck + the
 * route's structural tests; here we lock the pure check functions and the
 * event wire format.
 */

import { describe, it, expect } from "vitest"
import sharp from "sharp"
import {
  checkComposedPng,
  meanLuma,
  edgeDensity,
  EDGE_DENSITY_THRESHOLD,
} from "@/lib/cast/server/pipeline/quality"
import { pipelineEventSchema } from "@/lib/cast/events"

const SLOT = { product: "brisa-citrus", market: "de-de", ratio: "1x1" }

/** Make a solid-color PNG buffer of the given size. */
async function solidPng(
  width: number,
  height: number,
  rgb: [number, number, number]
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .png()
    .toBuffer()
}

/**
 * Make a blurred-noise PNG buffer — representative of REAL composed output
 * (photo + text + logo): high-frequency texture is low-pass filtered so
 * adjacent-pixel deltas stay below the 40-luma edge threshold, but there's
 * enough entropy for the PNG to exceed the 10 KB byte floor. This exercises
 * the happy path without tripping the text-leak heuristic the way pure
 * random noise would.
 */
async function noisePng(width: number, height: number): Promise<Buffer> {
  const px = Buffer.alloc(width * height * 3)
  for (let i = 0; i < px.length; i++) px[i] = Math.floor(Math.random() * 256)
  const blurred = await sharp(px, { raw: { width, height, channels: 3 } })
    .blur(3)
    .png()
    .toBuffer()
  return blurred
}

describe("checkComposedPng", () => {
  it("passes a normal noisy compose", async () => {
    const buf = await noisePng(1024, 1024)
    const result = await checkComposedPng(buf)
    expect(result.pass).toBe(true)
    expect(result.failures).toEqual([])
  })

  it("flags a too-small buffer on byte floor", async () => {
    const tiny = Buffer.from("not-a-png")
    const result = await checkComposedPng(tiny)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => f.startsWith("too-small"))).toBe(true)
  })

  it("flags a crushed-dark image on luma floor", async () => {
    const buf = await solidPng(256, 256, [2, 2, 2])
    const result = await checkComposedPng(buf)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => f.startsWith("crushed-dark"))).toBe(true)
  })

  it("flags a blown-out white image on luma ceiling", async () => {
    const buf = await solidPng(256, 256, [252, 252, 252])
    const result = await checkComposedPng(buf)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => f.startsWith("white-out"))).toBe(true)
  })

  it("never throws on decode failure — returns a decode-error failure", async () => {
    // A valid PNG header but corrupted body triggers sharp decode error.
    const corrupt = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0xff),
    ])
    const result = await checkComposedPng(corrupt)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => f.startsWith("decode-error"))).toBe(true)
  })
})

describe("meanLuma / edgeDensity pure functions", () => {
  it("meanLuma computes the midpoint for mid-gray", () => {
    const w = 2
    const h = 1
    // 2 px of [64, 64, 64]
    const px = Buffer.from([64, 64, 64, 64, 64, 64])
    const luma = meanLuma(px, w, h, 3)
    expect(luma).toBeCloseTo(64, 5)
  })

  it("edgeDensity is zero for a flat field and high for a checkerboard text-zone", () => {
    const w = 4
    const h = 4
    const flat = Buffer.alloc(w * h * 3, 128)
    expect(edgeDensity(flat, w, h, 3)).toBe(0)

    const checker = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const off = (y * w + x) * 3
        const v = (x + y) % 2 === 0 ? 0 : 255
        checker[off] = checker[off + 1] = checker[off + 2] = v
      }
    }
    // Bottom 45% of a 4-row frame = row 2+; the checkerboard produces near-max
    // edge density there.
    const density = edgeDensity(checker, w, h, 3)
    expect(density).toBeGreaterThan(EDGE_DENSITY_THRESHOLD)
  })
})

describe("quality_result event contract", () => {
  it("accepts pass and fail badges (with failures + retried) and rejects unknown badges", () => {
    const pass = pipelineEventSchema.safeParse({
      type: "quality_result",
      slot: SLOT,
      badge: "pass",
      failures: [],
      retried: false,
    })
    expect(pass.success).toBe(true)

    const fail = pipelineEventSchema.safeParse({
      type: "quality_result",
      slot: SLOT,
      badge: "fail",
      failures: [
        "white-out: mean luma 250.0 > 245",
        "text-leak: edge density 0.900 > 0.12",
      ],
      retried: true,
    })
    expect(fail.success).toBe(true)
    if (fail.success) {
      const ev = fail.data
      if (ev.type !== "quality_result")
        throw new Error("expected quality_result")
      expect(ev.retried).toBe(true)
      expect(ev.failures.length).toBe(2)
    }

    const invalid = pipelineEventSchema.safeParse({
      type: "quality_result",
      slot: SLOT,
      badge: "warn",
      failures: [],
      retried: false,
    })
    expect(invalid.success).toBe(false)
  })
})
