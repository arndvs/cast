# Flow Diagrams — Cast: Creative Automation Pipeline

### Local Next.js App · POC · v1

> Translates the [system map](system-map.md) into screens and the routes between them. Each user story from [user-stories.md](user-stories.md) is walked through the diagram to validate that Maya, Priya, and Sam can finish their jobs without dead ends.

---

## 1. List of screens

Working from the system map, the seven subsystems collapse into **five screens** for the POC. The pipeline is a single-tool experience — there is no auth, no multi-tenancy, no history. State transitions on a single page do most of the work; only compliance-detail and the output folder are separate destinations.

| # | Screen | Owner subsystem | Why it exists (story) |
|---|---|---|---|
| S1 | **Home / Brief Editor + Detected Assets + Drop zones** | Brief Editor + Asset Resolver (preview) + Upload | Maya edits brief, drops photos onto product rows, sees what the resolver will pick up; Sam loads pre-populated example |
| S2 | **Run View** (Live Pipeline Log) | Run Orchestrator → Live Log | Maya/Sam watch pipeline run step by step |
| S2′ | **Failed state** (within S2) | Run Orchestrator (error path) | Demo-safety: a thrown error gets a visible message + recovery, not a hung spinner |
| S3 | **Output Grid** | Output Grid + Badge UI | Maya reviews creatives; Priya scans badges |
| S4 | **Compliance Detail** (modal over S3) | Compliance Checker → Badge UI | Priya drills into a flagged creative |
| S5 | **Reveal in File Explorer** (action, not a screen) | Server action + copyable path | Maya grabs the files to ship |

> **Practical note:** S1, S2, and S3 are *states of a single Next.js page* (`/`), not separate routes. S4 is a modal/drawer over S3. S5 is a *server action* triggered from S3 that opens the OS file explorer at the campaign output folder, with the absolute path also rendered as a copyable code block for fallback. The diagrams below treat them as logical screens for clarity.

---

## 2. Ideal flow diagram — full vision

The "magical" version of the system. Solid arrows = primary path. Dashed arrows = secondary / recovery. The MVP scope (section 4) is a subset of this.

```mermaid
flowchart TB
    Start(["open localhost:3000"]) --> S1

    subgraph S1["S1 · Home / Brief Editor"]
        Brief["Pre-loaded example brief<br/>(JSON form)"]
        EditBrief["Edit products · region<br/>audience · message · locales"]
        Drop["Drop zone per product row<br/>(POST /api/upload → saves as<br/>/inputs/assets/[slug].ext)"]
        Detected["Detected Assets panel<br/>(scans /inputs/assets/<br/>by product slug after upload<br/>or pre-placement)"]
        GenBtn["Generate"]
        Brief --> EditBrief --> Drop --> Detected --> GenBtn
        EditBrief -.->|debounced 300ms| Detected
    end

    GenBtn -->|POST /api/generate<br/>NDJSON stream| S2

    subgraph S2["S2 · Run View"]
        Stream["Live pipeline log<br/>(NDJSON events: step,<br/>asset_resolved, creative_ready,<br/>compliance_result)"]
        Progress["Per-product / per-ratio progress"]
        Stream --> Progress
    end

    S2 -->|event: complete<br/>(carries manifest)| S3
    S2 -->|event: error| S2Err["S2′ · Failed state<br/>error message + retry · edit brief"]
    S2Err -->|edit| S1
    S2Err -->|retry| S2

    subgraph S3["S3 · Output Grid"]
        Grid["Row per product<br/>cols: 1:1 · 9:16 · 16:9<br/>(rendered from manifest)"]
        Badges["Compliance badges<br/>OK / WARN / FAIL"]
        Grid --> Badges
        Path["Absolute output path<br/>(copyable code block)"]
        OpenFolder["Reveal in file explorer<br/>(server action)"]
        NewRun["Edit brief & re-run"]
        Grid --> Path --> OpenFolder
        Grid --> NewRun
    end

    S3 -->|click flagged tile| S4
    S4 -->|close| S3

    subgraph S4["S4 · Compliance Detail"]
        Which["Which check failed<br/>(logo · palette · banned word)"]
        Why["Why it failed<br/>+ creative preview"]
        Which --> Why
    end

    OpenFolder --> S5(["OS file explorer<br/>opens /outputs/[campaign]/"])
    NewRun --> S1
```

---

