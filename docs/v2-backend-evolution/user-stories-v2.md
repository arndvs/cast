# User Stories — Cast: Creative Automation Studio Toolchain (v2)

> v2 extends the original three stories with two new personas — Jordan (performance) and Sam (ops/scheduling) — and updates existing stories to reflect the buyer persona typeahead, approval workflow, and agent-callable architecture. Original story text is preserved; additions are clearly integrated.

---

## Goals served

| Persona | Story | Business goal addressed |
| --- | --- | --- |
| **Maya** | 1 | Campaign velocity + marketing ROI. Single Generate click replaces manual Photoshop variant work. |
| **Priya** | 2 | Brand consistency at scale. Per-creative compliance badges replace the 40-frame Figma review pass. |
| **Aaron** | 3 | Demoability + architectural proof. Run logs and `report.json` structured for analytics from day one. |
| **Jordan** | 4 *(new)* | Performance optimization. Closes the feedback loop — learns what worked, flags what's fatiguing, weights future generation toward winners. |
| **Sam** | 5 *(new)* | Marketing ops + scale. Removes the human from repetitive scheduling. Makes Cast callable by a scheduler, a CI job, or an agent — not just a person clicking a UI. |

The Onda Beverages multi-brand framing (Brisa, Volt as sub-brands) is deliberate — it directly addresses the decentralized-process pain point by making **brand identity a per-campaign input**, not a baked-in constant. Adding a sub-brand is a directory drop under `inputs/brands/`, not a code change.

---

## Story 1 — Maya, Creative Producer

Maya is a creative producer at Onda Beverages, a global beverage holding company whose portfolio includes Brisa (sparkling water), Volt (energy), and several other sub-brands. Each sub-brand has its own voice, palette, logo, and banned-words list — her job is to keep them straight while shipping fast.

This month she's running a Brisa summer refresh — two flavors (Brisa Citrus, Brisa Berry) across multiple markets. That's 2 products × 3 aspect ratios per market, and she has four other campaigns on her plate — some Brisa, some Volt.

Today she opens a brief from the brand team in a Google Doc, downloads the product photography from Dropbox, opens Photoshop, and manually resizes and re-lays out every variant. By the time she renders the 9:16 TikTok cut she's already off-brand on the 1:1 because she forgot to update the headline copy. She misses the launch window.

What she wants: **open** the app in her browser, **pick the brand** this campaign is for from a list of Onda's sub-brands, **select a buyer persona** from the typeahead (or type a custom audience description), **edit** the campaign brief — products, markets, message — **drop** her product photos onto the product rows, and **click Generate**. The app runs the pipeline against the selected brand's profile (colors, voice, logo, font, banned words, persona prompt fragment), shows her what's happening step by step, and displays the finished creatives organized by market, product, and ratio right in the browser. If a product photo is missing the tool generates a stand-in hero image so she's not blocked.

The brief supports localized messages — Maya can provide copy in multiple locales and the pipeline composites the right message for each market run without her touching Photoshop.

Success looks like: Maya **selects Brisa**, **picks the "Urban Wellness Seeker" persona** from the typeahead, **clicks Generate**, **watches** the pipeline log run in real time, **reviews** the 1:1 / 9:16 / 16:9 output grid for each product, **sees the estimated run cost** in the results header, and **opens** the output folder to grab the files — all in under three minutes. Tomorrow she'll do the same thing for Volt without learning a new tool.

**Key verbs:** opens app, selects brand, selects persona, edits brief, clicks generate, watches pipeline log, reviews output grid, sees cost estimate, downloads files

---

## Story 2 — Priya, Brand Manager

Priya is responsible for protecting the brand. Her fear with automation is that the team ships something off-brand at scale — wrong logo placement, off-palette colors, or a tagline that uses a prohibited word in a regulated category.

Today she reviews every creative manually in a Figma file with 40 frames, leaves comments, and chases designers for fixes. Half the comments are the same issue repeated across every variant.

What she wants: after the pipeline runs, **see** a compliance badge on every creative in the output grid — green for pass, amber for warning, red for fail. She also wants to **see an approval status** on each creative so she can explicitly mark creatives as approved or rejected before anything leaves the tool, with a rejection reason that feeds back to Maya. She can open the creative detail for the full compliance breakdown.

