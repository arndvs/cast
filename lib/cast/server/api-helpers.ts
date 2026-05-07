import { NextResponse } from "next/server"

/** True when `err` is a Node.js `ENOENT` filesystem error. */
export function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  )
}

/**
 * Return a JSON error response shaped as `{ errors: [...] }` with the
 * given HTTP status. Used across API routes for consistent error payloads.
 */
export function jsonError(
  status: number,
  errors: { path: (string | number)[]; message: string }[],
): NextResponse {
  return NextResponse.json({ errors }, { status })
}
