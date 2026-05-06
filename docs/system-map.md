# System Map — Cast: Creative Automation Studio Toolchain

### Local Next.js App · POC · v1

> Bridges the [user stories](user-stories.md) to a buildable solution. Entities, actors, and subsystems are pulled directly from the verbs/nouns in Maya's, Priya's, and Aaron's stories.

---

## 1. Entity Map — the nouns in the system

The "things" the system stores, moves, and renders. Pulled from the user-story verbs (edit a **brief**, drop a **photo**, generate a **hero image**, render an **output**, badge for **compliance**, write a **report**).

```mermaid
graph LR
    Brief["Brief<br/>brand · products · markets<br/>audience · message · ratios"]
    Product["Product<br/>name · sku"]
    InputAsset["Input Asset<br/>inputs/assets/[product-slug].{png,jpg,jpeg,webp}"]
    HeroImage["Hero Image<br/>GenAI fallback"]
    Creative["Output Creative<br/>1:1 · 9:16 · 16:9"]
    Message["Localized Message<br/>per locale"]
    Compliance["Compliance Result<br/>OK · WARN · FAIL"]
    RunLog["Run Log<br/>streamed steps"]
    Report["Report<br/>report.json"]

    Brief -->|lists| Product
    Brief -->|carries| Message
    Product -->|resolves to| InputAsset
    Product -.->|falls back to| HeroImage
    InputAsset -->|source for| Creative
    HeroImage -->|source for| Creative
    Message -->|composited onto| Creative
    Creative -->|evaluated by| Compliance
    Creative -->|listed in| Report
    Compliance -->|listed in| Report
    RunLog -->|summarized in| Report
```

---

## 2. Actor Map — who does what

Three actors, each with a distinct primary verb. Same system, three lenses.

```mermaid
graph TB
    subgraph Actors
        Maya["Maya<br/>Creative Producer"]
        Priya["Priya<br/>Brand Manager"]
        Aaron["Aaron<br/>Engineer / Demo"]
    end

    subgraph Verbs["Primary actions"]
        Edit["edits brief"]
        Drop["drops photos in inputs/"]
        Generate["clicks Generate"]
        Watch["watches pipeline log"]
        Review["reviews output grid"]
        Read["reads compliance badges"]
        Drill["drills into flagged item"]
        Demo["narrates the demo"]
    end

    Maya --> Edit
    Maya --> Drop
    Maya --> Generate
    Maya --> Watch
    Maya --> Review

    Priya --> Review
    Priya --> Read
    Priya --> Drill

    Aaron --> Generate
    Aaron --> Watch
    Aaron --> Demo
```

---

## 3. Subsystem Map — how the parts fit together

The verbs from the stories cluster into seven subsystems. Anything inside the dashed box runs inside the local Next.js app; anything outside is filesystem or third-party.

