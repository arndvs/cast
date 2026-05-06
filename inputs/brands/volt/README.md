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

Four variants per [D27](../../../docs/flow-diagrams.md). Capture by screenshotting the wordmark stages in §02 of the brand HTML. PNG with alpha; sizing is at the screenshotter's discretion.

| File | Source in brand HTML |
| --- | --- |
| `logos/primary-on-light.png` | Primary wordmark in `#E8FF1A` over carbon background, then re-staged on bone/paper |
| `logos/primary-on-dark.png`  | Primary wordmark in `#E8FF1A` over carbon `#0B0B0F` |
| `logos/mono-white.png`       | Wordmark forced to `#FFFFFF` over carbon |
| `logos/mono-black.png`       | Wordmark forced to `#0B0B0F` over bone/paper |

## Validation

```bash
curl -s http://localhost:3000/api/brands/volt | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
