import { describe, it, expect } from "vitest"
import path from "node:path"
import { ROOTS, safeJoin, PathTraversalError } from "@/lib/cast/server/safe-join"

describe("safeJoin", () => {
  it("resolves a simple slug under inputs", () => {
    const out = safeJoin("inputs", "brands", "brisa", "brand.json")
    expect(out).toBe(path.join(ROOTS.inputs, "brands", "brisa", "brand.json"))
  })

  it("returns the root when no segments are passed", () => {
    expect(safeJoin("inputs")).toBe(ROOTS.inputs)
  })

  it("rejects parent traversal via ..", () => {
    expect(() => safeJoin("inputs", "..", "etc")).toThrow(PathTraversalError)
  })

  it("rejects nested parent traversal", () => {
    expect(() => safeJoin("inputs", "brands", "..", "..", "outputs")).toThrow(
      PathTraversalError,
    )
  })

  it("rejects POSIX absolute path segments", () => {
    expect(() => safeJoin("inputs", "/etc/passwd")).toThrow(PathTraversalError)
  })

  it.runIf(process.platform === "win32")(
    "rejects Windows absolute path segments",
    () => {
      expect(() => safeJoin("inputs", "C:\\Windows\\System32")).toThrow(
        PathTraversalError,
      )
    },
  )

  it("rejects null bytes", () => {
    expect(() => safeJoin("inputs", "brisa\0.json")).toThrow(PathTraversalError)
  })

  it("rejects empty segments", () => {
    expect(() => safeJoin("inputs", "")).toThrow(PathTraversalError)
  })

  it("rejects unknown root keys", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => safeJoin("etc", "passwd")).toThrow(PathTraversalError)
  })
})
