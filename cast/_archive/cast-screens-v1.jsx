/* global React, CAST */
const { useState, useMemo, useEffect, useRef } = React;

// ====================== SHARED PRIMITIVES ======================

function Badge({ kind, children }) {
  return <span className={`badge b-${kind}`}>{children}</span>;
}

function syntaxHighlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
    let cls = "n";
    if (/^"/.test(m)) cls = /:$/.test(m) ? "k" : "s";
    else if (/true|false|null/.test(m)) cls = "p";
    return `<span class="${cls}">${m}</span>`;
  });
}

// ====================== S1: BRIEF EDITOR ======================

function S1BriefEditor({ state, dispatch, compact }) {
  const { brand, brief, brandSlug, uploadedAssets, logoVariant } = state;
  const onProductDrop = (slug) => dispatch({ type: "upload", slug });

  return (
    <div className="s1">
      <div className="s1-sidebar">
        <div className="section-h">Brand</div>
        <div className="brand-list">
          {Object.values(CAST.BRANDS).map((b) => (
            <div
              key={b.slug}
              className={`brand-card ${brandSlug === b.slug ? "active" : ""}`}
              onClick={() => dispatch({ type: "setBrand", slug: b.slug })}
            >
              <div className="brand-swatches">
                <div style={{ background: b.colors.bg1 }} />
                <div style={{ background: b.colors.accent }} />
                <div style={{ background: b.colors.primary }} />
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
        <div className="section-h">Logo variant</div>
        <div className="logo-grid">
          {["primary-on-light", "primary-on-dark", "mono-white", "mono-black"].map((id) => {
            const isLight = id.includes("light") || id === "mono-black";
            return (
              <div
                key={id}
                className={`logo-opt ${logoVariant === id ? "on" : ""}`}
                onClick={() => dispatch({ type: "setLogo", id })}
              >
                <div
                  className="swatch"
                  style={{
                    background: isLight ? "white" : "#222",
                    color: isLight ? brand.colors.primary : "white",
                    backgroundImage: "none",
                  }}
                >
                  {brand.displayName.slice(0, 1)}
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.3 }}>{id.replace(/-/g, " ")}</div>
              </div>
            );
          })}
        </div>

        <div className="section-spacer" />
        <div className="section-h">Detected assets</div>
        {brand.products.map((p, i) => {
          const has = uploadedAssets[p.slug] || (i !== 0); // pi 0 = missing by default
          return (
            <div key={p.slug} className={`detected-row ${has ? "found" : "missing"}`}>
              <span className="ico">{has ? "✓" : "→"}</span>
              <span style={{ flex: 1 }}>
                {has ? `${p.slug}.png` : `${p.slug} — will generate`}
              </span>
            </div>
          );
        })}

        <div className="section-spacer" />
        <div className="section-h">GenAI mode</div>
        <Badge kind="info-soft">dall-e-3 · 3 native sizes</Badge>
      </div>

      <div className="s1-main">
        <div className="section-h">Campaign brief · JSON</div>
        <div
          className="json-editor"
          style={{ minHeight: 280, marginBottom: 14 }}
          dangerouslySetInnerHTML={{ __html: syntaxHighlightJSON(brief) }}
        />

        <div className="section-h">Products & assets</div>
        {brand.products.map((p, i) => {
          const has = uploadedAssets[p.slug] || (i !== 0);
          return (
            <div className="product-row" key={p.slug}>
              <div>
                <div className="name">{p.name}</div>
                <div className="sku">{p.sku}</div>
                <div className="slug">slug: {p.slug}</div>
              </div>
              <div
                className={`dropzone ${has ? "has-file" : ""}`}
                onClick={() => !has && onProductDrop(p.slug)}
              >
                {has ? `${p.slug}.png` : "drop photo"}
              </div>
            </div>
          );
        })}

        {!compact && (
          <>
            <div className="section-spacer" />
            <div className="section-h">Markets</div>
            <div className="market-chips">
              {brief.markets.map((m) => (
                <span key={m} className="market-chip">
                  {m}
                  <button>×</button>
                </span>
              ))}
              <input className="market-input" placeholder="add market…" />
            </div>

            <div className="section-spacer" />
            <div className="section-h">Ratios</div>
            <div className="ratio-pills">
              {["1x1", "9x16", "16x9"].map((r) => (
                <span key={r} className={`ratio-pill ${brief.ratios.includes(r) ? "on" : ""}`}>{r}</span>
              ))}
            </div>

            <div className="section-spacer" />
            <div className="section-h">Prompt preview · brisa-citrus</div>
            <div className="prompt-preview">
              <div className="label">Assembled prompt (read-only)</div>
              {brand.voice.join(", ")}, product photography of {brand.products[0].name}, {brief.audience}, hero shot, marketing-grade.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function S1SummaryStrip({ state, dispatch, running }) {
  const { brief, brand } = state;
  const total = brief.products.length * brief.markets.length * brief.ratios.length;
  return (
    <div className="summary-strip">
      <div className="calc">
        <strong>{brief.products.length}</strong> products ·{" "}
        <strong>{brief.markets.length}</strong> markets ·{" "}
        <strong>{brief.ratios.length}</strong> ratios = <strong>{total}</strong> creatives
      </div>
      <div className="grow" />
      <button
        className="btn btn-primary"
        disabled={running}
        onClick={() => dispatch({ type: "generate" })}
      >
        ▶ Generate
      </button>
    </div>
  );
}

// ====================== S2: RUN VIEW ======================

function S2RunView({ state, dispatch }) {
  const { runState, logLines, logCursor, brief } = state;
  const total = brief.products.length * brief.markets.length * brief.ratios.length;
  const completed = logLines
    .slice(0, logCursor)
    .filter((l) => l.kind === "compliance" || l.kind === "error").length;
  const pct = total === 0 ? 0 : Math.min(100, (completed / total) * 100);
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logCursor]);

  const visible = logLines.slice(0, logCursor);

  return (
    <div className="s2">
      <div className="run-header">
        <h2>Pipeline</h2>
        <span className="meta">{brief.campaign} · {state.brand.slug}</span>
        <div style={{ flex: 1 }} />
        {runState === "running" && <Badge kind="info">● running</Badge>}
        {runState === "complete" && <Badge kind="ok">✓ complete</Badge>}
        {runState === "failed" && <Badge kind="bad">✕ failed</Badge>}
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

      <div className="progress-bar-row">
        <div className="progress-bar">
          <div className={`progress-fill ${runState === "complete" ? "done" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-text">{completed} / {total} creatives</span>
      </div>

      <div className="log" ref={logRef}>
        {visible.map((l, i) => (
          <div key={i} className={`log-line ${l.kind} ${l.subkind || ""}`}>
            <span className="log-time">{l.time}</span>
            <span className="log-tag">{l.tag}</span>
            <span className="log-msg">{l.msg}</span>
          </div>
        ))}
        {runState === "running" && <span className="log-cursor" />}
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

function CreativeTile({ creative, brand, ratio, onClick }) {
  const product = brand.products.find((p) => p.slug === creative.product);
  const ratioClass = ratio === "9x16" ? "creative-9-16" : ratio === "16x9" ? "creative-16-9" : "";
  const isFailed = creative.path === null;
  const klass = isFailed ? "failed" : creative.badge === "WARN" ? "warn" : creative.badge === "FAIL" ? "warn" : "";

  return (
    <div className={`ratio-tile ${klass}`} onClick={onClick}>
      <div
        className={`creative ${ratioClass} ${isFailed ? "failed" : ""}`}
        style={
          isFailed
            ? {}
            : {
                background: `linear-gradient(135deg, ${product.swatch[0]} 0%, ${product.swatch[1]} 100%)`,
                color: product.hex,
              }
        }
      >
        {isFailed ? (
          <>
            <span className="stage-label">{creative.stage}</span>
            <div className="stage-msg">{creative.stageMsg.slice(0, 50)}…</div>
          </>
        ) : (
          <>
            <div className="product-name">{creative.productName}</div>
            <div className="message">{creative.message}</div>
            <div className="corner-logo" style={{ color: product.hex }}>
              {brand.displayName.slice(0, 1).toUpperCase()}
            </div>
          </>
        )}
      </div>
      <div className="ratio-foot">
        <span className="ratio-name">{ratio.replace("x", ":")}</span>
        <span className="grow" />
        {isFailed ? (
          <Badge kind="bad-strong">FAIL</Badge>
        ) : creative.badge === "OK" ? (
          <Badge kind="ok-strong">OK</Badge>
        ) : creative.badge === "WARN" ? (
          <Badge kind="warn-strong">WARN</Badge>
        ) : (
          <Badge kind="bad-strong">FAIL</Badge>
        )}
      </div>
    </div>
  );
}

function S3OutputGrid({ state, dispatch }) {
  const { creatives, counts, brief, brand } = state;
  const [activeMarket, setActiveMarket] = useState(brief.markets[0]);

  return (
    <div className="s3">
      <div className="s3-header">
        <h2>Output grid</h2>
        <span className="meta" style={{ color: "var(--fg-3)", fontSize: 12, fontFamily: "var(--mono)" }}>
          {brief.campaign} · {brand.slug}
        </span>
        <div className="grow" />
        <button className="btn" onClick={() => dispatch({ type: "back" })}>edit brief</button>
        <button className="btn btn-primary">⤓ reveal folder</button>
      </div>

      <div className="summary-cards">
        <div className="summary-card requested"><div className="label">requested</div><div className="num">{counts.requested}</div></div>
        <div className="summary-card succeeded"><div className="label">succeeded</div><div className="num">{counts.succeeded}</div></div>
        <div className="summary-card generated"><div className="label">generated</div><div className="num">{counts.generated}</div></div>
        <div className="summary-card flagged"><div className="label">flagged</div><div className="num">{counts.flagged}</div></div>
        <div className="summary-card failed"><div className="label">failed</div><div className="num">{counts.failed}</div></div>
      </div>

      <div className="market-tabs-row">
        {brief.markets.map((m) => {
          const arrs = Object.values(creatives[m] || {}).flat();
          const flagged = arrs.filter((c) => c.badge !== "OK" || c.path === null).length;
          return (
            <div key={m} className={`market-tab ${activeMarket === m ? "active" : ""}`} onClick={() => setActiveMarket(m)}>
              {m}
              {flagged > 0 && <span className="count">· {flagged} flagged</span>}
            </div>
          );
        })}
      </div>

      {brand.products.map((p) => {
        const arr = (creatives[activeMarket] || {})[p.slug] || [];
        const sourceArr = arr[0]?.source;
        return (
          <div className="product-row-grid" key={p.slug}>
            <div className="product-row-head">
              <span className="name">{p.name}</span>
              {arr.some((c) => c.path === null) ? (
                <Badge kind="bad">{arr.filter((c) => c.path === null).length} failed</Badge>
              ) : arr.some((c) => c.badge !== "OK") ? (
                <Badge kind="warn">{arr.filter((c) => c.badge !== "OK").length} flagged</Badge>
              ) : (
                <Badge kind="ok">all pass</Badge>
              )}
              <span className="source">
                {sourceArr === "genai" ? "generated via dall-e-3" : "asset reused — " + p.slug + ".png"}
              </span>
            </div>
            <div className="ratio-grid">
              {arr.map((c) => (
                <CreativeTile
                  key={c.key}
                  creative={c}
                  brand={brand}
                  ratio={c.ratio}
                  onClick={() => dispatch({ type: "open-detail", creative: c })}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="reveal-strip">
        <span style={{ color: "var(--fg-3)" }}>outputDir:</span>
        <span className="path">/Users/aaron/cast/outputs/{brief.campaign}</span>
        <button className="btn btn-sm">copy</button>
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-preview">
          <div
            className="creative"
            style={
              isError
                ? {}
                : {
                    background: `linear-gradient(135deg, ${product.swatch[0]} 0%, ${product.swatch[1]} 100%)`,
                    color: product.hex,
                  }
            }
          >
            {isError ? (
              <div className="creative failed" style={{ width: "100%", height: "100%" }}>
                <span className="stage-label">{creative.stage}</span>
              </div>
            ) : (
              <>
                <div className="product-name">{creative.productName}</div>
                <div className="message">{creative.message}</div>
                <div className="corner-logo" style={{ color: product.hex }}>
                  {brand.displayName.slice(0, 1).toUpperCase()}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-head">
            <div>
              <div className="modal-title">{creative.productName}</div>
              <div className="modal-coords">
                {creative.market} · {creative.ratio.replace("x", ":")} · source={creative.source}
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          {isError ? (
            <>
              <div className="section-h">Pipeline failure</div>
              <div className="pipeline-stages">
                {stages.map((s, i) => (
                  <React.Fragment key={s}>
                    <span className={`pipe-stage ${i < failedIdx ? "ok" : i === failedIdx ? "fail" : ""}`}>
                      <span className="dot" />
                      {s}
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
              <div className="section-h">Compliance · {creative.badge}</div>
              <div className="check-list">
                <div className={`check-row ${creative.checks.logoPresent ? "ok" : "fail"}`}>
                  <span className="ico">{creative.checks.logoPresent ? "✓" : "✕"}</span>
                  <span className="label">Logo present</span>
                  <span className="detail">bottom-right corner</span>
                </div>
                <div className={`check-row ${creative.checks.colorsOk ? "ok" : "warn"}`}>
                  <span className="ico">{creative.checks.colorsOk ? "✓" : "!"}</span>
                  <span className="label">Brand colors</span>
                  <span className="detail">{creative.checks.colorsOk ? "match palette" : "low contrast — headline on light bg"}</span>
                </div>
                <div className={`check-row ${creative.checks.bannedWords.length === 0 ? "ok" : "fail"}`}>
                  <span className="ico">{creative.checks.bannedWords.length === 0 ? "✓" : "✕"}</span>
                  <span className="label">Banned words</span>
                  <span className="detail">
                    {creative.checks.bannedWords.length === 0 ? "none flagged" : creative.checks.bannedWords.join(", ")}
                  </span>
                </div>
              </div>
              <div className="section-h" style={{ marginTop: 8 }}>Output path</div>
              <div className="prompt-preview" style={{ fontSize: 11 }}>{creative.path}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { S1BriefEditor, S1SummaryStrip, S2RunView, S3OutputGrid, S4CreativeDetail, CastBadge: Badge });
