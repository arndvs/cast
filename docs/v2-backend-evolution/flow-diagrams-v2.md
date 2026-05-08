# Flow Diagrams — Cast v2 Extension

> This document adds sections §9–§11 to [flow-diagrams.md](../flow-diagrams.md). That file covers §1–§8 (screens S1–S5, API contract, brief schema, brand profile schema, future scope). This file picks up where it leaves off and covers the three new data flows introduced in v2: performance feedback, ad fatigue, and agent/MCP caller. Read flow-diagrams.md first.

---

## §9 — Performance Feedback Flow

### 9.1 What it is

Performance feedback is the mechanism by which ad platform data (CTR, conversions, spend) flows back into Cast and modifies future generation behavior. Without it, every campaign starts from zero. With it, the system learns which creatives performed, which personas converted, and which assets are aging out.

The flow has two input paths (manual CSV/JSON import today, Meta Ads API in future) and three output effects (performanceScore on creatives, performanceScore on personas, fatigueScore recomputed).

### 9.2 Performance import flow — end to end

```mermaid
flowchart TB
    subgraph Input["Input paths"]
        Manual["Manual import<br/>POST /api/performance<br/>CSV or JSON upload<br/>from Meta Ads Manager export"]
        MetaAPI["Meta Ads API ★future<br/>MetaAdsProvider<br/>Graph API v21+<br/>/{ad_account_id}/insights"]
    end

    subgraph Validation["Validation"]
        ParseSchema["parse creativePerformanceSchema[]<br/>campaign · brand · product · market · ratio<br/>impressions · clicks · ctr<br/>conversions? · spend? · dateRange"]
        Lookup["look up each creative in Qdrant<br/>cast-creatives · deterministic ID<br/>hash(campaign/market/product/ratio)"]
        NotFound["skipped[]<br/>creative not in Qdrant<br/>(not yet generated or wrong coords)"]
    end

    subgraph Scoring["Score computation"]
        PerfScore["performanceScore<br/>= normalize(ctr × 0.6 + conversionRate × 0.4)<br/>range: 0.0 – 1.0"]
        FatigueScore["fatigueScore<br/>= daysRunning + (impressions / 1000) − (ctr × 100)<br/>threshold: CAST_FATIGUE_THRESHOLD (default 45)"]
        FatigueFlag["fatigueRisk<br/>= fatigueScore > threshold"]
    end

    subgraph PatchQdrant["Patch Qdrant"]
        PatchCreative["patch cast-creatives payload<br/>performanceScore · fatigueScore · fatigueRisk<br/>lastPerformanceImport: ISO timestamp"]
        PatchPersona["aggregate to cast-personas<br/>for each personaId linked to patched creatives:<br/>persona.performanceScore =<br/>avg(linked creative performanceScores)"]
    end

    subgraph Output["API response"]
        Result["{ patched: N, skipped: M, fatigueUpdated: K }"]
    end

    Manual --> ParseSchema
    MetaAPI --> ParseSchema
    ParseSchema --> Lookup
    Lookup -->|found| PerfScore
    Lookup -->|not found| NotFound
    PerfScore --> FatigueScore
    FatigueScore --> FatigueFlag
    PerfScore --> PatchCreative
    FatigueScore --> PatchCreative
    FatigueFlag --> PatchCreative
    PatchCreative --> PatchPersona
    PatchCreative --> Result
    NotFound --> Result
```

### 9.3 Top-creatives retrieval flow

After performance data is imported, agents and humans can retrieve the leaderboard. This drives both the S6 Performance Dashboard and the `search_creatives` MCP tool with `minPerformanceScore` filter.

```mermaid
flowchart LR
    Request["GET /api/top-creatives<br/>?brand=brisa&market=us-en&days=30"]
    QdrantFilter["Qdrant cast-creatives<br/>filter: brand · market<br/>filter: lastPerformanceImport ≥ cutoff<br/>sort: performanceScore DESC<br/>limit: topK (default 10)"]
    Enrich["enrich: resolve image URLs<br/>via StorageAdapter.getPublicUrl()"]
    Response["ScoredCreative[]<br/>{ creative, performanceScore, ctr, conversions, spend }"]

    Request --> QdrantFilter --> Enrich --> Response
```

