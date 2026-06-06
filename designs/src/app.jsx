// Tattoo Trap — app shell: flow state machine + tweaks.
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "atelier",
  "accent": "#1a1714",
  "matchStyle": "percent",
  "density": "comfortable"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useStateApp("home"); // home | metro | searching | results | detail
  const [refImg, setRefImg] = useStateApp(null);
  const [metro, setMetro] = useStateApp(null);
  const [artist, setArtist] = useStateApp(null);

  // apply theme whenever direction or accent changes
  useEffectApp(() => { window.applyTheme(t.direction, t.accent); }, [t.direction, t.accent]);

  // keep accent sensible: when switching to salon, default its clay accent unless user picked one
  useEffectApp(() => { window.scrollTo(0, 0); }, [screen, artist]);

  function reset() { setScreen("home"); setRefImg(null); setMetro(null); setArtist(null); }

  let view;
  if (screen === "home") {
    view = <Home onUpload={(img) => { setRefImg(img); setScreen("metro"); }}
              onBrowse={() => { setRefImg(null); setScreen("metro"); }} />;
  } else if (screen === "metro") {
    view = <MetroPick refImg={refImg} onHome={reset}
              onReupload={() => setScreen("home")}
              onPick={(m) => { setMetro(m); setScreen("searching"); }} />;
  } else if (screen === "searching") {
    view = <Searching refImg={refImg} metro={metro} onDone={() => setScreen("results")} />;
  } else if (screen === "results") {
    view = <Results refImg={refImg} metro={metro} matchStyle={t.matchStyle} density={t.density}
              onHome={reset} onReupload={() => setScreen("home")}
              onChangeMetro={() => setScreen("metro")}
              onArtist={(s) => { setArtist(s); setScreen("detail"); }} />;
  } else if (screen === "detail") {
    view = <ArtistDetail slug={artist} refImg={refImg} matchStyle={t.matchStyle}
              onHome={reset} onBack={() => setScreen("results")}
              onArtist={(s) => { setArtist(s); setScreen("detail"); }} />;
  }

  return (
    <React.Fragment>
      {view}
      <TweaksPanel>
        <TweakSection label="Visual direction" />
        <TweakRadio label="Direction" value={t.direction}
          options={["atelier", "index", "salon"]}
          onChange={(v) => setTweak("direction", v)} />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.45, padding: "2px 2px 4px" }}>
          {window.THEMES[t.direction].note}
        </div>
        <TweakColor label="Accent" value={t.accent}
          options={window.ACCENTS}
          onChange={(v) => setTweak("accent", v)} />

        <TweakSection label="Results display" />
        <TweakRadio label="Match" value={t.matchStyle}
          options={["percent", "decimal", "rank"]}
          onChange={(v) => setTweak("matchStyle", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
