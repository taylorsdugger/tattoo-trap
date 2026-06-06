// Tattoo Trap — theme system. Three gallery directions, all sharing a
// cream/ink "art is the hero" DNA but differing in type, rhythm and softness.

window.THEMES = {
  atelier: {
    label: "Atelier",
    note: "Editorial serif, airy, museum-catalog restraint.",
    vars: {
      "--paper": "#f3f0e9",
      "--paper-2": "#eceadf",
      "--card": "#faf8f2",
      "--ink": "#1a1714",
      "--ink-soft": "#6f6a60",
      "--ink-faint": "#a39d90",
      "--line": "#ddd8cb",
      "--line-strong": "#c8c2b2",
      "--accent": "#1a1714",
      "--radius": "2px",
      "--radius-img": "1px",
      "--font-display": "'Newsreader', Georgia, serif",
      "--font-body": "'Archivo', system-ui, sans-serif",
      "--font-mono": "'Spline Sans Mono', ui-monospace, monospace",
      "--display-weight": "420",
      "--display-tracking": "-0.01em",
      "--label-tracking": "0.18em",
      "--display-italic": "italic",
    },
  },
  index: {
    label: "Index",
    note: "Swiss grotesque + monospace metadata, strict grid, systematic.",
    vars: {
      "--paper": "#f1f0ec",
      "--paper-2": "#e7e6df",
      "--card": "#fbfbf8",
      "--ink": "#15140f",
      "--ink-soft": "#67645c",
      "--ink-faint": "#9d998f",
      "--line": "#d8d6cc",
      "--line-strong": "#bdbab0",
      "--accent": "#15140f",
      "--radius": "0px",
      "--radius-img": "0px",
      "--font-display": "'Archivo', system-ui, sans-serif",
      "--font-body": "'Archivo', system-ui, sans-serif",
      "--font-mono": "'Spline Sans Mono', ui-monospace, monospace",
      "--display-weight": "700",
      "--display-tracking": "-0.03em",
      "--label-tracking": "0.16em",
      "--display-italic": "normal",
    },
  },
  salon: {
    label: "Salon",
    note: "Warmer paper, immersive imagery, soft edges, a whisper of clay.",
    vars: {
      "--paper": "#f4ede2",
      "--paper-2": "#ece2d2",
      "--card": "#fbf6ee",
      "--ink": "#241d16",
      "--ink-soft": "#766a5b",
      "--ink-faint": "#a99d89",
      "--line": "#ded2bf",
      "--line-strong": "#c9bba3",
      "--accent": "#9a6f4e",
      "--radius": "12px",
      "--radius-img": "10px",
      "--font-display": "'Spectral', Georgia, serif",
      "--font-body": "'Archivo', system-ui, sans-serif",
      "--font-mono": "'Spline Sans Mono', ui-monospace, monospace",
      "--display-weight": "500",
      "--display-tracking": "-0.005em",
      "--label-tracking": "0.2em",
      "--display-italic": "normal",
    },
  },
};

// Accent presets (curated neutrals + one clay) — TweakColor swatches
window.ACCENTS = ["#1a1714", "#9a6f4e", "#5d6b6a", "#7a4a40"];

window.applyTheme = function applyTheme(themeKey, accent) {
  const t = window.THEMES[themeKey] || window.THEMES.atelier;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (accent) root.style.setProperty("--accent", accent);
};