### 9.4 Persona performance aggregation

```mermaid
flowchart TB
    Import["POST /api/performance<br/>batch of CreativePerformance[]"]
    GroupByPersona["group patched creatives by personaId<br/>(some creatives have no personaId → skip)"]
    AvgScore["for each personaId:<br/>persona.performanceScore =<br/>mean(patched creatives' performanceScore)"]
    PatchPersonaQdrant["PATCH cast-personas payload<br/>performanceScore · lastUpdated"]
    TypeaheadImpact["S1 persona typeahead<br/>now shows performanceScore indicator<br/>alongside persona displayName"]

    Import --> GroupByPersona --> AvgScore --> PatchPersonaQdrant --> TypeaheadImpact
```

### 9.5 Error semantics

- Creative not in Qdrant → `skipped++`, no error thrown, run continues
- Malformed `CreativePerformance` entry → Zod validation failure → `400` before any Qdrant writes
- Qdrant unreachable → `503` with `{ error: "Qdrant unavailable" }`, no partial writes
- Partial batch: all-or-nothing per creative — a single creative's score update either fully commits or is skipped. No half-patched payloads.

---

## §10 — Ad Fatigue Flow

### 10.1 What it is

Ad fatigue occurs when a creative's audience has been overexposed — CTR declines despite continued spend. Cast detects fatigue by computing a score that combines creative age, impression volume, and CTR. Fatigued creatives are surfaced in the S7 Fatigue Report with top-performing creatives from the same brand/market recommended as generation seeds.

**Formula (canonical — single source of truth):**

```
fatigueScore = daysSinceGeneration + (impressions / 1000) − (ctr × 100)
```

- `daysSinceGeneration` — integer days since the creative's `generatedAt` timestamp
- `impressions / 1000` — normalized impression volume (1M impressions → +1000 to score)
- `ctr × 100` — performance offset (3% CTR → −3 from score)
- Higher score = more fatigued

**Threshold:** `CAST_FATIGUE_THRESHOLD` env var, default `45`. Creatives above threshold get `fatigueRisk: true` on their Qdrant payload.

All three — `cast-data-v2.jsx::computeFatigueScore()`, `lib/cast/server/fatigue.ts::computeFatigueScore()`, and this formula — must stay in sync. The TypeScript implementation is the source; the JSX fixture and this doc reference it.

### 10.2 Fatigue score computation flow

```mermaid
flowchart TB
    Trigger["trigger: POST /api/fatigue/refresh<br/>body: { brand, market }<br/>OR: auto-triggered after POST /api/performance"]

    subgraph Fetch["Fetch creatives from Qdrant"]
        ListCreatives["query cast-creatives<br/>filter: brand · market<br/>no score filter — compute for all"]
    end

    subgraph Compute["Compute per creative"]
        Age["daysSinceGeneration<br/>= floor((now − creative.generatedAt) / 86400000)"]
        Impressions["impressions<br/>from creative.performanceData.impressions<br/>OR 0 if no performance data imported yet"]
        CTR["ctr<br/>from creative.performanceData.ctr<br/>OR 0 if no performance data"]
        Formula["fatigueScore<br/>= age + (impressions / 1000) − (ctr × 100)"]
        Flag["fatigueRisk = fatigueScore > CAST_FATIGUE_THRESHOLD"]
    end

    subgraph PatchBatch["Batch-patch Qdrant"]
        Upsert["upsert cast-creatives payloads<br/>fatigueScore · fatigueRisk · fatigueComputedAt"]
    end

    Result["{ updated: N }"]

    Trigger --> ListCreatives --> Age & Impressions & CTR --> Formula --> Flag --> Upsert --> Result
```

