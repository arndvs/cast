import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "node:path"
import { ROOTS } from "@/lib/cast/server/safe-join"

// ---------------------------------------------------------------------------
// Mock node:fs/promises — intercept all filesystem calls at the boundary
// ---------------------------------------------------------------------------

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

// Import AFTER mock is installed
import fs from "node:fs/promises"
import { LocalFsAdapter } from "@/lib/cast/server/storage-adapter"

function enoent(syscall = "access"): NodeJS.ErrnoException {
  const err = new Error(`ENOENT: no such file or directory`) as NodeJS.ErrnoException
  err.code = "ENOENT"
  err.syscall = syscall
  return err
}

function eacces(syscall = "access"): NodeJS.ErrnoException {
  const err = new Error(`EACCES: permission denied`) as NodeJS.ErrnoException
  err.code = "EACCES"
  err.syscall = syscall
  return err
}

describe("LocalFsAdapter", () => {
  let adapter: LocalFsAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new LocalFsAdapter()
  })

  // ── readFile ─────────────────────────────────────────────────────────

  describe("readFile", () => {
    it("reads a file from the correct absolute path", async () => {
      const buf = Buffer.from("hello")
      vi.mocked(fs.readFile).mockResolvedValue(buf)

      const result = await adapter.readFile("outputs", "campaign/report.json")

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(ROOTS.outputs, "campaign", "report.json"),
      )
      expect(result).toBe(buf)
    })

    it("propagates ENOENT from fs.readFile", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(enoent("open"))

      await expect(adapter.readFile("inputs", "missing.json")).rejects.toThrow("ENOENT")
    })
  })

  // ── writeFile ────────────────────────────────────────────────────────

  describe("writeFile", () => {
    it("creates parent directories and writes data", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue()

      await adapter.writeFile("outputs", "camp/market/prod/1x1.png", Buffer.from("png"))

      const expectedDir = path.join(ROOTS.outputs, "camp", "market", "prod")
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true })
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(ROOTS.outputs, "camp", "market", "prod", "1x1.png"),
        Buffer.from("png"),
      )
    })

    it("accepts contentType param without error (ignored on local)", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue()

      await expect(
        adapter.writeFile("outputs", "f.json", "{}", "application/json"),
      ).resolves.toBeUndefined()
    })
  })

  // ── deleteFile ───────────────────────────────────────────────────────

  describe("deleteFile", () => {
    it("delegates to fs.rm with force: true", async () => {
      vi.mocked(fs.rm).mockResolvedValue()

      await adapter.deleteFile("outputs", "camp/old.png")

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(ROOTS.outputs, "camp", "old.png"),
        { force: true },
      )
    })
  })

  // ── deletePrefix ─────────────────────────────────────────────────────

  describe("deletePrefix", () => {
    it("recursively removes the prefix directory", async () => {
      vi.mocked(fs.rm).mockResolvedValue()

      await adapter.deletePrefix("outputs", "campaign-2026")

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(ROOTS.outputs, "campaign-2026"),
        { recursive: true, force: true },
      )
    })

    it("is a no-op when prefix does not exist (force: true)", async () => {
      vi.mocked(fs.rm).mockResolvedValue()

      await expect(
        adapter.deletePrefix("outputs", "nonexistent"),
      ).resolves.toBeUndefined()
    })
  })

  // ── fileExists ───────────────────────────────────────────────────────

  describe("fileExists", () => {
    it("returns true when fs.access succeeds", async () => {
      vi.mocked(fs.access).mockResolvedValue()

      expect(await adapter.fileExists("outputs", "camp/report.json")).toBe(true)
    })

    it("returns false for ENOENT", async () => {
      vi.mocked(fs.access).mockRejectedValue(enoent())

      expect(await adapter.fileExists("outputs", "missing.json")).toBe(false)
    })

    it("rethrows EACCES instead of returning false", async () => {
      vi.mocked(fs.access).mockRejectedValue(eacces())

      await expect(adapter.fileExists("outputs", "secret.json")).rejects.toThrow("EACCES")
    })

    it("rethrows non-ENOENT errors", async () => {
      const eio = new Error("EIO") as NodeJS.ErrnoException
      eio.code = "EIO"
      vi.mocked(fs.access).mockRejectedValue(eio)

      await expect(adapter.fileExists("outputs", "bad-disk.json")).rejects.toThrow("EIO")
    })
  })

  // ── listFiles ────────────────────────────────────────────────────────

  describe("listFiles", () => {
    it("returns empty array for ENOENT (missing directory)", async () => {
      vi.mocked(fs.readdir).mockRejectedValue(enoent("scandir"))

      const result = await adapter.listFiles("outputs", "nonexistent")
      expect(result).toEqual([])
    })

    it("rethrows EACCES from readdir", async () => {
      vi.mocked(fs.readdir).mockRejectedValue(eacces("scandir"))

      await expect(adapter.listFiles("outputs", "locked")).rejects.toThrow("EACCES")
    })

    it("returns only files, not directories, from a flat listing", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "a.png", isFile: () => true, isDirectory: () => false },
        { name: "subdir", isFile: () => false, isDirectory: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      // When readdir is called for the subdir, return one file
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "a.png", isFile: () => true, isDirectory: () => false },
        { name: "subdir", isFile: () => false, isDirectory: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "b.png", isFile: () => true, isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      const result = await adapter.listFiles("outputs", "camp")

      expect(result).toContain("camp/a.png")
      expect(result).toContain("camp/subdir/b.png")
      expect(result).not.toContain("camp/subdir")
    })

    it("recurses into nested directories", async () => {
      // Top-level: one directory
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "market", isFile: () => false, isDirectory: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)
      // market/: one file + one directory
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "product", isFile: () => false, isDirectory: () => true },
        { name: "brief.json", isFile: () => true, isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)
      // market/product/: two files
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: "1x1.png", isFile: () => true, isDirectory: () => false },
        { name: "16x9.png", isFile: () => true, isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      const result = await adapter.listFiles("outputs", "camp")

      // Directories are recursed inline, so nested files appear before
      // sibling files that come after the directory entry.
      expect(result).toEqual([
        "camp/market/product/1x1.png",
        "camp/market/product/16x9.png",
        "camp/market/brief.json",
      ])
    })
  })

  // ── getPublicUrl ─────────────────────────────────────────────────────

  describe("getPublicUrl", () => {
    it("returns /api/outputs/... for outputs container", () => {
      expect(adapter.getPublicUrl("outputs", "camp/us/prod/1x1.png")).toBe(
        "/api/outputs/camp/us/prod/1x1.png",
      )
    })

    it("percent-encodes path segments with special characters", () => {
      expect(adapter.getPublicUrl("outputs", "camp/file name.png")).toBe(
        "/api/outputs/camp/file%20name.png",
      )
    })

    it("throws for inputs container", () => {
      expect(() => adapter.getPublicUrl("inputs", "assets/photo.png")).toThrow(
        /does not support the "inputs" container/,
      )
    })
  })
})
