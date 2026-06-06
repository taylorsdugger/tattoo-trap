// Tattoo Trap — mock data. All artists/shops are fictional originals.
// Portfolio images are seeded placeholder "plates" (no real imagery available).

window.METROS = [
  { slug: "chicago",     name: "Chicago",     state: "IL", blurb: "Logan Square to Pilsen — the deepest bench in the Midwest." },
  { slug: "quad-cities", name: "Quad Cities", state: "IA/IL", blurb: "Davenport, Bettendorf, Rock Island & Moline." },
  { slug: "iowa-city",   name: "Iowa City",   state: "IA", blurb: "Small scene, sharp hands." },
  { slug: "peoria",      name: "Peoria",      state: "IL", blurb: "River-town traditional & fresh blackwork." },
];

// styles used for tags + plate flavor
const S = {
  fineline: "fine-line",
  blackwork: "blackwork",
  traditional: "traditional",
  neotrad: "neo-traditional",
  illustrative: "illustrative",
  ornamental: "ornamental",
  realism: "black & grey realism",
  ignorant: "ignorant style",
  botanical: "botanical",
  lettering: "script & lettering",
  micro: "micro-realism",
  dotwork: "dotwork",
};

// helper to make N plate specs seeded off artist+i
function plates(seed, specs) {
  return specs.map((s, i) => ({ id: `${seed}-${i}`, ratio: s.r, tone: s.t, tag: s.k }));
}

