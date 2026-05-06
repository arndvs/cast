/* global React */
const { useState, useMemo } = React;

// ====================== DEMO DATA ======================

const BRANDS = {
  brisa: {
    slug: "brisa",
    displayName: "Brisa",
    sub: "sparkling water",
    colors: { primary: "#0F6E56", accent: "#9FE1CB", bg1: "#9FE1CB", bg2: "#E1F5EE", text: "#085041" },
    products: [
      { name: "Brisa Citrus", sku: "BRS-CIT-12", slug: "brisa-citrus", swatch: ["#9FE1CB", "#E1F5EE"], hex: "#0F6E56" },
      { name: "Brisa Berry", sku: "BRS-BRY-12", slug: "brisa-berry", swatch: ["#F4C0D1", "#FBEAF0"], hex: "#993556" },
    ],
    voice: ["soft natural lighting", "citrus tones", "condensation on glass"],
    bannedWords: ["healthy", "cure", "energy", "guarantees"],
  },
  volt: {
    slug: "volt",
    displayName: "Volt",
    sub: "energy drink",
    colors: { primary: "#1A1A18", accent: "#FAC775", bg1: "#1A1A18", bg2: "#3D2F0E", text: "#FAC775" },
    products: [
      { name: "Volt Original", sku: "VLT-ORG-12", slug: "volt-original", swatch: ["#FAC775", "#1A1A18"], hex: "#FAC775", dark: true },
      { name: "Volt Zero", sku: "VLT-ZRO-12", slug: "volt-zero", swatch: ["#7DD3FC", "#0C1A2A"], hex: "#7DD3FC", dark: true },
    ],
    voice: ["dramatic lighting", "high contrast", "kinetic energy"],
    bannedWords: ["bro", "hustle", "grind", "pumped"],
  },
};

const DEFAULT_BRIEF = {
  brisa: {
    campaign: "summer-refresh-2026",
    brand: "brisa",
    products: [
      { name: "Brisa Citrus", sku: "BRS-CIT-12" },
      { name: "Brisa Berry", sku: "BRS-BRY-12" },
    ],
    markets: ["us-en", "mx-es"],
    audience: "18-34, urban, health-conscious",
    message: { en: "Crack open something brighter.", es: "Abre algo más brillante." },
    ratios: ["1x1", "9x16", "16x9"],
  },
  volt: {
    campaign: "launch-spark-2026",
    brand: "volt",
    products: [
      { name: "Volt Original", sku: "VLT-ORG-12" },
      { name: "Volt Zero", sku: "VLT-ZRO-12" },
    ],
    markets: ["us-en", "de-de"],
    audience: "21-30, gamers, late-shift workers",
    message: { en: "Charge through the night.", de: "Lade dich auf für die Nacht." },
    ratios: ["1x1", "9x16", "16x9"],
  },
};

// Output creatives, organized by market → product → ratio
function buildCreatives(brand, brief, scenario) {
  const out = {};
  brief.markets.forEach((mkt) => {
    out[mkt] = {};
    brand.products.forEach((p, pi) => {
      out[mkt][p.slug] = brief.ratios.map((r, ri) => {
        const key = `${mkt}/${p.slug}/${r}`;
        let badge = "OK";
        let path = `outputs/${brief.campaign}/${mkt}/${p.slug}/${r}.png`;
        let stage = null;
        let stageMsg = null;
        let checks = { logoPresent: true, colorsOk: true, bannedWords: [] };

        if (scenario === "all-clean") {
          badge = "OK";
        } else if (scenario === "mixed") {
          // one warn on first product 9x16, one fail on second product 16x9
          if (pi === 0 && r === "9x16" && mkt === brief.markets[0]) {
            badge = "WARN";
            checks = { logoPresent: true, colorsOk: false, bannedWords: [] };
          }
          if (pi === 1 && r === "16x9" && mkt === brief.markets[1]) {
            badge = "FAIL";
            path = null;
            stage = "genai";
            stageMsg = "OpenAI 429 rate limit — retried 3× then failed";
          }
        } else if (scenario === "stress") {
          if (ri === 1) badge = "WARN";
          if (pi === 1 && ri === 2) {
            badge = "FAIL"; path = null;
            stage = "compose";
            stageMsg = "font load failed: ENOENT inputs/brands/" + brand.slug + "/font.ttf";
          }
        }

        const source = (pi === 0) ? "genai" : "local";
        return {
          key,
          product: p.slug,
          productName: p.name,
          market: mkt,
          ratio: r,
          source,
          path,
          badge,
          checks,
          stage,
          stageMsg,
          message: brief.message[mkt.split("-").pop()] || brief.message[Object.keys(brief.message)[0]],
        };
      });
    });
  });
  return out;
}

