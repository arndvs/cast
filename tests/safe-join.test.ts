import { describe, it, expect } from "vitest"
import path from "node:path"
import {
  ROOTS,
  safeJoin,
  PathTraversalError,
} from "@/lib/cast/server/safe-join"

describe("safeJoin", () => {
  it("resolves segments under the root", () => {
    expect(safeJoin("inputs", "brands", "brisa", "brand.json")).toBe(
      path.join(ROOTS.inputs, "brands", "brisa", "brand.json")
    )
    expect(safeJoin("inputs")).toBe(ROOTS.inputs)
  })

  it("rejects traversal, absolute, and injection segments", () => {
    expect(() => safeJoin("inputs", "..", "etc")).toThrow(PathTraversalError)
    expect(() => safeJoin("inputs", "brands", "..", "..", "outputs")).toThrow(
      PathTraversalError
    )
    expect(() => safeJoin("inputs", "/etc/passwd")).toThrow(PathTraversalError)
    expect(() => safeJoin("inputs", "brisa\0.json")).toThrow(PathTraversalError)
    expect(() => safeJoin("inputs", "")).toThrow(PathTraversalError)
  })

  it.runIf(process.platform === "win32")(
    "rejects Windows absolute path segments",
    () => {
      expect(() => safeJoin("inputs", "C:\\Windows\\System32")).toThrow(
        PathTraversalError
      )
    }
  )

  it("rejects unknown root keys", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => safeJoin("etc", "passwd")).toThrow(PathTraversalError)
  })
})
