# User Stories — Cast: Creative Automation Pipeline

### Local Next.js App · POC · v4

---

## Story 1 — Maya, Creative Producer

Maya is a creative producer at a global consumer goods company. This month she needs to ship a campaign for two products — a sparkling water and an energy drink — across multiple markets. That's 2 products × 3 aspect ratios per market, and she has four other campaigns on her plate.

Today she opens a brief from the brand team in a Google Doc, downloads the product photography from Dropbox, opens Photoshop, and manually resizes and re-lays out every variant. By the time she renders the 9:16 TikTok cut she's already off-brand on the 1:1 because she forgot to update the headline copy. She misses the launch window.

What she wants: **open** the app in her browser, **edit** the campaign brief in the UI — products, region, audience, message — **drop** her product photos into the inputs folder, and **click Generate**. The app runs the pipeline, shows her what's happening step by step, and displays the finished creatives organized by product and ratio right in the browser. If a product photo is missing the tool generates a stand-in hero image so she's not blocked.

The brief supports localized messages — Maya can provide copy in multiple locales and the pipeline composites the right message for each market run without her touching Photoshop.

Success looks like: Maya **clicks Generate**, **watches** the pipeline log run in real time, **reviews** the 1:1 / 9:16 / 16:9 output grid for each product in the browser, and **opens** the output folder to grab the files — all in under three minutes.

**Key verbs:** opens app, edits brief, clicks generate, watches pipeline log, reviews output grid, downloads files

---

## Story 2 — Priya, Brand Manager

Priya is responsible for protecting the brand. Her fear with automation is that the team ships something off-brand at scale — wrong logo placement, off-palette colors, or a tagline that uses a prohibited word in a regulated category.

Today she reviews every creative manually in a Figma file with 40 frames, leaves comments, and chases designers for fixes. Half the comments are the same issue repeated across every variant.

What she wants: after the pipeline runs, **see** a compliance badge on every creative in the output grid — green for pass, amber for warning, red for fail. She wants to know at a glance which creatives have a logo present, which are using on-palette colors, and which contain flagged words — before anything leaves the tool. She can open the report for the full detail.

Success looks like: Priya **looks at** the output grid, **sees** 5 of 6 creatives with a green badge and one amber flagged for low contrast, **clicks** the flagged creative to read the compliance detail, and **only reviews** that one instead of all six.

**Key verbs:** views output grid, reads compliance badges, clicks flagged item, reads compliance detail

---

## Story 3 — Sam, Engineer Demoing the POC

Sam is running the demo in a few days. He needs the app to start from a clean checkout with one command, the brief editor to be pre-populated with a working example, and the output to be immediately readable so a non-engineer in the room can follow along.

What he wants: a README with a Quick Start at the top, a `brief.json` that ships with the repo and works out of the box, and a UI that makes the pipeline visible — not a black box. When he clicks Generate the audience should see each pipeline step appear in the log, then the output grid populate with images and compliance badges. No terminal archaeology, no explaining folder structures mid-demo.

Success looks like: Sam **opens** `localhost:3000`, **clicks Generate** with the pre-loaded example brief, **walks** the audience through the live pipeline log and output grid, and **answers** "how does it work" by pointing at the screen.

**Key verbs:** opens localhost, clicks generate, narrates pipeline log, shows output grid, explains compliance badges

---

## Verbs and Actions (Feed into System Map)

- **accept / edit** campaign brief in the UI — JSON editor, pre-populated with working example
- **read** products, region, audience, message (with optional locale map) from brief
- **look up** input assets in `/inputs/assets/` per product
- **generate** hero image via GenAI API when no input asset found for a product
- **resize** each image to 1:1, 9:16, 16:9 using Sharp
- **composite** the campaign message (correct locale if provided) as text overlay on each output
- **stream** pipeline log steps to the UI in real time
- **display** output grid in browser — one row per product, three ratio columns
- **save** outputs to `/outputs/[campaign]/[product]/1x1.png`, `9x16.png`, `16x9.png`
- **check** brand compliance — logo present, brand colors, prohibited words
- **badge** each output — OK / WARN / FAIL
- **write** `report.json` — steps run, assets generated vs. reused, compliance results

---

_Cast · User Stories v4 · Adobe FDE Take-Home · Aaron Davis · 2026_
