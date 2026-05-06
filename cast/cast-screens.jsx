/* global React, CAST */
const { useState, useMemo, useEffect, useRef } = React;

function Badge({ kind, children }) { return <span className={`badge b-${kind}`}>{children}</span>; }

function syntaxHighlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
    let cls = "n";
    if (/^"/.test(m)) cls = /:$/.test(m) ? "k" : "s";
    else if (/true|false|null/.test(m)) cls = "p";
    return `<span class="${cls}">${m}</span>`;
  });
}

// ====================== S1: BRIEF EDITOR (FORM-FIRST + JSON TOGGLE) ======================

function Dropzone({ slug, fileName, dataUrl, onUpload }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const accept = "image/png,image/jpeg,image/webp";
  const handleFile = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpload({ name: file.name, dataUrl: String(ev.target.result) });
    reader.readAsDataURL(file);
  };
  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };
  const hasFile = !!fileName;

  return (
    <div
      className={`dropzone ${hasFile ? "has-file" : ""} ${over ? "over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      title={hasFile ? `replace ${fileName}` : "drop image or click to upload"}
      style={dataUrl ? { backgroundImage: `url(${dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {hasFile ? (
        <span className="dz-label">{fileName}</span>
      ) : (
        <span className="dz-label muted">drop hero · or generate</span>
      )}
      {hasFile && (
        <button
          className="dz-clear"
          title="remove upload"
          onClick={(e) => { e.stopPropagation(); onUpload(false); if (inputRef.current) inputRef.current.value = ""; }}
        >×</button>
      )}
    </div>
  );
}

function MarketsTypeahead({ brief, dispatch }) {
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const MARKET_RE = /^[a-z]{2}-[a-z]{2}$/;
  const ql = q.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!ql) return [];
    return CAST.ALL_MARKETS.filter((m) => {
      if (brief.markets.includes(m.code)) return false;
      return m.code.includes(ql) || m.name.toLowerCase().includes(ql) || (m.language || "").toLowerCase().includes(ql);
    }).slice(0, 6);
  }, [ql, brief.markets]);

  const add = (code) => {
    dispatch({ type: "toggleMarket", code });
    setQ(""); setErr("");
  };
  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[0]) return add(suggestions[0].code);
      if (MARKET_RE.test(ql)) return add(ql);
      setErr(`expected lowercase “xx-yy” (e.g. de-de), got “${q}”`);
    }
  };

  return (
    <div className="market-type">
      <input
        className="market-type-input"
        placeholder="add market — type code or country (e.g. de-de, japan)"
        value={q}
        onChange={(e) => { setQ(e.target.value); setErr(""); }}
        onKeyDown={onKey}
      />
      {suggestions.length > 0 && (
        <div className="market-suggest">
          {suggestions.map((m) => (
            <button key={m.code} className="market-suggest-row" onClick={() => add(m.code)} title={`Add ${m.code}`}>
              <span className="ms-code">{m.code}</span>
              <span className="ms-name">{m.name}</span>
            </button>
          ))}
        </div>
      )}
      {err && <div className="field-error">{err}</div>}
    </div>
  );
}

