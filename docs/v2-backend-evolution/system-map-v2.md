# System Map — Cast: Creative Automation Studio Toolchain (v2)

> v2 extends the original system map with five new personas (Jordan, Sam), eight new entities (Persona, PerformanceRecord, FatigueSignal, ApprovalStatus, ImageMetadata, KnowledgeChunk, CostRecord, MCPTool), a restructured subsystem map reflecting Azure Blob + Qdrant + the AdsPerformanceProvider interface, and two new data flows (performance feedback loop, agent/MCP caller). Original content is preserved and extended, not replaced.

---

## 1. Entity Map — the nouns in the system

The "things" the system stores, moves, and renders.

```mermaid
graph LR
    Brief["Brief<br/>brand · products · markets<br/>audience/personaId · message · ratios<br/>logoVariant?"]
    Persona["Persona ★new<br/>id · brand · market?<br/>displayName · promptFragment<br/>performanceScore?"]
    Product["Product<br/>name · sku · promptOverrides?"]
    InputAsset["Input Asset<br/>Azure cast-inputs / local inputs/assets/<br/>[product-slug].{png,jpg,jpeg,webp}"]
    HeroImage["Hero Image<br/>GenAI fallback"]
    Creative["Output Creative<br/>1:1 · 9:16 · 16:9<br/>source · path · badge<br/>status · approvalReason?"]
    ImageMetadata["Image Metadata ★new<br/>description · tags · colors · mood<br/>generatedAt · promptUsed?<br/>estimatedCost · personaId?"]
    PerformanceRecord["Performance Record ★new<br/>impressions · clicks · ctr<br/>conversions? · spend?<br/>dateRange · performanceScore"]
    FatigueSignal["Fatigue Signal ★new<br/>creative · fatigueScore<br/>daysSinceGeneration · impressions<br/>recommendedSeeds[]"]
    ApprovalStatus["Approval Status ★new<br/>pending | approved | rejected<br/>rejectionReason?"]
    Message["Localized Message<br/>per locale"]
    Compliance["Compliance Result<br/>OK · WARN · FAIL"]
    KnowledgeChunk["Knowledge Chunk ★new<br/>brand · docType · title<br/>chunkIndex · chunkText · vector"]
    CostRecord["Cost Record ★new<br/>estimated USD · actual USD<br/>model · creativeCount"]
    RunLog["Run Log<br/>streamed steps"]
    Report["Report<br/>report.json<br/>counts · creatives[] · errors[]<br/>costs ★new"]
    LogoVariant["Logo Variant<br/>id · displayName · path · theme?"]

    Brief -->|lists| Product
    Brief -->|carries| Message
    Brief -->|selects| LogoVariant
    Brief -->|references| Persona
    Persona -->|promptFragment injected into| HeroImage
    Persona -->|accumulates| PerformanceRecord
    Product -->|resolves to| InputAsset
    Product -.->|falls back to| HeroImage
    InputAsset -->|source for| Creative
    HeroImage -->|source for| Creative
    Message -->|composited onto| Creative
    Creative -->|evaluated by| Compliance
    Creative -->|carries| ApprovalStatus
    Creative -->|has| ImageMetadata
    Creative -->|listed in| Report
    Compliance -->|listed in| Report
    RunLog -->|summarized in| Report
    Report -->|carries| CostRecord
    PerformanceRecord -->|patches| Creative
    PerformanceRecord -->|feeds| FatigueSignal
    FatigueSignal -->|recommends| Creative
    KnowledgeChunk -->|queried by| HeroImage
```

---

## 2. Actor Map — who does what

Five actors across the full system lifecycle.

