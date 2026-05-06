# Cast

> From brief to broadcast. A creative-automation pipeline that turns one campaign brief into on-brand, localized social ad creatives at three aspect ratios.

**POC · Aaron Davis · 2026**

> **Status: spec-locked, app coming next.** This branch ships the full architectural spec (briefSchema, output tree, manifest, GenAI primitives, streaming contract). Runtime scaffolding (`package.json`, route handlers) lands in PR #3. The Quick Start below describes the **target** developer experience the spec resolves to.

---

## Quick Start

```bash
git clone https://github.com/arndvs/cast.git
cd cast
cp .env.example .env          # add your OPENAI_API_KEY
npm install
npm run dev
# → open http://localhost:3000
```

The app starts with `inputs/brief.json` pre-loaded. Click **Generate** to run the pipeline. Outputs land in `outputs/[campaign]/[market]/[product]/[ratio].png`. See [docs/system-map.md](docs/system-map.md) for the canonical filesystem layout.

---

## Example input

[`inputs/brief.json`](inputs/brief.json) — ships with the repo:

```json
{
  "campaign": "summer-refresh-2026",
  "brand": "brisa",
  "products": [
    { "name": "Brisa Citrus", "sku": "BRS-CIT-12" },
    { "name": "Brisa Berry", "sku": "BRS-BRY-12" }
  ],
  "markets": ["us-en", "mx-es"],
  "audience": "18-34, urban, health-conscious",
  "message": {
    "en": "Crack open something brighter.",
    "es": "Abre algo más brillante."
  },
  "ratios": ["1x1", "9x16", "16x9"]
}
```

Drop product photos into the per-product drop zone in the UI (or pre-place files at `inputs/assets/[product-slug].{png,jpg,jpeg,webp}`). Anything missing is generated via the GenAI image API.

## Example output

```
outputs/
└── summer-refresh-2026/
    ├── us-en/
    │   ├── brisa-citrus/
    │   │   ├── 1x1.png
    │   │   ├── 9x16.png
    │   │   └── 16x9.png
    │   └── brisa-berry/
    │       ├── 1x1.png
    │       ├── 9x16.png
    │       └── 16x9.png
    ├── mx-es/
    │   ├── brisa-citrus/
    │   │   ├── 1x1.png
    │   │   ├── 9x16.png
    │   │   └── 16x9.png
    │   └── brisa-berry/
    │       ├── 1x1.png
    │       ├── 9x16.png
    │       └── 16x9.png
    ├── brief.json
    └── report.json    # compliance + legal check results
```

File path shape: `outputs/[campaign]/[market]/[product]/[ratio].png`. The locale used for compositing copy is derived from the market: `locale = market.split('-').pop()`.

---

## Key design decisions

