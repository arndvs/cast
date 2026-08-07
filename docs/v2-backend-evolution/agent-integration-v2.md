# Agent Integration — Cast

> Cast is built API-first. Every action available in the browser UI is also available as an API call or an MCP tool call. This document describes how Cast exposes its capabilities to agents, schedulers, and external marketing automation systems — and where humans stay in the loop.

---

## The thesis

Six months ago, opening a SaaS dashboard was the only way to run a campaign. Today, an agent can call an API, get structured results back, and route them to the next system — with a human reviewing only the exceptions.

Cast is designed for exactly this transition. Today the pipeline lives in `lib/cast/` and is called by Next.js route handlers (`app/api/*`). The target architecture extracts these into `lib/cast/server/` — a pure-logic layer that can be called by any transport. The UI is one caller. A future Fastify API is another. The MCP transport is a third. All three callers hit the same code.

```
Human via UI        →  Next.js (today)  →  lib/cast/server/
Scheduler (cron)    →  Fastify (planned) →  lib/cast/server/
Agent via MCP       →  stdio / HTTP MCP (planned) →  lib/cast/server/
```

The UI doesn't disappear — it becomes the human-review layer. The agent does the work; the human validates the output, approves what's ready, and flags what needs attention.

---

## MCP transport — stdio first, HTTP later

### Phase 1: stdio (zero infrastructure)

The stdio transport runs as a subprocess. Claude Desktop, Claude Code, VS Code MCP extension, and most LLM agent frameworks support it out of the box. Implementation is tracked in [backend-evolution-plan.md](backend-evolution-plan.md) Slice 14b.

**Connect Cast to your agent (once `lib/cast/server/mcp.ts` is implemented):**

```bash
# Run the MCP server
npx tsx lib/cast/server/mcp.ts
```

**Add to your agent's `mcp.json` config:**

```json
{
  "mcpServers": {
    "cast": {
      "command": "npx",
      "args": ["tsx", "lib/cast/server/mcp.ts"],
      "env": {
        "OPENAI_API_KEY": "...",
        "CAST_STORAGE": "local",
        "QDRANT_URL": "...",
        "QDRANT_API_KEY": "..."
      }
    }
  }
}
```

No server to deploy. No auth to configure. The agent starts the process and communicates over stdio. This is the planned implementation path for the POC and interview demo. Today, Cast's API surface is the Next.js route handlers under `app/api/*`.

The `McpServer` constructor includes an `instructions` string — a short description of what Cast does and how to start. This appears in Claude Desktop's MCP panel and is used by agent frameworks for context. Example: *"Cast generates localized social ad creatives from brand profiles. Start with list_brands or the cast://brands resource, load a brand profile, then generate_campaign."*

### Phase 2: HTTP transport (post-Fastify split)

When Cast is split to its own Fastify service, the MCP server gains an HTTP transport (`StreamableHTTPServerTransport`) mounted at `/mcp`. This enables remote agents and multi-tenant scenarios. The tool surface is identical — only the transport changes.

```
POST /mcp  →  StreamableHTTPServerTransport  →  same castMcpServer instance
```

HTTP transport adds: auth middleware (bearer token or API key), rate limiting, CORS for browser-based agent UIs. Not needed for stdio — deferred to post-split.

#### Scope model (Phase 2)

When HTTP transport is active, tool access is controlled by OAuth scopes. The MCP server registers only the tools the authenticated client is authorized to use (scope-gated registration).

| Scope | Tools |
| --- | --- |
| `cast:read` | `list_brands`, `get_brand_profile`, `detect_assets`, `preview_prompt`, `check_compliance`, `get_manifest`, `get_creative`, `search_creatives`, `get_fatigue_report` |
| `cast:generate` | `generate_campaign`, `upload_asset` |
| `cast:approve` | `approve_creative` |
| `cast:import` | `import_performance` |

The server exposes `scopes_supported` in its OAuth Protected Resource metadata at `/.well-known/oauth-protected-resource/mcp`:

```json
{
  "resource": "https://cast-api.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["cast:read", "cast:generate", "cast:approve", "cast:import"]
}
```

Requests with valid tokens but insufficient scopes receive `403` with `WWW-Authenticate: Bearer error="insufficient_scope"`. Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer realm="Cast"`. This follows the OAuth Protected Resource pattern from the MCP auth specification.

---

## Progress streaming — not polling

`generate_campaign` does not return synchronously or require polling a run ID. The existing NDJSON pipeline event stream maps 1:1 to MCP progress notifications. No new event system is needed.

When an agent calls `generate_campaign` with a `progressToken`:

```
Agent sends:  { method: "tools/call", params: { name: "generate_campaign", meta: { progressToken: "abc" }, ... }}

