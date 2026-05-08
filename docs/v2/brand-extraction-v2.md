# Brand Profile Extraction (v2)

> v2 extends the original extraction guide with a new section: **Knowledge Base Extraction** — how brand guidelines and market rules become chunked markdown documents vectorized into Qdrant `cast-knowledge`. The v1 extraction recipe (brand.json, voice.json, banned-words.json, logos, font) is unchanged.

---

## Scope

| Brand | HTML | Runtime profile? | Knowledge docs? |
| --- | --- | --- | --- |
| Brisa | [docs/design/brisa-brand-guidelines.html](design/brisa-brand-guidelines.html) | Yes — `inputs/brands/brisa/` | Yes — `inputs/knowledge/brisa/` |
| Volt  | [docs/design/volt-brand-guidelines.html](design/volt-brand-guidelines.html)   | Yes — `inputs/brands/volt/`  | Yes — `inputs/knowledge/volt/` |
| Cast  | [docs/design/cast-brand-guidelines.html](design/cast-brand-guidelines.html)   | **No** — Cast is the tool's own UI brand | **No** |
| Onda  | [docs/design/onda-brand-guidelines.html](design/onda-brand-guidelines.html)   | **No** — narrative framing only | **No** |

---

## Part 1 — Brand Profile Extraction (v1, unchanged)

### `brand.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Brand name (header / title block) | `displayName` | string | Surfaces in brand selector and GenAI prompt. |
| Primary brand color (hex) | `colors.primary` | hex `#RRGGBB` | Used by compositor and compliance checker. |
| Secondary / accent color (hex) | `colors.accent` | hex `#RRGGBB` | Same. |
| Light/background color (hex, if specified) | `colors.background?` | hex `#RRGGBB` | Optional. |
| Body text color (hex, if specified) | `colors.text?` | hex `#RRGGBB` | Optional. |
| (everything else) | `tokens?` | `Record<string, string>` | Optional escape hatch. Stay sparing. |

### `voice.json`

| HTML source | JSON path | Type | Notes |
| --- | --- | --- | --- |
| Voice / tone summary section | `tone` | string | Read into GenAI prompt by `buildPromptPreview`. |
| Voice "Do" list | `do[]` | string array | Positive prompt guidance. |
| Voice "Don't" list | `dont[]` | string array | High-level voice direction (distinct from `banned-words.json`). |
| Imagery / mood / visual language sections | `promptFragments[]` | string array | Concrete phrases for the prompt builder. Each must be defensible from a specific HTML section. |

### `banned-words.json`

Lift rule:
1. Collect every term inside banned-words category cards in the brand's HTML.
2. Lowercase, trim whitespace, dedupe.
3. Write as flat array to `inputs/brands/[brand]/banned-words.json`.

`loadBrandProfile` unions this with `getDefaultBannedWords()` (violence, hate, NSFW, weapons, drugs, self-harm floor). Missing brand file → defaults still apply.

### `logos/` (variants + `logos.json`)

Four variants per brand:

| Variant id | When used | Source |
| --- | --- | --- |
| `primary-on-light` | Default. Light hero backgrounds. | Screenshot on light surface |
| `primary-on-dark` | Dark hero backgrounds. | Screenshot on dark surface |
| `mono-white` | Busy dark hero backgrounds. | White-only logo screenshot |
| `mono-black` | Busy light hero backgrounds. | Black-only logo screenshot |

### `font.ttf` / `font.otf`

OFL-licensed display font. Source from Google Fonts or vendor. Not extracted from HTML.

---

## Part 2 — Knowledge Base Extraction *(new in v2)*

The runtime profile (`brand.json`, `voice.json`) is a thin, machine-readable contract designed for deterministic use in prompt construction. It does not capture the full depth of a brand's guidelines — the reasoning behind rules, cultural context, historical decisions, regional market nuances, or legal constraints.

The knowledge base fills that gap. Brand guidelines and market rules are extracted as markdown documents, chunked into ~500-token segments, embedded via `text-embedding-3-small`, and stored in the Qdrant `cast-knowledge` collection. The prompt builder queries this collection before each GenAI call, injecting the top-K most relevant chunks as context. This replaces hardcoded `promptFragments[]` with RAG-driven, always-current brand context.

### Directory structure

```
inputs/knowledge/
  brisa/
    brand-guidelines.md        # brand voice, visual identity, design principles
    country-rules-us.md        # US-specific messaging rules, legal constraints
    country-rules-mexico.md    # Mexico market rules, cultural considerations
    campaign-history.md        # notable past campaigns, what worked / didn't
  volt/
    brand-guidelines.md
    country-rules-us.md
    country-rules-germany.md
```

### What to extract per brand

The following sections of each brand HTML should become standalone markdown files. One concern per file — do not combine multiple distinct topics into a single markdown document, as it degrades chunk quality.

