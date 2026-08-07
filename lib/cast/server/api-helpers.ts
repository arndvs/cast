import { NextResponse } from "next/server"
import { StorageNotFoundError } from "@/lib/cast/server/storage-adapter"

/** True when `err` is a not-found error from the storage layer. */
export function isStorageNotFound(err: unknown): boolean {
  if (err instanceof StorageNotFoundError) return true
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  )
}

/** @deprecated Use `isStorageNotFound` — retained for non-adapter call sites. */
export const isENOENT = isStorageNotFound

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
