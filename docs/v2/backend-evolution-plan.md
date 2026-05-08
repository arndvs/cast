# Cast Backend Evolution Plan

> **Status:** Plan only — no code changes.
> **Date:** 2026-05-07
> **Branch:** `dev`
> **Goal:** Evolve the Cast POC from local-filesystem storage to an agent-ready creative infrastructure layer with Azure Blob Storage, image metadata pipeline, Qdrant vector database, and MCP server — all within the monorepo before splitting.

---

## 1. Context

Cast is a POC for Adobe FDE that generates localized social ad creatives from a campaign brief. The current architecture is a Next.js 16 monorepo where **all state is filesystem-based** — brand configs read from `inputs/brands/`, product photos from `inputs/assets/`, and generated outputs written to `outputs/[campaign]/`. There is no database, no cloud storage, and no vector search.

The transcript conversation identified five backend capabilities needed to move from POC to production-worthy:

1. **Azure Blob Storage** — replace all local file I/O
2. **Image Metadata Pipeline** — auto-analyze generated images and persist structured metadata
3. **Qdrant Vector Database** — vectorize metadata for semantic retrieval
4. **Asset Ingestion** — backfill existing historical assets through the same pipeline
5. **Knowledge Base Seeding** — vectorize brand briefs, marketing guidelines, and country rules
6. **Buyer Personas** — structured audience entities replacing free-text input, with performance tracking per persona
7. **Performance Feedback Loop** — import CTR/conversion data back into Qdrant so retrieval is performance-weighted
8. **Ad Fatigue Detection** — heuristic scoring to flag stale creatives and recommend refreshes
9. **MCP Server** — expose every server operation as a named, typed MCP tool so agents can call Cast directly without a UI

The approach: **build everything in the monorepo first**, with a clean `server/` boundary that makes the eventual Fastify split trivial. The same `lib/cast/server/` layer serves three callers: the React UI (via Next.js API routes), scheduled jobs (via future Fastify API), and AI agents (via MCP transport).

---

## 2. Current Architecture (As-Is)

```
┌──────────────────────────────────────────────┐
│                    Next.js 16                 │
│                                              │
│  ┌──────────────┐     ┌───────────────────┐  │
│  │  app/page.tsx │     │   app/api/*       │  │
│  │  (React 19)  │────▶│   (Route Handlers)│  │
│  │  useReducer  │     │                   │  │
│  │  state machine│     │  /generate (POST) │  │
│  └──────────────┘     │  /brands   (GET)  │  │
│                       │  /upload   (POST) │  │
│                       │  /outputs  (GET)  │  │
│                       │  /detected (GET)  │  │
│                       └───────┬───────────┘  │
│                               │              │
│                    ┌──────────▼──────────┐   │
│                    │   lib/cast/server/  │   │
│                    │                     │   │
│                    │  storage.ts ──▶ fs  │   │
│                    │  brand-loader.ts    │   │
│                    │  pipeline/          │   │
│                    │    genai.ts ──▶ OAI │   │
│                    │    compose.ts       │   │
│                    │    compliance.ts    │   │
│                    └────────────────────┘   │
│                               │              │
│              ┌────────────────┼───────────┐  │
│              │    Local Filesystem        │  │
│              │  inputs/brands/  (read)    │  │
│              │  inputs/assets/  (read/w)  │  │
│              │  outputs/        (write)   │  │
│              └───────────────────────────┘  │
└──────────────────────────────────────────────┘
         External: OpenAI API (dall-e-3 / gpt-image-1)
         Optional: Dropbox Saver (client-side only)
```

### Key boundaries already in place

| Boundary | Location | Notes |
|----------|----------|-------|
| All filesystem I/O | `lib/cast/server/storage.ts` | Single module — `findLocalAsset`, `readAsset`, `clearCampaignOutput`, `writeBriefSnapshot`, `writeCreative`, `writeReport` |
| Brand data loading | `lib/cast/server/brand-loader.ts` | Reads JSON + logos from `inputs/brands/`, 90s cache |
| Path safety | `lib/cast/server/safe-join.ts` | All paths validated against `ROOTS.inputs` and `ROOTS.outputs` |
| GenAI calls | `lib/cast/server/pipeline/genai.ts` | OpenAI SDK, retry logic, prompt construction |
| Schema validation | `lib/cast/schemas.ts` | Zod schemas for brief, brand, manifest, events |
| API routes | `app/api/*` | Thin route handlers delegating to `lib/cast/server/` |

**The `storage.ts` module is the primary refactor target.** Every file operation in the entire pipeline flows through it. Replacing its implementation with Azure Blob SDK calls is the cleanest possible swap.

---

## 3. Design Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Where to build | Monorepo first | POC/interview context; split later when boundary is proven |
| 2 | Cloud provider | Azure Blob Storage | Free credits available; job listing mentions Azure/AWS/GCP |
| 3 | Vector database | Qdrant (cloud free tier) | Open source, free cloud hosting, metadata filters, geo-radius queries for country partitioning |
| 4 | Metadata analysis model | Claude Haiku or Sonnet (cheap) | Analyze images once on generation; avoid re-analysis on every retrieval |
| 5 | Storage adapter pattern | Interface behind `storage.ts` | Swap local ↔ Azure without touching pipeline code |
| 6 | Server code boundary | `lib/cast/server/` stays as-is | Already clean; becomes the future Fastify service body |
| 7 | API routes role | Thin pass-throughs only | No business logic in route handlers (already true) |
| 8 | Knowledge base format | Markdown → chunked → vectorized in Qdrant | Separate collection from image metadata |
| 9 | Embedding model | OpenAI `text-embedding-3-small` | Already have API key; 1536-dim vectors; cheap |
| 10 | Backend split timing | After Azure + Qdrant proven in monorepo | Split is just moving `lib/cast/server/` to Fastify + repointing fetch URLs |
| 11 | Buyer personas | Qdrant `cast-personas` collection + typeahead UI | Consistent prompt language; trackable audience entity; free-text fallback preserved |
| 12 | Performance feedback | Manual CSV/JSON import first; provider interface for Meta/Google/TikTok | Closes the learning loop; performance-weighted retrieval enables "generate more like the best" |
| 13 | Ad fatigue detection | Computed heuristic score on creative Qdrant payload | Proactive rotation recommendations; directly addresses ROAS optimization |
| 14 | Approval workflow | `status` field on creative metadata; PATCH endpoint | Pain point #3 from business brief (slow approval cycles); minimal schema addition |
| 15 | Cost tracking | Per-run estimate + actuals on manifest `costs` field | Business goal #4 (optimize ROI); calculable from model + ratio count |
| 16 | Output versioning | `outputs/[campaign]/[run-id]/` path convention | Run history comparison; prevents destructive wipe at scale |
| 17 | MCP tool registry | Named tools wrapping `lib/cast/server/` functions with Zod inputSchemas | Every server operation is agent-callable; tool definitions are the API contract for agent callers |
| 18 | MCP transport | stdio for local dev, StreamableHTTP for remote | stdio works with Claude Desktop / VS Code today; HTTP transport added post-Fastify split |
| 19 | MCP tool annotations | `readOnlyHint`, `destructiveHint` on each tool | Agents know which tools are safe to call without human confirmation |

---

## 4. Target Architecture (To-Be)

