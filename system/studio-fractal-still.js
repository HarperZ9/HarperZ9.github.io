// studio-fractal-still.js: the 2D Fractal source's Large still group, and its entries in the
// Export menu. The still is the view on the stage at 4K, 8K or 16K, with the stage's aspect,
// drawn in strips by the same renderer (fractal-tiles.js) and saved as one PNG.

import { renderTiledPNG } from "./fractal-tiles.js";

const $ = (id) => document.getElementById(id);
const SIZES = { "fractal-still-4k": 3840, "fractal-still-8k": 7680, "fractal-still-16k": 15360 };

export function mountFractalStill({ getView, decorate, draw, stageAspect, say }) {
  let busy = false;
  const status = (t) => { const s = $("fractal-still-status"); if (s) s.textContent = t; };
  const aa = $("fractal-still-aa");
  if (aa) aa.addEventListener("input", () => { for (const id of ["fractal-still-aa-val", "fractal-still-aa-val2"]) { const o = $(id); if (o) o.textContent = aa.value; } });

  async function render(width) {
    const v = getView();
    if (!v || busy) return;
    if (v.type === "buddhabrot" || v.type === "nebulabrot") { status("Large stills are for the iterated sets; the Buddhabrot keeps the stage's size."); return; }
    busy = true;
    const W = width, H = Math.round(width * stageAspect());
    const samples = Math.max(1, Math.min(4, parseInt((aa || {}).value, 10) || 2));
    const view = { ...decorate(v), aa: samples };
    const t0 = performance.now();
    try {
      status(`Drawing a ${W} x ${H} still...`);
      const blob = await renderTiledPNG({
        view, W, H, draw,
        onProgress: (d, n) => status(`Drawing a ${W} x ${H} still: strip ${d} of ${n}.`),
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fractal-${v.type}-${W}x${H}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      const s = ((performance.now() - t0) / 1000).toFixed(1);
      status(`Saved ${a.download}, ${(blob.size / 1e6).toFixed(1)} MB, in ${s} s.`);
      say(`A ${W} x ${H} still of this view is saved: ${(blob.size / 1e6).toFixed(1)} MB, drawn in ${s} s.`);
    } catch (e) {
      console.error("[studio] large still failed:", e);
      status(`The still was not saved: ${e.message}.`);
    } finally {
      busy = false;
    }
  }
  for (const id of Object.keys(SIZES)) { const b = $(id); if (b) b.addEventListener("click", () => render(SIZES[id])); }
  return { render, busy: () => busy };
}
