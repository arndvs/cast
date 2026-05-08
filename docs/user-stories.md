# User Stories — Cast: Creative Automation Studio Toolchain

---

## Goals served

The three personas below are how Cast addresses the brief's business goals and pain points:

- **Maya (Story 1)** — campaign velocity + marketing ROI. Drops the per-campaign hours from manual Photoshop variants to a single Generate click.
- **Priya (Story 2)** — brand consistency at scale. Per-creative compliance badges replace the 40-frame Figma review pass.
- **Aaron (Story 3)** — demoability + the surface for future actionable-insights work (run logs, `report.json` already structured for analytics).

The Onda Beverages multi-brand framing (Brisa, Volt as sub-brands) is deliberate — it directly addresses the decentralized-process pain point by making **brand identity a per-campaign input**, not a baked-in constant. Adding a sub-brand is a directory drop under `inputs/brands/`, not a code change.

---

## Story 1 — Maya, Creative Producer

Maya is a creative producer at Onda Beverages, a global beverage holding company whose portfolio includes Brisa (sparkling water), Volt (energy), and several other sub-brands. Each sub-brand has its own voice, palette, logo, and banned-words list — her job is to keep them straight while shipping fast.

This month she's running a Brisa summer refresh — two flavors (Brisa Citrus, Brisa Berry) across multiple markets. That's 2 products × 3 aspect ratios per market, and she has four other campaigns on her plate — some Brisa, some Volt.

Today she opens a brief from the brand team in a Google Doc, downloads the product photography from Dropbox, opens Photoshop, and manually resizes and re-lays out every variant. By the time she renders the 9:16 TikTok cut she's already off-brand on the 1:1 because she forgot to update the headline copy. She misses the launch window.

What she wants: **open** the app in her browser, **pick the brand** this campaign is for from a list of Onda's sub-brands, **edit** the campaign brief in the UI — products, markets, audience, message — **drop** her product photos into the inputs folder, and **click Generate**. The app runs the pipeline against the selected brand's profile (colors, voice, logo, font, banned words), shows her what's happening step by step, and displays the finished creatives organized by market, product, and ratio right in the browser. If a product photo is missing the tool generates a stand-in hero image so she's not blocked.

The brief supports localized messages — Maya can provide copy in multiple locales and the pipeline composites the right message for each market run without her touching Photoshop.

Success looks like: Maya **selects Brisa**, **clicks Generate**, **watches** the pipeline log run in real time, **reviews** the 1:1 / 9:16 / 16:9 output grid for each product in the browser, and **opens** the output folder to grab the files — all in under three minutes. Tomorrow she'll do the same thing for Volt without learning a new tool.

**Key verbs:** opens app, selects brand, edits brief, clicks generate, watches pipeline log, reviews output grid, downloads files

---

## Story 2 — Priya, Brand Manager

Priya is responsible for protecting the brand. Her fear with automation is that the team ships something off-brand at scale — wrong logo placement, off-palette colors, or a tagline that uses a prohibited word in a regulated category.

Today she reviews every creative manually in a Figma file with 40 frames, leaves comments, and chases designers for fixes. Half the comments are the same issue repeated across every variant.

What she wants: after the pipeline runs, **see** a compliance badge on every creative in the output grid — green for pass, amber for warning, red for fail. She wants to know at a glance which creatives have a logo present, which are using on-palette colors, and which contain flagged words — before anything leaves the tool. She can open the report for the full detail.

Success looks like: Priya **looks at** the output grid, **sees** 5 of 6 creatives with a green badge and one amber flagged for low contrast, **clicks** the flagged creative to read the compliance detail, and **only reviews** that one instead of all six.

**Scope.** Priya's review surface is the current run only. There is no multi-run history view, no cross-run flagged-rate trend, no delta-since-last-run. Each Generate run is independent (see [README assumptions](../README.md#assumptions--limitations) and [flow-diagrams.md §8 Future scope](flow-diagrams.md#8-future-scope-v2--explicitly-out-of-poc)) — multi-run history is explicitly v2.

**Key verbs:** views output grid, reads compliance badges, clicks flagged item, reads compliance detail

---

## Story 3 — Aaron, Engineer Demoing the POC

Aaron is running the demo in a few days. He needs the app to start from a clean checkout with one command, the brief editor to be pre-populated with a working example, and the output to be immediately readable so a non-engineer in the room can follow along.

What he wants: a README with a Quick Start at the top, an example input + output, key design decisions called out explicitly, assumptions and limitations listed honestly, a `brief.json` that ships with the repo and works out of the box, and a UI that makes the pipeline visible — not a black box. When he clicks Generate the audience should see each pipeline step appear in the log, then the output grid populate with images and compliance badges. No terminal archaeology, no explaining folder structures mid-demo.

Success looks like: Aaron **opens** `localhost:3000`, **clicks Generate** with the pre-loaded example brief, **walks** the audience through the live pipeline log and output grid, and **answers** "how does it work" by pointing at the screen — then **points at the README** for design decisions, assumptions, and limitations when asked the deeper questions.

**Key verbs:** opens localhost, clicks generate, narrates pipeline log, shows output grid, explains compliance badges, explains design decisions, calls out assumptions and limitations

---

## Verbs and Actions (Feed into System Map)

- **accept / edit** campaign brief in the UI — JSON editor, pre-populated with working example
- **read** products, region, audience, message (with optional locale map) from brief
- **look up** input assets in `inputs/assets/` per product
- **generate** hero image via GenAI API when no input asset found for a product
- **resize** each image to 1:1, 9:16, 16:9 using Sharp
- **composite** the campaign message (correct locale if provided) as text overlay on each output
- **stream** pipeline log steps to the UI in real time
- **display** output grid in browser — one row per product, three ratio columns
- **save** outputs to `outputs/[campaign]/[market]/[product]/[ratio].png` (one file per product × market × ratio)
- **check** brand compliance — logo present, brand colors, prohibited words
- **badge** each output — OK / WARN / FAIL
- **write** `report.json` — `counts` (requested / succeeded / failed / generated / reused / flagged), per-creative `compliance`, and an `errors[]` array
- **document** in README — how to run, example input + output, key design decisions, assumptions and limitations