```mermaid
graph TB
    subgraph External["External / filesystem"]
        Inputs[("inputs/assets/<br/>product photos")]
        BrandProfile[("inputs/brands/[brand]/<br/>brand.json · voice.json · logos/ + logos.json · font · banned-words.json?<br/>loaded via loadBrandProfile · Zod-validated · 90s in-process cache<br/>bannedWords = lib defaults ∪ brand file (D11, D21)")]
        subgraph CampaignOut["outputs/[campaign]/"]
            Outputs[("[market]/[product]/[ratio].png")]
            BriefFile[("brief.json")]
            ReportFile[("report.json")]
        end
        GenAI["GenAI Image API<br/>OpenAI · default: dall-e-3 (3 native sizes, no crop)<br/>cheap mode: gpt-image-1 + Sharp center-crop"]
        OS["OS shell<br/>file explorer"]
    end

    subgraph App["Local Next.js app — localhost:3000"]
        direction TB

        subgraph UI["UI layer"]
            Editor["Brief Editor<br/>JSON form, pre-loaded example"]
            DropZone["Drop Zone<br/>per-product file drop"]
            DetectedPanel["Detected Assets panel<br/>shows local vs GenAI"]
            LogView["Live Pipeline Log<br/>streamed steps"]
            Grid["Output Grid<br/>row per product · 3 ratio cols<br/>hydrated from manifest"]
            BadgeUI["Compliance Badges<br/>OK / WARN / FAIL + drill-in"]
            RevealBtn["Reveal in folder<br/>per-run action"]
        end

        subgraph API["API routes"]
            UploadAPI["POST /api/upload<br/>(slug + canonical ext)"]
            DetectedAPI["GET /api/detected-assets"]
            GenerateAPI["POST /api/generate<br/>(NDJSON stream)"]
            BrandsAPI["GET /api/brands<br/>(brand selector list)"]
            BrandDetailAPI["GET /api/brands/[slug]<br/>(union banned-words + logo variants)<br/>+ GET /api/brands/[slug]/logos/[id]<br/>(safeJoin proxy — not a static tree)"]
        end

        subgraph Actions["Server actions"]
            RevealAction["revealOutputFolder(absPath)<br/>execFile · path-validated against ROOTS.outputs"]
        end

        subgraph Engine["Pipeline Engine"]
            Orchestrator["Run Orchestrator<br/>steps + streaming"]
            Resolver["Asset Resolver<br/>find or generate"]
            PromptBuilder["Prompt Builder<br/>brand voice + product overrides"]
            Resizer["Image Processor<br/>Sharp · 1:1 · 9:16 · 16:9"]
            Compositor["Text Compositor<br/>localized message overlay"]
            Checker["Compliance Checker<br/>logo · palette · banned words"]
            Reporter["Reporter<br/>report.json: counts{requested · succeeded · failed ·<br/>generated · reused · flagged} · creatives[] · errors[]"]
        end
    end

    Editor -->|brief| GenerateAPI
    Editor -->|brand list| BrandsAPI
    Editor -->|brand detail · banned-words union · logo variants| BrandDetailAPI
    Editor -->|cap + mode| CapAPI
    BrandsAPI -->|enumerates| BrandProfile
    BrandDetailAPI -->|reads + Zod-validates| BrandProfile
    GenerateAPI -->|loadBrandProfile · integrity check| BrandProfile
    DropZone -->|file| UploadAPI
    UploadAPI -->|writes| Inputs
    DetectedPanel -->|polls| DetectedAPI
    DetectedAPI -->|reads| Inputs
    GenerateAPI --> Orchestrator
    Orchestrator --> Resolver
    Resolver -->|lookup| Inputs
    Resolver -.->|on miss| PromptBuilder
    PromptBuilder -->|reads| BrandProfile
    PromptBuilder -.->|prompt| GenAI
    GenAI -.->|hero| Resolver
    Resolver --> Resizer
    Resizer --> Compositor
    Compositor -->|reads font/logo| BrandProfile
    Compositor --> Checker
    Compositor --> Outputs
    Orchestrator -->|writes| BriefFile
    Checker --> Reporter
    Resolver -.->|errors| Reporter
    Compositor -.->|errors| Reporter
    Checker -.->|errors| Reporter
    Reporter --> ReportFile
    Orchestrator -.->|stream| LogView
    Reporter -.->|manifest via NDJSON complete| Grid
    Checker --> BadgeUI
    BadgeUI -.->|click| Grid
    Grid --> RevealBtn
    RevealBtn --> RevealAction
    RevealAction -.->|opens| OS
    OS -.->|browse| Outputs
```

---

## 4. Data flow — one Generate click, end to end

How a single click on **Generate** moves a brief through the system and back to the screen.

