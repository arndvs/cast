/**
 * Image metadata pipeline tests.
 *
 * Covers:
 *   - imageMetadataSchema validation (valid + invalid payloads)
 *   - analyzeImage with successful vision model response
 *   - analyzeImage graceful degradation on vision model failure
 *   - analyzeImage graceful degradation on malformed response
 */

import { describe, it, expect, vi } from "vitest"
import { analyzeImage, imageMetadataSchema, type AnalyzeImageContext } from "@/lib/cast/server/metadata"
import type OpenAI from "openai"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTEXT: AnalyzeImageContext = {
  campaign: "summer-refresh-2026",
  brand: "brisa",
  product: "can-citrus",
  market: "us-en",
  ratio: "1x1",
  source: "genai",
  promptUsed: "A refreshing citrus can on a gradient background",
  model: "dall-e-3",
  revisedPrompt: "A photorealistic refreshing citrus can...",
}

const VISION_RESPONSE = {
  description: "A vibrant citrus can on a gradient blue-green background",
  tags: ["product-shot", "gradient-background", "citrus", "beverage", "vibrant"],
  colors: ["#00B4D8", "#FF6B35", "#FFFFFF"],
  mood: ["energetic", "refreshing"],
}

function fakeBuffer(): Buffer {
  return Buffer.from("fake-png-data")
}

