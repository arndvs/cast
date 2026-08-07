# Attributes & Screen Requirements — Cast (v2)

> v2 adds three new entities (Persona, PerformanceRecord, FatigueSignal), updates existing entities with new fields (ApprovalStatus, CostRecord, ImageMetadata on Output Creative), adds two new screens (S6 Performance Dashboard, S7 Fatigue Report), and updates S1 and S3 with the persona typeahead, cost estimate, and approval workflow. S2, S2′, S4, S5 are unchanged and not restated here.

---

## Step 4 — Modeling the Attributes (v2)

### Brief (updated)

All fields from v1 are preserved. New in v2:

- `personaId?` — optional slug referencing a `cast-personas` Qdrant entry. When present, `persona.promptFragment` is injected into the GenAI prompt instead of the raw `audience` string. When absent, `audience` free-text is used as before. Cross-validated server-side: unknown `personaId` → `400`.
- `audience` — unchanged (1–500 chars). Still required. When `personaId` is set, audience is pre-filled from `persona.displayName` in the UI and `persona.promptFragment` is used in the prompt. Free-text mode preserved: clearing the persona selection restores raw audience input.

### Persona *(new)*

Stored in Qdrant `cast-personas` collection. Loaded via `GET /api/personas`.

- `id` — slug format, unique per brand
- `brand` — slug (matches `inputs/brands/[brand]/`)
- `market?` — optional `<region>-<lang>` (persona may be brand-wide or market-specific)
- `displayName` — human label shown in the typeahead (e.g. "Urban Wellness Seeker")
- `age?` — age range string (e.g. "25–34")
- `interests[]` — array of interest tags
- `motivators[]` — what drives this persona to purchase
- `promptFragment` — the string injected into the GenAI prompt in place of raw audience text (e.g. "health-conscious urban professional who values clean ingredients and sustainability")
- `performanceScore` — nullable float; aggregated from all creatives linked to this persona via `personaId`; `null` until performance data is imported

### Output Creative (updated)

All v1 fields preserved. New in v2:

- `status` — `"pending" | "approved" | "rejected"` (approval workflow). Default: `"pending"`. Written to Qdrant `cast-creatives` payload and `[ratio].metadata.json`.
- `rejectionReason?` — string; populated when `status === "rejected"`; surfaced in Creative Detail modal
- `personaId?` — the persona used when generating this creative (if any); enables per-persona performance aggregation
- `estimatedCost` — USD float; the estimated generation cost for this specific creative (`costPerImage` based on model + ratio)
- `fatigueScore?` — nullable float; computed by `fatigue.ts` post-import; `null` until performance data exists
- `fatigueRisk?` — boolean; `true` when `fatigueScore > CAST_FATIGUE_THRESHOLD` (default 45)
- `performanceScore?` — nullable float; patched by `POST /api/performance`; `null` until import

### Image Metadata *(new)*

Written alongside each generated creative as `[ratio].metadata.json` in Azure cast-outputs. Qdrant vectorization into `cast-creatives` is planned but not yet implemented.

**Fields in `imageMetadataSchema` (written to `.metadata.json` sidecar):**

- `campaign` — slug
- `brand` — slug
- `product` — slug
- `market` — `<region>-<lang>`
- `ratio` — `1x1 | 9x16 | 16x9`
- `source` — `"local" | "genai"`
- `description` — AI-generated 1–2 sentence description of the creative (gpt-4o-mini)
- `tags[]` — AI-extracted visual tags
- `colors[]` — dominant colors detected in the image
- `mood[]` — mood/atmosphere tags
- `generatedAt` — ISO 8601 timestamp
- `promptUsed?` — the GenAI prompt string (only when `source === "genai"`)
- `model` — the GenAI model used (nullable)
- `revisedPrompt` — revised prompt returned by the model (nullable)

**v2 / Qdrant-only (not yet written to `.metadata.json` sidecar):**

- `personaId?` — linked persona (when `brief.personaId` was set)
- `status` — approval status (mirrors creative)
- `estimatedCost` — USD float
- `performanceScore` — nullable float (patched post-import)
- `fatigueScore` — nullable float (computed post-import)

### Performance Record *(new)*

Input shape for `POST /api/performance`. Represents one creative's performance data from an ad platform export.

