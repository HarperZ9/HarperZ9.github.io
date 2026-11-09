// lib/rope.js: the stepwise rope as an easing curve, and a plate that pulls Muybridge's frames through a gate.
// Hand over hand: each pull moves the load, then the hand lets go to reach again and the rope slips back a little
// before the next grip catches it. Played forward it lifts; the same curve mirrored lowers. One shape, two hands.
import { clamp, smoothstep } from './util.js';

const inOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const outQuad = u => 1 - (1 - u) * (1 - u);

// ropeEase(t, { pulls, slip, reach }): t in [0,1] to progress. reach is the share of each pull spent re-gripping.
// slip is the back-slip per re-grip as a share of one pull. The final pull is tied off: it never slips.
export function ropeEase(t, o = {}) {
  const pulls = Math.max(1, o.pulls ?? 4), slip = o.slip ?? 0.18, reach = clamp(o.reach ?? 0.32, 0.01, 0.9);
  const lower = o.direction === 'lower';
  t = clamp(t);
  if (lower) return 1 - ropeEase(t, { ...o, direction: 'lift' });
  if (t >= 1) return 1;
  const seg = Math.min(pulls - 1, Math.floor(t * pulls)), u = t * pulls - seg, step = 1 / pulls;
  const s = seg === pulls - 1 ? 0 : slip * step, base = seg * step;
  if (u < 1 - reach) return base + (step + s) * inOut(u / (1 - reach));
  return base + step + s - s * outQuad((u - (1 - reach)) / reach);
}

// Which pull a time falls in, and whether the hand is pulling or re-gripping.
export function ropePhase(t, o = {}) {
  const pulls = Math.max(1, o.pulls ?? 4), reach = o.reach ?? 0.32;
  const seg = Math.min(pulls - 1, Math.floor(clamp(t) * pulls)), u = clamp(t) * pulls - seg;
  return { pull: seg, gripping: u >= 1 - reach };
}

