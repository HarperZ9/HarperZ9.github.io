// Torn: every letter is torn out of an archival sheet and laid over a second sheet. The tear keeps its direction:
// along the edges that face the pull (up and to the left) the paper's white fibre core shows as a fringe, the way a
// real tear bevels toward the hand; the other edges are clean. Counters (the hole of an o) are torn too.
// Tear paths come from techniques/lib/tear.js, so a letter's edge and a collage's edge are the same material.
import { tearPath, fringePath } from '../../../techniques/lib/tear.js';
import { image, canvas, rng, svgDoc, polyD } from '../paint.mjs';

export const meta = {
  id: 'torn', title: 'Torn', renderer: '2d', ground: 'own', weight: 800,
  lineage: 'Papier colle (Braque and Picasso, 1912); Hannah Hoch\'s photomontage; Rotella\'s decollage.',
  does: 'Letters torn from a 1900 census map, fibre fringe on the pulled side, over a 1913 catalogue page.',
  params: { top: 'image the letters are torn from (default district-map.jpg)', under: 'second layer (default edison-catalog.jpg)', amp: 'tear depth, 0.16 x half stroke', fringe: 'fibre width, 0.22 x half stroke', pull: 'tear direction, unit vector (default up and left)' },
};

// Simplify a loop to vertices about `step` apart, so each edge can carry its own tear.
function coarse(pts, step) { const o = [pts[0], pts[1]]; let acc = 0; for (let i = 2; i < pts.length; i += 2) { acc += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); if (acc >= step) { o.push(pts[i], pts[i + 1]); acc = 0; } } return o; }

// Tear one loop. Returns { inner, outer } point lists; outer carries the fringe on edges whose outward normal faces the pull.
export function tearLoop(loop, seed, o) {
  const P = coarse(loop.pts, o.step), n = P.length / 2, inner = [], outer = [], [px, py] = o.pull;
  for (let i = 0; i < n; i++) {
    const a = [P[2 * i], P[2 * i + 1]], b = [P[2 * ((i + 1) % n)], P[2 * ((i + 1) % n) + 1]];
    const t = tearPath(a, b, seed + i * 7, { amp: o.amp, freq: 0.09, res: 1.6 });
    // contours keep the paper on the left of every loop (holes included), so away-from-paper is the right-hand
    // normal, which is also tearPath's normal: the fringe is pushed along +normal
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1, nx = -ey / l, ny = ex / l;
    const faces = nx * px + ny * py > 0.15;
    const f = faces ? fringePath(t, 1, seed + i, { width: o.fringe }) : t.pts;
    for (let k = 0; k < t.pts.length - 1; k++) { inner.push(t.pts[k][0], t.pts[k][1]); outer.push(f[k][0], f[k][1]); }
  }
  return { inner, outer, hole: loop.hole };
}

const ring = (x, p) => { x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); };

export async function create(g, env) {
  const [top, under] = await Promise.all([image(env.opts.top ?? 'district-map.jpg'), image(env.opts.under ?? 'edison-catalog.jpg')]);
  const R = rng(env.seed), amp = Math.max(0.8, g.half * 0.16), opt = { step: Math.max(6, g.half * 1.3), amp, fringe: Math.max(1, g.half * 0.22), pull: [-0.55, -0.83] };
  const pieces = g.loops.filter(l => Math.abs(l.area) > 4).map((l, i) => tearLoop(l, env.seed + i * 31, opt));
  const k = env.k, W = g.w, H = g.h, sh = Math.max(2, g.half * 0.5);
  // bake once: the under sheet, then the torn word (shadow, fringe, printed face, grain), then a light vignette
  const plate = canvas(W * k, H * k), x = plate.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0);
  const cover = (img, sx, sy, zoom) => { const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom, w = img.naturalWidth * s, h = img.naturalHeight * s; x.drawImage(img, -sx * (w - W), -sy * (h - H), w, h); };
  x.fillStyle = '#d9d0bd'; x.fillRect(0, 0, W, H);
  // the under sheet sits back: softened a little and darkened, so a small torn word still separates from its print
  x.save(); x.filter = `grayscale(1) contrast(1.05) brightness(.8) blur(${Math.max(0.6, g.half * 0.08).toFixed(2)}px)`; cover(under, R(), R() * 0.6, 1.25); x.restore();
  x.fillStyle = 'rgba(20,16,12,.56)'; x.fillRect(0, 0, W, H);
  const path = key => { x.beginPath(); for (const p of pieces) ring(x, p[key]); };
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = sh * 1.6 * k; x.shadowOffsetX = sh * 0.5 * k; x.shadowOffsetY = sh * 0.9 * k;
  x.fillStyle = '#f4efe2'; path('outer'); x.fill('evenodd'); x.restore();
  x.fillStyle = '#f7f3ea'; path('outer'); x.fill('evenodd');
  x.save(); path('inner'); x.clip('evenodd');
  x.filter = 'sepia(.35) contrast(1.1)'; cover(top, 0.35 + R() * 0.3, 0.4, 2.2); x.filter = 'none';
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(210,190,150,.35)'; x.fillRect(0, 0, W, H);
  x.restore();
  return {
    pieces: pieces.length,
    draw(ctx) { ctx.drawImage(plate, 0, 0, W, H); return false; },
    finish() {}, replay() {},
    svg() {
      const outer = pieces.map(p => polyD(p.outer, true)).join(''), inner = pieces.map(p => polyD(p.inner, true)).join('');
      return svgDoc(g, `<path d="${outer}" fill="#f7f3ea" fill-rule="evenodd"/><path d="${inner}" fill="#cdbf9f" fill-rule="evenodd"/>`, { ground: '#3a3530' });
    },
  };
}
