// lib/medium/loops.mjs: transfer loops (BLEED sections 13 to 15). Each places one item on the medium as ticks and
// lets its weights move from element A to element B while it moves, by the law of B (a cellular-automaton rule with
// B's kernel and threshold) and B's own timing layer. Built so the same endpoints can be reached by different paths
// and the timing layer can be swapped between elements.
//   dry          words in ink, carried across the surface by a current, drying to charcoal from the thin edges in
//   forge        a bar of iron heated from one end: dark, then red, orange and yellow as the heat front crosses it
//                (blackbody colour, brightness rising with temperature, Newton's exponential timing)
//   leaf         a leaf turning from its edge in: red where anthocyanin sits over the carotenoids, fading to orange
//                and yellow as the red breaks down (a reveal of the layer beneath; logistic, seasonal timing)
//   forge-leaftime / leaf-forgetime   the same colours on the other element's timing layer
//   dry-crossfade                     the control: one global slider moves every tick together
// Options: ca: false removes the neighbour rule (each tick then changes only by its own local drive).
import { Medium } from './medium.mjs';
import { placeItem } from './ticks.mjs';
import { timing } from './timing.mjs';
import { setText } from '../../adapters/type.mjs';
import { fillNonzero } from '../fill.mjs';
import { absorbanceOf } from './spectral.mjs';

const lin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const absorbOf = h => lin(h).map(v => -Math.log(Math.max(0.02, v)) / 3.9);
const hash = n => { let q = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); q ^= q >>> 13; q = Math.imul(q, 0xc2b2ae35); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// blackbody colour (linear sRGB, relative) by temperature in kelvin: a fit to Planck's law over 800 to 2000 K
// (Tanner Helland's approximation, normalised), brightness rising steeply with temperature (Stefan-Boltzmann, T^4)
function blackbody(K) {
  const t = K / 100, r = 1, g = t <= 66 ? Math.min(1, Math.max(0, (99.47 * Math.log(t) - 161.12) / 255)) : 1, b = t <= 19 ? 0 : Math.min(1, Math.max(0, (138.52 * Math.log(t - 10) - 305.04) / 255));
  const c = [r, g, b].map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)), lum = Math.min(4, (K / 1500) ** 4);
  return c.map(v => v * lum * 0.55);
}

// the elements
const INK_S = absorbanceOf('#1f3a8f').map(v => v * 1.8), INK = { name: 'ink', look: () => ({ absorb: absorbOf('#1f3a8f').map(v => v * 1.8), absorbS: INK_S }) };
const CHARCOAL = (ca = true, mode = 'lenia') => ({
  name: 'charcoal',
  law: { mode, radius: 1.5, threshold: ca ? 0.36 : 0.3, softness: 0.05, rate: mode === 'global' ? 1 / 3.5 : 1.6, drive: { thin: 0.55, travel: 0.45, travelScale: 90 }, ring: false, neighbours: ca },
  look: t => { const g = 0.55 + 0.9 * hash(t.id) ** 2; return { paint: [0.06 * g, 0.052 * g, 0.045 * g, 0.95] }; },   // matte, warm black, granular
});
const IRON = { name: 'iron', look: t => ({ paint: mix(lin('#2a2726'), lin('#3a3633'), hash(t.id)).concat([1]) }) };
const LAMBDA16 = [400, 420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 640, 660, 680, 700], planckN = (l, K) => { const x = l * 1e-9; return 1 / (x ** 5 * (Math.exp(1.4387769e-2 / (x * K)) - 1)); };
// the glow as light: blackbody colour and, for a spectral tank, the blackbody spectrum itself (same brightness law)
const forgeLook = p => { const K = 780 + 1900 * p, lum = Math.min(4, (K / 1500) ** 4) * 0.55; return { paint: [0.05, 0.03, 0.02, 1], emit: blackbody(K), emitS: LAMBDA16.map(l => lum * planckN(l, K) / planckN(560, K)) }; };
// a leaf's layers: carotenoid yellow underneath; anthocyanin red over it, breaking down as p rises; a little brown
// as the cells dry. Red -> orange -> yellow by reveal, lightness rising only slightly (reflected, not emitted)
const leafLook = p => { const car = lin('#e2b23a'), ant = lin('#a8231d'), a = Math.max(0, 1 - p * 1.15), base = mix(car, lin('#c98a2a'), 0.25 * (1 - p)); return { paint: mix(base, ant, a).concat([0.96]) }; };
const LEAFGREEN = { name: 'red leaf', look: t => ({ paint: mix(lin('#8f1f1a'), lin('#a3291f'), hash(t.id)).concat([0.96]) }) };

