# Brand Profile Extraction

The HTML brand guidelines under [docs/design/](design/) are the canonical source for each shipped brand profile. The runtime accepts a much thinner contract — `brandProfileSchema` in [flow-diagrams.md §4.3](flow-diagrams.md#brand-profile-schema-contract). This doc names the reduction: which HTML sections land in which JSON path, what is intentionally dropped, and how a new client onboards their own brand.

The reduction is hand-curated. `n = 2` brands ship with the repo and HTML structure varies brand-to-brand.

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

`loadBrandProfile` validates each per-brand file against the matching sub-schema of `brandProfileSchema` — `brand.json` → `brandJsonSchema`, `voice.json` → `voiceJsonSchema`, `banned-words.json` (when present) → `bannedWordsSchema`, `logos/logos.json` → `logosManifestSchema`, `products.json` (when present) → `productsManifestSchema`, `backgrounds.json` (when present) → `backgroundsManifestSchema`. `font.ttf` (or `font.otf`) is existence-checked only (no parse). The HTML carries far more than the schema accepts; the table below names exactly what the runtime reads.

### `brand.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Brand name (header / title block)            | `displayName`        | string | Human label. Surfaces in the brand selector and in the GenAI prompt as `${brandVoice.displayName}`. |
| Primary brand color (hex)                    | `colors.primary`     | hex `#RRGGBB` | Used by the compositor for text overlay accents and by the compliance checker's palette sampler ([compliance + banned-words](flow-diagrams.md#compliance--banned-words)). |
| Secondary / accent color (hex)               | `colors.accent`      | hex `#RRGGBB` | Same. |
| Light/background color (hex, if specified)   | `colors.background?` | hex `#RRGGBB` | Optional. Used for compositor surface choice in mono modes. |
| Body text color (hex, if specified)          | `colors.text?`       | hex `#RRGGBB` | Optional. Used for compositor text fill when contrast against the hero requires it. |
| (everything else)                            | `tokens?`            | `Record<string, string>` | Optional escape hatch for brand-specific design tokens an implementer wants to thread through `buildPromptPreview` or the compositor without expanding the schema. Stay sparing. |

### `voice.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Voice / tone summary section                  | `tone`              | string (one paragraph) | Concise. Read into the GenAI prompt by `buildPromptPreview` ([prompt construction](flow-diagrams.md#prompt-construction)). |
| Voice "Do" list                               | `do[]`              | string array | Each entry is one rule, imperative voice. Joined into the prompt as positive guidance. |
| Voice "Don't" list                            | `dont[]`            | string array | Each entry is one rule. **Distinct from `banned-words.json`:** `dont[]` is high-level voice direction ("avoid macho swagger"); `banned-words.json` is literal substring matching. |
| Imagery / mood / visual language sections     | `promptFragments[]` | string array | Synthesized from the brand's visual guidelines — concrete phrases the prompt builder concatenates onto the OpenAI image prompt. Examples: `"soft natural lighting"`, `"citrus tones"`, `"condensation on glass"`. Each fragment must be defensible from a specific HTML section; no free invention. Lift manually per brand. |
| Negative imagery instructions                 | `negativePromptFragments[]` | string array | Phrases the prompt builder inserts as negative guidance — what to avoid in generated images. Examples: `"no harsh studio lighting"`, `"avoid cluttered backgrounds"`. |
| Mood / atmosphere keywords                    | `moodKeywords[]`    | string array | Short scene-setting adjectives used by the prompt builder. Examples: `"refreshing"`, `"crisp"`, `"vibrant"`. |
| Per-SKU visual differentiation                | `skuFragments?`     | `Record<sku, { promptFragments, accentHex?, sceneMood? }>` | Optional per-product overrides. Keyed by SKU (e.g. `"BRS-CIT-12"`). Each entry can supply product-specific prompt fragments, an accent hex, and a scene mood keyword. |

### `banned-words.json`

A flat array of lowercase terms. Per-brand HTML organizes these into categories (Brisa's HTML uses one category set; Volt uses another — e.g. `function-claim · legal`, `off-voice · macho · gym-bro`, `off-voice · hustle · category cliché`). **The runtime sees a flat list — categories are HTML-side organization only.** Lift rule:

1. Collect every `<span class="word">` (or equivalent) inside every banned-words category card in the brand's HTML.
2. Lowercase, trim whitespace, dedupe.
3. Write the resulting array to `inputs/brands/[brand]/banned-words.json`.

`loadBrandProfile` then **unions** this list with `getDefaultBannedWords()` from `lib/cast/banned-words.ts` (universal floor: violence, hate, NSFW, weapons, drugs, self-harm) — see [flow-diagrams.md "Banned-words composition"](flow-diagrams.md#brand-profile-schema-contract). Defaults always apply; the brand file is purely additive.

> A brand HTML may surface 20–40+ banned terms grouped across 3+ categories. The runtime list is the flattened union of every category — no category metadata is preserved at runtime. If category-aware reporting becomes useful (e.g. compliance UI grouping), that's a v2 schema extension, not a POC concern.

### `logos/` (variants + `logos.json`)

POC logos are **screenshots from the brand HTML guidelines**, not extracted SVGs. The number and naming of variants is **brand-specific** — each brand ships as many variants as its guidelines require, with descriptive IDs derived from the logo treatment and surface:

**Brisa** (7 variants): `lockup-on-light`, `lockup-on-dark`, `wordmark-on-light`, `wordmark-on-dark`, `wordmark-aqua-on-dark`, `droplet-on-light`, `droplet-on-dark`

**Volt** (5 variants): `wordmark-on-light`, `wordmark-on-volt`, `wordmark-on-dark`, `wordmark-on-slate`, `bolt-on-dark`

Files land in `inputs/brands/[brand]/logos/[variant-id].png`. `logos/logos.json` declares the default variant, the manifest, and an optional `theme` hint per variant:

```json
{
  "default": "lockup-on-light",
  "variants": [
    { "id": "lockup-on-light",       "displayName": "Lockup · on light",        "file": "lockup-on-light.png",       "theme": "light" },
    { "id": "lockup-on-dark",        "displayName": "Lockup · on dark",         "file": "lockup-on-dark.png",        "theme": "dark"  },
    { "id": "wordmark-on-light",     "displayName": "Wordmark · on light",      "file": "wordmark-on-light.png",     "theme": "light" },
    { "id": "wordmark-on-dark",      "displayName": "Wordmark · on dark",       "file": "wordmark-on-dark.png",      "theme": "dark"  },
    { "id": "wordmark-aqua-on-dark", "displayName": "Wordmark · aqua on dark",  "file": "wordmark-aqua-on-dark.png", "theme": "dark"  },
    { "id": "droplet-on-light",      "displayName": "Droplet glyph · on light", "file": "droplet-on-light.png",      "theme": "light" },
    { "id": "droplet-on-dark",       "displayName": "Droplet glyph · on dark",  "file": "droplet-on-dark.png",       "theme": "dark"  }
  ]
}
```

PNG with alpha. Sizing is at the screenshotter's discretion — the compositor resizes per ratio at composite time. Manual variant selection only for the POC; automatic per-creative selection by hero luminance is v2 ([§8](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc)).

### `products.json` (optional)

Product-can cutout manifest. When present, `loadBrandProfile` validates against `productsManifestSchema`. Each item references a cutout PNG under `products/`.

| JSON path | Type | Notes |
| --- | --- | --- |
| `items[].id`     | slug   | Unique identifier for the product can variant |
| `items[].sku`    | string | SKU matching `brief.products[].sku` |
| `items[].file`   | string | Filename in `products/` directory |
| `items[].pose`   | enum   | `"upright-center"` \| `"tilt-left"` \| `"tilt-right"` |
| `items[].detail` | enum   | `"clean"` (default) \| `"condensation"` |

### `backgrounds.json` (optional)

Background-plate manifest. When present, `loadBrandProfile` validates against `backgroundsManifestSchema`. Each item references a background PNG under `backgrounds/`.

| JSON path | Type | Notes |
| --- | --- | --- |
| `items[].id`        | slug   | Unique identifier for the background plate |
| `items[].file`      | string | Filename in `backgrounds/` directory |
| `items[].ratio`     | enum   | `"1x1"` \| `"9x16"` \| `"16x9"` |
| `items[].sku`       | string | SKU this background is designed for |
| `items[].luminance` | enum   | `"light"` \| `"dark"` — used for logo variant auto-selection (v2) |

### `font.ttf` or `font.otf`

Per-brand display font ([per-brand profile](flow-diagrams.md#per-brand-profile)). OFL-licensed; the brand HTML names the typeface. Source the OFL file from Google Fonts or the typeface vendor and drop it in as either `font.ttf` or `font.otf` — the loader accepts whichever exists. Not extracted from the HTML.

---

## What's intentionally dropped

The HTML guidelines describe a complete design system. Cast's runtime composites text + a corner logo onto a hero image — most of that system has no surface area in the pipeline. Dropped on purpose:

- **Full palette beyond primary/accent.** Compositor draws text and corner logo only; richer palettes have nowhere to land.
- **Type scale, line-height ramps, weight pairings.** The display font is rendered at compositor-determined sizes per ratio; the brand's published scale is informational.
- **Spacing / grid tokens.** Cast does not lay out compositions — the GenAI hero image owns the composition.
- **Illustration style, iconography rules, photography art-direction.** Out of scope for the GenAI prompt's control surface; `promptFragments[]` is the deliberate narrow channel.
- **Motion / animation specs.** Output creatives are static PNG only.
- **Print specs, packaging die-lines, point-of-sale collateral.** Cast generates digital ad creatives.
- **Banned-words category labels.** Flattened on lift (see above).

If a future feature needs one of these, the schema extension is the entry point — not a back-channel through `tokens`.

---

## Onboarding a new brand (the README promise made concrete)

The README's "Onboard a new brand" section promises a directory drop with no code change. This is the recipe behind the promise:

1. Source the brand's brand book or guidelines (HTML, PDF, Figma — any canonical reference).
2. Pull `displayName`, `colors.primary`, `colors.accent` (and optional `colors.background`, `colors.text`) into `brand.json`.
3. Pull tone, do, don't, `promptFragments`, `negativePromptFragments`, `moodKeywords` (and optional per-SKU `skuFragments`) into `voice.json`.
4. Flatten the brand's banned-words / no-fly list into `banned-words.json` (lowercase, deduped). Skip if the brand has no specific terms — defaults still apply.
5. Capture or export logo variants with descriptive IDs matching the brand's treatments (e.g. `lockup-on-light`, `wordmark-on-dark`, `bolt-on-dark`) into `logos/`. Write `logos/logos.json` with a `theme` hint per variant.
6. (Optional) If the brand has product-can cutouts, create `products.json` + `products/` directory.
7. (Optional) If the brand has background plates, create `backgrounds.json` + `backgrounds/` directory.
8. Drop the OFL display font as `font.ttf` or `font.otf`.
9. Restart `next dev` (the brand-profile cache TTL is 90 s; restart is faster than waiting). Brand appears in the brand selector on next page load.

No rebuild, no migration, no code change. The schema is the API.