```mermaid
graph TB
    subgraph Actors
        Maya["Maya<br/>Creative Producer"]
        Priya["Priya<br/>Brand Manager"]
        Aaron["Aaron<br/>Engineer / Demo"]
        Jordan["Jordan ★new<br/>Growth Marketer<br/>/ Perf Analyst"]
        Sam["Sam ★new<br/>Marketing Ops<br/>/ Scheduler"]
        Agent["Agent ★new<br/>Automated caller<br/>(scheduler · CI · LLM)"]
    end

    subgraph Verbs["Primary actions"]
        Edit["edits brief"]
        SelectPersona["selects persona ★new"]
        Drop["drops photos"]
        Generate["triggers generation"]
        Watch["watches pipeline log"]
        Review["reviews output grid"]
        Approve["approves / rejects ★new"]
        Read["reads compliance badges"]
        Drill["drills into flagged item"]
        Import["imports performance data ★new"]
        ViewPerf["views top-performing ★new"]
        ViewFatigue["reads fatigue report ★new"]
        TriggerRefresh["triggers seeded refresh ★new"]
        Schedule["schedules recurring run ★new"]
        Demo["narrates the demo"]
        CallAPI["calls Cast via API/MCP ★new"]
    end

    Maya --> Edit
    Maya --> SelectPersona
    Maya --> Drop
    Maya --> Generate
    Maya --> Watch
    Maya --> Review

    Priya --> Review
    Priya --> Read
    Priya --> Drill
    Priya --> Approve

    Aaron --> Generate
    Aaron --> Watch
    Aaron --> Demo

    Jordan --> Import
    Jordan --> ViewPerf
    Jordan --> ViewFatigue
    Jordan --> TriggerRefresh

    Sam --> Schedule
    Sam --> CallAPI
    Sam --> Review

    Agent --> CallAPI
    Agent --> Generate
    Agent --> Approve
```

---

## 3. Subsystem Map — how the parts fit together

