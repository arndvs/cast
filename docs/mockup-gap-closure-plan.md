# Cast mockup — gap-closure plan (vanilla React iteration)

> **Status.** Active. Rough lo-fi mockup phase — no real Next.js, no real backend.
> Iterate `cast/cast-{app,data,screens}.jsx` until all slices land, then port to shadcn/Next.js.

## Context

`cast/cast-prototype.html` is a vanilla React (Babel-in-browser) prototype that drives S1 / S2 / S2′ / S3 / S4 from the [flow diagrams](../docs/flow-diagrams.md) using `cast-data.jsx` fixtures. After a [browser audit](#audit-summary) against the requirements doc + user stories, ten gaps were identified. This plan closes them inside the mockup before any production code is written.

## Audit summary

**What the mockup nails (no changes needed)**

- Multi-brand framing (D11) — Brisa / Volt cards switch the entire brief.
- Logo variant picker (D27) — all four variants render.
- Banned-words pre-flight (D21, D29) — inline `⚠ banned: …` warning.
- Detected Assets panel — `→ will generate` vs `✓ found` resolver visibility.
- GenAI mode badge (D9), Form↔JSON toggle, NDJSON-style log (D14), failed-state recovery (D30), dual-mode S4 detail (D19), counts (D3), filter bar, Reveal in folder (S5), Tweaks panel.

**Gaps closed by this plan**

| ID | Gap | Slice |
|---|---|---|
| G1 | `flagged` count shows WARN-only; spec D3 says WARN+FAIL | S1 |
| G2 | `reused` summary card missing | S2 |
| G3 | `local | genai` source pill missing on tiles | S3 |
| G4 | **No per-locale message editor** — biggest functional gap | S4 |
| G5 | Drop zone is a styled div, not a real file input | S5 |
| G6 | No prompt preview (D18) | S6 |
| G7 | Subheadline + CTA edited but never rendered on creatives | S7 |
| G8 | No `stream-idle` (D30) demo trigger | S8 |
| G9 | `brief.json` + `report.json` not downloadable | S9 |
| G10 | Markets not typeahead (D24) | S10 |
| G11 | Detected Assets doesn't distinguish uploaded vs pre-placed | S11 |
| G12 | GenAI mode badge hard-coded (no cheap-mode toggle) | S12 |
| G13 | Slug field has no client-side regex hint | S13 |

## Design decisions

| Decision | Choice |
|---|---|
| Where this work lives | `cast/cast-{app,data,screens}.jsx`. Vanilla React + Babel-in-browser. No Next.js port yet. |
| v1 archive | `cast-{app,data,screens}-v1.jsx` + `cast-prototype-v1.html` move to `cast/_archive/` (recoverable). |
| Per-locale editor shape | One row per active market's locale, derived from `brief.markets`. Adding a market spawns an empty locale row. Removing a market is non-destructive (keeps message text in `messageByLocale` but stops rendering). |
| Drop zone behavior | Real `<input type="file">` + DnD handlers. `FileReader` → dataURL into `uploadedAssets[slug]`. **No upload** — purely client-side state for the mockup. Tiles render the actual dropped image. |
| Prompt preview source | Pure function `buildPromptPreview({ brand, product, market, ratio })` in `cast-data.jsx`. Deterministic. |
| `flagged` semantics | Rename UI label "flagged" → "WARN" (count = `counts.warn`); add separate "FAIL" card if `counts.failed > 0`. Tooltip on WARN: "WARN + FAIL = N flagged (D3)". |
| Subheadline / CTA | Render both on tiles. Subheadline below message (hidden on 9:16), CTA as small pill in lower-left. |
| Stream-idle scenario | New tweak `scenario: "stream-idle"` short-circuits the run after ~12 log lines and sets `runState=failed`. |
| Brief / report download | Plain `Blob`-based download. No new state. |
| Markets typeahead | Text input above market chips; Enter validates against `MARKET_RE = /^[a-z]{2}-[a-z]{2}$/`. |
| GenAI mode toggle | Tweak `genaiMode: 'default' | 'cheap'`. Badge text + log lines reflect choice. In cheap mode, `counts.generated` = missing-product count, not creative count (one call per product, Sharp center-crops). |

## Vertical slices

```
☐ S0  — Archive v1 mockup
☐ S1  — Fix flagged vs warn count semantics
☐ S2  — Add reused summary card
☐ S3  — Add local|genai source pill on S3 tiles
☐ S4  — Per-locale message editor (LARGEST GAP)
☐ S5  — Real drop zone (file input + DnD + FileReader)
☐ S6  — Prompt preview under missing-asset rows (D18)
☐ S7  — Render subheadline + CTA on creatives
☐ S8  — stream-idle scenario in tweaks (D30)
☐ S9  — brief.json + report.json downloads
☐ S10 — Markets typeahead (D24)
☐ S11 — Detected Assets: uploaded vs pre-placed pill
☐ S12 — GenAI mode toggle (default/cheap, D9)
☐ S13 — Slug regex hint + Generate gating
```

## Wave plan

```
S0  (archive — first commit)
 ├── Wave 1 (parallel-safe smalls): S1, S2, S3, S7, S8, S9, S12, S13
 ├── Wave 2 (state-shape changes):  S4, S5
 └── Wave 3 (depend on Wave 2):     S6, S10, S11
```

## QA plan (post-merge)

Before merging `dev → main`:

1. **Story 1 (Maya).** brisa, mixed.
   - Edit `es` headline → `mx-es` tiles update.
   - Add `de-de` via typeahead → `de` row appears.
   - Drop a real PNG on Brisa Citrus → S1 panel + 4 tiles render image.
   - Click "Show prompt" → reads sensible composed string.
   - Generate → S2 → S3 → download `report.json` and `brief.json`.

2. **Story 2 (Priya).** mixed.
   - Summary cards: `requested · succeeded · reused · generated · WARN · FAIL` with `generated + reused === succeeded`.
   - Filter to warnings → 1 tile → S4 compliance mode.
   - Filter to failed → 1 tile → S4 error mode with stage breadcrumb.

3. **Story 3 (Aaron).** stress, log rate=3.
   - Generate → 6-stage narration → grid with one compose-stage failure.
   - Switch scenario=stream-idle → S2′ banner with D30 wording → retry.
   - Switch genaiMode=cheap → mode badge + log line change.

4. **Brand swap.** brisa → volt → brisa. Locale rows reset, palette/logo swap, banned-words rotates.

5. **Validation.** Slug `Bad Slug!` → Generate disabled + inline error.

## Handoff

After all slices land, port to `working/b_KLVLM7AEs1k/` (Next.js + shadcn scaffold) using shadcn-dropzone for S5, `react-hook-form` + `zod` for S4/S13, `cmdk` for S10. The vanilla mockup becomes the visual spec.

---

_Cast · Mockup gap-closure plan · 2026_
