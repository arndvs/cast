/**
 * Image metadata pipeline — analyzes generated creatives and writes
 * structured metadata as JSON sidecars.
 *
 * Called during the pipeline loop for each creative, before the write
 * stage. Uses a cheap vision model (gpt-4o-mini) to extract description,
 * tags, colors, and mood from the composed image. Deterministic fields
 * (campaign, brand, market, etc.) are always populated; AI fields
 * gracefully degrade to empty arrays / null on analysis failure so the
 * pipeline never breaks.
 *
 * The resulting metadata is passed to `writeCreativeOutput`, which writes
 * the `.metadata.json` sidecar alongside the PNG via the StorageAdapter.
 */

import OpenAI from "openai"
import { z } from "zod"
import type { AspectRatio } from "@/lib/cast/schemas"
import { ratioSchema } from "@/lib/cast/schemas"
import { getOpenAIApiKey } from "@/lib/cast/server/config"

// ---------------------------------------------------------------------------
// Shared OpenAI client (lazy singleton — same pattern as pipeline/genai.ts)
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null
function getClient(): OpenAI {
  if (openaiClient) return openaiClient
  openaiClient = new OpenAI({ apiKey: getOpenAIApiKey() })
  return openaiClient
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const imageMetadataSchema = z.object({
  campaign: z.string(),
  brand: z.string(),
  product: z.string(),
  market: z.string(),
  ratio: ratioSchema,
  source: z.enum(["local", "genai"]),

  // AI-analyzed fields (nullable — graceful degradation on analysis failure)
  description: z.string().nullable(),
  tags: z.array(z.string()),
  colors: z.array(z.string()),
  mood: z.array(z.string()),

  // Generation context
  promptUsed: z.string().nullable(),
  model: z.string().nullable(),
  revisedPrompt: z.string().nullable(),

  generatedAt: z.string().datetime(),
})

export type ImageMetadata = z.infer<typeof imageMetadataSchema>

// ---------------------------------------------------------------------------
// Analysis context (passed in by the pipeline orchestrator)
// ---------------------------------------------------------------------------

export interface AnalyzeImageContext {
  campaign: string
  brand: string
  product: string
  market: string
  ratio: AspectRatio
  source: "local" | "genai"
  promptUsed: string | null
  model: string | null
  revisedPrompt: string | null
}

// ---------------------------------------------------------------------------
// AI analysis response schema (structured output from the vision model)
// ---------------------------------------------------------------------------

const analysisResponseSchema = z.object({
  description: z.string(),
  tags: z.array(z.string()),
  colors: z.array(z.string()),
  mood: z.array(z.string()),
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze an image buffer and return structured metadata. AI analysis failure
 * is caught and returns metadata with only deterministic fields populated.
 */
export async function analyzeImage(imageBuffer: Buffer, context: AnalyzeImageContext, deps?: { client?: OpenAI }): Promise<ImageMetadata> {
  const deterministic: ImageMetadata = {
    campaign: context.campaign,
    brand: context.brand,
    product: context.product,
    market: context.market,
    ratio: context.ratio,
    source: context.source,
    description: null,
    tags: [],
    colors: [],
    mood: [],
    promptUsed: context.promptUsed,
    model: context.model,
    revisedPrompt: context.revisedPrompt,
    generatedAt: new Date().toISOString(),
  }

  try {
    const analysis = await callVisionModel(imageBuffer, deps?.client)
    return {
      ...deterministic,
      description: analysis.description,
      tags: analysis.tags,
      colors: analysis.colors,
      mood: analysis.mood,
    }
  } catch {
    // Graceful degradation — deterministic fields only
    return deterministic
  }
}

// ---------------------------------------------------------------------------
// Vision model call
// ---------------------------------------------------------------------------

const ANALYSIS_PROMPT = `Analyze this social media ad creative image. Return a JSON object with:
- description: 1-2 sentence description of the image content
- tags: array of 5-10 visual/content tags (e.g. "product-shot", "gradient-background", "bold-typography")
- colors: array of 3-5 dominant hex colors (e.g. "#FF5733")
- mood: array of 2-4 mood/atmosphere descriptors (e.g. "energetic", "premium", "playful")

Return ONLY the JSON object, no other text.`

async function callVisionModel(imageBuffer: Buffer, client?: OpenAI): Promise<z.infer<typeof analysisResponseSchema>> {
  const openai = client ?? getClient()

  const base64 = imageBuffer.toString("base64")
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: ANALYSIS_PROMPT },
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64}`, detail: "low" } },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0,
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error("Empty response from vision model")
  }

  // Strip markdown fences if present
  const cleaned = text.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
  const parsed = JSON.parse(cleaned) as unknown

  return analysisResponseSchema.parse(parsed)
}