const FORGE_TIME = [timing('exp', 1, { tau: 1.6 })], LEAF_TIME = [timing('logistic', 1, { tau: 5, mid: 0.45 })];

function textInside(m, text, cx, cy, wc, hc) {
  const S = 6, gw = Math.round(wc * S), gh = Math.round(hc * S), { polys } = setText(text, gw, gh, { fill: 0.92 }), mask = fillNonzero(polys, gw, gh);
  const x0 = cx - wc / 2, y0 = cy - hc / 2;
  // thickness: the mask blurred a little, so stroke centres are thick and edges thin (drying starts at the edges)
  return { box: [x0, y0, x0 + wc, y0 + hc], inside: (x, y) => { const i = Math.floor((x - x0) * S), j = Math.floor((y - y0) * S); if (i < 1 || j < 1 || i >= gw - 1 || j >= gh - 1) return 0; let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += mask[(j + b) * gw + i + a]; return s / 9 * mask[j * gw + i]; } };
}

export const LOOPS = {
  dry: { seconds: 9, view: [0.0, 0.02, 0.9, 0.62], build: (m, o) => {
    // the current runs along the top of the words, so their upper strokes are dragged ahead of the lower ones (shear)
    m.add('current', { x: 0.5, y: 0.19, w: 0.55, h: 0.07 }, 0.16, { angle: -0.08, at: 0, for: 600 });
    m.add('turbulence', { x: 0.5, y: 0.3, w: 0.5, h: 0.2 }, 2.5, { at: 0 });
    m.add('heat', { x: 0.5, y: 0.9, w: 0.06, h: 0.02 }, 1.2, { at: 0, for: 600 });
    m.add('wind', {}, 0.5, { at: 0, for: 600, gust: true });
    const T = textInside(m, 'flow', 0.2 * m.nx, 0.22 * m.ny, 0.24 * m.nx, 0.12 * m.ny);
    placeItem(m, { ...T, spacing: 0.32, elements: [INK, CHARCOAL(o.ca !== false, o.mode)] });
  } },
  forge: { seconds: 7, view: [0.15, 0.2, 0.85, 0.9], build: (m, o) => forgeOrLeaf(m, o, IRON, forgeLook, o.timing ?? FORGE_TIME, 'forge') },
  leaf: { seconds: 7, view: [0.15, 0.2, 0.85, 0.9], build: (m, o) => forgeOrLeaf(m, o, LEAFGREEN, leafLook, o.timing ?? LEAF_TIME, 'leaf') },
};
// claim: a claim and its correction, with amounts from real reach (the Khashoggi thread in Daylight's records: the
// claim seen 230,000 times, the sourced correction 627 times). The claim is ink, set as words, poured into a strong
// current (the platform's push). The correction is a dye poured at the same place and time, with 627 / 230,000 of the
// claim's mass and no current behind it: it spreads only by diffusion. Where enough correction reaches a claim tick,
// that tick turns from claim to corrected (the correction's law: a tracer drive plus its neighbours). With the real
// ratio almost nothing turns. Counterfactuals, labelled as such: equal-reach (the same mass, no push), equal-push (the
// real mass, poured into the same current) and equal-both.
const REACH = { claim: 230000, correction: 627 };
const CORR_S = absorbanceOf('#3e7d7f').map(v => v * 1.2);
const CLAIM_S = absorbanceOf('#a93b29').map(v => v * 1.7), CLAIM = { name: 'claim', look: () => ({ absorb: absorbOf('#a93b29').map(v => v * 1.7), absorbS: CLAIM_S }) };
const CORRECTED = { name: 'corrected', law: { mode: 'lenia', radius: 1.4, threshold: 0.4, softness: 0.05, rate: 1.5, drive: { tracer: { name: 'correction', gain: 1, scale: 0.35 } } }, look: () => ({ absorb: absorbOf('#3e7d7f').map(v => v * 1.2), absorbS: CORR_S }) };
function claimLoop(m, ratio, push = false) {
  m.add('current', { x: 0.5, y: 0.26, w: 0.5, h: 0.06 }, 0.55, { angle: 0, at: 0, for: 600 });
  m.add('wind', {}, 0.4, { at: 0, for: 600, gust: true });
  const T = textInside(m, 'claim', 0.17 * m.nx, 0.26 * m.ny, 0.2 * m.nx, 0.1 * m.ny);
  const it = placeItem(m, { ...T, spacing: 0.32, elements: [CLAIM, CORRECTED] });
  const M = it.ticks.reduce((a, t) => a + t.h, 0) * it.spacing * it.spacing, R = 0.05 * m.ny, sumF = Math.PI * R * R / 3;
  it.mass = M; it.correctionMass = M * ratio;
  m.add('tracer', { x: 0.17, y: push ? 0.26 : 0.36, r: 0.05 }, M * ratio / sumF, { name: 'correction', kappa: 2.5, color: '#3e7d7f', visible: 1, at: 0, for: 0 });
}
LOOPS.claim = { seconds: 8, view: [0, 0, 1, 1], build: m => claimLoop(m, REACH.correction / REACH.claim) };
LOOPS['claim-equal-reach'] = { seconds: 8, view: [0, 0, 1, 1], build: m => claimLoop(m, 1) };
LOOPS['claim-equal-push'] = { seconds: 8, view: [0, 0, 1, 1], build: m => claimLoop(m, REACH.correction / REACH.claim, true) };
LOOPS['claim-equal-both'] = { seconds: 8, view: [0, 0, 1, 1], build: m => claimLoop(m, 1, true) };
LOOPS['dry-crossfade'] = { ...LOOPS.dry, build: (m, o) => LOOPS.dry.build(m, { ...o, mode: 'global' }) };
LOOPS['forge-leaftime'] = { ...LOOPS.forge, build: (m, o) => LOOPS.forge.build(m, { ...o, timing: LEAF_TIME }) };
LOOPS['leaf-forgetime'] = { ...LOOPS.leaf, build: (m, o) => LOOPS.leaf.build(m, { ...o, timing: FORGE_TIME }) };