> **Concurrency model (D20).** Markets iterate sequentially in the outer loop for deterministic log order; ratios fan out via `Promise.all` per `(product, market)` pair (`par`/`and` block below).
>
> **Failure semantics.** Step-level failures (GenAI error, Sharp error, compliance exception) append to `errors[]` and the run continues — never aborts. The grid hydrates from the manifest delivered in the NDJSON `complete` event, not from a second filesystem read.
>
> **GenAI retry (D31).** Transient failures (`429`, `5xx`, `ETIMEDOUT`/`ECONNRESET`) retry with bounded exponential backoff (3 attempts: 1 s → 4 s → 16 s, ±25% jitter). `Retry-After` is honored, capped at 30 s so a stuck creative can't block the run past D30's 90 s stream-idle window. Non-transient `4xx` (content-policy, schema rejection) does not retry. On exhaustion `errors[].message` carries the upstream failure verbatim: HTTP responses use `<status> <provider error string>`; non-HTTP transport failures (e.g. `ETIMEDOUT`/`ECONNRESET`) use `OpenAI <code>: <message>`. **Provider-swap fallback is out of scope** — aspect-ratio fidelity (D9) and intra-campaign visual consistency (Story 2) outrank provider uptime in a POC; `CAST_GENAI_MODE` is the operator-time toggle, not runtime.
>
> **Run idempotency (D15).** Generate (S1) and Retry (S2′) both clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). Validated through `safeJoin` against the `outputs` ROOT; `SLUG_RE` validates the campaign segment first.

```mermaid
sequenceDiagram
    autonumber
    actor User as Maya / Aaron
    participant UI as Brief Editor
    participant Orc as Run Orchestrator
    participant Res as Asset Resolver
    participant FS as inputs/assets
    participant AI as GenAI API
    participant Img as Resizer + Compositor
    participant Out as /outputs
    participant Chk as Compliance Checker
    participant Rep as Reporter
    participant Log as Live Log + Grid

    User->>UI: edit brief, click Generate
    UI->>Orc: POST brief
    Orc-->>Log: step "run started"
    loop for each product
        Orc->>Res: resolve hero for product
        Res->>FS: look up input asset
        alt asset found (source = local, increments reused)
            FS-->>Res: file path
        else asset missing
            Note over Res,AI: mode = dall-e-3 (default) | gpt-image-1 (cheap)<br/>D31: retry 429/5xx ×3 (1s/4s/16s ±25% jitter)<br/>Retry-After honored ≤ 30s; no provider swap
            Res->>AI: generate hero image
            alt GenAI ok (source = genai, increments generated; cap +1 once)
                AI-->>Res: image bytes
            else GenAI failure (retries exhausted or non-transient 4xx)
                AI-->>Res: error (HTTP status + provider msg preserved)
                Res-->>Rep: push to errors[] · stage: 'genai'
            end
        end
        Res-->>Orc: hero image
        Orc-->>Log: step "asset ready"
        par 1:1
            Orc->>Img: resize + composite (1:1, locale)
            Img->>Out: save creative
            Orc->>Chk: check creative
            Chk-->>Orc: OK / WARN / FAIL
            Orc-->>Log: step "creative ready + badge"
        and 9:16
            Orc->>Img: resize + composite (9:16, locale)
            Img->>Out: save creative
            Orc->>Chk: check creative
            Chk-->>Orc: OK / WARN / FAIL
            Orc-->>Log: step "creative ready + badge"
        and 16:9
            Orc->>Img: resize + composite (16:9, locale)
            Img->>Out: save creative
            Orc->>Chk: check creative
            Chk-->>Orc: OK / WARN / FAIL
            Orc-->>Log: step "creative ready + badge"
        end
    end
    Orc->>Rep: write report.json
    Rep-->>Log: complete event { manifest }
    Log-->>User: grid hydrates from manifest (no second FS read)
    opt user clicks Reveal in folder
        User->>Orc: invoke server action revealOutputFolder(absPath)
        Orc-->>Log: opens outputs/[campaign] in OS shell
    end
    alt run-level failure (uncaught throw outside per-creative tries)
        Orc-->>Log: error event
        Note over User: Failed state S2′ — Edit brief or Retry both clear the campaign output folder before re-running (D15)
    end
```

---

## 5. Compliance flow — Priya's lens

Priya never touches the pipeline; she lives on the output grid. Her flow is a read-and-drill loop on the artifacts the engine already produced.