function buildCounts(creatives, brief) {
  let succeeded = 0, failed = 0, flagged = 0, generated = 0, reused = 0;
  Object.values(creatives).forEach((mkt) => {
    Object.values(mkt).forEach((arr) => {
      arr.forEach((c) => {
        if (c.path === null) failed++;
        else {
          succeeded++;
          if (c.source === "genai") generated++;
          else reused++;
        }
        if (c.badge === "WARN" || c.badge === "FAIL") flagged++;
      });
    });
  });
  const requested = brief.products.length * brief.markets.length * brief.ratios.length;
  return { requested, succeeded, failed, flagged, generated, reused };
}

// Build the streaming log lines
function buildLogLines(brand, brief, creatives, scenario) {
  const lines = [];
  let t = 0;
  const tick = (n = 1) => { t += n; return String(t * 0.4).slice(0, 4) + "s"; };
  lines.push({ kind: "step", time: tick(0), tag: "step", msg: "run started — POST /api/generate" });
  lines.push({ kind: "step", time: tick(), tag: "step", msg: `brief validated — ${brief.products.length} products × ${brief.markets.length} markets × ${brief.ratios.length} ratios` });
  lines.push({ kind: "step", time: tick(), tag: "step", msg: `brand profile loaded — ${brand.slug} (palette, voice, logos, font)` });
  lines.push({ kind: "step", time: tick(), tag: "step", msg: `outputs/${brief.campaign}/ cleared (D15)` });
  lines.push({ kind: "step", time: tick(), tag: "step", msg: `brief.json written` });

  brief.markets.forEach((mkt) => {
    lines.push({ kind: "step", time: tick(), tag: "step", msg: `market: ${mkt} — locale=${mkt.split("-").pop()}` });
    brand.products.forEach((p, pi) => {
      const isLocal = pi !== 0;
      lines.push({ kind: "asset", time: tick(), tag: "asset", msg: isLocal ? `${p.slug} — using local asset (${p.slug}.png)` : `${p.slug} — missing, generating via dall-e-3` });
      brief.ratios.forEach((r) => {
        lines.push({ kind: "creative", time: tick(), tag: "creative", msg: `${p.slug} ${r} — composited "${(brief.message.en || "").slice(0, 32)}…"` });
        const c = creatives[mkt][p.slug].find((x) => x.ratio === r);
        if (c.path === null) {
          lines.push({ kind: "error", time: tick(), tag: "error", msg: `${p.slug} ${r} ${mkt} — stage=${c.stage}: ${c.stageMsg}` });
        } else {
          const cls = c.badge === "OK" ? "ok" : c.badge === "WARN" ? "warn" : "fail";
          lines.push({ kind: "compliance", subkind: cls, time: tick(), tag: c.badge, msg: `${p.slug} ${r} — ${c.badge === "OK" ? "passed" : c.badge === "WARN" ? "warning: low contrast" : "fail"}` });
        }
      });
    });
  });
  lines.push({ kind: "step", time: tick(), tag: "step", msg: "report.json written" });
  lines.push({ kind: "complete", time: tick(), tag: "complete", msg: "run complete — manifest delivered" });
  return lines;
}

window.CAST = { BRANDS, DEFAULT_BRIEF, buildCreatives, buildCounts, buildLogLines };