Cast emits:   { method: "notifications/progress", params: { progressToken: "abc", progress: 0.08,  total: 1, message: "resolving assets — brisa-citrus" }}
              { method: "notifications/progress", params: { progressToken: "abc", progress: 0.33,  total: 1, message: "genai — generating brisa-berry via dall-e-3" }}
              { method: "notifications/progress", params: { progressToken: "abc", progress: 0.67,  total: 1, message: "compliance — brisa-citrus · us-en · 1x1 → OK" }}
              { method: "notifications/progress", params: { progressToken: "abc", progress: 1.0,   total: 1, message: "complete — 12 creatives, $0.48 actual" }}

Cast returns: { content: [{ type: "text", text: "<manifest JSON>" }] }
```

The `PipelineEvent` types (`step`, `asset_resolved`, `creative_ready`, `compliance_result`, `error`, `complete`) map directly to progress notification `message` strings. Progress fraction is `completedCreatives / requestedCreatives`. Agents that don't pass a `progressToken` receive the manifest on completion only — no progress notifications, same final result.

---

## The 9 core MCP tools

This section describes the **proposed MCP tool surface** — the target interface for `lib/cast/server/mcp.ts` once implemented (see [backend-evolution-plan.md](backend-evolution-plan.md) Slice 14). The first 9 tools map to pipeline logic that already exists or is being built in Slices 1–8. Tools 10–13 are added when Qdrant is in place (Slices 11–13).

Tool annotations control how agents use each tool:
- `readOnlyHint: true` — safe to call speculatively, no state changes
- `destructiveHint: true` — modifies or deletes data, agent should confirm before calling
- No annotation — creates new data, idempotent or reversible

### Tool return pattern — outputSchema + dual returns

Every Cast MCP tool defines an `outputSchema` (Zod) alongside its `inputSchema`. This enables agents that support structured output to receive typed JSON responses rather than parsing text.

Each tool handler returns **both** `structuredContent` and `content`:

```typescript
return {
  structuredContent: { brands },                                        // typed JSON — agent parses this
  content: [{ type: "text", text: JSON.stringify(brands, null, 2) }]   // text fallback — LLM reads this
}
```

- `structuredContent` — validated against `outputSchema`. Agent frameworks that support structured tool output receive typed data. This is what programmatic consumers use.
- `content` — text array. LLMs and older MCP clients that don't support structured output fall back to this. Always a JSON-serialized version of `structuredContent`.

The `// Output` blocks below show the `structuredContent` shape. The `content` text fallback is always `JSON.stringify(structuredContent, null, 2)` — not documented per-tool to avoid repetition.

---

### 1. `list_brands`

Lists all available brand slugs. Safe to call on every session start to populate agent context.

```typescript
// Annotations
readOnlyHint: true

// Input
{}  // no parameters

// Output
{
  brands: Array<{ slug: string, displayName: string }>
  // e.g. [{ slug: "brisa", displayName: "Brisa" }, { slug: "volt", displayName: "Volt" }]
}
```

**When an agent calls this:** Agent discovery — "what brands can I generate for?" Called once at session start. Result cached in agent context for the session.

---

### 2. `get_brand_profile`

Returns the full brand profile: colors, voice, banned-words union, logo variants, prompt fragments. Read-only.

```typescript
// Annotations
readOnlyHint: true

// Input
{ slug: string }

// Output
{
  slug: string
  displayName: string
  colors: { primary: string, accent: string, background?: string, text?: string }
  voice: { tone: string, do: string[], dont: string[], promptFragments: string[] }
  bannedWords: string[]    // union: lib defaults + brand file
  logos: {
    default: string
    variants: Array<{ id: string, displayName: string, theme?: "light" | "dark" }>
  }
}
```

**When an agent calls this:** Before constructing a brief, the agent loads the brand profile to validate product names, pick a logo variant, and understand voice constraints. Also used to pre-screen audience text against `bannedWords` before calling `generate_campaign`.

---

### 3. `detect_assets`

Checks which product slugs have existing input assets available (local or Azure). Tells the agent whether GenAI generation will be needed.

