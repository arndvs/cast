# Flow Diagrams — Cast: Creative Automation Pipeline

### Local Next.js App · POC · v1

> Translates the [system map](system-map.md) into screens and the routes between them. Each user story from [user-stories.md](user-stories.md) is walked through the diagram to validate that Maya, Priya, and Aaron can finish their jobs without dead ends.

---

## 1. List of screens

Working from the system map, the seven subsystems collapse into **five screens** for the POC. The pipeline is a single-tool experience — there is no auth, no multi-tenancy, no history. State transitions on a single page do most of the work; only compliance-detail and the output folder are separate destinations.

| #   | Screen                                                 | Owner subsystem                                  | Why it exists (story)                                                                                                    |
| --- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| S1  | **Home / Brief Editor + Detected Assets + Drop zones** | Brief Editor + Asset Resolver (preview) + Upload | Maya edits brief, drops photos onto product rows, sees what the resolver will pick up; Aaron loads pre-populated example |
| S2  | **Run View** (Live Pipeline Log)                       | Run Orchestrator → Live Log                      | Maya/Aaron watch pipeline run step by step                                                                               |
| S2′ | **Failed state** (within S2)                           | Run Orchestrator (error path)                    | Demo-safety: a thrown error gets a visible message + recovery, not a hung spinner                                        |
| S3  | **Output Grid**                                        | Output Grid + Badge UI                           | Maya reviews creatives; Priya scans badges                                                                               |
| S4  | **Creative Detail** (modal over S3)                    | Compliance Checker → Badge UI · Reporter `errors[]` | Priya drills into a flagged creative; Maya drills into a failed creative (dual-mode: compliance violation OR pipeline error)                  |
| S5  | **Reveal in File Explorer** (action, not a screen)     | Server action + copyable path                    | Maya grabs the files to ship                                                                                             |

> **Practical note:** S1, S2, and S3 are _states of a single Next.js page_ (`/`), not separate routes. S4 is a modal/drawer over S3. S5 is a _server action_ triggered from S3 that opens the OS file explorer at the campaign output folder, with the absolute path also rendered as a copyable code block for fallback. The diagrams below treat them as logical screens for clarity.

---

## 2. Ideal flow diagram — full vision

The "magical" version of the system. Solid arrows = primary path. Dashed arrows = secondary / recovery. The MVP scope (section 4) is a subset of this.

```mermaid
flowchart TB
    Start(["open localhost:3000"]) --> S1

    subgraph S1["S1 · Home / Brief Editor"]
        Brief["Pre-loaded example brief<br/>(JSON form)"]
        EditBrief["Edit brand · products · markets<br/>audience · message · ratios"]
        Drop["Drop zone per product row<br/>(POST /api/upload → saves as<br/>inputs/assets/[slug].ext)"]
        Detected["Detected Assets panel<br/>(scans inputs/assets/<br/>by product slug after upload<br/>or pre-placement)"]
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

    subgraph S4["S4 · Creative Detail"]
        Which["Which check failed<br/>(logo · palette · banned word)"]
        Why["Why it failed<br/>+ creative preview"]
        Which --> Why
    end

    OpenFolder --> S5(["OS file explorer<br/>opens outputs/[campaign]/"])
    NewRun --> S1
```

---

## 3. User-story walkthroughs

The validation step Carl and Dane both stress: read each story aloud, trace the arrows, and look for dead ends or missing screens.

### Story 1 — Maya · "ship the campaign in under three minutes"

