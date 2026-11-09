// Sprayed: a word sprayed from a can, freehand along the strokes or through a cut stencil, onto a wall or paper.
// The spray is a droplet model, not a blur:
//   droplets   radii from a log-normal distribution (median 0.32 px, sigma 0.55), most fine, a few large near the core;
//   cone       the nozzle distance sets the cone: offsets are Gaussian with sigma = 0.36 x distance, plus a 14 percent
//              overspray halo at 2.6 sigma of finer drops, so a far can gives a wide, misty edge;
//   build-up   paint accumulates as volume; opacity is 1 - exp(-k V) (Beer-Lambert), so repeated passes darken and
//              saturate instead of adding linearly; the can spits a few large drops when it starts;
//   drips      where the volume pools past a threshold the paint runs down, a thinning trail ending in a bead;
//   substrate  fine drops catch on the high grain of the scanned wall (CC0 concrete, Poly Haven) and skip its pores;
//   stencil    a stencil cut from the letter with bridges across every counter (so the inside of an o is held), sprayed
//              in zigzag passes; drops that land on the card are lost, a few seep under its edge.
import { rng, image, canvas, parseColor, clamp, hash2 } from '../paint.mjs';
import { resample } from '../skeleton.mjs';

export const meta = {
  id: 'sprayed', title: 'Sprayed', renderer: '2d', ground: 'own', weight: 800,
  lineage: 'Aerosol lettering and the stencil (the cut bridges of military and shipping stencils); droplet size from atomiser spray studies, log-normal by convention.',
  does: 'Droplets from a can build the word pass by pass, with overspray, pooling drips, and an optional bridged stencil.',
  params: {
    stencil: 'true for a bridged stencil sprayed in zigzag passes, false (default) for freehand along the strokes',
    distance: 'nozzle distance in work px, 2 to 60 (default 1.5 x half stroke freehand, 2.6 x stencil)',
    passes: 'passes over the word, 1 to 4 (default 2)',
    rate: 'droplets per work px of travel, 20 to 600 (default 140)',
    drip: 'pooled volume (mean over 6 px above the paint edge) that starts a drip, 1.5 to 12 (default 3.2 freehand, 9 stencil)',
    paint: 'colour (default #141210)', substrate: '"wall" (default) or "paper"',
  },
};

// Log-normal droplet radius: median m, shape s, clamped to a physical range.
export function dropRadius(R, m = 0.32, s = 0.55) { const u = Math.max(1e-9, R()), v = R(); const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); return clamp(m * Math.exp(s * z), 0.08, 2.4); }
const gauss = R => { const u = Math.max(1e-9, R()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * R()); };

// Stencil opening: the letter with a bridge cut above and below every counter. Returns a Float32 mask.
export function stencilMask(g, width) {
  const m = Float32Array.from(g.mask), bw = Math.max(1.5, width);
  for (const loop of g.loops) {
    if (!loop.hole) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let i = 0; i < loop.pts.length; i += 2) { x0 = Math.min(x0, loop.pts[i]); x1 = Math.max(x1, loop.pts[i]); y0 = Math.min(y0, loop.pts[i + 1]); y1 = Math.max(y1, loop.pts[i + 1]); }
    const cx = (x0 + x1) / 2;
    for (const [ys, dir] of [[Math.floor(y0), -1], [Math.ceil(y1), 1]]) {
      for (let y = ys, run = 0; y >= 0 && y < g.h && run < g.half * 6; y += dir, run++) {
        let inside = false;
        for (let x = Math.floor(cx - bw / 2); x <= Math.ceil(cx + bw / 2); x++) { if (x < 0 || x >= g.w) continue; const i = y * g.w + x; if (g.mask[i] > 0.5) inside = true; const cover = clamp(Math.min(x + 1, cx + bw / 2) - Math.max(x, cx - bw / 2)); m[i] *= 1 - cover; }
        if (!inside && run > 2) break;
      }
    }
  }
  return m;
}