```
┌──────────────────────────────────────────────────────────┐
│                       Next.js 16 (Monorepo)              │
│                                                          │
│  ┌──────────────┐         ┌───────────────────────┐     │
│  │  React 19 UI │────────▶│  app/api/* (thin)      │     │
│  │  (unchanged) │         │  delegates to server/  │     │
│  └──────────────┘         └──────────┬────────────┘     │
│                                      │                   │
│                         ┌────────────▼────────────┐     │
│                         │    lib/cast/server/      │     │
│                         │                          │     │
│                         │  storage.ts              │     │
│                         │    ├─ StorageAdapter      │     │
│                         │    ├─ LocalFsAdapter      │     │
│                         │    └─ AzureBlobAdapter    │     │
│                         │                          │     │
│                         │  metadata.ts (NEW)       │     │
│                         │    └─ analyzeImage()     │     │
│                         │                          │     │
│                         │  vector-store.ts (NEW)   │     │
│                         │    └─ QdrantClient       │     │
│                         │                          │     │
│                         │  knowledge-base.ts (NEW) │     │
│                         │    └─ ingest / query     │     │
│                         │                          │     │
│                         │  personas.ts (NEW)       │     │
│                         │    └─ upsert / query     │     │
│                         │                          │     │
│                         │  integrations/ (NEW)     │     │
│                         │    └─ AdsPerformance IF  │     │
│                         │                          │     │
│                         │  mcp-tools.ts (NEW)      │     │
│                         │    └─ CAST_MCP_TOOLS[]   │     │
│                         │                          │     │
│                         │  mcp.ts (NEW, entry)     │     │
│                         │    └─ McpServer + stdio  │     │
│                         │                          │     │
│                         │  pipeline/ (enhanced)    │     │
│                         │    └─ post-gen metadata  │     │
│                         └────────────┬────────────┘     │
│                                      │                   │
└──────────────────────────────────────┼───────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────▼─────┐   ┌───────▼──────┐   ┌──────▼──────┐
              │   Azure    │   │   Qdrant     │   │   OpenAI    │
              │   Blob     │   │   Cloud      │   │   API       │
              │   Storage  │   │   (free)     │   │             │
              │            │   │              │   │  Images +   │
              │  Containers│   │  Collections │   │  Embeddings │
              │  - inputs  │   │  - creatives │   │             │
              │  - outputs │   │  - knowledge │   └─────────────┘
              │  - brands  │   │  - personas  │
              └────────────┘   └──────────────┘

    ┌──────────────────────────────────────────────────────┐
    │                Three Callers, One Server             │
    │                                                      │
    │  Human via UI ──▶ Next.js API routes ──┐             │
    │  Scheduler    ──▶ Fastify API routes ──┼──▶ lib/cast/server/  │
    │  Agent via MCP ──▶ MCP transport ───────┘             │
    └──────────────────────────────────────────────────────┘
```

---

## 5. Vertical Slices

### Slice 1: Storage Adapter Interface

```
☐ Storage Adapter Interface
Type: AFK
Size: M
Blocked by: none
Steps:
  1. Define a StorageAdapter interface in lib/cast/server/storage-adapter.ts:
     - readFile(container, key) → Buffer
     - writeFile(container, key, data, contentType) → void
     - deleteFile(container, key) → void
     - deletePrefix(container, prefix) → void
     - listFiles(container, prefix) → string[]
     - fileExists(container, key) → boolean
     - getPublicUrl(container, key) → string
  2. Extract current storage.ts logic into a LocalFsAdapter class
     implementing the interface (map containers → filesystem roots)
  3. Add a getStorageAdapter() factory that returns LocalFsAdapter
     by default (env-switched later)
  4. Update all storage.ts exports (findLocalAsset, readAsset,
     clearCampaignOutput, writeBriefSnapshot, writeCreative,
     writeReport) to delegate to the adapter
  5. Verify all 102+ tests still pass — zero behavior change
Acceptance criteria:
  - All existing tests pass
  - typecheck passes
  - Storage operations are identical in behavior
  - No pipeline code changes
Feedback loops: pnpm test && pnpm typecheck
```

### Slice 2: Azure Blob Adapter

```
☐ Azure Blob Adapter
Type: HITL (needs Azure account setup + env vars)
Size: L
Blocked by: Slice 1
Steps:
  1. pnpm add @azure/storage-blob
  2. Implement AzureBlobAdapter class:
     - Constructor takes connection string from env
     - Maps logical containers: "inputs" → cast-inputs,
       "outputs" → cast-outputs, "brands" → cast-brands
     - readFile → blobClient.download() → Buffer
     - writeFile → blockBlobClient.upload() with content-type
     - deleteFile → blobClient.delete()
     - deletePrefix → list + batch delete
     - listFiles → containerClient.listBlobsFlat()
     - fileExists → blobClient.exists()
     - getPublicUrl → SAS token URL or public container URL
  3. Update getStorageAdapter() factory:
     - CAST_STORAGE=azure → AzureBlobAdapter
     - CAST_STORAGE=local (default) → LocalFsAdapter
  4. Create 3 Azure Blob containers via Azure Portal or CLI:
     cast-inputs, cast-outputs, cast-brands
  5. Upload existing inputs/brands/ and inputs/assets/ to cast-brands
     and cast-inputs containers
  6. Add AZURE_STORAGE_CONNECTION_STRING to .env.local
  7. Test full pipeline with CAST_STORAGE=azure:
     brand loading, asset detection, generation, output writing
  8. Update /api/outputs proxy to serve from blob URL
     instead of local fs read
Acceptance criteria:
  - Full generation pipeline works with Azure storage
  - Brand loading, logo proxying, asset detection all work
  - Generated PNGs stored in Azure, accessible via proxy URL
  - Local mode still works when CAST_STORAGE=local
Feedback loops: manual E2E test with both CAST_STORAGE values
Env vars: CAST_STORAGE, AZURE_STORAGE_CONNECTION_STRING
```

### Slice 3: Brand Loader Azure Support

```
☐ Brand Loader Azure Support
Type: AFK
Size: M
Blocked by: Slice 2
Steps:
  1. Refactor brand-loader.ts to use StorageAdapter instead of
     direct fs.readFile / fs.readdir calls
  2. Brand JSON files (brand.json, voice.json, banned-words.json)
     read from adapter.readFile("brands", `${slug}/brand.json`)
  3. Logo manifest and logo PNGs read through adapter
  4. Font file existence check through adapter.fileExists()
  5. /api/brands/[slug]/logos/[id] route serves logo via
     adapter.readFile() instead of direct fs read
  6. Keep 90s in-process cache — works same regardless of backend
Acceptance criteria:
  - Brand loading works identically on both storage backends
  - Logo proxy serves PNGs from Azure when configured
  - Cache behavior unchanged
Feedback loops: existing brand-loader tests + manual E2E
```

### Slice 4: Image Metadata Pipeline