**Note on creatives with no performance data:** `fatigueScore = daysSinceGeneration + 0 − 0 = daysSinceGeneration`. A creative with no performance data that is 50 days old will score 50 — above the default threshold. This is intentional: stale untracked creatives should be flagged for review.

### 10.3 Fatigue report and refresh recommendation flow

```mermaid
flowchart TB
    Request["GET /api/fatigue-report<br/>?brand=brisa&market=us-en&threshold=45"]

    subgraph QueryFatigued["Query fatigued creatives"]
        FilterFatigued["Qdrant cast-creatives<br/>filter: brand · market · fatigueRisk: true<br/>sort: fatigueScore DESC"]
    end

    subgraph Seeds["Refresh seed selection (per fatigued creative)"]
        QuerySeeds["Qdrant cast-creatives<br/>filter: brand · same market<br/>filter: fatigueRisk: false OR null<br/>sort: performanceScore DESC<br/>limit: 3<br/>→ recommendedSeeds[]"]
    end

    subgraph Response["API response"]
        FatigueReport["FatigueReport {<br/>  fatigued: [{<br/>    creative, fatigueScore,<br/>    daysSinceGeneration, impressions,<br/>    recommendedSeeds: Creative[1-3]<br/>  }],<br/>  summary: { total, fatigued, healthy }<br/>}"]
    end

    Request --> FilterFatigued --> QuerySeeds --> FatigueReport
```

### 10.4 Seeded refresh run flow

When Jordan or an agent triggers a refresh from the Fatigue Report (S7), the next generation run uses top-performing creatives as style references in the prompt builder.

```mermaid
flowchart LR
    S7["S7 · Fatigue Report<br/>Jordan clicks 'Regenerate with variation'<br/>for a fatigued creative"]
    PrePopulate["Pre-populate S1 Brief Editor:<br/>same brand · same market<br/>same product · same ratios<br/>seeds[] = recommendedSeeds from fatigue report"]
    PromptBuilder["Prompt Builder<br/>receives seeds[] as context<br/>describes top-performing style:<br/>'in the visual style of [seed description]...<br/>maintain [brand voice]...'"]
    GenAI["GenAI API<br/>dall-e-3 / gpt-image-1<br/>seeded prompt → new hero image"]
    PipelineContinues["pipeline continues normally<br/>resize · composite · compliance · metadata · vectorize"]

    S7 --> PrePopulate --> PromptBuilder --> GenAI --> PipelineContinues
```

### 10.5 Fatigue detection — edge cases

| Scenario | Behavior |
| --- | --- |
| No performance data imported yet | `fatigueScore = daysSinceGeneration`, `impressions = 0`, `ctr = 0`. Score is age-only. Old untracked creatives still get flagged. |
| Creative younger than threshold | `fatigueScore < 45` → `fatigueRisk: false`. Not included in report. |
| Qdrant unavailable | `GET /api/fatigue-report` returns `503`. `POST /api/fatigue/refresh` returns `503`. Neither crashes the generation pipeline. |
| No creatives for brand/market | Returns `{ fatigued: [], summary: { total: 0, fatigued: 0, healthy: 0 } }`. |
| No healthy seeds for a fatigued creative | `recommendedSeeds: []`. Agent/human must construct seeds manually. |

---

## §11 — Agent / MCP Caller Flow

### 11.1 Transport selection

```mermaid
flowchart TB
    subgraph Phase1["Phase 1: stdio (POC + interview demo)"]
        Agent1["Claude Desktop · Claude Code<br/>VS Code MCP extension<br/>Any stdio-capable LLM agent"]
        MCPConfig["mcp.json config:<br/>{ command: 'npx', args: ['tsx', 'lib/cast/server/mcp.ts'] }"]
        StdioTransport["StdioServerTransport<br/>lib/cast/server/mcp.ts<br/>zero infrastructure — subprocess only"]
        Agent1 --> MCPConfig --> StdioTransport
    end

    subgraph Phase2["Phase 2: HTTP (post-Fastify split)"]
        Agent2["Remote agents<br/>Multi-tenant scenarios<br/>Browser-based agent UIs"]
        HTTPTransport["StreamableHTTPServerTransport<br/>POST /mcp on Fastify service<br/>+ auth middleware + rate limiting"]
        Agent2 --> HTTPTransport
    end

    subgraph Core["lib/cast/server/ — identical for both"]
        CastMCPServer["castMcpServer<br/>McpServer instance<br/>13 tools · 3 resources"]
    end

    StdioTransport --> CastMCPServer
    HTTPTransport --> CastMCPServer
```

