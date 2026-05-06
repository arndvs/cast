/* global React, ReactDOM, CAST, S1BriefEditor, S1SummaryStrip, S2RunView, S3OutputGrid, S4CreativeDetail, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakButton, CastBadge */
const { useState, useReducer, useMemo, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "linear",
  "brand": "brisa",
  "scenario": "mixed",
  "autoplay": true,
  "logRate": 1
}/*EDITMODE-END*/;

function makeInitialState(tweaks) {
  const brandSlug = tweaks.brand;
  const brand = CAST.BRANDS[brandSlug];
  const brief = CAST.DEFAULT_BRIEF[brandSlug];
  const creatives = CAST.buildCreatives(brand, brief, tweaks.scenario);
  const counts = CAST.buildCounts(creatives, brief);
  const logLines = CAST.buildLogLines(brand, brief, creatives, tweaks.scenario);
  return {
    brandSlug,
    brand,
    brief,
    creatives,
    counts,
    logLines,
    logCursor: 0,
    runState: "editing", // editing | running | complete | failed
    screen: "S1", // S1 | S2 | S3
    detailOpen: null,
    uploadedAssets: {},
    logoVariant: "primary-on-light",
    failTrigger: tweaks.scenario === "fail-stream",
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "setBrand": {
      const brand = CAST.BRANDS[action.slug];
      const brief = CAST.DEFAULT_BRIEF[action.slug];
      const creatives = CAST.buildCreatives(brand, brief, "mixed");
      return { ...state, brandSlug: action.slug, brand, brief, creatives, counts: CAST.buildCounts(creatives, brief), logLines: CAST.buildLogLines(brand, brief, creatives, "mixed"), logCursor: 0, runState: "editing", screen: "S1" };
    }
    case "setLogo": return { ...state, logoVariant: action.id };
    case "upload": return { ...state, uploadedAssets: { ...state.uploadedAssets, [action.slug]: true } };
    case "generate": return { ...state, runState: "running", screen: "S2", logCursor: 0 };
    case "tickLog": {
      if (state.runState !== "running") return state;
      const next = state.logCursor + 1;
      if (next >= state.logLines.length) {
        return { ...state, logCursor: state.logLines.length, runState: "complete" };
      }
      return { ...state, logCursor: next };
    }
    case "view-grid": return { ...state, screen: "S3" };
    case "back": return { ...state, screen: "S1", runState: "editing", logCursor: 0 };
    case "open-detail": return { ...state, detailOpen: action.creative };
    case "close-detail": return { ...state, detailOpen: null };
    case "set-screen": return { ...state, screen: action.screen };
    case "fail": return { ...state, runState: "failed" };
    case "regen": {
      const brand = CAST.BRANDS[action.brandSlug];
      const brief = CAST.DEFAULT_BRIEF[action.brandSlug];
      const creatives = CAST.buildCreatives(brand, brief, action.scenario);
      const counts = CAST.buildCounts(creatives, brief);
      const logLines = CAST.buildLogLines(brand, brief, creatives, action.scenario);
      return { ...state, brandSlug: action.brandSlug, brand, brief, creatives, counts, logLines, logCursor: 0, runState: "editing", screen: "S1", detailOpen: null };
    }
    default: return state;
  }
}

// ====================== STAGE LAYOUTS ======================