```
☐ Image Metadata Pipeline
Type: AFK
Size: L
Blocked by: Slice 2
Steps:
  1. Create lib/cast/server/metadata.ts:
     - analyzeImage(imageBuffer, context) → ImageMetadata
     - context = { campaign, brand, product, market, ratio, source }
  2. Define ImageMetadata schema (Zod):
     {
       campaign: string,
       brand: string,
       product: string,
       market: string,
       ratio: AspectRatio,
       source: "local" | "genai",
       description: string,      // AI-generated 1-2 sentence description
       tags: string[],            // AI-extracted visual tags
       colors: string[],          // dominant colors detected
       mood: string[],            // mood/atmosphere tags
       generatedAt: string,       // ISO timestamp
       promptUsed?: string,       // the GenAI prompt (if source=genai)
       personaId?: string,        // linked buyer persona ID (if selected)
       personaFragment?: string,  // prompt fragment used from persona
       status: "pending" | "approved" | "rejected",  // approval workflow
       rejectionReason?: string,  // feedback for rejected creatives
       estimatedCost: number,     // USD cost of generating this creative
     }
  3. Implement analyzeImage():
     - Call OpenAI chat completions (gpt-4o-mini or similar cheap model)
       with the image as base64 + structured output request
     - Parse response into ImageMetadata
     - Fallback: if analysis fails, return metadata with only
       deterministic fields (campaign, brand, etc.) and empty AI fields
  4. Hook into pipeline/write.ts: after writeCreative() succeeds,
     call analyzeImage() and write metadata JSON alongside the PNG:
     outputs/[campaign]/[market]/[product]/[ratio].metadata.json
  5. Also store metadata via adapter:
     adapter.writeFile("outputs", `${campaign}/${market}/${product}/${ratio}.metadata.json`, ...)
  6. Add metadata to the Manifest creative entries (optional new field)
Acceptance criteria:
  - Every successfully generated creative has a .metadata.json sibling
  - Metadata contains both deterministic and AI-analyzed fields
  - Pipeline doesn't fail if metadata analysis fails (graceful degradation)
  - Metadata stored in same storage backend as images
Feedback loops: pnpm test, manual inspection of metadata JSON
Env vars: none new (reuses OPENAI_API_KEY)
```

### Slice 5: Qdrant Setup + Creative Vectorization

```
☐ Qdrant Setup + Creative Vectorization
Type: HITL (needs Qdrant cloud account)
Size: L
Blocked by: Slice 4
Steps:
  1. pnpm add @qdrant/js-client-rest
  2. Sign up for Qdrant Cloud free tier, create a cluster
  3. Create lib/cast/server/vector-store.ts:
     - getQdrantClient() singleton (connection from env)
     - ensureCollection("cast-creatives", { size: 1536, distance: "Cosine" })
     - upsertCreativeVector(metadata: ImageMetadata) → void:
       a. Generate embedding from metadata.description + metadata.tags
          via OpenAI text-embedding-3-small
       b. Build payload: all metadata fields as filterable payload
          (brand, market, product, campaign, ratio, generatedAt,
           personaId, status)
       c. Add nullable scoring fields to payload:
          performanceScore: null   // patched later by performance import
          fatigueScore: null       // computed from performance + age
       d. Point ID: deterministic hash of campaign/market/product/ratio
       e. Upsert to "cast-creatives" collection
     - searchCreatives(query: string, filters?) → ScoredPoint[]:
       a. Embed query text
       b. Search with optional metadata filters
          (brand, market, product, date range)
       c. Return top-K results with payloads
  4. Hook into metadata pipeline (Slice 4):
     after metadata is generated, call upsertCreativeVector()
  5. Add a new API route: GET /api/search-creatives?q=...&brand=...&market=...
     - Calls searchCreatives() with query + filters
     - Returns scored results with metadata + image URLs
  6. Verify: generate a campaign, then query "Japan energy drink"
     and get relevant results back
Acceptance criteria:
  - Qdrant collection created with correct schema
  - Every generated creative is vectorized after metadata analysis
  - Search endpoint returns semantically relevant results
  - Filters by brand/market/product work correctly
  - Pipeline doesn't fail if Qdrant is unreachable (log warning, continue)
Feedback loops: manual search queries via curl/browser
Env vars: QDRANT_URL, QDRANT_API_KEY
```

### Slice 6: Historical Asset Ingestion

```
☐ Historical Asset Ingestion
Type: HITL (needs existing assets to index)
Size: M
Blocked by: Slice 5
Steps:
  1. Create lib/cast/server/ingest.ts:
     - ingestExistingAssets(brandSlug: string) → IngestReport
     - Scans brand directory for all image files:
       inputs/brands/[slug]/products/*.{png,jpg,webp}
       inputs/brands/[slug]/backgrounds/*.{png,jpg,webp}
       inputs/brands/[slug]/refs/*.{png,jpg,webp}
     - Also scans the flat product-photo directory:
       inputs/assets/*.{png,jpg,webp}
       (Note: actual repo has product photos here, not nested under brands)
     - For each image:
       a. Read as buffer
       b. Call analyzeImage() with context (brand, filename-derived tags)
       c. Write metadata JSON alongside (or in Azure)
       d. Call upsertCreativeVector() to index in Qdrant
     - Return counts: processed, skipped (already indexed), failed
  2. Create a CLI script: scripts/ingest-assets.ts
     - Runs via: npx tsx scripts/ingest-assets.ts --brand brisa
     - Processes all assets for a brand
     - Outputs progress to stdout
  3. Add API route: POST /api/ingest
     - Body: { brand: string }
     - Streams NDJSON progress (reuse ndjson-emit pattern)
     - Protected: only runs in development (NODE_ENV check)
  4. Run against both demo brands (brisa, volt)
     to seed the vector database with historical assets
Acceptance criteria:
  - All brand assets (products, backgrounds, refs) analyzed and indexed
  - Duplicate runs are idempotent (skip already-indexed)
  - CLI script works standalone
  - Qdrant contains vectors for all historical assets
Feedback loops: search queries return historical assets
```

### Slice 7: Knowledge Base — Ingest + Query

```
☐ Knowledge Base — Ingest + Query
Type: HITL (needs knowledge documents)
Size: L
Blocked by: Slice 5
Steps:
  1. Create lib/cast/server/knowledge-base.ts:
     - Separate Qdrant collection: "cast-knowledge"
     - ingestMarkdown(filePath, metadata) → void:
       a. Read markdown file
       b. Chunk into ~500-token segments with overlap
       c. Embed each chunk via text-embedding-3-small
       d. Upsert to "cast-knowledge" with payload:
          { brand, docType, title, chunkIndex, chunkText }
     - queryKnowledge(query, filters?) → KnowledgeResult[]:
       a. Embed query
       b. Search "cast-knowledge" with filters
       c. Return top-K chunks with source metadata
  2. Create inputs/knowledge/ directory structure:
     inputs/knowledge/
       brisa/
         brand-guidelines.md
         country-rules-japan.md
         country-rules-us.md
       volt/
         brand-guidelines.md
  3. Convert existing brand voice JSON + docs/design/ content
     into clean markdown knowledge docs
  4. Create scripts/ingest-knowledge.ts CLI:
     - npx tsx scripts/ingest-knowledge.ts --brand brisa
     - Processes all .md files in inputs/knowledge/[brand]/
  5. Add API route: GET /api/knowledge?q=...&brand=...
     - Returns relevant knowledge chunks for a query
  6. (Future) Wire knowledge retrieval into prompt construction:
     - Before GenAI call, query knowledge base for relevant context
     - Inject top-K chunks into the prompt as brand/market context
     - This replaces hardcoded promptFragments with RAG-driven context
Acceptance criteria:
  - Knowledge docs chunked and vectorized in Qdrant
  - Search returns relevant brand guidelines and country rules
  - Separate collection from creatives (no cross-contamination)
  - CLI script works standalone
Feedback loops: query "Japan marketing rules" → relevant chunks returned
```