```typescript
// Annotations
readOnlyHint: true

// Input
{ slugs: string[] }  // product slugs derived from brief.products

// Output
{
  assets: Array<{
    slug: string
    foundFile: string | null   // filename if found, null if will need GenAI
  }>
}
```

**When an agent calls this:** Before `generate_campaign`, to set expectations. An agent building a cost estimate needs to know which products will consume GenAI API credits (`foundFile === null`).

---

### 4. `preview_prompt`

Returns the assembled GenAI prompt for a given product/brand/market/ratio combination without making an API call. Pure, deterministic, no side effects.

```typescript
// Annotations
readOnlyHint: true

// Input
{
  brand: string
  product: { name: string, sku: string, promptOverrides?: object }
  market: string
  ratio: "1x1" | "9x16" | "16x9"
  personaId?: string   // if set, injects persona.promptFragment
}

// Output
{ prompt: string }  // the exact string that would be sent to dall-e-3 / gpt-image-1
```

**When an agent calls this:** Prompt review before committing to a generation run. An agent or human can validate that the prompt captures the right brand voice and audience before spending GenAI credits.

---

### 5. `check_compliance`

Runs compliance checks against a brief's messages without generating any creatives. Catches banned-words violations pre-flight.

```typescript
// Annotations
readOnlyHint: true

// Input
{
  brand: string
  messages: Record<string, string>  // locale → copy, e.g. { en: "...", es: "..." }
}

// Output
{
  passed: boolean
  violations: Array<{
    locale: string
    term: string
    source: "lib-default" | "brand-specific"
  }>
}
```

**When an agent calls this:** Before `generate_campaign`, to avoid wasting a full pipeline run on a brief with banned words. The agent pre-screens the brief and either fixes the violation or escalates to a human.

---

### 6. `upload_asset`

Uploads a product photo to the input storage layer (local or Azure cast-inputs). Equivalent to the S1 drop zone.

```typescript
// Annotations
// (no readOnly — creates data)

// Input
{
  productSlug: string    // must match SLUG_RE
  imageBase64: string    // base64-encoded PNG/JPEG/WEBP
  mimeType: "image/png" | "image/jpeg" | "image/webp"
}

// Output
{
  ok: true
  savedAs: string   // e.g. "brisa-citrus.png"
  size: number      // bytes
}
```

**When an agent calls this:** When an agent has access to product photography (e.g. from a DAM system) and needs to upload it before triggering generation. The agent uploads, calls `detect_assets` to confirm, then calls `generate_campaign`.

---

### 7. `generate_campaign`

Triggers a full generation run from a brief. The primary action tool. Emits MCP progress notifications during the run when `meta.progressToken` is provided.

```typescript
// Annotations
// (no readOnly — creates output files, costs money)

// Input
{
  brief: Brief   // validated against briefSchema (same Zod schema as the UI)
  // includes: campaign, brand, products[], markets[], audience/personaId?,
  //           message{}, ratios[], logoVariant?
}

// Output
{
  manifest: Manifest
  // {
  //   campaign, brand, outputDir,
  //   counts: { requested, succeeded, failed, generated, reused, flagged },
  //   costs: { estimated, actual, currency, model },
  //   creatives: Creative[],
  //   errors: PipelineError[]
  // }
}
```

**Progress notifications:** emitted per creative as `notifications/progress` messages when `meta.progressToken` is set. Progress fraction = `completedCreatives / counts.requested`. See [Progress streaming](#progress-streaming--not-polling) above.

**When an agent calls this:** The core loop. Agent constructs a brief (using `list_brands`, `get_brand_profile`, `detect_assets`, `check_compliance` as prep steps), then triggers generation. Results arrive with compliance badges and cost actuals. Agent routes to approval queue.

**Content type:** The manifest is returned as an embedded resource in `content[]`, linking it to its canonical resource URI:

```typescript
content: [{
  type: "resource",
  resource: {
    uri: `cast://campaigns/${brief.campaign}/manifest`,
    mimeType: "application/json",
    text: JSON.stringify(manifest, null, 2)
  }
}]
```

This tells the agent "this is a resource with a URI" — enabling it to reference the manifest by URI in subsequent calls.

---

### 8. `get_manifest`

Returns the manifest from a completed run without re-running the pipeline. Useful for agents that need to inspect a past run.

```typescript
// Annotations
readOnlyHint: true

// Input
{ campaign: string }

