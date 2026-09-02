/**
 * Retry helper — timing + classification.
 *
 * Verifies:
 *   - retryable: 429, 500–599, ETIMEDOUT, ECONNRESET; everything else throws
 *     on first failure
 *   - jitter in [0.75 × base, 1.25 × base], capped at the last base entry
 *   - `Retry-After` ≤ 30s wins over base; > 30s falls back to base
 *   - three attempts, two waits, documented backoff
 */

import { describe, it, expect, vi } from "vitest"
import {
  BASE_BACKOFFS_MS,
  isRetryable,
  nextDelayMs,
  retry,
  type RetryableError,
} from "@/lib/cast/server/retry"

function mkError(props: Partial<RetryableError>): RetryableError {
  return Object.assign(new Error(props.message ?? "boom"), props)
}

describe("isRetryable", () => {
  it("classifies retryable statuses and IO codes", () => {
    for (const status of [429, 500, 503, 599]) {
      expect(isRetryable(mkError({ status }))).toBe(true)
    }
    expect(isRetryable(mkError({ code: "ETIMEDOUT" }))).toBe(true)
    expect(isRetryable(mkError({ code: "ECONNRESET" }))).toBe(true)
  })

  it("rejects non-retryable statuses and unknown shapes", () => {
    for (const status of [400, 401, 403, 404, 600]) {
      expect(isRetryable(mkError({ status }))).toBe(false)
    }
    expect(isRetryable(new Error("plain"))).toBe(false)
    expect(isRetryable(undefined)).toBe(false)
    expect(isRetryable("oops")).toBe(false)
  })
})

describe("nextDelayMs", () => {
  it("clamps jitter to [0.75, 1.25) and caps the base index", () => {
    const half = () => 0.5 // jitter = 1.0 → exact base
    expect(nextDelayMs(1, undefined, half)).toBe(BASE_BACKOFFS_MS[0])
    expect(nextDelayMs(2, undefined, half)).toBe(BASE_BACKOFFS_MS[1])
    expect(nextDelayMs(3, undefined, half)).toBe(BASE_BACKOFFS_MS[2])
    expect(nextDelayMs(99, undefined, half)).toBe(BASE_BACKOFFS_MS[2])

    const min = nextDelayMs(1, undefined, () => 0)
    const max = nextDelayMs(1, undefined, () => 0.999)
    expect(min).toBe(Math.round(BASE_BACKOFFS_MS[0] * 0.75))
    expect(max).toBeLessThanOrEqual(Math.round(BASE_BACKOFFS_MS[0] * 1.25))
    expect(max).toBeGreaterThanOrEqual(Math.round(BASE_BACKOFFS_MS[0] * 1.249))
  })

  it("honors Retry-After only when ≤ 30s, else falls back to base", () => {
    const half = () => 0.5
    expect(nextDelayMs(1, 7, () => 0.999)).toBe(7_000)
    expect(nextDelayMs(1, 30, () => 0.999)).toBe(30_000)
    expect(nextDelayMs(1, 31, half)).toBe(BASE_BACKOFFS_MS[0])
    expect(nextDelayMs(1, 9999, half)).toBe(BASE_BACKOFFS_MS[0])
    // Negative, NaN, and infinite Retry-After all fall back to base.
    expect(nextDelayMs(1, -1, half)).toBe(BASE_BACKOFFS_MS[0])
    expect(nextDelayMs(1, Number.NaN, half)).toBe(BASE_BACKOFFS_MS[0])
    expect(nextDelayMs(1, Number.POSITIVE_INFINITY, half)).toBe(
      BASE_BACKOFFS_MS[0]
    )
  })
})

describe("retry()", () => {
  it("returns the result on first success without sleeping", async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi.fn(async () => "ok")
    await expect(retry(fn, { sleep, random: () => 0.5 })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("retries up to 3 attempts on retryable errors with the documented backoff", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    const random = () => 0.5 // identity jitter
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw mkError({ status: 503, message: `fail ${calls}` })
      return "ok"
    })
    await expect(retry(fn, { sleep, random })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
    // Two waits between three attempts.
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep.mock.calls[0][0]).toBe(BASE_BACKOFFS_MS[0])
    expect(sleep.mock.calls[1][0]).toBe(BASE_BACKOFFS_MS[1])
  })

  it("throws the original error after exhausting attempts", async () => {
    const sleep = vi.fn(async () => {})
    const err = mkError({ status: 500, message: "always 500" })
    const fn = vi.fn(async () => {
      throw err
    })
    await expect(retry(fn, { sleep, random: () => 0.5 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("does not retry non-retryable errors (e.g. 400)", async () => {
    const sleep = vi.fn(async () => {})
    const err = mkError({ status: 400, message: "bad request" })
    const fn = vi.fn(async () => {
      throw err
    })
    await expect(retry(fn, { sleep, random: () => 0.5 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("honors Retry-After on retryable errors", async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw mkError({ status: 429, retryAfterSeconds: 5 })
      return "ok"
    })
    await expect(retry(fn, { sleep, random: () => 0.999 })).resolves.toBe("ok")
    expect(sleep).toHaveBeenCalledWith(5_000)
  })
})
