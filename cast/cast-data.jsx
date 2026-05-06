/* global React */
// ====================== BRANDS / DEFAULT BRIEF ======================

const BRANDS = {
  brisa: {
    slug: "brisa",
    displayName: "Brisa",
    sub: "sparkling water",
    colors: { primary: "#0F6E56", secondary: "#9FE1CB", accent: "#F4C0D1", bg1: "#9FE1CB", bg2: "#E1F5EE", text: "#085041" },
    products: [
      { name: "Brisa Citrus", sku: "BRS-CIT-12", slug: "brisa-citrus", swatch: ["#9FE1CB", "#E1F5EE"], hex: "#0F6E56" },
      { name: "Brisa Berry",  sku: "BRS-BRY-12", slug: "brisa-berry",  swatch: ["#F4C0D1", "#FBEAF0"], hex: "#993556" },
    ],
    voice: ["soft natural lighting", "citrus tones", "condensation on glass"],
    bannedWords: ["healthy", "cure", "energy", "guarantee", "miracle", "instant"],
  },
  volt: {
    slug: "volt",
    displayName: "Volt",
    sub: "energy drink",
    colors: { primary: "#1A1A18", secondary: "#FAC775", accent: "#7DD3FC", bg1: "#1A1A18", bg2: "#3D2F0E", text: "#FAC775" },
    products: [
      { name: "Volt Original", sku: "VLT-ORG-12", slug: "volt-original", swatch: ["#FAC775", "#1A1A18"], hex: "#FAC775", dark: true },
      { name: "Volt Zero",     sku: "VLT-ZRO-12", slug: "volt-zero",     swatch: ["#7DD3FC", "#0C1A2A"], hex: "#7DD3FC", dark: true },
    ],
    voice: ["dramatic lighting", "high contrast", "kinetic energy"],
    bannedWords: ["bro", "hustle", "grind", "pumped", "free", "guarantee"],
  },
};

const ALL_MARKETS = [
  { code: "us-en", name: "United States · English", language: "en" },
  { code: "mx-es", name: "Mexico · Spanish",        language: "es" },
  { code: "de-de", name: "Germany · German",        language: "de" },
  { code: "fr-fr", name: "France · French",         language: "fr" },
  { code: "br-pt", name: "Brazil · Portuguese",     language: "pt" },
];

const DEFAULT_BRIEF = {
  brisa: {
    campaign: "summer-refresh-2026",
    name: "Summer Refresh 2026",
    brand: "brisa",
    products: [{ sku: "BRS-CIT-12" }, { sku: "BRS-BRY-12" }],
    markets: ["us-en", "mx-es"],
    audience: "18–34, urban, health-conscious",
    headline: "Crack open something brighter.",
    subheadline: "Real fruit. Real fizz. Nothing else.",
    cta: "Find a store",
    messageByLocale: { en: "Crack open something brighter.", es: "Abre algo más brillante." },
    ratios: ["1:1", "9:16", "16:9"],
  },
  volt: {
    campaign: "launch-spark-2026",
    name: "Launch Spark 2026",
    brand: "volt",
    products: [{ sku: "VLT-ORG-12" }, { sku: "VLT-ZRO-12" }],
    markets: ["us-en", "de-de"],
    audience: "21–30, gamers, late-shift workers",
    headline: "Charge through the night.",
    subheadline: "Zero crash. Pure focus.",
    cta: "Get yours",
    messageByLocale: { en: "Charge through the night.", de: "Lade dich auf für die Nacht." },
    ratios: ["1:1", "9:16", "16:9"],
  },
};

// ====================== CREATIVES ======================