function forgeOrLeaf(m, o, A, look, time, kind) {
  const cx = 0.5 * m.nx, cy = 0.55 * m.ny, L = (kind === 'forge' ? 0.3 : 0.42) * m.nx, Hh = 0.13 * m.ny;
  const inside = kind === 'forge'
    ? (x, y) => (Math.abs(x - cx) < L / 2 && Math.abs(y - cy) < Hh / 3 ? 1 : 0)
    : (x, y) => { const u = (x - cx) / (L / 2), v = (y - cy) / (Hh * 1.1); const half = 0.62 * (1 - u * u) ** 0.8 * (1 + 0.15 * Math.sin(u * 9)); return Math.abs(u) < 1 && Math.abs(v) < half ? 1 - 0.6 * (Math.abs(v) / Math.max(1e-3, half)) ** 3 : 0; };
  const B = {
    name: kind === 'forge' ? 'hot iron' : 'turned leaf', timing: time, look: (t, p) => look(p),
    // the front: forge heat conducts from the hot end (heat drive from the medium); a leaf turns from its edges in
    law: { mode: o.mode ?? 'lenia', radius: kind === 'forge' ? 4 : 1.6, threshold: 0.36, softness: 0.05, rate: o.mode === 'global' ? 1 / 4 : kind === 'forge' ? 5 : 1.2, drive: kind === 'forge' ? { heat: 2.2, age: 0.12 } : { thin: 0.8, age: 0.3, ageScale: 7 }, neighbours: o.ca !== false },
  };
  if (kind === 'forge') m.add('heat', { x: (cx - L / 2) / m.nx + 0.02, y: cy / m.ny + 0.03, w: 0.035, h: 0.03 }, 60, { at: 0, for: 20 });
  placeItem(m, { inside, box: [cx - L / 2, cy - Hh, cx + L / 2, cy + Hh], spacing: 0.32, elements: [A, B], still: kind === 'forge' });
}

export function loopTank(name, o = {}) {
  const P = LOOPS[name]; if (!P) throw new Error(`loops: no loop "${name}" (one of ${Object.keys(LOOPS).join(', ')})`);
  const m = new Medium({ nx: 192, ny: 108, seed: `loop/${name}`, waterLevel: 0.05, bedRelief: 0.4, spectral: !!o.spectral });
  P.build(m, o);
  return m;
}