window.ARTISTS = [
  {
    slug: "marguerite-vane", name: "Marguerite Vane", metro: "chicago",
    shop: "Hollow Press Tattoo", hood: "Logan Square", ig: "marg.vane",
    match: 0.96, styles: [S.fineline, S.botanical, S.micro],
    bio: "Single-needle botanical and micro-realism. Fine, quiet linework — most pieces under two sessions. Books open the first Monday of each month.",
    rate: "$180/hr", since: 2014,
    plates: plates("mv", [
      { r: "4/5", t: 0.18, k: "fine-line botanical" },
      { r: "1/1", t: 0.32, k: "micro-realism" },
      { r: "4/5", t: 0.10, k: "single-needle" },
      { r: "3/4", t: 0.26, k: "floral study" },
      { r: "1/1", t: 0.20, k: "linework" },
      { r: "4/5", t: 0.14, k: "botanical" },
    ]),
  },
  {
    slug: "desmond-okafor", name: "Desmond Okafor", metro: "chicago",
    shop: "Iron Gospel", hood: "Pilsen", ig: "des.okafor.ink",
    match: 0.93, styles: [S.blackwork, S.ornamental, S.dotwork],
    bio: "Bold blackwork and ornamental pattern. Large-scale sleeves and back pieces, geometry built around the body's lines.",
    rate: "$200/hr", since: 2011,
    plates: plates("do", [
      { r: "3/4", t: 0.88, k: "blackwork sleeve" },
      { r: "1/1", t: 0.80, k: "ornamental" },
      { r: "4/5", t: 0.92, k: "dotwork mandala" },
      { r: "3/4", t: 0.74, k: "pattern" },
      { r: "1/1", t: 0.85, k: "geometry" },
    ]),
  },
  {
    slug: "junie-castellano", name: "Junie Castellano", metro: "chicago",
    shop: "Hollow Press Tattoo", hood: "Logan Square", ig: "junie.tattoo",
    match: 0.90, styles: [S.illustrative, S.neotrad],
    bio: "Illustrative neo-traditional with a muted, storybook palette. Animals, folklore, and the occasional saint.",
    rate: "$170/hr", since: 2016,
    plates: plates("jc", [
      { r: "4/5", t: 0.40, k: "illustrative" },
      { r: "1/1", t: 0.52, k: "neo-traditional" },
      { r: "3/4", t: 0.34, k: "folklore" },
      { r: "4/5", t: 0.46, k: "storybook" },
    ]),
  },
  {
    slug: "wren-okada", name: "Wren Okada", metro: "chicago",
    shop: "Northbound Electric", hood: "Avondale", ig: "wren.okada",
    match: 0.88, styles: [S.fineline, S.lettering],
    bio: "Fine-line and script specialist. Delicate lettering, fingerwaves, and minimal symbolic work.",
    rate: "$160/hr", since: 2018,
    plates: plates("wo", [
      { r: "1/1", t: 0.16, k: "script" },
      { r: "4/5", t: 0.22, k: "fine-line" },
      { r: "3/4", t: 0.12, k: "lettering" },
      { r: "1/1", t: 0.28, k: "minimal" },
    ]),
  },
  {
    slug: "porter-hale", name: "Porter Hale", metro: "chicago",
    shop: "Iron Gospel", hood: "Pilsen", ig: "porter.hale.tat",
    match: 0.85, styles: [S.traditional, S.neotrad],
    bio: "American traditional, done by the book. Bold lines, solid black, color that lasts.",
    rate: "$175/hr", since: 2009,
    plates: plates("ph", [
      { r: "4/5", t: 0.58, k: "traditional" },
      { r: "1/1", t: 0.64, k: "bold lines" },
      { r: "3/4", t: 0.50, k: "flash" },
    ]),
  },
  {
    slug: "elodie-fischer", name: "Elodie Fischer", metro: "quad-cities",
    shop: "River Bend Tattoo", hood: "Davenport, IA", ig: "elodie.fischer",
    match: 0.94, styles: [S.fineline, S.botanical, S.dotwork],
    bio: "Delicate botanical fine-line and dotwork shading. Quiet, plant-forward pieces with a naturalist's eye.",
    rate: "$140/hr", since: 2017,
    plates: plates("ef", [
      { r: "4/5", t: 0.20, k: "botanical fine-line" },
      { r: "1/1", t: 0.30, k: "dotwork shading" },
      { r: "3/4", t: 0.14, k: "plant study" },
      { r: "4/5", t: 0.24, k: "naturalist" },
      { r: "1/1", t: 0.18, k: "fine-line" },
    ]),
  },
  {
    slug: "marcus-feld", name: "Marcus Feld", metro: "quad-cities",
    shop: "Anchor & Moline", hood: "Moline, IL", ig: "marcusfeld.ink",
    match: 0.87, styles: [S.realism, S.illustrative],
    bio: "Black & grey realism — portraits, hands, and architectural detail. Long sessions, deep blacks.",
    rate: "$165/hr", since: 2012,
    plates: plates("mf", [
      { r: "3/4", t: 0.70, k: "b&g realism" },
      { r: "1/1", t: 0.76, k: "portrait" },
      { r: "4/5", t: 0.66, k: "architectural" },
      { r: "3/4", t: 0.82, k: "detail" },
    ]),
  },
  {
    slug: "sage-deluca", name: "Sage DeLuca", metro: "quad-cities",
    shop: "River Bend Tattoo", hood: "Bettendorf, IA", ig: "sage.deluca",
    match: 0.83, styles: [S.ignorant, S.illustrative],
    bio: "Ignorant-style and loose illustrative work. Quick, characterful, a little chaotic on purpose.",
    rate: "$130/hr", since: 2019,
    plates: plates("sd", [
      { r: "1/1", t: 0.36, k: "ignorant style" },
      { r: "4/5", t: 0.44, k: "loose line" },
      { r: "3/4", t: 0.30, k: "character" },
    ]),
  },
  {
    slug: "tomas-rivera", name: "Tomás Rivera", metro: "iowa-city",
    shop: "Prairie Light Tattoo", hood: "Northside", ig: "tomas.rivera.art",
    match: 0.91, styles: [S.blackwork, S.illustrative, S.ornamental],
    bio: "Illustrative blackwork — woodcut textures, folklore, dense hatching. Builds custom pieces over multiple sittings.",
    rate: "$150/hr", since: 2015,
    plates: plates("tr", [
      { r: "3/4", t: 0.84, k: "woodcut blackwork" },
      { r: "4/5", t: 0.78, k: "hatching" },
      { r: "1/1", t: 0.90, k: "folklore" },
      { r: "3/4", t: 0.72, k: "illustrative" },
    ]),
  },
  {
    slug: "harriet-boyd", name: "Harriet Boyd", metro: "iowa-city",
    shop: "Prairie Light Tattoo", hood: "Downtown", ig: "harriet.boyd",
    match: 0.86, styles: [S.fineline, S.micro, S.botanical],
    bio: "Micro fine-line — tiny, precise, often smaller than a coin. Walk-in friendly on weekends.",
    rate: "$135/hr", since: 2020,
    plates: plates("hb", [
      { r: "1/1", t: 0.22, k: "micro fine-line" },
      { r: "4/5", t: 0.16, k: "tiny tattoo" },
      { r: "1/1", t: 0.28, k: "precise" },
    ]),
  },
  {
    slug: "calvin-ostrander", name: "Calvin Ostrander", metro: "peoria",
    shop: "Bridge Street Electric", hood: "Warehouse District", ig: "calvin.ost",
    match: 0.89, styles: [S.traditional, S.neotrad, S.illustrative],
    bio: "River-town traditional with a neo-trad edge. Eagles, daggers, roses — and a softer illustrative side.",
    rate: "$145/hr", since: 2013,
    plates: plates("co", [
      { r: "4/5", t: 0.56, k: "traditional" },
      { r: "1/1", t: 0.48, k: "neo-trad" },
      { r: "3/4", t: 0.60, k: "flash" },
      { r: "4/5", t: 0.42, k: "illustrative" },
    ]),
  },
  {
    slug: "nadia-branch", name: "Nadia Branch", metro: "peoria",
    shop: "Bridge Street Electric", hood: "Warehouse District", ig: "nadia.branch",
    match: 0.84, styles: [S.blackwork, S.ornamental, S.dotwork],
    bio: "Fresh blackwork and ornamental dotwork. Symmetry, negative space, and a lot of patience.",
    rate: "$140/hr", since: 2019,
    plates: plates("nb", [
      { r: "3/4", t: 0.86, k: "blackwork" },
      { r: "1/1", t: 0.80, k: "ornamental dotwork" },
      { r: "4/5", t: 0.90, k: "negative space" },
    ]),
  },
];
