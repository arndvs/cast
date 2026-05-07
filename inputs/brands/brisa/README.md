# Brisa — brand fixture

JSON contents are extracted from [`docs/design/brisa-brand-guidelines.html`](../../../docs/design/brisa-brand-guidelines.html) per the recipe in [`docs/brand-extraction.md`](../../../docs/brand-extraction.md).

## Binary assets (already committed)

These two are **existence-checked by `loadBrandProfile`** and are already committed to the repo. The validation command below should return `200`.

### `font.ttf`

- Display typeface per the brand guide §04: **Instrument Serif** (Google Fonts, OFL).
- Download `InstrumentSerif-Italic.ttf` (or `-Regular.ttf`) and save here as `font.ttf`.
- `font.otf` is also accepted — the loader checks for either filename.
- Source: <https://fonts.google.com/specimen/Instrument+Serif>

### `logos/*.png`

One PNG per variant declared in `logos/logos.json`. Brisa ships 7 variants (lockup, wordmark, droplet × light/dark, plus an aqua wordmark). Each entry's `theme: "light" | "dark"` drives the editor's tile background. PNG with alpha; sizing is at the screenshotter's discretion — the compositor resizes per ratio.

| Variant id              | File                            | Theme | Source in brand HTML |
| ----------------------- | ------------------------------- | ----- | -------------------- |
| `lockup-on-light`       | `lockup-on-light.png`           | light | Primary lockup on foam |
| `lockup-on-dark`        | `lockup-on-dark.png`            | dark  | Primary lockup on mineral |
| `wordmark-on-light`     | `wordmark-on-light.png`         | light | Wordmark on foam |
| `wordmark-on-dark`      | `wordmark-on-dark.png`          | dark  | Wordmark on mineral |
| `wordmark-aqua-on-dark` | `wordmark-aqua-on-dark.png`     | dark  | Aqua wordmark on mineral |
| `droplet-on-light`      | `droplet-on-light.png`          | light | Droplet glyph on foam |
| `droplet-on-dark`       | `droplet-on-dark.png`           | dark  | Droplet glyph on mineral |

## Validation

```bash
curl -s http://localhost:3000/api/brands/brisa | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