### Slice 8: Server Module Boundary Hardening

```
☐ Server Module Boundary Hardening
Type: AFK
Size: S
Blocked by: Slices 1–3
Steps:
  1. Create lib/cast/server/index.ts barrel export:
     - Export all public server functions
     - This is the future Fastify service API surface
  2. Audit all app/api/ routes: verify each is a thin
     pass-through that imports only from lib/cast/server/
  3. Ensure NO business logic in route handlers:
     - Validation → lib/cast/schemas.ts
     - Storage → lib/cast/server/storage.ts
     - Pipeline → lib/cast/server/pipeline/
     - Search → lib/cast/server/vector-store.ts
     - Knowledge → lib/cast/server/knowledge-base.ts
  4. Document the server boundary in a comment block
     at lib/cast/server/index.ts:
     "Everything exported here becomes the Fastify service API"
Acceptance criteria:
  - Clean import graph: app/api/* → lib/cast/server/* only
  - No direct fs, Azure, or Qdrant calls in route handlers
  - Barrel export covers entire server surface
Feedback loops: pnpm typecheck, grep for direct imports in app/api/
```

### Slice 9: Environment + Config Consolidation

```
☐ Environment + Config Consolidation
Type: HITL (needs account credentials)
Size: S
Blocked by: none (can run parallel with Slice 1)
Steps:
  1. Create .env.example with all env vars documented:
     # Required
     OPENAI_API_KEY=
     # Storage (default: local)
     CAST_STORAGE=local
     AZURE_STORAGE_CONNECTION_STRING=
     # Vector DB (optional — features degrade gracefully)
     QDRANT_URL=
     QDRANT_API_KEY=
     # GenAI mode
     CAST_GENAI_MODE=default
     # Optional
     NEXT_PUBLIC_DROPBOX_APP_KEY=
     NEXT_PUBLIC_CAST_GENAI_MODE=default
  2. Create lib/cast/server/config.ts:
     - Central config object reading from process.env
     - Type-safe accessors with explicit undefined handling
     - isAzureEnabled(), isQdrantEnabled() helpers
  3. Update README with new env vars and setup instructions
Acceptance criteria:
  - .env.example documents every env var
  - Config module is the single source for env access
  - Missing optional services degrade gracefully (no crashes)
Feedback loops: pnpm typecheck
```

### Slice 10: Architecture Diagram + README + Agent Integration

```
☐ Architecture Diagram + README + Agent Integration
Type: HITL (requires human review of accuracy)
Size: M
Blocked by: All other slices (including 14a/14b)
Steps:
  1. Create docs/architecture.md with:
     - System diagram (Mermaid) showing all components
     - Data flow: brief → generate → metadata → vectorize → store
     - Retrieval flow: query → Qdrant → relevant assets/knowledge
     - Storage flow: UI ↔ API ↔ Azure Blob
  2. Add "Agent Integration" section to docs/architecture.md:
     a. Three-caller diagram:
        Human via UI → Next.js → lib/cast/server/
        Scheduler (cron) → Fastify API → lib/cast/server/
        Agent via MCP → MCP transport → lib/cast/server/
     b. MCP Tool Catalog table (name, description, inputSchema,
        annotations for each registered tool)
     c. MCP config snippet — ready-to-paste mcp.json:
        { "mcpServers": { "cast": { "command": "npx",
          "args": ["tsx", "lib/cast/server/mcp.ts"] } } }
  3. Update README.md:
     - Change tagline to "agent-ready creative infrastructure"
     - Architecture overview section
     - "Connect via MCP" section with config snippet
     - Setup instructions for Azure + Qdrant
     - Environment variables table
     - "How to productionize" section explaining the Fastify split
  4. Add a "Future: Fastify Split" section documenting:
     - What moves: lib/cast/server/ → fastify service
     - What stays: app/ + components/ + lib/cast/ (non-server)
     - API contract: identical routes, just different base URL
     - MCP transport moves with the server — same tools, new host
     - Why the split matters: extensibility for Salesforce/Marketo/etc.
Acceptance criteria:
  - Architecture diagram is accurate and renders in GitHub
  - Agent Integration section has caller diagram + tool catalog + config snippet
  - README tagline says "agent-ready creative infrastructure"
  - README has a "Connect via MCP" section
  - Fastify split path is documented and defensible
Feedback loops: human review
```

### Slice 11: Buyer Personas

```
☐ Buyer Personas
Type: HITL (needs persona seed data)
Size: M
Blocked by: Slice 5
Steps:
  1. Define persona schema in lib/cast/schemas.ts:
     personaSchema = z.object({
       id: z.string().regex(SLUG_RE),
       brand: z.string().regex(SLUG_RE),
       market: z.string().regex(MARKET_RE).optional(),
       displayName: z.string().min(1),
       age: z.string().optional(),
       interests: z.array(z.string()),
       motivators: z.array(z.string()),
       promptFragment: z.string().min(1),
       performanceScore: z.number().nullable().default(null),
     })
  2. Create lib/cast/server/personas.ts:
     - ensureCollection("cast-personas", { size: 1536, distance: "Cosine" })
     - upsertPersona(persona: Persona) → void
       Embed promptFragment + interests + motivators → vector
       Payload: all fields as filterable (brand, market, age)
     - listPersonas(brand, market?) → Persona[]
       Query by brand + optional market filter
     - getPersona(id) → Persona | null
     - promoteFromFreeText(brand, market, audience) → Persona
       Creates a persona from a free-text audience string
       after a successful run (id = slugify(audience))
  3. Add API routes:
     - GET /api/personas?brand=...&market=... → list
     - POST /api/personas → create/upsert
     - GET /api/personas/[id] → single
  4. Add optional personaId to briefSchema:
     personaId: z.string().regex(SLUG_RE).optional()
     When present, overrides the audience free-text for prompt construction
  5. Update prompt builder (lib/cast/prompt.ts):
     - Add audience/personaFragment to PromptPreviewArgs
     - Inject into prompt: "Target audience: {persona.promptFragment}"
     - This fixes the existing gap: audience is currently collected
       but NEVER flows into the GenAI prompt
  6. Brief editor UI change (components/cast/brief-editor-form-view.tsx):
     - Audience input becomes a combobox/typeahead
     - Queries GET /api/personas on focus with current brand
     - Selecting a persona fills audience + sets personaId
     - Free-text typing clears personaId (raw audience mode)
  7. Seed 2-3 demo personas per brand:
     brisa: "urban-wellness-seeker", "festival-socialite"
     volt: "gamer-night-owl", "gym-athlete"
Acceptance criteria:
  - Personas stored in Qdrant with embeddings
  - API returns personas filtered by brand/market
  - Selecting a persona populates audience + personaId on brief
  - Free-text fallback still works (personaId omitted)
  - Persona promptFragment appears in GenAI prompt
  - Audience field finally flows into image generation prompt
Feedback loops: pnpm test, pnpm typecheck, manual E2E
```

### Slice 12: Performance Feedback + Approval

