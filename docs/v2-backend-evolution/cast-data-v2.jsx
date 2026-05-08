/* global React */
// ====================== BRANDS / DEFAULT BRIEF ======================
// v2: added persona fixtures, performance data, fatigue data for Jordan + Sam stories

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
    personaId: "urban-wellness-seeker", // v2: default persona selected
    headline: "Crack open something brighter.",
    subheadline: "Real fruit. Real fizz. Nothing else.",
    cta: "Find a store",
    messageByLocale: { en: "Crack open something brighter.", es: "Abre algo más brillante." },
    ratios: ["1x1", "9x16", "16x9"],
  },
  volt: {
    campaign: "launch-spark-2026",
    name: "Launch Spark 2026",
    brand: "volt",
    products: [{ sku: "VLT-ORG-12" }, { sku: "VLT-ZRO-12" }],
    markets: ["us-en", "de-de"],
    audience: "21–30, gamers, late-shift workers",
    personaId: "gamer-night-owl", // v2: default persona selected
    headline: "Charge through the night.",
    subheadline: "Zero crash. Pure focus.",
    cta: "Get yours",
    messageByLocale: { en: "Charge through the night.", de: "Lade dich auf für die Nacht." },
    ratios: ["1x1", "9x16", "16x9"],
  },
};

// ====================== PERSONAS (v2 new) ======================
// Stored in Qdrant cast-personas in production.
// These fixtures drive the persona typeahead in the Brief Editor (S1)
// and the PersonaPerformanceTable in the Performance Dashboard (S6).

const PERSONAS = {
  brisa: [
    {
      id: "urban-wellness-seeker",
      brand: "brisa",
      market: null, // brand-wide
      displayName: "Urban Wellness Seeker",
      age: "25–34",
      interests: ["fitness", "clean eating", "sustainability", "mindfulness"],
      motivators: ["health", "social proof", "ingredient transparency"],
      promptFragment: "health-conscious urban professional who values clean ingredients, sustainability, and mindful consumption — someone who reads labels and shares finds with their network",
      performanceScore: 0.82,
    },
    {
      id: "festival-socialite",
      brand: "brisa",
      market: null,
      displayName: "Festival Socialite",
      age: "21–28",
      interests: ["live music", "outdoor events", "social media", "aesthetics"],
      motivators: ["social belonging", "shareability", "looking good"],
      promptFragment: "trend-forward social butterfly who discovers products at events and festivals — driven by aesthetics, shareability, and being first among friends to find something new",
      performanceScore: 0.61,
    },
    {
      id: "brisa-mx-health-mom",
      brand: "brisa",
      market: "mx-es",
      displayName: "Health-Conscious Mamá (MX)",
      age: "30–45",
      interests: ["family nutrition", "natural products", "value"],
      motivators: ["family health", "trust", "value for money"],
      promptFragment: "health-conscious mother in Mexico City who prioritizes natural, clean products for her family — trusts brands that are transparent about ingredients and offer real value",
      performanceScore: 0.74,
    },
  ],
  volt: [
    {
      id: "gamer-night-owl",
      brand: "volt",
      market: null,
      displayName: "Gamer Night Owl",
      age: "18–28",
      interests: ["gaming", "streaming", "esports", "tech"],
      motivators: ["performance", "focus", "community recognition"],
      promptFragment: "dedicated gamer and streamer who sessions late into the night — values clean focus and performance without the crash, and wants a drink that matches the intensity of the game",
      performanceScore: 0.88,
    },
    {
      id: "gym-athlete",
      brand: "volt",
      market: null,
      displayName: "Gym Athlete",
      age: "22–35",
      interests: ["weightlifting", "CrossFit", "nutrition", "recovery"],
      motivators: ["performance", "results", "efficiency"],
      promptFragment: "serious gym-goer who treats their body as a system to optimize — wants functional energy with zero junk, appreciates brands that speak to results rather than hype",
      performanceScore: 0.71,
    },
  ],
};

// ====================== PERFORMANCE DATA (v2 new) ======================
// Fixtures for Jordan's performance dashboard (S6).
// In production: patched onto Qdrant cast-creatives payloads via POST /api/performance.
// Here: used by buildPerformanceData() and buildTopCreatives().

