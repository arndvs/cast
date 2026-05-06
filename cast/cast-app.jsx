/* global React, ReactDOM, CAST, S1BriefEditor, S1SummaryStrip, S2RunView, S3OutputGrid, S4CreativeDetail, CastBadge, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakButton */
const { useState, useReducer, useEffect } = React;
const Badge = window.CastBadge;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  layout: "tabs",
  brand: "brisa",
  scenario: "mixed",
  autoplay: true,
  logRate: 1,
}; /*EDITMODE-END*/

function makeInitialState(tweaks) {
  const brandSlug = tweaks.brand;
  const brand = CAST.BRANDS[brandSlug];
  const brief = JSON.parse(JSON.stringify(CAST.DEFAULT_BRIEF[brandSlug]));
  const creatives = CAST.buildCreatives(brand, brief, tweaks.scenario);
  return {
    brandSlug,
    brand,
    brief,
    creatives,
    counts: CAST.buildCounts(creatives, brief),
    logLines: CAST.buildLogLines(brand, brief, creatives, tweaks.scenario),
    logCursor: 0,
    runState: "editing",
    screen: "S1",
    detailOpen: null,
    uploadedAssets: {},
    logoVariant: "primary-on-light",
  };
}

function rebuild(state, scenario) {
  const creatives = CAST.buildCreatives(state.brand, state.brief, scenario);
  return {
    ...state,
    creatives,
    counts: CAST.buildCounts(creatives, state.brief),
    logLines: CAST.buildLogLines(state.brand, state.brief, creatives, scenario),
    logCursor: 0,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "setBrand": {
      const brand = CAST.BRANDS[action.slug];
      const brief = JSON.parse(JSON.stringify(CAST.DEFAULT_BRIEF[action.slug]));
      const creatives = CAST.buildCreatives(brand, brief, "mixed");
      return {
        ...state,
        brandSlug: action.slug,
        brand,
        brief,
        creatives,
        counts: CAST.buildCounts(creatives, brief),
        logLines: CAST.buildLogLines(brand, brief, creatives, "mixed"),
        logCursor: 0,
        runState: "editing",
        screen: "S1",
      };
    }
    case "setLogo":
      return { ...state, logoVariant: action.id };
    case "upload":
      return {
        ...state,
        uploadedAssets: { ...state.uploadedAssets, [action.slug]: true },
      };
    case "setField":
      return rebuild(
        { ...state, brief: { ...state.brief, [action.field]: action.value } },
        "mixed",
      );
    case "toggleMarket": {
      const has = state.brief.markets.includes(action.code);
      const markets = has
        ? state.brief.markets.filter((m) => m !== action.code)
        : [...state.brief.markets, action.code];
      return rebuild({ ...state, brief: { ...state.brief, markets } }, "mixed");
    }
    case "toggleRatio": {
      const has = state.brief.ratios.includes(action.value);
      const ratios = has
        ? state.brief.ratios.filter((r) => r !== action.value)
        : [...state.brief.ratios, action.value];
      return rebuild({ ...state, brief: { ...state.brief, ratios } }, "mixed");
    }
    case "addProduct": {
      if (state.brief.products.some((p) => p.sku === action.sku)) return state;
      return rebuild(
        {
          ...state,
          brief: {
            ...state.brief,
            products: [...state.brief.products, { sku: action.sku }],
          },
        },
        "mixed",
      );
    }
    case "removeProduct": {
      return rebuild(
        {
          ...state,
          brief: {
            ...state.brief,
            products: state.brief.products.filter((p) => p.sku !== action.sku),
          },
        },
        "mixed",
      );
    }
    case "generate":
      return { ...state, runState: "running", screen: "S2", logCursor: 0 };
    case "tickLog": {
      if (state.runState !== "running") return state;
      const next = state.logCursor + 1;
      if (next >= state.logLines.length)
        return {
          ...state,
          logCursor: state.logLines.length,
          runState: "complete",
        };
      return { ...state, logCursor: next };
    }
    case "view-grid":
      return { ...state, screen: "S3" };
    case "back":
      return { ...state, screen: "S1", runState: "editing", logCursor: 0 };
    case "open-detail":
      return { ...state, detailOpen: action.creative };
    case "close-detail":
      return { ...state, detailOpen: null };
    case "set-screen":
      return { ...state, screen: action.screen };
    case "regen": {
      const brand = CAST.BRANDS[action.brandSlug];
      const brief = JSON.parse(
        JSON.stringify(CAST.DEFAULT_BRIEF[action.brandSlug]),
      );
      const creatives = CAST.buildCreatives(brand, brief, action.scenario);
      return {
        ...state,
        brandSlug: action.brandSlug,
        brand,
        brief,
        creatives,
        counts: CAST.buildCounts(creatives, brief),
        logLines: CAST.buildLogLines(brand, brief, creatives, action.scenario),
        logCursor: 0,
        runState: "editing",
        screen: "S1",
        detailOpen: null,
      };
    }
    default:
      return state;
  }
}

// ====================== LAYOUTS ======================