function buildCreatives(brand, brief, scenario, genaiMode, uploadedAssets) {
  const sc = scenario === "stream-idle" ? "mixed" : scenario;
  const uploads = uploadedAssets || {};
  const out = {};
  brief.markets.forEach((mkt) => {
    out[mkt] = {};
    const language = (ALL_MARKETS.find((m) => m.code === mkt) || {}).language || "en";
    brand.products.forEach((p, pi) => {
      out[mkt][p.slug] = brief.ratios.map((r, ri) => {
        const key = `${mkt}/${p.slug}/${r}`;
        let badge = "OK";
        let path = `outputs/${brief.campaign}/${mkt}/${p.slug}/${r.replace(":", "x")}.png`;
        let stage = null;
        let stageMsg = null;
        // Structured compliance checks (mirrors uploads)
        let checks = [
          { name: "Logo present", status: "OK", message: "bottom-right corner" },
          { name: "Brand colors", status: "OK", message: "matches palette" },
          { name: "Banned words", status: "OK", message: "none flagged" },
          { name: "Text contrast", status: "OK", message: "WCAG AA" },
        ];

        if (sc === "all-clean") {
          // leave clean
        } else if (sc === "mixed") {
          if (pi === 0 && r === "9:16" && mkt === brief.markets[0]) {
            badge = "WARN";
            checks = checks.map((c) =>
              c.name === "Brand colors"
                ? { ...c, status: "WARN", message: "low contrast — headline on light background" }
                : c
            );
          }
          if (pi === 1 && r === "16:9" && mkt === brief.markets[1]) {
            badge = "FAIL"; path = null;
            stage = "genai";
            stageMsg = "OpenAI 429 rate limit — retried 3× (1s/4s/16s) then failed";
          }
        } else if (sc === "stress") {
          if (ri === 1) {
            badge = "WARN";
            checks = checks.map((c) =>
              c.name === "Banned words" ? { ...c, status: "WARN", message: "flagged: 'energy' (auto-suppress on)" } : c
            );
          }
          if (pi === 1 && ri === 2) {
            badge = "FAIL"; path = null;
            stage = "compose";
            stageMsg = `font load failed — ENOENT inputs/brands/${brand.slug}/font.ttf`;
          }
        }

        const hasUpload = !!uploads[p.slug];
        const source = hasUpload ? "local" : ((pi === 0) ? "genai" : "local");
        const generatedAt = new Date(Date.now() - (1000 * (60 + ri * 4 + pi * 8))).toISOString();

        return {
          key, product: p.slug, productName: p.name, market: mkt, language,
          ratio: r, source, path, badge, checks, stage, stageMsg, generatedAt,
          message: brief.messageByLocale[language] || brief.headline,
          subheadline: brief.subheadline || "",
          cta: brief.cta || "",
        };
      });
    });
  });
  return out;
}

function buildCounts(creatives, brief, genaiMode) {
  let succeeded = 0, failed = 0, flagged = 0, generated = 0, reused = 0, warn = 0;
  const genaiProducts = new Set();
  Object.values(creatives).forEach((mkt) =>
    Object.values(mkt).forEach((arr) =>
      arr.forEach((c) => {
        if (c.path === null) failed++;
        else { succeeded++; c.source === "genai" ? generated++ : reused++; }
        if (c.source === "genai" && c.path !== null) genaiProducts.add(c.product + "|" + c.market);
        if (c.badge === "WARN") { flagged++; warn++; }
        else if (c.badge === "FAIL") { flagged++; }
      })
    )
  );
  // D9 cheap mode: 1 master image per (product, market), Sharp downsizes the rest.
  if (genaiMode === "cheap") generated = genaiProducts.size;
  const requested = brief.products.length * brief.markets.length * brief.ratios.length;
  return { requested, succeeded, failed, flagged, warn, generated, reused };
}

// ====================== NDJSON-STYLE LOG ======================
// Stages match docs: init → brand → resolve → genai → resize → composite → compliance → write → complete

