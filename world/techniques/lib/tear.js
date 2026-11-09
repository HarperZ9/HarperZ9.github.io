// lib/tear.js: archival scans cut by procedural tears, with the paper's white core showing on the pulled side.
// A torn sheet has a direction. The piece pulled up toward you shows a bevel of white fibre along its edge, the
// piece pulled away does not. The tear path is fractal noise along the edge; the fringe is a second, softer path.
import { fbm, rng, clamp } from './util.js';

// tearPath(a, b, seed, o): a polyline from a to b, displaced along its normal. Endpoints stay fixed.
// Returns { pts: [[x,y],...], normal: [nx,ny] }. Displacement is bounded by o.amp.
export function tearPath(a, b, seed = 1, o = {}) {
  const amp = o.amp ?? 10, freq = o.freq ?? 0.035, res = o.res ?? 2.5;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const n = Math.max(2, Math.ceil(len / res)), pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, env = Math.min(1, Math.sin(Math.PI * s) * 4);
    const coarse = fbm(s * len * freq, seed * 7.1, seed, 5) - 0.5, fine = fbm(s * len * freq * 9, seed * 3.3, seed + 99, 2) - 0.5;
    const d = clamp((coarse * 2.1 + fine * 0.22) * amp * env, -amp, amp);
    pts.push([a[0] + dx * s + nx * d, a[1] + dy * s + ny * d]);
  }
  return { pts, normal: [nx, ny] };
}

// The fringe: the white core, pushed outward from the tear by a varying width. side = +1 or -1 picks the normal.
export function fringePath(tear, side = 1, seed = 1, o = {}) {
  const wmax = o.width ?? 4, [nx, ny] = tear.normal, n = tear.pts.length;
  return tear.pts.map(([x, y], i) => {
    const s = i / (n - 1), env = Math.min(1, Math.sin(Math.PI * s) * 6);
    const w = wmax * env * (0.25 + 0.75 * fbm(i * 0.09, seed, seed + 5, 3));
    return [x + nx * w * side, y + ny * w * side];
  });
}

// A piece: a rectangle whose sides are cut (straight) or torn. Returns { inner, outer } polygons.
// inner is the printed area; outer adds the fringe on torn sides pulled toward the viewer.
export function piece(rect, sides, seed = 1, o = {}) {
  const [x, y, w, h] = rect, c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], inner = [], outer = [];
  ['top', 'right', 'bottom', 'left'].forEach((name, k) => {
    const a = c[k], b = c[(k + 1) % 4], kind = sides[name] || 'cut';
    if (kind === 'cut') { inner.push(a); outer.push(a); return; }
    const t = tearPath(a, b, seed + k * 13, o), out = o.side ?? -1; // corners run clockwise on screen, so -normal points outward
    inner.push(...t.pts.slice(0, -1));
    outer.push(...(kind === 'pulled' ? fringePath(t, out, seed + k, o) : t.pts).slice(0, -1));
  });
  return { inner, outer };
}

const ring = (ctx, poly) => { poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
const path = (ctx, poly) => { ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };

let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'), d = x.createImageData(192, 192), R = rng(5);
  for (let i = 0; i < 192 * 192; i++) { const v = 200 + 55 * fbm((i % 192) / 6, ((i / 192) | 0) / 1.5, 2, 3) + R() * 18; d.data.set([v, v * 0.97, v * 0.9, 255], i * 4); }
  x.putImageData(d, 0, 0); return (grainTile = c);
}

// Draw one layer: shadow, fringe, then the image clipped to the printed area, then a grain multiply.
export function drawPiece(ctx, p, img, crop, dest, o = {}) {
  const depth = o.depth ?? 1;
  ctx.save(); ctx.shadowColor = 'rgba(10,8,5,.42)'; ctx.shadowBlur = 6 + depth * 9; ctx.shadowOffsetX = depth * 4; ctx.shadowOffsetY = depth * 7;
  ctx.fillStyle = '#f3eee2'; path(ctx, p.outer); ctx.fill(); ctx.restore();
  ctx.save(); path(ctx, p.inner); ctx.clip();
  ctx.drawImage(img, crop[0], crop[1], crop[2], crop[3], dest[0], dest[1], dest[2], dest[3]);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.createPattern(grain(), 'repeat'); ctx.fillRect(dest[0], dest[1], dest[2], dest[3]);
  ctx.restore();
}

