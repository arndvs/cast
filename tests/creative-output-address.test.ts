import { describe, expect, it } from "vitest"

import {
  absolutePathOnFs,
  proxyUrl,
  repoRelativePath,
  validateAddress,
  type CreativeOutputAddress,
} from "@/lib/cast/creative-output-address"

const addr: CreativeOutputAddress = {
  campaign: "summer",
  market: "us-en",
  product: "brisa-citrus",
  ratio: "1x1",
}

describe("repoRelativePath", () => {
  it("produces the stored outputs path", () => {
    expect(repoRelativePath(addr)).toBe("outputs/summer/us-en/brisa-citrus/1x1.png")
  })
})

describe("proxyUrl", () => {
  it("produces the browser img URL", () => {
    expect(proxyUrl(addr)).toBe("/api/outputs/summer/us-en/brisa-citrus/1x1.png")
  })

  it("percent-encodes each segment", () => {
    const weird: CreativeOutputAddress = { ...addr, product: "brisa citrus & co" }
    expect(proxyUrl(weird)).toBe("/api/outputs/summer/us-en/brisa%20citrus%20%26%20co/1x1.png")
  })
})

describe("absolutePathOnFs", () => {
  it("composes the address onto a root", () => {
    expect(absolutePathOnFs(addr, "/repo/cast/outputs")).toBe(
      "/repo/cast/outputs/summer/us-en/brisa-citrus/1x1.png",
    )
  })

  it("normalizes a trailing slash on the root", () => {
    expect(absolutePathOnFs(addr, "/repo/cast/outputs/")).toBe(
      "/repo/cast/outputs/summer/us-en/brisa-citrus/1x1.png",
    )
  })
})

describe("validateAddress", () => {
  it("accepts a valid address", () => {
    expect(validateAddress(addr)).toBeNull()
  })

  it("rejects malformed coordinates at the single boundary", () => {
    expect(validateAddress({ ...addr, campaign: "Summer!" })).toMatch(/campaign/)
    expect(validateAddress({ ...addr, market: "US" })).toMatch(/market/)
    expect(validateAddress({ ...addr, product: "brisa citrus" })).toMatch(/product/)
    expect(validateAddress({ ...addr, ratio: "4x5" as CreativeOutputAddress["ratio"] })).toMatch(/ratio/)
  })
})

describe("projection agreement contract", () => {
  it("repo-relative path, proxy URL, and absolute path all derive from one coordinate", () => {
    const stored = repoRelativePath(addr)
    const proxied = proxyUrl(addr)
    const abs = absolutePathOnFs(addr, "/repo/cast/outputs")

    // The proxy URL is the stored path with /api/ prefix + percent-encoding.
    expect(proxied).toBe(`/api/${stored}`)
    // The absolute path is the stored path under the outputs root.
    expect(abs).toBe(`/repo/cast/outputs/${stored.replace(/^outputs\//, "")}`)
  })

  it("all projects agree across multiple coordinates (parameterized)", () => {
    const coordinates: CreativeOutputAddress[] = [
      { campaign: "a", market: "us-en", product: "p", ratio: "1x1" },
      { campaign: "b", market: "de-de", product: "q-r", ratio: "9x16" },
      { campaign: "c", market: "mx-es", product: "s", ratio: "16x9" },
    ]
    for (const coord of coordinates) {
      const stored = repoRelativePath(coord)
      expect(proxyUrl(coord)).toBe(`/api/${stored}`)
      expect(absolutePathOnFs(coord, "/out")).toBe(`/out/${stored.replace(/^outputs\//, "")}`)
      expect(validateAddress(coord)).toBeNull()
    }
  })
})