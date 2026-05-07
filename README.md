# Cast - Creative Automation Studio Toolchain

> From brief to broadcast. A creative automation studio toolchain that turns one campaign brief into on-brand, localized social ad creatives at three aspect ratios.

---

## Quick Start

### Prerequisites

- **Node.js ≥ 20 LTS** (`node --version`)
- **pnpm** (`npm install -g pnpm` or `corepack enable`)
- An **`OPENAI_API_KEY`** with access to `dall-e-3` (default) or `gpt-image-1` (`CAST_GENAI_MODE=cheap`)

### Install & run

```bash
git clone https://github.com/arndvs/cast.git
cd cast
cp .env.example .env.local          # paste your OPENAI_API_KEY
pnpm install
pnpm dev
# → open http://localhost:3000
```

The app boots with the demo brief at [`inputs/brief.json`](inputs/brief.json) pre-loaded. Click **Generate** to run the pipeline. Outputs land at:

```
outputs/[campaign]/[market]/[product]/[ratio].png
outputs/[campaign]/brief.json    # snapshot of the brief that produced this run
outputs/[campaign]/report.json   # compliance + legal check results
```

See [docs/system-map.md](docs/system-map.md) for the canonical filesystem layout.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next dev server (Turbopack) on `http://localhost:3000` |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (one-shot) |
| `pnpm test:watch` | Vitest in watch mode |

### Troubleshooting