// Output
{ manifest: Manifest | null }  // null if campaign not found
```

**When an agent calls this:** After a run completes, an agent that lost its in-memory result (e.g. long-running session) can retrieve the manifest without triggering a new run. Also useful for scheduled agents that inspect overnight runs in the morning.

**Content type:** Returns a `resource_link` pointing to `cast://campaigns/{campaign}/manifest` — a lightweight pointer the agent can lazily fetch rather than embedding the full manifest in the tool result:

```typescript
content: [{
  type: "resource_link",
  uri: `cast://campaigns/${campaign}/manifest`,
  name: campaign,
  mimeType: "application/json"
}]
```

---

### 9. `get_creative`

Returns metadata and a direct URL for a single creative by coordinates.

```typescript
// Annotations
readOnlyHint: true

// Input
{
  campaign: string
  market: string
  product: string
  ratio: "1x1" | "9x16" | "16x9"
}

// Output
{
  creative: Creative | null
  // { path, source, badge, status, personaId?, estimatedCost, performanceScore?, fatigueScore? }
  imageUrl: string | null   // served via GET /api/outputs/[...path]
}
```

**When an agent calls this:** Single-creative retrieval. An agent routing specific creatives to a distribution system (e.g. "send the 16:9 US English Brisa Citrus creative to Salesforce") uses `get_creative` to get the exact URL without parsing the full manifest.

**Content type:** Returns a `resource_link` to the creative's output image, letting the agent decide whether to fetch the full binary:

```typescript
content: [{
  type: "resource_link",
  uri: imageUrl,
  name: `${product}-${market}-${ratio}`,
  mimeType: "image/png"
}]
```

---

## 4 post-Qdrant MCP tools

These tools require Qdrant to be running (`isQdrantEnabled() === true`). They are added after Slices 5 and 11–13 are in place. The tools gracefully return `{ error: "Qdrant not configured" }` when unavailable — they don't crash the server.

---

### 10. `search_creatives`

Semantic search over the Qdrant `cast-creatives` collection.

```typescript
// Annotations
readOnlyHint: true

// Input
{
  query: string              // "Japan summer energy drink high contrast"
  filters?: {
    brand?: string
    market?: string
    product?: string
    status?: "approved" | "rejected" | "pending"
    minPerformanceScore?: number
  }
  topK?: number              // default 5
}

// Output
{
  results: Array<{
    creative: Creative
    score: number            // cosine similarity 0–1
    performanceScore?: number
    fatigueScore?: number
  }>
}
```

---

### 11. `approve_creative`

Sets approval status on a creative. Patches the Qdrant `cast-creatives` payload.

```typescript
// Annotations
destructiveHint: true   // modifies persistent state

// Input
{
  creativeId: string    // deterministic hash of campaign/market/product/ratio
  status: "approved" | "rejected"
  reason?: string       // required when status === "rejected"
}

// Output
{ ok: true }
```

**Design note:** Cast does not enforce who approves. An agent may approve. A human may approve. `rejectionReason` is the feedback channel — it exists whether the approver is human or automated. When an agent rejects, it populates `reason` with a machine-readable explanation that Maya can act on. `destructiveHint: true` signals to the agent that it should confirm with the user before bulk-approving.

---

### 12. `get_fatigue_report`

Returns fatigued creatives with refresh recommendations.

```typescript
// Annotations
readOnlyHint: true

// Input
{
  brand: string
  market: string
  threshold?: number   // default: CAST_FATIGUE_THRESHOLD env (45)
}

// Output
{
  fatigued: Array<{
    creative: Creative
    fatigueScore: number
    daysSinceGeneration: number
    impressions: number
    recommendedSeeds: Creative[]
  }>
  summary: { total: number, fatigued: number, healthy: number }
}
```

---

### 13. `import_performance`

Imports ad platform performance data and patches Qdrant payloads. Recomputes fatigue scores post-import.

```typescript
// Annotations
// (no readOnly — modifies Qdrant payloads)

// Input
{
  campaign: string
  brand: string
  creatives: Array<{
    product: string
    market: string
    ratio: "1x1" | "9x16" | "16x9"
    impressions: number
    clicks: number
    ctr: number
    conversions?: number
    spend?: number
    dateRange: { from: string, to: string }
  }>
}

// Output
{
  patched: number
  skipped: number
  fatigueUpdated: number
}
```

---

## MCP Resources

Resources are read-only data sources the agent can subscribe to — distinct from tools (which take action). Cast exposes three resources:

### `cast://brands`

Lists all available brands. Static — changes only when a new brand directory is added.

