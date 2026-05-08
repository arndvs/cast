# Attributes & Screen Requirements — Cast

---

## Step 4 — Modeling the Attributes

All attributes extracted from user stories, the system map, and the flow diagrams.
Organized by entity, then mapped to screens in Step 5.

### Brief

Fields are defined by the canonical Zod `briefSchema` in [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview). Field names and shapes are not restated here — the schema is the single source of truth. Summary:

- `campaign` (slug)
- `brand` (slug — references `inputs/brands/[brand]/`; existence + integrity validated server-side at `/api/generate` entry)
- `products[]` (`min(1)`) — each `{ name, sku, promptOverrides? }`; derived slugs (`slugify(name)`) must be unique within a brief
- `markets[]` — `<region>-<lang>` (validated by `MARKET_RE`; not BCP-47 — BCP-47 is `<lang>-<region>`). Examples: `us-en`, `mx-es`.
- `audience` (string, 1–500 chars)
- `message` — `Record<lang, string>` (locale → copy)
- `ratios[]` — enum subset of `[1x1, 9x16, 16x9]`
- `logoVariant?` — optional id of the logo variant the run uses; cross-validated server-side against the loaded brand's `logos.variants[]`. Absent → falls back to `brandProfile.defaultLogoId`.

### Product

- name
- slug (derived: lowercase, hyphens, validated against `SLUG_RE`)
- sku
- promptOverrides (optional — see [flow-diagrams.md “Implementation primitives”](flow-diagrams.md#43-implementation-primitives))

### Input Asset

- slug (matches product)
- file path (`inputs/assets/[product-slug].ext`)
- extension (resolver looks for `png, jpg, jpeg, webp`)
- found (boolean — detected at page load)

### Hero Image

- product slug
- file path after generation

(`source` is a creative-level field, not a hero-image field — see Output Creative below and [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview).)

### Output Creative

- product slug
- market
- ratio (`1x1`, `9x16`, `16x9`)
- source: `local` | `genai` (per [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview); drives `counts.reused` / `counts.generated`)
- file path: `string | null` — repo-relative on success, `null` on pipeline failure. Successful path shape: `outputs/[campaign]/[market]/[product]/[ratio].png`
- badge: `OK` | `WARN` | `FAIL` (compliance axis only — orthogonal to success/failure)
- compliance checks (logoPresent, bannedWords)

### Compliance Result

- badge: `OK` | `WARN` | `FAIL`
- checks:
  - logoPresent: boolean
  - bannedWords: string[] (flagged terms)

### Brand Profile

Loaded by `loadBrandProfile(brand)` at `/api/generate` entry; validated against `brandProfileSchema` ([flow-diagrams.md §4.3](flow-diagrams.md#brand-profile-schema-contract)). Fields are not restated here — the schema is the single source of truth. Summary:

- slug (matches `brief.brand`)
- brand (`brand.json` — `displayName`, `colors`, optional `tokens`)
- voice (`voice.json` — `tone`, `do`, `dont`, `promptFragments`, `negativePromptFragments`, `moodKeywords`, optional `skuFragments`)
- bannedWords — **union** of `lib/cast/banned-words.ts` defaults (`getDefaultBannedWords()`) and `inputs/brands/[brand]/banned-words.json` (when present); deduped, lowercased. Defaults always apply. Missing brand file is silently skipped — the floor remains in force.
- logoVariants[] (`logos/logos.json` — each `{ id, displayName, path, theme? }`; `path` resolved via `safeJoin` against `inputs/brands/[brand]/logos/`; `theme` is `"light" | "dark"` when present)
- defaultLogoId (`logos.json` `default` — used when `brief.logoVariant` is absent)
- fontPath (absolute, `safeJoin`-validated)
- canVariants[] (optional — `products.json`; each `{ id, sku, file, pose, detail }`)
- backgroundVariants[] (optional — `backgrounds.json`; each `{ id, file, ratio, sku, luminance }`)

Cached in-process for 90 s. Missing directory → `BrandNotFoundError` → `404`. Missing required file → `BrandIncompleteError` → `400`. Schema violation → `BrandInvalidError` → `400`.

### Run Log

- steps (array of: type, stage, slot, message)
- event types: `step`, `asset_resolved`, `creative_ready`, `compliance_result`, `error`, `complete`

### Report (report.json)

Shape is the same object delivered in the `complete` event's `manifest`. See [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview) for the canonical example. Includes `startedAt` / `completedAt` (optional ISO-8601 timestamps).

### Output Creative (additional fields)

- `duration` — optional non-negative number: elapsed seconds for that creative's pipeline pass (resolve → write). Omitted when the creative fails before timing is recorded.

### Upload Preview (client-only)

- productSlug
- file (`File` object)
- preview (`string` — object URL for thumbnail)
- Held in reducer state (`state.uploads`); not persisted server-side.

### Logo Variant

- id (slug-format)
- displayName
- path (safeJoin-validated, absolute on local fs)
- theme (optional: `"light"` | `"dark"`)
- Loaded from `inputs/brands/[brand]/logos/logos.json`; served via `GET /api/brands/[slug]/logos/[id]` proxy.

---

## Step 5 — Screen Requirements

For each screen: what the user **gets** (inform), what they **can do** (engage), how they **get to the next screen** (invite).

Using the Inform → Engage → Invite framework.

---

### S1 · Brief Editor (state: Editing)

**Inform — what the user sees:**

- Two editing modes: structured **Form** view (default) and raw **JSON** view with toggle switch
- Form view: campaign name, brand, audience, message fields surfaced as readable form
- JSON view: raw brief JSON with syntax highlighting, Zod `briefSchema` validation, parse error display, Apply/Reset buttons. `replaceBrief` action swaps the entire brief from parsed JSON.
- GenAI mode badge — reads `NEXT_PUBLIC_CAST_GENAI_MODE` (default | cheap) at build time. Read-only; surfaces which model the run will hit before Generate fires. No runtime endpoint — the env is inlined at build, so the badge renders without a network round-trip.
- Brand selector — dropdown listing every directory under `inputs/brands/` (slug + display name from `GET /api/brands`). Required; one brand per brief. Demo ships two profiles (`brisa`, `volt`) modeling sub-brands of the fictional Onda Beverages portfolio. On selection, S1 fetches `GET /api/brands/[slug]` to populate palette swatches, voice preview, the **union banned-words list** (lib defaults + brand file), the logo picker, and the prompt preview shown elsewhere on the screen.
- Markets field — typeahead input accepting any conforming `<region>-<lang>` value; suggestion list seeds common values (`us-en`, `mx-es`, `de-de`, `jp-ja`)
- Ratios picker — three pill toggles (`1:1`, `9:16`, `16:9`); default all checked; at least one must remain selected
- Products list — each row shows: name, sku, slug preview
- Per-product drop zone (shadcn-dropzone) — drag target visible
- Detected Assets panel — per-product status:
  - found: `brisa-citrus.png` — using local asset
  - missing: no asset found — will generate via GenAI
- Logo picker — radio grid beneath the brand selector, populated from `GET /api/brands/[slug]` `logos.variants[]`. Each option renders the variant PNG (served by `GET /api/brands/[slug]/logos/[id]`) on a checkered alpha background plus its `displayName`. Default selected = `logos.default`. Selection writes `brief.logoVariant`. One choice per campaign — used by every creative the run produces. Auto-selection by hero luminance is v2 ([flow-diagrams.md §8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc)).
- Read-only prompt preview — shows the prompt that will hit OpenAI per missing product (assembled from brand `voice.json` + product overrides)
- Pre-flight banned-words check — always active. The selected brand's union list (`lib/cast/banned-words.ts` defaults + `inputs/brands/[brand]/banned-words.json` if present) is fetched via `GET /api/brands/[slug]`; if any locale's `message` contains a banned word, the Generate button is disabled with an inline warning naming the term and locale. The defaults floor (violence, hate, NSFW, weapons, drugs, self-harm) applies to every brand — a brand without `banned-words.json` still gets the floor; the indicator does not have a "checks skipped" state. Pre-flight (S1) and server-side compliance (per-creative) call the **same** `containsBannedWord` symbol from `lib/cast/banned-words.ts` against the same union list — see [flow-diagrams.md "Single-source rule"](flow-diagrams.md#compliance--banned-words).
- Generate button (enabled when brief is valid + no banned-word violations)
- Validation badge on brief (valid / invalid)

**Engage — what the user can do:**

- Toggle between Form and JSON editing modes
- Edit structured fields (campaign name, message, region, audience) directly in Form mode
- Edit raw JSON in JSON mode, validate with Apply, or Reset to discard changes
- Add / remove products (direct or via `CatalogAddDropdown` for remaining brand catalog items)
- Drag and drop a product photo onto a product row
- Remove an uploaded photo
- Add/remove markets via `MarketsTypeahead` (cmdk-powered, supports custom `MARKET_RE` values)
- Watch the Detected Assets panel update on brief edit or upload
- Select a brand from the brand picker sidebar (color swatches shown per brand)
- Select a logo variant from the logo picker
- Expand per-product prompt preview to see the assembled GenAI prompt
- Click Generate

**Invite — how they move to the next screen:**

- Click Generate → transitions to Running (S2)
- Validation error on brief → stays on S1 with inline error
- Missing/invalid brand → `MissingBrandBanner` shows diagnostic (notFound/incomplete/invalid) with available slugs

**Key components:** `BriefEditorFormView` (structured form), `BriefEditorSidebar` (brand picker + logo grid + detected assets), `BriefProductRow` (per-product row with drop zone + prompt preview), `CatalogAddDropdown`, `MarketsTypeahead`, `MissingBrandBanner`

---

### S2 · Run View (state: Running)

**Inform — what the user sees:**

- **Structured per-product view** (`JobRunnerView`) — default production view:
  - Per-product `JobVariantRow`: collapsed shows product name + compact market status indicators; expanded shows market-grouped `JobCreativeBadge` badges
  - Creative-level progress bar (succeeded + failed / total requested)
  - Live elapsed timer — ticking seconds from `state.runStartedAt`
- **Collapsible raw log** — the original flat NDJSON event log is still accessible in a collapsible section:
  - `step` → grey log line showing the pipeline `stage` and `slot` (product × market × ratio)
  - `asset_resolved` → green/amber line
  - `creative_ready` → cyan line
  - `compliance_result` → badge line
  - `error` → red line: error message with stage and optional slot
- Brief is locked — editor not visible, shows campaign name only
- Cancel button — aborts the fetch via `AbortController` (`cancelRef`), dispatches `goto-edit`

**Streaming render mode:** the log and progress indicator update **incrementally** on each NDJSON event. The output grid is **not** rendered yet — it hydrates only on the terminal `complete` event so all tiles appear together with their final compliance badges. This avoids a flicker of partially-resolved tiles and keeps S2 → S3 as a clean state transition.

**Engage — what the user can do:**

- Watch the structured run view (expand/collapse product rows)
- Toggle raw log visibility
- Cancel the run

**Invite — how they move to the next screen:**

- `complete` event received → transitions to Complete (S3)
- `error` event received → transitions to Failed (S2′)
- Cancel clicked → transitions to Editing (S1)
- Stream closes without a terminal `complete` or `error` event (network drop, server crash) → treated as a stream-level failure → transitions to Failed (S2′). Mirrors [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview).
- Stream idle for 90 s with no events → client aborts the `fetch` via `AbortController` and synthesizes a terminal `error` event with `stage: 'stream'` → transitions to Failed (S2′). Prevents an indefinite spinner on a hung GenAI call or mid-stream server crash.

---

### S2′ · Failed State (state: Failed)

**Inform — what the user sees:**

- Error message from the pipeline (human-readable)
- Which step failed (from the log)
- Log up to the failure point still visible
- Two recovery actions clearly presented

**Engage — what the user can do:**

- Click "Edit brief" — go back to S1 to fix the brief and re-generate

**Note:** There is no direct "Retry" from the failed state. Recovery always routes through S1 (Editing) — the user clicks "Edit brief" (`goto-edit`), then clicks "Generate" (`generate`) from S1. This two-step path ensures the user can review and adjust the brief before spending another GenAI call.

**Run idempotency:** Both **Generate** (from S1) and re-runs after failure clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). `brief.json` and `report.json` are run-scoped products of the run, not preserved artifacts — the recursive clear ensures a failed run never leaves a stale `report.json` on disk claiming success. End state of any successful run is invariant under retry; on mid-run failure the partial creatives plus the new `brief.json` describe the current attempt and the prior `report.json` is gone. Cleared paths are validated through `safeJoin` against the `outputs` ROOT before any unlink call, and the campaign slug is regex-validated (`SLUG_RE`) before it enters `safeJoin`.

**Invite — how they move to the next screen:**

- Edit brief → Editing (S1)

---

### S3 · Output Grid (state: Complete)

**Inform — what the user sees:**

- **Results header** (`ResultsHeader`) — brand/campaign breadcrumbs, run status badge (Complete/Failed), time range (`startedAt` → `completedAt`), action buttons: Download brief.json, Download report.json, Reveal in folder, Export to Dropbox
- **Summary stat cards** (`CreativeCountsSummaryCard`) — Total, Complete, Failed, Avg Time cards with tone coloring (ok/warn/bad). Driven by canonical `counts` from the manifest.
- **Filter toolbar** (`ResultsToolbar`) — four filter dimensions: status (all/OK/WARN/FAIL/failed), ratio (all/1:1/9:16/16:9), market (dynamic from manifest), free-text search. Filter state is local.
- **Grid / list view toggle** — tile grid (default) or table list (`ResultsListView`). List view columns: checkbox, thumbnail, product, market (with country flag emoji), ratio, source, logo, status badge, duration, detail button.
- **Market-grouped grid** — creatives grouped by market via `groupCreativesByMarket`, with market headers showing locale code + flag emoji.
- **Batch selection** — multi-select checkboxes on each creative tile/row with select-all toggle. Selection state (`Set<string>`) enables future batch actions.
- Each cell: generated image (served by `GET /api/outputs/[...path]`) + compliance badge (OK / WARN / FAIL)
- **Failed tile rendering** — cells where `creatives[].path === null` render as a red placeholder with the failing pipeline `stage` label (e.g. "genai timeout", "resize failed"). Distinct from a compliance FAIL badge: pipeline error and compliance violation are orthogonal axes. The `compliance` field is stage-dependent: failures before the `compliance` stage (`resolve | genai | resize | compose`) omit it; failures at or after `compliance` may carry the result through. The grid never renders a compliance badge for a failed tile — the red placeholder + stage label takes its place.
- Source indicator (`CreativeSourcePill`) — "local" or "genai" per creative
- Absolute output path as a copyable code block
- "Reveal in file explorer" button
- "Edit brief & re-run" button

**Engage — what the user can do:**

- Filter creatives by status, ratio, market, or search text
- Toggle between grid and list view
- Select individual creatives or select all (batch)
- Click any creative tile → opens Creative Detail (S4)
- Click any flagged tile (WARN / FAIL badge) → opens Creative Detail (S4) in compliance mode
- Click any failed tile (red placeholder, `path === null`) → opens Creative Detail (S4) in error mode
- Download brief.json or report.json
- Click "Reveal in file explorer" → server action opens OS explorer
- Export to Dropbox (when `NEXT_PUBLIC_DROPBOX_APP_KEY` is configured)
- Copy the absolute output path
- Click "Edit brief & re-run" → back to Editing (S1)

**Invite — how they move to the next screen:**

- Click creative tile → DetailOpen (S4 modal)
- Click flagged tile (WARN / FAIL) → DetailOpen (S4 modal · compliance mode)
- Click failed tile (red placeholder, `path === null`) → DetailOpen (S4 modal · error mode)
- Click reveal → S5 OS handoff
- Click edit & re-run → Editing (S1)

**Key components:** `CreativeOutputGrid`, `ResultsHeader`, `ResultsToolbar`, `ResultsListView`, `CreativeCountsSummaryCard`, `CreativeSourcePill`, `CreativeFilterSelect`, `CreativeMetaGrid`, `ComplianceBadgePill`

---

### S4 · Creative Detail (state: DetailOpen — modal over S3)

Dual-mode modal: **compliance violation** (badge ∈ WARN / FAIL, path is a real file) or **pipeline error** (`creatives[].path === null`, has a corresponding `errors[]` entry). Mode is routed by `path === null`.

**Inform — what the user sees (compliance mode):**

- Creative preview (full image)
- Product name + market + ratio label
- Compliance badge (WARN or FAIL)
- Per-check results:
  - Logo present: pass / fail
  - Brand colors: pass / fail (with found vs expected swatches if failed)
  - Banned words: pass / fail (with flagged terms listed if failed)

**Inform — what the user sees (error mode):**

- Red placeholder preview (no image on disk)
- Product name + market + ratio label (the failure coordinates)
- Pipeline `stage` from the matching `errors[]` entry — closed enum from [§4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview): `resolve | genai | resize | compose | compliance | write`
- Human-readable `message` from the same `errors[]` entry (e.g. "OpenAI request timed out after 60s")
- Per-check results: shown only when `errors[].stage === 'write'` (where compliance has already completed and the failure was on PNG write). Stages `resolve | genai | resize | compose` precede compliance, so no compliance object exists for those failures; stage `compliance` itself produced no result. The `compliance` field is therefore omitted on every failed creative except `write`-stage failures — the manifest shape encodes this directly.

**Engage — what the user can do:**

- Read the detail
- Copy the creative's OS-absolute path to clipboard (`CopyPathButton` → `resolveCreativeAbsolutePath` server action)
- Close the modal

**Invite — how they move to the next screen:**

- Close → back to Complete (S3)
- (No direct action from S4 — Priya / Maya read, then decide in S3)

**Key component:** `CreativeDetailDialog` (Radix Dialog), `CopyPathButton`, `ComplianceChecksList`, `ComplianceBadgePill`

---

### S5 · Reveal in File Explorer (action, not a screen)

**Not a screen — a server action triggered from S3.**

**What it does:**

- Server action `revealOutputFolder({ campaign })` reveals the generated output folder via the OS:
  - macOS: `open`
  - Windows: `explorer.exe`
  - Linux: `xdg-open`
- **Path derivation:** The campaign slug is validated against `SLUG_RE` and the absolute path is derived internally via `safeJoin("outputs", campaign)`. The caller never passes an arbitrary path.
- **Process model:** use `execFile`-style API with explicit argv (`execFile(bin, [resolvedPath])`). Do **not** build the command via shell string interpolation (`exec`, `spawn` with `shell: true`, or template literals).
- Fallback: absolute path is already visible as a copyable code block in S3.

**Inform:** The copyable path on S3 is the primary affordance — always visible, always works.
**Engage:** "Reveal in file explorer" button — one click.
**Invite:** OS takes over — user is now in Finder/Explorer looking at their output files.

---

## Coverage — every story verb mapped to a screen attribute

| Story verb              | Screen  | Attribute that covers it             |
| ----------------------- | ------- | ------------------------------------ |
| open app                | S1      | Pre-loaded example brief             |
| edit brief              | S1      | JSON editor + structured fields      |
| selects brand           | S1      | Brand selector (drives palette / voice / banned-words) |
| select logo variant     | S1      | Logo picker (radio grid, fed by `GET /api/brands/[slug]` `logos.variants[]`; writes `brief.logoVariant`) |
| drop product photos     | S1      | Per-product drop zone                |
| confirm assets detected | S1      | Detected Assets panel                |
| sees GenAI mode         | S1      | GenAI mode badge (reads `NEXT_PUBLIC_CAST_GENAI_MODE` build-time env) |
| click Generate          | S1      | Generate button (invite)             |
| toggle form / JSON mode | S1      | Form ↔ JSON toggle, Zod validation   |
| add product from catalog| S1      | CatalogAddDropdown                   |
| search/add markets      | S1      | MarketsTypeahead (cmdk)              |
| preview prompt          | S1      | Expandable per-product prompt preview|
| watch pipeline log      | S2      | Structured run view + collapsible raw log |
| cancel run              | S2      | Cancel button → goto-edit            |
| recover from failure    | S2′     | Error message + Edit Brief button    |
| review output grid      | S3      | Market-grouped creative grid         |
| filter creatives        | S3      | ResultsToolbar (status/ratio/market/search) |
| toggle grid/list view   | S3      | View mode toggle                     |
| select creatives        | S3      | Batch selection checkboxes           |
| read compliance badges  | S3      | Per-tile badge (OK / WARN / FAIL)    |
| click flagged tile      | S3      | Tile onClick → S4 modal (compliance mode) |
| view pipeline error detail | S3 → S4 | Failed tile (red placeholder, `path === null`) → S4 error mode (`stage` + `message` from `errors[]`) |
| read compliance detail  | S4      | Per-check results + creative preview |
| copy creative path      | S4      | CopyPathButton → resolveCreativeAbsolutePath |
| reveal output folder    | S3 → S5 | Server action + copyable path        |
| copy output path        | S3      | Copyable code block                  |
| download brief/report   | S3      | Download buttons in ResultsHeader    |
| export to Dropbox       | S3      | Dropbox Saver SDK export             |
| narrate demo            | S2 + S3 | Live log + grid + badges             |

Every verb has a screen and a named attribute. Nothing is floating.


