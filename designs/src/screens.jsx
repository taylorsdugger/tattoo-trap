// Tattoo Trap — screens + shared atoms. Loaded after data/theme/plates.
const { useState, useEffect, useRef } = React;

/* ----------------------------------------------------------------- atoms */

function Label({ children, style = {} }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 500,
      letterSpacing: "var(--label-tracking)", textTransform: "uppercase",
      color: "var(--ink-faint)", ...style
    }}>{children}</span>);

}

function StyleTags({ styles, max = 99 }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {styles.slice(0, max).map((s) =>
      <span key={s} style={{
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.01em",
        color: "var(--ink-soft)", padding: "3px 9px",
        border: "1px solid var(--line)", borderRadius: 999, whiteSpace: "nowrap"
      }}>{s}</span>
      )}
    </div>);

}

// match display respects the matchStyle tweak
function Match({ value, rank, kind }) {
  const pct = Math.round(value * 100);
  if (kind === "rank") {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <Label>match</Label>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontSize: 20, color: "var(--ink)" }}>
          #{rank}
        </span>
      </div>);

  }
  if (kind === "decimal") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Meter v={value} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
          {value.toFixed(2)}
        </span>
      </div>);

  }
  // percent (default)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <Meter v={value} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
        {pct}<span style={{ color: "var(--ink-faint)" }}>%</span>
      </span>
    </div>);

}