const MOCK_PERFORMANCE = {
  "brisa/us-en": [
    { product: "brisa-citrus", ratio: "1x1",  personaId: "urban-wellness-seeker", impressions: 142000, clicks: 4970, ctr: 0.035, conversions: 312, spend: 890, daysRunning: 18, performanceScore: 0.84 },
    { product: "brisa-citrus", ratio: "9x16", personaId: "urban-wellness-seeker", impressions: 98000,  clicks: 2744, ctr: 0.028, conversions: 198, spend: 620, daysRunning: 18, performanceScore: 0.71 },
    { product: "brisa-citrus", ratio: "16x9", personaId: "urban-wellness-seeker", impressions: 67000,  clicks: 2546, ctr: 0.038, conversions: 241, spend: 540, daysRunning: 18, performanceScore: 0.87 },
    { product: "brisa-berry",  ratio: "1x1",  personaId: "festival-socialite",    impressions: 88000,  clicks: 1936, ctr: 0.022, conversions: 89,  spend: 430, daysRunning: 42, performanceScore: 0.52 },
    { product: "brisa-berry",  ratio: "9x16", personaId: "festival-socialite",    impressions: 201000, clicks: 3819, ctr: 0.019, conversions: 71,  spend: 980, daysRunning: 47, performanceScore: 0.44 },
    { product: "brisa-berry",  ratio: "16x9", personaId: "festival-socialite",    impressions: 54000,  clicks: 972,  ctr: 0.018, conversions: 44,  spend: 310, daysRunning: 44, performanceScore: 0.41 },
  ],
  "brisa/mx-es": [
    { product: "brisa-citrus", ratio: "1x1",  personaId: "brisa-mx-health-mom", impressions: 76000,  clicks: 2812, ctr: 0.037, conversions: 188, spend: 340, daysRunning: 12, performanceScore: 0.86 },
    { product: "brisa-citrus", ratio: "9x16", personaId: "brisa-mx-health-mom", impressions: 54000,  clicks: 1782, ctr: 0.033, conversions: 141, spend: 280, daysRunning: 12, performanceScore: 0.78 },
    { product: "brisa-berry",  ratio: "1x1",  personaId: "brisa-mx-health-mom", impressions: 48000,  clicks: 1104, ctr: 0.023, conversions: 62,  spend: 190, daysRunning: 31, performanceScore: 0.54 },
  ],
  "volt/us-en": [
    { product: "volt-original", ratio: "1x1",  personaId: "gamer-night-owl", impressions: 198000, clicks: 8910, ctr: 0.045, conversions: 521, spend: 1240, daysRunning: 9,  performanceScore: 0.93 },
    { product: "volt-original", ratio: "9x16", personaId: "gamer-night-owl", impressions: 145000, clicks: 5945, ctr: 0.041, conversions: 398, spend: 890,  daysRunning: 9,  performanceScore: 0.89 },
    { product: "volt-zero",     ratio: "1x1",  personaId: "gym-athlete",     impressions: 112000, clicks: 3584, ctr: 0.032, conversions: 201, spend: 670,  daysRunning: 22, performanceScore: 0.74 },
    { product: "volt-zero",     ratio: "9x16", personaId: "gym-athlete",     impressions: 89000,  clicks: 2403, ctr: 0.027, conversions: 134, spend: 480,  daysRunning: 38, performanceScore: 0.61 },
  ],
};

// ====================== FATIGUE DATA (v2 new) ======================
// Fixtures for Jordan's fatigue report (S7).
// fatigueScore = daysRunning + (impressions / 1000) - (ctr * 100)
// Threshold default: 45. Above threshold → fatigueRisk: true.

function computeFatigueScore({ daysRunning, impressions, ctr }) {
  return Math.round(daysRunning + (impressions / 1000) - (ctr * 100));
}

function buildFatigueReport(brand, market) {
  const key = `${brand}/${market}`;
  const perf = MOCK_PERFORMANCE[key] || [];
  const THRESHOLD = 45;

  const scored = perf.map((c) => ({
    ...c,
    fatigueScore: computeFatigueScore(c),
    fatigueRisk: computeFatigueScore(c) > THRESHOLD,
  }));

  const fatigued = scored
    .filter((c) => c.fatigueRisk)
    .sort((a, b) => b.fatigueScore - a.fatigueScore);

  // For each fatigued creative, find top-performing creatives from same brand/market as seeds
  const topPerformers = scored
    .filter((c) => !c.fatigueRisk)
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 3);

  return {
    brand,
    market,
    threshold: THRESHOLD,
    fatigued: fatigued.map((c) => ({
      ...c,
      recommendedSeeds: topPerformers,
    })),
    summary: {
      total: scored.length,
      fatigued: fatigued.length,
      healthy: scored.length - fatigued.length,
    },
  };
}

