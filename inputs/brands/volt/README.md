# Volt — brand fixture

JSON contents are extracted from [`docs/design/volt-brand-guidelines.html`](../../../docs/design/volt-brand-guidelines.html) per the recipe in [`docs/brand-extraction.md`](../../../docs/brand-extraction.md).

## Binary assets (already committed)

These two are **existence-checked by `loadBrandProfile`** and are already committed to the repo. The validation command below should return `200`.

### `font.ttf`

- Display typeface per the brand guide §04: **Space Grotesk** (Google Fonts, OFL).
- Download `SpaceGrotesk-Bold.ttf` (or `-Regular.ttf`) and save here as `font.ttf`.
- `font.otf` is also accepted — the loader checks for either filename.
- Source: <https://fonts.google.com/specimen/Space+Grotesk>

### `logos/*.png`

One PNG per variant declared in `logos/logos.json`. Volt ships 5 variants (wordmark on light/volt-yellow/dark/slate plus the bolt glyph). Each entry's `theme: "light" | "dark"` drives the editor's tile background. PNG with alpha; sizing is at the screenshotter's discretion.

| Variant id          | File                       | Theme | Source in brand HTML |
| ------------------- | -------------------------- | ----- | -------------------- |
| `wordmark-on-light` | `wordmark-on-light.png`    | light | Volt-yellow wordmark over bone/paper |
| `wordmark-on-volt`  | `wordmark-on-volt.png`     | light | Wordmark over volt-yellow field |
| `wordmark-on-dark`  | `wordmark-on-dark.png`     | dark  | Volt-yellow wordmark over carbon |
| `wordmark-on-slate` | `wordmark-on-slate.png`    | dark  | Wordmark over slate field |
| `bolt-on-dark`      | `bolt-on-dark.png`         | dark  | Bolt glyph over carbon |

## Validation

```bash
curl -s http://localhost:3000/api/brands/volt | jq
```

`200` with the hydrated profile means the fixture is complete. `400` with `BrandIncompleteError` means a file (likely a binary asset above) is missing.