```
☐ Performance Feedback + Approval
Type: HITL (needs performance data source)
Size: L
Blocked by: Slice 5
Steps:
  1. Define performance + approval schemas in lib/cast/schemas.ts:
     creativePerformanceSchema = z.object({
       campaign: z.string().regex(SLUG_RE),
       brand: z.string().regex(SLUG_RE),
       product: z.string(),
       market: z.string().regex(MARKET_RE),
       ratio: ratioSchema,
       impressions: z.number().int().nonneg(),
       clicks: z.number().int().nonneg(),
       ctr: z.number().nonneg(),
       conversions: z.number().int().nonneg().optional(),
       spend: z.number().nonneg().optional(),
       dateRange: z.object({
         from: z.string(), // ISO date
         to: z.string(),
       }),
     })
     approvalStatusSchema = z.enum(["pending", "approved", "rejected"])
  2. Create lib/cast/server/integrations/ads-performance.ts:
     export interface AdsPerformanceProvider {
       fetchTopCreatives(brand, market, days) → CreativePerformance[]
       fetchFatigueSignals(brand, market) → FatigueSignal[]
     }
     export class ManualImportProvider implements AdsPerformanceProvider {
       // Reads from Qdrant payload — performance data already imported
     }
     export class MetaAdsProvider implements AdsPerformanceProvider {
       // TODO: wire Meta Marketing API (Graph API v21+)
       // Requires: app_id, app_secret, access_token, ad_account_id
       // Endpoints: GET /{ad_account_id}/insights, GET /{ad_id}/insights
       // Fields: impressions, clicks, ctr, conversions, spend
     }
  3. Add API routes:
     - POST /api/performance — bulk import:
       Body: { campaign, brand, creatives: CreativePerformance[] }
       For each creative: compute performanceScore, patch Qdrant payload
       performanceScore = normalize(ctr * 0.6 + conversionRate * 0.4)
     - PATCH /api/creatives/[id]/status — approval:
       Body: { status: "approved" | "rejected", reason?: string }
       Patches status + rejectionReason on Qdrant payload + metadata JSON
     - GET /api/top-creatives?brand=...&market=...&days=30 — leaderboard:
       Queries Qdrant sorted by performanceScore DESC
       Returns top-K with metadata + image URLs + performance data
  4. Add costs field to manifestSchema:
     costs: z.object({
       estimated: z.number().nonneg(),
       actual: z.number().nonneg().optional(),
       currency: z.literal("USD"),
     }).optional()
  5. Update buildManifest() in manifest-builder.ts:
     - Accept costs param
     - Compute estimated = products × markets × ratios × costPerImage
     - costPerImage: $0.04 (dall-e-3) or $0.005 (gpt-image-1)
  6. Update generate route:
     - Compute estimated cost before pipeline starts
     - Compute actual cost after pipeline completes
     - Pass costs to buildManifest()
  7. Update searchCreatives() in vector-store.ts:
     - Add optional sortByPerformance: boolean param
     - When true, post-filter sort by performanceScore DESC
     - When querying for prompt seeds, prefer top-performing
  8. Update persona performanceScore:
     - When performance data imported, aggregate CTR across all
       creatives sharing the same personaId
     - Patch the persona's performanceScore in cast-personas
Acceptance criteria:
  - POST /api/performance patches Qdrant payloads with real metrics
  - PATCH /api/creatives/[id]/status updates approval status
  - GET /api/top-creatives returns performance-ranked leaderboard
  - manifest.costs shows estimated and actual USD per run
  - MetaAdsProvider interface exists with clear TODO comments
  - ManualImportProvider works end-to-end
  - Pipeline doesn't fail if performance data is absent
Feedback loops: manual curl tests, pnpm typecheck
Env vars: none new (Meta API keys deferred to MetaAdsProvider impl)
```

### Slice 13: Ad Fatigue Detection

```
☐ Ad Fatigue Detection
Type: AFK
Size: M
Blocked by: Slice 12
Steps:
  1. Create lib/cast/server/fatigue.ts:
     - computeFatigueScore(creative: QdrantPayload) → number:
       fatigueScore = daysSinceGeneration
                    + (impressions / 1000)
                    - (ctr * 100)
       Higher score = higher fatigue risk
       Returns 0 if no performance data (not yet measured)
     - FATIGUE_THRESHOLD = 45 (configurable via env)
     - isFatigued(creative) → boolean
     - getRefreshRecommendations(brand, market) → Recommendation[]:
       a. Query Qdrant for all active creatives (brand + market filter)
       b. Compute fatigueScore for each
       c. Sort by fatigue DESC
       d. For top-3 fatigued: pull top-3 performing creatives
          from same brand/market as recommended generation seeds
       e. Return { fatigued: Creative, seeds: Creative[], score }
  2. Add a scheduled/on-demand fatigue computation:
     - updateFatigueScores(brand, market) → void:
       a. List all creatives for brand/market from Qdrant
       b. Recompute fatigueScore for each
       c. Batch-upsert updated scores to Qdrant payloads
  3. Add API routes:
     - GET /api/fatigue-report?brand=...&market=...
       Returns fatigued creatives sorted by score DESC
       with refresh recommendations (top-performing seeds)
     - POST /api/fatigue/refresh — trigger fatigue score recalculation
  4. Wire fatigue badge into creative metadata:
     - After performance import (Slice 12), recompute fatigue
     - Creatives above threshold get fatigueRisk: true on payload
  5. (Future) UI stub: warning badge on output grid for
     creatives with fatigueScore > FATIGUE_THRESHOLD,
     one-click "regenerate with variation" action
Acceptance criteria:
  - Fatigue scores computed from performance data + age
  - GET /api/fatigue-report returns ranked fatigue list
  - Refresh recommendations include top-performing seeds
  - Scores update when new performance data is imported
  - Returns empty results gracefully when no performance data exists
Feedback loops: manual curl tests, pnpm typecheck
Env vars: CAST_FATIGUE_THRESHOLD (optional, default 45)
```

### Slice 14a: MCP Tool Registry

```
☐ MCP Tool Registry
Type: AFK
Size: S
Blocked by: none
Steps:
  1. Create lib/cast/server/mcp-tools.ts
  2. Define a CastMcpTool type:
     { name, title, description, inputSchema, annotations, handler }
  3. Export CAST_MCP_TOOLS array mapping each tool-shaped operation
     to its handler function + Zod inputSchema:
     | Tool Name           | Handler                    | Annotation        |
     |---------------------|----------------------------|-------------------|
     | list_brands          | listBrandSlugs()           | readOnlyHint      |
     | get_brand_profile    | loadBrandProfile(slug)     | readOnlyHint      |
     | detect_assets        | detected-assets route      | readOnlyHint      |
     | preview_prompt       | buildPromptPreview(args)   | readOnlyHint      |
     | check_compliance     | runCompliance(h, bw)       | readOnlyHint      |
     | upload_asset         | upload route               | (none — creates)  |
     | generate_campaign    | runPipeline(brief)         | (none — creates)  |
     | get_manifest         | readAsset(report.json)     | readOnlyHint      |
     | get_creative         | outputs route              | readOnlyHint      |
  4. Define outputSchema (Zod) for each tool alongside inputSchema.
     Handler returns both structuredContent (typed JSON for agents)
     and content (text fallback for LLM context). This is the
     standard MCP dual-return pattern.
  5. Each tool handler delegates to the existing lib/cast/server/ function —
     no new business logic
  6. generate_campaign handler must accept meta.progressToken
     and map NDJSON PipelineEvent types → MCP progress notifications
  7. Export registerCastTools(server: McpServer) function
     that calls server.registerTool() for each entry
  8. Future tools (post-Qdrant) are added to the same array:
     search_creatives, approve_creative, get_fatigue_report,
     import_performance
Acceptance criteria:
  - File compiles, typecheck passes
  - Tool schemas match existing Zod schemas exactly (no duplication)
  - No new runtime dependencies
  - registerCastTools() is a pure registration function
Feedback loops: pnpm typecheck
```

