// ground-worker.js: paints region grounds off the main thread, so building a new zoom bucket never drops a frame.
// Messages in: { init: { img: {k: ImageBitmap}, lum: {k: {w,h,L}}, survey } } and { key, region, px, ink, survey }.
// Messages out: { key, bitmap } (transferred).
import { ENV, paint } from "./ground-draw.js";

self.onmessage = (e) => {
  const m = e.data;
  if (m.init) {
    Object.assign(ENV, m.init);
    // the survey numerals are set in the house utility face; a worker has its own font set
    const f = new FontFace("Conso", `url(${new URL("../../ui/shell/fonts/conso-regular.woff2", import.meta.url)})`);
    f.load().then((ff) => self.fonts.add(ff)).catch((err) => console.warn("ground-worker: Conso not loaded, numerals use monospace", err));
    return;
  }
  try {
    if (m.survey) ENV.survey = m.survey;
    const c = paint(m.region, m.px, m.ink);
    const bitmap = c.transferToImageBitmap();
    self.postMessage({ key: m.key, bitmap }, [bitmap]);
  } catch (err) {
    console.error("ground-worker: paint failed", m.key, err);
    self.postMessage({ key: m.key, error: String(err) });
  }
};