### 11.2 Typical agent session — discovery + generation

The agent reads brand context from resources, pre-screens the brief, then generates.

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Agent / Scheduler
    participant MCP as MCP Server (stdio or HTTP)
    participant Lib as lib/cast/server/
    participant Qdrant as Qdrant
    participant Storage as StorageAdapter

    Note over Agent: Session start — discover available brands
    Agent->>MCP: read resource cast://brands
    MCP->>Lib: listBrands()
    Lib-->>MCP: [{ slug, displayName }, ...]
    MCP-->>Agent: brand list

    Agent->>MCP: read resource cast://brands/brisa
    MCP->>Lib: loadBrandProfile("brisa")
    Lib-->>MCP: BrandProfile { colors, voice, bannedWords, logos }
    MCP-->>Agent: brand profile (loaded into agent context)

    Note over Agent: Pre-flight — check assets and compliance
    Agent->>MCP: tool call detect_assets({ slugs: ["brisa-citrus","brisa-berry"] })
    MCP->>Lib: detectAssets(slugs)
    Lib->>Storage: fileExists per slug
    Storage-->>Lib: [{ slug, foundFile }, ...]
    MCP-->>Agent: [{ slug: "brisa-citrus", foundFile: "brisa-citrus.png" }, { slug: "brisa-berry", foundFile: null }]

    Agent->>MCP: tool call check_compliance({ brand: "brisa", messages: { en: "...", es: "..." } })
    MCP->>Lib: checkCompliance(brand, messages)
    Lib-->>MCP: { passed: true, violations: [] }
    MCP-->>Agent: compliance passed

    Note over Agent: Generate — with progress streaming
    Agent->>MCP: tool call generate_campaign({ brief }, meta: { progressToken: "run-1" })
    MCP->>Lib: orchestrator.run(brief)
    loop pipeline events
        Lib-->>MCP: PipelineEvent (step/asset_resolved/creative_ready/compliance_result)
        MCP-->>Agent: notifications/progress { progressToken: "run-1", progress: 0.33, message: "..." }
    end
    Lib-->>MCP: PipelineEvent complete { manifest }
    MCP-->>Agent: tool result { manifest }

    Note over Agent: Route results
    Agent->>MCP: tool call approve_creative({ creativeId, status: "approved" })
    MCP->>Qdrant: patch cast-creatives payload
    Qdrant-->>MCP: ok
    MCP-->>Agent: { ok: true }
