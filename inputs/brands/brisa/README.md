# Brisa — brand fixture

JSON contents are extracted from [`docs/design/brisa-brand-guidelines.html`](../../../docs/design/brisa-brand-guidelines.html) per the recipe in [`docs/brand-extraction.md`](../../../docs/brand-extraction.md).

## Binary assets still required

These two are **existence-checked by `loadBrandProfile`** but cannot be auto-generated. The brand profile will fail to load until they are added.

### `font.ttf`

- Display typeface per the brand guide §04: **Instrument Serif** (Google Fonts, OFL).
- Download `InstrumentSerif-Italic.ttf` (or `-Regular.ttf`) and save here as `font.ttf`.
- `font.otf` is also accepted — the loader checks for either filename.
- Source: <https://fonts.google.com/specimen/Instrument+Serif>

### `logos/*.png`

Four variants per [D27](../../../docs/flow-diagrams.md). Capture by screenshotting the wordmark stages in §02 of the brand HTML. PNG with alpha; sizing is at the screenshotter's discretion. The manifest binds D27 ids to descriptive PNG filenames; additional unmapped PNGs may live alongside for future use.

| Variant id (D27)   | File                       | Source in brand HTML |
| ------------------ | -------------------------- | -------------------- |
| `primary-on-light` | `lockup-on-light.png`      | Primary lockup on foam background |
| `primary-on-dark`  | `lockup-on-dark.png`       | Primary lockup on mineral background |
| `mono-black`       | `wordmark-on-light.png`    | Wordmark forced to mineral over light |
| `mono-white`       | `wordmark-on-dark.png`     | Wordmark forced to white over dark |

## Validation

```bash
curl -s http://localhost:3000/api/brands/brisa | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