Success looks like: Priya **looks at** the output grid, **sees** 5 of 6 creatives with a green badge and one amber flagged for low contrast, **clicks** the flagged creative to read the compliance detail, **approves** the five green creatives with one action, **rejects** the amber one with a reason ("headline contrast too low on dark hero — use mono-white logo variant"), and only **that one** goes back to Maya for a fix.

**Scope.** Priya's review surface is the current run plus the approval queue. There is no cross-run trend dashboard in v1 — that belongs to Jordan (Story 4). Each Generate run is independent from a compliance perspective; approval status persists on the creative's Qdrant metadata payload.

**Key verbs:** views output grid, reads compliance badges, clicks flagged item, reads compliance detail, approves creatives, rejects with reason

---

## Story 3 — Aaron, Engineer Demoing the POC

Aaron is running the demo in a few days. He needs the app to start from a clean checkout with one command, the brief editor to be pre-populated with a working example, and the output to be immediately readable so a non-engineer in the room can follow along.

What he wants: a README with a Quick Start at the top, an example input + output, key design decisions called out explicitly, assumptions and limitations listed honestly, a `brief.json` that ships with the repo and works out of the box, and a UI that makes the pipeline visible — not a black box. When he clicks Generate the audience should see each pipeline step appear in the log, then the output grid populate with images and compliance badges. No terminal archaeology, no explaining folder structures mid-demo.

He also needs to be able to answer the harder architectural questions: "how would this plug into Salesforce?" and "can this run without a human clicking a button?" The answer is yes on both — the Fastify API split and the MCP tool stubs exist exactly for this. Aaron points at `docs/agent-integration.md` when those questions come up.

Success looks like: Aaron **opens** `localhost:3000`, **clicks Generate** with the pre-loaded example brief, **walks** the audience through the live pipeline log and output grid, **answers** "how does it work" by pointing at the screen, and **answers** "how would this scale" by pointing at the architecture diagram — then points at the README for design decisions, assumptions, and limitations when asked the deeper questions.

**Key verbs:** opens localhost, clicks generate, narrates pipeline log, shows output grid, explains compliance badges, explains design decisions, explains agent-ready architecture, calls out assumptions and limitations

---

## Story 4 — Jordan, Growth Marketer / Performance Analyst *(new in v2)*

Jordan doesn't create campaigns — he measures them. He's responsible for ROAS across Onda's brands and markets. His biggest frustration is that creative performance data lives in Meta Ads Manager, but the creatives themselves live in Dropbox, and the campaign briefs live in a Google Doc. There's no way to answer "which creative drove the most conversions last quarter" without a painful manual cross-reference.

His second biggest frustration is ad fatigue. He knows from experience that a creative running for more than 30 days on a high-impression budget starts to decay — CTR drops, ROAS falls, but the team keeps running it because no one is tracking fatigue systematically. By the time someone notices, the brand has spent $40K on a dead creative.

What he wants: **import** last month's Meta Ads performance data (CSV or JSON export) into Cast, **see** which creatives had the highest CTR and conversion rate, **see** a fatigue risk score on any creative that's been running too long at high volume, and **get a recommendation** for which creatives to refresh — ideally with the top-performing variants from the same brand/market pre-selected as generation seeds so the next run starts from what worked.

Success looks like: Jordan **imports** a Meta Ads export via `POST /api/performance`, **opens** the fatigue report for `brisa · us-en`, **sees** three creatives flagged as high-fatigue risk, **clicks** "Refresh recommendations" to see the top-performing variants from the same brand/market as suggested seeds, and **triggers** a new generation run with those seeds pre-populated in the brief — all without asking Maya to start from scratch.

**Key verbs:** imports performance data, views top-performing creatives, reads fatigue scores, reviews refresh recommendations, triggers seeded generation run

---

## Story 5 — Sam, Marketing Ops / Scheduler *(new in v2)*

Sam runs marketing operations for Onda's regional teams. Her job is to make sure campaigns go out on time across 8 markets, 3 brands, and 12 product lines — every month. She's the person who gets paged on Saturday when something breaks.

Her frustration: every campaign requires someone to open the UI, fill in a brief, click Generate, wait, approve, and download. For a team running 200+ campaign variants per month, that's hundreds of manual UI sessions. Some campaigns are identical month-to-month — the same brief, the same products, just a new campaign slug and refreshed copy. There's no reason a human needs to be involved in those.

