// Off the main thread: engraves the cloud with the techniques lib's burin (imported unchanged), keeps the strokes,
// and draws each shot at device resolution into an OffscreenCanvas, returned as an ImageBitmap.
// In:  { type: 'engrave', id, luma, w, h, dsep, jitter, seed }       Out: { type: 'ready', id }
//      { type: 'shot', key, id, cw, ch, sx, sy, scale, W, H }        Out: { type: 'shot', key, id, bitmap }
// Errors come back as { type: 'error', error }. jitter perturbs the tone field per drawing so the boil re-lays lines.
import { engrave, fillStroke } from '../../techniques/lib/burin.js';

const INK = '#15130f', PAPER = '#efe8d8', drawings = [];

function bbox(s) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < s.length; i += 3) { x0 = Math.min(x0, s[i]); x1 = Math.max(x1, s[i]); y0 = Math.min(y0, s[i + 1]); y1 = Math.max(y1, s[i + 1]); } return [x0, y0, x1, y1]; }

function shot({ id, cw, ch, sx, sy, scale, W, H }) {
  const c = new OffscreenCanvas(W, H), x = c.getContext('2d'), m = 4;
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H); x.setTransform(scale, 0, 0, scale, -sx * scale, -sy * scale); x.fillStyle = INK; x.beginPath();
  for (const { s, b } of drawings[id]) if (b[2] >= sx - m && b[0] <= sx + cw + m && b[3] >= sy - m && b[1] <= sy + ch + m) fillStroke(x, s, 1); // only strokes inside the window
  x.fill(); return c.transferToImageBitmap();
}

self.onmessage = (e) => {
  const d = e.data;
  try {
    if (d.type === 'engrave') {
      let s = d.seed >>> 0; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      const L = new Float32Array(d.luma); if (d.jitter > 0) for (let i = 0; i < L.length; i++) L[i] = Math.min(1, Math.max(0, L[i] + (r() - 0.5) * d.jitter));
      drawings[d.id] = engrave(L, d.w, d.h, { dsep: d.dsep }).strokes.map((st) => ({ s: st, b: bbox(st) }));
      self.postMessage({ type: 'ready', id: d.id });
    } else if (d.type === 'shot') {
      const bitmap = shot(d); self.postMessage({ type: 'shot', key: d.key, id: d.id, bitmap }, [bitmap]);
    }
  } catch (err) { self.postMessage({ type: 'error', error: String((err && err.stack) || err) }); }
};