function Stepper({ screen, runState, dispatch }) {
  const steps = [
    { id: "S1", num: 1, label: "Brief" },
    { id: "S2", num: 2, label: runState === "failed" ? "Failed" : runState === "running" ? "Running" : "Run" },
    { id: "S3", num: 3, label: "Output" },
  ];
  const idx = steps.findIndex((s) => s.id === screen);
  return (
    <div className="stage-stepper">
      {steps.map((s, i) => {
        const klass = s.id === screen ? "active" : i < idx ? "done" : i > idx + 1 ? "disabled" : "";
        return (
          <React.Fragment key={s.id}>
            <span
              className={`step ${klass}`}
              onClick={() => i <= idx + 1 && dispatch({ type: "set-screen", screen: s.id })}
            >
              <span className="step-num">{i < idx ? "✓" : s.num}</span>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="step-arrow">›</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LinearLayout({ state, dispatch }) {
  return (
    <>
      <Stepper screen={state.screen} runState={state.runState} dispatch={dispatch} />
      <div className="stage stage-linear">
        {state.screen === "S1" && (
          <>
            <div className="screen"><S1BriefEditor state={state} dispatch={dispatch} /></div>
            <S1SummaryStrip state={state} dispatch={dispatch} running={state.runState === "running"} />
          </>
        )}
        {state.screen === "S2" && <div className="screen"><S2RunView state={state} dispatch={dispatch} /></div>}
        {state.screen === "S3" && <div className="screen"><S3OutputGrid state={state} dispatch={dispatch} /></div>}
      </div>
    </>
  );
}

function SplitLayout({ state, dispatch }) {
  return (
    <div className="stage stage-split">
      <div className="screen-left">
        <S1BriefEditor state={state} dispatch={dispatch} compact />
        <S1SummaryStrip state={state} dispatch={dispatch} running={state.runState === "running"} />
      </div>
      <div className="screen-right">
        {state.runState === "editing" ? (
          <div className="empty">→ click Generate to run the pipeline</div>
        ) : state.screen === "S3" ? (
          <S3OutputGrid state={state} dispatch={dispatch} />
        ) : (
          <S2RunView state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

function StackedLayout({ state, dispatch }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  return (
    <div className="stage stage-stacked">
      <div className={`stack-card ${collapsed.S1 ? "collapsed" : ""}`}>
        <div className="stack-card-head" onClick={() => toggle("S1")}>
          <span className="step-id">S1</span> Brief editor
          <Badge kind={state.runState === "editing" ? "info" : "mute"}>
            {state.runState === "editing" ? "active" : "locked"}
          </Badge>
          <span className="chev">▾</span>
        </div>
        <div className="stack-card-body" style={{ padding: 0 }}>
          <S1BriefEditor state={state} dispatch={dispatch} compact />
          <S1SummaryStrip state={state} dispatch={dispatch} running={state.runState === "running"} />
        </div>
      </div>

      {state.runState !== "editing" && (
        <div className={`stack-card ${collapsed.S2 ? "collapsed" : ""}`}>
          <div className="stack-card-head" onClick={() => toggle("S2")}>
            <span className="step-id">S2</span> Pipeline run
            {state.runState === "running" && <Badge kind="info">● running</Badge>}
            {state.runState === "complete" && <Badge kind="ok">✓ complete</Badge>}
            {state.runState === "failed" && <Badge kind="bad">✕ failed</Badge>}
            <span className="chev">▾</span>
          </div>
          <div className="stack-card-body" style={{ padding: 0 }}>
            <S2RunView state={state} dispatch={dispatch} />
          </div>
        </div>
      )}

      {state.runState === "complete" && (
        <div className={`stack-card ${collapsed.S3 ? "collapsed" : ""}`}>
          <div className="stack-card-head" onClick={() => toggle("S3")}>
            <span className="step-id">S3</span> Output grid
            <Badge kind="ok">{state.counts.succeeded} / {state.counts.requested} succeeded</Badge>
            {state.counts.flagged > 0 && <Badge kind="warn">{state.counts.flagged} flagged</Badge>}
            {state.counts.failed > 0 && <Badge kind="bad">{state.counts.failed} failed</Badge>}
            <span className="chev">▾</span>
          </div>
          <div className="stack-card-body" style={{ padding: 0 }}>
            <S3OutputGrid state={state} dispatch={dispatch} />
          </div>
        </div>
      )}
    </div>
  );
}

const Badge = window.CastBadge;

// ====================== APP SHELL ======================

function CastApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, dispatch] = useReducer(reducer, tweaks, makeInitialState);

  // Sync brand/scenario tweak changes
  useEffect(() => {
    if (state.brandSlug !== tweaks.brand || state._scenario !== tweaks.scenario) {
      dispatch({ type: "regen", brandSlug: tweaks.brand, scenario: tweaks.scenario });
    }
  }, [tweaks.brand, tweaks.scenario]);

  // Auto-stream the log when running
  useEffect(() => {
    if (state.runState !== "running") return;
    const interval = Math.max(40, 280 / tweaks.logRate);
    // Stream log lines
    const id = setInterval(() => {
      dispatch({ type: "tickLog" });
    }, interval);
    return () => clearInterval(id);
  }, [state.runState, tweaks.logRate]);

  // Autoplay: when complete and autoplay on, advance to grid
  useEffect(() => {
    if (state.runState === "complete" && tweaks.autoplay && state.screen === "S2" && tweaks.layout === "linear") {
      const t = setTimeout(() => dispatch({ type: "view-grid" }), 700);
      return () => clearTimeout(t);
    }
  }, [state.runState, state.screen, tweaks.autoplay, tweaks.layout]);

  const Layout =
    tweaks.layout === "split" ? SplitLayout :
    tweaks.layout === "stacked" ? StackedLayout :
    LinearLayout;

  return (
    <>
      <div className="topbar">
        <span className="brand-mark">Cast</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-text">Onda Beverages</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-text">{state.brand.displayName} · {state.brief.campaign}</span>
        <div className="topbar-spacer" />
        <Badge kind="mute">v1 · POC</Badge>
      </div>

      <Layout state={state} dispatch={dispatch} />

      {state.detailOpen && (
        <S4CreativeDetail
          creative={state.detailOpen}
          brand={state.brand}
          onClose={() => dispatch({ type: "close-detail" })}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio
            label="Mode"
            value={tweaks.layout}
            onChange={(v) => setTweak("layout", v)}
            options={["linear", "split", "stacked"]}
          />
        </TweakSection>
        <TweakSection label="Brand">
          <TweakRadio
            label="Brand"
            value={tweaks.brand}
            onChange={(v) => setTweak("brand", v)}
            options={["brisa", "volt"]}
          />
        </TweakSection>
        <TweakSection label="Run scenario">
          <TweakSelect
            label="Scenario"
            value={tweaks.scenario}
            onChange={(v) => setTweak("scenario", v)}
            options={["all-clean", "mixed", "stress"]}
          />
        </TweakSection>
        <TweakSection label="Playback">
          <TweakToggle label="Auto-advance to grid" value={tweaks.autoplay} onChange={(v) => setTweak("autoplay", v)} />
          <TweakRadio
            label="Log rate"
            value={String(tweaks.logRate)}
            onChange={(v) => setTweak("logRate", Number(v))}
            options={["0.5", "1", "3"]}
          />
        </TweakSection>
        <TweakSection label="Actions">
          <TweakButton label="Reset run" onClick={() => dispatch({ type: "regen", brandSlug: tweaks.brand, scenario: tweaks.scenario })} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<CastApp />);