### Slice 14b: MCP Server (stdio)

```
☐ MCP Server (stdio)
Type: HITL (needs manual testing with MCP Inspector or Claude Desktop)
Size: M
Blocked by: Slice 14a, Slice 8
Steps:
  1. pnpm add @modelcontextprotocol/sdk
  2. Create lib/cast/server/mcp.ts (server entry point):
     - new McpServer({
         name: "cast",
         title: "Cast — Creative Automation",
         version: pkg.version,
       }, {
         instructions: "Cast generates localized social ad creatives..."
       })
     - registerCastTools(server)
     - Register MCP resources:
       a. "cast://brands" — list all brand slugs
       b. "cast://brands/{slug}" — brand profile (ResourceTemplate
          with complete callback for slug autocomplete)
       c. "cast://campaigns/{campaign}/manifest" — run manifest
     - Add completions: {} to server capabilities
     - Wrap brand/campaign inputSchema fields in completable()
       for agent autocomplete
     - const transport = new StdioServerTransport()
     - await server.connect(transport)
  3. Add package.json bin script:
     "cast-mcp": "tsx lib/cast/server/mcp.ts"
  4. Add mcp.json at repo root (Claude Desktop / VS Code config):
     { "mcpServers": { "cast": {
       "command": "npx",
       "args": ["tsx", "lib/cast/server/mcp.ts"],
       "env": { "OPENAI_API_KEY": "..." }
     }}}
  5. Test with @modelcontextprotocol/inspector:
     npx @modelcontextprotocol/inspector npx tsx lib/cast/server/mcp.ts
  6. Verify:
     - All 9 tools appear with correct schemas
     - list_brands, get_brand_profile, check_compliance callable
     - generate_campaign streams progress notifications
  7. Add "Connect via MCP" section to README
Acceptance criteria:
  - MCP Inspector shows all tools with correct inputSchemas
  - Read-only tools return structured content + text fallback
  - generate_campaign sends progress notifications during pipeline
  - Works from Claude Desktop and VS Code Copilot via mcp.json
  - Pipeline doesn't break when called via MCP (safeJoin CWD works)
Feedback loops: MCP Inspector, manual agent testing
Dev dependency: @modelcontextprotocol/sdk
```

### Slice 14c: MCP HTTP Transport (post-Fastify split)

```
☐ MCP HTTP Transport
Type: HITL
Size: S
Blocked by: Slice 14b, Fastify split
Steps:
  1. Import StreamableHTTPServerTransport from
     @modelcontextprotocol/sdk/server/streamableHttp.js
  2. Mount at /mcp endpoint on Fastify server
  3. Same registerCastTools() call — identical tool surface
  4. Add auth middleware (Bearer token validation)
     before MCP transport handler
  5. Update mcp.json with HTTP variant:
     { "mcpServers": { "cast-remote": {
       "url": "https://cast-api.example.com/mcp"
     }}}
Acceptance criteria:
  - Remote agents connect via HTTP SSE
  - Same 9+ tools available as stdio
  - Auth rejects unauthenticated requests
Feedback loops: MCP Inspector over HTTP
```

---

## 6. Key Insights

### Critical Principle: Storage Adapter is the Linchpin
**Why it matters:** The entire pipeline flows through `storage.ts`. A clean adapter interface means Azure support requires zero pipeline changes.
**How to apply:** Slice 1 must be done first and done right. Every subsequent slice builds on this abstraction.
**Risk if ignored:** Azure integration becomes a shotgun surgery touching 15+ files instead of a clean swap.

### Critical Principle: Graceful Degradation for Optional Services
**Why it matters:** Qdrant and metadata analysis are enhancements, not requirements. The pipeline must work without them.
**How to apply:** Every Qdrant call wrapped in try/catch with warning log. Every metadata analysis has a fallback to deterministic-only fields. `isQdrantEnabled()` gates all vector operations.
**Risk if ignored:** A Qdrant outage or missing API key crashes the entire generation pipeline.

### Critical Principle: Embed Once, Query Forever
**Why it matters:** Running vision analysis on every image at retrieval time is expensive. The transcript explicitly calls this out — "analyze the image on upload once and then have the information stored."
**How to apply:** Metadata is generated at write time (Slice 4), vectorized immediately (Slice 5), and never re-computed. Queries hit vectors only.
**Risk if ignored:** Cost scales linearly with every search query instead of being amortized at generation time.

### Critical Principle: Two Qdrant Collections, Not One
**Why it matters:** Image metadata and knowledge documents have completely different schemas, embedding strategies, and query patterns.
**How to apply:** `cast-creatives` for image vectors (filterable by brand/market/product/date). `cast-knowledge` for chunked markdown (filterable by brand/docType).
**Risk if ignored:** Mixed collections produce poor search relevance — a text chunk about "Japan marketing rules" competes with an image tagged "Japan" in relevance scoring.

### Critical Principle: The Monorepo IS the Architecture Proof
**Why it matters:** Building in-monorepo proves the API boundary before committing to a split. The interview answer is: "I built monorepo-first intentionally so the boundary was clear before splitting."
**How to apply:** `lib/cast/server/` is the future Fastify service. API routes are thin pass-throughs. No business logic leaks into components.
**Risk if ignored:** Premature splitting creates two half-broken repos instead of one working one.

### Critical Principle: The Flywheel — Persona → Generate → Measure → Learn → Generate Better
**Why it matters:** Personas shape prompts, performance data weights retrieval, fatigue detection triggers rotation. Each component feeds the next. Without closing the loop, generation never improves.
**How to apply:** Persona `promptFragment` flows into image gen (Slice 11). Performance data patches Qdrant payloads (Slice 12). Fatigue scoring consumes performance data to flag stale creatives (Slice 13). Top-performing creatives become seeds for the next generation run.
**Risk if ignored:** Every campaign starts from zero. No institutional learning. Teams keep regenerating without knowing what worked.

### Critical Principle: MCP Is Just Another Caller
**Why it matters:** The architecture already has clean function boundaries with typed inputs/outputs in `lib/cast/server/`. An MCP server is not a new system — it's a new transport on the same functions. This proves the architecture was agent-ready before "agent-ready" was a requirement.
**How to apply:** Slice 14a maps existing functions to MCP tools with zero new business logic. Slice 14b wires the transport. The tool registry (`mcp-tools.ts`) is a declarative array, not a framework.
**Risk if ignored:** Building the MCP layer as a separate system instead of a thin transport creates a second API surface that diverges from the first.

### Critical Principle: Three Callers, One Server Layer
**Why it matters:** The same `lib/cast/server/` functions are called by Next.js routes (human), Fastify routes (scheduled), and MCP transport (agent). This is the "every SaaS becomes an API + an MCP server" philosophy implemented concretely.
**How to apply:** No business logic in route handlers, MCP tool handlers, or Fastify route handlers. All three are thin transport wrappers over `lib/cast/server/`.
**Risk if ignored:** Logic drifts between callers. The MCP tool does something slightly different from the API route. Integration tests multiply. Bugs hide.

