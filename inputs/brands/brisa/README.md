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

Four variants per [D27](../../../docs/flow-diagrams.md). Capture by screenshotting the wordmark stages in §02 of the brand HTML. PNG with alpha; sizing is at the screenshotter's discretion.

| File | Source in brand HTML |
| --- | --- |
| `logos/primary-on-light.png` | "Primary wordmark · italic" stage on foam background |
| `logos/primary-on-dark.png`  | "Primary wordmark · mineral" stage on dark background |
| `logos/mono-white.png`       | Wordmark forced to `#FFFFFF` over a dark surface |
| `logos/mono-black.png`       | Wordmark forced to `#14302E` (mineral) over light |

## Validation

```bash
curl -s http://localhost:3000/api/brands/brisa | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
