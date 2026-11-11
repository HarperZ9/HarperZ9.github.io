// grounds.mjs: what the pigment lies on. A ground is a medium from the table's material sheet, with its own way of
// holding pigment and its own rule for how colours combine. Pure: no page, runs in node and the browser.
//
//   GROUNDS[id]                              { name, group, rule, med, v, base, state }
//   behaviour(id)                            how the solver treats pigment on this ground: { carry, spread, lift, wick }
//   RULES[rule]                              the rule in plain words; `ordered` says whether the order of two washes can matter
//   groundFor(ix, elements, choice, night)   { id, why, pigments }: which ground a blend lies on, and which elements are its pigments
//   mixOn(id, parts, d)                      the colour (linear light) of parts [{ pig, lin }], first lowest, at thicknesses d
//
// Every colour this file returns is computed. The well's shader (well-shader.mjs) carries the same rules; a browser
// test holds the two together.
import { layer, onGround, PAPER } from './km.mjs';

export const RULES = Object.freeze({
  layers: { ordered: true, word: 'paint layers: each wash takes light away and turns some back (Kubelka-Munk), so two together are darker and the order can matter' },
  transmit: { ordered: false, word: 'light through colour: each wash is a filter and the filters multiply, so two together are darker and the order does not matter' },
  geometric: { ordered: false, word: 'pigment mixed in water: the geometric mean of the light each sends back, by amount, so the order does not matter' },
  volume: { ordered: false, word: 'a scattering volume: pigment hangs like smoke and the eye gets the plain average of what is there, by amount, so the order does not matter' },
  additive: { ordered: false, word: 'light added to light: colours sum, so two together are brighter (red and green go toward yellow) and the order does not matter' },
  partitive: { ordered: false, word: 'marks side by side: each pigment is a separate mark and the eye averages them by the area each covers, so the order does not matter' },
});
const G = (name, group, rule, med, base, state = null, more = {}) => Object.freeze({ name, group, rule, med, base, state, v: 0, ...more });
// med is the shader's number for the way a ground is drawn and v picks a variant of it. base is the ground's own colour
// in linear light (for light and screen: black). state is its row in states.mjs (solid, liquid, gas, powder), which
// sets how the well's solver treats pigment on it (BEHAVE below). wick is how much faster a wash spreads along the
// sheet's fibres than across them. made marks a ground that is not an element on the table: it is reached by an
// operation or a chain in states.mjs. No base colour here is measured.
export const GROUNDS = Object.freeze({
  paper: G('paper', 'absorbent, toothed', 'layers', 0, PAPER, 'solid'),
  'fibre-sheet': G('fibre sheet', 'absorbent, toothed', 'layers', 0, [0.76, 0.7, 0.56], 'solid', { v: 1, wick: [2.2, 0.35] , made: true }),
  'wet-sheet': G('wet fibre sheet', 'absorbent, toothed', 'layers', 0, [0.5, 0.45, 0.34], 'solid', { v: 2, wick: [1.7, 0.6], spread: 1.5 , made: true }),
  'stone-sand': G('stone', 'hard', 'layers', 1, [0.30, 0.29, 0.26], 'solid'),
  wood: G('wood', 'hard', 'layers', 1, [0.3, 0.17, 0.075], 'solid', { v: 1 , made: true }),
  'metal-plate': G('metal plate', 'hard', 'layers', 2, [0.52, 0.54, 0.57], 'solid'),
  glass: G('glass', 'hard, clear', 'transmit', 3, [0.86, 0.9, 0.88], 'solid'),
  ice: G('ice', 'hard, clear', 'transmit', 3, [0.7, 0.84, 0.93], 'solid', { v: 1 , made: true }),
  water: G('water', 'fluid', 'geometric', 4, [0.0037, 0.008, 0.0144], 'liquid'),
  melt: G('melt', 'fluid', 'geometric', 4, [0.86, 0.2, 0.02], 'liquid', { v: 1 , made: true }),
  pulp: G('pulp', 'fluid', 'geometric', 4, [0.5, 0.44, 0.31], 'liquid', { v: 2 , made: true }),
  air: G('air', 'fluid, a volume', 'volume', 5, [0.42, 0.52, 0.64], 'gas'),
  'cloud-mist': G('cloud mist', 'fluid, a volume', 'volume', 5, [0.7, 0.72, 0.74], 'gas'),
  sand: G('sand', 'granular', 'partitive', 9, [0.5, 0.4, 0.25], 'powder', { made: true }),
  snow: G('snow', 'granular', 'partitive', 9, [0.82, 0.86, 0.9], 'powder', { v: 1 , made: true }),
  'wood-chips': G('wood chips', 'granular', 'partitive', 9, [0.4, 0.25, 0.11], 'powder', { v: 2 , made: true }),
  light: G('light', 'emissive', 'additive', 6, [0, 0, 0]),
  'screen-pixel': G('screen pixel', 'emissive', 'additive', 7, [0, 0, 0]),
  data: G('data', 'symbolic', 'partitive', 8, [0.012, 0.016, 0.022]),
});
// How the solver treats pigment in each state. carry: the share of the water's motion kept each step (a solid lets go
// of it soonest, a powder at once). spread: how fast pigment spreads by itself, against the well's base rate. lift:
// how hard pigment rises, as smoke does. Our numbers, chosen to be told apart; none is measured.
export const BEHAVE = Object.freeze({ solid: { carry: 0.985, spread: 1, lift: 0 }, liquid: { carry: 0.992, spread: 1.7, lift: 0 }, gas: { carry: 0.994, spread: 2.6, lift: 16 }, powder: { carry: 0.8, spread: 0.1, lift: 0 } });
export function behaviour(id) { const g = GROUNDS[id] || GROUNDS.paper, b = BEHAVE[g.state] || BEHAVE.solid; return { ...b, spread: b.spread * (g.spread ?? 1), wick: g.wick || [1, 1] }; }
// Materials on the table with no ground of their own yet.
export const NOT_BUILT = Object.freeze(['ink', 'type', 'body', 'plant', 'fire-heat', 'thread-textile', 'film-stock', 'pigment', 'city-architecture', 'sound', 'code']);