### Critical Principle: Progress Notifications for Long-Running Tools
**Why it matters:** `generate_campaign` runs for minutes. MCP supports `meta.progressToken` for streaming progress. The existing NDJSON event stream (`PipelineEvent`) maps 1:1 to MCP progress notifications — no new event system needed.
**How to apply:** The MCP tool handler for `generate_campaign` accepts `progressToken`, runs the pipeline with an `emit` callback that forwards events as MCP notifications, and returns the final manifest as `structuredContent`.
**Risk if ignored:** Agent callers get no feedback during generation and either timeout or spin-wait.

### Critical Principle: Audience Is the Biggest Prompt Gap
**Why it matters:** `audience` is collected in the brief but **never injected into the GenAI prompt**. `buildPromptPreview()` accepts `{ brand, product, market, ratio }` — no audience parameter. This means every image is generated identically regardless of who it's targeting.
**How to apply:** Slice 11 (Buyer Personas) fixes this by adding `persona.promptFragment` to the prompt builder. Even without personas, the raw `audience` string should flow into the prompt as a stopgap.
**Risk if ignored:** The entire audience targeting feature is theater — collected but unused.

### Critical Principle: Stub the Interface, Not the Integration
**Why it matters:** `AdsPerformanceProvider` interface lets you demonstrate Meta/Google/TikTok pluggability without building any of them. The interview answer is: "I designed the provider pattern so we can start with manual CSV import and plug in real APIs when ready."
**How to apply:** `ManualImportProvider` works end-to-end. `MetaAdsProvider` is a class with clear TODO comments and the correct API endpoint documentation. The interface proves the architecture handles multiple ad platforms.
**Risk if ignored:** You either over-build (wiring real Meta API before you have test data) or under-build (no proof the system can integrate).

---

## 7. Dependency Graph

```
                    ┌─────────────────┐
                    │  Slice 9: Env   │
                    │  Config         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Slice 1:       │
                    │  Storage        │
                    │  Adapter IF     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Slice 2:       │
                    │  Azure Blob     │
                    │  Adapter        │
                    └───┬────────┬────┘
                        │        │
              ┌─────────▼─┐  ┌──▼──────────┐
              │  Slice 3:  │  │  Slice 4:   │
              │  Brand     │  │  Metadata   │
              │  Loader    │  │  Pipeline   │
              └─────┬──────┘  └──────┬──────┘
                    │                │
                    │       ┌────────▼────────┐
                    │       │  Slice 5:       │
                    │       │  Qdrant +       │
                    │       │  Vectorization  │
                    │       └───┬────────┬────┘
                    │           │        │
              ┌─────▼───────┐  │   ┌────▼─────────┐
              │  Slice 8:   │  │   │  Slice 7:    │
              │  Boundary   │◀─┘   │  Knowledge   │
              │  Hardening  │      │  Base         │
              └─────┬───────┘      └────┬──────────┘
                    │                   │
                    │   ┌───────────────┘
                    │   │
              ┌─────▼───▼───┐
              │  Slice 6:   │
              │  Asset      │
              │  Ingestion  │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Slice 6:   │
              │  Asset      │
              │  Ingestion  │
              └──────┬──────┘
                     │
              ┌──────▼──────────────┐
              │  Slice 10:          │
              │  Docs + README +    │
              │  Agent Integration  │
              └─────────────────────┘

    (Phase 0 — no dependencies)     (Phase 5.5 — blocked by Slice 5)

    ┌──────────────┐                ┌──────────────┐     ┌───────────────┐
    │  Slice 14a:  │                │  Slice 11:   │     │  Slice 12:    │
    │  MCP Tool    │                │  Buyer       │     │  Performance  │
    │  Registry    │                │  Personas    │     │  + Approval   │
    └──────┬───────┘                └──────────────┘     └───────┬───────┘
           │                                                     │
    ┌──────▼───────┐                                    ┌────────▼────────┐
    │  Slice 14b:  │                                    │  Slice 13:      │
    │  MCP Server  │◀── Slice 8                         │  Ad Fatigue     │
    │  (stdio)     │                                    │  Detection      │
    └──────┬───────┘                                    └─────────────────┘
           │
    ┌──────▼───────┐
    │  Slice 14c:  │
    │  MCP HTTP    │◀── Fastify split
    │  Transport   │
    └──────────────┘
```

### Parallel-safe groups

| Phase | Slices | Can run in parallel? |
|-------|--------|---------------------|
| **Phase 0** | Slice 9 (Env Config) + Slice 14a (MCP Tool Registry) | Yes — both independent, can run in parallel |
| **Phase 1** | Slice 1 (Storage Adapter) | Sequential — foundational |
| **Phase 2** | Slice 2 (Azure Blob) | Sequential — needs Slice 1 |
| **Phase 3** | Slice 3 (Brand Loader) + Slice 4 (Metadata) | Yes — both depend on Slice 2 only |
| **Phase 4** | Slice 5 (Qdrant) | Sequential — needs Slice 4 |
| **Phase 5** | Slice 6 (Ingestion) + Slice 7 (Knowledge) + Slice 8 (Boundary) | Yes — all depend on Slice 5 |
| **Phase 5.5** | Slice 11 (Personas) + Slice 12 (Performance + Approval) | Yes — both depend on Slice 5 only |
| **Phase 5.7** | Slice 13 (Ad Fatigue) | Sequential — needs Slice 12 |
| **Phase 5.8** | Slice 14b (MCP Server stdio) | Sequential — needs Slice 14a + Slice 8 |
| **Phase 6** | Slice 10 (Docs + Agent Integration) | Sequential — documents everything including MCP |
| **Phase 7** | Slice 14c (MCP HTTP Transport) | Deferred — post-Fastify split |

---

## 8. QA Plan

```
☐ Full Integration QA
Type: HITL
Size: M
Blocked by: All slices
Steps:
  1. Clean slate test: delete all local outputs, clear Qdrant collections
  2. Set CAST_STORAGE=azure, configure Qdrant credentials
  3. Run asset ingestion for both brands (brisa, volt)
  4. Run knowledge ingestion for both brands
  5. Generate a campaign via the UI (brisa, 2 products, 3 markets, 3 ratios)
  6. Verify:
     - Images stored in Azure Blob (not local fs)
     - Metadata JSONs generated for each creative
     - All creatives vectorized in Qdrant
     - Search endpoint returns relevant results
     - Knowledge endpoint returns relevant brand guidelines
  7. Switch to CAST_STORAGE=local, regenerate — verify local mode still works
  8. Kill Qdrant connection — verify pipeline still completes (degraded mode)
  9. Run pnpm test — all 102+ tests pass
  10. Run pnpm typecheck — clean
  11. Run pnpm build — clean
  12. Persona typeahead flow:
      a. Seed 2 personas for brisa brand
      b. Open brief editor, type in audience field
      c. Verify typeahead shows matching personas
      d. Select a persona → verify personaId set on brief
      e. Clear to free-text → verify personaId removed
      f. Generate with persona → verify promptFragment in GenAI prompt
  13. Performance import flow:
      a. Run a campaign to generate creatives
      b. POST /api/performance with mock CTR data
      c. Verify Qdrant payloads patched with performanceScore
      d. GET /api/top-creatives — verify sorted by performance
  14. Approval workflow:
      a. PATCH /api/creatives/[id]/status with "approved"
      b. Verify status updated on Qdrant payload
      c. PATCH with "rejected" + reason
      d. Verify rejectionReason persisted
  15. Fatigue report:
      a. Import performance data for 30+ day old creatives
      b. POST /api/fatigue/refresh
      c. GET /api/fatigue-report — verify high-fatigue creatives ranked first
      d. Verify refresh recommendations include top-performing seeds
  16. Cost tracking:
      a. Generate a campaign, check manifest.costs.estimated > 0
      b. Verify actual cost populated after pipeline completes
  17. MCP Server:
      a. Start MCP server: npx tsx lib/cast/server/mcp.ts
      b. Connect via MCP Inspector: npx @modelcontextprotocol/inspector
      c. Verify all 9+ tools appear with correct inputSchemas
      d. Call list_brands → verify returns brand slugs
      e. Call get_brand_profile with slug → verify full profile
      f. Call check_compliance with headline + banned words → verify result
      g. Call generate_campaign with a valid brief → verify progress
         notifications stream during pipeline, final result is manifest
      h. Test from Claude Desktop via mcp.json → verify tools callable
      i. Verify read-only tools have readOnlyHint: true annotation
Acceptance criteria:
  - Both storage backends work end-to-end
  - Vector search returns meaningful results
  - Graceful degradation when optional services are down
  - MCP server exposes all tools with correct schemas
  - No regressions in existing functionality
```

