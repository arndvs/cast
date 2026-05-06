"use client"

import * as React from "react"

import type { S1Action, S1State } from "@/components/cast/s1-state"
import { pipelineEventSchema } from "@/lib/cast/events"

/**
 * D30 — stream idle abort threshold. The server's `start` callback may pause
 * for tens of seconds during dall-e-3 generation, so the threshold has to be
 * generous. 90 s matches the spec.
 */
const IDLE_TIMEOUT_MS = 90_000

/**
 * V4 run controller.
 *
 * Watches `state.runState`. When it transitions to `running`, POSTs the
 * current brief to `/api/generate`, decodes the NDJSON response line-by-line,
 * and dispatches `pipeline-event` for each parsed event. Synthesizes a
 * `run-error` action on:
 *   - non-2xx responses                  → stage = "validation" (server
 *                                          returned JSON `{ errors: [...] }`)
 *   - non-NDJSON content type            → stage = "stream"
 *   - `IDLE_TIMEOUT_MS` between chunks   → stage = "stream" (D30)
 *   - JSON.parse failure on a line       → stage = "stream"
 *   - fetch/network error                → stage = "stream"
 *
 * Idle timer: an `AbortController` is created at run start. Each successful
 * read from the body resets a 90 s timer. If the timer fires, the controller
 * aborts the fetch, which surfaces as `AbortError` and is mapped to a
 * `stage: "stream"` error.
 */
export function useRunController(
  state: S1State,
  dispatch: React.Dispatch<S1Action>,
  cancelRef?: React.RefObject<(() => void) | null>,
): void {
  // Track the active controller so a re-run or unmount cancels in-flight work.
  const controllerRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (state.runState !== "running") return

    const controller = new AbortController()
    controllerRef.current = controller
    if (cancelRef) cancelRef.current = () => controller.abort()
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    function resetIdle(): void {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        controller.abort(new DOMException("idle", "AbortError"))
      }, IDLE_TIMEOUT_MS)
    }

    async function run(): Promise<void> {
      let res: Response
      try {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state.brief),
          signal: controller.signal,
        })
      } catch (err) {
        if (cancelled) return
        dispatch({
          type: "run-error",
          stage: "stream",
          message: err instanceof Error ? err.message : String(err),
        })
        return
      }

      const contentType = res.headers.get("content-type") ?? ""
      if (!res.ok) {
        // Validation/loader errors come back as JSON `{ errors: [...] }`.
        let message = `${res.status} ${res.statusText}`
        try {
          const body = await res.json()
          if (Array.isArray(body.errors) && body.errors.length > 0) {
            message = body.errors.map((e: { message: string }) => e.message).join("; ")
          }
        } catch {
          // ignore — fall back to status text
        }
        dispatch({ type: "run-error", stage: "validation", message })
        return
      }
      if (!contentType.includes("application/x-ndjson")) {
        dispatch({
          type: "run-error",
          stage: "stream",
          message: `unexpected content-type: ${contentType || "(missing)"}`,
        })
        return
      }
      if (!res.body) {
        dispatch({ type: "run-error", stage: "stream", message: "response body is null" })
        return
      }

      resetIdle()
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          resetIdle()
          buffer += value
          let nl: number
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line) continue
            const dispatched = parseAndDispatch(line, dispatch)
            if (!dispatched) return // parse failure already dispatched run-error
          }
        }
        // Tail: a stream that ends without a trailing newline.
        const tail = buffer.trim()
        if (tail) parseAndDispatch(tail, dispatch)
      } catch (err) {
        if (cancelled) return
        const isAbort =
          err instanceof DOMException && err.name === "AbortError"
        dispatch({
          type: "run-error",
          stage: "stream",
          message: isAbort
            ? `stream idle for ${Math.round(IDLE_TIMEOUT_MS / 1000)}s`
            : err instanceof Error
              ? err.message
              : String(err),
        })
      } finally {
        if (idleTimer) clearTimeout(idleTimer)
      }
    }

    void run()

    return () => {
      cancelled = true
      if (idleTimer) clearTimeout(idleTimer)
      controller.abort()
      controllerRef.current = null
      if (cancelRef) cancelRef.current = null
    }
    // We deliberately depend only on the run-state transition. The brief
    // snapshot is captured at run start; mid-run edits don't restart the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.runState])
}

function parseAndDispatch(
  line: string,
  dispatch: React.Dispatch<S1Action>,
): boolean {
  let raw: unknown
  try {
    raw = JSON.parse(line)
  } catch (err) {
    dispatch({
      type: "run-error",
      stage: "stream",
      message: `invalid NDJSON line: ${err instanceof Error ? err.message : String(err)}`,
    })
    return false
  }
  const parsed = pipelineEventSchema.safeParse(raw)
  if (!parsed.success) {
    dispatch({
      type: "run-error",
      stage: "stream",
      message: `unrecognized event: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
    })
    return false
  }
  dispatch({ type: "pipeline-event", event: parsed.data })
  return true
}