```mermaid
graph TB
    subgraph External["External services"]
        subgraph AzureBlob["Azure Blob Storage"]
            AzInputs[("cast-inputs<br/>product photos")]
            AzOutputs[("cast-outputs<br/>generated PNGs + metadata JSONs")]
            AzBrands[("cast-brands<br/>brand.json · voice.json · logos · font")]
        end
        subgraph QdrantCloud["Qdrant Cloud"]
            QCreatives[("cast-creatives<br/>image metadata vectors<br/>performanceScore · fatigueScore<br/>status · personaId")]
            QKnowledge[("cast-knowledge<br/>brand guidelines chunks<br/>country rules chunks")]
            QPersonas[("cast-personas<br/>persona vectors<br/>promptFragment · performanceScore")]
        end
        GenAI["GenAI Image API<br/>OpenAI · dall-e-3 / gpt-image-1"]
        MetaAds["Meta Ads API ★stub<br/>AdsPerformanceProvider IF<br/>ManualImportProvider (live)<br/>MetaAdsProvider (TODO)"]
        OS["OS shell · file explorer"]
    end

    subgraph App["Next.js 16 monorepo — localhost:3000"]
        direction TB

        subgraph UI["UI layer"]
            Editor["Brief Editor<br/>form + JSON toggle<br/>persona typeahead ★new<br/>cost estimate ★new"]
            DropZone["Drop Zone<br/>per-product"]
            DetectedPanel["Detected Assets panel"]
            LogView["Live Pipeline Log"]
            Grid["Output Grid<br/>approval badges ★new<br/>fatigue badges ★new"]
            BadgeUI["Compliance + Approval Badges ★new"]
            PerfDash["Performance Dashboard S6 ★new<br/>top creatives · cost tracking"]
            FatigueDash["Fatigue Report S7 ★new<br/>ranked fatigue · refresh seeds"]
        end

        subgraph API["API routes (thin pass-throughs)"]
            UploadAPI["POST /api/upload"]
            DetectedAPI["GET /api/detected-assets"]
            GenerateAPI["POST /api/generate (NDJSON)"]
            BrandsAPI["GET /api/brands"]
            BrandDetailAPI["GET /api/brands/[slug]"]
            PersonasAPI["GET|POST /api/personas ★new"]
            SearchAPI["GET /api/search-creatives ★new"]
            KnowledgeAPI["GET /api/knowledge ★new"]
            PerfAPI["POST /api/performance ★new"]
            StatusAPI["PATCH /api/creatives/[id]/status ★new"]
            TopAPI["GET /api/top-creatives ★new"]
            FatigueAPI["GET /api/fatigue-report ★new<br/>POST /api/fatigue/refresh ★new"]
            IngestAPI["POST /api/ingest ★new (dev only)"]
        end

        subgraph Actions["Server actions"]
            RevealAction["revealOutputFolder"]
            CopyPathAction["resolveCreativeAbsolutePath"]
        end

        subgraph Server["lib/cast/server/ (future Fastify service body)"]
            subgraph Storage["storage.ts"]
                StorageIF["StorageAdapter interface"]
                LocalFS["LocalFsAdapter"]
                AzureAdapter["AzureBlobAdapter ★new"]
            end
            BrandLoader["brand-loader.ts<br/>Zod-validated · 90s cache"]
            Config["config.ts ★new<br/>isAzureEnabled() · isQdrantEnabled()"]
            subgraph Pipeline["pipeline/"]
                Orchestrator["orchestrator.ts"]
                Resolver["asset-resolver.ts"]
                PromptBuilder["prompt-builder.ts<br/>+ persona.promptFragment ★new<br/>+ RAG knowledge context ★new"]
                Resizer["image-processor.ts (Sharp)"]
                Compositor["text-compositor.ts"]
                Checker["compliance-checker.ts"]
                Reporter["reporter.ts<br/>+ costs field ★new"]
            end
            MetadataModule["metadata.ts ★new<br/>analyzeImage() → ImageMetadata<br/>gpt-4o-mini · fallback-safe"]
            VectorStore["vector-store.ts ★new<br/>getQdrantClient()<br/>upsertCreativeVector()<br/>searchCreatives()"]
            KnowledgeBase["knowledge-base.ts ★new<br/>ingestMarkdown()<br/>queryKnowledge()"]
            PersonasModule["personas.ts ★new<br/>upsertPersona()<br/>listPersonas()<br/>promoteFromFreeText()"]
            FatigueModule["fatigue.ts ★new<br/>computeFatigueScore()<br/>getRefreshRecommendations()"]
            AdsIntegration["integrations/ads-performance.ts ★new<br/>AdsPerformanceProvider IF<br/>ManualImportProvider<br/>MetaAdsProvider (stub)"]
            MCPStub["mcp.ts ★new<br/>castMcpTools{}<br/>generate_campaign · search_creatives<br/>approve_creative · get_fatigue_report<br/>import_performance"]
            ServerBarrel["index.ts ★new<br/>barrel export<br/>'Everything exported here<br/>becomes the Fastify service API'"]
        end
    end

    Editor -->|brief| GenerateAPI
    Editor -->|persona query| PersonasAPI
    Editor -->|brand list| BrandsAPI
    Editor -->|brand detail| BrandDetailAPI
    Grid -->|approve/reject| StatusAPI
    PerfDash -->|top creatives| TopAPI
    FatigueDash -->|fatigue data| FatigueAPI

    GenerateAPI --> Orchestrator
    PersonasAPI --> PersonasModule
    SearchAPI --> VectorStore
    KnowledgeAPI --> KnowledgeBase
    PerfAPI --> AdsIntegration
    PerfAPI --> FatigueModule
    StatusAPI --> VectorStore
    TopAPI --> VectorStore
    FatigueAPI --> FatigueModule
    IngestAPI --> MetadataModule
    IngestAPI --> VectorStore

    Orchestrator --> Resolver
    Orchestrator --> BrandLoader
    Orchestrator --> Reporter
    Resolver --> StorageIF
    Resolver -.->|on miss| PromptBuilder
    PromptBuilder --> BrandLoader
    PromptBuilder -.->|RAG| KnowledgeBase
    PromptBuilder -.->|persona fragment| PersonasModule
    PromptBuilder -.->|prompt| GenAI
    GenAI -.->|hero bytes| Resolver
    Resolver --> Resizer
    Resizer --> Compositor
    Compositor --> StorageIF
    Compositor --> Checker
    Checker --> Reporter
    Reporter --> StorageIF

    StorageIF --> LocalFS
    StorageIF --> AzureAdapter
    LocalFS -.->|local dev| AzInputs
    AzureAdapter -->|prod| AzInputs
    AzureAdapter -->|prod| AzOutputs
    AzureAdapter -->|prod| AzBrands
    BrandLoader --> StorageIF

    MetadataModule -.->|after writeCreative| VectorStore
    MetadataModule -.->|after writeCreative| StorageIF
    VectorStore --> QCreatives
    KnowledgeBase --> QKnowledge
    PersonasModule --> QPersonas
    AdsIntegration -.->|patch performanceScore| QCreatives
    AdsIntegration -.->|Meta API (stub)| MetaAds
    FatigueModule --> QCreatives
    FatigueModule --> QPersonas

    MCPStub -.->|wraps| ServerBarrel
    ServerBarrel --> Orchestrator
    ServerBarrel --> VectorStore
    ServerBarrel --> FatigueModule
    ServerBarrel --> AdsIntegration
    ServerBarrel --> PersonasModule
```