## 3. User-story walkthroughs

The validation step Carl and Dane both stress: read each story aloud, trace the arrows, and look for dead ends or missing screens.

### Story 1 — Maya · "ship the campaign in under three minutes"

> **Asset acquisition (two paths, same folder):**
> - **Drop in browser** — Maya drags a photo onto a product row in S1; server saves to `/inputs/assets/[slug].ext` using the slug derived from the brief product name. *(Primary path — what Story 1 means by "drops her product photos.")*
> - **Pre-placement** — photos already living at `/inputs/assets/[slug].{png,jpg,jpeg,webp}` are picked up automatically. *(Used by Sam's "ships with the repo" demo path — see Story 3.)*
>
> Both paths feed the same **Detected Assets panel**, which shows per-product `found` / `will generate` *before* Generate fires.

```mermaid
flowchart LR
    A[opens app] --> B["S1 · edits brief<br/>(products, locales, message)"]
    B --> C["S1 · drops photos onto<br/>product rows (drop zone)"]
    C --> D["S1 · Detected Assets panel<br/>shows found / will generate"]
    D --> E["S1 · clicks Generate"]
    E --> F["S2 · watches live log<br/>(asset resolved, resized, composited)"]
    F --> G["S3 · reviews output grid<br/>2 products × 3 ratios"]
    G --> H["S3 · clicks 'Reveal in file explorer'"]
    H --> I["S5 · OS opens output folder<br/>Maya grabs files"]
```

**Covered.** Every verb (open, edit, drop, confirm assets, generate, watch, review, reveal, download) lands on a screen or a defined action. No backtracking required.

### Story 2 — Priya · "see compliance at a glance"

```mermaid
flowchart LR
    A[lands after Maya's run] --> B["S3 · scans badges"]
    B --> C{"all green?"}
    C -->|yes| D["approve"]
    C -->|no| E["S3 · clicks flagged tile"]
    E --> F["S4 · reads which check failed + why"]
    F --> G{"fixable in brief?"}
    G -->|yes| H["S1 · edit brief, re-run"]
    G -->|no| I["flag designer (out-of-app)"]
    H --> J["S2 → S3 (re-run loop)"]
```

**Covered.** Priya never has to leave the grid for routine cases; the drill-in is one click away.

### Story 3 — Sam · "narrate the demo"

```mermaid
flowchart LR
    A["clean checkout<br/>npm run dev"] --> B["S1 · localhost:3000<br/>(example brief pre-loaded)"]
    B --> C["S1 · clicks Generate<br/>(no editing needed)"]
    C --> D["S2 · narrates live log<br/>'this is the resize step…'"]
    D --> E["S3 · points at output grid<br/>'and here are the badges'"]
    E --> F["S4 · clicks one tile<br/>to show compliance detail"]
```

**Covered.** The pre-populated brief means S1 is a 0-second screen for Sam — he goes straight to Generate. The live log on S2 is the demo's centerpiece.

---

## 4. MVP cut — what ships first

Per Dane's "what's the smallest thing that delivers value" lens. Green = MVP. Grey = nice-to-have / v2.

```mermaid
flowchart TB
    classDef mvp fill:#16a34a,stroke:#15803d,color:#fff
    classDef later fill:#9ca3af,stroke:#6b7280,color:#fff

    S1["S1 · Brief Editor<br/>+ Drop zones + Detected Assets"]:::mvp
    S2["S2 · Run View<br/>(live pipeline log)"]:::mvp
    S2Err["S2′ · Failed state<br/>error message + retry/edit"]:::mvp
    S3["S3 · Output Grid<br/>(creatives + badges + path)"]:::mvp
    S4["S4 · Compliance Detail<br/>(drill-in on flagged tile)"]:::mvp
    S5["S5 · Reveal in file explorer<br/>(server action + copyable path)"]:::mvp

    History["Run history / past runs"]:::later
    Settings["Settings (API keys, brand config)"]:::later
    Auth["Auth / multi-user"]:::later
    MultiUpload["Bulk multi-file upload<br/>+ asset library"]:::later

    S1 --> S2 --> S3
    S2 --> S2Err
    S3 --> S4
    S3 --> S5
    S3 -.-> History
    S1 -.-> Settings
    S1 -.-> Auth
    S1 -.-> MultiUpload
```

The six MVP elements cover **100% of the verbs in all three user stories** plus a recovery path for live demos. Everything in grey is a v2 conversation.

### 4.1 Asset acquisition — drop zones + Detected Assets panel

Two input paths, one folder, one resolver. Maya doesn't have to learn the slug rule; the server applies it on upload.

**Asset filename convention** (single source of truth — used by Resolver, Upload route, and Detected Assets panel):

- Product name → slug: lowercase, non-alphanumeric runs collapsed to `-`, leading/trailing `-` stripped.
  - `"Sparkling Citrus"` → `sparkling-citrus`
  - `"Energy Drink Pro"` → `energy-drink-pro`
- Resolver looks for `/inputs/assets/[slug].{png,jpg,jpeg,webp}` (first hit wins).
- No file found → Asset Resolver falls back to GenAI on Generate.

**Two ways an asset gets into `/inputs/assets/`:**

| Path | How | When used |
|---|---|---|
| **Drop zone (per product row)** | Maya drags a file onto the product row in S1 → `POST /api/upload` saves it as `/inputs/assets/[slug].ext` | Story 1 — Maya's primary path |
| **Pre-placement** | File already exists at `/inputs/assets/[slug].{png,jpg,jpeg,webp}` before app launch | Story 3 — Sam's repo-shipped example |

**Component:** [`shadcn-dropzone`](https://shadcn-dropzone.vercel.app/docs) — installed via `npx shadcn@latest add 'https://shadcn-dropzone.vercel.app/dropzone.json'`. Built on the shadcn primitive set we're already using. Single-file mode per product row, `accept: image/png,image/jpeg,image/webp`, image-preview variant, retry + remove file slots wire to `/api/upload` retry semantics. `useDropzone()` hook bound per row; `onDropFile` calls upload then triggers `/api/detected-assets` re-fetch.

**Panel rendering (per product in the brief):**

| Brief product | Resolver looks for | Panel shows |
|---|---|---|
| `"Sparkling Citrus"` | `sparkling-citrus.{png,jpg,jpeg,webp}` | found: `sparkling-citrus.png` (using local asset) |
| `"Energy Drink Pro"` | `energy-drink-pro.{png,jpg,…}` | no asset found — will generate via GenAI |

The panel re-scans whenever the brief's product list changes *or* an upload completes. This makes the resolver's behavior *visible before commitment*, which kills a whole class of "why did it generate when I had a photo?" demo questions.

**Re-fetch trigger semantics (avoid keystroke storms):**

| Trigger | Debounce | Rationale |
|---|---|---|
| S1 mount | none — fire immediately | Initial state must be correct on load |
| Successful upload (`/api/upload` → 200) | none — fire immediately | Confirms the just-dropped file landed |
| Brief edit (`onChange` on the form) | **300 ms debounce** | Maya types product names character-by-character; a per-keystroke filesystem scan is wasted work and risks inconsistent UI flicker. Trailing-edge debounce on the field's last change before the panel re-fetches. |

Implementation note: the brief-editor `onChange` handler updates local state synchronously, but the `/api/detected-assets` call is scheduled through a debounced function (e.g. `useDebouncedCallback(refetchDetectedAssets, 300)`). Mount and post-upload calls bypass the debounce.

### 4.2 API contract — streaming generate + light upload/preview

Three endpoints, two of them tiny:

```
POST /api/upload
Content-Type: multipart/form-data
Fields: productSlug=sparkling-citrus, file=<binary>

Response: { "ok": true, "path": "/inputs/assets/sparkling-citrus.png" }
  — server derives extension from MIME, writes file, overwrites any prior asset for that slug

GET /api/detected-assets?slugs=sparkling-citrus,energy-drink-pro
Response: [
  { "slug": "sparkling-citrus", "foundFile": "sparkling-citrus.png" },
  { "slug": "energy-drink-pro", "foundFile": null }
]
  — called on S1 mount (immediate), on brief edit (300ms debounced),
    and after each successful upload (immediate)

POST /api/generate
Content-Type: application/json
Body: <brief JSON>

Response: text/x-ndjson  (streamed)
  { "type": "step", "message": "run started" }
  { "type": "asset_resolved", "product": "sparkling-citrus", "source": "local" }
  { "type": "creative_ready", "product": "sparkling-citrus", "ratio": "1x1", "path": "/outputs/..." }
  { "type": "compliance_result", "product": "sparkling-citrus", "ratio": "1x1", "badge": "OK", "checks": {...} }
  ...
  { "type": "complete", "manifest": { "campaign": "...", "outputDir": "/abs/path/outputs/...", "creatives": [...] } }
```

- **S1 drop zone** → `POST /api/upload` then re-fetch `/api/detected-assets` (immediate).
- **S1 brief edit** → debounce 300 ms → re-fetch `/api/detected-assets`.
- **S2** consumes the generate stream and renders log lines as they arrive.
- **S3** hydrates from the **`complete` event's `manifest`** — no second `GET` to the filesystem, no race with disk writes.
- **S2′ (Failed)** is triggered by an `{ "type": "error", "message": "..." }` event or a stream-level failure.
- **S5 (Reveal)** uses `manifest.outputDir` for the server-action shell-out and as the copyable absolute path.

---

## 5. Screen-state map — what changes within a screen

Because S1/S2/S3 are states of one page, here is the state machine for the main route `/`. Useful for the next step (wireframes) so we know what each state needs to render.

```mermaid
stateDiagram-v2
    [*] --> Editing
    Editing: S1 — Brief Editor visible<br/>Generate button enabled
    Editing --> Running: click Generate
    Running: S2 — Log streaming<br/>brief locked, no Generate
    Running --> Complete: run finishes
    Running --> Failed: run errors
    Failed --> Editing: click "edit brief"
    Failed --> Running: click "retry"
    Complete: S3 — Grid visible<br/>badges rendered<br/>tiles clickable
    Complete --> DetailOpen: click flagged tile
    DetailOpen: S4 — Compliance modal over grid
    DetailOpen --> Complete: close modal
    Complete --> Editing: click "edit brief & re-run"
```

---

## 6. Coverage check — every story verb has a screen

Final sanity pass. If any verb lacks a screen, the flow diagram is broken.

| Story verb | Screen | State |
|---|---|---|
| open app | S1 | Editing |
| edit brief | S1 | Editing |
| **drop product photos onto rows** | S1 (drop zone → `/api/upload`) | Editing |
| pre-place files in `/inputs/assets/` | (filesystem path — Sam's demo) | confirmed via Detected Assets panel |
| confirm assets will be picked up | S1 (Detected Assets panel) | Editing |
| click Generate | S1 | Editing → Running |
| watch pipeline log | S2 | Running |
| recover from a run failure | S2′ | Failed |
| review output grid | S3 | Complete |
| read compliance badge | S3 | Complete |
| click flagged tile | S3 → S4 | Complete → DetailOpen |
| read compliance detail | S4 | DetailOpen |
| reveal output folder | S3 → S5 | Complete (server action) |
| copy absolute output path | S3 | Complete |
| download files | OS file explorer | (post-handoff) |
| narrate demo | S2 + S3 | Running, Complete |

Every verb maps to a screen, a state, or a defined action. No orphans.

---

## 7. What this unlocks

With screens + flow + states + API contract locked, the next step (wireframes) has a clean spec:

- **One Next.js route** (`/`) handling four states: `Editing`, `Running`, `Complete`, `Failed`.
- **One modal/drawer** for `DetailOpen` (S4).
- **One server action** for S5 — `revealOutputFolder(absPath)` reveals the generated output folder via the OS (`start` on Windows / `open` on macOS / `xdg-open` on Linux). `absPath` must be normalized and validated to remain within the expected outputs directory before invocation. Do **not** build the command via string interpolation or shell concatenation of untrusted input; use a `spawn`/`execFile`-style API with explicit args. Fallback: copyable absolute path on screen.
- **Per-product drop zone** on S1 → `POST /api/upload` (multipart, `productSlug` + `file`) writes to `/inputs/assets/[slug].ext`.
- **Asset preview read** — `GET /api/detected-assets?slugs=...` on S1 mount (immediate), on brief change (300 ms debounced), and after each upload (immediate). Returns `[{ slug, foundFile | null }]` for the Detected Assets panel.
- **Streaming generate** — `POST /api/generate` returns NDJSON; terminal `complete` event carries the full manifest. S2 reads the stream; S3 hydrates from the manifest. **No separate output-read endpoint.**
- **One filename convention** — `[product-slug].{png,jpg,jpeg,webp}` — enforced server-side by `/api/upload` and matched by Resolver and Detected Assets panel. Maya never has to type a slug.

Everything else is wireframe craft.

---

_Cast · Flow Diagrams v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