---

## 9. Cost & Token Impact Analysis

| Operation | Model | Est. Cost per unit | Frequency |
|-----------|-------|-------------------|-----------|
| Image generation | dall-e-3 | ~$0.04/image | Per creative |
| Image metadata analysis | gpt-4o-mini | ~$0.002/image | Once per creative (at generation time) |
| Text embedding | text-embedding-3-small | ~$0.00002/chunk | Once per creative + once per knowledge chunk |
| Qdrant search | Qdrant | Free (cloud tier) | Per user query |
| Azure Blob storage | Azure | ~$0.02/GB/month | Storage at rest |
| Azure Blob operations | Azure | ~$0.004/10K ops | Read/write operations |
| Persona embedding | text-embedding-3-small | ~$0.00002/persona | Once per persona create/update |
| Performance import processing | Qdrant | Free (payload patch) | Per CSV/JSON import batch |
| Fatigue score computation | Qdrant | Free (query + patch) | On-demand or post-import |

**Key savings:** Metadata analysis at generation time (Haiku-tier cost) avoids re-analyzing at query time (would be orders of magnitude more expensive at scale).

### Scale Economics (full pipeline)

| Scale | dall-e-3 | gpt-image-1 | Metadata (gpt-4o-mini) | Embeddings |
|---|---|---|---|---|
| 1 brief (18 images) | $0.72 | $0.09 | $0.036 | $0.0004 |
| 100 briefs/month | $72 | $9 | $3.60 | $0.04 |
| 500 briefs/month | $360 | $45 | $18 | $0.20 |

---

## 10. What This Sets Up for the Fastify Split

When the monorepo is proven and the split becomes necessary:

| What | Where it goes | Effort |
|------|--------------|--------|
| `lib/cast/server/*` | Fastify service repo | Move files, add Fastify route wrappers |
| `lib/cast/schemas.ts` | Shared npm package or copied | Zod schemas shared between repos |
| `lib/cast/events.ts` | Shared npm package or copied | NDJSON event types |
| `app/api/*` | Deleted from Next.js | Routes now live in Fastify |
| `app/page.tsx` | Fetch calls repointed | `NEXT_PUBLIC_API_URL` env var |
| `hooks/use-run-controller.ts` | Base URL parameterized | Already fetches from `/api/generate` |
| `lib/cast/server/mcp-tools.ts` | Moves with server | Tool registry stays with server functions |
| `lib/cast/server/mcp.ts` | Fastify mounts MCP transport | stdio → StreamableHTTPServerTransport at `/mcp` |

The split is a mechanical extraction, not an architectural decision. The MCP transport moves with the server — same tools, new host. That's the point.

---

## 11. Interview Talking Points This Enables

1. **"How would you handle file storage at scale?"** → Storage adapter pattern, Azure Blob, local fallback for dev
2. **"How do you avoid expensive LLM calls?"** → Analyze once at generation, vectorize metadata, query vectors (not re-analyze)
3. **"How do you handle multi-brand, multi-country retrieval?"** → Qdrant metadata filters + separate knowledge collections
4. **"Why is it still a monorepo?"** → Built monorepo-first to prove the API boundary; split is mechanical, not architectural
5. **"How would you plug this into existing marketing tools?"** → Fastify API layer = any system can call it (Salesforce, Marketo, customer.io)
6. **"What about historical assets?"** → Same metadata pipeline runs as ingestion script; indexes everything in Qdrant
7. **"How do you keep costs low?"** → Cheap analysis model (gpt-4o-mini), embed once / query forever, vector filters instead of re-embedding
8. **"How do you handle audience consistency across campaigns?"** → Buyer personas stored in Qdrant with embeddings — each persona has a `promptFragment` that replaces inconsistent free-text; personas accumulate performance data over time, so you learn which audiences convert
9. **"How do you know when to refresh creatives?"** → Fatigue heuristic combining creative age + impression volume + CTR decline. System proactively flags stale creatives and recommends top-performing variants as regeneration seeds
10. **"How do you close the performance feedback loop?"** → Manual CSV/JSON import initially, `AdsPerformanceProvider` interface ready for Meta/Google/TikTok API integration. Performance scores weight Qdrant retrieval so "generate more like the best" works automatically
11. **"How would you integrate with Meta or Google Ads?"** → Provider pattern — `ManualImportProvider` works today, `MetaAdsProvider` is a stubbed class with correct Marketing API endpoint docs. Adding a new ad platform means implementing one interface with two methods
12. **"How would an agent use Cast?"** → Every operation in Cast is a named, typed function with Zod-validated inputs. I exposed them as MCP tools — `list_brands`, `preview_prompt`, `generate_campaign`, `check_compliance`, `approve_creative`. An agent connects via stdio or HTTP, calls `generate_campaign` with a brief, gets progress notifications as creatives render, then calls `approve_creative` on each output. The human reviews one screen and clicks approve. The UI doesn't orchestrate — the agent does. The UI is the human-in-the-loop checkpoint
13. **"Why MCP instead of just an API?"** → APIs require the caller to know your URL, auth scheme, and payload format. MCP tools are self-describing — name, description, typed schema, annotations. An agent discovers what Cast can do by connecting, the same way it discovers any other tool. No integration docs needed, no custom client code
14. **"How do you handle the dashboard-vs-agent tension?"** → Three callers, one server. The React UI is for review and deterministic decisions. The agent is for orchestration and repetitive work. They call the same `lib/cast/server/` functions. The approval workflow (Slice 12) is the bridge — the agent generates, the human reviews one screen, the human approves, the agent continues
15. **"What makes this agent-ready vs just API-first?"** → Tool annotations. Each MCP tool declares `readOnlyHint` or `destructiveHint`. The agent knows `check_compliance` is safe to call speculatively but `generate_campaign` wipes previous output. The `generate_campaign` tool streams progress notifications during the multi-minute pipeline. The agent gets real-time feedback, not a timeout
