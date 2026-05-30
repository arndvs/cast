# Agent Integration — Cast

> Cast is built API-first. Every action available in the browser UI is also available as an API call. This document describes how Cast exposes its capabilities to agents, schedulers, and external marketing automation systems — and where humans stay in the loop.

---

## The thesis

Six months ago, opening a SaaS dashboard was the only way to run a campaign. Today, an agent can call an API, get structured results back, and route them to the next system — with a human reviewing only the exceptions.

Cast is designed for exactly this transition. The pipeline lives in `lib/cast/server/`. The UI is one caller. The Fastify API is another. The MCP transport is a third. All three callers hit the same code.

```
Human via UI        →  Next.js  →  lib/cast/server/
Scheduler (cron)    →  Fastify  →  lib/cast/server/
Agent via MCP       →  MCP      →  lib/cast/server/
```

The UI doesn't disappear — it becomes the human-review layer. The agent does the work; the human validates the output, approves what's ready, and flags what needs attention.

---

## Cast MCP tools

Defined in `lib/cast/server/mcp-tools.ts`. These wrap the same server functions exposed by the API routes. An MCP transport layer (Fastify + `@modelcontextprotocol/sdk`) is the only addition needed to make these callable by any MCP-compatible agent.

### Registered (v1) — 6 tools

The following tools are registered in `mcp-tools.ts` today with working handlers:

| Tool | Type | Description |
|------|------|-------------|
| `list_brands` | Read-only | Lists available brand slugs from `inputs/brands/` |
| `get_brand_profile` | Read-only | Returns a brand profile summary (slug, display name, palette hexes, and counts of logos, voice fragments, and banned words) |
| `detect_assets` | Read-only | Detects available assets for a product |
| `preview_prompt` | Read-only | Previews the GenAI prompt for given brief parameters |
| `check_compliance` | Read-only | Runs banned-word and logo compliance checks |
| `get_manifest` | Read-only | Retrieves `report.json` for a completed campaign |

### Roadmap (v2) — 5 tools

These tools are documented below but **not yet registered**. They will be wired when their backing server functions and Qdrant infrastructure are in place.

### `generate_campaign`

Triggers a full generation run from a brief. Equivalent to clicking "Generate" in the UI.

```typescript
// Input
{
  brief: Brief  // validated against briefSchema (same Zod schema as the UI)
}

// Output
{
  manifest: Manifest  // same shape as the complete NDJSON event
  // { campaign, brand, outputDir, counts, creatives[], errors[], costs }
}
```

**When an agent calls this:** The pipeline runs synchronously (or the agent polls for completion via a run ID). The manifest is returned with all creatives, compliance badges, and cost actuals. The agent can then route approved creatives, surface flagged ones for human review, or trigger a fatigue refresh recommendation.

### `search_creatives`

Semantic search over the Qdrant `cast-creatives` collection. Equivalent to `GET /api/search-creatives`.

```typescript
// Input
{
  query: string             // natural language: "Japan summer energy drink high contrast"
  filters?: {
    brand?: string
    market?: string
    product?: string
    status?: "approved" | "rejected" | "pending"
    minPerformanceScore?: number
  }
  topK?: number             // default 5
}

// Output
{
  results: Array<{
    creative: Creative      // metadata + path
    score: number           // cosine similarity
    performanceScore?: number
  }>
}
```

**When an agent calls this:** "Find me the top-performing Brisa creatives from the Japan market that are approved" → agent uses these as seeds for a new generation run or routes them to a distribution system.

### `approve_creative`

Sets approval status on a creative. Equivalent to `PATCH /api/creatives/[id]/status`.

```typescript
// Input
{
  creativeId: string
  status: "approved" | "rejected"
  reason?: string           // required when status === "rejected"
}

// Output
{ ok: true }
```

**When an agent calls this:** This is the human-in-the-loop checkpoint made explicit. An agent can auto-approve creatives that pass all compliance checks and exceed a performance threshold — but should surface rejections and low-confidence cases to a human reviewer. The approval status is written to Qdrant and persists across sessions.

**Design note:** Cast does not enforce who approves. An agent may approve. A human may approve. The `rejectionReason` field is the feedback channel — it exists whether the approver is human or automated. When an agent rejects, it should populate `reason` with a machine-readable explanation that Maya can act on.