---

## 4. Three callers, one server layer

This is the architectural thesis of v2. The same `lib/cast/server/` code serves all three entry points. The UI is one caller, not the only one.

```mermaid
graph LR
    Human["Human<br/>(Maya · Priya · Jordan · Sam)"]
    Scheduler["Scheduler<br/>(cron · CI · webhook)"]
    AgentNode["Agent<br/>(LLM · automation)"]

    subgraph Callers["Entry points"]
        NextUI["Next.js UI<br/>localhost:3000"]
        FastifyAPI["Fastify API ★future split<br/>api.cast.internal"]
        MCPTransport["MCP Transport ★stub<br/>castMcpTools{}"]
    end

    subgraph Core["lib/cast/server/ (identical for all callers)"]
        Pipeline2["Pipeline Engine"]
        Storage2["Storage Adapter"]
        Vector["Vector Store"]
        Knowledge["Knowledge Base"]
        Personas2["Personas"]
        Fatigue["Fatigue Engine"]
        Perf["Ads Performance"]
    end

    Human --> NextUI
    Scheduler --> FastifyAPI
    AgentNode --> MCPTransport

    NextUI --> Core
    FastifyAPI --> Core
    MCPTransport --> Core

    Core --> Pipeline2
    Core --> Storage2
    Core --> Vector
    Core --> Knowledge
    Core --> Personas2
    Core --> Fatigue
    Core --> Perf
```

**The Fastify split is mechanical, not architectural.** When the split is needed, `lib/cast/server/` moves to a new repo, Fastify route wrappers are added, and `app/api/*` fetch calls are repointed to `NEXT_PUBLIC_API_URL`. The `index.ts` barrel export is the future service contract — every function exported there becomes a Fastify route.

---

## 5. Data flow — one Generate click, end to end (v2)

> v2 additions: persona fragment injected into prompt, metadata pipeline runs post-write, creative vectorized into Qdrant, cost tracked in manifest.

```mermaid
sequenceDiagram
    autonumber
    actor User as Maya / Sam / Agent
    participant UI as Brief Editor / API / MCP
    participant Orc as Run Orchestrator
    participant Per as Personas
    participant Res as Asset Resolver
    participant Stor as Storage Adapter
    participant AI as GenAI API
    participant Img as Resizer + Compositor
    participant Chk as Compliance Checker
    participant Meta as metadata.ts
    participant Vec as vector-store.ts
    participant Rep as Reporter
    participant Log as Live Log + Grid

    User->>UI: trigger generation (brief + optional personaId)
    UI->>Orc: POST brief
    Orc->>Per: loadPersona(personaId?) → promptFragment
    Per-->>Orc: persona.promptFragment (or raw audience string)
    Orc-->>Log: step "run started · estimated cost $X.XX"
    loop for each product × market
        Orc->>Res: resolve hero for product
        Res->>Stor: look up asset (Azure or local)
        alt asset found
            Stor-->>Res: buffer
        else asset missing
            Orc->>AI: generate (prompt includes persona.promptFragment + RAG knowledge)
            AI-->>Res: image bytes
        end
        par 1:1 · 9:16 · 16:9
            Orc->>Img: resize + composite (locale message)
            Img->>Stor: writeCreative → Azure cast-outputs
            Orc->>Chk: compliance check
            Chk-->>Orc: OK / WARN / FAIL
            Orc->>Meta: analyzeImage(buffer, context)
            Meta-->>Orc: ImageMetadata {description, tags, colors, mood}
            Orc->>Stor: write [ratio].metadata.json → Azure
            Orc->>Vec: upsertCreativeVector(metadata) → Qdrant cast-creatives
            Orc-->>Log: creative_ready + badge
        end
    end
    Orc->>Rep: buildManifest (+ costs.estimated + costs.actual)
    Rep->>Stor: writeReport → Azure cast-outputs
    Rep-->>Log: complete event { manifest }
    Log-->>User: grid hydrates from manifest
```