#### `brand-guidelines.md`

Extract:
- The brand's origin story and positioning (2–3 paragraphs max — the "why" behind the voice)
- Full "Do / Don't" lists with the reasoning behind each rule (not just the rule itself)
- Visual identity narrative — what the visual choices are meant to communicate (not the technical spec, which is in `brand.json`)
- Photography and imagery direction that goes beyond `promptFragments[]` — situational guidance, "when to use which treatment", examples
- Typography intent — what the font choice communicates about the brand (not type scale, which is dropped in v1)

Do not extract:
- Anything already captured in `brand.json` or `voice.json` (colors, tone summary, promptFragments)
- Technical specs (print specs, file formats, packaging die-lines)
- Anything in `banned-words.json`

#### `country-rules-[market].md`

Extract:
- Market-specific messaging guidance — what themes resonate, what to avoid culturally
- Legal and regulatory constraints for that market (e.g. health claims in the EU, alcohol/beverage advertising rules)
- Seasonal / cultural calendar notes (festivals, peak seasons, culturally significant dates)
- Tone adjustments for that market — how the brand voice adapts without losing identity
- Historical context — any notable brand moments or learnings specific to that market

One file per market, named `country-rules-[region].md` (e.g. `country-rules-us.md`, `country-rules-japan.md`).

#### `campaign-history.md` (optional but valuable)

Extract or compose from marketing team records:
- Past campaign names, dates, products, markets
- What performed well and why (in human language, not raw metrics — Jordan imports metrics separately)
- What failed and the post-mortem reasoning
- Creative directions that became brand-defining vs those that were retired

### Chunking rules

The `ingestMarkdown()` function in `knowledge-base.ts` applies these rules automatically, but the extraction quality depends on the source document being well-structured:

- Each markdown file should use `##` headers to separate logical sections
- Each section should be self-contained — a reader should understand the section without needing to read the one before it
- Target ~400–600 words per section (this maps well to the ~500-token chunk target with 10% overlap)
- Avoid tables in knowledge docs — they chunk poorly and embed inconsistently. Use prose or bullet lists instead.

### Qdrant payload per chunk

```json
{
  "brand": "brisa",
  "docType": "brand-guidelines",
  "title": "Photography Direction",
  "chunkIndex": 3,
  "chunkText": "Brisa's photography should always feel like a stolen moment of calm..."
}
```

The `docType` field enables filtered retrieval — when the prompt builder queries for market-specific context, it filters `docType: "country-rules"` to avoid pulling brand-voice chunks that aren't relevant to the market question.

### Ingestion CLI

```bash
npx tsx scripts/ingest-knowledge.ts --brand brisa
# Processes all .md files in inputs/knowledge/brisa/
# Outputs: N chunks ingested, M skipped (already indexed), K failed

npx tsx scripts/ingest-knowledge.ts --brand volt
```

The ingestion script is idempotent — re-running against an unchanged file skips chunks whose content hash already exists in Qdrant. Edited files trigger re-ingestion of only the changed chunks.

### Verifying ingestion quality

After running ingestion, test retrieval with:

```bash
curl "http://localhost:3000/api/knowledge?q=Japan+cultural+marketing+rules&brand=brisa"
```

Expected result: chunks from `country-rules-japan.md` ranked first. If generic brand-guidelines chunks outrank the market-specific ones, the country rules file likely needs more specific headers or the Japan content needs to be extracted to its own file.

### What this replaces

| Before | After |
| --- | --- |
| `voice.json → promptFragments[]` hard-coded strings | RAG query returns most relevant chunks dynamically |
| Same prompt context for every market | Prompt includes market-specific chunks for the target `<region>-<lang>` |
| Brand rules require code change to update | Update the markdown file → re-run ingest script → live immediately |
| No historical campaign context in prompts | `campaign-history.md` chunks inform generation style |

### What this does not replace

- `voice.json` — still required. The runtime profile is used for deterministic, fast operations (compliance checking, banned-words, brand identity in brief validation). RAG is for enrichment, not replacement.
- `banned-words.json` — string matching against the banned-words union list is deterministic and must not be replaced with RAG retrieval.
- `brand.json` colors — the compositor reads these directly; they are not retrieved from the knowledge base.

---

## Onboarding a new brand (v2 — full recipe)

### Step 1: Runtime profile (same as v1)

1. Source the brand book (HTML, PDF, Figma — any canonical reference).
2. Extract `displayName`, colors → `brand.json`.
3. Extract tone, do/don't, `promptFragments[]` → `voice.json`.
4. Flatten banned terms → `banned-words.json`.
5. Capture four logo variants → `logos/` + `logos/logos.json`.
6. Drop OFL font → `font.ttf` or `font.otf`.
7. Restart `next dev`. Brand appears in selector immediately.

