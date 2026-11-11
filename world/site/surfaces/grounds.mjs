// grounds.mjs: what the pigment lies on. A ground is a medium from the table's material sheet, with its own way of
// holding pigment and its own rule for how colours combine. Pure: no page, runs in node and the browser.
//
//   GROUNDS[id]                              { name, group, rule, med, base }
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
const G = (name, group, rule, med, base) => Object.freeze({ name, group, rule, med, base });
// med is the shader's number for the ground. base is the ground's own colour in linear light (for light and screen: black).
export const GROUNDS = Object.freeze({
  paper: G('paper', 'absorbent, toothed', 'layers', 0, PAPER),
  'stone-sand': G('stone', 'hard', 'layers', 1, [0.30, 0.29, 0.26]),
  'metal-plate': G('metal plate', 'hard', 'layers', 2, [0.52, 0.54, 0.57]),
  glass: G('glass', 'hard, clear', 'transmit', 3, [0.86, 0.9, 0.88]),
  water: G('water', 'fluid', 'geometric', 4, [0.0037, 0.008, 0.0144]),
  air: G('air', 'fluid, a volume', 'volume', 5, [0.42, 0.52, 0.64]),
  'cloud-mist': G('cloud mist', 'fluid, a volume', 'volume', 5, [0.7, 0.72, 0.74]),
  light: G('light', 'emissive', 'additive', 6, [0, 0, 0]),
  'screen-pixel': G('screen pixel', 'emissive', 'additive', 7, [0, 0, 0]),
  data: G('data', 'symbolic', 'partitive', 8, [0.012, 0.016, 0.022]),
});
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
