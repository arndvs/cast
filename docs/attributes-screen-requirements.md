# Attributes & Screen Requirements — Cast

### Local Next.js App · POC · v1

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
- `logoVariant?` — optional id of the logo variant the run uses; cross-validated server-side against the loaded brand's `logos.variants[]`. Absent → falls back to `brandProfile.defaultLogoId` (D27).

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

(`source` is a creative-level field, not a hero-image field — see Output Creative below and [flow-diagrams.md §4.2 / D3](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview).)

### Output Creative

- product slug
- market
- ratio (`1x1`, `9x16`, `16x9`)
- source: `local` | `genai` (per [flow-diagrams.md §4.2 / D3](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview); drives `counts.reused` / `counts.generated`)
- file path: `string | null` — repo-relative on success, `null` on pipeline failure ([D19](flow-diagrams.md#appendix-a--design-decision-register)). Successful path shape: `outputs/[campaign]/[market]/[product]/[ratio].png`
- badge: `OK` | `WARN` | `FAIL` (compliance axis only — orthogonal to success/failure)
- compliance checks (logoPresent, colorsOk, bannedWords)

### Compliance Result

- badge: `OK` | `WARN` | `FAIL`
- checks:
  - logoPresent: boolean
  - colorsOk: boolean
  - bannedWords: string[] (flagged terms)

### Brand Profile

Loaded by `loadBrandProfile(brand)` at `/api/generate` entry; validated against `brandProfileSchema` ([flow-diagrams.md §4.3 / D11](flow-diagrams.md#brand-profile-schema-d11--contract)). Fields are not restated here — the schema is the single source of truth. Summary:

- slug (matches `brief.brand`)
- brand (`brand.json` — `displayName`, `colors`, optional `tokens`)
- voice (`voice.json` — `tone`, `do`, `dont`, `promptFragments`)
- bannedWords — **union** of `lib/banned-words.ts` defaults (`getDefaultBannedWords()`) and `inputs/brands/[brand]/banned-words.json` (when present); deduped, lowercased. Defaults always apply. Missing brand file emits a `step` event noting only brand-specific additions are skipped — the floor remains in force.
- logoVariants[] (`logos.json` — each `{ id, displayName, path }`; `path` resolved via `safeJoin` against `inputs/brands/[brand]/logos/`) — D27
- defaultLogoId (`logos.json` `default` — used when `brief.logoVariant` is absent)
- fontPath (absolute, `safeJoin`-validated)

Cached in-process for 90 s. Missing directory → `BrandNotFoundError` → `400`. Missing required file → `BrandIncompleteError` → `400`. Schema violation → `BrandInvalidError` → `400`.

### Daily Cap

Persistent state for the GenAI spend gate ([D22](flow-diagrams.md#appendix-a--design-decision-register)).

- date (`YYYY-MM-DD`, UTC)
- count (integer — GenAI calls used today)
- limit (env `DAILY_GENERATION_LIMIT`, default 50)
- mode (`'default' | 'cheap'` — derived from `CAST_GENAI_MODE`)

Source of truth: `outputs/.cap.json` (one level above any campaign root, so [D15](flow-diagrams.md#appendix-a--design-decision-register)'s recursive campaign clear cannot wipe it). Atomic tmp-file rename on increment; UTC date rollover resets `count` to 0. Read endpoint: `GET /api/cap`. Browser LocalStorage is an optimistic UI cache only, never authoritative.

### Run Log

- steps (array of: type, message, timestamp)
- event types: `step`, `asset_resolved`, `creative_ready`, `compliance_result`, `error`, `complete`

### Report (report.json)

Shape is the same object delivered in the `complete` event's `manifest`. See [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview) for the canonical example.

---

## Step 5 — Screen Requirements

For each screen: what the user **gets** (inform), what they **can do** (engage), how they **get to the next screen** (invite).

Using the Inform → Engage → Invite framework.

---

### S1 · Brief Editor (state: Editing)

**Inform — what the user sees:**

- Pre-loaded example brief in a JSON editor (editable)
- GenAI mode badge — reads `CAST_GENAI_MODE` (default | cheap) via `GET /api/cap`. Read-only; surfaces which model the run will hit before Generate fires.
- Campaign name, brand, audience, message fields surfaced as readable form
- Brand selector — dropdown listing every directory under `inputs/brands/` (slug + display name from `GET /api/brands`). Required; one brand per brief. Demo ships two profiles (`brisa`, `volt`) modeling sub-brands of the fictional Onda Beverages portfolio. On selection, S1 fetches `GET /api/brands/[slug]` to populate palette swatches, voice preview, the **union banned-words list** (lib defaults + brand file), the logo picker (D27), and the prompt preview shown elsewhere on the screen.
- Markets field — typeahead input accepting any conforming `<region>-<lang>` value; suggestion list seeds common values (`us-en`, `mx-es`, `de-de`, `jp-ja`)
- Ratios picker — three pill toggles (`1:1`, `9:16`, `16:9`); default all checked; at least one must remain selected
- Products list — each row shows: name, sku, slug preview
- Per-product drop zone (shadcn-dropzone) — drag target visible
- Detected Assets panel — per-product status:
  - found: `brisa-citrus.png` — using local asset
  - missing: no asset found — will generate via GenAI
- Logo picker (D27) — radio grid beneath the brand selector, populated from `GET /api/brands/[slug]` `logos.variants[]`. Each option renders the variant PNG (served by `GET /api/brands/[slug]/logos/[id]`) on a checkered alpha background plus its `displayName`. Default selected = `logos.default`. Selection writes `brief.logoVariant`. One choice per campaign — used by every creative the run produces. Auto-selection by hero luminance is v2 ([flow-diagrams.md §8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc)).
- Read-only prompt preview — shows the prompt that will hit OpenAI per missing product (assembled from brand `voice.json` + product overrides)
- Pre-flight banned-words check — always active. The selected brand's union list (`lib/banned-words.ts` defaults + `inputs/brands/[brand]/banned-words.json` if present) is fetched via `GET /api/brands/[slug]`; if any locale's `message` contains a banned word, the Generate button is disabled with an inline warning naming the term and locale. The defaults floor (violence, hate, NSFW, weapons, drugs, self-harm) applies to every brand — a brand without `banned-words.json` still gets the floor; the indicator does not have a "checks skipped" state. Pre-flight (S1) and server-side compliance (per-creative) call the **same** `containsBannedWord` symbol from `lib/banned-words.ts` against the same union list — see [flow-diagrams.md "Single-source rule (D29)"](flow-diagrams.md#compliance--banned-words-d21).
- Generate button (enabled when brief is valid + no banned-word violations)
- Validation badge on brief (valid / invalid)
- Daily allocation indicator — reads `GET /api/cap` on mount and after each `complete` event. Format: "remaining today: **X** (this run will use **~Y**)". `Y` is computed client-side from the brief + Detected Assets state: for each product without a local asset, count `ratios.length` calls in default mode or `1` in cheap mode; sum across products. Projection recomputes on brief edit (debounced) and on detected-assets refresh, so Maya sees whether her run fits before clicking Generate. LocalStorage caches the last server value for instant first paint only — never authoritative.

**Engage — what the user can do:**

- Edit any field in the brief JSON editor
- Edit structured fields (campaign name, message, region, audience) directly
- Add / remove products
- Drag and drop a product photo onto a product row
- Remove an uploaded photo
- Watch the Detected Assets panel update on brief edit or upload
- Click Generate

**Invite — how they move to the next screen:**

- Click Generate → transitions to Running (S2)
- Validation error on brief → stays on S1 with inline error

**Key component:** `shadcn-dropzone` per product row, single-file, image/\* accept, image preview on drop, retry + remove slots

---

### S2 · Run View (state: Running)

**Inform — what the user sees:**

- Live pipeline log — NDJSON events rendered as they stream:
  - `step` → grey log line: "Parsing brief..."
  - `asset_resolved` → green/amber line: "brisa-citrus — using local asset" / "brisa-berry — generating via GenAI"
  - `creative_ready` → cyan line: "brisa-citrus 1:1 → composed"
  - `compliance_result` → badge line: "brisa-citrus 1:1 — OK"
  - `error` → red line: error message
- Progress indicator — products × markets × ratios (e.g. "4 of 12 creatives done")
- Brief is locked — editor not visible, shows campaign name only
- No Generate button (pipeline running)

**Streaming render mode (D14):** the log and progress indicator update **incrementally** on each NDJSON event. The output grid is **not** rendered yet — it hydrates only on the terminal `complete` event so all tiles appear together with their final compliance badges. This avoids a flicker of partially-resolved tiles and keeps S2 → S3 as a clean state transition.

**Engage — what the user can do:**

- Watch. Read the log. Nothing to click during a healthy run.

**Invite — how they move to the next screen:**

- `complete` event received → transitions to Complete (S3)
- `error` event received → transitions to Failed (S2′)
- Stream closes without a terminal `complete` or `error` event (network drop, server crash) → treated as a stream-level failure → transitions to Failed (S2′). Mirrors [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview).

---

### S2′ · Failed State (state: Failed)

**Inform — what the user sees:**

- Error message from the pipeline (human-readable)
- Which step failed (from the log)
- Log up to the failure point still visible
- Two recovery actions clearly presented
- Retry availability — when `GET /api/cap` reports `remaining: 0` **and** the failed stage was `genai`, the Retry button is disabled with an inline note: "daily cap reached — edit brief or wait for UTC rollover". Edit brief remains enabled in this state.

**Engage — what the user can do:**

- Click "Edit brief" — go back to S1 to fix the brief
- Click "Retry" — rerun the same brief (disabled when cap is exhausted on a `genai`-stage failure, per Inform above)

**Run idempotency (D15):** Both **Generate** (from S1) and **Retry** (from S2′) clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). `brief.json` and `report.json` are run-scoped products of the run, not preserved artifacts — the recursive clear ensures a failed run never leaves a stale `report.json` on disk claiming success. End state of any successful run is invariant under retry; on mid-run failure the partial creatives plus the new `brief.json` describe the current attempt and the prior `report.json` is gone. Cleared paths are validated through `safeJoin` against the `outputs` ROOT before any unlink call, and the campaign slug is regex-validated (`SLUG_RE`) before it enters `safeJoin`. The cap file at `outputs/.cap.json` (D22) sits one level above the campaign root and is not touched by the clear.

**Invite — how they move to the next screen:**

- Edit brief → Editing (S1)
- Retry → Running (S2)

---

### S3 · Output Grid (state: Complete)

**Inform — what the user sees:**

- Grid: one row per product, three columns (1:1 · 9:16 · 16:9)
- Each cell: generated image + compliance badge (OK / WARN / FAIL)
- **Failed tile rendering** — cells where `creatives[].path === null` ([D19](flow-diagrams.md#appendix-a--design-decision-register)) render as a red placeholder with the failing pipeline `stage` label (e.g. "genai timeout", "resize failed"). Distinct from a compliance FAIL badge: pipeline error and compliance violation are orthogonal axes. The `compliance` field is stage-dependent: failures before the `compliance` stage (`resolve | genai | resize | compose`) omit it; failures at or after `compliance` may carry the result through. The grid never renders a compliance badge for a failed tile — the red placeholder + stage label takes its place.
- Ratio label on each cell (1:1 · Instagram, 9:16 · Stories, 16:9 · Facebook)
- Summary bar — display string "6 requested · 4 passed · 1 flagged · 1 failed". Driven by canonical `counts` keys from [§4.2 / D3](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview): `requested`, `succeeded`, `flagged`, `failed`. `passed` is a derived UI metric: `passed = succeeded - flagged`. `flagged` and `failed` are independent.
- Absolute output path as a copyable code block
- "Reveal in file explorer" button
- "Edit brief & re-run" button

**Engage — what the user can do:**

- Click any flagged tile (WARN / FAIL badge) → opens Creative Detail (S4) in compliance mode
- Click any failed tile (red placeholder, `path === null`) → opens Creative Detail (S4) in error mode
- Click "Reveal in file explorer" → server action opens OS explorer
- Copy the absolute output path
- Click "Edit brief & re-run" → back to Editing (S1)

**Invite — how they move to the next screen:**

- Click flagged tile (WARN / FAIL) → DetailOpen (S4 modal · compliance mode)
- Click failed tile (red placeholder, `path === null`) → DetailOpen (S4 modal · error mode)
- Click reveal → S5 OS handoff
- Click edit & re-run → Editing (S1)

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
- Close the modal

**Invite — how they move to the next screen:**

- Close → back to Complete (S3)
- (No direct action from S4 — Priya / Maya read, then decide in S3)

---

### S5 · Reveal in File Explorer (action, not a screen)

**Not a screen — a server action triggered from S3.**

**What it does:**

- Server action `revealOutputFolder(absPath)` reveals the generated output folder via the OS:
  - macOS: `open`
  - Windows: `explorer.exe`
  - Linux: `xdg-open`
- **Path validation:** `absPath` must be normalized (`path.resolve`) and verified to remain within the outputs root (`ROOTS.outputs`) before invocation. Reject and 400 otherwise.
- **Process model:** use `execFile`-style API with explicit argv (`execFile(bin, [absPath])`). Do **not** build the command via shell string interpolation (`exec`, `spawn` with `shell: true`, or template literals).
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
| select logo variant     | S1      | Logo picker (radio grid, fed by `GET /api/brands/[slug]` `logos.variants[]`; writes `brief.logoVariant`) — D27 |
| drop product photos     | S1      | Per-product drop zone                |
| confirm assets detected | S1      | Detected Assets panel                |
| sees GenAI mode         | S1      | GenAI mode badge (reads `CAST_GENAI_MODE` via `GET /api/cap`) |
| sees remaining daily allocation | S1 | Daily allocation indicator (`GET /api/cap` + client-side projection) |
| click Generate          | S1      | Generate button (invite)             |
| watch pipeline log      | S2      | Live NDJSON log stream               |
| recover from failure    | S2′     | Error message + Edit / Retry buttons (Retry disabled when cap exhausted on `genai`-stage failure) |
| review output grid      | S3      | Product × ratio grid                 |
| read compliance badges  | S3      | Per-tile badge (OK / WARN / FAIL)    |
| click flagged tile      | S3      | Tile onClick → S4 modal (compliance mode) |
| view pipeline error detail | S3 → S4 | Failed tile (red placeholder, `path === null`) → S4 error mode (`stage` + `message` from `errors[]`) |
| read compliance detail  | S4      | Per-check results + creative preview |
| reveal output folder    | S3 → S5 | Server action + copyable path        |
| copy output path        | S3      | Copyable code block                  |
| narrate demo            | S2 + S3 | Live log + grid + badges             |

Every verb has a screen and a named attribute. Nothing is floating.

---

_Cast · Attributes & Screen Requirements v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