> **Asset acquisition (two paths, same folder):**
>
> - **Drop in browser** — Maya drags a photo onto a product row in S1; server saves to `inputs/assets/[slug].ext` using the slug derived from the brief product name. _(Primary path — what Story 1 means by "drops her product photos.")_
> - **Pre-placement** — photos already living at `inputs/assets/[slug].{png,jpg,jpeg,webp}` are picked up automatically. _(Used by Aaron's "ships with the repo" demo path — see Story 3.)_
>
> Both paths feed the same **Detected Assets panel**, which shows per-product `found` / `will generate` _before_ Generate fires.

```mermaid
flowchart LR
    A[opens app] --> B["S1 · edits brief<br/>(brand, products, markets, message)"]
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

### Story 3 — Aaron · "narrate the demo"

```mermaid
flowchart LR
    A["clean checkout<br/>npm run dev"] --> B["S1 · localhost:3000<br/>(example brief pre-loaded)"]
    B --> C["S1 · clicks Generate<br/>(no editing needed)"]
    C --> D["S2 · narrates live log<br/>'this is the resize step…'"]
    D --> E["S3 · points at output grid<br/>'and here are the badges'"]
    E --> F["S4 · clicks one tile<br/>to show creative detail"]
```

**Covered.** The pre-populated brief means S1 is a 0-second screen for Aaron — he goes straight to Generate. The live log on S2 is the demo's centerpiece.

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
    S4["S4 · Creative Detail<br/>(drill-in on flagged or failed tile)"]:::mvp
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
  - `"Brisa Citrus"` → `brisa-citrus`
  - `"Volt Original"` → `volt-original`
- Slugs must match `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` server-side. Non-conforming → 400.
- **Asset extension matrix** — the only authoritative answer to “which extensions are allowed where?”:

  | Operation                   | Accepted MIME types (filename ext ignored) | Notes                                                                                                                                                          |
  | --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Upload (`POST /api/upload`) | `image/png`, `image/jpeg`, `image/webp`    | Filename extension is **not** trusted; canonical disk extension is derived from MIME (`png`→`.png`, `jpeg`→`.jpg`, `webp`→`.webp`). Anything else → 415.       |
  | Resolver lookup             | `.png`, `.jpg`, `.jpeg`, `.webp`           | First hit wins. Pre-placed `.jpeg` files are accepted on read.                                                                                                 |
  | Disk write extensions       | `.png`, `.jpg`, `.jpeg`, `.webp`           | The set of files Resolver may unlink before a re-upload (delete-then-write). `.jpeg` is included so a pre-placed file doesn't orphan after a drop-zone upload. |
  | Output creative             | `.png`                                     | Always PNG. Sharp encodes from the composited buffer.                                                                                                          |
  | Animated formats            | _none_                                     | `.gif`, `.mp4`, `.webm` are rejected at upload (415) and ignored at resolve (D26).                                                                             |

- No file found → Asset Resolver falls back to GenAI on Generate.

**Two ways an asset gets into `inputs/assets/`:**

| Path                            | How                                                                                                      | When used                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Drop zone (per product row)** | Maya drags a file onto the product row in S1 → `POST /api/upload` saves it as `inputs/assets/[slug].ext` | Story 1 — Maya's primary path          |
| **Pre-placement**               | File already exists at `inputs/assets/[slug].{png,jpg,jpeg,webp}` before app launch                      | Story 3 — Aaron's repo-shipped example |

**Component:** [`shadcn-dropzone`](https://shadcn-dropzone.vercel.app/docs) — installed via `npx shadcn@latest add 'https://shadcn-dropzone.vercel.app/dropzone.json'`. Built on the shadcn primitive set we're already using. Single-file mode per product row, `accept: image/png,image/jpeg,image/webp`, image-preview variant, retry + remove file slots wire to `/api/upload` retry semantics. `useDropzone()` hook bound per row; `onDropFile` calls upload then triggers `/api/detected-assets` re-fetch.

**Panel rendering (per product in the brief):**

| Brief product    | Resolver looks for                 | Panel shows                                   |
| ---------------- | ---------------------------------- | --------------------------------------------- |
| `"Brisa Citrus"` | `brisa-citrus.{png,jpg,jpeg,webp}` | found: `brisa-citrus.png` (using local asset) |
| `"Brisa Berry"`  | `brisa-berry.{png,jpg,…}`          | no asset found — will generate via GenAI      |

The panel re-scans whenever the brief's product list changes _or_ an upload completes. This makes the resolver's behavior _visible before commitment_, which kills a whole class of "why did it generate when I had a photo?" demo questions.

**Re-fetch trigger semantics (avoid keystroke storms):**

| Trigger                                 | Debounce                | Rationale                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 mount                                | none — fire immediately | Initial state must be correct on load                                                                                                                                                                             |
| Successful upload (`/api/upload` → 200) | none — fire immediately | Confirms the just-dropped file landed                                                                                                                                                                             |
| Brief edit (`onChange` on the form)     | **300 ms debounce**     | Maya types product names character-by-character; a per-keystroke filesystem scan is wasted work and risks inconsistent UI flicker. Trailing-edge debounce on the field's last change before the panel re-fetches. |

Implementation note: the brief-editor `onChange` handler updates local state synchronously, but the `/api/detected-assets` call is scheduled through a debounced function (e.g. `useDebouncedCallback(refetchDetectedAssets, 300)`). Mount and post-upload calls bypass the debounce.

### 4.2 API contract — streaming generate + light upload/preview

Three endpoints, two of them tiny:

```
POST /api/upload
Content-Type: multipart/form-data
Fields: productSlug=brisa-citrus, file=<binary>

Response: { "ok": true, "path": "inputs/assets/brisa-citrus.png" }

Constraints (enforced server-side, single source of truth):
  - productSlug must match SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/ → else 400
  - Content-Length ≤ 5 MB → else 413 (rejected before disk write)
  - MIME must be one of: image/png, image/jpeg, image/webp → else 415
  - Extension is canonical-mapped: png→.png, jpeg→.jpg, webp→.webp
    (NOT derived from filename — derived from MIME)
  - On write: delete inputs/assets/[slug].{png,jpg,jpeg,webp} first, then write
    the canonical extension. One slug → one file on disk at a time.
  - Path constructed via safeJoin("inputs", "assets", `${slug}.${ext}`) — rejects
    traversal even if SLUG_RE is bypassed.

GET /api/detected-assets?slugs=brisa-citrus,brisa-berry
Response: [
  { "slug": "brisa-citrus", "foundFile": "brisa-citrus.png" },
  { "slug": "brisa-berry", "foundFile": null }
]
  — called on S1 mount (immediate), on brief edit (300ms debounced),
    and after each successful upload (immediate)
  — every slug in the query string is validated with SLUG_RE before
    any filesystem call; lookups go through safeJoin("inputs", "assets", ...).

POST /api/generate
Content-Type: application/json
Body: <brief JSON> (validated against briefSchema — single Zod schema
  shared between client editor validation and server entry)

Response: text/x-ndjson  (streamed)
  { "type": "step", "message": "run started" }
  { "type": "asset_resolved", "product": "brisa-citrus", "source": "local" }
  { "type": "creative_ready", "product": "brisa-citrus", "market": "us-en", "ratio": "1x1", "path": "outputs/..." }
  { "type": "compliance_result", "product": "brisa-citrus", "market": "us-en", "ratio": "1x1", "badge": "OK", "checks": {...} }
  ...
  { "type": "complete", "manifest": { "campaign": "...", "brand": "...", "outputDir": "/abs/path/outputs/...", "creatives": [...] } }
```

### Brief schema (canonical Zod definition)

The **single source of truth** for brief validation. Same schema used client-side (editor validation) and server-side (`/api/generate` entry). Every other doc references this block; field names and shapes do not get restated elsewhere.

```ts
import { z } from "zod";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MARKET_RE = /^[a-z]{2}-[a-z]{2}$/; // <region>-<lang>, e.g. us-en, mx-es
const RATIO = z.enum(["1x1", "9x16", "16x9"]);

export const briefSchema = z
  .object({
    campaign: z.string().regex(SLUG_RE),
    brand: z.string().regex(SLUG_RE),
    products: z
      .array(
        z.object({
          name: z.string().min(1),
          sku: z.string().min(1),
          promptOverrides: z
            .object({
              environment: z.string().optional(),
              mood: z.array(z.string()).optional(),
            })
            .optional(),
        }),
      )
      .min(1),
    markets: z.array(z.string().regex(MARKET_RE)).min(1),
    audience: z.string().min(1).max(500),
    message: z.record(z.string().regex(/^[a-z]{2}$/), z.string().min(1)),
    ratios: z.array(RATIO).min(1),
  })
  .superRefine((brief, ctx) => {
    // Every market's locale (suffix after `-`) must have a message string.
    for (const market of brief.markets) {
      const locale = market.split("-").pop()!;
      if (!(locale in brief.message)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["message"],
          message: `market ${market} requires message["${locale}"]`,
        });
      }
    }
    // Derived product slugs must be unique — same slug means same
    // upload target, same resolver hit, same output folder. Catches
    // "Brisa Citrus" vs "Brisa  Citrus" (extra space) collisions before
    // they corrupt the run.
    const seen = new Map<string, number>();
    brief.products.forEach((p, i) => {
      const slug = slugify(p.name);
      if (seen.has(slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products", i, "name"],
          message: `product name slugs to "${slug}" which collides with products[${seen.get(slug)}].name`,
        });
      } else {
        seen.set(slug, i);
      }
    });
  });

