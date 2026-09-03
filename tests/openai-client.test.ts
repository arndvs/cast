import { afterEach, describe, expect, it, vi } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { getOpenAIClient } from "@/lib/cast/server/config"

afterEach(() => {
  vi.unstubAllEnvs()
  // Reset the global singleton between tests so each test exercises a fresh lazy-init.
  delete (globalThis as Record<string, unknown>).__openaiClient
})

function findOpenAIConstruction(root: string): string[] {
  const hits: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) hits.push(...findOpenAIConstruction(full))
    else if (entry.name.endsWith(".ts")) {
      const lines = readFileSync(full, "utf-8").split("\n")
      lines.forEach((line, i) => {
        // Ignore the doc-comment mention and any `//` comment lines.
        if (line.includes("new OpenAI(") && !line.trim().startsWith("*") && !line.trim().startsWith("//")) {
          hits.push(`${path.relative(root, full)}:${i + 1}`)
        }
      })
    }
  }
  return hits
}

describe("getOpenAIClient", () => {
  it("constructs a client from OPENAI_API_KEY", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key-123")
    const client = await getOpenAIClient()
    expect(client).toBeDefined()
  })

  it("returns the same client across calls (singleton)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key-123")
    const a = await getOpenAIClient()
    const b = await getOpenAIClient()
    expect(a).toBe(b)
  })

  it("throws when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    await expect(getOpenAIClient()).rejects.toThrow("OPENAI_API_KEY is not set")
  })

  it("is the only `new OpenAI(` construction site under lib/cast/server", () => {
    const root = path.resolve(process.cwd(), "lib/cast/server")
    const hits = findOpenAIConstruction(root)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain("config.ts")
  })
})