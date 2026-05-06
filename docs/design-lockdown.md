# Design Lockdown Plan — Cast POC

> **Historical** — captures the lockdown decisions made during PR #1 (doc-only). The **canonical decision register** lives in [flow-diagrams.md Appendix A](flow-diagrams.md#appendix-a--design-decision-register). When this doc and Appendix A disagree, Appendix A wins.
>
> Status: locked decisions, doc-only PR. Application code lands in PR #2.
> References: [README.md](../README.md), [docs/flow-diagrams.md](../docs/flow-diagrams.md), [docs/system-map.md](../docs/system-map.md), [docs/attributes-screen-requirements.md](../docs/attributes-screen-requirements.md), [docs/user-stories.md](../docs/user-stories.md), [creative-automation-for-scalable-social-ad-campaigns.md](../creative-automation-for-scalable-social-ad-campaigns.md).

## Context

PR #1 is documentation only. Audit + research review surfaced 4 critical contract gaps, 7 inconsistencies, and 12 missing implementation primitives. This plan locks every decision so the implementer (PR #2) opens to zero unresolved contracts. No code lands in PR #1.

## Locked decisions

### Audit-driven (lockdown)

| # | Decision | Choice |
|---|---|---|
| D1 | Markets × locales × tree shape | Output tree adds `[market]` segment. Locale derived: `locale = market.split('-').pop()`. Brief rejected if any market's locale is missing from `message{}`. |
| D2 | Brief schema | Single Zod `briefSchema` defined once in `flow-diagrams.md` §4.2. README example is canonical. Attributes Step 4 references the schema. |
| D3 | Manifest + report.json shape | One canonical object. `manifest` (in `complete` event) === `report.json` content. CamelCase. Includes `counts`, per-creative `source`/`compliance`/`path` (nullable), `errors[]`. |
| D4 | JPEG handling | Read-only acceptance for pre-placed `.jpeg`. Uploads canonicalize to `.jpg`. Resolver lookup: `{png, jpg, jpeg, webp}`. Write extensions: `{png, jpg, webp}`. |
| D5 | Asset path placeholder | `inputs/assets/[product-slug].{png,jpg,jpeg,webp}` everywhere. |
| D6 | Output path leading slash | Drop leading `/` in tree visuals (paths are repo-relative). Absolute paths only in `manifest.outputDir`. |
| D7 | Ratio naming | `1x1`/`9x16`/`16x9` for data, filenames, schema enum. `1:1`/`9:16`/`16:9` only in display strings. |
| D8 | Locale/market field | `markets: string[]` (form `<region>-<lang>`). `message: Record<lang, string>`. Delete `locales`/singular `region` from prose. |
| D12 | `safeJoin` ROOTS | Two keys: `inputs`, `outputs`. Each maps to `path.resolve(process.cwd(), key)`. |
| D13 | Campaign slug validation | Validated as-is against `SLUG_RE`. Reject on fail. No server-side sluggification. |
| D14 | NDJSON render mode | Log + progress update incrementally on each event. Output grid hydrates only on `complete`. |
| D15 | Retry semantics | Both Generate and Retry clear `outputs/[campaign]/` recursively at run start, then rewrite `brief.json` and `report.json` as run-scoped products. The clear is what prevents stale `report.json` files from a prior failed run misrepresenting current state. End state of any successful run is invariant under retry. The cap file at `outputs/.cap.json` (D22) is one level above the campaign root and is not affected. |
| D16 | `.gitignore` | Add `coverage/`, `.swc/`. Allowlist demo brand directory. `outputs/` fully ignored. |

### Enrichment

