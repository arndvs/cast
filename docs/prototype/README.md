# Cast — Vanilla React Prototype

A clickable lo-fi prototype of the Cast studio toolchain (S1 brief → S2 run → S2′ stream-idle → S3 output grid → S4 creative detail). **Throwaway** — production app will be Next.js + shadcn — but every screen, state, and decision ID is wired up against in-memory fixtures so flows can be reviewed end-to-end before any backend code is written.

## Run it

No build step. Serve over HTTP (Babel-in-browser needs `http://`, not `file://`):

```bash
# from the repo root
python -m http.server 8000
# → open http://localhost:8000/docs/prototype/cast-prototype.html
```

Any static file server works (`npx serve`, `php -S`, etc.) — just serve from the **repo root** so the relative `<script src="…">` paths resolve.

## Stack

- **React 18.3.1** + **ReactDOM 18.3.1** + **@babel/standalone 7.29.0** — all via CDN (`unpkg.com`) with SRI integrity hashes.
- JSX is compiled in the browser at page load. First render takes ~300ms — expected.
- Zero dependencies installed locally. No `package.json`. No bundler.

## Files (load order matters)

[cast-prototype.html](cast-prototype.html) loads four JSX files as `<script type="text/babel">` in this order:

| # | File | Role |
|---|---|---|
| 1 | [tweaks-panel.jsx](tweaks-panel.jsx) | Floating dev panel: scenario picker, GenAI mode, brand switch, autoplay, log rate. |
| 2 | [cast-data.jsx](cast-data.jsx) | Brand fixtures, default brief, `buildCreatives` / `buildCounts` / `buildLogLines` / `buildPromptPreview`. Exposes `window.CAST = {…}`. |
| 3 | [cast-screens.jsx](cast-screens.jsx) | Screen components (S1 brief editor, S2 run view, S3 output grid, S4 creative detail) + helpers (`Dropzone`, `MarketsTypeahead`, `CreativeTile`). |
| 4 | [cast-app.jsx](cast-app.jsx) | Root `<App>`, reducer, dispatch wiring. Mounts to `#app`. |

`cast-data.jsx` **must** load before the screens/app — they read `window.CAST.*`. The order in `cast-prototype.html` reflects this; don't reorder the script tags.

## Tweaks panel

Press the gear icon (bottom-right) to open. Useful toggles:

- **Scenario** — `all-clean` (everything passes) · `mixed` (1 WARN + 1 FAIL) · `stress` (more failures, font load error) · `stream-idle` (D30: pipeline starts but never emits a completion event).
- **GenAI mode** — `default` (`dall-e-3` per ratio) vs `cheap` (1 `gpt-image-1` master + Sharp center-crops, D9).
- **Brand** — switch between Brisa and Volt; the entire brief reloads.
- **Autoplay / log rate** — controls how the run-view streams the NDJSON-style log.

## What it does *not* do

- No real network calls. No GenAI. No file writes. Drop-zone uploads are kept as base64 dataURLs in React state only.
- No persistence — refresh resets everything to the default brief.
- The "Download brief.json / report.json" buttons produce real Blobs, but they're built from in-memory fixtures.

## Design decisions

| Area | Choice |
|---|---|
| Per-locale message editor | One row per active market's locale, derived from `brief.markets`. Adding a market spawns an empty locale row. Removing a market is non-destructive — the entry stays in `messageByLocale` but stops rendering. |
| Drop zone | Real `<input type="file">` + DnD handlers. `FileReader` → dataURL into `uploadedAssets[slug]`. **No upload** — purely client-side state. Tiles render the actual dropped image. |
| Prompt preview (D18) | Pure deterministic function `buildPromptPreview({ brand, product, market, ratio })` in [cast-data.jsx](cast-data.jsx). |
| `flagged` semantics (D3) | UI label is "WARN" (count = `counts.warn`) with a separate "FAIL" card when `counts.failed > 0`. Tooltip on WARN: "WARN + FAIL = N flagged". |
| Subheadline / CTA | Both render on tiles. Subheadline below message (hidden on `9:16`), CTA as a small pill in the lower-left. |
| Stream-idle scenario (D30) | `scenario: "stream-idle"` short-circuits the run after ~12 log lines and sets `runState=failed`. |
| Brief / report download | Plain `Blob` download. No new state. |
| Markets typeahead (D24) | Text input above market chips; Enter validates against `MARKET_RE = /^[a-z]{2}-[a-z]{2}$/`. |
| GenAI cheap mode (D9) | `genaiMode: "cheap"` → `counts.generated` = missing-product count (one `gpt-image-1` call per product, Sharp center-crops the rest), not creative count. |

## Production port (target)

The prototype is the visual spec for the production app under [working/b_KLVLM7AEs1k/](../../working/b_KLVLM7AEs1k/) (Next.js + shadcn). Target libraries when porting:

- **S5 drop zone** → `shadcn-dropzone`
- **S4 / S13 forms + validation** → `react-hook-form` + `zod`
- **S10 markets typeahead** → `cmdk`

## Background

Built slice-by-slice against the [requirements](../attributes-screen-requirements.md), [user stories](../user-stories.md), [system map](../system-map.md), and [flow diagrams](../flow-diagrams.md). The earlier static HTML mockup lives at [../mockup.html](../mockup.html).
