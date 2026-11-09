// lib/develop.js: reveal by dwelling, modelled on a print coming up in the developer tray.
// Density follows a Hurter and Driffield style characteristic curve (1890): density rises with the log of exposure
// along an S. Development time scales how far each grain has got toward that density, so the shadows come up first.
// Here development time is laid down wherever the viewer's attention rests. Nothing un-develops, as in the tray.
// A plain button develops the whole print at once: attention is offered, never required.
import { clamp, toLuma, sample } from './util.js';

export const HD = { dmin: 0.04, dmax: 2.1, gamma: 3.2, logE0: Math.log10(0.32), tau: 1.6 };

// Asymptotic density for exposure E in [0,1] (fully developed).
export function densityInf(E, p = HD) { const le = Math.log10(0.015 + E); return p.dmin + (p.dmax - p.dmin) / (1 + Math.exp(-p.gamma * (le - p.logE0))); }
// Density after t seconds in the developer.
export function density(E, t, p = HD) { return densityInf(E, p) * (1 - Math.exp(-Math.max(0, t) / p.tau)); }
// Reflectance of the paper at density D.
export const reflect = D => Math.pow(10, -D);
// Seconds for a grain at exposure E to reach a visible density dv (Infinity if it never does).
export function timeToVisible(E, dv = 0.3, p = HD) { const di = densityInf(E, p); return di <= dv ? Infinity : -p.tau * Math.log(1 - dv / di); }

// Attention field: a coarse grid of development seconds, fed by a Gaussian brush.
export function attention(gw, gh) {
  const t = new Float32Array(gw * gh);
  return {
    t, gw, gh,
    deposit(u, v, dt, radius = 0.09) {
      const r = radius * gw, cx = u * gw, cy = v * gh, x0 = Math.max(0, (cx - 3 * r) | 0), x1 = Math.min(gw - 1, (cx + 3 * r) | 0), y0 = Math.max(0, (cy - 3 * r) | 0), y1 = Math.min(gh - 1, (cy + 3 * r) | 0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; t[y * gw + x] += dt * Math.exp(-d2 / (2 * r * r)); }
    },
    all(dt) { for (let i = 0; i < t.length; i++) t[i] += dt; },
    min() { let m = Infinity; for (const v of t) m = Math.min(m, v); return m; },
  };
}

export function create(cv, assets, opts = {}) {
  const img = assets.spinner, w = 640, h = Math.round(w * img.naturalHeight / img.naturalWidth);
  const { luma } = toLuma(img, w, h), E = luma.map(v => 1 - v);
  const att = attention(80, Math.round(80 * h / w)), off = document.createElement('canvas'); off.width = w; off.height = h;
  const ox = off.getContext('2d'), id = ox.createImageData(w, h), x = cv.getContext('2d');
  const lutInf = new Float32Array(256); for (let i = 0; i < 256; i++) lutInf[i] = densityInf(i / 255);
  const Ei = Uint8Array.from(E, v => Math.round(clamp(v) * 255));
  const st = { ptr: null, auto: 0, dirty: true, fixed: false, last: 0 };
  const kGrid = new Float32Array(att.gw * att.gh), refl = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) refl[i] = Math.pow(10, -(i / 1023) * HD.dmax);
  function render() {
    // development fraction per grid cell first (4,800 exps), then a bilinear lookup per pixel and a reflectance table
    let done = true;
    for (let i = 0; i < kGrid.length; i++) { kGrid[i] = 1 - Math.exp(-att.t[i] / HD.tau); if (kGrid[i] < 0.97) done = false; }
    const d = id.data, sx = (att.gw - 1) / (w - 1), sy = (att.gh - 1) / (h - 1), q = 1023 / HD.dmax;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx, D = lutInf[Ei[i]] * sample(kGrid, att.gw, att.gh, xx * sx, y * sy), r = refl[Math.min(1023, (D * q) | 0)], j = i * 4;
      d[j] = 246 * r; d[j + 1] = 240 * r; d[j + 2] = 228 * r; d[j + 3] = 255;
    }
    ox.putImageData(id, 0, 0); st.fixed = done;
  }
  const ptrPx = (W, H, dw, dh) => [(W - dw) / 2 + st.ptr[0] * dw, (H - dh) / 2 + st.ptr[1] * dh];
  function draw(time) {
    const dt = st.last ? Math.min(0.05, time - st.last) : 0.016; st.last = time;
    if (st.ptr) { att.deposit(st.ptr[0], st.ptr[1], dt * 1.4); st.dirty = true; }
    if (st.auto > 0) { att.all(dt * 1.2); st.auto -= dt; st.dirty = true; }
    if (st.dirty) { render(); st.dirty = false; }
    const W = cv.width, H = cv.height, m = Math.min(W, H) * 0.05, k = Math.min((W - 2 * m) / w, (H - 2 * m) / h), dw = w * k, dh = h * k;
    // the tray: enamel rim, a dark well of developer, the print under it
    x.fillStyle = st.fixed ? '#24221f' : '#160605'; x.fillRect(0, 0, W, H);
    const rim = m * 0.55; x.fillStyle = st.fixed ? '#e9e5dc' : '#3a1712'; x.fillRect(rim, rim, W - 2 * rim, H - 2 * rim);
    x.fillStyle = st.fixed ? '#2f2c28' : '#1e0907'; x.fillRect(rim * 1.6, rim * 1.6, W - 3.2 * rim, H - 3.2 * rim);
    x.imageSmoothingQuality = 'high'; x.drawImage(off, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (!st.fixed) { x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#a8483a'; x.fillRect(0, 0, W, H); x.restore(); }
    // a sheen of liquid over the print, brightest where the developer is being worked
    if (st.ptr && !st.fixed) { const g = x.createRadialGradient(...ptrPx(W, H, dw, dh), 0, ...ptrPx(W, H, dw, dh), dw * 0.12); g.addColorStop(0, 'rgba(255,170,140,.10)'); g.addColorStop(1, 'rgba(255,170,140,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    return !!st.ptr || st.auto > 0;
  }
  return {
    label: 'develop', draw, get animated() { return !!st.ptr || st.auto > 0; },
    get fixed() { return st.fixed; },
    pointer(nx, ny, inside) {
      if (!inside) { st.ptr = null; return; }
      const W = cv.width, H = cv.height, m = Math.min(W, H) * 0.05, k = Math.min((W - 2 * m) / w, (H - 2 * m) / h);
      const px = (nx * 0.5 + 0.5) * W, py = (ny * 0.5 + 0.5) * H, u = (px - (W - w * k) / 2) / (w * k), v = (py - (H - h * k) / 2) / (h * k);
      st.ptr = u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
    },
    developAll(seconds = 5) { st.auto = seconds; },
    developInstant() { att.all(30); st.dirty = true; },
  };
}
