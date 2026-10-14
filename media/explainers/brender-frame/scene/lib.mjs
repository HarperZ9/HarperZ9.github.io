// Shared parts for "How a 1998 engine drew a frame": palette, type, cues from the narration
// timing, drawn forms, and the period frames as image paints. The engine is the vendored
// raw-native tree (web/, templates/guides/, docs/motion/ at repo-root layout).
import { rect, line, circle, contour, bounds, transform, trim } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text, tex } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { span, window, ease, lerp, lerpLog, clamp01 } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

// Colour script (storyboard): void black ground, bone line-work, verified lime only on a rung
// that really passed, drift ember only on the textured period frame nobody claims.
export const C = Object.freeze({
  void: [0.016, 0.016, 0.02], ink: "#ece5d6", ink2: "#b8b0a0", dim: "#958e80", faint: "#4a4650", frame: "#2a2830",
  ok: "#b9e36a", hot: "#e8875a",
});

// Cue times from timing.json: at(seg, line, sentence) is when that sentence starts.
export function cues(timing) {
  const rows = new Map(timing.map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
  const row = (s, l, k = 0) => { const r = rows.get(`${s}.${l}.${k}`); if (!r) throw new Error(`no sentence ${s}.${l}.${k}`); return r; };
  return {
    at: (s, l, k = 0) => row(s, l, k).start,
    end: (s, l, k = 0) => row(s, l, k).end,
    // When the voice reaches a phrase, estimated from its place in the sentence.
    word: (s, l, k, phrase) => {
      const r = row(s, l, k), i = r.text.indexOf(phrase);
      if (i < 0) throw new Error(`"${phrase}" not in "${r.text}"`);
      return r.start + (r.end - r.start) * (i / r.text.length);
    },
    last: timing[timing.length - 1].end,
  };
}

// A label as a fill item; screen labels sit in design pixels.
export function label(str, atlas, { size = 32, x = 0, y = 0, anchor = "left", color = C.ink, opacity = 1, screen = false } = {}) {
  const t = text(str, { atlas, size, x, y, anchor });
  return { item: { shape: t.shape, fill: color, opacity, screen }, width: t.width };
}
// Push a prepared label shape at an opacity, skipping invisible ones.
export const put = (items, shape, fill, o, extra = {}) => { if (o > 0.004) items.push({ shape, fill, opacity: Math.min(1, o), ...extra }); };
// A world label: frame() fades it as it enters the area where the browser draws captions.
export const putL = (items, shape, fill, o, extra = {}) => put(items, shape, fill, o, { lbl: true, ...extra });
export const stroke = (items, shape, color, width, o, extra = {}) => { if (o > 0.004) items.push({ shape, stroke: color, width, opacity: Math.min(1, o), ...extra }); };

// A period frame (an image registered by name) drawn into a box. Period output is shown as it
// is: the scene never filters or recolours it.
export const image = (name, x, y, w, h, opacity = 1, extra = {}) => ({ shape: rect(x, y, w, h), fill: { image: name, rect: [x, y, w, h] }, opacity, ...extra });

// Load PNGs for image paints in the browser. Each image is enlarged by an integer factor with
// nearest-neighbour sampling before it reaches the atlas, so the renderer's linear sampler
// leaves hard pixel edges (PROGRESS.md, step 3). Node (the tests) has no renderer: skipped.
export async function loadImages(ctx, list) {
  if (!ctx.motion || typeof createImageBitmap === "undefined") return;
  for (const { name, file, k = 1 } of list) {
    const blob = await fetch(ctx.url(file)).then((r) => { if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`); return r.blob(); });
    const bmp = await createImageBitmap(blob);
    const cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext("2d");
    g.drawImage(bmp, 0, 0);
    const src = g.getImageData(0, 0, bmp.width, bmp.height).data, W = bmp.width * k, H = bmp.height * k;
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = ((y / k | 0) * bmp.width + (x / k | 0)) * 4, d = (y * W + x) * 4;
      data[d] = src[s]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + 2]; data[d + 3] = 255;
    }
    ctx.motion.image(name, { width: W, height: H, data });
  }
}

// A box outline as an open contour set (four sides), for frames drawn as line-work.
export const box = (x, y, w, h) => [contour([x, y, x + w, y, x + w, y + h, x, y + h, x, y], false)];

// The source tab: top left, Conso, from evidence.json (storyboard grammar: the tab rides with
// the number). Each entry is [id, from, to, extra text].
export function tabShape(evidence, mono, id, extra = "") {
  const e = evidence.sources[id];
  if (!e) throw new Error(`no source ${id} in evidence.json`);
  const read = e.read === "secondary" ? " . secondary" : "";
  return text(`${e.short}${read}${extra ? " . " + extra : ""}`, { atlas: mono, size: 28, x: 96, y: 66 }).shape;
}

// Fade world labels that would sit where captions are drawn (x 384 to 1536, y from 772 in
// the design frame; tests/explainer-film-labels.mjs). Screen labels are placed above it.
export function clearCaptionArea(items, cam) {
  for (const it of items) {
    if (!it.lbl || it.screen) continue;
    const b = bounds(it.shape), k = cam.zoom;
    const x0 = 960 + (b.x0 - cam.x) * k, x1 = 960 + (b.x0 + b.w - cam.x) * k, y1 = 540 + (b.y0 + b.h - cam.y) * k;
    if (x1 < 360 || x0 > 1560) continue;
    it.opacity *= clamp01((748 - y1) / 60);
  }
}

export { rect, line, circle, contour, bounds, transform, trim, text, tex, span, window, ease, lerp, lerpLog, clamp01 };