What she wants: **save** a brief template for a recurring campaign, **trigger** Cast via API (or have her agent trigger it), **get the results back** in a structured format she can route to her approval queue, and **plug Cast into her existing marketing automation stack** — whether that's Salesforce Marketing Cloud, customer.io, or whatever they're using in 18 months. She doesn't want to be locked into Cast's UI forever.

What makes Cast right for this: the pipeline lives in `lib/cast/server/` behind a clean API boundary. Every action available in the UI is also available as an API call. The MCP tool stubs mean an agent can call `generate_campaign`, poll for results, call `approve_creative`, and route the output to distribution — with Sam only reviewing edge cases.

Success looks like: Sam **saves** the Brisa summer brief as a template, **configures** a monthly trigger (cron or marketing automation webhook), **receives** the completed manifest via API callback, **routes** approved creatives to her distribution system automatically, and **only opens Cast's UI** when something needs human judgment — a compliance failure, an unusual fatigue pattern, a new market that needs a brief edit.

**Key verbs:** saves brief template, triggers generation via API, receives manifest callback, routes approved creatives, reviews exceptions in UI, connects Cast to existing marketing stack

---

## Verbs and Actions (Feed into System Map)

### v1 verbs (unchanged)

- **accept / edit** campaign brief in the UI — JSON editor or form, pre-populated with working example
- **read** products, region, audience, message (with optional locale map) from brief
- **look up** input assets in `inputs/assets/` (or Azure Blob) per product
- **generate** hero image via GenAI API when no input asset found for a product
- **resize** each image to 1:1, 9:16, 16:9 using Sharp
- **composite** the campaign message (correct locale if provided) as text overlay on each output
- **stream** pipeline log steps to the UI in real time
- **display** output grid in browser — one row per product, three ratio columns
- **save** outputs to cloud storage, organized by campaign / market / product / ratio
- **check** brand compliance — logo present, brand colors, prohibited words
- **badge** each output — OK / WARN / FAIL
- **write** `report.json` — `counts`, per-creative `compliance`, `errors[]`, `costs`
- **document** in README — how to run, example input + output, key design decisions, assumptions and limitations

### v2 verbs (new)

- **select** buyer persona from typeahead — replaces free-text audience, injects `promptFragment` into GenAI prompt
- **promote** free-text audience to a saved persona after a successful run
- **approve / reject** creatives in the output grid — writes `status` + optional `rejectionReason` to Qdrant payload
- **import** performance data (CSV/JSON) via `POST /api/performance` — patches `performanceScore` on creative Qdrant payloads
- **view** top-performing creatives ranked by CTR/conversions via `GET /api/top-creatives`
- **compute** fatigue scores — `daysSinceGeneration + (impressions / 1000) - (ctr * 100)` — on demand or post-import
- **view** fatigue report — ranked fatigued creatives with refresh recommendations (top-performing seeds)
- **trigger** generation via API (Fastify or Next.js API routes) — no UI required
- **call** Cast tools via MCP — `generate_campaign`, `search_creatives`, `approve_creative`, `get_fatigue_report`, `import_performance`
- **query** creative history semantically — "find all Japan energy drink creatives from Q1" → Qdrant vector search + metadata filters
- **ingest** brand knowledge docs (markdown) → Qdrant `cast-knowledge` collection for RAG-augmented prompt construction
- **estimate** run cost before Generate fires — `products × markets × ratios × costPerImage` shown in S1
- **track** actual run cost in manifest — `costs.estimated` + `costs.actual` (USD)

---

## Story → screen coverage (updated)

| Story verb | Screen / endpoint | New in v2? |
| --- | --- | --- |
| select persona typeahead | S1 — audience combobox → `GET /api/personas` | ✓ |
| see cost estimate | S1 — cost estimate below Generate button | ✓ |
| approve / reject creative | S3 — approval badge + PATCH action on tile | ✓ |
| import performance data | `POST /api/performance` (no UI screen yet — API only) | ✓ |
| view top-performing creatives | S6 — Performance Dashboard | ✓ |
| view fatigue report | S7 — Fatigue Report + Refresh Recommendations | ✓ |
| trigger generation via API | Fastify API layer / Next.js route (no UI required) | ✓ |
| call Cast via MCP | `lib/cast/server/mcp.ts` tool stubs | ✓ |
| query creative history | `GET /api/search-creatives` → Qdrant | ✓ |
| all v1 verbs | S1–S5 (unchanged) | — |

Every verb — old and new — maps to a screen, an API endpoint, or a defined system action. Nothing is floating.
