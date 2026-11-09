// brush/scenes.js: two paintings written as stroke lists, after the techniques in images 18, 19 and 24 (our own
// compositions; no figure, no tracing). A scene is { aspect, ground: [top, bottom], ops: [{ b, c, pts, seed }] }
// in canvas-width units, so render(scene, 3840) re-paints at 4K instead of enlarging a small one.
import { Surface } from './surface.js';
import { paintStroke, liveStroke } from './stroke.js';
import { preset } from './presets.js';
import { linear, rng } from './core.js';
import { curlPath, netLattice, billowRing, line, thorn, spiral, figure, catenary } from './paths.js';
import { renderCloud } from './cloud.js';
import { makeCloud, growLobes } from './cloud2d.js';
import { bloom, reflect } from './post.js';

const dot = (x, y, p = 1) => [{ x, y, p }];

// "Nocturne" (re-targeted, our own composition): a lone figure on a shore raises a cord that fans into a net of light
// cast over a towering storm. A hidden moon behind the upper left gives the storm its silver lining; a red ember
// low behind the base is the one hot mark; still water doubles everything. The rope that holds or snares.
export function nocturne(seed = 7) {
  const R = rng(seed), ops = [], A = 4 / 3, add = (b, c, pts, over) => ops.push({ b, c, pts, seed: (R() * 1e9) | 0, over });
  const horizon = 1.0, moon = [0.14, 0.13];
  // sky: a cold glow round the hidden moon, deep violet overhead, a pale band at the horizon
  add('haze', '#3b4366', dot(moon[0], moon[1]), { size: 0.7, flow: 0.55, spacing: 10 });
  add('haze', '#9ea6cf', dot(moon[0], moon[1]), { size: 0.28, flow: 0.6, spacing: 10 });
  add('haze', '#f4f3ff', dot(moon[0], moon[1]), { size: 0.07, flow: 0.9, spacing: 10, tip: ['round', { hardness: 0.7 }] });
  for (let i = 0; i < 6; i++) add('haze', '#343850', line(-0.1, horizon - 0.03 - i * 0.01, 1.1, horizon - 0.02 - i * 0.012, { n: 8 }), { size: 0.08, flow: 0.12 });
  // the ember, low behind the storm's base: the cloud is laid over it, so it shows through a gap
  add('haze', '#5a1a1c', dot(0.74, 0.865), { size: 0.3, flow: 0.5, spacing: 10 });
  add('haze', '#e2382c', dot(0.74, 0.865), { size: 0.05, flow: 1, spacing: 10, tip: ['round', { hardness: 0.6 }] });
  // the storm: a tower of masses with an anvil, base cut flat above the water
  const trunks = [];
  const row = (y, n, x0, x1, r, ry = 0.85) => { for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * (i + 0.5)) / n + (R() - 0.5) * 0.04; trunks.push({ c: [x, y + (R() - 0.5) * 0.03, (R() - 0.5) * 0.1], r: [r * (0.85 + R() * 0.3), r * ry, r] }); } };
  row(0.8, 7, 0.08, 1.02, 0.11); row(0.64, 6, 0.2, 0.98, 0.115); row(0.48, 5, 0.3, 0.92, 0.11); row(0.34, 4, 0.36, 0.86, 0.1); row(0.22, 5, 0.22, 1.05, 0.09, 0.45);
  ops.push({ type: 'cloud', cloud: makeCloud({ seed, trunks, light: { pos: [moon[0], moon[1], -0.04], color: '#f2efff', falloff: 0.55, intensity: 2.6 },
    base: { y: 0.87, soft: 0.012 }, medium: { extinction: 30, ambient: '#4b5378', bounce: '#141015', powder: 0.55 }, style: 'volume',
    styleOpts: { mid: '#3a3346', lit: '#d6d3ee', glowR: 0.2, glowK: 0.4, rimK: 1.1, ambient: 0.25, under: 0.6, curl: 0.011 } }) });
  // the net: strands from the raised hand fan up over the storm, cross-tied into a lattice; soft halo, fine core
  const fig = figure(0.33, horizon + 0.005, 0.085, { lightSide: -1 }), hand = fig.hand, ends = [];
  for (let i = 0; i < 9; i++) ends.push([0.18 + i * 0.1 + (R() - 0.5) * 0.03, 0.2 + Math.abs(i - 4) * 0.035 + R() * 0.03]);
  const strands = ends.map((e) => catenary(hand, e, 0.03 + R() * 0.03, 40)); // cords droop under their own weight
  for (const st of strands) { add('halo', '#7f97c4', st, { flow: 0.035, size: 0.02 }); add('filament', '#e2e9ff', st, { flow: 0.06, size: 0.0026 }); }
  for (let k = 1; k <= 4; k++) {
    const t = k / 5, pts = strands.map((st) => st[Math.round(t * (st.length - 1))]);
    for (let i = 0; i + 1 < pts.length; i++) {
      const tie = catenary([pts[i].x, pts[i].y], [pts[i + 1].x, pts[i + 1].y], 0.01, 8);
      add('filament', '#cfdcff', tie, { flow: 0.07, size: 0.0022 });
      if (R() < 0.3) add('flare', '#dfe8ff', dot(pts[i].x, pts[i].y), { size: 0.035, flow: 0.5 });
    }
  }
  // the shore: a low dark spit under the figure
  add('wisp', '#0c0b10', line(0.12, horizon + 0.004, 0.62, horizon + 0.006, { n: 10, p: [0.3, 1, 0.3] }), { size: 0.012, flow: 1, wet: null, grain: null, taper: { start: 0.3, end: 0.3 } });
  // the figure, painted: head, coat, legs, raised arm; a rim of moonlight down the left side
  add('wisp', '#0b0a0e', fig.head, { size: 0.013, flow: 1, spacing: 0.05, wet: null, grain: null, taper: null, tip: ['round', { hardness: 0.75 }] });
  // strokes wide enough to merge into one silhouette (a coat, not a stick figure)
  for (const st of fig.body) add('wisp', '#0b0a0e', st, { size: 0.016, flow: 1, spacing: 0.04, wet: null, grain: null, taper: { start: 0.05, end: 0.15 }, velocity: null, tip: ['round', { hardness: 0.75 }] });
  for (const st of fig.rim) add('rim', '#9aa3cc', st, { size: 0.0022, flow: 0.4, taper: { start: 0.3, end: 0.3 } });
  // the water: the whole sky mirrored with a shimmer, then a few smeared glints
  ops.push({ type: 'reflect', opts: { horizon: horizon / A, dim: 0.5, mix: 0.85, shimmer: 0.01, seed, water: '#0b0c12' } });
  for (let i = 0; i < 18; i++) { const y = horizon + 0.02 + R() ** 1.5 * 0.3, x = R() * 0.8; add('smear', null, line(x, y, x + 0.15 + R() * 0.2, y, { n: 6 }), { size: 0.04, smudge: { strength: 0.35, length: 0.85 } }); }
  ops.push({ type: 'bloom', opts: { threshold: 0.3, radius: 0.035, strength: 0.7, tint: '#c8ccff' } });
  return { name: 'nocturne', aspect: A, ground: ['#10111c', '#272a3d'], ops };
}