function makeMockClient(response: { content: string | null }): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: response.content } }],
        }),
      },
    },
  } as unknown as OpenAI
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("imageMetadataSchema", () => {
  it("accepts a valid metadata object", () => {
    const valid = {
      campaign: "summer-2026",
      brand: "brisa",
      product: "can-citrus",
      market: "us-en",
      ratio: "1x1",
      source: "genai",
      description: "A product shot",
      tags: ["product", "citrus"],
      colors: ["#FF0000"],
      mood: ["energetic"],
      promptUsed: "test prompt",
      model: "dall-e-3",
      revisedPrompt: "revised prompt",
      generatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(imageMetadataSchema.parse(valid)).toEqual(valid)
  })

  it("accepts nullable AI fields", () => {
    const valid = {
      campaign: "summer-2026",
      brand: "brisa",
      product: "can-citrus",
      market: "us-en",
      ratio: "1x1",
      source: "local",
      description: null,
      tags: [],
      colors: [],
      mood: [],
      promptUsed: null,
      model: null,
      revisedPrompt: null,
      generatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(imageMetadataSchema.parse(valid)).toEqual(valid)
  })

  it("rejects invalid ratio", () => {
    const invalid = {
      campaign: "summer-2026",
      brand: "brisa",
      product: "can-citrus",
      market: "us-en",
      ratio: "4x3",
      source: "genai",
      description: null,
      tags: [],
      colors: [],
      mood: [],
      promptUsed: null,
      model: null,
      revisedPrompt: null,
      generatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(() => imageMetadataSchema.parse(invalid)).toThrow()
  })

  it("rejects invalid source", () => {
    const invalid = {
      campaign: "summer-2026",
      brand: "brisa",
      product: "can-citrus",
      market: "us-en",
      ratio: "1x1",
      source: "products",
      description: null,
      tags: [],
      colors: [],
      mood: [],
      promptUsed: null,
      model: null,
      revisedPrompt: null,
      generatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(() => imageMetadataSchema.parse(invalid)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// analyzeImage — success path
// ---------------------------------------------------------------------------

describe("analyzeImage", () => {
  it("returns full metadata when vision model succeeds", async () => {
    const client = makeMockClient({ content: JSON.stringify(VISION_RESPONSE) })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.campaign).toBe("summer-refresh-2026")
    expect(result.brand).toBe("brisa")
    expect(result.product).toBe("can-citrus")
    expect(result.market).toBe("us-en")
    expect(result.ratio).toBe("1x1")
    expect(result.source).toBe("genai")
    expect(result.description).toBe(VISION_RESPONSE.description)
    expect(result.tags).toEqual(VISION_RESPONSE.tags)
    expect(result.colors).toEqual(VISION_RESPONSE.colors)
    expect(result.mood).toEqual(VISION_RESPONSE.mood)
    expect(result.promptUsed).toBe(CONTEXT.promptUsed)
    expect(result.model).toBe("dall-e-3")
    expect(result.revisedPrompt).toBe(CONTEXT.revisedPrompt)
    expect(result.generatedAt).toBeTruthy()
  })

  it("handles markdown-fenced JSON responses", async () => {
    const fenced = "```json\n" + JSON.stringify(VISION_RESPONSE) + "\n```"
    const client = makeMockClient({ content: fenced })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBe(VISION_RESPONSE.description)
    expect(result.tags).toEqual(VISION_RESPONSE.tags)
  })

  it("handles leading-newline fenced responses", async () => {
    const fenced = "\n```json\n" + JSON.stringify(VISION_RESPONSE) + "\n```\n"
    const client = makeMockClient({ content: fenced })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBe(VISION_RESPONSE.description)
    expect(result.tags).toEqual(VISION_RESPONSE.tags)
  })

  it("handles plain ``` fences without json tag", async () => {
    const fenced = "```\n" + JSON.stringify(VISION_RESPONSE) + "\n```"
    const client = makeMockClient({ content: fenced })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBe(VISION_RESPONSE.description)
    expect(result.tags).toEqual(VISION_RESPONSE.tags)
  })

  it("passes the image as base64 to the vision model", async () => {
    const client = makeMockClient({ content: JSON.stringify(VISION_RESPONSE) })
    const buf = Buffer.from("test-png")

    await analyzeImage(buf, CONTEXT, { client })

    const createFn = client.chat.completions.create as ReturnType<typeof vi.fn>
    const callArgs = createFn.mock.calls[0]![0]
    const imageContent = callArgs.messages[0].content[1]
    expect(imageContent.image_url.url).toContain(buf.toString("base64"))
  })

  // ---------------------------------------------------------------------------
  // Graceful degradation
  // ---------------------------------------------------------------------------

  it("returns deterministic-only metadata when vision model throws", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("API rate limit")),
        },
      },
    } as unknown as OpenAI

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    // Deterministic fields populated
    expect(result.campaign).toBe("summer-refresh-2026")
    expect(result.brand).toBe("brisa")
    expect(result.source).toBe("genai")
    expect(result.promptUsed).toBe(CONTEXT.promptUsed)
    expect(result.model).toBe("dall-e-3")

    // AI fields gracefully degraded
    expect(result.description).toBeNull()
    expect(result.tags).toEqual([])
    expect(result.colors).toEqual([])
    expect(result.mood).toEqual([])
  })

  it("returns deterministic-only metadata on empty response", async () => {
    const client = makeMockClient({ content: null })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBeNull()
    expect(result.tags).toEqual([])
  })

  it("returns deterministic-only metadata on malformed JSON", async () => {
    const client = makeMockClient({ content: "not valid json {{{" })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBeNull()
    expect(result.tags).toEqual([])
  })

  it("returns deterministic-only metadata on schema-invalid response", async () => {
    // Missing required fields
    const client = makeMockClient({ content: JSON.stringify({ description: "ok" }) })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    expect(result.description).toBeNull()
    expect(result.tags).toEqual([])
  })

  it("populates generatedAt with an ISO timestamp", async () => {
    const client = makeMockClient({ content: JSON.stringify(VISION_RESPONSE) })

    const result = await analyzeImage(fakeBuffer(), CONTEXT, { client })

    // Verify it's a parseable ISO date
    const parsed = new Date(result.generatedAt)
    expect(parsed.getTime()).not.toBeNaN()
  })

  it("works with local source and null generation fields", async () => {
    const localContext: AnalyzeImageContext = {
      ...CONTEXT,
      source: "local",
      promptUsed: null,
      model: null,
      revisedPrompt: null,
    }
    const client = makeMockClient({ content: JSON.stringify(VISION_RESPONSE) })

    const result = await analyzeImage(fakeBuffer(), localContext, { client })

    expect(result.source).toBe("local")
    expect(result.promptUsed).toBeNull()
    expect(result.model).toBeNull()
    expect(result.revisedPrompt).toBeNull()
    expect(result.description).toBe(VISION_RESPONSE.description)
  })
})