function buildPerformanceData(brand, market) {
  const key = `${brand}/${market}`;
  const perf = MOCK_PERFORMANCE[key] || [];

  const sorted = [...perf].sort((a, b) => b.performanceScore - a.performanceScore);

  // Aggregate persona performance
  const personaMap = {};
  perf.forEach((c) => {
    if (!personaMap[c.personaId]) {
      personaMap[c.personaId] = { id: c.personaId, creativeCount: 0, totalCtr: 0, totalConversions: 0, totalSpend: 0 };
    }
    personaMap[c.personaId].creativeCount++;
    personaMap[c.personaId].totalCtr += c.ctr;
    personaMap[c.personaId].totalConversions += c.conversions;
    personaMap[c.personaId].totalSpend += c.spend;
  });

  const personaPerformance = Object.values(personaMap).map((p) => ({
    ...p,
    avgCtr: (p.totalCtr / p.creativeCount).toFixed(3),
    avgConversions: Math.round(p.totalConversions / p.creativeCount),
    performanceScore: (p.totalCtr / p.creativeCount * 0.6 + (p.totalConversions / p.creativeCount / 300) * 0.4).toFixed(2),
    persona: (PERSONAS[brand] || []).find((persona) => persona.id === p.id),
  })).sort((a, b) => b.performanceScore - a.performanceScore);

  // Cost summary (mock — in production from report.json costs field)
  const totalAdSpend = perf.reduce((sum, c) => sum + (c.spend || 0), 0);
  const estimatedGenerationCost = perf.length * 0.04; // dall-e-3 rate
  const costEfficiencyRatio = totalAdSpend > 0 ? (totalAdSpend / estimatedGenerationCost).toFixed(0) : null;

  return {
    brand,
    market,
    topCreatives: sorted,
    personaPerformance,
    costs: {
      totalAdSpend,
      estimatedGenerationCost: estimatedGenerationCost.toFixed(2),
      costEfficiencyRatio, // ad spend : generation cost ratio
    },
    dateRange: { from: "2026-04-08", to: "2026-05-08" },
  };
}

// ====================== CREATIVES ======================
// (unchanged from v1 — v2 adds status and personaId fields)