// "Star cloud": a clearing in cumulus lit from inside, a dark astroid in the light, small flares. After the techniques
// of images 19 and 24. The cloud is a lit field (cloud.js): masses nested into lobes and curls, light marched from the
// opening, silver lining, under-shadow, found edges toward the light and lost edges in the dark. Brushes add wisps.
export function starcloud(seed = 3) {
  const R = rng(seed), ops = [], A = 4 / 3, add = (b, c, pts, over) => ops.push({ b, c, pts, seed: (R() * 1e9) | 0, over });
  const L = { x: 0.47, y: 0.4 };
  // the light behind: a lilac sky glowing out of the opening
  add('haze', '#2a2a44', dot(L.x, L.y + 0.05), { size: 0.9, flow: 0.45, spacing: 10 });
  add('haze', '#7d80bd', dot(L.x, L.y), { size: 0.56, flow: 0.55, spacing: 10 });
  add('haze', '#cfcfef', dot(L.x + 0.01, L.y - 0.02), { size: 0.44, flow: 0.8, spacing: 10 });
  add('haze', '#f4f3fd', dot(L.x + 0.02, L.y - 0.03), { size: 0.28, flow: 0.8, spacing: 10 });
  // masses wrap the opening on the left, below and over the top; the right side stays open dark sky, as in both
  // references; a bank closes the base
  const masses = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.35 + 1.45 * (i / 15)) + R() * 0.12, low = Math.max(0, Math.sin(a));
    masses.push({ x: L.x + Math.cos(a) * (0.24 + R() * 0.03), y: L.y + 0.04 + Math.sin(a) * (0.33 + R() * 0.03), r: 0.085 + 0.05 * low + R() * 0.03 });
  }
  for (let i = 0; i < 8; i++) { const a = Math.PI * (0.55 + 1.1 * (i / 7)); masses.push({ x: L.x + Math.cos(a) * 0.4, y: L.y + Math.sin(a) * 0.52 + 0.06, r: 0.12 + R() * 0.04 }); }
  for (let i = 0; i < 6; i++) masses.push({ x: 0.05 + i * 0.2 + R() * 0.05, y: 1.2 + R() * 0.04, r: 0.12 + R() * 0.04 });
  const trunks = masses.map((m) => ({ c: [m.x, m.y, (R() - 0.5) * 0.1], r: [m.r, m.r * 0.85, m.r * 0.9] }));
  const cloud = makeCloud({ seed, trunks, light: { pos: [L.x, L.y, -0.035], color: '#f7f5ff', falloff: 0.21, intensity: 3.0 }, base: { y: 1.4, soft: 0.02 },
    medium: { extinction: 26, ambient: '#565b80', bounce: '#121015', powder: 0.5 }, style: 'volume',
    styleOpts: { mid: '#3c3c52', lit: '#e4e3f6', glowR: 0.3, glowK: 0.85, rimK: 1.0, ambient: 0.1, curl: 0.011 } });
  ops.push({ type: 'cloud', cloud });
  // stars: a dark astroid cut out of the light, a pale one beside it, small flares, one glint low right
  add('flare', '#18161e', dot(0.44, 0.5), { tip: ['astroid', { soft: 0.14 }], size: 0.22, mode: 'normal', flow: 0.9 });
  add('flare', '#f6f5ff', dot(0.55, 0.36), { tip: ['astroid', { soft: 0.4 }], size: 0.13, mode: 'normal', flow: 0.85 });
  add('flare', '#ffffff', dot(0.55, 0.36), { size: 0.28, flow: 0.75 });
  add('flare', '#e7e6ff', dot(0.37, 0.29), { size: 0.09 });
  add('flare', '#dcdcff', dot(0.7, 1.0), { size: 0.36, tip: ['flare', { core: 0.08, thin: 0.012 }] });
  ops.push({ type: 'bloom', opts: { threshold: 0.32, radius: 0.04, strength: 0.75, tint: '#c8c6ff' } });
  return { name: 'starcloud', aspect: A, ground: ['#0b0b10', '#100f16'], ops };
}

