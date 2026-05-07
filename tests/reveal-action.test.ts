import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import path from "node:path"
import { ROOTS } from "@/lib/cast/server/safe-join"

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  )
  return {
    ...actual,
    default: { ...actual, stat: vi.fn() },
    stat: vi.fn(),
  }
})

vi.mock("node:child_process", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>("node:child_process")
  return {
    ...actual,
    default: { ...actual, execFile: vi.fn() },
    execFile: vi.fn(),
  }
})

import fs from "node:fs/promises"
import { execFile } from "node:child_process"
import { revealOutputFolder } from "@/app/actions/reveal"

const statMock = fs.stat as unknown as ReturnType<typeof vi.fn>
const execFileMock = execFile as unknown as ReturnType<typeof vi.fn>

const ORIGINAL_PLATFORM = process.platform

function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: p, configurable: true })
}

function dirStat(): { isDirectory: () => boolean } {
  return { isDirectory: () => true }
}

describe("revealOutputFolder", () => {
  beforeEach(() => {
    statMock.mockReset()
    execFileMock.mockReset()
    // Default: callback-style execFile resolves with no error.
    execFileMock.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        cb: (err: NodeJS.ErrnoException | null) => void,
      ) => {
        cb(null)
      },
    )
  })

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM)
    vi.restoreAllMocks()
  })

  it("rejects an invalid slug", async () => {
    const res = await revealOutputFolder({ campaign: "../etc" })
    expect(res).toEqual({ ok: false, error: "invalid campaign slug" })
    expect(statMock).not.toHaveBeenCalled()
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it("rejects an empty slug", async () => {
    const res = await revealOutputFolder({ campaign: "" })
    expect(res.ok).toBe(false)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it("rejects an uppercase slug", async () => {
    const res = await revealOutputFolder({ campaign: "Summer-2026" })
    expect(res.ok).toBe(false)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it("returns ok:false when the folder does not exist", async () => {
    statMock.mockRejectedValueOnce(
      Object.assign(new Error("nope"), { code: "ENOENT" }),
    )

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/not found/i)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it("returns ok:false when the path is a file, not a directory", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => false })
    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })
    expect(res.ok).toBe(false)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it("invokes `open` on darwin with the campaign folder", async () => {
    setPlatform("darwin")
    statMock.mockResolvedValueOnce(dirStat())

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })

    expect(res).toEqual({ ok: true })
    expect(execFileMock).toHaveBeenCalledTimes(1)
    const [cmd, args] = execFileMock.mock.calls[0]
    expect(cmd).toBe("open")
    expect(args).toEqual([
      path.resolve(ROOTS.outputs, "summer-refresh-2026"),
    ])
  })

  it("invokes `explorer.exe` on win32", async () => {
    setPlatform("win32")
    statMock.mockResolvedValueOnce(dirStat())

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })

    expect(res).toEqual({ ok: true })
    const [cmd, args] = execFileMock.mock.calls[0]
    expect(cmd).toBe("explorer.exe")
    expect(args).toEqual([
      path.resolve(ROOTS.outputs, "summer-refresh-2026"),
    ])
  })

  it("treats explorer.exe exit code 1 as success on win32", async () => {
    setPlatform("win32")
    statMock.mockResolvedValueOnce(dirStat())
    execFileMock.mockImplementationOnce(
      (
        _cmd: string,
        _args: string[],
        cb: (err: NodeJS.ErrnoException | null) => void,
      ) => {
        const err = Object.assign(new Error("Command failed"), { code: 1 })
        cb(err as unknown as NodeJS.ErrnoException)
      },
    )

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })
    expect(res).toEqual({ ok: true })
  })

  it("returns ok:false when execFile fails on darwin", async () => {
    setPlatform("darwin")
    statMock.mockResolvedValueOnce(dirStat())
    execFileMock.mockImplementationOnce(
      (
        _cmd: string,
        _args: string[],
        cb: (err: NodeJS.ErrnoException | null) => void,
      ) => {
        const err = Object.assign(new Error("boom"), { code: "ENOENT" })
        cb(err as NodeJS.ErrnoException)
      },
    )

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe("boom")
  })

  it("invokes `xdg-open` on linux", async () => {
    setPlatform("linux")
    statMock.mockResolvedValueOnce(dirStat())

    const res = await revealOutputFolder({ campaign: "summer-refresh-2026" })

    expect(res).toEqual({ ok: true })
    const [cmd, args] = execFileMock.mock.calls[0]
    expect(cmd).toBe("xdg-open")
    expect(args).toEqual([
      path.resolve(ROOTS.outputs, "summer-refresh-2026"),
    ])
  })
})