// Which ground, and why. A choice by the visitor stands. Otherwise the first chosen element that is a material with
// a ground becomes the ground and the rest are the pigments on it, as long as at least one pigment is left. With no
// such material the ground follows the page: paper by day, water by night.
export function groundFor(ix, elements, choice = null, night = false) {
  const els = elements.map((id) => ix.byId.get(id)).filter(Boolean);
  if (choice && GROUNDS[choice]) return { id: choice, auto: false, why: 'your choice', pigments: els.map((e) => e.id) };
  const g = els.length > 1 ? els.find((e) => e.sheet === 'material' && GROUNDS[e.id]) : null;
  if (g) return { id: g.id, auto: true, why: `${g.name} is the first material in the blend, so the rest lie on it`, pigments: els.filter((e) => e !== g).map((e) => e.id) };
  const waits = els.find((e) => e.sheet === 'material' && NOT_BUILT.includes(e.id) && els.length > 1);
  return { id: night ? 'water' : 'paper', auto: true, pigments: els.map((e) => e.id),
    why: `${waits ? `${waits.name} has no ground of its own yet` : els.length > 1 ? 'no material in the blend has a ground' : 'one element alone is the pigment'}, so the ground follows the page: ${night ? 'water by night' : 'paper by day'}` };
}

export const isNight = () => typeof document !== 'undefined' && (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
export const DOT = 0.18;   // on the data ground, the share of a cell one pigment's mark covers at full strength
export function mixOn(id, parts, d = parts.map(() => 1)) {
  const g = GROUNDS[id] || GROUNDS.paper, sum = (f) => [0, 1, 2].map((c) => parts.reduce((s, p, i) => s + f(p, i, c), 0)), tot = d.reduce((a, b) => a + b, 0);
  if (g.rule === 'layers') return onGround(parts.map((p, i) => layer(p.pig, d[i])), g.base);
  if (g.rule === 'transmit') return g.base.map((b, c) => parts.reduce((t, p, i) => t * layer(p.pig, d[i]).T[c], b));
  if (g.rule === 'additive') return sum((p, i, c) => 0.9 * d[i] * p.lin[c]).map((x) => Math.min(1, x));
  if (g.rule === 'partitive') { const a = d.map((x) => DOT * Math.min(1, x)), free = 1 - a.reduce((s, x) => s + x, 0); return sum((p, i, c) => a[i] * p.lin[c]).map((x, c) => x + free * g.base[c]); }
  if (tot <= 0) return [...g.base];
  const k = 1 - Math.exp(-(g.rule === 'volume' ? 1.6 : 2.4) * tot);
  const body = g.rule === 'volume' ? sum((p, i, c) => d[i] * p.lin[c] / tot) : sum((p, i, c) => d[i] * Math.log(Math.max(p.lin[c], 0.004)) / tot).map(Math.exp);
  return body.map((x, c) => g.base[c] + (x - g.base[c]) * k);
}