---

## 6. Performance feedback flow — Jordan's lens

Jordan never touches the generation pipeline. He works on the output of past runs, closing the loop so future generations start from what worked.

```mermaid
graph LR
    Import["POST /api/performance<br/>CSV / JSON from Meta Ads"] --> Parse["AdsIntegration<br/>ManualImportProvider"]
    Parse --> Score["compute performanceScore<br/>= normalize(ctr × 0.6 + conversionRate × 0.4)"]
    Score --> PatchVec["patch Qdrant payload<br/>cast-creatives · performanceScore"]
    Score --> PatchPersona["aggregate to persona<br/>cast-personas · performanceScore"]
    PatchVec --> Fatigue2["computeFatigueScore()<br/>age + impressions - ctr × 100"]
    Fatigue2 --> Flag["fatigueRisk: true<br/>on Qdrant payload"]
    Flag --> Report2["GET /api/fatigue-report<br/>ranked · with refresh seeds"]
    Report2 --> Seeds["top-performing creatives<br/>same brand/market → seeds[]"]
    Seeds --> NewBrief["pre-populate new brief<br/>with seed references"]
    NewBrief --> Generate2["Generate → new run<br/>informed by history"]
    PatchVec --> TopCreatives["GET /api/top-creatives<br/>sorted by performanceScore DESC"]
```

---

## 7. Approval flow — Priya's lens (v2)

```mermaid
graph LR
    Done["Run completes"] --> Grid2["Output Grid<br/>compliance + approval badges"]
    Grid2 --> Scan{"All approved?"}
    Scan -->|yes| Ship2["route to distribution"]
    Scan -->|no| Click2["click creative tile"]
    Click2 --> Detail2["Creative Detail<br/>compliance checks + approval actions"]
    Detail2 --> Decide2{"approve or reject?"}
    Decide2 -->|approve| PatchApprove["PATCH /api/creatives/[id]/status<br/>{ status: 'approved' }"]
    Decide2 -->|reject| PatchReject["PATCH /api/creatives/[id]/status<br/>{ status: 'rejected', reason: '...' }"]
    PatchReject --> Notify["rejection reason → Maya<br/>(out-of-app for now · v2: notification)"]
    PatchApprove --> Qdrant2["Qdrant payload updated<br/>status · timestamp"]
    PatchReject --> Qdrant2
    Notify --> EditBrief2["Maya edits brief · re-run"]
    EditBrief2 --> Done
```

---

## 8. Agent / MCP caller flow — Sam's lens

```mermaid
sequenceDiagram
    actor Agent2 as Agent / Scheduler
    participant MCP as MCP Transport (stub)
    participant Lib as lib/cast/server/
    participant Qdrant3 as Qdrant
    participant Azure2 as Azure Blob

    Agent2->>MCP: call generate_campaign({ brief })
    MCP->>Lib: orchestrator.run(brief)
    Lib-->>MCP: manifest { creatives[], costs }
    MCP-->>Agent2: manifest

    Agent2->>MCP: call search_creatives({ q: "Japan summer", brand: "brisa" })
    MCP->>Qdrant3: vector search + metadata filters
    Qdrant3-->>MCP: ScoredPoint[]
    MCP-->>Agent2: relevant creatives + scores

    Agent2->>MCP: call approve_creative({ id, status: "approved" })
    MCP->>Qdrant3: patch payload status
    Qdrant3-->>MCP: ok
    MCP-->>Agent2: { ok: true }

    Note over Agent2,MCP: Human checkpoint — Agent pauses here<br/>if approval requires human review
    Agent2->>MCP: call get_fatigue_report({ brand, market })
    MCP->>Lib: fatigueModule.getRefreshRecommendations()
    Lib->>Qdrant3: query cast-creatives by brand/market
    Qdrant3-->>Lib: payloads with fatigueScore
    Lib-->>MCP: { fatigued[], seeds[] }
    MCP-->>Agent2: fatigue report
```