```
URI: cast://brands
MIME: application/json
Content: [{ slug, displayName }, ...]
```

### `cast://brands/{slug}`

Full brand profile for a specific brand. Uses ResourceTemplate with `slug` parameter.

```
URI template: cast://brands/{slug}
MIME: application/json
Content: BrandProfile (same shape as get_brand_profile output)
```

### `cast://campaigns/{campaign}/manifest`

The manifest for a completed campaign run. Agents subscribe to this to be notified when a run completes.

```
URI template: cast://campaigns/{campaign}/manifest
MIME: application/json
Content: Manifest | null
```

Resources let agents load Cast data into their context without calling a tool. An agent setting up a session should prefer `cast://brands` over calling `list_brands` — same data, better semantics for context loading.

### Autocomplete — `completable()` and `complete` callbacks

The MCP server declares `completions: {}` in its capabilities, enabling argument autocomplete for agents.

**On ResourceTemplates:** `cast://brands/{slug}` includes a `complete` callback that returns matching brand slugs:

```typescript
new ResourceTemplate("cast://brands/{slug}", {
  list: async () => ({
    resources: brands.map(b => ({
      name: b.displayName,
      uri: `cast://brands/${b.slug}`,
      mimeType: "application/json",
    })),
  }),
  complete: {
    slug: async (value) => {
      const brands = await listBrandSlugs()
      return brands.map(b => b.slug).filter(s => s.includes(value))
    },
  },
})
```

**On tool inputSchemas (planned):** When the MCP server is implemented, the `brand` and `campaign` fields on tools like `get_brand_profile`, `generate_campaign`, and `get_manifest` will use `completable()` to provide autocomplete. Illustrative example using `@modelcontextprotocol/sdk`:

```typescript
import { completable } from "@modelcontextprotocol/sdk/server/completable.js"

inputSchema: {
  brand: completable(
    z.string().describe("Brand slug"),
    async (value) => {
      const brands = await listBrandSlugs()
      return brands.map(b => b.slug).filter(s => s.includes(value))
    },
  ),
}
```

This gives agents interactive autocomplete when constructing tool calls — typing `"bri"` resolves to `"brisa"`.

---

## The performance flywheel

The 13 tools compose into a self-improving loop:

```
1. list_brands + get_brand_profile
        → agent loads brand context
        ↓
2. check_compliance({ brand, messages })
        → pre-screens brief copy before spending API credits
        ↓
3. generate_campaign({ brief }) + progress notifications
        → pipeline runs, manifest returned
        ↓
4. creatives published to ad platforms (out-of-Cast step)
        ↓
5. import_performance({ campaign, creatives: [ctr, impressions, ...] })
        → patches performanceScore on Qdrant cast-creatives
        → aggregates to cast-personas performanceScore
        → recomputes fatigueScore
        ↓
6. search_creatives({ query, filters: { minPerformanceScore: 0.7 } })
        → top-performing creatives returned as seeds
        ↓
7. generate_campaign({ brief: { ...same, seeds: topCreatives } })
        → next run starts from what worked
        ↓
8. get_fatigue_report({ brand, market })
        → flags stale creatives before ROAS tanks
        → seeds for refresh run recommended
        ↓ loop continues
```

Without closing this loop, every generation run starts from zero. With it, the system learns which personas convert, which visual styles perform, and which creatives are aging out — automatically, without a human pulling reports.

---

## Human-in-the-loop checkpoints

Cast does not attempt to fully automate approval. The agent handles volume; the human handles judgment.

| Decision | Who decides | Why |
| --- | --- | --- |
| Generate a campaign | Agent or Human | Low risk — pipeline has compliance checks |
| Approve a compliant, high-performance creative | Agent (if configured) | High confidence — passes compliance + performance threshold |
| Approve a WARN-badge creative | Human | Compliance flag requires judgment |
| Reject with a reason | Agent or Human | Reason must be actionable for Maya |
| Import performance data | Agent (automated) | No judgment required |
| Trigger fatigue refresh | Agent (scheduled) | Threshold-based, deterministic |
| Adjust fatigue threshold | Human | Policy decision |
| Onboard a new brand | Human | Requires brand book extraction |
| Onboard a new market | Human | Requires country rules document |

The S3 approval queue is the interface between agent actions and human review. An agent marks everything it can confidently approve; a human opens S3 and sees only the edge cases.

---

## Ad platform provider interface

Target location: `lib/cast/server/integrations/ads-performance.ts` (not yet implemented — see [backend-evolution-plan.md](backend-evolution-plan.md) Slice 13). Any ad platform will be plugged in by implementing this interface.

```typescript
export interface AdsPerformanceProvider {
  fetchTopCreatives(brand: string, market: string, days: number): Promise<CreativePerformance[]>
  fetchFatigueSignals(brand: string, market: string): Promise<FatigueSignal[]>
}

