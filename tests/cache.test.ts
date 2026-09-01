/**
 * Persistent cross-run cache (S3) — pure key derivation + storage round-trip
 * via the LocalFsAdapter with a mocked fs boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "node:path"
import { ROOTS } from "@/lib/cast/server/safe-join"

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
  },
}))

import fs from "node:fs/promises"
import { LocalFsAdapter } from "@/lib/cast/server/storage-adapter"
import { cacheKey, lookupCachedMaster, writeCachedMaster, clearPipelineCache } from "@/lib/cast/server/pipeline/cache"

function enoent(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

describe("cacheKey", () => {
  it("is deterministic and stable-length", () => {
    const a = cacheKey("same prompt text")
    const b = cacheKey("same prompt text")
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
    expect(cacheKey("other prompt")).not.toBe(a)
  })

  it("differs when the prompt changes", () => {
    expect(cacheKey("prompt one")).not.toBe(cacheKey("prompt two"))
  })
})

describe("lookupCachedMaster / writeCachedMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: file doesn't exist → miss.
    vi.mocked(fs.access).mockRejectedValue(enoent())
  })

  it("returns null on a cache miss", async () => {
    const result = await lookupCachedMaster("summer", "some prompt")
    expect(result).toBeNull()
  })

  it("returns null when the meta is unreadable (graceful miss)", async () => {
    const key = cacheKey("some prompt")
    const pngKey = path.join(ROOTS.outputs, "summer", ".pipeline-cache", `${key}.png`)
    const metaKey = path.join(ROOTS.outputs, "summer", ".pipeline-cache", `${key}.meta.json`)
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.readFile).mockImplementation((p: unknown) => {
      if (String(p) === pngKey) return Promise.resolve(Buffer.from("fake-png-bytes"))
      return Promise.reject(new Error("boom"))
    })
    const result = await lookupCachedMaster("summer", "some prompt")
    expect(result).toBeNull()
    expect(fs.access).toHaveBeenCalledWith(pngKey)
  })

  it("writes png + meta files under .pipeline-cache", async () => {
    const key = cacheKey("some prompt")
    const base = path.join(ROOTS.outputs, "summer", ".pipeline-cache")
    await writeCachedMaster("summer", "some prompt", Buffer.from("png-bytes"), {
      model: "dall-e-3",
      revisedPrompt: null,
      promptUsed: "some prompt",
      mode: "default",
    })
    expect(fs.mkdir).toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(base, `${key}.png`),
      Buffer.from("png-bytes"),
    )
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(base, `${key}.meta.json`),
      expect.stringContaining('"model": "dall-e-3"'),
    )
  })

  it("clearPipelineCache deletes the cache prefix", async () => {
    await clearPipelineCache("summer")
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(ROOTS.outputs, "summer", ".pipeline-cache"),
      expect.objectContaining({ recursive: true, force: true }),
    )
  })

  it("never throws when the adapter is unavailable (miss)", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error("EACCES: denied"))
    // access throwing EACCES should propagate per adapter semantics; the cache
    // module's lookupCachedMaster catches everything and returns null.
    const result = await lookupCachedMaster("summer", "x")
    expect(result).toBeNull()
  })
})