- `campaign` — slug (matches existing campaign)
- `brand` — slug
- `product` — slug
- `market` — `<region>-<lang>`
- `ratio` — `1x1 | 9x16 | 16x9`
- `impressions` — non-negative integer
- `clicks` — non-negative integer
- `ctr` — non-negative float (clicks / impressions)
- `conversions?` — optional non-negative integer
- `spend?` — optional non-negative USD float
- `dateRange` — `{ from: ISODate, to: ISODate }`
- `performanceScore` — computed: `normalize(ctr × 0.6 + conversionRate × 0.4)`; written to Qdrant payload

### Fatigue Signal *(new)*

Output shape of `GET /api/fatigue-report`. Represents one fatigued creative with refresh recommendations.

- `creative` — the fatigued creative's metadata (product, market, ratio, path, performanceScore)
- `fatigueScore` — float (`daysSinceGeneration + impressions/1000 - ctr×100`)
- `daysSinceGeneration` — integer
- `impressions` — integer (from most recent performance import)
- `recommendedSeeds[]` — top 1–3 highest-performing creatives from the same brand/market, used as generation seeds for the refresh run

### Cost Record *(new)*

Appended to `report.json` manifest as `costs`.

- `estimated` — USD float (computed before pipeline runs: `products × markets × ratios × costPerImage`)
- `actual?` — USD float (computed after pipeline completes from actual API responses)
- `currency` — `"USD"` (literal)
- `model` — `"dall-e-3" | "gpt-image-1"` (from `CAST_GENAI_MODE`)
- `creativeCount` — total creatives attempted (for per-creative cost reconciliation)

### Report (report.json) (updated)

All v1 fields preserved. New in v2:

- `costs` — `CostRecord` (see above)
- Each `creatives[]` entry now carries: `status`, `personaId?`, `estimatedCost`, `fatigueScore?`, `performanceScore?`

---

## Step 5 — Screen Requirements (v2)

### S1 · Brief Editor (state: Editing) — updated

**New in v2 (additions to existing S1):**

**Inform — new elements:**

- **Persona typeahead** — audience field becomes a combobox. On focus, queries `GET /api/personas?brand=[slug]&market=[market]` and shows matching personas as selectable options. Each option shows `displayName` + `performanceScore` (if available, shown as a small performance indicator). Selecting a persona sets `brief.personaId` and pre-fills the audience display field with `persona.displayName`. Free-text mode: clearing the selection removes `personaId` and exposes raw text input as before. Fallback: if no personas exist for the brand yet, the field behaves exactly as v1 free-text input.
- **Cost estimate** — shown below the Generate button, computed client-side before any API call: `products.length × markets.length × ratios.length × costPerImage` where `costPerImage` is `$0.04` (dall-e-3) or `$0.005` (gpt-image-1) based on `NEXT_PUBLIC_CAST_GENAI_MODE`. Updates live as brief fields change. Label: "Estimated cost: ~$X.XX". Does not block Generate.

**Engage — new actions:**

- Search and select a persona from the typeahead
- Clear persona selection to return to free-text audience mode
- Watch cost estimate update as products/markets/ratios change

**Invite — unchanged.**

**Key new components:** `PersonaTypeahead` (cmdk-powered combobox, queries `/api/personas`), `CostEstimate` (client-side computed, reactive to brief state)

---

### S3 · Output Grid (state: Complete) — updated

**New in v2 (additions to existing S3):**

**Inform — new elements:**

- **Approval status badges** — each creative tile carries a second badge axis: `pending` (grey ring), `approved` (green ring), `rejected` (red ring). Orthogonal to compliance badge (OK/WARN/FAIL). A creative can be `approved` with a compliance `WARN` — the two axes are independent.
- **Fatigue risk indicator** — when `creative.fatigueRisk === true`, a small flame icon appears on the tile corner. Only visible after performance data has been imported. Tiles without performance data show neither indicator nor absence indicator.
- **Run cost summary** — `ResultsHeader` now shows `costs.estimated` and `costs.actual` (when available) alongside the existing summary stats. Format: "Estimated: $X.XX · Actual: $Y.YY".
- **Approval summary** — summary bar adds `N approved · N rejected · N pending` counts (computed from manifest).

**Engage — new actions:**