function S1BriefEditor({ state, dispatch, jsonMode, onJsonToggle }) {
  const { brand, brief, brandSlug, uploadedAssets, logoVariant } = state;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const slugInvalid = !SLUG_RE.test(brief.campaign || "");

  // Active languages derived from selected markets (D11/D24/Story 1).
  const activeLanguages = useMemo(() => {
    const seen = new Set();
    const langs = [];
    brief.markets.forEach((code) => {
      const m = CAST.ALL_MARKETS.find((mm) => mm.code === code);
      if (m && !seen.has(m.language)) { seen.add(m.language); langs.push(m); }
    });
    return langs; // [{ code, language, name }]
  }, [brief.markets]);

  // Banned-word inline check (across headline + subheadline + cta + every locale message)
  const bannedHit = useMemo(() => {
    const localeMsgs = Object.values(brief.messageByLocale || {}).join(" ");
    const haystack = `${brief.headline} ${brief.subheadline || ""} ${brief.cta || ""} ${localeMsgs}`.toLowerCase();
    return brand.bannedWords.filter((w) => haystack.includes(w.toLowerCase()));
  }, [brief.headline, brief.subheadline, brief.cta, brief.messageByLocale, brand.bannedWords]);

  // Catalog-pick products (full brand catalog) vs in-brief products
  const inBriefSkus = new Set(brief.products.map((p) => p.sku));
  const availableCatalog = brand.products.filter((p) => !inBriefSkus.has(p.sku));
  const briefProducts = brief.products
    .map((bp) => brand.products.find((p) => p.sku === bp.sku))
    .filter(Boolean);

  return (
    <div className="s1">
      {/* SIDEBAR: brand + logo + asset detection */}
      <div className="s1-sidebar">
        <div className="section-h">Brand</div>
        <div className="brand-list">
          {Object.values(CAST.BRANDS).map((b) => (
            <div key={b.slug} className={`brand-card ${brandSlug === b.slug ? "active" : ""}`} onClick={() => dispatch({ type: "setBrand", slug: b.slug })}>
              <div className="brand-swatches">
                <div style={{ background: b.colors.primary }} />
                <div style={{ background: b.colors.secondary }} />
                <div style={{ background: b.colors.accent }} />
              </div>
              <div>
                <div className="name">{b.displayName}</div>
                <div className="sub">{b.sub}</div>
              </div>
              <div className="check">✓</div>
            </div>
          ))}
        </div>

        <div className="section-spacer" />
        <div className="section-h">Brand colors</div>
        <div className="palette-row">
          <div className="palette-chip"><span className="dot" style={{ background: brand.colors.primary }} /><span>primary</span></div>
          <div className="palette-chip"><span className="dot" style={{ background: brand.colors.secondary }} /><span>secondary</span></div>
          <div className="palette-chip"><span className="dot" style={{ background: brand.colors.accent }} /><span>accent</span></div>
        </div>

        <div className="section-spacer" />
        <div className="section-h">Logo variant</div>
        <div className="logo-grid">
          {[
            { id: "primary-on-light", label: "Primary · light" },
            { id: "primary-on-dark",  label: "Primary · dark" },
            { id: "mono-white",       label: "Mono white" },
            { id: "mono-black",       label: "Mono black" },
          ].map((v) => {
            const isLight = v.id.includes("light") || v.id === "mono-black";
            return (
              <div key={v.id} className={`logo-opt ${logoVariant === v.id ? "on" : ""}`} onClick={() => dispatch({ type: "setLogo", id: v.id })}>
                <div className="swatch" style={{ background: isLight ? "white" : "#222", color: isLight ? brand.colors.primary : "white" }}>
                  {brand.displayName.slice(0, 1)}
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.3 }}>{v.label}</div>
              </div>
            );
          })}
        </div>

        <div className="section-spacer" />
        <div className="section-h">Detected input assets</div>
        {brand.products.map((p, i) => {
          const has = uploadedAssets[p.slug] || (i !== 0);
          const upObj = (uploadedAssets[p.slug] && typeof uploadedAssets[p.slug] === "object") ? uploadedAssets[p.slug] : null;
          return (
            <div key={p.slug} className={`detected-row ${has ? "found" : "missing"}`}>
              <span className="icon">{has ? "✓" : "→"}</span>
              <span style={{ flex: 1 }}>{has ? (upObj ? upObj.name : `${p.slug}.png`) : `${p.slug} — will generate`}</span>
            </div>
          );
        })}

        <div className="section-spacer" />
        <div className="section-h">GenAI mode</div>
        <Badge kind="info-soft">{state.genaiMode === "cheap" ? "dall-e-3 · 1 master + Sharp" : "dall-e-3 · 3 native sizes"}</Badge>
      </div>

      {/* MAIN */}
      <div className="s1-main">
        <div className="s1-toolbar">
          <div className="seg">
            <button className={`seg-btn ${!jsonMode ? "on" : ""}`} onClick={() => onJsonToggle(false)}>Form</button>
            <button className={`seg-btn ${jsonMode ? "on" : ""}`} onClick={() => onJsonToggle(true)}>JSON</button>
          </div>
          <div className="grow" />
          {bannedHit.length > 0 && (
            <span className="inline-warn">⚠ banned: {bannedHit.join(", ")}</span>
          )}
        </div>

        {jsonMode ? (
          <div className="json-editor" style={{ minHeight: 380 }} dangerouslySetInnerHTML={{ __html: syntaxHighlightJSON(brief) }} />
        ) : (
          <>
            {/* Campaign info */}
            <div className="card">
              <div className="card-h">Campaign</div>
              <div className="card-b two-col">
                <div className="field">
                  <label>Campaign name</label>
                  <input className="field-input" value={brief.name} onChange={(e) => dispatch({ type: "setField", field: "name", value: e.target.value })} />
                </div>
                <div className="field">
                  <label>Slug</label>
                  <input className={`field-input mono ${slugInvalid ? "warn" : ""}`} value={brief.campaign} onChange={(e) => dispatch({ type: "setField", field: "campaign", value: e.target.value })} />
                  {slugInvalid && <div className="field-error">slug must match <code>[a-z0-9]+(-[a-z0-9]+)*</code> — lowercase, hyphens only</div>}
                </div>
                <div className="field span-2">
                  <label>Default headline</label>
                  <input className={`field-input ${bannedHit.length ? "warn" : ""}`} value={brief.headline} onChange={(e) => dispatch({ type: "setField", field: "headline", value: e.target.value })} />
                  <div className="field-help">used as fallback when a locale row is empty</div>
                </div>
                <div className="field span-2">
                  <label>Subheadline</label>
                  <input className="field-input" value={brief.subheadline || ""} onChange={(e) => dispatch({ type: "setField", field: "subheadline", value: e.target.value })} />
                </div>
                <div className="field">
                  <label>CTA</label>
                  <input className="field-input" value={brief.cta || ""} onChange={(e) => dispatch({ type: "setField", field: "cta", value: e.target.value })} />
                </div>
                <div className="field">
                  <label>Audience</label>
                  <input className="field-input" value={brief.audience} onChange={(e) => dispatch({ type: "setField", field: "audience", value: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Headlines per locale (D11/Story 1) */}
            <div className="card">
              <div className="card-h">Headlines (per locale) <span className="card-sub">one row per active language &middot; falls back to default headline</span></div>
              <div className="card-b">
                {activeLanguages.length === 0 && (
                  <div className="empty-row">add at least one market to localize your headline</div>
                )}
                {activeLanguages.map((m) => {
                  const value = (brief.messageByLocale && brief.messageByLocale[m.language]) || "";
                  const lowered = value.toLowerCase();
                  const localBanned = brand.bannedWords.filter((w) => lowered.includes(w.toLowerCase()));
                  return (
                    <div key={m.language} className="locale-row">
                      <span className="locale-tag mono">{m.language}</span>
                      <input
                        className={`field-input ${localBanned.length ? "warn" : ""}`}
                        placeholder={`fallback: ${brief.headline}`}
                        value={value}
                        onChange={(e) => dispatch({ type: "setLocaleMessage", lang: m.language, value: e.target.value })}
                      />
                      {localBanned.length > 0 && (
                        <span className="locale-banned">&#9888; {localBanned.join(", ")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Markets */}
            <div className="card">
              <div className="card-h">Markets <span className="card-sub">target locales for localized copy</span></div>
              <div className="card-b">
                <MarketsTypeahead brief={brief} dispatch={dispatch} />
                <div className="chip-row">
                  {CAST.ALL_MARKETS.map((m) => {
                    const on = brief.markets.includes(m.code);
                    return (
                      <span key={m.code} className={`pick-chip ${on ? "on" : ""}`} onClick={() => dispatch({ type: "toggleMarket", code: m.code })}>
                        {on && <span className="ck">✓</span>}{m.name}
                      </span>
                    );
                  })}
                  {brief.markets
                    .filter((c) => !CAST.ALL_MARKETS.some((m) => m.code === c))
                    .map((c) => (
                      <span key={c} className="pick-chip on custom" onClick={() => dispatch({ type: "toggleMarket", code: c })} title="custom market — click to remove">
                        <span className="ck">✓</span>{c} <span className="ms-tag">custom</span>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* Aspect ratios */}
            <div className="card">
              <div className="card-h">Aspect ratios</div>
              <div className="card-b">
                <div className="chip-row">
                  {[
                    { v: "1:1",  l: "1:1 · Square" },
                    { v: "9:16", l: "9:16 · Story" },
                    { v: "16:9", l: "16:9 · Landscape" },
                  ].map((r) => {
                    const on = brief.ratios.includes(r.v);
                    return (
                      <span key={r.v} className={`pick-chip ${on ? "on" : ""}`} onClick={() => dispatch({ type: "toggleRatio", value: r.v })}>
                        {on && <span className="ck">✓</span>}{r.l}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Products from brand catalog */}
            <div className="card">
              <div className="card-h">
                Products
                <span className="card-sub">picked from {brand.displayName} catalog · drop hero or generate via dall-e-3</span>
                <div className="grow" />
                {availableCatalog.length > 0 ? (
                  <div className="catalog-add">
                    <button className="btn btn-sm">+ Add product ▾</button>
                    <div className="catalog-menu">
                      {availableCatalog.map((p) => (
                        <div key={p.sku} className="catalog-item" onClick={() => dispatch({ type: "addProduct", sku: p.sku })}>
                          <div className="swatch" style={{ background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})` }} />
                          <div>
                            <div className="name">{p.name}</div>
                            <div className="sku">{p.sku}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--mono)" }}>all catalog products in brief</span>
                )}
              </div>
              <div className="card-b">
                {briefProducts.length < 2 && (
                  <div className="inline-note">↑ docs recommend ≥ 2 products per brief</div>
                )}
                {briefProducts.map((p, i) => {
                  const upload = uploadedAssets[p.slug];
                  const uploadObj = (upload && typeof upload === "object") ? upload : null;
                  const has = !!upload || (i !== 0);
                  const fileName = uploadObj ? uploadObj.name : `${p.slug}.png`;
                  const willGenerate = !has;
                  const previewMarket = brief.markets[0] || "us-en";
                  const previewRatio  = brief.ratios[0]  || "1:1";
                  const promptPreview = willGenerate
                    ? CAST.buildPromptPreview({ brand, product: p, market: previewMarket, ratio: previewRatio })
                    : null;
                  return (
                    <div className="product-row" key={p.sku}>
                      <div className="prod-meta">
                        <div className="swatch-lg" style={{ background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})`, color: p.hex }}>
                          {brand.displayName.slice(0, 1)}
                        </div>
                        <div>
                          <div className="name">{p.name}</div>
                          <div className="sku">{p.sku}</div>
                          <div className="slug">slug: {p.slug}</div>
                        </div>
                      </div>
                      <div className="prod-asset">
                        <Dropzone
                          slug={p.slug}
                          fileName={has ? fileName : null}
                          dataUrl={uploadObj?.dataUrl || null}
                          onUpload={(payload) => dispatch({ type: "upload", slug: p.slug, payload })}
                        />
                        <span className="src-pill">{has ? "local" : "→ GenAI"}</span>
                        {willGenerate && (
                          <details className="prompt-preview">
                            <summary>Show prompt (D18)</summary>
                            <pre className="prompt-text">{promptPreview}</pre>
                            <div className="prompt-foot">previewing {previewMarket} · {previewRatio}</div>
                          </details>
                        )}
                      </div>
                      <button className="rm-btn" title="Remove from brief" onClick={() => dispatch({ type: "removeProduct", sku: p.sku })}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function S1SummaryStrip({ state, dispatch, running }) {
  const { brief } = state;
  const total = brief.products.length * brief.markets.length * brief.ratios.length;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const slugInvalid = !SLUG_RE.test(brief.campaign || "");
  return (
    <div className="summary-strip">
      <div className="calc">
        <strong>{brief.products.length}</strong> products ·{" "}
        <strong>{brief.markets.length}</strong> markets ·{" "}
        <strong>{brief.ratios.length}</strong> ratios = <strong>{total}</strong> creatives
        {slugInvalid && <span className="warn-inline"> · fix slug to enable</span>}
      </div>
      <div className="grow" />
      <button className="btn btn-primary" disabled={running || total === 0 || slugInvalid} onClick={() => dispatch({ type: "generate" })}>▶ Generate</button>
    </div>
  );
}

// ====================== S2: RUN VIEW ======================

function S2RunView({ state, dispatch }) {
  const { runState, logLines, logCursor, brief } = state;
  const total = brief.products.length * brief.markets.length * brief.ratios.length;
  const visible = logLines.slice(0, logCursor);
  const completedCount = visible.filter((l) => l.kind === "complete").length;
  const pct = runState === "complete" ? 100 : Math.min(99, (logCursor / Math.max(1, logLines.length)) * 100);
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logCursor]);

  const currentStage = visible.length > 0 ? visible[visible.length - 1].stage : "init";

  return (
    <div className="s2">
      <div className="run-status-card">
        <div className="status-row">
          <h2>Pipeline run</h2>
          {runState === "running"  && <Badge kind="info">● running</Badge>}
          {runState === "complete" && <Badge kind="ok">✓ completed</Badge>}
          {runState === "failed"   && <Badge kind="bad">✕ failed</Badge>}
          <div className="grow" />
          <span className="meta">started 15:30:00 UTC · {brief.campaign}</span>
        </div>
        <div className="progress-row">
          <div className="progress-bar">
            <div className={`progress-fill ${runState === "complete" ? "done" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-text">{Math.round(pct)}% · stage <strong>{currentStage}</strong></span>
        </div>
      </div>

      {runState === "failed" && (
        <div className="fail-banner">
          <span className="ico">!</span>
          <div>
            <h3>Run failed mid-stream</h3>
            <p>stage=stream — stream idle for 90s — aborted (D30)</p>
          </div>
          <div className="actions">
            <button className="btn btn-sm" onClick={() => dispatch({ type: "back" })}>edit brief</button>
            <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: "generate" })}>retry</button>
          </div>
        </div>
      )}

      <div className="log-card">
        <div className="log-h">
          <span>Pipeline log</span>
          <span className="log-sub">NDJSON streaming · {visible.length} entries</span>
        </div>
        <div className="log" ref={logRef}>
          {visible.map((l, i) => (
            <div key={i} className={`log-line ${l.kind}`}>
              <span className="log-time">{l.time}</span>
              <span className="log-stage">{l.stage}</span>
              <div className="log-body">
                <div className="log-msg">{l.msg}</div>
                {l.details && (
                  <pre className="log-details">{JSON.stringify(l.details, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
          {runState === "running" && <span className="log-cursor" />}
        </div>
      </div>

      {runState === "complete" && (
        <div className="run-actions">
          <button className="btn" onClick={() => dispatch({ type: "back" })}>edit brief</button>
          <button className="btn btn-primary" onClick={() => dispatch({ type: "view-grid" })}>view output grid →</button>
        </div>
      )}
    </div>
  );
}

// ====================== S3: OUTPUT GRID ======================

function CreativeTile({ creative, brand, uploadedAssets, onClick }) {
  const product = brand.products.find((p) => p.slug === creative.product);
  const ratioClass = creative.ratio === "9:16" ? "creative-9-16" : creative.ratio === "16:9" ? "creative-16-9" : "";
  const isFailed = creative.path === null;
  const klass = isFailed ? "failed" : creative.badge === "WARN" ? "warn" : "";
  const upload = uploadedAssets && uploadedAssets[creative.product];
  const uploadDataUrl = (upload && typeof upload === "object") ? upload.dataUrl : null;
  const showUpload = !isFailed && creative.source === "local" && uploadDataUrl;
  const artStyle = isFailed
    ? {}
    : showUpload
      ? { backgroundImage: `url(${uploadDataUrl})`, backgroundSize: "cover", backgroundPosition: "center", color: product.hex }
      : { background: `linear-gradient(135deg, ${product.swatch[0]} 0%, ${product.swatch[1]} 100%)`, color: product.hex };

  return (
    <div className={`creative-card ${klass}`} onClick={onClick}>
      <div className={`creative ${ratioClass} ${isFailed ? "failed" : ""} ${showUpload ? "with-upload" : ""}`} style={artStyle}>
        {isFailed ? (
          <>
            <span className="stage-label">{creative.stage}</span>
            <div className="stage-msg">{(creative.stageMsg || "").slice(0, 60)}…</div>
          </>
        ) : (
          <>
            <div className="product-name">{creative.productName}</div>
            <div className="message">{creative.message}</div>
            {creative.subheadline && creative.ratio !== "9:16" && (
              <div className="sub-message">{creative.subheadline}</div>
            )}
            {creative.cta && <div className="cta-pill" style={{ color: product.hex }}>{creative.cta}</div>}
            <div className="corner-logo" style={{ color: product.hex }}>{brand.displayName.slice(0, 1).toUpperCase()}</div>
          </>
        )}
        <span className={`badge-overlay ${creative.badge.toLowerCase()}`}>
          {creative.badge === "OK" ? "✓ OK" : creative.badge === "WARN" ? "! WARN" : "✕ FAIL"}
        </span>
      </div>
      <div className="creative-foot">
        <span className="prod">{creative.productName}</span>
        {!isFailed && <span className="src-pill" title={`source: ${creative.source}`}>{creative.source}</span>}
        <span className="grow" />
        <span className="coord">{creative.market} · {creative.ratio}</span>
      </div>
    </div>
  );
}

function S3OutputGrid({ state, dispatch }) {
  const { creatives, counts, brief, brand } = state;
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ratioFilter,  setRatioFilter]  = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");

  const all = useMemo(() => {
    const list = [];
    Object.entries(creatives).forEach(([mkt, byProd]) =>
      Object.values(byProd).forEach((arr) => arr.forEach((c) => list.push(c))));
    return list;
  }, [creatives]);

  const filtered = all.filter((c) => {
    if (statusFilter !== "ALL" && c.badge !== statusFilter) return false;
    if (ratioFilter  !== "ALL" && c.ratio  !== ratioFilter)  return false;
    if (marketFilter !== "ALL" && c.market !== marketFilter) return false;
    return true;
  });

  const downloadJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const onDownloadReport = () => downloadJSON("report.json", {
    campaign: brief.campaign, brand: brand.slug, counts,
    creatives: all.map((c) => ({
      key: c.key, product: c.product, market: c.market, ratio: c.ratio,
      source: c.source, badge: c.badge, path: c.path,
      stage: c.stage, stageMsg: c.stageMsg,
    })),
  });
  const onDownloadBrief = () => downloadJSON("brief.json", brief);

  return (
    <div className="s3">
      <div className="s3-header">
        <div>
          <h2>Output grid</h2>
          <div className="meta">{brief.campaign} · {brand.slug} · {counts.requested} creatives requested</div>
        </div>
        <div className="grow" />
        <button className="btn" onClick={onDownloadBrief}>⤓ brief.json</button>
        <button className="btn" onClick={onDownloadReport}>⤓ report.json</button>
        <button className="btn btn-primary">⤓ reveal in folder</button>
      </div>

      <div className="summary-cards">
        <div className="summary-card requested"><div className="label">requested</div><div className="num">{counts.requested}</div></div>
        <div className="summary-card succeeded"><div className="label">succeeded</div><div className="num">{counts.succeeded}</div></div>
        <div className="summary-card reused" title="local assets reused from inputs/assets/"><div className="label">reused</div><div className="num">{counts.reused}</div><div className="sub">from inputs/</div></div>
        <div className="summary-card generated"><div className="label">generated</div><div className="num">{counts.generated}</div><div className="sub">via dall-e-3</div></div>
        <div className="summary-card flagged" title={`WARN + FAIL = ${counts.flagged} flagged (D3)`}><div className="label">WARN</div><div className="num">{counts.warn}</div></div>
        <div className="summary-card failed"><div className="label">FAIL</div><div className="num">{counts.failed}</div></div>
      </div>

      <div className="filter-bar">
        <span className="lbl">filter</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">all status</option><option value="OK">OK</option><option value="WARN">warnings</option><option value="FAIL">failed</option>
        </select>
        <select value={ratioFilter} onChange={(e) => setRatioFilter(e.target.value)}>
          <option value="ALL">all ratios</option>{brief.ratios.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
          <option value="ALL">all markets</option>{brief.markets.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="grow" />
        <span className="result-count">{filtered.length} of {all.length}</span>
      </div>

      <div className="grid-cards">
        {filtered.map((c) => <CreativeTile key={c.key} creative={c} brand={brand} uploadedAssets={state.uploadedAssets} onClick={() => dispatch({ type: "open-detail", creative: c })} />)}
      </div>

      <div className="reveal-strip">
        <span style={{ color: "var(--fg-3)" }}>outputDir:</span>
        <span className="path">outputs/{brief.campaign}/[market]/[product]/[ratio].png</span>
      </div>
    </div>
  );
}

// ====================== S4: CREATIVE DETAIL ======================

function S4CreativeDetail({ creative, brand, onClose }) {
  if (!creative) return null;
  const isError = creative.path === null;
  const product = brand.products.find((p) => p.slug === creative.product);
  const stages = ["resolve", "genai", "resize", "compose", "compliance", "write"];
  const failedIdx = isError ? stages.indexOf(creative.stage) : -1;
  const path = creative.path || `outputs/.../${creative.product}/${creative.ratio.replace(":", "x")}.png`;
  const copyPath = () => navigator.clipboard && navigator.clipboard.writeText(path);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-preview">
          <div className="creative" style={isError ? {} : { background: `linear-gradient(135deg, ${product.swatch[0]} 0%, ${product.swatch[1]} 100%)`, color: product.hex }}>
            {isError ? (
              <div className="creative failed" style={{ width: "100%", height: "100%" }}><span className="stage-label">{creative.stage}</span></div>
            ) : (
              <>
                <div className="product-name">{creative.productName}</div>
                <div className="message">{creative.message}</div>
                {creative.subheadline && creative.ratio !== "9:16" && (
                  <div className="sub-message">{creative.subheadline}</div>
                )}
                {creative.cta && <div className="cta-pill" style={{ color: product.hex }}>{creative.cta}</div>}
                <div className="corner-logo" style={{ color: product.hex }}>{brand.displayName.slice(0, 1).toUpperCase()}</div>
              </>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={copyPath}>⧉ copy path</button>
            <button className="btn btn-sm" disabled={isError}>⤓ download</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-head">
            <div>
              <div className="modal-title">{creative.productName}
                <span className={`badge b-${isError ? "bad" : creative.badge === "WARN" ? "warn" : "ok"}-strong`} style={{ marginLeft: 8 }}>
                  {creative.badge}
                </span>
              </div>
              <div className="modal-coords">{creative.market} · lang={creative.language} · {creative.ratio} · source={creative.source}</div>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="meta-grid">
            <div><span className="k">SKU</span><span className="v mono">{creative.product}</span></div>
            <div><span className="k">Generated</span><span className="v">{new Date(creative.generatedAt).toLocaleString()}</span></div>
            <div><span className="k">Market</span><span className="v">{creative.market}</span></div>
            <div><span className="k">Language</span><span className="v">{creative.language}</span></div>
            <div><span className="k">Ratio</span><span className="v">{creative.ratio}</span></div>
            <div><span className="k">Source</span><span className="v">{creative.source}</span></div>
          </div>

          {isError ? (
            <>
              <div className="section-h">Pipeline failure</div>
              <div className="pipeline-stages">
                {stages.map((s, i) => (
                  <React.Fragment key={s}>
                    <span className={`pipe-stage ${i < failedIdx ? "ok" : i === failedIdx ? "fail" : ""}`}>
                      <span className="dot" />{s}
                    </span>
                    {i < stages.length - 1 && <span className="pipe-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="stage-detail">
                <div className="stage-name">stage = {creative.stage}</div>
                <div className="stage-message">{creative.stageMsg}</div>
              </div>
            </>
          ) : (
            <>
              <div className="section-h">Compliance checks</div>
              <div className="check-list">
                {creative.checks.map((ch, i) => (
                  <div key={i} className={`check-row ${ch.status.toLowerCase()}`}>
                    <span className="ico">{ch.status === "OK" ? "✓" : ch.status === "WARN" ? "!" : "✕"}</span>
                    <span className="label">{ch.name}</span>
                    <span className="detail">{ch.message}</span>
                    <span className={`badge b-${ch.status === "OK" ? "ok" : ch.status === "WARN" ? "warn" : "bad"}`}>{ch.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-h">Output path</div>
          <div className="path-row">
            <code>{path}</code>
            <button className="btn btn-sm" onClick={copyPath}>copy</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { S1BriefEditor, S1SummaryStrip, S2RunView, S3OutputGrid, S4CreativeDetail, CastBadge: Badge });