```mermaid
graph LR
    Done["Run completes"] --> Grid["Output Grid<br/>all creatives + badges"]
    Grid --> Scan{"All green?"}
    Scan -->|yes| Ship["ship"]
    Scan -->|no| Click["click flagged tile"]
    Click --> Detail["Creative Detail<br/>which check failed · why"]
    Detail -.->|open for full detail| ReportFile["report.json<br/>per-creative compliance · errors[]"]
    Detail --> Decide{"fixable in brief?"}
    Decide -->|yes| EditBrief["edit brief<br/>(re-run)"]
    Decide -->|no| Escalate["flag for designer"]
    EditBrief --> Done
```

---

## 6. Story → subsystem coverage

A sanity check that every user-story verb has a home in the system map. **Source** column declares whether a row traces to a user-story verb or a README design decision.

| Verb / capability                                                  | Subsystem that owns it                                                 | Source                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------- |
| edit campaign brief in UI                                          | Brief Editor                                                           | Story 1 (Maya)                               |
| read brand / products / markets / audience / message               | Brief Editor → Run Orchestrator                                        | Story 1                                      |
| drop product photos in UI                                          | Drop Zone → `POST /api/upload`                                         | Story 1                                      |
| see detected vs missing assets                                     | Detected Assets panel → `GET /api/detected-assets`                     | Design addition (supports Story 1 drop verb) |
| pick a brand for this campaign                                     | Brand selector → `GET /api/brands`                                     | Story 1 ("selects Brisa")                    |
| fetch brand detail (union banned-words + logo variants)            | Brand selector → `GET /api/brands/[slug]`                              | Design addition (D11, D21, D27)              |
| select logo variant for the campaign                               | Logo picker → `brief.logoVariant` (cross-validated server-side)        | Design addition (D27)                        |
| look up input assets in `inputs/assets/`                           | Asset Resolver                                                         | Story 1                                      |
| read brand profile (colors, voice, logo, font)                     | Asset Resolver / Prompt Builder / Compositor → `inputs/brands/[brand]/` | Story 1                                      |
| load + integrity-check brand profile                               | Run Orchestrator → `loadBrandProfile` (Zod via `brandProfileSchema`)    | Design addition (flow §4.3 D11)              |
| generate hero image when missing                                   | Prompt Builder → GenAI API                                             | Story 1                                      |
| GenAI mode: `dall-e-3` (default) vs `gpt-image-1` (cheap)          | Asset Resolver / Prompt Builder → GenAI API                            | Design addition (README: GenAI provider)     |
| resize to 1:1, 9:16, 16:9                                          | Image Processor (Sharp)                                                | Story 1                                      |
| composite localized message overlay                                | Text Compositor                                                        | Story 1                                      |
| stream pipeline log in real time                                   | Run Orchestrator → Live Pipeline Log                                   | Story 1 / Story 3                            |
| display output grid in browser (manifest-hydrated)                 | Output Grid ← Reporter manifest (NDJSON `complete`)                    | Story 1 + README (API style)                 |
| save outputs to `outputs/[campaign]/[market]/[product]/[ratio].png` | Image Processor → filesystem                                           | Story 1                                      |
| open output folder / grab files                                    | Reveal in folder → `revealOutputFolder` server action → OS shell      | Story 1 ("opens the output folder")          |
| check logo / colors / prohibited words                             | Compliance Checker                                                     | Story 2 (Priya)                              |
| badge each output OK / WARN / FAIL                                 | Compliance Checker → Badge UI                                          | Story 2                                      |
| drill into flagged creative for full detail                        | Creative Detail → `report.json`                                        | Story 2 ("opens the report")                 |
| write `brief.json`                                                 | Run Orchestrator                                                       | Story 1                                      |
| write `report.json` (counts, creatives[], errors[])                | Reporter                                                               | Story 1 + Story 2                            |
| aggregate step failures into `errors[]` (run never aborts)         | Run Orchestrator → Reporter                                            | Story 1 ("not blocked") + README             |
| run idempotency: clear `outputs/[campaign]/` at run start           | Run Orchestrator (Generate + Retry)                                    | Design addition (D15)                        |

---

_Cast · System Map v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