- **`OPENAI_API_KEY missing` / 401 on Generate.** Confirm `.env.local` exists at the repo root and contains `OPENAI_API_KEY=sk-...`. Restart `pnpm dev` after editing — Next reads env files at process start.
- **`Brand fixture not found` / brand selector is empty.** The brand picker lists directories under `inputs/brands/` (populated at server start via `listBrandSlugs`). The repo ships `brisa/` and `volt/`. If you removed them or your brief references a slug with no matching directory, the editor shows the missing-brand banner and gates Generate. Restore the directory or pick a brand that exists. Note: color chips and the product catalog in the sidebar are only available for the bundled seed brands.
- **Port 3000 already in use.** `pnpm dev` defaults to `http://localhost:3000`; if 3000 is busy, Next/Turbopack will pick the next free port and log it to the terminal — open that URL instead. To pin a port explicitly, run `pnpm dev -- -p 3001` (or kill the process on 3000).
- **Local-mode skipping the GenAI call.** The pipeline prefers a pre-placed asset at `inputs/assets/[product-slug].{png,jpg,jpeg,webp}` over a GenAI call. If that directory is missing or the file extension does not match the allowlist, the resolver falls back to GenAI — create `inputs/assets/` and drop the file with one of the four supported extensions.

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
| **Storage backend**   | Local filesystem                                                            | Brief permits Azure / AWS / Dropbox. Local FS is the only option that runs from a clean checkout in under three minutes (Story 1's success metric). Export is handled via client-side ZIP download (zero config, works localhost). Cloud-native export (Dropbox Saver, API v2) is deferred to v2 — see [V2 Upgrade Paths](#v2-upgrade-paths) below. |
| **Framework**         | Next.js (local web app)                                                     | Brief permits CLI or simple local app. The web app surfaces the live pipeline log and output grid in-browser — the centerpiece of Story 1 (Maya) and Story 3 (Aaron's demo). A CLI hides the pipeline from the audience.                                  |
| **Image processing**  | Sharp                                                                       | Battle-tested, fast, no native binary surprises in CI.                                                                                                                                                                                                    |
| **API style**         | NDJSON streaming for `/api/generate`                                        | One request, terminal `complete` event carries the manifest. UI hydrates from the manifest — no second filesystem read, no race with disk writes.                                                                                                         |
| **Path I/O safety**   | `safeJoin` helper + `SLUG_RE` validation at every boundary                  | `revealOutputFolder`, `/api/upload`, `/api/detected-assets`, and Sharp file reads all interpolate user-influenced strings. Validating every path is a child of a known root prevents traversal. `execFile` with explicit argv prevents shell injection.   |
| **Upload limits**     | 5 MB max, MIME-allowlisted (PNG / JPEG / WebP), canonical extension mapping | Sharp can OOM on very large files. Canonical extension mapping (`jpeg → .jpg`) prevents stale-shadow files when re-uploading.                                                                                                                             |
| **Compliance checks** | Heuristic — logo presence, brand-color sampling, banned-word list         | Demonstrates the surface; not a substitute for legal review.                                                                                                                                                                                              |
| **Per-brand profile** | Required `brand` slug → `inputs/brands/[brand]/` directory                  | Cast serves arbitrary clients. Brand identity (colors, voice, logo, font, banned words) lives per-brand on disk; a new brand is a directory drop, not a code change. The demo ships two profiles — `brisa` (sparkling water) and `volt` (energy) — sub-brands of the fictional Onda Beverages parent. One brief targets one brand; portfolio runs are sequential briefs.                                       |
| **GenAI provider**    | OpenAI — `dall-e-3` default (3 native ratios), `gpt-image-1` when `CAST_GENAI_MODE=cheap` | `dall-e-3` natively renders 1024×1024 / 1792×1024 / 1024×1792, so the three ratios are three API calls with no center-crop loss. `cheap` mode collapses to one `gpt-image-1` call + Sharp center-crop for budget-constrained demos.                       |

See [docs/](docs/) for the full design trail: [user stories](docs/user-stories.md) → [system map](docs/system-map.md) → [flow diagrams](docs/flow-diagrams.md) → [attributes & screens](docs/attributes-screen-requirements.md). Visual reference: [docs/design/cast-brand-guidelines.html](docs/design/cast-brand-guidelines.html) (with sibling guidelines for [onda](docs/design/onda-brand-guidelines.html), [brisa](docs/design/brisa-brand-guidelines.html), [volt](docs/design/volt-brand-guidelines.html)).

---

## Assumptions & limitations

- **Single-machine, single-user, no auth.** Runs against `localhost:3000`. No multi-tenancy, no session, no role separation.
- **Local filesystem only.** No S3 / Azure / Dropbox in the POC. The brief permits any of these; chosen scope cut.
- **One asset per product slug at a time.** Re-uploading a photo for the same product overwrites the previous file (and its alternate-extension siblings).
- **GenAI provider: OpenAI Images API.** Default model `dall-e-3` calls one of three native sizes (1024×1024 / 1792×1024 / 1024×1792) per requested ratio, behind `OPENAI_API_KEY`. Setting `CAST_GENAI_MODE=cheap` swaps to `gpt-image-1` + Sharp center-crop. Provider abstraction is deferred to v2.
- **Static raster only.** Output creatives are PNG. Animated formats (GIF, MP4, WebM) are rejected at upload (`415`) and ignored by the resolver. Motion creatives are a separate capability, out of POC scope.
- **Compliance checks are heuristic, not a legal review.** Logo presence is detected by template match in a configurable corner; brand-color check samples dominant colors; banned-word check is a flat list scan against the resolved overlay string per `(market, ratio)` (the exact string the compositor draws — not an OCR pass on the PNG). The editor pre-flights the same matcher against the same merged list — `BrandProfile.bannedWords` (default floor ∪ `inputs/brands/[slug]/banned-words.json`, built once on the server in `loadBrandProfile` and forwarded to the client) — across the audience + every locale message, and disables Generate when a banned-list term is present, so the spend is gated before the GenAI call rather than after compliance fails post-hoc.
- **Banned-word floor is intentionally narrow for the POC.** `getDefaultBannedWords()` covers a small universal floor (violence, hate, NSFW, weapons, drugs, self-harm) plus per-brand additions from `inputs/brands/[brand]/banned-words.json`. A production list would expand to common slurs, the strong-profanity family, and leetspeak/punctuation-obfuscation variants of items already on the floor (`n@zi`, `b0mb`, `m3th`, etc.) to defeat trivial bypass. False-positive review against shipping brand fixtures is the gating cost — out of POC scope.
- **No run history.** Each Generate run is independent. No multi-run comparison view in the POC.
- **Cloud export requires a tunnel or public deployment.** The Dropbox Saver (v2 path) requires Dropbox's servers to fetch files from your URLs — `localhost` is unreachable from the internet. See [V2 Upgrade Paths](#v2-upgrade-paths).
- **Generate and Retry are destructive at the campaign root (clears `outputs/[campaign]/` recursively at run start).** Both clear `outputs/[campaign]/` recursively at run start, then immediately rewrite `brief.json` (before the per-product loop) and `report.json` (after the loop). `brief.json` and `report.json` are run-scoped products, not preserved artifacts — the recursive clear ensures a failed run cannot leave a stale `report.json` claiming success on disk. End state of any successful run is invariant under retry.
- **Symlinks under `inputs/` and `outputs/` are not followed safely.** `safeJoin` validates that a path is a lexical child of a known root, but does not call `realpath` to re-validate after symlink resolution. Production hardening would add `fs.realpath` re-validation at every boundary that interpolates user-influenced strings (`/api/upload`, `/api/detected-assets`, the `revealOutputFolder` server action, Sharp reads). Implementers touching those routes should add a `TODO(symlink-hardening)` comment alongside each `safeJoin` call so the gap stays visible. Out of POC scope.
- **Brand-profile cache is time-based, not file-watched.** `loadBrandProfile` caches parsed brand state (`brand.json`, `voice.json`, `banned-words.json`, `logos.json`) for 90 s in-process. Edits to `inputs/brands/[brand]/*` mid-session may not take effect until the cache expires; restart `next dev` to force-refresh. Accepted POC behavior — production would invalidate on file mtime.
- **Localized message support is provided-not-translated.** The brief carries a locale → string map; the pipeline composites the right one. It does not call a translation API.
- **`manifest.outputDir` is an absolute filesystem path exposed to the client by design.** S5 (Reveal in file explorer) needs an absolute path to hand to the OS shell command. Acceptable in a localhost-only POC; for any networked deployment, the manifest would expose only the repo-relative `creatives[].path` and the reveal action would resolve absolutes server-side.

---

## V2 Upgrade Paths

### Cloud Export — Dropbox (optional)

The output grid includes an **Export to Dropbox** button that uses the [Dropbox Saver](https://www.dropbox.com/developers/saver) drop-in. It is fully wired but **disabled by default** — it only activates when a Dropbox App key is configured. The button is not required for the POC workflow; all core export needs are met by **Reveal in folder** and the JSON downloads.

> **Why is this optional?** The POC's core contract is "runs from a clean checkout in under three minutes." Enabling Saver requires a Dropbox developer account, a tunnel to expose localhost, and domain allowlist configuration — that exceeds the 3-minute bar. It's included as working code to demonstrate the cloud export surface, not as a reviewer requirement.

#### Prerequisites

- A [Dropbox account](https://www.dropbox.com/) (free tier is fine)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`cloudflared`) — to make localhost reachable from the internet

> **Why a tunnel?** Dropbox Saver works by having *Dropbox's servers* fetch files from URLs you provide. On `localhost:3000` those URLs are unreachable from the internet. A tunnel gives you a public `https://` URL that proxies to your local dev server. Cloudflare Tunnel is recommended over ngrok because ngrok's free tier injects an interstitial page that blocks Dropbox's server-side fetch.

#### Setup steps (~5 minutes, one-time)

**1. Create a Dropbox App**

1. Go to [dropbox.com/developers/apps/create](https://www.dropbox.com/developers/apps/create)
2. Choose **Scoped access** → **Full Dropbox**
3. Name it (e.g. `CAST Export`) → **Create app**
4. On the Settings page, copy the **App key** (alphanumeric string at the top)

**2. Configure the env var**

Add to `.env.local`:

```env
NEXT_PUBLIC_DROPBOX_APP_KEY=<your-app-key>
```

Restart the dev server (`pnpm dev`) to pick up the new variable.

**3. Start a Cloudflare Tunnel**

```bash
# Install (one-time)
# Windows: curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o ~/bin/cloudflared.exe
# macOS:   brew install cloudflared

# Start tunnel (no Cloudflare account needed)
cloudflared tunnel --url http://localhost:3000
# → Your quick Tunnel has been created! Visit it at:
# → https://<random-words>.trycloudflare.com
```

**4. Add the tunnel domain to Dropbox**

In your Dropbox app's Settings → **Chooser/Saver/Embedder domains** → add the tunnel domain (e.g. `random-words.trycloudflare.com`, without `https://`).

**5. Test it**

1. Open Cast via the tunnel URL (e.g. `https://random-words.trycloudflare.com`)
2. Run a generate (or navigate to the output grid if outputs exist)
3. Click **Export to Dropbox** → authenticate in the popup → choose a folder → Save
4. Verify files appear in your Dropbox

> **Note:** Cloudflare quick tunnels generate a new random subdomain each time you restart. You'll need to update the Dropbox domain allowlist when the subdomain changes. For a stable subdomain, create a [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps) with a Cloudflare account.

#### V2b — Dropbox API v2 (future)

For batch/headless workflows where a popup is impractical, the next tier is [Dropbox API v2](https://www.dropbox.com/developers/documentation/http/documentation#files-upload) with OAuth2 PKCE (`files.content.write` scope). This pushes files server-side via `content.dropboxapi.com/2/files/upload` (≤150 MB per file) — no tunnel needed since the server initiates the upload. This is a significantly larger integration (OAuth flow, token refresh, upload chunking) and is deferred beyond the POC.

---

## Onboarding a new brand

Drop a directory under `inputs/brands/`:

```
inputs/brands/[brand-slug]/
├── brand.json          # primary/accent colors (hex), tokens
├── voice.json          # tone, do/don't lists, prompt fragments
├── logos/              # corner-composited logo variants (four per brand: primary-on-light/dark, mono-white/black)
│   ├── logos.json      # { default: variantId, variants: [{ id, displayName, file }] }
│   ├── primary-on-light.png
│   ├── primary-on-dark.png
│   ├── mono-white.png
│   └── mono-black.png
├── font.ttf            # OFL display font
└── banned-words.json?  # optional brand-specific terms (added on top of lib defaults — union, never replacement)
```

Reference it from a brief: `"brand": "[brand-slug]"`. No code change. The repo ships two seed profiles — `inputs/brands/brisa/` (sparkling water) and `inputs/brands/volt/` (energy) — representing two sub-brands of the fictional Onda Beverages portfolio. Use them as templates. The recipe for reducing a brand book (HTML, PDF, Figma) into the JSON files above is in [docs/brand-extraction.md](docs/brand-extraction.md).

The brand selector lists every directory found under `inputs/brands/`, so adding a new profile makes it available in the UI on the next page load.
