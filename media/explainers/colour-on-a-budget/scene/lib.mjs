// Shared parts for "Colour on a budget": the palette (storyboard colour script: the picture and
// the colour cloud are the art layer; the UI stays bone ink, Conso tabs; drift ember only on the
// error), cues from the narration timing, labels that record what they say, and the source tab.
import { rect, circle, contour, line, bounds } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { span, window, ease, lerp, lerpLog } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

export const C = Object.freeze({
  void: [0.012, 0.014, 0.03], ink: "#ece5d6", ink2: "#b9b2a3", dim: "#8f8b84", faint: "#3a4258", hot: "#e29472", lime: "#b6e070",
});

export function cues(timing) {
  const list = Array.isArray(timing) ? timing : timing.rows;
  const rows = new Map(list.filter((r) => r.predict === undefined).map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
  const row = (s, l, k = 0) => { const r = rows.get(`${s}.${l}.${k}`); if (!r) throw new Error(`no sentence ${s}.${l}.${k}`); return r; };
  return {
    at: (s, l, k = 0) => row(s, l, k).start,
    end: (s, l, k = 0) => row(s, l, k).end,
    word: (s, l, k, phrase) => {
      const r = row(s, l, k), i = r.text.indexOf(phrase);
      if (i < 0) throw new Error(`"${phrase}" not in "${r.text}"`);
      return r.start + (r.end - r.start) * (i / r.text.length);
    },
    // A predict question (film.json segment predict n): spoken, then held in silence.
    ask: (s, n = 0, hold = 2.5) => {
      const r = list.find((x) => x.segment === s && x.predict === n);
      if (!r) throw new Error(`no predict question ${s}.${n}`);
      return { start: r.start, end: r.end, held: r.end + hold, text: r.text };
    },
    last: list[list.length - 1].end,
  };
}

// Every string put on screen, keyed by its shape, so a test can read each frame. COUNTED and
// DERIVED name the numbers that come from the picture itself or from arithmetic, not a source;
// the test recomputes each one.
export const LABELS = new WeakMap(), TAB_OF = new WeakMap(), COUNTED = new Map(), DERIVED = new Map();
export function words(str, atlas, size, x, y, anchor = "left") {
  const t = text(str, { atlas, size, x, y, anchor });
  LABELS.set(t.shape, str);
  return t;
}

// The source tab, top left; a source read only at second hand says so.
export function tab(evidence, id, mono) {
  const e = evidence.sources[id], head = e.short.replace(/(\d{4}), /, "$1 . ");
  const n = /^not applicable/i.test(e.n || "") ? "" : ` . ${e.n}`;
  const read = /^(secondary|metadata)/.test(e.read) ? ` . ${e.read.split(" ")[0]}` : "";
  const shape = words(`${head}${n}${read}`, mono, 28, 96, 58).shape;
  TAB_OF.set(shape, id);
  return shape;
}

export function scrim(shape, pad = 18) {
  const b = bounds(shape);
  return { shape: rect(b.x0 - pad * 1.6, b.y0 - pad, b.w + pad * 3.2, b.h + pad * 2, pad), fill: "#04050a", opacity: 0.72, blur: pad * 0.8, screen: true };
}

export const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
export { rect, circle, contour, line, bounds, text, span, window, ease, lerp, lerpLog };