### Step 2: Knowledge base (new in v2)

8. Create `inputs/knowledge/[brand]/brand-guidelines.md` — extract brand narrative, full do/don't reasoning, visual intent.
9. Create `inputs/knowledge/[brand]/country-rules-[market].md` for each target market.
10. Create `inputs/knowledge/[brand]/campaign-history.md` if historical campaign notes are available.
11. Run `npx tsx scripts/ingest-knowledge.ts --brand [brand]`.
12. Verify with `GET /api/knowledge?q=...&brand=[brand]`.

### Step 3: Historical asset ingestion (new in v2)

After the brand profile is in place, all existing brand imagery should be analyzed and vectorized into Qdrant so the prompt builder can retrieve semantically relevant historical references. This is a one-time operation per brand; new assets are indexed automatically at generation time.

13. Ensure Qdrant is configured (`QDRANT_URL`, `QDRANT_API_KEY`) and `CAST_STORAGE` is set correctly.
14. Place existing brand imagery in the appropriate directories:
    - Product photos → `inputs/assets/[product-slug].{png,jpg,webp}` (already used by v1 resolver)
    - Background references → `inputs/brands/[brand]/backgrounds/*.{png,jpg,webp}` (optional)
    - Campaign reference images → `inputs/brands/[brand]/refs/*.{png,jpg,webp}` (optional)
15. Run the ingestion script:
    ```bash
    npx tsx scripts/ingest-assets.ts --brand brisa
    # Output: N processed, M skipped (already indexed), K failed
    ```
16. Verify ingestion via semantic search:
    ```bash
    curl "http://localhost:3000/api/search-creatives?q=citrus+summer+bright&brand=brisa"
    # Expect: relevant product photos ranked first
    ```

**Idempotency:** The ingestion script checks whether each image's deterministic Qdrant point ID (hash of brand/path/mtime) already exists before calling `analyzeImage()`. Re-running is safe — unchanged images are skipped, updated images are re-analyzed.

**Cost note:** Each image analyzed costs ~$0.002 (gpt-4o-mini vision). 50 historical images per brand = ~$0.10 per brand ingestion. One-time cost.

### Step 4: Personas (new in v2)

17. Define 2–4 buyer personas for the brand. For each:
    - `displayName` — the name as it appears in the typeahead
    - `promptFragment` — the string that replaces free-text audience in the GenAI prompt
    - `interests[]`, `motivators[]` — for semantic search and future personalization
18. Seed via `POST /api/personas` or directly via the `scripts/seed-personas.ts` script.
19. Verify in the Brief Editor audience typeahead — personas should appear on brand selection.

No rebuild required at any step. The schema is the API.

---

## Output versioning (v2)

### The v1 problem

In v1, `clearCampaignOutput()` deletes `outputs/[campaign]/` recursively at the start of every Generate or Retry run. This is correct for the POC — idempotent reruns, no stale output — but destructive in production. A second run on the same campaign slug overwrites the first. There is no run history.

### The v2 path convention

In v2, output paths include a `run-id` segment:

```
outputs/[campaign]/[run-id]/[market]/[product]/[ratio].png
outputs/[campaign]/[run-id]/brief.json
outputs/[campaign]/[run-id]/report.json
```

The `run-id` is a short ISO timestamp slug, generated at run start:

```typescript
const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
// e.g. "2026-05-08T14-32-01"
```

**What changes:**
- `clearCampaignOutput()` clears only `outputs/[campaign]/[run-id]/` — not the entire campaign directory
- `writeBriefSnapshot()` and `writeReport()` write to `outputs/[campaign]/[run-id]/`
- `manifest.outputDir` points to the run-scoped directory, not the campaign root
- `revealOutputFolder` server action resolves `outputs/[campaign]/[run-id]/` via `safeJoin`

**What stays the same:**
- `SLUG_RE` validates `campaign` before it enters `safeJoin` — unchanged
- `safeJoin` guard against traversal — unchanged
- The manifest shape — `outputDir` field value changes, shape does not
- S3 Output Grid behavior — hydrates from `manifest.outputDir`, unaffected

**Why this matters for scale:** A client running 200+ campaigns per month may run the same campaign brief multiple times (A/B testing, refreshes, market additions). Without versioning, the second run silently destroys the first. With versioning, both runs are preserved, comparable, and auditable.

**In Azure Blob Storage:** The same path convention applies — `cast-outputs/[campaign]/[run-id]/[market]/[product]/[ratio].png`. Azure Blob's flat namespace handles the path naturally; no directory concept to manage.

**Listing run history:** `StorageAdapter.listFiles("outputs", "[campaign]/")` returns all blobs under the campaign prefix. Grouping by the `run-id` segment gives the full run history. This is the foundation for a future run-history UI (multi-run history is explicitly v2+ per the roadmap).