| Decision              | Choice                                                                      | Rationale                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brief format**      | JSON only                                                                   | Brief permits JSON or YAML. JSON gives a dependency-light editor (`<textarea>` + `JSON.parse`) and matches `Content-Type: application/json` end-to-end. YAML import deferred to v2 — Zod schema is the contract; swapping the parser is a 30-line change. |
| **Storage backend**   | Local filesystem                                                            | Brief permits Azure / AWS / Dropbox. Local FS is the only option that runs from a clean checkout in under three minutes (Story 1's success metric). Cloud storage is a v2 conversation.                                                                   |
| **Framework**         | Next.js (local web app)                                                     | Brief permits CLI or simple local app. The web app surfaces the live pipeline log and output grid in-browser — the centerpiece of Story 1 (Maya) and Story 3 (Aaron's demo). A CLI hides the pipeline from the audience.                                  |
| **Image processing**  | Sharp                                                                       | Battle-tested, fast, no native binary surprises in CI.                                                                                                                                                                                                    |
| **API style**         | NDJSON streaming for `/api/generate`                                        | One request, terminal `complete` event carries the manifest. UI hydrates from the manifest — no second filesystem read, no race with disk writes.                                                                                                         |
| **Path I/O safety**   | `safeJoin` helper + `SLUG_RE` validation at every boundary                  | `revealOutputFolder`, `/api/upload`, `/api/detected-assets`, and Sharp file reads all interpolate user-influenced strings. Validating every path is a child of a known root prevents traversal. `execFile` with explicit argv prevents shell injection.   |
| **Upload limits**     | 5 MB max, MIME-allowlisted (PNG / JPEG / WebP), canonical extension mapping | Sharp can OOM on very large files. Canonical extension mapping (`jpeg → .jpg`) prevents stale-shadow files when re-uploading.                                                                                                                             |
| **Compliance checks** | Heuristic — logo presence, brand-color sampling, banned-word list         | Demonstrates the surface; not a substitute for legal review.                                                                                                                                                                                              |
| **Per-brand profile** | Required `brand` slug → `inputs/brands/[brand]/` directory                  | Cast serves arbitrary clients. Brand identity (colors, voice, logo, font, banned words) lives per-brand on disk; a new brand is a directory drop, not a code change. The demo ships two profiles — `brisa` (sparkling water) and `volt` (energy) — sub-brands of the fictional Onda Beverages parent. One brief targets one brand; portfolio runs are sequential briefs.                                       |
| **GenAI provider**    | OpenAI — `dall-e-3` default (3 native ratios), `gpt-image-1` when `CAST_GENAI_MODE=cheap` | `dall-e-3` natively renders 1024×1024 / 1792×1024 / 1024×1792, so the three ratios are three API calls with no center-crop loss. `cheap` mode collapses to one `gpt-image-1` call + Sharp center-crop for budget-constrained demos.                       |
| **Daily spend cap**   | `DAILY_GENERATION_LIMIT` env (default 50)                                  | POC demo discipline. Hard cap on GenAI calls per local day. **Source of truth: `outputs/.cap.json` `{ date, count }`** (UTC, atomic tmp-file rename) — survives `next dev` restarts. `GET /api/cap` reads it; the terminal NDJSON event of `/api/generate` returns the post-run `{ used, limit, remaining }`. Browser LocalStorage is an optimistic UI cache only — used for instant first paint, immediately overwritten by the next server response, never authoritative for enforcement. UI must never gate the Generate button on LocalStorage alone. The cap file lives at `outputs/.cap.json` (one level above any campaign root) so D15's recursive campaign clear cannot wipe it. |

See [docs/](docs/) for the full design trail: [user stories](docs/user-stories.md) → [system map](docs/system-map.md) → [flow diagrams](docs/flow-diagrams.md) → [attributes & screens](docs/attributes-screen-requirements.md). Visual reference: [docs/design/cast-brand-guidelines.html](docs/design/cast-brand-guidelines.html) (with sibling guidelines for [onda](docs/design/onda-brand-guidelines.html), [brisa](docs/design/brisa-brand-guidelines.html), [volt](docs/design/volt-brand-guidelines.html)).

---

## Assumptions & limitations

- **Single-machine, single-user, no auth.** Runs against `localhost:3000`. No multi-tenancy, no session, no role separation.
- **Local filesystem only.** No S3 / Azure / Dropbox in the POC. The brief permits any of these; chosen scope cut.
- **One asset per product slug at a time.** Re-uploading a photo for the same product overwrites the previous file (and its alternate-extension siblings).
- **GenAI provider: OpenAI Images API.** Default model `dall-e-3` calls one of three native sizes (1024×1024 / 1792×1024 / 1024×1792) per requested ratio, behind `OPENAI_API_KEY`. Setting `CAST_GENAI_MODE=cheap` swaps to `gpt-image-1` + Sharp center-crop. Provider abstraction is deferred to v2.
- **Static raster only.** Output creatives are PNG. Animated formats (GIF, MP4, WebM) are rejected at upload (`415`) and ignored by the resolver. Motion creatives are a separate capability, out of POC scope.
- **Compliance checks are heuristic, not a legal review.** Logo presence is detected by template match in a configurable corner; brand-color check samples dominant colors; banned-word check is a flat list scan against the resolved overlay string per `(market, ratio)` (the exact string the compositor draws — not an OCR pass on the PNG).
- **No run history.** Each Generate run is independent. No multi-run comparison view in the POC.
- **Generate and Retry are destructive at the campaign root (D15).** Both clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). `brief.json` and `report.json` are run-scoped products, not preserved artifacts — the recursive clear ensures a failed run cannot leave a stale `report.json` claiming success on disk. End state of any successful run is invariant under retry. The cap file at `outputs/.cap.json` is one level above the campaign root and is not touched by the clear.
- **Symlinks under `inputs/` and `outputs/` are not followed safely.** `safeJoin` validates that a path is a lexical child of a known root, but does not call `realpath` to re-validate after symlink resolution. Production hardening would add `fs.realpath` re-validation at every boundary that interpolates user-influenced strings (`/api/upload`, `/api/detected-assets`, the `revealOutputFolder` server action, Sharp reads). Implementers touching those routes in PR #3 should add a `TODO(symlink-hardening)` comment alongside each `safeJoin` call so the gap stays visible. Out of POC scope.
- **Localized message support is provided-not-translated.** The brief carries a locale → string map; the pipeline composites the right one. It does not call a translation API.
- **`manifest.outputDir` is an absolute filesystem path exposed to the client by design.** S5 (Reveal in file explorer) needs an absolute path to hand to the OS shell command. Acceptable in a localhost-only POC; for any networked deployment, the manifest would expose only the repo-relative `creatives[].path` and the reveal action would resolve absolutes server-side.

---

## Onboarding a new brand

Drop a directory under `inputs/brands/`:

```
inputs/brands/[brand-slug]/
├── brand.json          # primary/accent colors (hex), tokens
├── voice.json          # tone, do/don't lists, prompt fragments
├── logo.png            # corner-composited logo
├── font.ttf            # OFL display font
└── banned-words.json?  # optional, brand-specific
```

Reference it from a brief: `"brand": "[brand-slug]"`. No code change. The repo ships two demo profiles — `inputs/brands/brisa/` (sparkling water) and `inputs/brands/volt/` (energy) — representing two sub-brands of the fictional Onda Beverages portfolio. Use them as templates.

S1's brand selector lists every directory found under `inputs/brands/`, so adding a new profile makes it available in the UI on the next page load.

---

## Project status

This branch contains **design documentation only**. PRs #1 and #2 carried the design lockdown; runtime scaffolding lands in PR #3.
