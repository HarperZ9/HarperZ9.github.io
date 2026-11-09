// lib/powers.js: a Powers-of-Ten zoom through nested archival images, joined where two shapes rhyme.
// Each level sits inside its parent at a child rectangle. The camera scales geometrically about the fixed point of
// the parent-to-child map, so the zoom never drifts sideways. The last join is the surreal one: the whorl of a
// thumbprint on a 1930s prison card opens onto a spiral galaxy in the Hubble Deep Field.
import { clamp, smoothstep } from './util.js';

// Fixed point of p -> o + s*p (per axis). This is the one point the zoom leaves in place.
export function fixedPoint(child) { const o = [child.x - child.s / 2, child.y - child.s / 2]; return [o[0] / (1 - child.s), o[1] / (1 - child.s)]; }

// Screen rectangle of level i's frame, in screen-normalised units, at zoom fraction f toward its child.
export function frameRect(child, f) {
  const z = Math.pow(child.s, f), p = fixedPoint(child);
  return { x: p[0] * (1 - 1 / z), y: p[1] * (1 - 1 / z), w: 1 / z, h: 1 / z };
}

// Rectangles for every level given a continuous zoom position z in [0, levels-1].
export function layout(levels, zpos) {
  const n = levels.length, i = clamp(Math.floor(zpos), 0, n - 2), f = clamp(zpos - i, 0, 1), rects = new Array(n);
  rects[i] = frameRect(levels[i].child, f);
  for (let j = i + 1; j < n; j++) { const c = levels[j - 1].child, r = rects[j - 1]; rects[j] = { x: r.x + (c.x - c.s / 2) * r.w, y: r.y + (c.y - c.s / 2) * r.h, w: c.s * r.w, h: c.s * r.h }; }
  for (let j = i - 1; j >= 0; j--) { const c = levels[j].child, r = rects[j + 1]; const w = r.w / c.s, h = r.h / c.s; rects[j] = { x: r.x - (c.x - c.s / 2) * w, y: r.y - (c.y - c.s / 2) * h, w, h }; }
  return { rects, i, f };
}

// Draw an image crop to cover a destination rectangle with the destination's aspect.
function cover(ctx, img, crop, d) {
  const [cx, cy, cw, ch] = crop, ar = d.w / d.h, car = cw / ch;
  let sw = cw, sh = ch; if (car > ar) sw = ch * ar; else sh = cw / ar;
  ctx.drawImage(img, cx + (cw - sw) / 2, cy + (ch - sh) / 2, sw, sh, d.x, d.y, d.w, d.h);
}

// A level is an image, a crop centre (u, v) and a crop height h, all as fractions of the image. Its crop width
// follows the frame's aspect, so a crop never distorts. `at` places the next level inside this one, in this image's
// coordinates, at size s (the child's frame as a fraction of this frame).
export function cropRect(L, A) {
  const iw = L.img.naturalWidth, ih = L.img.naturalHeight, ch = L.h * ih, cw = ch * A;
  return [L.c[0] * iw - cw / 2, L.c[1] * ih - ch / 2, cw, ch];
}
export function childOf(L, A) {
  const [cx, cy, cw, ch] = cropRect(L, A), iw = L.img.naturalWidth, ih = L.img.naturalHeight;
  return { x: (L.at[0] * iw - cx) / cw, y: (L.at[1] * ih - cy) / ch, s: L.s };
}

export function create(cv, assets, opts = {}) {
  const x = cv.getContext('2d');
  // print grade, once per asset: the scans' paper sits at 255 in red; a 3.5% brightness trim keeps paper texture
  // off the clip (quality pass: 27% of the plate's pixels were pinned at 255)
  const grade = (im) => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.filter = 'brightness(0.965)'; g.drawImage(im, 0, 0); c.naturalWidth = c.width; c.naturalHeight = c.height; return c; };
  const card = grade(assets.card), deep = assets.deep, map = grade(assets.map);
  const thumb = [0.125, 0.36], galaxy = [0.089, 0.533];
  const levels = [
    { img: map, c: [0.52, 0.5], h: 0.5, at: [0.56, 0.47], s: 0.15, name: 'An enumeration district, Manhattan, 1900' },
    { img: card, c: [0.34, 0.3], h: 0.42, at: thumb, s: 0.135 / 0.42, name: 'A fingerprint card, United States Penitentiary, Leavenworth' },
    { img: card, c: thumb, h: 0.135, at: [0.128, 0.352], s: 0.22, round: true, name: 'The right thumb' },
    { img: deep, c: galaxy, h: 0.085, at: galaxy, s: 0.5, name: 'A spiral galaxy, Hubble Deep Field, 1995' },
  ];
  const st = { z: 0, target: 0, still: !!opts.reduced, t0: 0, auto: !opts.reduced };
  function draw(time) {
    const W = cv.width, H = cv.height, A = W / H;
    if (!st.still && st.auto) { const T = ((time - st.t0) / 16) % 1; st.z = (opts.ease ? opts.ease(Math.min(1, T / 0.85)) : T) * (levels.length - 1.0001); }
    else st.z += (st.target - st.z) * (opts.reduced ? 1 : 0.12);
    const geo = levels.map(L => ({ child: childOf(L, A) }));
    const { rects } = layout(geo, st.z), last = levels.length - 1;
    x.fillStyle = '#050506'; x.fillRect(0, 0, W, H);
    levels.forEach((L, j) => {
      const r = rects[j], d = { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H };
      if (d.w > W * 80 || d.w < 2) return;
      const crop = cropRect(L, A);
      x.save();
      if (j === last) { // the galaxy opens through the whorl: the join is a shape, not a cut
        const k = smoothstep(0.1, 0.75, st.z - (last - 1)), rr = 0.5 + 0.4 * k;
        x.globalAlpha = k; x.beginPath(); x.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w * rr, d.h * rr, 0, 0, Math.PI * 2); x.clip();
      } else if (L.round) { x.beginPath(); x.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0, 0, Math.PI * 2); x.clip(); }
      else if (j > 0) { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 16; x.fillStyle = '#f2ecdf'; x.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8); x.shadowBlur = 0; }
      x.drawImage(L.img, crop[0], crop[1], crop[2], crop[3], d.x, d.y, d.w, d.h);
      x.restore();
    });
    return !st.still || Math.abs(st.target - st.z) > 0.001;
  }
  return {
    label: 'powers', names: levels.map(l => l.name), levels, draw,
    get animated() { return !!st.auto; },
    get level() { return Math.round(st.z); },
    go(z) { st.auto = false; st.target = clamp(z, 0, levels.length - 1); },
    play(now) { st.auto = true; st.still = false; st.t0 = now; },
    pause() { st.auto = false; st.target = st.z; },
  };
}
