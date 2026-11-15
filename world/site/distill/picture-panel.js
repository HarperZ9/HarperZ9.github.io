// Distill on the front page: the four stages run in this tab, on the example or on a picture the visitor gives.
// Loaded by world/site/work.js the first time the visitor presses Run, chooses a file or drops one; until then the
// panel shows the recorded run of the same code (scripts/distill-picture-record.cjs). A picture is decoded by the
// browser, read at up to 640 pixels wide, and never leaves the tab. Stage 4 hands the picture and its ten colours
// to the Loom's own engine and renderer (system/weave-engine.js, system/weave-render.js).
import { study, differenceWords, partsWords, barOf, READ_WIDTH } from "./picture.mjs";

const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

// the picture as pixels, at its own size when it is 640 wide or less
export async function pixelsOf(source) {
  const bmp = source instanceof Blob ? await createImageBitmap(source) : source;
  const sw = bmp.naturalWidth || bmp.width, sh = bmp.naturalHeight || bmp.height;
  if (!sw || !sh) throw new Error("the picture has no size");
  const w = Math.min(READ_WIDTH, sw), h = Math.max(1, Math.round((sh * w) / sw));
  const c = el("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h);
  return { canvas: c, data: x.getImageData(0, 0, w, h).data, w, h };
}
export function drawSpectrum(canvas, spectrum) {
  const W = canvas.width, H = canvas.height, x = canvas.getContext("2d"), n = spectrum.length, bw = W / n;
  x.clearRect(0, 0, W, H);
  spectrum.forEach((s, i) => { const h = Math.max(s.weight > 0 ? 2 : 0, barOf(s.weight) * (H - 4)); x.fillStyle = s.hex; x.fillRect(i * bw + 1, H - h, bw - 2, h); });
}
// brightness of the picture on the loom's grid, and the mean colour of each weft row (as the Studio's loom reads it)
function loomGrid(src, w, h) {
  const c = el("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h), rows = [];
  for (let i = 0; i < w * h; i++) L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  for (let y = 0; y < h; y++) { let r = 0, g = 0, b = 0; for (let k = 0; k < w; k++) { const o = (y * w + k) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; } rows.push([r / w, g / w, b / w]); }
  return { L, rows };
}
export async function weave(canvas, src, hexes) {
  const [{ computeDraft, weftPaletteFor }, { renderCloth }] = await Promise.all([import("/system/weave-engine.js"), import("/system/weave-render.js")]);
  const ends = 96, picks = 72, g = loomGrid(src, ends, picks), draft = computeDraft(g.L, ends, picks, "jacquard", { toneDrive: 1 });
  const pal = weftPaletteFor(draft, (p) => g.rows[p], hexes.length > 1 ? hexes.slice(1) : hexes);
  renderCloth(canvas, draft, { warpHex: hexes[0], weftHexAt: (p) => pal.hexes[pal.indexAt(p)] }, { maxWidth: 720, maxHeight: 540 });
  return { ends, picks, weft: pal.hexes.length };
}

// run all four stages on a source and return what each made
export async function distillPicture(source) {
  const t0 = performance.now(), px = await pixelsOf(source), s = study(px.data, px.w, px.h);
  const rebuilt = el("canvas"); rebuilt.width = px.w; rebuilt.height = px.h; rebuilt.getContext("2d").putImageData(new ImageData(s.rebuilt, px.w, px.h), 0, 0);
  const cloth = el("canvas"), woven = await weave(cloth, px.canvas, s.swatches.map((x) => x.hex));
  return { study: s, original: px.canvas, rebuilt, cloth, woven, ms: Math.round(performance.now() - t0) };
}

export function mount(root) {
  if (root.__distill) return root.__distill;
  const status = root.querySelector("[data-status]"), slot = (n) => root.querySelector(`[data-slot="${n}"]`);
  const put = (name, canvas, label) => { const s = slot(name); if (!s) return; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", label); s.replaceChildren(canvas); };
  async function run(source, name) {
    status.textContent = "Reading the picture in this tab.";
    try {
      const r = await distillPicture(source), s = r.study, what = name ? `your picture ${name}` : "the example";
      const copy = el("canvas"); copy.width = r.original.width; copy.height = r.original.height; copy.getContext("2d").drawImage(r.original, 0, 0);
      put("source", copy, `The picture Distill is reading: ${what}.`);
      put("original", r.original, "The original picture.");
      put("rebuilt", r.rebuilt, `The picture rebuilt from its ${s.swatches.length} swatches alone.`);
      put("cloth", r.cloth, `The picture woven on the Loom in its own ${s.swatches.length} colours, ${r.woven.ends} warp ends by ${r.woven.picks} weft rows.`);
      const spec = el("canvas"); spec.width = 720; spec.height = 120; drawSpectrum(spec, s.spectrum);
      const lead = s.spectrum.reduce((a, b) => (b.weight > a.weight ? b : a));
      put("spectrum", spec, `Where the colour sits around the hue circle, in ${s.spectrum.length} steps. The strongest step is at ${lead.hue} degrees.`);
      const strip = root.querySelector(".w-strip");
      strip.replaceChildren(...s.swatches.map((sw) => { const li = el("li"); li.style.setProperty("--c", sw.hex); li.style.setProperty("--s", sw.share || 0.1); li.style.setProperty("--on", lum(sw.hex) > 0.4 ? "#0d0b12" : "#f4f2f8"); li.append(el("span", { class: "w-chip", "aria-hidden": "true" }), el("code", {}, sw.hex), document.createTextNode(" "), el("span", {}, `${sw.share.toFixed(1)}%`)); return li; }));
      root.querySelector("[data-words='parts']").textContent = partsWords(s);
      root.querySelector("[data-words='difference']").textContent = differenceWords(s.difference, s.swatches.length);
      root.querySelector("[data-words='source']").textContent = name ? `${name}, read at ${s.width} by ${s.height} pixels.` : `The example, read at ${s.width} by ${s.height} pixels.`;
      root.dataset.ran = name ? "own" : "example";
      status.textContent = `All four stages ran in this tab in ${r.ms} milliseconds on ${what}. Nothing was uploaded.`;
      return r;
    } catch (e) {
      console.error("distill: the picture could not be read", e);
      status.textContent = "That file could not be read as a picture. The example above stays. Try a PNG, JPEG, WebP or GIF.";
      return null;
    }
  }
  const api = { run, runExample: async () => run(await (await fetch(root.dataset.example)).blob()), runFile: (f) => (f ? run(f, f.name) : null) };
  root.__distill = api;
  return api;
}
