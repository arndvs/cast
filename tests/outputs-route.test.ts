import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import path from "node:path"
import { ROOTS } from "@/lib/cast/server/safe-join"

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  )
  return {
    ...actual,
    default: {
      ...actual,
      readFile: vi.fn(),
    },
    readFile: vi.fn(),
  }
})

import fs from "node:fs/promises"
import { GET } from "@/app/api/outputs/[...path]/route"

const readFileMock = fs.readFile as unknown as ReturnType<typeof vi.fn>

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

function call(segments: string[]): Promise<Response> {
  const url = `http://localhost/api/outputs/${segments.join("/")}`
  return GET(new Request(url), {
    params: Promise.resolve({ path: segments }),
  }) as unknown as Promise<Response>
}

describe("GET /api/outputs/[...path]", () => {
  beforeEach(() => {
    readFileMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the bytes for an existing png", async () => {
    readFileMock.mockResolvedValueOnce(PNG_BYTES)

    const res = await call(["summer-refresh", "us-en", "brisa-citrus", "1x1.png"])

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")

    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.equals(PNG_BYTES)).toBe(true)

    const calledWith = readFileMock.mock.calls[0]?.[0] as string
    expect(calledWith).toBe(
      path.resolve(
        ROOTS.outputs,
        "summer-refresh",
        "us-en",
        "brisa-citrus",
        "1x1.png",
      ),
    )
  })

  it("rejects parent traversal with 404", async () => {
    const res = await call(["..", "..", "etc", "passwd.png"])
    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("rejects absolute path segments with 404", async () => {
    const res = await call(["/etc/passwd.png"])
    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("rejects non-png extensions with 404", async () => {
    const res = await call(["summer", "us-en", "brisa", "report.json"])
    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("accepts uppercase .PNG (case-insensitive whitelist)", async () => {
    readFileMock.mockResolvedValueOnce(PNG_BYTES)

    const res = await call(["summer", "us-en", "brisa", "1x1.PNG"])

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(readFileMock).toHaveBeenCalledTimes(1)
  })

  it("rejects extensionless paths with 404", async () => {
    const res = await call(["summer", "us-en", "brisa"])
    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the file is missing (ENOENT)", async () => {
    const enoent = Object.assign(new Error("not found"), { code: "ENOENT" })
    readFileMock.mockRejectedValueOnce(enoent)

    const res = await call(["summer", "us-en", "brisa", "1x1.png"])
    expect(res.status).toBe(404)
  })

  it("returns 500 on other filesystem errors", async () => {
    const eacces = Object.assign(new Error("denied"), { code: "EACCES" })
    readFileMock.mockRejectedValueOnce(eacces)

    const res = await call(["summer", "us-en", "brisa", "1x1.png"])
    expect(res.status).toBe(500)
  })

  it("returns 404 for an empty path array", async () => {
    const res = await call([])
    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })
})