export const SCENES = { nocturne, starcloud };

// Render a scene at width W. onProgress(fraction) is called between strokes; a renderer may yield there.
export async function render(scene, W, { onProgress, yieldEvery = 40, yieldFn } = {}) {
  const H = Math.round(W * scene.aspect), s = new Surface(W, H);
  if (scene.ground) s.fill(linear(scene.ground[0]), linear(scene.ground[1])); // ground null: a transparent layer (lettering)
  for (let i = 0; i < scene.ops.length; i++) {
    const op = scene.ops[i];
    // field and post ops: a lit cloud layer, bloom, a water reflection
    if (op.type === 'cloud') { renderCloud(s, op.cloud, { unit: W }); continue; }
    if (op.type === 'bloom') { bloom(s, op.opts); continue; }
    if (op.type === 'reflect') { reflect(s, op.opts); continue; }
    const brush = preset(op.b, op.over ?? {});
    const pts = op.pts.map((q) => ({ ...q, x: q.x * W, y: q.y * W }));
    if (op.live) { const st = liveStroke(s, brush, { unit: W, seed: op.seed, color: op.c ?? undefined }); for (const q of pts) st.add(q); } // a hand stroke replays as drawn
    else paintStroke(s, brush, pts, { unit: W, seed: op.seed, color: op.c ?? undefined });
    if ((i + 1) % yieldEvery === 0) { onProgress?.((i + 1) / scene.ops.length); if (yieldFn) await yieldFn(); }
  }
  // finishing grain, in canvas-width units like everything else (0.0029 of the width is 2.6 px on a 900 px canvas)
  const fg = scene.grain ?? { period: 0.0038, amount: 0.03 };
  if (fg) s.filmGrain({ period: fg.period * W, amount: fg.amount });
  onProgress?.(1);
  return s;
}