### `get_fatigue_report`

Returns fatigued creatives with refresh recommendations. Equivalent to `GET /api/fatigue-report`.

```typescript
// Input
{
  brand: string
  market: string
  threshold?: number        // default: CAST_FATIGUE_THRESHOLD env var (45)
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
}
```

**When an agent calls this:** A scheduled agent checks fatigue weekly. Any creative above the threshold triggers a `generate_campaign` call with the recommended seeds as style references in the prompt. The generated creatives go to the approval queue — human or automated depending on confidence threshold.

### `import_performance`

Imports ad platform performance data and patches Qdrant payloads. Equivalent to `POST /api/performance`.

```typescript
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
  patched: number     // creatives updated
  skipped: number     // not found in Qdrant
  fatigueUpdated: number  // creatives where fatigueScore was recomputed
}
```

**When an agent calls this:** A daily scheduled agent exports the last 24 hours from Meta Ads, calls `import_performance`, then calls `get_fatigue_report` to check if any creatives crossed the fatigue threshold. If yes, it queues a refresh run. The human sees only the refresh candidates in their approval queue the next morning.

---

## The performance flywheel

The five tools compose into a self-improving loop:

```
1. generate_campaign({ brief })
        ↓
2. creatives published to ad platforms (out-of-Cast step)
        ↓
3. import_performance({ campaign, creatives: [ctr, impressions, ...] })
        ↓ patches performanceScore on Qdrant cast-creatives payloads
        ↓ aggregates to cast-personas performanceScore
        ↓ recomputes fatigueScore
        ↓
4. search_creatives({ query, filters: { minPerformanceScore: 0.7 } })
        → returns top-performing creatives as seeds
        ↓
5. generate_campaign({ brief: { ...same, seeds: topCreatives } })
        → next run starts from what worked
        ↓
6. get_fatigue_report({ brand, market })
        → flags stale creatives before ROAS tanks
        → refresh runs triggered automatically
        ↓ loop continues
```

Without closing this loop, every generation run starts from zero. With it, the system learns which personas convert, which visual styles perform, and which creatives are aging out — automatically, without a human pulling reports.

---

## Human-in-the-loop checkpoints

Cast does not attempt to fully automate approval. The agent handles the volume; the human handles judgment.

| Decision | Who decides | Why |
| --- | --- | --- |
| Generate a campaign | Agent or Human | Low risk — the pipeline has compliance checks |
| Approve a compliant, high-performance creative | Agent (if configured) | High confidence — passes compliance + historical performance threshold |
| Approve a WARN-badge creative | Human | Compliance flag requires human judgment |
| Reject with a reason | Agent or Human | Reason must be actionable for Maya |
| Import performance data | Agent (automated) | No judgment required — data import |
| Trigger fatigue refresh | Agent (scheduled) | Threshold-based, deterministic |
| Adjust fatigue threshold | Human | Policy decision |
| Onboard a new brand | Human | Requires brand book extraction |
| Onboard a new market | Human | Requires country rules document |

The approval queue in S3 is the interface between agent actions and human review. An agent marks everything it can confidently approve; a human opens S3 and sees only the edge cases.

---

## Ad platform provider interface

Planned for `lib/cast/server/integrations/ads-performance.ts` once the ad-platform integration slice lands. Any ad platform can be plugged in by implementing this interface.

```typescript
export interface AdsPerformanceProvider {
  // Fetch top-performing creatives from the platform
  fetchTopCreatives(
    brand: string,
    market: string,
    days: number
  ): Promise<CreativePerformance[]>

  // Fetch signals indicating creative fatigue
  fetchFatigueSignals(
    brand: string,
    market: string
  ): Promise<FatigueSignal[]>
}

// ManualImportProvider — works today
// Reads performance data from POST /api/performance payloads
// No external API required — accepts CSV/JSON uploads
export class ManualImportProvider implements AdsPerformanceProvider { ... }

// MetaAdsProvider — interface stubbed, implementation TODO
// Requires: META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
// Endpoint: GET /{ad_account_id}/insights
// Fields: impressions, clicks, ctr, conversions, spend, date_preset
export class MetaAdsProvider implements AdsPerformanceProvider {
  // TODO: wire Meta Marketing API (Graph API v21+)
  // See: https://developers.facebook.com/docs/marketing-api/insights
  async fetchTopCreatives(brand, market, days) {
    throw new Error("MetaAdsProvider: not yet implemented — use ManualImportProvider")
  }
  async fetchFatigueSignals(brand, market) {
    throw new Error("MetaAdsProvider: not yet implemented")
  }
}

// GoogleAdsProvider, TikTokAdsProvider — same pattern
// Each implements AdsPerformanceProvider
// Each is independent — no shared state between providers
```

