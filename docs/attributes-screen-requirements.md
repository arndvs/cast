# Attributes & Screen Requirements — Cast

### Local Next.js App · POC · v1

---

## Step 4 — Modeling the Attributes

All attributes extracted from user stories, the system map, and the flow diagrams.
Organized by entity, then mapped to screens in Step 5.

### Brief

Fields are defined by the canonical Zod `briefSchema` in [flow-diagrams.md §4.2](flow-diagrams.md#42-api-contract--streaming-generate--light-uploadpreview). Field names and shapes are not restated here — the schema is the single source of truth. Summary:

- `campaign` (slug)
- `brand` (slug — references `inputs/brands/[brand]/`)
- `products[]` — each `{ name, sku, promptOverrides? }`
- `markets[]` — BCP-47-style `<region>-<lang>` (e.g. `us-en`, `mx-es`)
- `audience` (freeform string)
- `message` — `Record<lang, string>` (locale → copy)
- `ratios[]` — enum subset of `[1x1, 9x16, 16x9]`

### Product

- name
- slug (derived: lowercase, hyphens, validated against `SLUG_RE`)
- sku
- promptOverrides (optional — see [flow-diagrams.md “Implementation primitives”](flow-diagrams.md#implementation-primitives))

### Input Asset

- slug (matches product)
- file path (`inputs/assets/[product-slug].ext`)
- extension (resolver looks for `png, jpg, jpeg, webp`)
- found (boolean — detected at page load)

### Hero Image

- source: `local` | `genai`
- product slug
- file path after generation

### Output Creative

- product slug
- market
- ratio (`1x1`, `9x16`, `16x9`)
- file path (`outputs/[campaign]/[market]/[product]/[ratio].png`)
- badge: `OK` | `WARN` | `FAIL`
- compliance checks (logoPresent, colorsOk, bannedWords)

### Compliance Result

- badge: `OK` | `WARN` | `FAIL`
- checks:
  - logoPresent: boolean
  - colorsOk: boolean
  - bannedWords: string[] (flagged terms)

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
- Campaign name, brand, audience, message fields surfaced as readable form
- Brand slug field with validation against `inputs/brands/[brand]/` (errors inline if missing)
- Markets field — typeahead input accepting any conforming `<region>-<lang>` value; suggestion list seeds common values (`us-en`, `mx-es`, `de-de`, `jp-ja`)
- Ratios picker — three pill toggles (`1:1`, `9:16`, `16:9`); default all checked; at least one must remain selected
- Products list — each row shows: name, sku, slug preview
- Per-product drop zone (shadcn-dropzone) — drag target visible
- Detected Assets panel — per-product status:
  - found: `sparkling-citrus.png` — using local asset
  - missing: no asset found — will generate via GenAI
- Read-only prompt preview — shows the prompt that will hit OpenAI per missing product (assembled from brand `voice.json` + product overrides)
- Pre-flight banned-words check — if any locale's `message` contains a banned word for this brand, the Generate button is disabled with an inline warning
- Generate button (enabled when brief is valid + no banned-word violations)
- Validation badge on brief (valid / invalid)
- Daily allocation indicator (e.g. "32 of 50 generations remaining today")

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
  - `asset_resolved` → green/amber line: "sparkling-citrus — using local asset" / "energy-drink — generating via GenAI"
  - `creative_ready` → cyan line: "sparkling-citrus 1:1 → composed"
  - `compliance_result` → badge line: "sparkling-citrus 1:1 — OK"
  - `error` → red line: error message
- Progress indicator — products × ratios (e.g. "4 of 6 creatives done")
- Brief is locked — editor not visible, shows campaign name only
- No Generate button (pipeline running)

**Engage — what the user can do:**

- Watch. Read the log. Nothing to click during a healthy run.

**Invite — how they move to the next screen:**

- `complete` event received → transitions to Complete (S3)
- `error` event received → transitions to Failed (S2′)

---

### S2′ · Failed State (state: Failed)

**Inform — what the user sees:**

- Error message from the pipeline (human-readable)
- Which step failed (from the log)
- Log up to the failure point still visible
- Two recovery actions clearly presented

**Engage — what the user can do:**

- Click "Edit brief" — go back to S1 to fix the brief
- Click "Retry" — rerun the same brief

**Invite — how they move to the next screen:**

- Edit brief → Editing (S1)
- Retry → Running (S2)

---

### S3 · Output Grid (state: Complete)

**Inform — what the user sees:**

- Grid: one row per product, three columns (1:1 · 9:16 · 16:9)
- Each cell: generated image + compliance badge (OK / WARN / FAIL)
- Ratio label on each cell (1:1 · Instagram, 9:16 · Stories, 16:9 · Facebook)
- Summary bar: "6 creatives — 5 passed · 1 flagged"
- Absolute output path as a copyable code block
- "Reveal in file explorer" button
- "Edit brief & re-run" button

**Engage — what the user can do:**

- Click any flagged tile → opens Compliance Detail (S4)
- Click "Reveal in file explorer" → server action opens OS explorer
- Copy the absolute output path
- Click "Edit brief & re-run" → back to Editing (S1)

**Invite — how they move to the next screen:**

- Click flagged tile → DetailOpen (S4 modal)
- Click reveal → S5 OS handoff
- Click edit & re-run → Editing (S1)

---

### S4 · Compliance Detail (state: DetailOpen — modal over S3)

**Inform — what the user sees:**

- Creative preview (full image)
- Product name + ratio label
- Compliance badge (WARN or FAIL)
- Per-check results:
  - Logo present: pass / fail
  - Brand colors: pass / fail (with found vs expected swatches if failed)
  - Banned words: pass / fail (with flagged terms listed if failed)

**Engage — what the user can do:**

- Read the detail
- Close the modal

**Invite — how they move to the next screen:**

- Close → back to Complete (S3)
- (No direct action from S4 — Priya reads, then decides in S3)

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
| drop product photos     | S1      | Per-product drop zone                |
| confirm assets detected | S1      | Detected Assets panel                |
| click Generate          | S1      | Generate button (invite)             |
| watch pipeline log      | S2      | Live NDJSON log stream               |
| recover from failure    | S2′     | Error message + Edit / Retry buttons |
| review output grid      | S3      | Product × ratio grid                 |
| read compliance badges  | S3      | Per-tile badge (OK / WARN / FAIL)    |
| click flagged tile      | S3      | Tile onClick → S4 modal              |
| read compliance detail  | S4      | Per-check results + creative preview |
| reveal output folder    | S3 → S5 | Server action + copyable path        |
| copy output path        | S3      | Copyable code block                  |
| narrate demo            | S2 + S3 | Live log + grid + badges             |

Every verb has a screen and a named attribute. Nothing is floating.

---

_Cast · Attributes & Screen Requirements v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
