// Night lights: a road network that grows until it spells the word, seen from orbit at night. Arterials run along the
// letters' centre lines; a street grid fills each letter's body at a district angle; lamps stand along every road.
// The network lights up the way a city grows along its main roads: the arterial first, in reading order, then the
// side streets behind it. Lamp colour follows a retrofit front: amber high-pressure sodium (near 589 nm) outside it,
// cool white LED (a blue emitter near 450 nm plus phosphor) inside. A thin county road and a few farms sit outside the
// word so the dark around it reads as land, not void.
import { rng, canvas, svgDoc, clamp, hash2 } from '../paint.mjs';
import { resample } from '../skeleton.mjs';

export const meta = {
  id: 'nightlights', title: 'Night lights', renderer: '2d', ground: 'own', weight: 800,
  lineage: 'City lights photographed from the ISS (NASA, public domain); sodium and LED street lighting spectra.',
  does: 'Roads grow along the strokes, streets fill the letters, lamps light in the order the city grows.',
  params: { pitch: 'street spacing, work px, 2 to 12 (default 0.5 x half stroke)', grow: 'seconds, 1.5 to 8 (default 3.2)', retrofit: 'radius of the LED front as a share of the frame width, 0 to 1 (default 0.28)' },
};

const SODIUM = [255, 166, 72], LED = [226, 236, 255];

// Lamps: { x, y, t (light-up time in [0,1]), cls (0 arterial, 1 street, 2 rural) }.
export function lamps(g, o = {}) {
  const R = rng(o.seed ?? 1), out = [], pitch = o.pitch ?? Math.max(2.2, g.half * 0.5), A = g.arc, ang = o.angle ?? -0.21;
  for (const s of g.strokes) { const P = resample(s.pts, pitch * 0.7); for (let i = 0; i < P.length; i += 2) { const j = (Math.round(P[i + 1]) * g.w + Math.round(P[i])); out.push({ x: P[i], y: P[i + 1], t: A.arc[j] ?? 0, cls: 0 }); } }
  // the street grid: two families of lines at the district angle, lamps where they fall inside a letter
  const ca = Math.cos(ang), sa = Math.sin(ang), span = Math.hypot(g.w, g.h);
  for (let fam = 0; fam < 2; fam++) for (let a = -span; a < span; a += pitch * (fam ? 1.3 : 1)) for (let b = -span; b < span; b += pitch * 0.62) {
    const u = fam ? a : b, v = fam ? b : a, x = g.w / 2 + u * ca - v * sa, y = g.h / 2 + u * sa + v * ca;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
    const i = (y | 0) * g.w + (x | 0); if (g.sdf[i] < 0.6) continue;
    out.push({ x: x + (R() - 0.5) * 0.4, y: y + (R() - 0.5) * 0.4, t: A.arc[i] + 0.05 + A.dist[i] / (g.half * 14), cls: 1 });
  }
  // a county road under the word and scattered farms, dim, so the land has a floor
  const base = g.bbox.y1 + g.half * 1.4;
  for (let x = 0; x < g.w; x += pitch * 2.4) { const y = base + Math.sin(x / (g.half * 9)) * g.half * 0.8; if (y < g.h - 1 && R() < 0.8) out.push({ x, y, t: x / g.w, cls: 2 }); }
  for (let k = 0; k < Math.round(g.w * g.h / (pitch * pitch * 260)); k++) { const x = R() * g.w, y = R() * g.h; if (g.sdf[(y | 0) * g.w + (x | 0)] < -g.half * 2) out.push({ x, y, t: R(), cls: 2 }); }
  return out;
}

export function lampColor(l, g, retrofit) {
  const d = Math.hypot(l.x - g.w * 0.62, l.y - g.h * 0.5) / g.w, m = clamp((retrofit - d) / 0.05 + 0.5);
  return SODIUM.map((c, i) => Math.round(c + (LED[i] - c) * m));
}

function sprite(rgb, r, soft) {
  const s = Math.max(2, Math.ceil(r * 2)), c = canvas(s, s), x = c.getContext('2d'), grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, `rgba(${rgb},${soft ? 0.07 : 0.95})`); grd.addColorStop(soft ? 0.3 : 0.3, `rgba(${rgb},${soft ? 0.025 : 0.4})`); grd.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = grd; x.fillRect(0, 0, s, s); return c;
}

export async function create(g, env) {
  const o = env.opts, L = lamps(g, { seed: env.seed, pitch: o.pitch }), grow = o.grow ?? 3.2, retrofit = o.retrofit ?? 0.28, k = env.k;
  L.sort((a, b) => a.t - b.t);
  const r = Math.max(1, g.half * 0.16) * k, cols = L.map(l => lampColor(l, g, retrofit));
  // sprites cached per colour bucket (8 steps between sodium and LED) and class
  const cache = new Map(), spr = (rgb, cls, soft) => { const key = rgb.map(v => v >> 4).join() + cls + soft; if (!cache.has(key)) cache.set(key, sprite(rgb.join(','), r * (cls === 2 ? 0.7 : cls === 0 ? 1.25 : 1) * (soft ? 3.2 : 1), soft)); return cache.get(key); };
  const W = g.w * k, H = g.h * k, ground = canvas(W, H), gx = ground.getContext('2d');
  gx.fillStyle = '#04050a'; gx.fillRect(0, 0, W, H);
  const id = gx.getImageData(0, 0, W, H), d = id.data;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const v = hash2(x >> 3, y >> 3, 9) * 6 + hash2(x, y, 3) * 3; for (let dy = 0; dy < 2 && y + dy < H; dy++) for (let dx = 0; dx < 2 && x + dx < W; dx++) { const j = ((y + dy) * W + x + dx) * 4; d[j] += v * 0.4; d[j + 1] += v * 0.5; d[j + 2] += v; } }
  gx.putImageData(id, 0, 0);
  const lit = canvas(W, H), lx = lit.getContext('2d'); lx.globalCompositeOperation = 'lighter';
  let n = 0, done = false;
  const lightTo = upto => { for (; n < L.length && L[n].t * grow <= upto; n++) { const l = L[n], a = l.cls === 2 ? 0.45 : 1; lx.globalAlpha = a; const s = spr(cols[n], l.cls, false), h2 = spr(cols[n], l.cls, true); lx.drawImage(h2, l.x * k - h2.width / 2, l.y * k - h2.height / 2); lx.drawImage(s, l.x * k - s.width / 2, l.y * k - s.height / 2); } lx.globalAlpha = 1; };
  return {
    lamps: L.length,
    draw(ctx, t) {
      lightTo(done ? Infinity : t - 0.3);
      ctx.drawImage(ground, 0, 0, g.w, g.h); ctx.drawImage(lit, 0, 0, g.w, g.h);
      return n < L.length;
    },
    finish() { done = true; },
    replay() { done = false; n = 0; lx.clearRect(0, 0, W, H); },
    svg() { return svgDoc(g, L.map((l, i) => `<circle cx="${l.x.toFixed(1)}" cy="${l.y.toFixed(1)}" r="${(r / k * (l.cls === 0 ? 0.6 : 0.45)).toFixed(2)}" fill="rgb(${cols[i]})"${l.cls === 2 ? ' opacity=".45"' : ''}/>`).join(''), { ground: '#04050a' }); },
  };
}
