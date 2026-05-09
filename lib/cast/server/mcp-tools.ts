/**
 * MCP Tool Registry — declarative map of Cast operations to MCP tools.
 *
 * Each tool wraps an existing `lib/cast/server/` function with:
 *   - Zod `inputSchema` (reuses existing schemas — no duplication)
 *   - Zod `outputSchema` (typed JSON for agent callers)
 *   - `annotations` (`readOnlyHint`, `destructiveHint`)
 *   - `handler` returning both `structuredContent` (typed) and `content` (text fallback)
 *
 * No new business logic — every handler delegates to existing functions.
 * The registry is consumed by `mcp.ts` (Slice 14b) via `registerCastTools()`.
 */

import { z } from "zod"
import {
  briefSchema,
  SLUG_RE,
  MARKET_RE,
  ratioSchema,
  type BrandProfile,
} from "@/lib/cast/schemas"
import type { ComplianceResult } from "@/lib/cast/server/pipeline/compliance"

// ---------------------------------------------------------------------------
// Tool type
// ---------------------------------------------------------------------------

export interface CastMcpToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface CastMcpToolResult<T> {
  structuredContent: T
  content: string
}

export interface CastMcpTool {
  name: string
  title: string
  description: string
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  annotations: CastMcpToolAnnotations
  handler: (input: never) => Promise<CastMcpToolResult<unknown>>
}

// ---------------------------------------------------------------------------
// Dependency injection — resolved server functions
// ---------------------------------------------------------------------------

export interface McpToolDeps {
  listBrandSlugs: () => Promise<string[]>
  loadBrandProfile: (slug: string) => Promise<BrandProfile>
  findLocalAsset: (productSlug: string) => Promise<string | null>
  buildPromptPreview: (args: {
    brand: {
      displayName: string
      voice: readonly string[]
      paletteHexes: readonly string[]
      bannedWords: readonly string[]
    }
    product: { name: string; sku: string }
    market: string
    ratio: z.infer<typeof ratioSchema>
  }) => string
  runCompliance: (input: {
    headline: string
    bannedWords: readonly string[]
  }) => ComplianceResult
  getStorageAdapter: () => {
    readFile(container: "inputs" | "outputs", key: string): Promise<Buffer>
  }
}

// ---------------------------------------------------------------------------
// Tool builder helper (preserves types within each tool definition)
// ---------------------------------------------------------------------------

