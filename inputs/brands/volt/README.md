# Volt — brand fixture

JSON contents are extracted from [`docs/design/volt-brand-guidelines.html`](../../../docs/design/volt-brand-guidelines.html) per the recipe in [`docs/brand-extraction.md`](../../../docs/brand-extraction.md).

## Binary assets still required

These two are **existence-checked by `loadBrandProfile`** but cannot be auto-generated. The brand profile will fail to load until they are added.

### `font.ttf`

- Display typeface per the brand guide §04: **Space Grotesk** (Google Fonts, OFL).
- Download `SpaceGrotesk-Bold.ttf` (or `-Regular.ttf`) and save here as `font.ttf`.
- `font.otf` is also accepted — the loader checks for either filename.
- Source: <https://fonts.google.com/specimen/Space+Grotesk>

### `logos/*.png`

Four variants per [D27](../../../docs/flow-diagrams.md). Capture by screenshotting the wordmark stages in §02 of the brand HTML. PNG with alpha; sizing is at the screenshotter's discretion. The manifest binds D27 ids to descriptive PNG filenames; additional unmapped PNGs may live alongside for future use.

| Variant id (D27)   | File                       | Source in brand HTML |
| ------------------ | -------------------------- | -------------------- |
| `primary-on-light` | `wordmark-on-light.png`    | Volt-yellow wordmark over bone/paper |
| `primary-on-dark`  | `wordmark-on-dark.png`     | Volt-yellow wordmark over carbon |
| `mono-black`       | `wordmark-on-light.png`    | Reuse — no dedicated mono-black asset yet |
| `mono-white`       | `wordmark-on-dark.png`     | Reuse — no dedicated mono-white asset yet |

## Validation

```bash
curl -s http://localhost:3000/api/brands/volt | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