**Adding a new ad platform:** implement `AdsPerformanceProvider`, add the provider class to `ads-performance.ts`, update `getAdsProvider()` factory to select based on `CAST_ADS_PROVIDER` env var. No other files change.

---

## The Fastify split

When the monorepo needs to become two services (e.g. when multiple UIs or teams need to call Cast independently), the split is mechanical:

| What | Where it goes | Effort |
| --- | --- | --- |
| `lib/cast/server/*` | Fastify service repo | Move files, add Fastify route wrappers around `index.ts` exports |
| `lib/cast/schemas.ts` | Shared npm package or copied | Zod schemas shared between repos |
| `lib/cast/events.ts` | Shared npm package or copied | NDJSON event types |
| `app/api/*` | Deleted from Next.js | Routes now live in Fastify |
| `app/page.tsx` fetch calls | Repointed to `NEXT_PUBLIC_API_URL` | One env var change |
| MCP transport | Added to Fastify repo | `@modelcontextprotocol/sdk` + route wrappers |

The `lib/cast/server/index.ts` barrel export is already the future Fastify service contract. Every function exported there becomes a Fastify route. The split is not an architectural decision — the architecture was proven in the monorepo first.

**Why monorepo first:** Building in the monorepo proves the API boundary before committing to a split. Premature splitting creates two half-broken repos instead of one working one. The interview answer: "I built monorepo-first intentionally so the boundary was clear before splitting."

---

## Connecting to existing marketing stacks

Cast is designed to plug into whatever system the team is already using.

| System | Integration point | How |
| --- | --- | --- |
| Salesforce Marketing Cloud | Fastify API | SFMC Journey Builder webhook → `POST /api/generate` |
| Klaviyo | Fastify API | Flow action → `POST /api/generate` |
| customer.io | Fastify API | Campaign trigger → `POST /api/generate` |
| Meta Ads Manager | `MetaAdsProvider` | `import_performance` pulls directly from Graph API |
| Google Ads | `GoogleAdsProvider` (stub) | Same provider pattern |
| Slack | Notification webhook | Agent posts approval queue summary to Slack channel |
| Any LLM agent framework | MCP transport | `castMcpTools{}` exposed via `@modelcontextprotocol/sdk` |

The Fastify API layer is what makes this possible. A $250K/year Salesforce contract doesn't get replaced — Cast plugs into it as a creative generation service. The team keeps their existing approval and distribution workflow; Cast handles the generation and compliance layer.

---

## Environment variables for agent / integration features

```bash
# Storage
CAST_STORAGE=azure                        # or "local" for dev
AZURE_STORAGE_CONNECTION_STRING=

# Vector DB
QDRANT_URL=
QDRANT_API_KEY=

# Ads provider
CAST_ADS_PROVIDER=manual                  # or "meta" when MetaAdsProvider is implemented
META_APP_ID=                              # MetaAdsProvider (future)
META_APP_SECRET=                          # MetaAdsProvider (future)
META_ACCESS_TOKEN=                        # MetaAdsProvider (future)
META_AD_ACCOUNT_ID=                       # MetaAdsProvider (future)

# Fatigue
CAST_FATIGUE_THRESHOLD=45                 # creatives scoring above this are flagged

# API split (when Fastify repo exists)
NEXT_PUBLIC_API_URL=http://localhost:4000  # points Next.js fetch calls at Fastify
```

All integration features degrade gracefully when their env vars are absent. A missing `QDRANT_URL` logs a warning and skips vector operations — the generation pipeline still completes. A missing `META_ACCESS_TOKEN` falls back to `ManualImportProvider`. The floor is always a working local generation pipeline.
