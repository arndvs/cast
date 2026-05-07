/**
 * Retry helper.
 *
 * 3 attempts (initial + 2 retries). Backoff base sequence: 1s / 4s / 16s,
 * each multiplied by a uniform jitter in `[0.75, 1.25]`. `Retry-After` from
 * the upstream response is honored verbatim **only if** ≤ 30 s; otherwise it
 * falls back to the jittered base.
 *
 * Retryable error classes:
 *   - HTTP status `429`
 *   - HTTP status `500`–`599`
 *   - Node IO errors with `code === 'ETIMEDOUT'` or `'ECONNRESET'`
 *
 * Anything else (4xx other than 429, AbortError, TypeError) is thrown
 * immediately on the first failure.
 *
 * Surfaces a tagged `RetryableError` interface so the caller can attach a
 * `status` and optional `retryAfterSeconds` for the helper to consume.
 */

export interface RetryableError extends Error {
  status?: number
  retryAfterSeconds?: number
  code?: string
}

export interface RetryDeps {
  /** Sleep `ms` milliseconds. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  /** Source of jitter; returns a value in `[0, 1)`. Defaults to `Math.random`. */
  random?: () => number
}

export interface RetryOpts extends RetryDeps {
  /** Total attempts including the first. Defaults to 3. */
  attempts?: number
}

/** Base backoffs in milliseconds, indexed by attempt number (0-based). */
export const BASE_BACKOFFS_MS = [1_000, 4_000, 16_000] as const
const MAX_RETRY_AFTER_MS = 30_000

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

export function isRetryable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as RetryableError
  if (typeof e.status === "number") {
    if (e.status === 429) return true
    if (e.status >= 500 && e.status < 600) return true
  }
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET") return true
  return false
}

/**
 * Compute the wait before the next retry, given the 1-based index of the
 * attempt that just failed (`failedAttemptIndex`). E.g. on the first failure
 * we wait `BASE_BACKOFFS_MS[0]` (jittered) before attempt #2.
 *
 * `retryAfterSeconds` overrides the base sequence iff present and ≤ 30 s.
 * `random()` returns `[0, 1)`; jitter range is `[0.75, 1.25]`.
 */
export function nextDelayMs(
  failedAttemptIndex: number,
  retryAfterSeconds: number | undefined,
  random: () => number,
): number {
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0 &&
    retryAfterSeconds * 1_000 <= MAX_RETRY_AFTER_MS
  ) {
    return Math.round(retryAfterSeconds * 1_000)
  }
  const idx = Math.min(failedAttemptIndex - 1, BASE_BACKOFFS_MS.length - 1)
  const base = BASE_BACKOFFS_MS[idx]
  const jitter = 0.75 + random() * 0.5 // [0.75, 1.25)
  return Math.round(base * jitter)
}

/**
 * Run `fn` with retry. Returns `fn`'s resolved value or throws the
 * final error (the last retryable, or the first non-retryable).
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3
  const sleep = opts.sleep ?? defaultSleep
  const random = opts.random ?? Math.random

  let lastErr: unknown
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts || !isRetryable(err)) throw err
      const retryAfter = (err as RetryableError).retryAfterSeconds
      await sleep(nextDelayMs(i, retryAfter, random))
    }
  }
  throw lastErr
}