function buildLogLines(brand, brief, creatives, scenario, genaiMode) {
  const lines = [];
  const cheap = genaiMode === "cheap";
  let secs = 0;
  const stamp = (n = 0.4) => {
    secs += n;
    const t = new Date(Date.UTC(2026, 4, 5, 15, 30, 0) + secs * 1000);
    return t.toISOString().substring(11, 19);
  };

  const push = (kind, stage, msg, details) =>
    lines.push({ kind, stage, time: stamp(), msg, details });

  push("step", "init", "pipeline started — POST /api/generate", { campaignId: brief.campaign });
  push("step", "init", `brief validated — ${brief.products.length} products × ${brief.markets.length} markets × ${brief.ratios.length} ratios`);
  push("step", "brand", `loading brand profile: ${brand.displayName}`);
  push("step", "brand", "brand profile loaded — palette, voice, logos, font, banned-words");
  push("step", "init", `outputs/${brief.campaign}/ cleared (D15)`);
  push("step", "init", "brief.json written");
  // D30 \u2014 stream-idle scenario: pipeline starts but never finishes
  if (scenario === "stream-idle") {
    brief.markets.slice(0, 1).forEach((mkt) => {
      push("step", "init", `market: ${mkt} \u2014 locale=${mkt.split("-").pop()}`);
      push("step", "resolve", `resolving assets for ${brand.products.length} products`);
      push("step", "genai", cheap
        ? "generating 1 master via dall-e-3 (Sharp downsizes 3 ratios)"
        : "generating fallback asset via dall-e-3");
    });
    push("warn", "genai", "\u2014 no NDJSON for 60s \u2014 stream considered idle (D30)");
    push("error", "complete", "pipeline aborted \u2014 stream idle, no completion event received");
    return lines;
  }
  brief.markets.forEach((mkt) => {
    push("step", "init", `market: ${mkt} — locale=${mkt.split("-").pop()}`);
    push("step", "resolve", `resolving assets for ${brand.products.length} products`);
    brand.products.forEach((p, pi) => {
      const isLocal = pi !== 0;
      if (isLocal) {
        push("ok", "resolve", `${p.slug} — using local asset (${p.slug}.png)`, { sku: p.sku, source: "local" });
      } else {
        push("warn", "resolve", `missing hero asset for product: ${p.name}`, { sku: p.sku });
        push("step", "genai", cheap
          ? `generating 1 master via dall-e-3 (Sharp downsizes 3 ratios)`
          : `generating fallback asset via dall-e-3`,
          { sku: p.sku, mode: cheap ? "dall-e-3+sharp" : "dall-e-3" });
      }
    });
    push("step", "resize", "resizing assets to 3 aspect ratios");
    push("step", "composite", `compositing creatives for ${brand.products.length} products`);

    brand.products.forEach((p) => {
      brief.ratios.forEach((r) => {
        const c = creatives[mkt][p.slug].find((x) => x.ratio === r);
        if (c.path === null) {
          push("error", c.stage, `${p.slug} ${r} ${mkt} — ${c.stageMsg}`, { sku: p.sku, market: mkt, ratio: r });
        }
      });
    });
  });

  push("step", "compliance", "running compliance checks");
  const counts = buildCounts(creatives, brief, genaiMode);
  if (counts.flagged > 0) push("warn", "compliance", `${counts.flagged} creative${counts.flagged > 1 ? "s" : ""} flagged for review`);
  else push("ok", "compliance", "all creatives passed compliance");
  push("step", "write", "report.json written");
  if (counts.failed > 0) {
    push("error", "complete", `pipeline completed with errors`, {
      totalCreatives: counts.requested, passed: counts.succeeded - counts.warn, flagged: counts.flagged, failed: counts.failed
    });
  } else {
    push("complete", "complete", "pipeline completed successfully", {
      totalCreatives: counts.requested, passed: counts.succeeded - counts.warn, flagged: counts.warn
    });
  }
  return lines;
}

window.CAST = { BRANDS, ALL_MARKETS, DEFAULT_BRIEF, buildCreatives, buildCounts, buildLogLines };