export type Brief = z.infer<typeof briefSchema>;
```

**`slugify` is the same function used by `/api/upload` and the Asset Resolver** — lowercase, non-alphanumeric runs collapsed to `-`, leading/trailing `-` stripped. One implementation, one import path; not three independent regexes that drift.

**Market → locale mapping rule:** `locale = market.split('-').pop()`. The `superRefine` rejects any brief whose markets reference a locale missing from `message{}`. There is no separate `locales` field on the brief.

**Run artifacts written to `outputDir`** (alongside the per-product creative subfolders):

- `brief.json` — verbatim copy of the validated brief that produced this run. Written before the per-product loop. Lets a reviewer reproduce or audit a run from the output folder alone, without going back to `inputs/`.
- `report.json` — compliance + run summary. Written by the Reporter after the loop completes, before the `complete` event fires.

Both files are `safeJoin(outputDir, name)` writes; `outputDir` is itself derived from `safeJoin("outputs", campaignSlug)` with `SLUG_RE` validation.

**Canonical manifest / `report.json` shape** — the object delivered in the `complete` event is identical to `report.json`'s on-disk content (camelCase throughout):

```json
{
  "campaign": "summer-refresh-2026",
  "brand": "brisa",
  "outputDir": "/abs/path/to/cast/outputs/summer-refresh-2026",
  "counts": {
    "requested": 12,
    "succeeded": 11,
    "failed": 1,
    "generated": 6,
    "reused": 5,
    "flagged": 2
  },
  "creatives": [
    {
      "product": "brisa-citrus",
      "market": "us-en",
      "ratio": "1x1",
      "source": "local",
      "path": "outputs/summer-refresh-2026/us-en/brisa-citrus/1x1.png",
      "compliance": {
        "badge": "OK",
        "checks": { "logoPresent": true, "colorsOk": true, "bannedWords": [] }
      }
    },
    {
      "product": "brisa-berry",
      "market": "mx-es",
      "ratio": "9x16",
      "source": "genai",
      "path": null,
      "compliance": {
        "badge": "FAIL",
        "checks": { "logoPresent": false, "colorsOk": false, "bannedWords": [] }
      }
    }
  ],
  "errors": [
    {
      "product": "brisa-berry",
      "market": "mx-es",
      "ratio": "9x16",
      "stage": "genai",
      "message": "OpenAI request timed out after 60s"
    }
  ]
}
```

- `creatives[].path` is repo-relative `string` on success, `null` on failure (D19). The grid renders a red placeholder tile for `null` paths. Join with `manifest.outputDir` (absolute) for filesystem operations; render `path` directly for repo-relative links.
- `errors[]` is the dedicated failure log: every `null`-path creative has a corresponding entry. Top-level `counts.failed === errors.length`.
- `source` ∈ `'local' | 'genai'`. `compliance.badge` ∈ `'OK' | 'WARN' | 'FAIL'`.
- `errors[].stage` ∈ `'resolve' | 'genai' | 'resize' | 'compose' | 'compliance' | 'write'` — names the pipeline stage that threw. Closed enum; do not invent new values without updating this table:

  | stage        | When it fires                                                                 |
  | ------------ | ----------------------------------------------------------------------------- |
  | `resolve`    | Asset Resolver couldn't read a pre-placed file (corrupt, EACCES, unreadable). |
  | `genai`      | OpenAI Images API call failed, timed out, or hit the daily cap.               |
  | `resize`     | Sharp threw decoding or resizing the source image.                            |
  | `compose`    | Text overlay / logo composite failed (font load, alpha-channel issue).        |
  | `compliance` | Compliance checker threw (palette sample, banned-words read, logo template).  |
  | `write`      | Output PNG write failed (ENOSPC, EACCES, path collision).                     |

**Parallel generation (D20)** — for each product, all requested ratios fan out via `Promise.all`. Markets iterate sequentially in the outer loop (deterministic log order); ratios run in parallel within each `(product, market)` pair. The sequence diagram caption in §4 reflects this.

- **S1 drop zone** → `POST /api/upload` then re-fetch `/api/detected-assets` (immediate).
- **S1 brief edit** → debounce 300 ms → re-fetch `/api/detected-assets`.
- **S2** consumes the generate stream and renders log lines as they arrive.
- **S3** hydrates from the **`complete` event's `manifest`** — no second `GET` to the filesystem, no race with disk writes.
- **S2′ (Failed)** is triggered by an `{ "type": "error", "message": "..." }` event or a stream-level failure.
- **S5 (Reveal)** uses `manifest.outputDir` for the server-action shell-out and as the copyable absolute path.

---

## 4.3 Implementation primitives

The contract layer above is what the user sees. These are the server-side primitives the implementer must wire — each one resolves a specific design decision so PR #2 opens with zero ambiguity.

### Per-brand profile (D11)

Cast serves arbitrary clients; brand identity is a per-campaign input, not a constant. The brief's required `brand` slug points to a directory:

```
inputs/brands/[brand-slug]/
├── brand.json          # primary/accent colors (hex), tokens
├── voice.json          # tone, do/don't lists, prompt fragments
├── logo.png            # corner-composited logo (PNG with alpha)
├── font.ttf            # OFL-licensed display font for text overlay (D10)
└── banned-words.json?  # optional brand-specific term list
```

The repo ships two demo profiles (`inputs/brands/brisa/` and `inputs/brands/volt/`), modeling the sub-brands of a fictional Onda Beverages portfolio. Onboarding a new brand is a directory drop — no code change. The Asset Resolver, prompt builder, and compliance checker all read from this directory based on `brief.brand`.

**One brand per brief.** A brief targets exactly one brand; portfolio runs are sequential briefs (Brisa run → Volt run → ...). Mixing brands in one brief breaks the brand-voice promise: each sub-brand has its own palette, banned-words list, and tone. Multi-brand briefs are listed in [§8 Future scope](#8-future-scope-v2--explicitly-out-of-poc).

**Brand discovery in S1.** S1's brand selector lists every directory found under `inputs/brands/`, served by **`GET /api/brands`**:

```
GET /api/brands
Response: [
  { "slug": "brisa", "displayName": "Brisa",  "hasBannedWords": true  },
  { "slug": "volt",  "displayName": "Volt",   "hasBannedWords": false }
]
```

The handler enumerates `inputs/brands/*/`, validates each subdirectory's slug against `SLUG_RE`, reads `displayName` from `brand.json`, and reports whether `banned-words.json` is present (drives the S1 pre-flight UI). Adding a profile makes it available in the UI on next page load — no rebuild.

**Brand existence + integrity check (server-side at `/api/generate` entry).** `briefSchema` validates the slug shape, not its presence on disk. Before the run starts, the orchestrator calls `loadBrandProfile(brief.brand)` which:

- Verifies `inputs/brands/[brand]/` exists → else throws `BrandNotFoundError` → mapped to `400 { errors: [{ path: ['brand'], message: 'unknown brand: ...' }] }`.
- Verifies required files exist (`brand.json`, `voice.json`, `logo.png`, `font.ttf`) → else throws `BrandIncompleteError` → mapped to `400 { errors: [{ path: ['brand', '<missing-file>'], message: '...' }] }`.
- Validates `brand.json` and `voice.json` against `brandProfileSchema` (see [Brand profile schema](#brand-profile-schema)) → else throws `BrandInvalidError` → mapped to `400` with the Zod issue path.
- On success, returns the parsed `BrandProfile` and caches it in-process for 90 s (cheap reads on repeat runs in the same `next dev` session).

This is the security boundary for the brand axis: every field that becomes a path segment is regex-validated by the schema **and** existence-validated by the loader before anything touches the filesystem.

### Brand profile schema (D11 — contract)

The brand directory is a typed contract, not a free-form folder. `loadBrandProfile(brand)` Zod-validates each file on first read and caches the parsed result for 90 s.

```ts
import { z } from "zod";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const brandColorsSchema = z.object({
  primary: z.string().regex(HEX),
  accent: z.string().regex(HEX),
  background: z.string().regex(HEX).optional(),
  text: z.string().regex(HEX).optional(),
});

export const brandJsonSchema = z.object({
  displayName: z.string().min(1),
  colors: brandColorsSchema,
  tokens: z.record(z.string(), z.string()).optional(),
});

export const voiceJsonSchema = z.object({
  tone: z.string().min(1),
  do: z.array(z.string()).default([]),
  dont: z.array(z.string()).default([]),
  promptFragments: z.array(z.string()).default([]),
});

export const bannedWordsSchema = z.array(z.string().min(1));

// Aggregator — the external contract `loadBrandProfile` validates against.
// system-map §3 references this symbol by name; the three per-file schemas
// above are its building blocks.
export const brandProfileSchema = z.object({
  brand: brandJsonSchema,
  voice: voiceJsonSchema,
  bannedWords: bannedWordsSchema.default([]),
});

export type BrandProfile = {
  slug: string;
  brand: z.infer<typeof brandJsonSchema>;
  voice: z.infer<typeof voiceJsonSchema>;
  bannedWords: string[]; // [] when banned-words.json is absent
  logoPath: string; // absolute, safeJoin-validated
  fontPath: string; // absolute, safeJoin-validated
};
```

**Missing `banned-words.json`** is allowed. The loader returns `bannedWords: []`, the orchestrator emits a `step` event — `{ \"type\": \"step\", \"message\": \"no banned-words list for brand X — skipping pre-flight + per-creative checks\" }` — and both client-side pre-flight and server-side per-creative checks become no-ops for that run. Optional means optional; visibility comes from the log line, not a blocked Generate.

### GenAI provider (D9)

OpenAI Images API. Model: `dall-e-3` for the default path; `gpt-image-1` when `CAST_GENAI_MODE=cheap`.

| Mode    | Model         | Calls per missing product | Sizes                                                              |
| ------- | ------------- | ------------------------- | ------------------------------------------------------------------ |
| Default | `dall-e-3`    | One per requested ratio   | `1024x1024` (1x1), `1792x1024` (16x9), `1024x1792` (9x16) — native |
| `cheap` | `gpt-image-1` | One per missing product   | `1024x1024` only; Sharp center-crops to 9x16 / 16x9                |

Mode is selected by env var **`CAST_GENAI_MODE`** (`default` | `cheap`, default `default`); the chosen mode is exposed to the UI via `GET /api/cap` so S1 renders a read-only mode badge. There is no CLI flag — this is a Next.js app, not a CLI. A missing product with all three ratios requested costs three API calls in default mode (no upscale loss, no center-crop). The `cheap` path costs one call, trading edge fidelity for spend.

### Prompt construction (D18)

Three-layer assembly, deterministic, no LLM-on-LLM:

1. Brand layer — read `inputs/brands/[brand]/voice.json` for tone, mood, banned imagery.
2. Product layer — merge per-product `promptOverrides` from the brief (environment, mood adjectives).
3. Template fn — a pure function `buildPrompt({ brandVoice, product, market, ratio })` returns the final string.

S1 renders the assembled prompt read-only beneath each missing product so the user sees what will hit the API before clicking Generate.

### Storage abstraction (D17)

One interface, one POC implementation:

```ts
interface Storage {
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}
```

POC ships `LocalFsStorage` resolving keys against `ROOTS = { inputs, outputs }` via `safeJoin`. S3 / Azure / Dropbox are single-class swaps documented as v2.

### Path safety primitives (D12, D13)

- `ROOTS = { inputs: path.resolve(cwd, 'inputs'), outputs: path.resolve(cwd, 'outputs') }`.
- `safeJoin(rootKey, ...segments)` resolves the absolute path then asserts `result.startsWith(ROOTS[rootKey] + path.sep)`. Mismatch → throw.
- Every `[campaign]`, `[brand]`, `[product-slug]`, `[market]` token is validated against its regex (`SLUG_RE` or `MARKET_RE`) **before** entering `safeJoin`.
- Shell calls (`revealOutputFolder`) use `execFile` with explicit argv — never `exec` with a composed string.

### Compliance + banned-words (D21)

Banned words are checked twice:

- **Client-side, pre-flight** — the editor in S1 cross-references the brief's message strings against `inputs/brands/[brand]/banned-words.json`. Hits disable the Generate button with an inline warning.
- **Server-side, post locale-resolution** — for each `(market, ratio)` the compliance checker re-checks the **resolved overlay string** (the exact string the compositor will draw, after locale lookup) against the brand's banned-words list. Hits flag the creative with `WARN` (or `FAIL` for high-severity terms) and append to `report.json`'s `errors[]`.

This is a string check, not OCR — the server composited the text itself, so OCR'ing the rendered PNG would be redundant and unreliable on stylized fonts. Catches both authoring mistakes (early) and locale-map errors that slip past pre-flight (late).

### Daily generation cap (D22)

- Env var `DAILY_GENERATION_LIMIT` (default `50`).
- **Source of truth: `outputs/.cap.json`** — a tiny file `{ \"date\": \"YYYY-MM-DD\", \"count\": N }` (UTC). The orchestrator reads it on every GenAI call, increments atomically (read → mutate → write via tmp-file rename), and rolls over to `count: 0` on date change. Survives `next dev` restarts.
- **Endpoint: `GET /api/cap`** — returns `{ remaining: number, limit: number, mode: 'default' | 'cheap' }`. Called by S1 on mount and after every `complete` event so the indicator stays accurate without manual refresh.
- **LocalStorage** is demoted to an **optimistic UI cache** — read-through for instant first paint, overwritten by the first `/api/cap` response. Never authoritative.
- Reaching the cap blocks new GenAI calls server-side; affected creatives emit an `error` event with `stage: 'genai'` and a human-readable cap message.
- Cap exists to keep demo spend deterministic.

---

## 5. Screen-state map — what changes within a screen

Because S1/S2/S3 are states of one page, here is the state machine for the main route `/`. Useful for the next step (wireframes) so we know what each state needs to render.

> **Retry guard.** The `Failed --> Running` transition below is gated: when `GET /api/cap` reports `remaining: 0` AND the failed `errors[].stage` was `genai`, the Retry button is disabled and only `Failed --> Editing` remains available (D22; mirrors the S2′ Inform attribute in [attributes-screen-requirements.md](attributes-screen-requirements.md)).

```mermaid
stateDiagram-v2
    [*] --> Editing
    Editing: S1 — Brief Editor visible<br/>Generate button enabled
    Editing --> Running: click Generate
    Running: S2 — Log streaming<br/>brief locked, no Generate
    Running --> Complete: run finishes
    Running --> Failed: run errors
    Failed --> Editing: click "edit brief"
    Failed --> Running: click "retry" [cap > 0 or stage ≠ genai]
    Complete: S3 — Grid visible<br/>badges rendered<br/>tiles clickable
    Complete --> DetailOpen: click flagged or failed tile
    DetailOpen: S4 — Creative Detail modal over grid
    DetailOpen --> Complete: close modal
    Complete --> Editing: click "edit brief & re-run"
```

---

## 6. Coverage check — every story verb has a screen

Final sanity pass. If any verb lacks a screen, the flow diagram is broken.

| Story verb                          | Screen                           | State                               |
| ----------------------------------- | -------------------------------- | ----------------------------------- |
| open app                            | S1                               | Editing                             |
| edit brief                          | S1                               | Editing                             |
| selects brand                       | S1 (Brand selector → `/api/brands`) | Editing                          |
| **drop product photos onto rows**   | S1 (drop zone → `/api/upload`)   | Editing                             |
| pre-place files in `inputs/assets/` | (filesystem path — Aaron's demo) | confirmed via Detected Assets panel |
| confirm assets will be picked up    | S1 (Detected Assets panel)       | Editing                             |
| sees GenAI mode                     | S1 (mode badge → `/api/cap`)     | Editing                             |
| sees remaining daily allocation     | S1 (Daily allocation indicator → `/api/cap`) | Editing                  |
| click Generate                      | S1                               | Editing → Running                   |
| watch pipeline log                  | S2                               | Running                             |
| recover from a run failure          | S2′                              | Failed                              |
| review output grid                  | S3                               | Complete                            |
| read compliance badge               | S3                               | Complete                            |
| click flagged tile                  | S3 → S4                          | Complete → DetailOpen               |
| click failed tile (`path === null`) | S3 → S4                          | Complete → DetailOpen (error mode)  |
| read compliance detail              | S4                               | DetailOpen                          |
| reveal output folder                | S3 → S5                          | Complete (server action)            |
| copy absolute output path           | S3                               | Complete                            |
| download files                      | OS file explorer                 | (post-handoff)                      |
| narrate demo                        | S2 + S3                          | Running, Complete                   |

Every verb maps to a screen, a state, or a defined action. No orphans.

---

## 7. What this unlocks

With screens + flow + states + API contract locked, the next step (wireframes) has a clean spec:

- **One Next.js route** (`/`) handling four states: `Editing`, `Running`, `Complete`, `Failed`.
- **One modal/drawer** for `DetailOpen` (S4).
- **One server action** for S5 — `revealOutputFolder(absPath)` reveals the generated output folder via the OS (`start` on Windows / `open` on macOS / `xdg-open` on Linux). `absPath` must be normalized and validated to remain within the expected outputs directory before invocation. Do **not** build the command via string interpolation or shell concatenation of untrusted input; use a `spawn`/`execFile`-style API with explicit args. Fallback: copyable absolute path on screen.
- **Per-product drop zone** on S1 → `POST /api/upload` (multipart, `productSlug` + `file`) writes to `inputs/assets/[slug].ext`.
- **Asset preview read** — `GET /api/detected-assets?slugs=...` on S1 mount (immediate), on brief change (300 ms debounced), and after each upload (immediate). Returns `[{ slug, foundFile | null }]` for the Detected Assets panel.
- **Streaming generate** — `POST /api/generate` returns NDJSON; terminal `complete` event carries the full manifest. S2 reads the stream; S3 hydrates from the manifest. **No separate output-read endpoint.**
- **One filename convention** — `[product-slug].{png,jpg,jpeg,webp}` — enforced server-side by `/api/upload` and matched by Resolver and Detected Assets panel. Maya never has to type a slug.

Everything else is wireframe craft.

---

## 8. Future scope (v2+) — explicitly out of POC

Captured here so the POC's omissions are deliberate, not accidental:

- **YAML brief import** — parser swap behind the same Zod schema; ~30-line change.
- **Cloud storage backends** — S3 / Azure / Dropbox, swapped behind the `Storage` interface (D17).
- **Outpainting / aspect extension** — `gpt-image-1` `images.edit` for true ratio extension instead of native-ratio rendering.
- **Edge transforms** — ImageKit-style URL-driven crops/transforms for downstream platform variants.
- **Brief Interpreter** — natural-language brief → structured Zod brief (LLM-assisted, validated).
- **Brand-voice editor** — Studio-like UI for `inputs/brands/[brand]/voice.json`.
- **Multi-run history** — persist past runs, side-by-side comparison, approvals.
- **Comments + approval workflow** — Priya marks creatives approved/rejected with comments persisted to manifest.
- **Translation API** — auto-fill `message{}` for missing locales.
- **Multi-logo per brand** — primary/secondary/dark/light variants selected per ratio.
- **Per-market brand variations** — region-specific palette/voice overrides under `inputs/brands/[brand]/markets/[market]/`.
- **Multi-brand campaign briefs** — single brief targeting multiple sub-brands in one run (e.g. an Onda portfolio launch covering both Brisa and Volt). Requires a `brands[]` field, per-product brand tagging, an extra `[brand]` segment in the output tree, and per-product compliance switching. Out of POC because it changes the campaign contract and dilutes the brand-voice promise; portfolio runs today are sequential single-brand briefs.
- **Motion creatives** — animated outputs (5-second loops, `.gif` and `.mp4` parallel to `.png` per ratio). Pipeline fan-out becomes `(product × market × ratio × format)`. Resolver, compositor, and storage each gain a format axis. Compliance gains motion-specific checks (frame-1 logo presence, looping integrity).

---

## Appendix A — Design decision register

**Canonical decision register for the Cast POC.** Every `Dn` referenced in any doc resolves here. Numbers are append-only — never renumber (preserves grep stability across the doc set). Adding a new decision means appending the next free number and updating this table in the same commit.

| ID  | Decision                                         | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Markets × locales × tree shape                   | Output tree includes `[market]` segment: `outputs/[campaign]/[market]/[product]/[ratio].png`. Locale derived: `locale = market.split('-').pop()`. Brief rejected if any market's locale is missing from `message{}`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| D2  | Brief schema — single source of truth            | One Zod `briefSchema` defined in [§4.2](#42-api-contract--streaming-generate--light-uploadpreview). Same schema used client-side (editor validation) and server-side (`/api/generate` entry). Other docs reference the schema; do not restate field shapes elsewhere.                                                                                                                                                                                                                                                                                                                                                             |
| D3  | Manifest + `report.json` shape                   | One canonical object (camelCase). The `manifest` delivered in the `complete` event === `report.json` content on disk. Includes `counts`, per-creative `source`/`compliance`/`path` (nullable), `errors[]`. See [§4.2](#42-api-contract--streaming-generate--light-uploadpreview).                                                                                                                                                                                                                                                                                                                                                 |
| D4  | JPEG handling                                    | Read-only acceptance for pre-placed `.jpeg`. Uploads canonicalize to `.jpg` (MIME-derived). Resolver lookup: `{png, jpg, jpeg, webp}`. Disk write extensions: `{png, jpg, jpeg, webp}`. Output always `.png`.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D5  | Asset path placeholder                           | `inputs/assets/[product-slug].{png,jpg,jpeg,webp}` everywhere — single placeholder convention.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D6  | Output path leading slash                        | Tree visuals are repo-relative (no leading `/`). Absolute paths only in `manifest.outputDir` and S3 copyable code block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D7  | Ratio naming                                     | `1x1` / `9x16` / `16x9` for data, filenames, schema enum. `1:1` / `9:16` / `16:9` only in display strings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D8  | Locale / market field shape                      | `markets: string[]` (form `<region>-<lang>`, validated by `MARKET_RE`). `message: Record<lang, string>`. No separate `locales` field; no singular `region`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D9  | GenAI provider                                   | OpenAI Images API. `dall-e-3` default (3 native sizes, 1 call per ratio); `gpt-image-1` when `CAST_GENAI_MODE=cheap` (1 call total + Sharp center-crop).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D10 | Display font                                     | OFL-licensed `font.ttf` shipped per brand at `inputs/brands/[brand]/font.ttf`. Compositor loads it; no system-font fallback (deterministic across machines).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D11 | Per-brand profile                                | `inputs/brands/[brand]/` directory contract: `brand.json`, `voice.json`, `logo.png`, `font.ttf`, optional `banned-words.json`. Validated by `brandProfileSchema`. Demo brands `brisa` and `volt` ship with the repo (sub-brands of fictional Onda Beverages).                                                                                                                                                                                                                                                                                                                                                                     |
| D12 | Path safety: `safeJoin`                          | Every filesystem write resolves through `safeJoin(rootKey, ...segments)` against `ROOTS = { inputs, outputs }`; mismatch throws.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D13 | Path safety: regex-validated tokens + `execFile` | `[campaign]`, `[brand]`, `[product-slug]`, `[market]` validated against `SLUG_RE` / `MARKET_RE` before `safeJoin`. Shell calls use `execFile` + explicit argv.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D14 | Streaming render mode                            | S2 log + progress update incrementally on each NDJSON event; output grid hydrates only on the terminal `complete` event (no flicker, clean S2→S3 transition).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D15 | Run idempotency                                  | Both Generate (S1) and Retry (S2′) clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). `brief.json` and `report.json` are run-scoped products of the run, not preserved artifacts — the recursive clear is what guarantees a failed run cannot leave a stale `report.json` claiming success on disk. End state of any successful run is invariant under retry. No partial-resume; no orphan folders across runs. The cap file at `outputs/.cap.json` (D22) lives one level above the campaign root and is not affected. |
| D16 | `.gitignore`                                     | `coverage/`, `.swc/`, `outputs/` fully ignored. `inputs/brands/` directory allowlisted so demo brand profiles are version-controlled.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D17 | Storage abstraction                              | `Storage` interface (`read`/`write`/`list`/`exists`); POC ships `LocalFsStorage`; cloud backends (S3 / Azure / Dropbox) are a single-class swap, deferred to v2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D18 | Prompt construction                              | Three-layer deterministic assembly: brand voice → product overrides → pure `buildPrompt({...})`. No LLM-on-LLM. S1 renders the assembled prompt read-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D19 | `creatives[].path` is nullable                   | Repo-relative `string` on success, `null` on failure. Grid renders a red placeholder tile for `null`. `counts.failed === errors.length`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D20 | Concurrency model                                | Markets sequential (deterministic log order); ratios fan out via `Promise.all` per `(product, market)` pair. System-map sequence diagram uses `par`/`and`/`end`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D21 | Compliance + banned-words                        | Two-pass string check (NOT OCR): client-side pre-flight against `brief.message`; server-side post locale-resolution against the resolved overlay string.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D22 | Daily generation cap                             | `DAILY_GENERATION_LIMIT` env (default 50). SoT: `outputs/.cap.json` `{ date, count }` (UTC). `GET /api/cap` is the read endpoint. LocalStorage = optimistic only. The cap file sits at `outputs/.cap.json` (one level above any `outputs/[campaign]/`) so D15's recursive campaign clear cannot wipe it.                                                                                                                                                                                                                                                                                                                          |
| D23 | Target audience field                            | `audience` stays a freeform string (`z.string().min(1).max(500)`). Fed deterministically into `buildPrompt`. No tag UI / structured parsing in POC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D24 | Markets typeahead                                | Schema stays `markets: string[]` with `MARKET_RE`. S1 UI offers a typeahead with seed values (`us-en`, `mx-es`, `de-de`, `jp-ja`); users may type any conforming value.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D25 | Ratio picker                                     | Schema enum locked to `[1x1, 9x16, 16x9]` for v1. S1 exposes pill toggles, default all checked, at least one required. `4x5` / `2x1` deferred to v1.5 (out of POC).                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D26 | Animated formats                                 | `.gif`, `.mp4`, `.webm` rejected at upload (415) and ignored at resolve. Output creatives are always `.png`. Motion creatives are v2 (Future scope §8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

_Cast · Flow Diagrams v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
