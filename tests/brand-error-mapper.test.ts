import { describe, expect, it } from "vitest"

import {
  BrandIncompleteError,
  BrandInvalidError,
  BrandNotFoundError,
} from "@/lib/cast/errors"
import { brandLoadErrorToResponse } from "@/lib/cast/brand-hints"

describe("brandLoadErrorToResponse", () => {
  it("maps NotFound → 404 with kind notFound", () => {
    const { status, body } = brandLoadErrorToResponse(new BrandNotFoundError("brisa"))
    expect(status).toBe(404)
    expect(body.kind).toBe("notFound")
    if (body.kind === "notFound") expect(body.slug).toBe("brisa")
  })

  it("maps Incomplete → 400 with kind incomplete + missing file", () => {
    const { status, body } = brandLoadErrorToResponse(
      new BrandIncompleteError("brisa", "voice.json"),
    )
    expect(status).toBe(400)
    expect(body.kind).toBe("incomplete")
    if (body.kind === "incomplete") expect(body.missing).toBe("voice.json")
  })

  it("maps Invalid → 400 with kind invalid + file + issues", () => {
    const { status, body } = brandLoadErrorToResponse(
      new BrandInvalidError("brisa", "brand.json", [
        { path: ["colors"], message: "missing primary" },
      ]),
    )
    expect(status).toBe(400)
    expect(body.kind).toBe("invalid")
    if (body.kind === "invalid") {
      expect(body.file).toBe("brand.json")
      expect(body.issues).toEqual([{ path: ["colors"], message: "missing primary" }])
    }
  })

  it("distinguishes Incomplete from Invalid (both 400, different kind)", () => {
    const incomplete = brandLoadErrorToResponse(
      new BrandIncompleteError("brisa", "voice.json"),
    )
    const invalid = brandLoadErrorToResponse(
      new BrandInvalidError("brisa", "brand.json", []),
    )
    expect(incomplete.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(incomplete.body.kind).toBe("incomplete")
    expect(invalid.body.kind).toBe("invalid")
  })

  it("rethrows non-brand errors", () => {
    const unrelated = new Error("boom")
    expect(() => brandLoadErrorToResponse(unrelated)).toThrow("boom")
  })
})