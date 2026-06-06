// Tattoo Trap — Plate: an honest, gallery-toned placeholder for a portfolio image.
// No faked tattoos. Tone is seeded (0 = light/fine-line, 1 = dense blackwork) so the
// grid has rhythm; a faint engraving hatch + corner tag read as "catalog placeholder".

const { useMemo } = React;

// deterministic 0..1 from a string
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

// build a warm-gray fill from a 0..1 tone (low = pale, high = near-black)
function plateBg(tone, seedKey) {
  const r = hash01(seedKey);
  // lightness range: pale 90% .. ink 14%
  const L = 90 - tone * 76;
  const L2 = Math.max(8, L - 10 - r * 8);
  const hue = 38; // warm
  const sat = 6 + (1 - tone) * 4;
  const a = `oklch(${(L / 100).toFixed(3)} 0.012 70)`;
  const b = `oklch(${(L2 / 100).toFixed(3)} 0.012 70)`;
  const ang = 120 + Math.round(r * 80);
  return {
    base: `linear-gradient(${ang}deg, ${a}, ${b})`,
    hatchInk: tone > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    labelInk: tone > 0.5 ? "rgba(245,242,235,0.82)" : "rgba(30,26,22,0.55)",
    ringInk: tone > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
  };
}

function Plate({ plate, label = true, style = {}, onClick }) {
  const c = useMemo(() => plateBg(plate.tone, plate.id), [plate.tone, plate.id]);
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        aspectRatio: plate.ratio,
        background: c.base,
        borderRadius: "var(--radius-img)",
        overflow: "hidden",
        boxShadow: `inset 0 0 0 1px ${c.ringInk}`,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {/* engraving hatch */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(48deg, ${c.hatchInk} 0 1px, transparent 1px 7px)`,
        opacity: 0.9, mixBlendMode: "overlay",
      }} />
      {/* soft vignette for depth */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 120% at 30% 20%, transparent 40%, rgba(0,0,0,0.10) 100%)",
      }} />
      {label && (
        <div style={{
          position: "absolute", left: 10, bottom: 9,
          fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.04em",
          color: c.labelInk, textTransform: "lowercase",
        }}>
          {plate.tag}
        </div>
      )}
    </div>
  );
}

// The user's real uploaded reference (or a placeholder prompting upload)
function RefPlate({ src, ratio = "4/5", style = {}, faint = false }) {
  if (src) {
    return (
      <div style={{
        position: "relative", aspectRatio: ratio, borderRadius: "var(--radius-img)",
        overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)", ...style,
      }}>
        <img src={src} alt="your reference" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{
      position: "relative", aspectRatio: ratio, borderRadius: "var(--radius-img)",
      background: "var(--paper-2)", boxShadow: "inset 0 0 0 1px var(--line)",
      display: "grid", placeItems: "center", ...style,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)" }}>
        your reference
      </span>
    </div>
  );
}

Object.assign(window, { Plate, RefPlate, hash01 });