function defineTool<TIn, TOut>(tool: {
  name: string
  title: string
  description: string
  inputSchema: z.ZodType<TIn>
  outputSchema: z.ZodType<TOut>
  annotations: CastMcpToolAnnotations
  handler: (input: TIn) => Promise<CastMcpToolResult<TOut>>
}): CastMcpTool {
  return tool as unknown as CastMcpTool
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function buildToolRegistry(deps: McpToolDeps): CastMcpTool[] {
  return [
    // ── Read-only tools ───────────────────────────────────────────────
    defineTool({
      name: "list_brands",
      title: "List Brands",
      description: "List all available brand slugs.",
      inputSchema: z.object({}),
      outputSchema: z.object({ slugs: z.array(z.string()) }),
      annotations: { readOnlyHint: true },
      handler: async () => {
        const slugs = await deps.listBrandSlugs()
        return {
          structuredContent: { slugs },
          content: `Available brands: ${slugs.join(", ")}`,
        }
      },
    }),

    defineTool({
      name: "get_brand_profile",
      title: "Get Brand Profile",
      description:
        "Load the full brand profile for a given slug, including palette, voice, logos, and banned words.",
      inputSchema: z.object({
        slug: z.string().regex(SLUG_RE, "slug must be lowercase-kebab"),
      }),
      outputSchema: z.object({
        slug: z.string(),
        displayName: z.string(),
        bannedWordCount: z.number(),
        logoCount: z.number(),
        paletteHexes: z.array(z.string()),
        voiceFragmentCount: z.number(),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const profile = await deps.loadBrandProfile(input.slug)
        const summary = {
          slug: profile.slug,
          displayName: profile.brand.displayName,
          bannedWordCount: profile.bannedWords.length,
          logoCount: profile.logoVariants.length,
          paletteHexes: [profile.brand.colors.primary, profile.brand.colors.accent, profile.brand.colors.background ?? ""].filter(Boolean),
          voiceFragmentCount: profile.voice.promptFragments.length,
        }
        return {
          structuredContent: summary,
          content: `Brand "${profile.brand.displayName}" — ${profile.logoVariants.length} logos, ${profile.voice.promptFragments.length} voice fragments, ${profile.bannedWords.length} banned words`,
        }
      },
    }),

    defineTool({
      name: "detect_assets",
      title: "Detect Assets",
      description:
        "Check which product slugs have local photo assets available (png/jpg/webp).",
      inputSchema: z.object({
        slugs: z.array(z.string().regex(SLUG_RE)).min(1),
      }),
      outputSchema: z.object({
        results: z.array(
          z.object({
            slug: z.string(),
            foundFile: z.string().nullable(),
          }),
        ),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const results = await Promise.all(
          input.slugs.map(async (slug) => ({
            slug,
            foundFile: await deps.findLocalAsset(slug),
          })),
        )
        const found = results.filter((r) => r.foundFile).length
        return {
          structuredContent: { results },
          content: `${found}/${results.length} product slugs have local assets`,
        }
      },
    }),

    defineTool({
      name: "preview_prompt",
      title: "Preview Prompt",
      description:
        "Generate a preview of the GenAI prompt that would be used for a specific product/market/ratio combination.",
      inputSchema: z.object({
        brand: z.string().regex(SLUG_RE),
        productName: z.string().min(1),
        productSku: z.string().min(1),
        market: z.string().regex(MARKET_RE),
        ratio: ratioSchema,
      }),
      outputSchema: z.object({ prompt: z.string() }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const profile = await deps.loadBrandProfile(input.brand)
        const prompt = deps.buildPromptPreview({
          brand: {
            displayName: profile.brand.displayName,
            voice: profile.voice.promptFragments,
            paletteHexes: [
              profile.brand.colors.primary,
              profile.brand.colors.accent,
              profile.brand.colors.background ?? "",
            ].filter(Boolean),
            bannedWords: profile.bannedWords,
          },
          product: { name: input.productName, sku: input.productSku },
          market: input.market,
          ratio: input.ratio,
        })
        return {
          structuredContent: { prompt },
          content: prompt,
        }
      },
    }),

    defineTool({
      name: "check_compliance",
      title: "Check Compliance",
      description:
        "Run compliance checks on a headline against a list of banned words. Returns OK or FAIL with details.",
      inputSchema: z.object({
        headline: z.string().min(1),
        bannedWords: z.array(z.string()),
      }),
      outputSchema: z.object({
        badge: z.enum(["OK", "FAIL"]),
        checks: z.object({
          logoPresent: z.boolean(),
          bannedWords: z.array(z.string()),
        }),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const result = deps.runCompliance({
          headline: input.headline,
          bannedWords: input.bannedWords,
        })
        return {
          structuredContent: result,
          content: `Compliance: ${result.badge}${result.checks.bannedWords.length > 0 ? ` — banned words found: ${result.checks.bannedWords.join(", ")}` : ""}`,
        }
      },
    }),

    defineTool({
      name: "get_manifest",
      title: "Get Manifest",
      description:
        "Read the run manifest (report.json) for a campaign. Returns the full manifest if found.",
      inputSchema: z.object({
        campaign: z.string().regex(SLUG_RE),
      }),
      outputSchema: z.object({
        found: z.boolean(),
        manifest: z.unknown().optional(),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        try {
          const adapter = deps.getStorageAdapter()
          const buf = await adapter.readFile(
            "outputs",
            `${input.campaign}/report.json`,
          )
          const manifest: unknown = JSON.parse(buf.toString("utf8"))
          return {
            structuredContent: { found: true, manifest },
            content: `Manifest found for campaign "${input.campaign}"`,
          }
        } catch (err: unknown) {
          // Only treat ENOENT (missing report.json) as "not found".
          // Rethrow permission errors, JSON parse failures, and other I/O issues.
          if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
            return {
              structuredContent: { found: false },
              content: `No manifest found for campaign "${input.campaign}"`,
            }
          }
          throw err
        }
      },
    }),

    // ── Mutating tools ────────────────────────────────────────────────
    defineTool({
      name: "generate_campaign",
      title: "Generate Campaign",
      description:
        "Run the full creative generation pipeline for a brief. Generates images for all product/market/ratio combinations. Long-running — sends progress notifications.",
      inputSchema: briefSchema,
      outputSchema: z.object({
        campaign: z.string(),
        status: z.enum(["complete", "partial", "failed"]),
        creativeCount: z.number(),
        errorCount: z.number(),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
      handler: async () => {
        // Placeholder — wired in Slice 14b when the MCP server transport is added.
        throw new Error(
          "generate_campaign handler not yet wired (Slice 14b)",
        )
      },
    }),
  ]
}

// ---------------------------------------------------------------------------
// Registration helper
// ---------------------------------------------------------------------------

/**
 * Register all Cast tools on an MCP server instance.
 * Called by `mcp.ts` (Slice 14b) during server setup.
 *
 * @param server - An MCP server instance with a `tool()` registration method
 * @param deps - Resolved server function dependencies
 */
export function registerCastTools(
  server: {
    tool: (
      name: string,
      config: Record<string, unknown>,
      handler: (input: unknown) => Promise<unknown>,
    ) => void
  },
  deps: McpToolDeps,
): void {
  const tools = buildToolRegistry(deps)
  for (const tool of tools) {
    server.tool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (input: unknown) => tool.handler(input as never),
    )
  }
}