// The plate: "the record and the body". A 1900 census district map is torn open onto the Hubble Deep Field;
// a fingerprint card and an anatomical engraving are laid over it. Pointer movement gives depth by parallax.
export function create(cv, assets, opts = {}) {
  const x = cv.getContext('2d'), st = { px: 0, py: 0, tx: 0, ty: 0 };
  const A = assets, built = { key: '' };
  function layout(W, H) {
    const u = Math.min(W, H), s = Math.max(W, H) / 1000;
    return {
      hole: piece([W * 0.1, H * 0.2, W * 0.4, H * 0.52], { top: 'pulled', right: 'pulled', bottom: 'pulled', left: 'pulled' }, 3, { amp: u * 0.04, width: u * 0.016, side: 1 }),
      card: piece([W * 0.46, H * 0.08, W * 0.4, H * 0.42], { top: 'cut', right: 'torn', bottom: 'pulled', left: 'cut' }, 7, { amp: u * 0.02, width: u * 0.008 }),
      bone: piece([W * 0.6, H * 0.4, W * 0.3, H * 0.56], { top: 'pulled', right: 'cut', bottom: 'cut', left: 'pulled' }, 11, { amp: u * 0.025, width: u * 0.009 }),
      s,
    };
  }
  // Each layer is composed once per size into its own canvas (shadows, clips and grain are the slow part);
  // a frame is then four offset blits. Measured before caching: 49 ms a frame; see PERF.md.
  function bake(W, H, L) {
    const mkL = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const sky = mkL(), map = mkL(), card = mkL(), bone = mkL();
    sky.getContext('2d').drawImage(A.deep, 0, 0, A.deep.naturalWidth, A.deep.naturalHeight, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
    const m = map.getContext('2d');
    // the map with a torn hole. hole.outer is the opening (fringe pushed inward), hole.inner the printed edge.
    m.save(); m.shadowColor = 'rgba(0,0,0,.65)'; m.shadowBlur = 22; m.shadowOffsetX = 5; m.shadowOffsetY = 9;
    m.fillStyle = '#efe8d8'; m.beginPath(); m.rect(0, 0, W, H); ring(m, L.hole.outer); m.fill('evenodd'); m.restore();
    m.save(); m.beginPath(); m.rect(0, 0, W, H); ring(m, L.hole.inner); m.clip('evenodd');
    m.drawImage(A.map, A.map.naturalWidth * 0.06, A.map.naturalHeight * 0.08, A.map.naturalWidth * 0.86, A.map.naturalHeight * 0.84, 0, 0, W, H);
    m.globalCompositeOperation = 'multiply'; m.globalAlpha = 0.3; m.fillStyle = m.createPattern(grain(), 'repeat'); m.fillRect(0, 0, W, H);
    m.restore();
    const c = card.getContext('2d'), C = A.card; c.translate(W / 2, H / 2); c.rotate(-0.025); c.translate(-W / 2, -H / 2);
    drawPiece(c, L.card, C, [0, 0, C.naturalWidth, C.naturalHeight * 0.62], [W * 0.44, H * 0.06, W * 0.44, H * 0.48], { depth: 1.5 });
    const b = bone.getContext('2d'), B = A.bone; b.translate(W / 2, H / 2); b.rotate(0.03); b.translate(-W / 2, -H / 2);
    drawPiece(b, L.bone, B, [B.naturalWidth * 0.12, B.naturalHeight * 0.1, B.naturalWidth * 0.76, B.naturalHeight * 0.62], [W * 0.58, H * 0.38, W * 0.34, H * 0.6], { depth: 2.6 });
    return [[sky, -1], [map, 0], [card, 1.5], [bone, 2.6]];
  }
  function draw() {
    const W = cv.width, H = cv.height, key = W + 'x' + H;
    if (built.key !== key) { built.L = layout(W, H); built.layers = bake(W, H, built.L); built.key = key; }
    const k = Math.min(W, H) * 0.012;
    st.px += (st.tx - st.px) * 0.18; st.py += (st.ty - st.py) * 0.18;
    x.fillStyle = '#050506'; x.fillRect(0, 0, W, H);
    for (const [layer, d] of built.layers) x.drawImage(layer, st.px * k * d, st.py * k * d);
    return Math.abs(st.tx - st.px) + Math.abs(st.ty - st.py) > 0.002;
  }
  return {
    label: 'tear', get animated() { return false; }, draw,
    pointer(nx, ny) { if (!opts.reduced) { st.tx = nx; st.ty = ny; } },
  };
}
