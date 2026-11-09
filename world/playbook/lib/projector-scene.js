// lib/projector-scene.js: scene builders for projector.js. The worked scene is the 1916 New York setback law as
// massing: each lot's envelope comes from techniques/lib/zoning.js (envelope, profile), stacked as boxes, so the
// law itself draws the block. Units are 10 ft. Faces carry a fill from a fixed world light, so a face keeps its tone
// under every camera.
import { profile } from '../../techniques/lib/zoning.js';
import { mixOk, hash01 } from './util.js';

const L = (() => { const v = [-0.45, -0.75, 1]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
const tone = (n, ground, ink, lo = 0.035, span = 0.4) => mixOk(ground, ink, lo + span * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]));

// A box band from z0 to z1 with half-width a about (cx, cy), and the ring on its top that the next band leaves bare.
export function band(cx, cy, a, z0, z1, next, o) {
  const { ground, ink, edge, step = 0, w = 1, aspect = 1 } = o, out = [], c = (x, y, z) => [cx + x * aspect, cy + y, z]; // aspect stretches x: a long lot
  const sides = [[[-a, -a], [a, -a], [0, -1]], [[a, -a], [a, a], [1, 0]], [[a, a], [-a, a], [0, 1]], [[-a, a], [-a, -a], [-1, 0]]];
  for (const [p, q, nn] of sides) out.push({ type: 'face', step, base: z0, pts: [c(p[0], p[1], z0), c(q[0], q[1], z0), c(q[0], q[1], z1), c(p[0], p[1], z1)], fill: tone([nn[0], nn[1], 0], ground, ink), stroke: edge, w });
  const top = tone([0, 0, 1], ground, ink);
  if (next > 0 && next < a) {
    const b = next; // four trapezoids, so their centroids sit outside the band above (painter's order stays right)
    for (const [p, q, r, s] of [[[-a, -a], [a, -a], [b, -b], [-b, -b]], [[a, -a], [a, a], [b, b], [b, -b]], [[a, a], [-a, a], [-b, b], [b, b]], [[-a, a], [-a, -a], [-b, -b], [-b, b]]])
      out.push({ type: 'face', step, base: z0, pts: [c(...p, z1), c(...q, z1), c(...r, z1), c(...s, z1)], fill: top, stroke: edge, w, bias: -0.001 });
  } else if (!next) out.push({ type: 'face', step, base: z0, pts: [c(-a, -a, z1), c(a, -a, z1), c(a, a, z1), c(-a, a, z1)], fill: top, stroke: edge, w });
  return out;
}

// One lot's envelope under the law: lot half-width, street width, multiple, ratio, step, tower share, height.
export function setbackLot(cx, cy, law, top, o) {
  const p = profile(law, top), bands = [];
  for (let i = 0; i < p.length - 1; i++) if (p[i + 1][0] > p[i][0] + 1e-6 && p[i][1] === p[i + 1][1]) bands.push([p[i][0], p[i + 1][0], p[i][1]]);
  const wall = law.street * law.multiple, items = [];
  bands.forEach(([z0, z1, a], i) => {
    const next = bands[i + 1] ? bands[i + 1][2] : 0, tower = !next && a < law.lot * 0.75;
    const step = typeof o.step === 'function' ? o.step(z0, wall, tower) : o.step;
    items.push(...band(cx, cy, a, z0, z1, next, { ...o, step, edge: tower && o.hot ? o.hot : o.edge, w: tower && o.hot ? 1.75 : 1.25 })); // 1.25 px: an edge that lands on a device-pixel boundary still ramps (R3)
    if (tower && o.hot) items.at(-1).tower = true;
  });
  return items;
}

// The worked block: a row of lots on one street, a second row behind, the whole set repeated for the scale journey.
export function setbackCity({ ground = '#141412', ink = '#eee9df', edge = '#6f6a61', hot = '#e0177e', blocks = 3, seed = 7 } = {}) {
  const items = [], law = { lot: 1.5, street: 6, multiple: 1.5, ratio: 3, step: 1.1, towerShare: 0.25 };
  const stepOf = (z0, wall, tower) => (tower ? 3 : z0 < wall - 1e-6 ? 1 : 2);
  for (let bx = -blocks; bx <= blocks; bx++) for (let by = -blocks; by <= blocks; by++) {
    const home = bx === 0 && by === 0, ox = bx * 16, oy = by * 16;
    if (home) { // one assembled lot, 120 x 60 ft: wide enough for the law to cut a full wedding cake
      const big = { ...law, lot: 3, step: 0.62 };
      items.push(...setbackLot(0, 3, big, 24, { ground, ink, edge, hot, step: stepOf, aspect: 2 }));
      const q = [[-6, 0, 0], [6, 0, 0], [6, 6, 0], [-6, 6, 0]];
      for (let e = 0; e < 4; e++) items.push({ type: 'line', a: q[e], b: q[(e + 1) % 4], color: hot, w: 1.5, step: 0, bias: -1e5 + 1 });
    } else for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const cx = ox - 4.5 + i * 3, cy = oy + 1.5 + j * 3, k = (bx + 9) * 131 + (by + 9) * 17 + i * 3 + j;
      if (hash01(seed, k) < 0.22) continue; // some lots stay empty: the city is not a pattern fill
      const top = 13 + 14 * hash01(seed, k + 999) ** 1.6;
      items.push(...setbackLot(cx, cy, law, top, { ground, ink, edge: null, step: 5 })); // far lots carry tone, not outline
    }
    // street and lot lines on the ground
    items.push({ type: 'face', pts: [[ox - 7, oy - 6.5, 0], [ox + 7, oy - 6.5, 0], [ox + 7, oy + 7, 0], [ox - 7, oy + 7, 0]], fill: mixOk(ground, ink, home ? 0.045 : 0.025), step: 0, bias: -1e6, fade: true });
    for (let i = 0; i <= 4; i++) items.push({ type: 'line', a: [ox - 6 + i * 3, oy, 0], b: [ox - 6 + i * 3, oy + 6, 0], color: edge, w: 1, alpha: home ? 1 : 0.5, step: 0, bias: -1e5, fade: true });
    items.push({ type: 'line', a: [ox - 7, oy - 6, 0], b: [ox + 7, oy - 6, 0], color: edge, w: 1, alpha: home ? 1 : 0.5, dash: '3 5', step: 0, bias: -1e5, fade: true });
  }
  const C = { color: ink, size: 13, minZoom: 9 };
  items.push({ type: 'label', id: 'street', text: 'STREET 60 FT', p: [-6, -3, 0], step: 0, priority: 1, ...C });
  items.push({ type: 'label', id: 'lot', text: 'LOT 120 X 60 FT', p: [4.5, 4.5, 0], step: 0, priority: 1, ...C });
  items.push({ type: 'label', id: 'wall', text: 'WALL 1.5 X STREET', p: [-4, 0, 9], step: 1, priority: 3, ...C });
  items.push({ type: 'label', id: 'plane', text: 'BACK 1 FOR EVERY 3 UP', p: [4.4, 0.62, 10.6], step: 2, priority: 2, ...C });
  items.push({ type: 'label', id: 'tower', text: 'TOWER 1/4 OF THE LOT', p: [0, 1.5, 21], step: 3, priority: 4, color: hot, size: 13 });
  return { items, law };
}