| # | Decision | Choice |
|---|---|---|
| D9 | GenAI provider + model | OpenAI `dall-e-3`, three native ratios per missing product hero (1024×1024, 1792×1024, 1024×1792). One API call per `(product, ratio)`. `gpt-image-1` + Sharp center-crop available via `CAST_GENAI_MODE=cheap` env var. |
| D10 | Text overlay font | Bundled OFL: `inputs/brands/[brand]/font.ttf` per brand (NOT a global font). Ships with demo brand. |
| D11 | Per-campaign brand profile | `inputs/brands/[brand-slug]/{brand.json, voice.json, logo.png, font.ttf, banned-words.json?}`. Brief gains required `brand: SLUG_RE` field. Demo brands `brisa` and `volt` ship with repo (sub-brands of fictional Onda Beverages). |
| D17 | Storage abstraction | Single `Storage` interface. POC ships `LocalFsStorage`. S3/Azure/Dropbox = single-class swap, documented as v2. |
| D18 | Prompt construction | Brand-voice driven. Three-layer: brand `voice.json` → product `promptOverrides` → template function. S1 shows read-only prompt preview. |
| D19 | Per-creative manifest entries | `path: string \| null`. Failed creatives listed with `null` path + entry in top-level `errors[]`. Grid shows red placeholder tile. |
| D20 | Parallel generation | Per-product, all ratio generations run via `Promise.all`. Documented in §4 sequence diagram caption. |
| D21 | Banned-words check timing | Twice. Client-side at brief edit (pre-flight, blocks Generate). Server-side on each composited creative (compliance contributor). |
| D22 | Daily generation cap | Env-driven `DAILY_GENERATION_LIMIT` (default 50). Counter resets daily. Blocks new GenAI calls past limit. |
| D23 | Target audience | Stays freeform string. Fed deterministically into prompt construction (D18). No tag UI in POC. |
| D24 | Markets typeahead | Schema stays string array with regex. UI provides typeahead with common values; users can type any conforming value. |
| D25 | Ratio picker | Schema enum locked to `[1x1, 9x16, 16x9]` (v1). UI exposes pill toggles in S1; default all checked. v1.5 adds `4x5, 2x1` (out of POC). |
| D26 | Static raster only | PNG output only. GIF/video out of POC scope. Animated input rejected at upload, ignored at resolve (extension allowlist excludes `.gif`). |

## Vertical slices

```
A1  Lock brief schema + brand field             (D2, D8, D11, D23, D24, D25) — blocks A2, A4, A5
A2  Lock output tree with [market] segment      (D1, D6) — blocks A3, A7
A3  Lock manifest + report.json + parallel      (D3, D19, D20) — blocks A6
A4  Lock asset extension matrix + ratio naming  (D4, D5, D7, D26)
A5  Pin per-brand profile + GenAI + primitives  (D9, D10, D11, D12, D13, D17, D18, D21, D22, D26)
A6  Pin streaming render + retry semantics      (D14, D15)
A7  Subsystem map fixes (audit findings)
A8  .gitignore + brand allowlists                (D16, D11) — parallel-safe
A9  Save this plan to working/                  — done
A10 Future scope footnotes                      — after A5
```

## Dependency graph

```
A1 ─┬─→ A2 ─┬─→ A3 ─→ A6
    │       └─→ A7
    ├─→ A4
    └─→ A5 ─→ A10

A8 ─── parallel-safe
A9 ─── done
```

## Critical principles

- **One concept, one name, one shape.** Inconsistent field names are the most common signal of insufficient pressure-testing. Grep is the audit tool.
- **The contract is a single Zod schema, not prose.** Code is unambiguous; prose decays.
- **Brand identity is per-campaign, not per-product.** Cast serves arbitrary clients.
- **Demo cost discipline.** D22 caps daily spend; D9 native ratios prevent waste; D15 idempotent retry prevents double-spend.
- **POC stays POC.** Every enrichment we considered (outpainting, S3, brief interpreter, voice editor) is documented as v2 in A10.

## QA gate (pre-merge)

1. Greps from each slice acceptance criteria return zero hits.
2. README, system-map, flow-diagrams, attributes, HTML all coherent.
3. Mermaid blocks render without syntax errors.
4. Story verb → endpoint → screen → state chain is intact.
5. Each of the 12 MISSING-FOR-IMPL items has a concrete answer in flow-diagrams.
6. Zero references to internal app names ("RISE", "Render" as proper noun) in any committed file.
7. No "TBD" or unresolved placeholders.
8. No "Sam"/"Aarone"/"Aaronple" rename residue.

## Out of scope (PR #2+)

YAML brief import, S3/Azure/Dropbox storage, outpainting, edge transforms, Brief Interpreter, brand-voice editor UI, multi-run history, comments/approval workflow, translation API, multi-logo per brand, per-market brand variations, motion/video creatives.
