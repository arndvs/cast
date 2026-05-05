# Cast

> From brief to broadcast. A creative-automation pipeline that turns one campaign brief into on-brand, localized social ad creatives at three aspect ratios.

**POC · Aaron Davis · 2026**

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

The app starts with `inputs/brief.json` pre-loaded. Click **Generate** to run the pipeline. Outputs land in `outputs/[campaign]/[product]/[ratio].png`. See [docs/system-map.md](docs/system-map.md) for the canonical filesystem layout.

---

## Example input

[`inputs/brief.json`](inputs/brief.json) — ships with the repo:

```json
{
  "campaign": "summer-refresh-2026",
  "brand": "sparkling-co",
  "products": [
    { "name": "Sparkling Citrus", "sku": "SPK-CIT-12" },
    { "name": "Sparkling Berry", "sku": "SPK-BRY-12" }
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

Drop product photos into the per-product drop zone in the UI (or pre-place files at `inputs/assets/[product-slug].{png,jpg,webp}`). Anything missing is generated via the GenAI image API.

## Example output

```
outputs/
└── summer-refresh-2026/
    ├── sparkling-citrus/
    │   ├── 1x1.png
    │   ├── 9x16.png
    │   └── 16x9.png
    ├── sparkling-berry/
    │   ├── 1x1.png
    │   ├── 9x16.png
    │   └── 16x9.png
    ├── brief.json
    └── report.json    # compliance + legal check results
```

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

See [docs/](docs/) for the full design trail: [user stories](docs/user-stories.md) → [system map](docs/system-map.md) → [flow diagrams](docs/flow-diagrams.md) → [attributes & screens](docs/attributes-screen-requirements.md). Visual reference: [docs/cast-brand-guidelines.html](docs/cast-brand-guidelines.html).

---

## Assumptions & limitations

- **Single-machine, single-user, no auth.** Runs against `localhost:3000`. No multi-tenancy, no session, no role separation.
- **Local filesystem only.** No S3 / Azure / Dropbox in the POC. The brief permits any of these; chosen scope cut.
- **One asset per product slug at a time.** Re-uploading a photo for the same product overwrites the previous file (and its alternate-extension siblings).
- **GenAI provider: OpenAI `gpt-image-1`.** The Asset Resolver calls the OpenAI Images API behind `OPENAI_API_KEY`. Single endpoint, single model — provider abstraction is deferred to v2.
- **Compliance checks are heuristic, not a legal review.** Logo presence is detected by template match in a configurable corner; brand-color check samples dominant colors; banned-word check is a flat list scan against the rendered overlay text.
- **No run history.** Each Generate run is independent. No multi-run comparison view in the POC.
- **Symlinks under `inputs/` and `outputs/` are not followed safely.** Production hardening would add `realpath` re-validation; out of POC scope.
- **Localized message support is provided-not-translated.** The brief carries a locale → string map; the pipeline composites the right one. It does not call a translation API.

---

## Project status

This branch contains **design documentation only**. Application code lands in subsequent PRs. See pull request #1 for the design review trail.