// Draw a laid three-strand rope along a polyline. Each strand is a sine offset with a phase of a third turn,
// shaded light on the crest and dark in the lay, so the twist reads at any scale.
export function drawRope(ctx, pts, o = {}) {
  const r = o.radius ?? 5, lay = o.lay ?? r * 2.6, ink = o.ink ?? '#1b1712', hi = o.highlight ?? '#d8c9a8';
  if (pts.length < 2) return;
  const segs = []; let len = 0;
  for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy); segs.push([l, dx / (l || 1), dy / (l || 1)]); len += l; }
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = ink; ctx.lineWidth = r * 2.2; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  const step = Math.max(1.5, r * 0.5);
  for (let k = 0; k < 3; k++) {
    let d = 0, si = 0, acc = 0;
    for (; d < len; d += step) {
      while (si < segs.length - 1 && acc + segs[si][0] < d) { acc += segs[si][0]; si++; }
      const [l, ux, uy] = segs[si], f = (d - acc) / (l || 1), p = pts[si];
      const x = p[0] + ux * l * f, y = p[1] + uy * l * f, ph = (d / lay) * Math.PI * 2 + (k * Math.PI * 2) / 3;
      const off = Math.sin(ph) * r * 0.55, crest = Math.cos(ph);
      if (crest < 0) continue;
      ctx.fillStyle = hi; ctx.globalAlpha = 0.25 + 0.6 * crest;
      ctx.beginPath(); ctx.ellipse(x - uy * off, y + ux * off, r * 0.62, r * 0.32, Math.atan2(uy, ux) + 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// Muybridge's 1878 sheet: 4 x 3 frames. Frame 12 is the standing mare, outside the stride, so the plate uses 1 to 11.
export const MUYBRIDGE_GRID = { cols: [[25, 385], [400, 758], [773, 1131], [1147, 1506]], rows: [[32, 262], [275, 505], [518, 748]], sheet: [1536, 952] };
export function muybridgeFrames(img, count = 11) {
  const g = MUYBRIDGE_GRID, sx = img.naturalWidth / g.sheet[0], sy = img.naturalHeight / g.sheet[1], out = [];
  for (let i = 0; i < count; i++) { const c = g.cols[i % 4], r = g.rows[(i / 4) | 0]; out.push([c[0] * sx, r[0] * sy, (c[1] - c[0]) * sx, (r[1] - r[0]) * sy]); }
  return out;
}

// The plate: a gate shows the current frame; the strip is hauled through it by a rope whose motion is ropeEase.
export function create(cv, assets, opts = {}) {
  const img = assets.horse, frames = muybridgeFrames(img), N = frames.length, x = cv.getContext('2d');
  const state = { direction: 'lift', start: 0, period: 9, still: opts.reduced };
  const ease = t => ropeEase(t, { pulls: N - 1, slip: 0.22, reach: 0.34, direction: state.direction });
  // the frames are cut and graded once (greyscale, a little contrast) so a frame costs plain blits, not filters
  const strip = frames.map(f => { const c = document.createElement('canvas'); c.width = Math.round(f[2]); c.height = Math.round(f[3]); const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.15)'; g.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, c.width, c.height); return c; });
  function drawFrame(i, dx, dy, dw, dh, alpha = 1) {
    x.globalAlpha = alpha; x.drawImage(strip[clamp(i, 0, N - 1)], dx, dy, dw, dh); x.globalAlpha = 1;
  }
  function draw(time) {
    const W = cv.width, H = cv.height, ink = opts.ink || '#15130f', paper = opts.paper || '#efe9dc';
    const t = state.still ? (state.manual ?? 0.62) : ((time - state.start) / state.period) % 1;
    const p = ease(t) * (N - 1);
    x.fillStyle = paper; x.fillRect(0, 0, W, H);
    const gh = H * 0.5, gw = gh * (frames[0][2] / frames[0][3]), gx = (W - gw) / 2, gy = H * 0.07;
    // the strip: every frame laid out at its distance from the gate, so the stride reads as a sequence
    x.save();
    for (let i = 0; i < N; i++) { const off = (i - p) * (gw * 1.06); if (Math.abs(off) > W) continue; drawFrame(i, gx + off, gy, gw, gh, 1 - 0.72 * Math.min(1, Math.abs(off) / gw)); }
    x.restore();
    // the gate: a heavy brutalist frame with the sprocket ladder cut into it
    x.fillStyle = ink; const b = Math.max(6, gh * 0.045);
    x.fillRect(0, gy - b * 2.2, gx - b, gh + b * 4.4); x.fillRect(gx + gw + b, gy - b * 2.2, W - gx - gw - b, gh + b * 4.4);
    x.fillRect(gx - b, gy - b * 2.2, gw + 2 * b, b * 1.2); x.fillRect(gx - b, gy + gh + b, gw + 2 * b, b * 1.2);
    x.fillStyle = paper; for (let s = gy + b; s < gy + gh - b; s += b * 2.4) { x.fillRect(gx - b * 3.2, s, b * 1.3, b * 1.1); x.fillRect(gx + gw + b * 1.9, s, b * 1.3, b * 1.1); }
    drawCurve(t, W, H, ink, paper);
    return !state.still;
  }
  function drawCurve(t, W, H, ink, paper) {
    const cx = W * 0.07, cw = W * 0.86, cy = H * 0.93, ch = H * 0.24, pts = [];
    for (let i = 0; i <= 240; i++) { const u = i / 240; pts.push([cx + u * cw, cy - ease(u) * ch]); }
    // rungs: one per frame, the level each pull must reach
    x.strokeStyle = ink; x.lineWidth = 1; x.globalAlpha = 0.16;
    for (let k = 0; k < N; k++) { const yy = cy - (k / (N - 1)) * ch; x.beginPath(); x.moveTo(cx, yy); x.lineTo(cx + cw, yy); x.stroke(); }
    x.globalAlpha = 0.3; x.lineWidth = 1.5; x.setLineDash([3, 5]); x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    const k = Math.max(2, Math.round(t * 240));
    drawRope(x, pts.slice(0, k + 1), { radius: Math.max(3, H * 0.011), ink, highlight: paper });
    const hp = pts[Math.min(k, 240)]; x.fillStyle = ink; x.beginPath(); x.arc(hp[0], hp[1], Math.max(5, H * 0.016), 0, Math.PI * 2); x.fill();
    x.font = `500 ${Math.max(11, H * 0.026)}px Conso, monospace`; x.fillStyle = ink; x.globalAlpha = 0.7;
    x.fillText(`frame ${String(Math.min(N, Math.round(ease(t) * (N - 1)) + 1)).padStart(2, '0')} of ${N}`, cx, cy - ch - H * 0.02); x.globalAlpha = 1;
  }
  return {
    draw, get animated() { return !state.still; },
    setDirection(d, now) { state.direction = d; state.start = now; },
    setStill(v, at) { state.still = v; state.manual = at; },
    label: 'rope',
  };
}
