// render-worker.js: scene renders off the main thread. A cloud layer or a 4K export takes seconds; on the main
// thread that stalls the page (pacing, input, even screenshots). The brush modules are pure, so they run here as is.
// Message in: { id, scene (name or scene object), seed, width, out: 'float' | 'rgba8' | 'png16' | 'png8' }.
// Message out: { id, w, h, buffer } (transferred), or { id, progress }, or { id, error }.
import { render, SCENES, encodePNG, browserDeflate } from './brush/index.js';

self.onmessage = async ({ data: m }) => {
  try {
    const scene = typeof m.scene === 'string' ? SCENES[m.scene](m.seed) : m.scene;
    const s = await render(scene, m.width, { onProgress: (f) => self.postMessage({ id: m.id, progress: f }), yieldEvery: 60, yieldFn: () => Promise.resolve() });
    let buffer;
    if (m.out === 'float') {
      // the float surface for further painting, plus the 8-bit image so the page need not convert it
      const rgba = s.toRGBA8().buffer, px = s.px.buffer;
      self.postMessage({ id: m.id, w: s.w, h: s.h, buffer: px, rgba }, [px, rgba]); return;
    }
    else if (m.out === 'png16') buffer = (await encodePNG(s.w, s.h, s.toRGBA16(), browserDeflate)).buffer;
    else if (m.out === 'png8') buffer = (await encodePNG(s.w, s.h, s.toRGBA8({ dither: true }), browserDeflate)).buffer;
    else buffer = s.toRGBA8().buffer;
    self.postMessage({ id: m.id, w: s.w, h: s.h, buffer }, [buffer]);
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.stack || err) });
  }
};