// ManualImportProvider — planned first implementation
// Will read from POST /api/performance payloads; no external API required
export class ManualImportProvider implements AdsPerformanceProvider { ... }

// MetaAdsProvider — interface stubbed, implementation TODO
// Requires: META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
// Endpoint: GET /{ad_account_id}/insights
// Fields: impressions, clicks, ctr, conversions, spend, date_preset
// See: https://developers.facebook.com/docs/marketing-api/insights
export class MetaAdsProvider implements AdsPerformanceProvider {
  async fetchTopCreatives(brand, market, days) {
    throw new Error("MetaAdsProvider: not yet implemented — use ManualImportProvider")
  }
  async fetchFatigueSignals(brand, market) {
    throw new Error("MetaAdsProvider: not yet implemented")
  }
}

// GoogleAdsProvider, TikTokAdsProvider — same pattern
// getAdsProvider() factory selects via CAST_ADS_PROVIDER env var
```

---

## The Fastify split

When the monorepo needs to become two services, the split is mechanical:

| What | Where it goes | Effort |
| --- | --- | --- |
| `lib/cast/server/*` | Fastify service repo | Move files, add Fastify route wrappers |
| `lib/cast/schemas.ts` | Shared npm package or copied | Zod schemas shared between repos |
| `lib/cast/events.ts` | Shared npm package or copied | NDJSON event types |
| `app/api/*` | Deleted from Next.js | Routes now live in Fastify |
| `app/page.tsx` fetch calls | Repointed to `NEXT_PUBLIC_API_URL` | One env var change |
| MCP stdio transport | Stays in same Fastify repo | `npx tsx lib/cast/server/mcp.ts` unchanged |
| MCP HTTP transport | Added to Fastify repo | `/mcp` endpoint + `StreamableHTTPServerTransport` |

The existing `lib/cast/` modules are the foundation for the future Fastify service contract. Once extracted to `lib/cast/server/`, the split is mechanical — not an architectural decision. The architecture is proven in the monorepo first.

---

## Connecting to existing marketing stacks

| System | Integration point | How |
| --- | --- | --- |
| Salesforce Marketing Cloud | Fastify API | SFMC Journey Builder webhook → `POST /api/generate` |
| Klaviyo | Fastify API | Flow action → `POST /api/generate` |
| customer.io | Fastify API | Campaign trigger → `POST /api/generate` |
| Meta Ads Manager | `MetaAdsProvider` | `import_performance` pulls from Graph API |
| Google Ads | `GoogleAdsProvider` (stub) | Same provider pattern |
| Slack | Notification webhook | Agent posts approval queue summary to channel |
| Claude Desktop / Code | MCP stdio | `mcp.json` config — zero infrastructure |
| Any LLM agent framework | MCP stdio or HTTP | `castMcpTools` via `@modelcontextprotocol/sdk` |

A $250K/year Salesforce contract doesn't get replaced — Cast plugs into it as a creative generation service via the Fastify API. The team keeps their existing approval and distribution workflow.

---

## Environment variables

### Implemented today

```bash
# GenAI
OPENAI_API_KEY=
```

### Planned (added as features are built)

```bash
# Storage (Slice 9)
CAST_STORAGE=local                        # or "azure"
AZURE_STORAGE_CONNECTION_STRING=

# Vector DB — Slices 11-12 (degrades gracefully when absent)
QDRANT_URL=
QDRANT_API_KEY=

# Ads provider (Slice 13)
CAST_ADS_PROVIDER=manual                  # or "meta" when MetaAdsProvider is wired
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# Fatigue (Slice 12)
CAST_FATIGUE_THRESHOLD=45

# GenAI mode (Slice 6)
CAST_GENAI_MODE=default                   # or "cheap"

# API split (when Fastify repo exists)
NEXT_PUBLIC_API_URL=http://localhost:4000
```

All integration features degrade gracefully when their env vars are absent. Missing `QDRANT_URL` → logs warning, skips vector operations, pipeline completes. Missing `META_ACCESS_TOKEN` → falls back to `ManualImportProvider`. The floor is always a working local generation pipeline.