- **Approve a creative** — click the approval action on a tile (thumb-up icon or "Approve" button in tile hover state) → `PATCH /api/creatives/[id]/status { status: "approved" }` → tile updates to approved ring immediately (optimistic update, rollback on error)
- **Reject a creative** — click reject action → rejection reason dialog opens → submit → `PATCH /api/creatives/[id]/status { status: "rejected", reason: "..." }` → tile updates to rejected ring
- **Batch approve** — select multiple tiles via batch selection checkboxes → "Approve selected" action in toolbar → batch PATCH
- **Navigate to Performance Dashboard** — "View performance" link in ResultsHeader → S6
- **Navigate to Fatigue Report** — "Fatigue report" link (visible only when fatigued creatives exist) → S7

**Invite — additions:**

- "View performance" → S6 (Performance Dashboard)
- "Fatigue report" → S7 (Fatigue Report)

**Key new components:** `ApprovalBadgePill` (pending/approved/rejected), `FatigueRiskIcon`, `ApprovalRejectDialog` (reason input), `CostSummaryRow`

---

### S6 · Performance Dashboard *(new)*

**State: PerformanceDash (separate route `/performance` or tab on S3)**

**Inform — what the user sees:**

- **Brand + market selector** — filter by brand and market. Pre-filled from last run context.
- **Date range picker** — "Last 30 days" default (matching the brief's "Meta Ads → Last 30 Days → view best performing" framing)
- **Top-performing creatives grid** — creatives ranked by `performanceScore` DESC, fetched from `GET /api/top-creatives?brand=...&market=...&days=30`. Each tile shows: creative thumbnail (served via `GET /api/outputs/[...path]`), product name, market, ratio, `performanceScore` as a percentage bar, `ctr` %, `conversions` count, `spend` USD, `impressions` count.
- **Cost tracking panel** — per-campaign cost summary: total spend on generation (`costs.actual` summed across runs), total ad spend imported, implied cost-efficiency ratio.
- **Persona performance table** — personas ranked by aggregated `performanceScore` across their linked creatives. Columns: persona display name, brand, market, linked creative count, avg CTR, avg conversions, performance score.
- **Empty state** — when no performance data has been imported yet: "No performance data yet. Import your Meta Ads export to see which creatives perform best." with a link to the import flow.

**Engage — what the user can do:**

- Change brand / market / date range filters → grid updates
- Click any creative tile → opens Creative Detail (S4) with full performance data visible
- Click "Import performance data" → opens import dialog (CSV/JSON upload → `POST /api/performance`)
- Click "Connect Meta Ads" → stub: shows "Coming soon — provider interface ready" with Meta API requirements listed
- Click any persona row → filtered view showing only that persona's creatives ranked by performance

**Invite — how they move:**

- Click creative tile → S4 (Creative Detail)
- "View fatigue report" button → S7
- "Generate refresh" button → S1 (Brief Editor pre-populated with top-performing creatives as seeds)

**Key components:** `TopCreativesGrid`, `PersonaPerformanceTable`, `PerformanceImportDialog`, `CostEfficiencyPanel`, `ProviderConnectStub`

---

### S7 · Fatigue Report + Refresh Recommendations *(new)*

**State: FatigueDash (separate route `/fatigue` or accessible from S3 and S6)**

**Inform — what the user sees:**

- **Brand + market selector** — same as S6, pre-filled from context.
- **Fatigue threshold indicator** — current threshold value (`CAST_FATIGUE_THRESHOLD`, default 45) with a brief explanation: "Creatives scoring above this threshold are flagged for refresh. Score = days since generation + (impressions / 1000) − (CTR × 100). Higher = more fatigued."
- **Fatigued creatives list** — ranked by `fatigueScore` DESC. Each row shows: creative thumbnail, product, market, ratio, `fatigueScore` (large, color-coded: amber ≥ threshold, red ≥ threshold × 1.5), `daysSinceGeneration`, `impressions`, `ctr` %, last performance import date.
- **Refresh recommendations panel** — for each fatigued creative, shows the top 1–3 highest-performing creatives from the same brand/market as recommended generation seeds. Each seed shows thumbnail + performance score.
- **Empty state (no performance data)** — "Fatigue scores require performance data. Import a Meta Ads export from the Performance Dashboard to enable fatigue detection."
- **Empty state (no fatigued creatives)** — "No creatives above the fatigue threshold for this brand/market. Check back after your next performance import."

**Engage — what the user can do:**

- Change brand / market filters
- Click any fatigued creative → S4 (Creative Detail)
- Click "Regenerate with variation" on a fatigued creative → navigates to S1 with brief pre-populated: same brand, same market, same products, `seeds[]` attached as context for the prompt builder (top-performing creatives from that brand/market used as style references in the GenAI prompt)
- Click "Refresh all fatigued" → batch action: opens S1 with a multi-product brief covering all fatigued products in the selected market
- Adjust fatigue threshold via inline input (updates `CAST_FATIGUE_THRESHOLD` in config, re-ranks list)
- Trigger manual fatigue score recalculation: "Recalculate scores" → `POST /api/fatigue/refresh` → list re-renders

**Invite — how they move:**

- Click fatigued creative → S4 (Creative Detail)
- "Regenerate with variation" → S1 (seeded Brief Editor)
- "View performance" → S6 (Performance Dashboard)

**Key components:** `FatigueCreativeList`, `RefreshRecommendationCard`, `FatigueScoreBar`, `SeededBriefAction`, `ThresholdAdjuster`

---

## Coverage — every story verb mapped to a screen attribute (v2 complete)

| Story verb | Screen | Attribute that covers it |
| --- | --- | --- |
| open app | S1 | Pre-loaded example brief |
| edit brief | S1 | Form + JSON editor |
| select brand | S1 | Brand selector |
| select persona | S1 | PersonaTypeahead (combobox → `/api/personas`) |
| see cost estimate | S1 | CostEstimate (reactive, below Generate) |
| select logo variant | S1 | Logo picker |
| drop product photos | S1 | Per-product drop zone |
| confirm assets detected | S1 | Detected Assets panel |
| see GenAI mode | S1 | GenAI mode badge |
| click Generate | S1 | Generate button |
| toggle form / JSON mode | S1 | Form ↔ JSON toggle |
| add product from catalog | S1 | CatalogAddDropdown |
| search / add markets | S1 | MarketsTypeahead |
| preview prompt | S1 | Expandable per-product prompt preview |
| watch pipeline log | S2 | Structured run view + collapsible raw log |
| cancel run | S2 | Cancel button |
| recover from failure | S2′ | Error message + Edit / Retry |
| review output grid | S3 | Market-grouped creative grid |
| filter creatives | S3 | ResultsToolbar |
| toggle grid / list view | S3 | View mode toggle |
| select creatives (batch) | S3 | Batch selection checkboxes |
| read compliance badges | S3 | ComplianceBadgePill (OK / WARN / FAIL) |
| read approval status | S3 | ApprovalBadgePill (pending / approved / rejected) |
| approve creative | S3 | Approve action → `PATCH /api/creatives/[id]/status` |
| reject creative with reason | S3 | ApprovalRejectDialog → `PATCH` |
| see fatigue risk | S3 | FatigueRiskIcon on tile |
| see run cost | S3 | CostSummaryRow in ResultsHeader |
| click flagged tile | S3 → S4 | Compliance mode |
| view pipeline error detail | S3 → S4 | Error mode (`path === null`) |
| read compliance detail | S4 | ComplianceChecksList |
| copy creative path | S4 | CopyPathButton |
| reveal output folder | S3 → S5 | Server action + copyable path |
| copy output path | S3 | Copyable code block |
| download brief / report | S3 | Download buttons in ResultsHeader |
| export to Dropbox | S3 | Dropbox Saver SDK |
| view top-performing creatives | S6 | TopCreativesGrid (ranked by performanceScore) |
| import performance data | S6 | PerformanceImportDialog → `POST /api/performance` |
| see persona performance | S6 | PersonaPerformanceTable |
| see cost efficiency | S6 | CostEfficiencyPanel |
| view fatigued creatives | S7 | FatigueCreativeList (ranked by fatigueScore) |
| see refresh recommendations | S7 | RefreshRecommendationCard (seeds[]) |
| trigger seeded refresh | S7 → S1 | SeededBriefAction → pre-populated Brief Editor |
| recalculate fatigue scores | S7 | "Recalculate scores" → `POST /api/fatigue/refresh` |
| narrate demo | S2 + S3 | Live log + grid + badges |
| call Cast via API (no UI) | API routes | `POST /api/generate` directly |
| call Cast via MCP | `mcp.ts` | castMcpTools{} stubs |

Every verb has a screen, an API endpoint, or a named system action. Nothing is floating.
