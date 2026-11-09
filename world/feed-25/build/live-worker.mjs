// live-worker.mjs: renders a piece off the main thread for the gallery's live case, so the page keeps its
// frame pacing while a sheet computes. In: { piece, size, seed }. Out: { bitmap, size, seed, ms } (an sRGB ImageBitmap).
import { sheetOne } from './pieces-sheets.mjs';
import { glyphField } from './pieces-glyph.mjs';

const PIECES = { sheet: (W, seed) => sheetOne(W, { seed }), glyph: (W, seed) => glyphField(W, { seed }) };

self.onmessage = ({ data }) => {
  const t0 = performance.now(), f = PIECES[data.piece];
  if (!f) { self.postMessage({ error: `unknown piece ${data.piece}` }); return; }
  try {
    const r = f(data.size, data.seed), rgba = r.sheet.out({ grain: r.grain });
    // an ImageBitmap crosses to the page by transfer and draws without a main-thread pixel copy
    createImageBitmap(new ImageData(rgba, data.size, data.size, { colorSpace: 'srgb' })).then((bitmap) =>
      self.postMessage({ bitmap, size: data.size, seed: data.seed, ms: performance.now() - t0 }, [bitmap]));
  } catch (e) { console.error('live-worker: render failed', e); self.postMessage({ error: String(e) }); }
};