// The can's path: freehand follows the strokes; a stencil gets zigzag passes over the letters' box.
function canPath(g, o, sigma) {
  const out = [];
  if (!o.stencil) { for (const s of g.strokes) out.push(s.dot ? [s.pts[0] - 0.3, s.pts[1], s.pts[2] + 0.3, s.pts[3]] : resample(s.pts, 0.8)); return out; }
  const b = g.bbox, gap = sigma * 1.25, row = [];
  for (let y = b.y0 - gap * 0.5, k = 0; y <= b.y1 + gap; y += gap, k++) { const a = b.x0 - sigma * 2, c = b.x1 + sigma * 2; row.push(...(k % 2 ? [c, y, a, y] : [a, y, c, y])); }
  out.push(resample(row, 0.8)); return out;
}

export async function create(g, env) {
  const o = env.opts, k = env.k; let R = rng(env.seed); const sr = Math.min(1.5, Math.max(1, k)), W = Math.round(g.w * sr), H = Math.round(g.h * sr);
  const stencil = !!o.stencil, dist = o.distance ?? g.half * (stencil ? 2.6 : 1.5), sigma = dist * 0.36, passes = o.passes ?? 2, rate = o.rate ?? 140, dripAt = o.drip ?? (stencil ? 9 : 3.2);
  const open = stencil ? stencilMask(g, g.half * 0.42) : null;
  // substrate: albedo and a high-passed height, at the density resolution
  const sub = canvas(W, H), sx = sub.getContext('2d', { willReadFrequently: true });
  if ((o.substrate ?? 'wall') === 'wall') { const img = await image('concrete-wall.jpg'), s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.4; sx.filter = 'grayscale(.6) brightness(1.18) contrast(.95)'; sx.drawImage(img, -W * 0.1, -H * 0.2, img.naturalWidth * s, img.naturalHeight * s); sx.filter = 'none'; }
  else { sx.fillStyle = '#ece6d8'; sx.fillRect(0, 0, W, H); const id = sx.getImageData(0, 0, W, H); for (let i = 0; i < W * H; i++) { const v = (hash2(i % W, (i / W) | 0, 4) - 0.5) * 14; id.data[i * 4] += v; id.data[i * 4 + 1] += v; id.data[i * 4 + 2] += v; } sx.putImageData(id, 0, 0); }
  const alb = sx.getImageData(0, 0, W, H), A = alb.data, high = new Float32Array(W * H);
  { const l = new Float32Array(W * H); for (let i = 0; i < l.length; i++) l[i] = (A[i * 4] * 0.3 + A[i * 4 + 1] * 0.59 + A[i * 4 + 2] * 0.11) / 255; const r = 3; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let dy = -r; dy <= r; dy += 3) for (let dx = -r; dx <= r; dx += 3) { const xx = clamp(x + dx, 0, W - 1), yy = clamp(y + dy, 0, H - 1); s += l[yy * W + xx]; n++; } high[y * W + x] = clamp(0.5 + (l[y * W + x] - s / n) * 3); } }
  const V = new Float32Array(W * H), [pr, pg, pb] = parseColor(o.paint ?? '#141210'), out = new ImageData(new Uint8ClampedArray(A), W, H), O = out.data;
  const view = canvas(W, H), vx = view.getContext('2d'); vx.putImageData(out, 0, 0);
  let dirty = [W, H, 0, 0];
  const mark = (x, y, r) => { dirty[0] = Math.min(dirty[0], x - r); dirty[1] = Math.min(dirty[1], y - r); dirty[2] = Math.max(dirty[2], x + r); dirty[3] = Math.max(dirty[3], y + r); };
  // one droplet: volume pi r^2 spread over the pixels it covers; fine drops skip the substrate's pores
  function drop(x, y, r) {
    if (open) { const i = (clamp(y, 0, g.h - 1) | 0) * g.w + (clamp(x, 0, g.w - 1) | 0); if (open[i] < 0.5 && !(R() < 0.06 && neighbourOpen(x, y))) return; }
    const X = x * sr, Y = y * sr, rr = r * sr;
    if (rr < 0.75) { const xi = X | 0, yi = Y | 0; if (xi < 0 || yi < 0 || xi >= W || yi >= H) return; const i = yi * W + xi; if (rr < 0.4 && R() > 0.35 + 0.9 * high[i]) return; V[i] += Math.PI * rr * rr * 0.9; mark(xi, yi, 1); return; }
    const x0 = Math.max(0, Math.floor(X - rr)), x1 = Math.min(W - 1, Math.ceil(X + rr)), y0 = Math.max(0, Math.floor(Y - rr)), y1 = Math.min(H - 1, Math.ceil(Y + rr));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const d = Math.hypot(xx + 0.5 - X, yy + 0.5 - Y); if (d < rr + 0.5) V[yy * W + xx] += clamp(rr + 0.5 - d) * 1.1; }
    mark(X, Y, rr + 1);
  }
  const neighbourOpen = (x, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = clamp(x + dx, 0, g.w - 1) | 0, yy = clamp(y + dy, 0, g.h - 1) | 0; if (open[yy * g.w + xx] > 0.5) return true; } return false; };
  function sprayAt(x, y, n) {
    for (let j = 0; j < n; j++) { const halo = R() < 0.14, s = halo ? sigma * 2.6 : sigma, r = dropRadius(R, halo ? 0.2 : 0.32); drop(x + gauss(R) * s, y + gauss(R) * s, r); }
  }
  // Drips. After each pass, every column is scanned for the lower edge of the paint, and the paint pooled just above
  // that edge (the mean volume over the 6 px above it) decides everything: below the threshold, nothing runs (thin
  // strokes never drip); above it, the chance grows with the square of the excess, the run length with the excess
  // times a heavy-tailed factor, and the width with its root. About one drip in five stops short and beads. A drip
  // keeps clear of its neighbours by a few pixels, so the spacing follows the paint, not a grid.
  const drips = [], taken = new Uint8Array(W);
  function seedDrips() {
    const b = g.bbox, x0 = Math.max(0, Math.floor((b.x0 - sigma * 3) * sr)), x1 = Math.min(W - 1, Math.ceil((b.x1 + sigma * 3) * sr)), y0 = Math.max(6, Math.floor((b.y0 - sigma * 2) * sr)), y1 = Math.min(H - 3, Math.ceil((b.y1 + sigma * 3) * sr));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const v = V[y * W + x]; if (v < dripAt * 0.6 || V[(y + 2) * W + x] > v * 0.5) continue;
      let pool = 0; for (let k = 0; k < 6; k++) pool += V[(y - k) * W + x]; pool /= 6;
      const e = pool - dripAt; if (e <= 0 || R() > Math.min(0.5, 0.05 * e * e)) continue;
      const gap = Math.round((2 + R() * 3) * sr); let free = true; for (let q = Math.max(0, x - gap); q <= Math.min(W - 1, x + gap); q++) if (taken[q]) { free = false; break; }
      if (!free) continue;
      for (let q = Math.max(0, x - gap); q <= Math.min(W - 1, x + gap); q++) taken[q] = 1;
      const short = R() < 0.2, tail = 0.3 + 1.7 * R() * R();
      drips.push({ x, y, len: sr * (3 + 7 * e * tail) * (short ? 0.15 + R() * 0.2 : 1), run: 0, w: 0.45 + 0.32 * Math.sqrt(e) + R() * 0.3, speed: 26 * sr * (0.6 + 0.8 * R()), delay: R() * 0.6, bead: (short ? 1.3 + R() * 1.1 : 0.8 + R() * 0.9) * sr });
    }
  }
  function growDrips(dt) {
    let any = false;
    for (const d of drips) {
      if (d.run >= d.len) continue; any = true;
      if (d.delay > 0) { d.delay -= dt; continue; }
      const step = Math.min(d.len - d.run, dt * d.speed * Math.pow(1 - d.run / d.len, 0.6) + 0.05);
      for (let s = 0; s < step; s += 0.5) { const yy = Math.round(d.y + d.run + s), ww = d.w * (1 - (d.run + s) / d.len * 0.45) * sr; if (yy >= H) { d.run = d.len; break; } for (let xx = Math.floor(d.x - ww); xx <= Math.ceil(d.x + ww); xx++) if (xx >= 0 && xx < W) V[yy * W + xx] += 0.9; }
      d.run += step; mark(d.x, d.y + d.run, d.w * sr + 3);
      if (d.run >= d.len) { const yb = Math.min(H - 1, (d.y + d.len) | 0), r = d.bead; for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { const q = dx * dx + dy * dy * 1.3; if (q <= r * r) { const xx = d.x + dx, yy = yb + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) V[yy * W + xx] += 1.4 * (1 - q / (r * r + 1)); } } mark(d.x, yb, r + 2); }
    }
    return any;
  }
  // opacity = 1 - exp(-1.25 V), tabulated over V in [0, 16) at 1/256 steps (the curve is flat to 1e-7 past 16)
  const OPA = new Float32Array(4096); for (let i = 0; i < 4096; i++) OPA[i] = 1 - Math.exp(-1.25 * i / 256);
  function compose() {
    const x0 = Math.max(0, Math.floor(dirty[0])), y0 = Math.max(0, Math.floor(dirty[1])), x1 = Math.min(W - 1, Math.ceil(dirty[2])), y1 = Math.min(H - 1, Math.ceil(dirty[3]));
    if (x1 < x0 || y1 < y0) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x, a = OPA[Math.min(4095, (V[i] * 256) | 0)], j = i * 4; O[j] = A[j] + (pr - A[j]) * a; O[j + 1] = A[j + 1] + (pg - A[j + 1]) * a; O[j + 2] = A[j + 2] + (pb - A[j + 2]) * a; }
    vx.putImageData(out, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1); dirty = [W, H, 0, 0];
  }
  // the whole performance as a list of can positions; a pass is one walk over every path
  const paths = canPath(g, o, sigma), speed = (o.speed ?? 260) * (g.half / 8), track = [];
  for (let p = 0; p < passes; p++) for (const P of paths) { const off = p ? [(R() - 0.5) * sigma * 0.4, (R() - 0.5) * sigma * 0.4] : [0, 0]; for (let i = 0; i < P.length; i += 2) track.push(P[i] + off[0], P[i + 1] + off[1], i === 0 ? 1 : 0, p); }
  R = rng(env.seed + 1); // the spray itself always starts from the same state, first run or replay
  // a stencil takes light coats; the card stops the overspray
  const per = rate * 0.8 * (stencil ? 0.55 : 1); let at = 0, last = null, acc = 0, done = false;
  let lastPass = 0;
  function advance(n) {
    for (let s = 0; s < n && at < track.length; s += 4, at += 4) {
      const x = track[at], y = track[at + 1], fresh = track[at + 2], pass = track[at + 3];
      if (pass !== lastPass) { seedDrips(); lastPass = pass; }
      if (fresh) for (let j = 0; j < 5; j++) drop(x + gauss(R) * sigma * 0.5, y + gauss(R) * sigma * 0.5, 0.9 + R() * 1.3); // spit at the trigger
      sprayAt(x, y, Math.round(per * (pass ? 0.7 : 1)));
    }
    if (at >= track.length && lastPass >= 0) { seedDrips(); lastPass = -1; } // the last pass seeds once, at its end
  }
  const stepDots = () => Math.max(4, Math.round(speed / 60 / 0.8) * 4);
  return {
    droplets: () => track.length / 4 * per,
    draw(ctx, t) {
      if (!done) {
        const dt = last === null ? 1 / 60 : Math.min(0.1, Math.max(0, t - last)); last = t; acc += dt;
        let n = 0; while (acc >= 1 / 60 && n < 2) { advance(stepDots()); growDrips(1 / 60); acc -= 1 / 60; n++; }
        if (at >= track.length && !growDrips(0)) done = true;
        compose();
      }
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(view, 0, 0, g.w, g.h);
      return !done;
    },
    finish() { advance(Infinity); for (let i = 0; i < 600 && growDrips(1 / 30); i++); dirty = [0, 0, W, H]; compose(); done = true; },
    replay() { R = rng(env.seed + 1); V.fill(0); drips.length = 0; taken.fill(0); lastPass = 0; at = 0; last = null; acc = 0; done = false; dirty = [0, 0, W, H]; compose(); },
    volume: V,
  };
}
