/**
 * Path safety primitives — D12, D13.
 *
 * Every filesystem write resolves through `safeJoin(root, ...segments)` against
 * the fixed `ROOTS` set. Mismatch throws. Used by /api/upload, /api/detected-assets,
 * the brand-loader, the logo proxy, and (in V4) the pipeline writer + reveal action.
 *
 * Lexical only — does NOT call `realpath` to re-validate after symlink resolution.
 * Accepted POC limitation; every caller MUST add a `// TODO(symlink-hardening)`
 * comment so the gap stays visible for production hardening.
 */

import path from "node:path"

export type RootKey = "inputs" | "outputs"

export const ROOTS: Record<RootKey, string> = {
  inputs: path.resolve(process.cwd(), "inputs"),
  outputs: path.resolve(process.cwd(), "outputs"),
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PathTraversalError"
  }
}

/**
 * Resolve `...segments` under `ROOTS[root]` and assert the result stays inside.
 *
 * Rejects:
 *   - parent traversal (`..`, `..\\..`)
 *   - absolute path segments (`/etc/passwd`, `C:\Windows`)
 *   - null bytes (POSIX path-injection guard)
 *   - empty segments
 */
export function safeJoin(root: RootKey, ...segments: string[]): string {
  const base = ROOTS[root]
  if (!base) {
    throw new PathTraversalError(`unknown root key: ${root}`)
  }
  for (const seg of segments) {
    if (typeof seg !== "string" || seg.length === 0) {
      throw new PathTraversalError(`empty path segment under root "${root}"`)
    }
    if (seg.includes("\0")) {
      throw new PathTraversalError(`null byte in path segment under root "${root}"`)
    }
    if (path.isAbsolute(seg)) {
      throw new PathTraversalError(`absolute path segment "${seg}" under root "${root}"`)
    }
  }
  const resolved = path.resolve(base, ...segments)
  // Allow exact base (caller may safeJoin with no extra segments to get root)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new PathTraversalError(
      `path "${resolved}" escapes root "${base}" (segments: ${JSON.stringify(segments)})`,
    )
  }
  return resolved
}