function Meter({ v }) {
  return (
    <div style={{ width: 54, height: 4, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${v * 100}%`, height: "100%", background: "var(--accent)" }} />
    </div>);

}

function Btn({ children, onClick, primary, style = {} }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "11px 20px", cursor: "pointer", borderRadius: "var(--radius)", whiteSpace: "nowrap",
      border: primary ? "1px solid var(--ink)" : "1px solid var(--line-strong)",
      background: primary ? "var(--ink)" : "transparent",
      color: primary ? "var(--paper)" : "var(--ink)",
      transition: "all .18s ease", ...style
    }}
    onMouseEnter={(e) => {if (!primary) e.currentTarget.style.borderColor = "var(--ink)";}}
    onMouseLeave={(e) => {if (!primary) e.currentTarget.style.borderColor = "var(--line-strong)";}}>
      {children}</button>);

}

function Wordmark({ size = 17, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)", fontSize: size, letterSpacing: "var(--display-tracking)", color: "var(--ink)" }}>
        Tattoo Trap
      </span>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)", transform: "translateY(-2px)" }} />
    </div>);

}

function metroName(slug) {if (slug === "all") return "All metros";const m = window.METROS.find((x) => x.slug === slug);return m ? m.name : slug;}
function artistsIn(slug) {const base = slug === "all" ? window.ARTISTS.slice() : window.ARTISTS.filter((a) => a.metro === slug);return base.sort((a, b) => b.match - a.match);}

/* ----------------------------------------------------------------- top bar */

function TopBar({ onHome, right }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px clamp(20px, 5vw, 64px)", borderBottom: "1px solid var(--line)",
      position: "sticky", top: 0, background: "color-mix(in oklab, var(--paper) 88%, transparent)",
      backdropFilter: "blur(8px)", zIndex: 20
    }}>
      <Wordmark onClick={onHome} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>{right}</div>
    </header>);

}

/* ----------------------------------------------------------------- HOME */

function Home({ onUpload, onBrowse }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpload(e.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar right={<Label style={{ whiteSpace: "nowrap" }}>visual artist search · midwest</Label>} />
      <main style={{
        flex: 1, display: "grid", placeItems: "center", padding: "min(8vh, 80px) clamp(20px, 5vw, 64px)"
      }}>
        <div style={{ width: "min(720px, 100%)", textAlign: "center" }}>
          <Label>Upload a tattoo you love</Label>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)",
            letterSpacing: "var(--display-tracking)", color: "var(--ink)",
            fontSize: "clamp(38px, 7vw, 76px)", lineHeight: 1.02, margin: "18px 0 0",
            textWrap: "balance"
          }}>
            Find Artists near you
          </h1>
          <p style={{
            fontFamily: "var(--font-body)", fontSize: "clamp(15px, 1.6vw, 18px)", color: "var(--ink-soft)",
            maxWidth: 480, margin: "20px auto 0", lineHeight: 1.55, textWrap: "pretty"
          }}>
            Drop a reference image. We compare it against thousands of portfolio pieces and rank the
            artists near you whose style is the closest match.
          </p>

          <div
            onDragOver={(e) => {e.preventDefault();setDrag(true);}}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={() => inputRef.current && inputRef.current.click()}
            style={{
              marginTop: 40, padding: "clamp(34px, 6vw, 56px) 24px", cursor: "pointer",
              border: `1.5px dashed ${drag ? "var(--ink)" : "var(--line-strong)"}`,
              borderRadius: "calc(var(--radius) + 6px)",
              background: drag ? "var(--card)" : "transparent",
              transition: "all .18s ease"
            }}>
            
            <div style={{
              width: 44, height: 44, margin: "0 auto 16px", borderRadius: 999,
              border: "1px solid var(--line-strong)", display: "grid", placeItems: "center",
              color: "var(--ink)"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 16V4M12 4l-5 5M12 4l5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--ink)", fontWeight: 500 }}>
              Drag an image here, or click to browse
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)", marginTop: 8, letterSpacing: "0.03em" }}>
              jpg / png / heic · stays on your device
            </div>
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])} />

          <button onClick={onBrowse} style={{
            marginTop: 22, background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.04em", color: "var(--ink-soft)",
            borderBottom: "1px solid var(--line-strong)", paddingBottom: 2
          }}>Just browsing? Explore artists by metro →</button>

          <div style={{ marginTop: 30, display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap" }}>
            {[["01", "Embed"], ["02", "Compare"], ["03", "Rank near you"]].map(([n, t]) =>
            <div key={n} style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)" }}>{n}</span>
                <Label style={{ color: "var(--ink-soft)" }}>{t}</Label>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>);

}

/* ----------------------------------------------------------------- METRO PICK */

function MetroPick({ refImg, onPick, onHome, onReupload }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onHome={onHome} right={<Label style={{ whiteSpace: "nowrap" }}>step 02 · choose a metro</Label>} />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(36px, 6vw, 72px) clamp(20px, 5vw, 64px)" }}>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 32 }}>
          {refImg &&
          <div style={{ width: 132, flexShrink: 0 }}>
            <RefPlate src={refImg} ratio="4/5" />
            <button onClick={onReupload} style={{
              marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.04em",
              color: "var(--ink-soft)", background: "none", border: "none", cursor: "pointer", padding: 0
            }}>↺ replace image</button>
          </div>}
          <div style={{ flex: 1, minWidth: 260 }}>
            <Label>{refImg ? "your reference is ready" : "browse mode · no reference"}</Label>
            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)",
              letterSpacing: "var(--display-tracking)", fontSize: "clamp(30px, 5vw, 52px)",
              color: "var(--ink)", margin: "12px 0 0", lineHeight: 1.05
            }}>Where are you looking?</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--ink-soft)", marginTop: 12, maxWidth: 460, lineHeight: 1.55 }}>
              {refImg
                ? "Search every metro at once, or narrow to one. We rank artists by visual match to your reference."
                : "Browse every artist across all metros, or narrow to one city. Add a reference image any time to rank by visual match instead."}
            </p>
            {!refImg &&
            <button onClick={onReupload} style={{
              marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.04em",
              color: "var(--ink-soft)", background: "none", border: "none", cursor: "pointer",
              borderBottom: "1px solid var(--line-strong)", paddingBottom: 2
            }}>+ add a reference image to rank by match →</button>}
          </div>
        </div>

        {/* search all metros */}
        <button onClick={() => onPick("all")} style={{
          width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 1,
          background: "var(--ink)", color: "var(--paper)", border: "none",
          borderRadius: "var(--radius)", padding: "22px 26px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18
        }} className="tt-row">
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "var(--label-tracking)", textTransform: "uppercase", color: "color-mix(in oklab, var(--paper) 60%, transparent)" }}>
              every city · widest net
            </span>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)", letterSpacing: "var(--display-tracking)", fontSize: "clamp(24px, 3.5vw, 34px)", lineHeight: 1.05, marginTop: 6 }}>
              {refImg ? "Search all metros" : "Browse all artists"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "color-mix(in oklab, var(--paper) 78%, transparent)", whiteSpace: "nowrap" }}>
              {window.ARTISTS.length} artists · {window.METROS.length} metros
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--accent)" }}>→</span>
          </div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0 16px" }}>
          <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
          <Label>or pick one metro</Label>
          <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {window.METROS.map((m) => {
            const count = artistsIn(m.slug).length;
            return (
              <button key={m.slug} onClick={() => onPick(m.slug)} style={{
                textAlign: "left", background: "var(--card)", border: "none", cursor: "pointer",
                padding: "24px 24px", display: "flex", flexDirection: "column", gap: 9, minHeight: 184,
                transition: "background .16s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--card)"}>
                
                <Label>{m.state}</Label>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontSize: 27, lineHeight: 1.05, color: "var(--ink)", letterSpacing: "var(--display-tracking)" }}>{m.name}</span>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, flex: 1, margin: 0 }}>{m.blurb}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{count} artists</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent)" }}>→</span>
                </div>
              </button>);

          })}
        </div>
      </main>
    </div>);

}

/* ----------------------------------------------------------------- SEARCHING */

function Searching({ refImg, metro, onDone }) {
  const where = metroName(metro);
  const steps = refImg ?
  [
  "Embedding your image · CLIP ViT-B/32",
  `Comparing against portfolio images · ${where}`,
  "Ranking artists by cosine similarity"] :
  [
  `Loading portfolios · ${where}`,
  "Gathering artists, shops & recent work",
  "Sorting by similarity score"];

  const [i, setI] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setI(1), 750);
    const t2 = setTimeout(() => setI(2), 1500);
    const t3 = setTimeout(onDone, 2400);
    return () => {clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(380px, 100%)", textAlign: "center" }}>
        <div style={{ position: "relative", width: 188, margin: "0 auto 30px" }}>
          <RefPlate src={refImg} ratio="4/5" />
          {refImg &&
          <div className="tt-scan" style={{
            position: "absolute", inset: 0, borderRadius: "var(--radius-img)", overflow: "hidden", pointerEvents: "none"
          }}>
            <div style={{
              position: "absolute", left: 0, right: 0, height: 70,
              background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--accent) 28%, transparent), transparent)"
            }} />
          </div>}
        </div>
        <Label>{refImg ? "searching" : "loading"} · {where}</Label>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 11 }}>
          {steps.map((s, idx) =>
          <div key={idx} style={{
            display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start",
            opacity: idx <= i ? 1 : 0.32, transition: "opacity .3s ease", textAlign: "left"
          }}>
              <span style={{
              width: 14, height: 14, flexShrink: 0, borderRadius: 999,
              border: idx < i ? "none" : "1.5px solid var(--ink-faint)",
              background: idx < i ? "var(--accent)" : "transparent",
              display: "grid", placeItems: "center"
            }}>
                {idx < i && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>}
                {idx === i && <span className="tt-pulse" style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)" }} />}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" }}>{s}</span>
            </div>
          )}
        </div>
      </div>
    </div>);

}

/* ----------------------------------------------------------------- RESULTS */

function Results({ refImg, metro, matchStyle, density, onArtist, onHome, onChangeMetro, onReupload }) {
  const list = artistsIn(metro);
  const compact = density === "compact";
  const plateCount = compact ? 3 : 4;
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onHome={onHome} right={
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Label style={{ whiteSpace: "nowrap" }}>{metroName(metro)} · {list.length} artists</Label>
          <Btn onClick={onReupload} style={{ padding: "8px 14px", fontSize: 11 }}>New search</Btn>
        </div>
      } />

      {/* context bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
        padding: "20px clamp(20px, 5vw, 64px)", borderBottom: "1px solid var(--line)", background: "var(--paper-2)"
      }}>
        {refImg && <div style={{ width: 58 }}><RefPlate src={refImg} ratio="1/1" /></div>}
        <div style={{ flex: 1, minWidth: 200 }}>
          <Label>{refImg ? "your reference" : metro === "all" ? "browsing all metros" : "browsing"}</Label>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", marginTop: 3 }}>
            {refImg
              ? "Ranked by visual similarity to your image"
              : "All artists, sorted by recent work"}
          </div>
        </div>
        {!refImg &&
        <button onClick={onReupload} style={{
          fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "var(--ink-soft)",
          background: "none", border: "none", cursor: "pointer"
        }}>+ add reference</button>}
        <button onClick={onChangeMetro} style={{
          fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "var(--ink-soft)",
          background: "none", border: "none", cursor: "pointer"
        }}>↺ change metro</button>
      </div>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px, 4vw, 44px) clamp(20px, 5vw, 64px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 0 : 0 }}>
          {list.map((a, idx) =>
          <article key={a.slug} onClick={() => onArtist(a.slug)} style={{
            display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 18,
            padding: `${compact ? 22 : 30}px 0`, borderTop: idx === 0 ? "none" : "1px solid var(--line)",
            cursor: "pointer"
          }} className="tt-row">
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, flex: 1, minWidth: 220 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-faint)", width: 24 }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 style={{
                    fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)",
                    letterSpacing: "var(--display-tracking)", fontSize: "clamp(22px, 3vw, 30px)",
                    color: "var(--ink)", margin: 0, lineHeight: 1.05
                  }}>{a.name}</h3>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-soft)", marginTop: 5 }}>
                      {a.shop} · {metro === "all" ? metroName(a.metro) : a.hood}
                    </div>
                    <div style={{ marginTop: 11 }}><StyleTags styles={a.styles} max={compact ? 2 : 3} /></div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {refImg ?
                  <Match value={a.match} rank={idx + 1} kind={matchStyle} /> :
                  <Label>{a.hood}</Label>}
                  <a href={`https://instagram.com/${a.ig}`} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    @{a.ig} ↗
                  </a>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${plateCount}, 1fr)`, gap: 10 }}>
                {a.plates.slice(0, plateCount).map((p) =>
              <Plate key={p.id} plate={{ ...p, ratio: "1/1" }} label={false} />
              )}
              </div>
            </article>
          )}
        </div>
      </main>
    </div>);

}

/* ----------------------------------------------------------------- ARTIST DETAIL */

function ArtistDetail({ slug, refImg, matchStyle, onBack, onHome, onArtist }) {
  const a = window.ARTISTS.find((x) => x.slug === slug);
  const rank = artistsIn(a.metro).findIndex((x) => x.slug === slug) + 1;
  const closest = a.plates[0];
  const more = artistsIn(a.metro).filter((x) => x.slug !== slug).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onHome={onHome} right={
      <button onClick={onBack} style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.05em", color: "var(--ink)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
          ← results
        </button>
      } />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(28px, 5vw, 60px) clamp(20px, 5vw, 64px)" }}>
        {/* the match moment */}
        {refImg ?
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ background: "var(--card)", padding: 18 }}>
            <Label>your reference</Label>
            <div style={{ marginTop: 12 }}><RefPlate src={refImg} ratio="4/5" /></div>
          </div>
          <div style={{ background: "var(--card)", padding: 18 }}>
            <Label>closest piece · {a.name.split(" ")[0]}</Label>
            <div style={{ marginTop: 12 }}><Plate plate={{ ...closest, ratio: "4/5" }} label={false} /></div>
          </div>
          <div style={{ background: "var(--card)", padding: 22, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <Label>visual similarity</Label>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontSize: 56, color: "var(--ink)", lineHeight: 1 }}>
              {Math.round(a.match * 100)}<span style={{ fontSize: 26, color: "var(--ink-faint)" }}>%</span>
            </div>
            <Meter v={a.match} />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
              Ranked <strong style={{ color: "var(--ink)" }}>#{rank}</strong> of {artistsIn(a.metro).length} in {metroName(a.metro)} for your reference.
            </p>
          </div>
        </div> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ background: "var(--card)", padding: 18 }}>
            <Label>featured work · {a.name.split(" ")[0]}</Label>
            <div style={{ marginTop: 12 }}><Plate plate={{ ...closest, ratio: "4/5" }} label={false} /></div>
          </div>
          <div style={{ background: "var(--card)", padding: 22, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <Label>working in</Label>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)", letterSpacing: "var(--display-tracking)", fontSize: 36, color: "var(--ink)", lineHeight: 1.05 }}>
              {metroName(a.metro)}
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-soft)" }}>{a.shop} · {a.hood}</div>
            <div style={{ marginTop: 4 }}><StyleTags styles={a.styles} /></div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", lineHeight: 1.5 }}>
              Add a reference image to see how closely {a.name.split(" ")[0]}’s work matches yours.
            </p>
          </div>
        </div>}

        {/* identity */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontStyle: "var(--display-italic)",
              letterSpacing: "var(--display-tracking)", fontSize: "clamp(36px, 6vw, 64px)",
              color: "var(--ink)", margin: 0, lineHeight: 1
            }}>{a.name}</h1>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 17, color: "var(--ink-soft)", marginTop: 10 }}>
              {a.shop} · {a.hood}
            </div>
          </div>
          <a href={`https://instagram.com/${a.ig}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Btn primary>@{a.ig} ↗</Btn>
          </a>
        </div>

        {/* meta strip */}
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", padding: "18px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", marginBottom: 28 }}>
          {[["styles", null], ["rate", a.rate], ["working since", a.since]].map(([k, v]) =>
          <div key={k} style={{ minWidth: 90 }}>
              <Label>{k}</Label>
              <div style={{ marginTop: 7 }}>
                {k === "styles" ? <StyleTags styles={a.styles} /> :
              <span style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--ink)" }}>{v}</span>}
              </div>
            </div>
          )}
        </div>

        <p style={{ fontFamily: "var(--font-body)", fontSize: "clamp(16px, 2vw, 19px)", color: "var(--ink)", lineHeight: 1.6, maxWidth: 620, marginBottom: 44, textWrap: "pretty" }}>
          {a.bio}
        </p>

        {/* portfolio */}
        <Label>portfolio</Label>
        <div style={{ marginTop: 16, columns: "240px", columnGap: 14 }}>
          {a.plates.map((p) =>
          <div key={p.id} style={{ breakInside: "avoid", marginBottom: 14 }}>
              <Plate plate={p} />
            </div>
          )}
        </div>

        {/* more in metro */}
        <div style={{ marginTop: 56 }}>
          <Label>more in {metroName(a.metro)}</Label>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {more.map((m) =>
            <button key={m.slug} onClick={() => onArtist(m.slug)} style={{
              textAlign: "left", background: "none", border: "1px solid var(--line)", borderRadius: "var(--radius)",
              cursor: "pointer", padding: 14, display: "flex", flexDirection: "column", gap: 10
            }} className="tt-row">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {m.plates.slice(0, 3).map((p) => <Plate key={p.id} plate={{ ...p, ratio: "1/1" }} label={false} />)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", fontSize: 18, color: "var(--ink)" }}>{m.name}</span>
                  {refImg && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>{Math.round(m.match * 100)}%</span>}
                </div>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>);

}

Object.assign(window, { Home, MetroPick, Searching, Results, ArtistDetail, Btn, Label });