---

## 9. Story → subsystem coverage (v2 complete)

| Verb / capability | Subsystem that owns it | Source |
| --- | --- | --- |
| edit campaign brief in UI | Brief Editor | Story 1 (Maya) |
| select buyer persona from typeahead | Brief Editor → `GET /api/personas` → `personas.ts` | Story 1 v2 / Story 4 |
| see cost estimate before Generate | Brief Editor → cost calc (products × markets × ratios × model cost) | Story 1 v2 |
| drop product photos in UI | Drop Zone → `POST /api/upload` → StorageAdapter | Story 1 |
| see detected vs missing assets | Detected Assets panel → `GET /api/detected-assets` | Design addition |
| pick a brand for this campaign | Brand selector → `GET /api/brands` | Story 1 |
| select logo variant | Logo picker → `brief.logoVariant` | Design addition |
| look up input assets | Asset Resolver → StorageAdapter (Azure or local) | Story 1 |
| read brand profile | `loadBrandProfile` → StorageAdapter → Zod | Story 1 |
| query knowledge base for prompt context | PromptBuilder → `knowledge-base.ts` → Qdrant | Design addition (RAG) |
| inject persona.promptFragment into prompt | PromptBuilder → `personas.ts` | Story 1 v2 |
| generate hero image when missing | PromptBuilder → GenAI API | Story 1 |
| resize to 1:1, 9:16, 16:9 | Image Processor (Sharp) | Story 1 |
| composite localized message overlay | Text Compositor | Story 1 |
| stream pipeline log in real time | Run Orchestrator → Live Pipeline Log | Story 1 / Story 3 |
| analyze image and generate metadata | `metadata.ts` → gpt-4o-mini → ImageMetadata | Design addition |
| vectorize creative into Qdrant | `vector-store.ts` → cast-creatives | Design addition |
| store image + metadata to cloud | StorageAdapter → Azure cast-outputs | Design addition |
| display output grid (manifest-hydrated) | Output Grid ← Reporter manifest | Story 1 |
| badge each output OK / WARN / FAIL | Compliance Checker → Badge UI | Story 2 |
| drill into flagged creative | Creative Detail → compliance detail | Story 2 |
| approve / reject creative | `PATCH /api/creatives/[id]/status` → Qdrant payload | Story 2 v2 |
| import performance data | `POST /api/performance` → AdsIntegration → Qdrant patch | Story 4 (Jordan) |
| view top-performing creatives | `GET /api/top-creatives` → Qdrant sorted by performanceScore | Story 4 |
| compute fatigue scores | `fatigue.ts` → Qdrant query + patch | Story 4 |
| get refresh recommendations | `GET /api/fatigue-report` → seeds from top-performers | Story 4 |
| aggregate persona performance | `personas.ts` → patch cast-personas from creative perf data | Story 4 |
| trigger generation via API (no UI) | Fastify API / Next.js routes → `lib/cast/server/` | Story 5 (Sam) |
| call Cast via MCP | `mcp.ts` castMcpTools → `lib/cast/server/` | Story 5 / Agent |
| semantic search over creative history | `GET /api/search-creatives` → Qdrant vector search | Story 5 / Story 4 |
| ingest knowledge docs to Qdrant | `POST /api/ingest` → `knowledge-base.ts` | Design addition |
| ingest historical assets | `POST /api/ingest` → `ingest.ts` → metadata → Qdrant | Design addition |
| track cost per run | Reporter → `costs { estimated, actual }` in manifest | Design addition |
| write brief.json | Run Orchestrator → StorageAdapter | Story 1 |
| write report.json | Reporter → StorageAdapter | Story 1 + Story 2 |
| open output folder | `revealOutputFolder` server action → OS shell | Story 1 |
| copy creative absolute path | `resolveCreativeAbsolutePath` server action | Design addition |
| export to Dropbox | Dropbox Saver SDK (client-side) | Design addition |