function buildCreatives(brand, brief, scenario, genaiMode, uploadedAssets) {
  const sc = scenario === "stream-idle" ? "mixed" : scenario;
  const uploads = uploadedAssets || {};
  const out = {};
  const products = brief.products
    .map((bp) => brand.products.find((p) => p.sku === bp.sku))
    .filter(Boolean);

  brief.markets.forEach((mkt) => {
    out[mkt] = {};
    const language = (ALL_MARKETS.find((m) => m.code === mkt) || {}).language || "en";
    products.forEach((p, pi) => {
      out[mkt][p.slug] = brief.ratios.map((r, ri) => {
        const key = `${mkt}/${p.slug}/${r}`;
        let badge = "OK";
        let path = `outputs/${brief.campaign}/${mkt}/${p.slug}/${r}.png`;
        let stage = null;
        let stageMsg = null;
        let checks = [
          { name: "Logo present", status: "OK", message: "bottom-right corner" },
          { name: "Brand colors", status: "OK", message: "matches palette" },
          { name: "Banned words", status: "OK", message: "none flagged" },
          { name: "Text contrast", status: "OK", message: "WCAG AA" },
        ];

        if (sc === "mixed") {
          if (pi === 0 && r === "9x16" && mkt === brief.markets[0]) {
            badge = "WARN";
            checks = checks.map((c) =>
              c.name === "Brand colors"
                ? { ...c, status: "WARN", message: "low contrast — headline on light background" }
                : c
            );
          }
          if (pi === 1 && r === "16x9" && mkt === brief.markets[1]) {
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

        // v2: add approval status + persona + cost per creative
        const perfKey = `${brand.slug}/${mkt}`;
        const perfData = (MOCK_PERFORMANCE[perfKey] || []).find(
          (d) => d.product === p.slug && d.ratio === r
        );
        const fatigueScore = perfData ? computeFatigueScore(perfData) : null;

        return {
          key, product: p.slug, productName: p.name, market: mkt, language,
          ratio: r, source, path, badge, checks, stage, stageMsg, generatedAt,
          message: brief.messageByLocale[language] || brief.headline,
          subheadline: brief.subheadline || "",
          cta: brief.cta || "",
          // v2 fields
          status: "pending",           // approval status: pending | approved | rejected
          rejectionReason: null,
          personaId: brief.personaId || null,
          estimatedCost: source === "genai" ? 0.04 : 0,
          performanceScore: perfData ? perfData.performanceScore : null,
          fatigueScore,
          fatigueRisk: fatigueScore !== null ? fatigueScore > 45 : false,
        };
      });
    });
  });
  return out;
}

function buildCounts(creatives, brief, genaiMode) {
  let succeeded = 0, failed = 0, flagged = 0, generated = 0, reused = 0, warn = 0;
  let approved = 0, rejected = 0, pending = 0; // v2
  let estimatedCost = 0; // v2
  const genaiProducts = new Set();

  Object.values(creatives).forEach((mkt) =>
    Object.values(mkt).forEach((arr) =>
      arr.forEach((c) => {
        if (c.path === null) failed++;
        else {
          succeeded++;
          c.source === "genai" ? generated++ : reused++;
        }
        if (c.source === "genai" && c.path !== null) genaiProducts.add(c.product + "|" + c.market);
        if (c.badge === "WARN") { flagged++; warn++; }
        else if (c.badge === "FAIL") { flagged++; }
        // v2 approval counts
        if (c.status === "approved") approved++;
        else if (c.status === "rejected") rejected++;
        else pending++;
        // v2 cost
        estimatedCost += c.estimatedCost || 0;
      })
    )
  );

  if (genaiMode === "cheap") generated = genaiProducts.size;
  const requested = brief.products.length * brief.markets.length * brief.ratios.length;

  return {
    requested, succeeded, failed, flagged, warn, generated, reused,
    // v2
    approved, rejected, pending,
    costs: {
      estimated: parseFloat(estimatedCost.toFixed(4)),
      actual: null, // populated after pipeline completes in production
      currency: "USD",
    },
  };
}

// ====================== NDJSON-STYLE LOG ======================
// (unchanged from v1 — v2 adds persona resolution step)

function buildLogLines(brand, brief, creatives, scenario, genaiMode) {
  const lines = [];
  const cheap = genaiMode === "cheap";
  let secs = 0;
  const stamp = (n = 0.4) => {
    secs += n;
    const t = new Date(Date.UTC(2026, 4, 5, 15, 30, 0) + secs * 1000);
    return t.toISOString().substring(11, 19);
  };
  const products = brief.products
    .map((bp) => brand.products.find((p) => p.sku === bp.sku))
    .filter(Boolean);

  const push = (kind, stage, msg, details) =>
    lines.push({ kind, stage, time: stamp(), msg, details });

  push("step", "init", "pipeline started — POST /api/generate", { campaignId: brief.campaign });
  push("step", "init", `brief validated — ${brief.products.length} products × ${brief.markets.length} markets × ${brief.ratios.length} ratios`);

  // v2: persona resolution step
  if (brief.personaId) {
    const brandPersonas = PERSONAS[brand.slug] || [];
    const persona = brandPersonas.find((p) => p.id === brief.personaId);
    if (persona) {
      push("step", "persona", `persona resolved: "${persona.displayName}" (${brief.personaId})`, { promptFragment: persona.promptFragment.slice(0, 60) + "..." });
    }
  } else {
    push("step", "persona", "no persona selected — using raw audience string");
  }

  push("step", "brand", `loading brand profile: ${brand.displayName}`);
  push("step", "brand", "brand profile loaded — palette, voice, logos, font, banned-words");
  push("step", "init", `outputs/${brief.campaign}/ cleared`);
  push("step", "init", "brief.json written");

  if (scenario === "stream-idle") {
    brief.markets.slice(0, 1).forEach((mkt) => {
      push("step", "init", `market: ${mkt} — locale=${mkt.split("-").pop()}`);
      push("step", "resolve", `resolving assets for ${products.length} products`);
      push("step", "genai", cheap ? "generating 1 master via gpt-image-1" : "generating fallback via dall-e-3");
    });
    push("warn", "genai", "— no NDJSON for 60s — stream considered idle (D30)");
    push("error", "complete", "pipeline aborted — stream idle, no completion event received");
    return lines;
  }

  brief.markets.forEach((mkt) => {
    push("step", "init", `market: ${mkt} — locale=${mkt.split("-").pop()}`);
    push("step", "resolve", `resolving assets for ${products.length} products`);
    products.forEach((p, pi) => {
      const isLocal = pi !== 0;
      if (isLocal) {
        push("ok", "resolve", `${p.slug} — using local asset (${p.slug}.png)`, { sku: p.sku, source: "local" });
      } else {
        push("warn", "resolve", `missing hero asset for product: ${p.name}`, { sku: p.sku });
        push("step", "genai", cheap
          ? "generating 1 master via gpt-image-1 (Sharp downsizes 3 ratios)"
          : "generating fallback via dall-e-3",
          { sku: p.sku, mode: cheap ? "gpt-image-1+sharp" : "dall-e-3" });
      }
    });
    push("step", "resize", "resizing assets to 3 aspect ratios");
    push("step", "compose", `compositing creatives for ${products.length} products`);

    products.forEach((p) => {
      brief.ratios.forEach((r) => {
        const c = creatives[mkt][p.slug].find((x) => x.ratio === r);
        if (c.path === null) {
          push("error", c.stage, `${p.slug} ${r} ${mkt} — ${c.stageMsg}`, { sku: p.sku, market: mkt, ratio: r });
        }
      });
    });

    // v2: metadata pipeline step
    push("step", "metadata", `analyzing ${products.length * brief.ratios.length} creatives — gpt-4o-mini`);
    push("ok", "metadata", `metadata written · vectorized to Qdrant cast-creatives`);
  });

  push("step", "compliance", "running compliance checks");
  const counts = buildCounts(creatives, brief, genaiMode);
  if (counts.flagged > 0) push("warn", "compliance", `${counts.flagged} creative${counts.flagged > 1 ? "s" : ""} flagged for review`);
  else push("ok", "compliance", "all creatives passed compliance");
  push("step", "write", "report.json written");

  // v2: cost line in log
  push("ok", "write", `run cost: estimated $${counts.costs.estimated.toFixed(4)} (${counts.generated} generated × $0.04 dall-e-3)`);

  if (counts.failed > 0) {
    push("error", "complete", "pipeline completed with errors", {
      totalCreatives: counts.requested, passed: counts.succeeded - counts.warn,
      flagged: counts.flagged, failed: counts.failed,
      costs: counts.costs,
    });
  } else {
    push("complete", "complete", "pipeline completed successfully", {
      totalCreatives: counts.requested, passed: counts.succeeded - counts.warn,
      flagged: counts.warn, costs: counts.costs,
    });
  }
  return lines;
}

// ====================== PROMPT PREVIEW ======================
// v2: includes persona.promptFragment when personaId is set

function buildPromptPreview({ brand, product, market, ratio, personaId }) {
  const lang = (ALL_MARKETS.find((m) => m.code === market) || {}).language || "en";
  const palette = brand.colors ? Object.values(brand.colors).slice(0, 3).join(", ") : "brand palette";
  const voice = brand.voice || "on-brand";
  const ratioHint = ratio === "1x1" ? "square" : ratio === "9x16" ? "tall (story format)" : "wide (landscape)";

  // v2: resolve persona fragment
  let audienceLine = "";
  if (personaId) {
    const brandPersonas = PERSONAS[brand.slug] || [];
    const persona = brandPersonas.find((p) => p.id === personaId);
    if (persona) {
      audienceLine = `Target audience: ${persona.promptFragment}.`;
    }
  }

  return [
    `Hero product photo of ${product.name} (${product.sku}).`,
    `Brand: ${brand.displayName} — ${voice}.`,
    audienceLine,
    `Color palette: ${palette}.`,
    `Composition: clean studio background, room for headline overlay, ${ratioHint} (${ratio}).`,
    `Locale: ${market} (${lang}). No on-image text — text is composited at the resize step.`,
    `Avoid: ${(brand.bannedWords || []).slice(0, 4).join(", ")}.`,
  ].filter(Boolean).join(" ");
}

window.CAST = {
  BRANDS,
  ALL_MARKETS,
  DEFAULT_BRIEF,
  PERSONAS,              // v2
  MOCK_PERFORMANCE,      // v2
  buildCreatives,
  buildCounts,
  buildLogLines,
  buildPromptPreview,
  buildPerformanceData,  // v2
  buildFatigueReport,    // v2
  computeFatigueScore,   // v2
};
