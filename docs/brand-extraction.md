# Brand Profile Extraction

**Why this doc exists.** The HTML brand guidelines under [docs/design/](design/) are the canonical source for each shipped brand profile. The runtime accepts a much thinner contract — `brandProfileSchema` in [flow-diagrams.md §4.3](flow-diagrams.md#brand-profile-schema-d11--contract). This doc names the reduction: which HTML sections land in which JSON path, what is intentionally dropped, and how a new client onboards their own brand.

The reduction is hand-curated and peer-reviewed via PR. There is no scripted parser — `n = 2` brands ship with the POC, HTML structure varies brand-to-brand, ROI is poor. Treat this doc as the recipe; the actual JSON values are populated alongside the implementation PR. ([D28](flow-diagrams.md#appendix-a--design-decision-register))

> **v2 supersession.** A front-end **Brand onboarding UI** is listed in [flow-diagrams.md §8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc) — a form-driven flow (logo uploads, banned-words textarea, color pickers, voice fields) that writes the same directory atomically via `POST /api/brands`. Until that ships, this hand-curated recipe is the onboarding path.

---

## Scope

| Brand | HTML | Runtime profile? |
| --- | --- | --- |
| Brisa | [docs/design/brisa-brand-guidelines.html](design/brisa-brand-guidelines.html) | Yes — `inputs/brands/brisa/` |
| Volt  | [docs/design/volt-brand-guidelines.html](design/volt-brand-guidelines.html)   | Yes — `inputs/brands/volt/`  |
| Cast  | [docs/design/cast-brand-guidelines.html](design/cast-brand-guidelines.html)   | **No** — Cast is the tool's own UI brand, not a runtime input |
| Onda  | [docs/design/onda-brand-guidelines.html](design/onda-brand-guidelines.html)   | **No** — narrative-only parent brand framing for the demo's multi-brand story; runtime is single-tier per [flow-diagrams.md §8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc) |

Brisa and Volt are the only two brands that need extraction. Onboarding a real client brand later follows the same recipe against that client's own brand book.

---

## Schema reduction

`loadBrandProfile` validates each per-brand file against the matching sub-schema of `brandProfileSchema` — `brand.json` → `brandJsonSchema`, `voice.json` → `voiceJsonSchema`, `banned-words.json` (when present) → `bannedWordsSchema`, `logos.json` → `logosManifestSchema`. `font.ttf` (or `font.otf`) is existence-checked only (no parse). The HTML carries far more than the schema accepts; the table below names exactly what the runtime reads.

### `brand.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Brand name (header / title block)            | `displayName`        | string | Human label. Surfaces in S1 brand selector and in the GenAI prompt as `${brandVoice.displayName}`. |
| Primary brand color (hex)                    | `colors.primary`     | hex `#RRGGBB` | Used by the compositor for text overlay accents and by the compliance checker's palette sampler ([D21](flow-diagrams.md#appendix-a--design-decision-register)). |
| Secondary / accent color (hex)               | `colors.accent`      | hex `#RRGGBB` | Same. |
| Light/background color (hex, if specified)   | `colors.background?` | hex `#RRGGBB` | Optional. Used for compositor surface choice in mono modes. |
| Body text color (hex, if specified)          | `colors.text?`       | hex `#RRGGBB` | Optional. Used for compositor text fill when contrast against the hero requires it. |
| (everything else)                            | `tokens?`            | `Record<string, string>` | Optional escape hatch for brand-specific design tokens an implementer wants to thread through `buildPrompt` or the compositor without expanding the schema. Stay sparing. |

### `voice.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Voice / tone summary section                  | `tone`              | string (one paragraph) | Concise. Read into the GenAI prompt by `buildPrompt` ([D18](flow-diagrams.md#appendix-a--design-decision-register)). |
| Voice "Do" list                               | `do[]`              | string array | Each entry is one rule, imperative voice. Joined into the prompt as positive guidance. |
| Voice "Don't" list                            | `dont[]`            | string array | Each entry is one rule. **Distinct from `banned-words.json`:** `dont[]` is high-level voice direction ("avoid macho swagger"); `banned-words.json` is literal substring matching. |
| Imagery / mood / visual language sections     | `promptFragments[]` | string array | Synthesized from the brand's visual guidelines — concrete phrases the prompt builder concatenates onto the OpenAI image prompt. Examples: `"soft natural lighting"`, `"citrus tones"`, `"condensation on glass"`. Each fragment must be defensible from a specific HTML section; no free invention. Lift manually per brand. |

### `banned-words.json`

A flat array of lowercase terms. Per-brand HTML organizes these into categories (Brisa's HTML uses one category set; Volt uses another — e.g. `function-claim · legal`, `off-voice · macho · gym-bro`, `off-voice · hustle · category cliché`). **The runtime sees a flat list — categories are HTML-side organization only.** Lift rule:

1. Collect every `<span class="word">` (or equivalent) inside every banned-words category card in the brand's HTML.
2. Lowercase, trim whitespace, dedupe.
3. Write the resulting array to `inputs/brands/[brand]/banned-words.json`.

`loadBrandProfile` then **unions** this list with `getDefaultBannedWords()` from `lib/banned-words.ts` (universal floor: violence, hate, NSFW, weapons, drugs, self-harm) — see [flow-diagrams.md "Banned-words composition"](flow-diagrams.md#brand-profile-schema-d11--contract). Defaults always apply; the brand file is purely additive.

> A brand HTML may surface 20–40+ banned terms grouped across 3+ categories. The runtime list is the flattened union of every category — no category metadata is preserved at runtime. If category-aware reporting becomes useful (e.g. compliance UI grouping), that's a v2 schema extension, not a POC concern.

### `logos/` + `logos.json`

POC logos are **screenshots from the brand HTML guidelines**, not extracted SVGs. Per [D27](flow-diagrams.md#appendix-a--design-decision-register), each brand ships exactly four variants:

| Variant id          | When the compositor uses it                                | Source                                 |
| ------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `primary-on-light`  | Default. Light hero backgrounds, hero ≥ 0.6 luminance.     | Screenshot of full-color logo on light surface |
| `primary-on-dark`   | Dark hero backgrounds, hero ≤ 0.4 luminance.               | Screenshot of full-color logo on dark surface  |
| `mono-white`        | Photographic / busy hero backgrounds, dark dominant.       | Screenshot of white-only logo treatment        |
| `mono-black`        | Photographic / busy hero backgrounds, light dominant.      | Screenshot of black-only logo treatment        |

Files land in `inputs/brands/[brand]/logos/[variant-id].png`. `logos.json` declares the default variant and the manifest:

```json
{
  "default": "primary-on-light",
  "variants": [
    { "id": "primary-on-light", "displayName": "Primary · on light", "file": "primary-on-light.png" },
    { "id": "primary-on-dark",  "displayName": "Primary · on dark",  "file": "primary-on-dark.png"  },
    { "id": "mono-white",       "displayName": "Mono · white",       "file": "mono-white.png"       },
    { "id": "mono-black",       "displayName": "Mono · black",       "file": "mono-black.png"       }
  ]
}
```

PNG with alpha. Sizing is at the screenshotter's discretion — the compositor resizes per ratio at composite time. Manual variant selection only for the POC; automatic per-creative selection by hero luminance is v2 ([§8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc)).

### `font.ttf` or `font.otf`

Per-brand display font ([D10](flow-diagrams.md#appendix-a--design-decision-register)). OFL-licensed; the brand HTML names the typeface. Source the OFL file from Google Fonts or the typeface vendor and drop it in as either `font.ttf` or `font.otf` — the loader accepts whichever exists. Not extracted from the HTML.

---

## What's intentionally dropped

The HTML guidelines describe a complete design system. Cast's runtime composites text + a corner logo onto a hero image — most of that system has no surface area in the pipeline. Dropped on purpose:

- **Full palette beyond primary/accent.** Compositor draws text and corner logo only; richer palettes have nowhere to land.
- **Type scale, line-height ramps, weight pairings.** The display font is rendered at compositor-determined sizes per ratio; the brand's published scale is informational.
- **Spacing / grid tokens.** Cast does not lay out compositions — the GenAI hero image owns the composition.
- **Illustration style, iconography rules, photography art-direction.** Out of scope for the GenAI prompt's control surface; `promptFragments[]` is the deliberate narrow channel.
- **Motion / animation specs.** Output creatives are static PNG only ([D26](flow-diagrams.md#appendix-a--design-decision-register)).
- **Print specs, packaging die-lines, point-of-sale collateral.** Cast generates digital ad creatives.
- **Banned-words category labels.** Flattened on lift (see above).

If a future feature needs one of these, the schema extension is the entry point — not a back-channel through `tokens`.

---

## Onboarding a new brand (the README promise made concrete)

The README's "Onboard a new brand" section promises a directory drop with no code change. This is the recipe behind the promise:

1. Source the brand's brand book or guidelines (HTML, PDF, Figma — any canonical reference).
2. Pull `displayName`, `colors.primary`, `colors.accent` (and optional `colors.background`, `colors.text`) into `brand.json`.
3. Pull tone, do, don't, and synthesized visual `promptFragments[]` into `voice.json`.
4. Flatten the brand's banned-words / no-fly list into `banned-words.json` (lowercase, deduped). Skip if the brand has no specific terms — defaults still apply.
5. Capture or export the four logo variants per [D27](flow-diagrams.md#appendix-a--design-decision-register) into `logos/`. Write `logos.json`.
6. Drop the OFL display font as `font.ttf` or `font.otf`.
7. Restart `next dev` (the brand-profile cache TTL is 90 s; restart is faster than waiting). Brand appears in the S1 selector on next page load.

No rebuild, no migration, no code change. The schema is the API.

---

## Linked decisions

- [D10](flow-diagrams.md#appendix-a--design-decision-register) — Display font: per-brand `font.ttf` or `font.otf`.
- [D11](flow-diagrams.md#appendix-a--design-decision-register) — Per-brand profile directory contract.
- [D18](flow-diagrams.md#appendix-a--design-decision-register) — Prompt construction (consumes `voice.json`).
- [D21](flow-diagrams.md#appendix-a--design-decision-register) — Compliance + banned-words (consumes the union list).
- [D27](flow-diagrams.md#appendix-a--design-decision-register) — Logo variants (consumes `logos/` + `logos.json`).
- [D28](flow-diagrams.md#appendix-a--design-decision-register) — This doc: extraction methodology.

---

_Cast · Brand Extraction v1 · Adobe FDE Take-Home · Aaron Davis · 2026_