```

### 11.3 Scheduled agent session — nightly fatigue check

Sam's automation: runs nightly, imports yesterday's Meta export, flags fatigued creatives, queues refresh runs for morning review.

```mermaid
sequenceDiagram
    autonumber
    actor Scheduler as Cron Scheduler (Sam's setup)
    participant MCP as MCP Server
    participant Lib as lib/cast/server/
    participant Qdrant as Qdrant
    participant Meta as Meta Ads API (future)

    Note over Scheduler: 2 AM — nightly job triggers
    Scheduler->>MCP: tool call import_performance({ campaign, brand, creatives: [...yesterday's data] })
    MCP->>Lib: adsIntegration.importPerformance(data)
    Lib->>Qdrant: patch performanceScore + recompute fatigueScore
    Qdrant-->>Lib: N patched
    Lib-->>MCP: { patched: 18, skipped: 0, fatigueUpdated: 4 }
    MCP-->>Scheduler: import result

    Scheduler->>MCP: tool call get_fatigue_report({ brand: "brisa", market: "us-en" })
    MCP->>Lib: fatigueModule.getRefreshRecommendations()
    Lib->>Qdrant: query fatigued + healthy seed creatives
    Qdrant-->>Lib: { fatigued: [3 creatives], seeds: [...] }
    MCP-->>Scheduler: fatigue report

    alt fatigued creatives found
        Note over Scheduler: Queue refresh runs for morning
        Scheduler->>MCP: tool call generate_campaign({ brief: refreshBrief with seeds })
        MCP->>Lib: orchestrator.run(refreshBrief)
        Lib-->>MCP: manifest { creatives: [...], costs }
        MCP-->>Scheduler: manifest
        Note over Scheduler: Refresh creatives in approval queue — Sam reviews at 9 AM
    else no fatigued creatives
        Note over Scheduler: Log "all healthy" — no action needed
    end
```

### 11.4 Tool annotation reference

| Tool | `readOnlyHint` | `destructiveHint` | Notes |
| --- | --- | --- | --- |
| `list_brands` | ✓ | — | Safe to call speculatively |
| `get_brand_profile` | ✓ | — | Safe to call speculatively |
| `detect_assets` | ✓ | — | Safe to call speculatively |
| `preview_prompt` | ✓ | — | Safe to call speculatively |
| `check_compliance` | ✓ | — | Safe to call speculatively |
| `upload_asset` | — | — | Creates data; idempotent (overwrite) |
| `generate_campaign` | — | — | Creates output files; costs money |
| `get_manifest` | ✓ | — | Safe to call speculatively |
| `get_creative` | ✓ | — | Safe to call speculatively |
| `search_creatives` | ✓ | — | Qdrant-dependent; degrades gracefully |
| `approve_creative` | — | ✓ | Modifies persistent approval state |
| `get_fatigue_report` | ✓ | — | Qdrant-dependent; degrades gracefully |
| `import_performance` | — | — | Modifies Qdrant; idempotent per creative |

`readOnlyHint: true` — agent may call without user confirmation. `destructiveHint: true` — agent should confirm with user before calling, especially in batch operations. Tools with neither annotation create or transform data but are reversible (a re-run overwrites; an import can be re-imported with corrected data).

### 11.5 Graceful degradation when Qdrant is unavailable

The 4 Qdrant-dependent tools (`search_creatives`, `approve_creative`, `get_fatigue_report`, `import_performance`) check `isQdrantEnabled()` on each call:

```
isQdrantEnabled() === false
  → tool returns: { error: "Qdrant not configured — set QDRANT_URL and QDRANT_API_KEY", degraded: true }
  → MCP server does NOT crash
  → tools 1–9 continue to work normally
  → generate_campaign still runs the full pipeline (metadata analysis skipped, no vectorization)
```

An agent receiving `{ degraded: true }` should surface this to the human rather than silently failing. Suggested agent behavior: "Cast is running in degraded mode — semantic search and approval persistence are unavailable. Set QDRANT_URL to enable these features."

### 11.6 State machine — agent session states

```mermaid
stateDiagram-v2
    [*] --> Discovering: session start
    Discovering: list_brands · get_brand_profile · detect_assets
    Discovering --> PreFlight: brands loaded
    PreFlight: check_compliance · preview_prompt · upload_asset?
    PreFlight --> Generating: brief validated
    PreFlight --> Discovering: brand changed
    Generating: generate_campaign (streaming progress)
    Generating --> Routing: manifest received
    Routing: get_creative · approve_creative · search_creatives
    Routing --> Generating: refresh run triggered
    Routing --> Measuring: creatives published (out-of-Cast)
    Measuring: import_performance · get_fatigue_report
    Measuring --> Generating: fatigue threshold crossed — refresh queued
    Measuring --> Routing: performance imported — top creatives available
    Generating --> [*]: session end (no more campaigns)
```