function Tabs({ screen, runState, dispatch, counts }) {
  const tabs = [
    { id: "S1", label: "Brief" },
    {
      id: "S2",
      label: "Run",
      indicator:
        runState === "running"
          ? "dot"
          : runState === "complete"
            ? "ok"
            : runState === "failed"
              ? "bad"
              : null,
    },
    {
      id: "S3",
      label: "Outputs",
      count: runState === "complete" ? counts.requested : null,
    },
  ];
  return (
    <div className="tabs-row">
      {tabs.map((t) => {
        const disabled =
          (t.id === "S3" && runState !== "complete") ||
          (t.id === "S2" && runState === "editing");
        return (
          <button
            key={t.id}
            className={`tab ${screen === t.id ? "on" : ""}`}
            disabled={disabled}
            onClick={() => dispatch({ type: "set-screen", screen: t.id })}
          >
            {t.label}
            {t.indicator === "dot" && <span className="tab-dot running" />}
            {t.indicator === "ok" && <span className="tab-dot ok" />}
            {t.indicator === "bad" && <span className="tab-dot bad" />}
            {t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TabsLayout({ state, dispatch, jsonMode, setJsonMode }) {
  return (
    <>
      <Tabs
        screen={state.screen}
        runState={state.runState}
        dispatch={dispatch}
        counts={state.counts}
      />
      <div className="stage stage-tabs">
        {state.screen === "S1" && (
          <>
            <div className="screen">
              <S1BriefEditor
                state={state}
                dispatch={dispatch}
                jsonMode={jsonMode}
                onJsonToggle={setJsonMode}
              />
            </div>
            <S1SummaryStrip
              state={state}
              dispatch={dispatch}
              running={state.runState === "running"}
            />
          </>
        )}
        {state.screen === "S2" && (
          <div className="screen">
            <S2RunView state={state} dispatch={dispatch} />
          </div>
        )}
        {state.screen === "S3" && (
          <div className="screen">
            <S3OutputGrid state={state} dispatch={dispatch} />
          </div>
        )}
      </div>
    </>
  );
}

function SplitLayout({ state, dispatch, jsonMode, setJsonMode }) {
  return (
    <div className="stage stage-split">
      <div className="screen-left">
        <S1BriefEditor
          state={state}
          dispatch={dispatch}
          jsonMode={jsonMode}
          onJsonToggle={setJsonMode}
        />
        <S1SummaryStrip
          state={state}
          dispatch={dispatch}
          running={state.runState === "running"}
        />
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

function StackedLayout({ state, dispatch, jsonMode, setJsonMode }) {
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
          <S1BriefEditor
            state={state}
            dispatch={dispatch}
            jsonMode={jsonMode}
            onJsonToggle={setJsonMode}
          />
          <S1SummaryStrip
            state={state}
            dispatch={dispatch}
            running={state.runState === "running"}
          />
        </div>
      </div>
      {state.runState !== "editing" && (
        <div className={`stack-card ${collapsed.S2 ? "collapsed" : ""}`}>
          <div className="stack-card-head" onClick={() => toggle("S2")}>
            <span className="step-id">S2</span> Pipeline run
            {state.runState === "running" && (
              <Badge kind="info">● running</Badge>
            )}
            {state.runState === "complete" && (
              <Badge kind="ok">✓ complete</Badge>
            )}
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
            <Badge kind="ok">
              {state.counts.succeeded} / {state.counts.requested} succeeded
            </Badge>
            {state.counts.warn > 0 && (
              <Badge kind="warn">{state.counts.warn} flagged</Badge>
            )}
            {state.counts.failed > 0 && (
              <Badge kind="bad">{state.counts.failed} failed</Badge>
            )}
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

// ====================== APP ======================

function CastApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, dispatch] = useReducer(reducer, tweaks, makeInitialState);
  const [jsonMode, setJsonMode] = useState(false);

  useEffect(() => {
    if (state.brandSlug !== tweaks.brand)
      dispatch({
        type: "regen",
        brandSlug: tweaks.brand,
        scenario: tweaks.scenario,
      });
  }, [tweaks.brand]);

  useEffect(() => {
    if (state.runState !== "running") return;
    const interval = Math.max(40, 280 / tweaks.logRate);
    const id = setInterval(() => dispatch({ type: "tickLog" }), interval);
    return () => clearInterval(id);
  }, [state.runState, tweaks.logRate]);

  useEffect(() => {
    if (
      state.runState === "complete" &&
      tweaks.autoplay &&
      state.screen === "S2" &&
      tweaks.layout === "tabs"
    ) {
      const t = setTimeout(() => dispatch({ type: "view-grid" }), 700);
      return () => clearTimeout(t);
    }
  }, [state.runState, state.screen, tweaks.autoplay, tweaks.layout]);

  const Layout =
    tweaks.layout === "split"
      ? SplitLayout
      : tweaks.layout === "stacked"
        ? StackedLayout
        : TabsLayout;

  return (
    <>
      <div className="topbar">
        <span className="brand-mark">Cast</span>
        <span className="crumb-text">Creative Automation Studio Toolchain</span>
        <div className="topbar-spacer" />
        <span className="crumb-text">
          {state.brand.displayName} · {state.brief.name}
        </span>
        <Badge kind="mute">v1 · POC</Badge>
      </div>

      <Layout
        state={state}
        dispatch={dispatch}
        jsonMode={jsonMode}
        setJsonMode={setJsonMode}
      />

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
            options={["tabs", "split", "stacked"]}
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
            onChange={(v) => {
              setTweak("scenario", v);
              dispatch({ type: "regen", brandSlug: tweaks.brand, scenario: v });
            }}
            options={["all-clean", "mixed", "stress"]}
          />
        </TweakSection>
        <TweakSection label="Playback">
          <TweakToggle
            label="Auto-advance to grid"
            value={tweaks.autoplay}
            onChange={(v) => setTweak("autoplay", v)}
          />
          <TweakRadio
            label="Log rate"
            value={String(tweaks.logRate)}
            onChange={(v) => setTweak("logRate", Number(v))}
            options={["0.5", "1", "3"]}
          />
        </TweakSection>
        <TweakSection label="Actions">
          <TweakButton
            label="Reset run"
            onClick={() =>
              dispatch({
                type: "regen",
                brandSlug: tweaks.brand,
                scenario: tweaks.scenario,
              })
            }
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<CastApp />);
