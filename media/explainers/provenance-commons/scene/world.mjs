// Shared parts for film 6, "Provenance and the commons": the palette (storyboard colour
// script), cues from the narration timing, labels that record what they say, the source tab,
// and the one world the film lives in: a net of fine threads seen from above. Every knot is a
// thing someone made (a library, a dataset, a release); the short thread that runs back from
// it ends at a small mark where the thing was made. That thread is its provenance.
import { circle, contour, rect, line, bounds } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { span, window, ease, lerp, lerpLog, rng } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

// Ground deep navy; ink bone; verified lime only for provenance traced back to its source; drift
// ember is the one hot mark per view (a file only in the release, a cut thread, the 72%).
export const C = Object.freeze({
  void: [0.012, 0.018, 0.04], ink: "#ece5d6", ink2: "#b9b2a3", dim: "#8f8b84", faint: "#3a4258", grey: "#5f6475",
  hot: "#e29472", lime: "#b6e070",
});

// Cue times from timing.json (a list of sentence rows, provisional or narrated).
export function cues(timing) {
  const list = Array.isArray(timing) ? timing : timing.rows;
  const rows = new Map(list.map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
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
    last: list[list.length - 1].end,
  };
}

// The silent still of a predict beat: the gap the timing leaves between two lines. With the
// provisional timing the gap holds the 2.5 s; with a narration that has no hold in it the gap is
// a plain pause and the scene simply runs on.
export function hold(c, from, to, seconds = 2.5) {
  return to - from >= seconds + 0.6 ? { a: to - 0.3 - seconds, b: to - 0.3 } : null;
}

// Every string a scene puts on screen, keyed by its shape, so a test can read what each frame
// says and check every number against the source whose tab is in the same frame.
export const LABELS = new WeakMap(), TAB_OF = new WeakMap();
export function words(str, atlas, size, x, y, anchor = "left") {
  const t = text(str, { atlas, size, x, y, anchor });
  LABELS.set(t.shape, str);
  return t;
}

// The source tab: evidence.json's short name and sample, top left (the caption area is the
// lower third, so tabs sit where the live films put them).
export function tab(evidence, id, mono) {
  const e = evidence.sources[id], head = e.short.replace(/(\d{4}), /, "$1 . ");
  const n = /^not applicable/i.test(e.n || "") ? "" : ` . ${e.n}`;   // no sample to state: the tab names the source alone
  const shape = words(`${head}${n}`, mono, 28, 96, 58).shape;
  TAB_OF.set(shape, id);
  return shape;
}

// A soft dark plate behind type, so it reads over the net.
export function scrim(shape, pad = 18) {
  const b = bounds(shape);
  return { shape: rect(b.x0 - pad * 1.6, b.y0 - pad, b.w + pad * 3.2, b.h + pad * 2, pad), fill: "#04060c", opacity: 0.7, blur: pad * 0.8, screen: true };
}

// ---------------------------------------------------------------------------------------
// The net. Knots on a jittered lattice over a field wider than the frame; each knot is woven
// to its neighbours by a slightly bowed thread, and has its own provenance thread running back
// to a source mark. Places the film visits are named knots.
export const PLACES = Object.freeze({
  centre: [960, 520], xz: [1336, 404], pasture: [520, 700], lasting: [700, 300], datasets: [1240, 760],
});
const STEP = 118, X0 = -1500, X1 = 3420, Y0 = -980, Y1 = 2060;

export function net(seed = 20261010) {
  const r = rng(seed), knots = [];
  const cols = Math.round((X1 - X0) / STEP), rows = Math.round((Y1 - Y0) / (STEP * 0.87));
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    grid.push([]);
    for (let i = 0; i <= cols; i++) {
      const x = X0 + i * STEP + (j % 2) * STEP * 0.5 + (r() - 0.5) * STEP * 0.46, y = Y0 + j * STEP * 0.87 + (r() - 0.5) * STEP * 0.4;
      const a = r() * Math.PI * 2, len = 22 + r() * 18;
      const k = { x, y, i, j, src: [x + Math.cos(a) * len, y + Math.sin(a) * len], size: 2.2 + r() * 2.2, idx: knots.length, d: 0 };
      grid[j].push(k); knots.push(k);
    }
  }
  // Snap the named places onto their nearest knot.
  const named = {};
  for (const [name, [px, py]] of Object.entries(PLACES)) {
    let best = null;
    for (const k of knots) if (!best || Math.hypot(k.x - px, k.y - py) < Math.hypot(best.x - px, best.y - py)) best = k;
    best.x = px; best.y = py; best.src = [px - 34, py - 22]; best.size = 5; best.named = name; named[name] = best;
  }
  // Threads to the right, down-left and down-right neighbours: a woven hex net.
  const threads = [];
  const bow = (a, b) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y), ny = b.x - a.x, L = Math.hypot(nx, ny) || 1, k = (r() - 0.5) * 14;
    const p = [];
    for (let s = 0; s <= 6; s++) { const u = s / 6, w = 4 * u * (1 - u) * k; p.push(lerp(a.x, b.x, u) + (nx / L) * w, lerp(a.y, b.y, u) + (ny / L) * w); }
    return contour(new Float32Array(p), false);
  };
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const a = grid[j][i], odd = j % 2;
    const ns = [grid[j][i + 1], grid[j + 1] && grid[j + 1][i - 1 + odd], grid[j + 1] && grid[j + 1][i + odd]];
    for (const b of ns) if (b) threads.push({ a, b, c: bow(a, b) });
  }
  for (const k of knots) k.d = Math.hypot(k.x - PLACES.centre[0], k.y - PLACES.centre[1]);
  return { knots, threads, named };
}

// Shapes for the net, prebuilt once: threads in bands by distance from the centre (so the net
// can gather outward from the aperture), knots, provenance threads and their source marks.
export function netShapes(N) {
  const BANDS = 12, maxD = Math.max(...N.knots.map((k) => k.d));
  const band = (d) => Math.min(BANDS - 1, Math.floor((d / maxD) * BANDS));
  const threads = Array.from({ length: BANDS }, () => []), knots = Array.from({ length: BANDS }, () => []);
  const prov = Array.from({ length: BANDS }, () => []), marks = Array.from({ length: BANDS }, () => []);
  for (const t of N.threads) threads[band(Math.max(t.a.d, t.b.d))].push(t.c);
  for (const k of N.knots) {
    const b = band(k.d);
    knots[b].push(...circle(k.x, k.y, k.size, 14));
    if (k.named) continue;   // named knots draw their own provenance thread (it may be cut)
    prov[b].push(contour(new Float32Array([k.x, k.y, k.src[0], k.src[1]]), false));
    marks[b].push(...sourceMark(k.src[0], k.src[1], 3.2));
  }
  return { BANDS, maxD, threads, knots, prov, marks };
}

// The small drawn mark where a thing was made: a tick inside a square, like a maker's stamp.
export function sourceMark(x, y, s) {
  return [contour(new Float32Array([x - s, y - s, x + s, y - s, x + s, y + s, x - s, y + s]), true)];
}

// Draw the net at opacity `o`, gathered out to share `g` of its radius (0 nothing, 1 all).
export function drawNet(S, items, o, g = 1, { except = null, zoom = 1 } = {}) {
  if (o <= 0.002) return;
  // Line widths hold about the same on screen at every zoom; a far view is a little brighter.
  const px = 1 / zoom, far = 1 + 0.9 * Math.max(0, 1 - zoom);
  for (let b = 0; b < S.BANDS; b++) {
    const u = Math.min(1, Math.max(0, g * S.BANDS - b));
    if (u <= 0) break;
    // The outer bands fade, so a far view ends in a soft round edge, not the lattice's rectangle.
    const a = o * u * Math.min(1, (S.BANDS - b) / 4.5);
    items.push({ shape: S.threads[b], stroke: C.ink, width: 1.2 * px, opacity: Math.min(1, 0.34 * far) * a });
    items.push({ shape: S.prov[b], stroke: C.ink2, width: 1.0 * px, opacity: Math.min(1, 0.4 * far) * a });
    items.push({ shape: S.marks[b], stroke: C.ink2, width: 1.0 * px, opacity: Math.min(1, 0.45 * far) * a });
    items.push({ shape: S.knots[b], fill: C.ink, opacity: 0.9 * a });
  }
  if (except) items.push({ shape: circle(except.x, except.y, except.size + 3, 20), fill: C.void, opacity: o });
}

// A named knot's provenance thread: "intact" (ink), "cut" (drift, with a gap near the knot) or
// "traced" (verified lime). Drawn in world units.
export function provenance(items, k, state, o, zoom = 1) {
  if (o <= 0.002) return;
  const [sx, sy] = k.src, colour = state === "cut" ? C.hot : state === "traced" ? C.lime : C.ink2;
  const seg = state === "cut"
    ? [contour(new Float32Array([k.x, k.y, lerp(k.x, sx, 0.38), lerp(k.y, sy, 0.38)]), false), contour(new Float32Array([lerp(k.x, sx, 0.62), lerp(k.y, sy, 0.62), sx, sy]), false)]
    : [contour(new Float32Array([k.x, k.y, sx, sy]), false)];
  const px = Math.max(0.35, 1 / zoom);
  items.push({ shape: seg, stroke: colour, width: (state === "intact" ? 1.0 : 2.0) * px, opacity: o });
  items.push({ shape: sourceMark(sx, sy, 3.6), stroke: colour, width: 1.2 * px, opacity: o });
}

// A camera between two framings: log-linear in zoom, smootherstep in position (bible 4.2).
export function fly(t, a, b, t0, t1) {
  const u = span(t, t0, t1, ease.inOut);
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), zoom: lerpLog(a.zoom, b.zoom, u) };
}

export { circle, contour, rect, line, bounds, text, span, window, ease, lerp, lerpLog, rng };
export { trim, translate } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";

// The lens: a knot opened up to show what is inside it. A void disc (or an octagon, for
// Ostrom's eight principles) with a fine bone rim, centred on screen.
export function lensShape(cx, cy, r, sides = 0) {
  if (!sides) return circle(cx, cy, r, 96);
  const p = [];
  for (let k = 0; k < sides; k++) { const a = -Math.PI / 2 + Math.PI / sides + (k / sides) * Math.PI * 2; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return [contour(new Float32Array(p), true)];
}
export function drawLens(items, cx, cy, r, o, sides = 0) {
  if (o <= 0.002 || r < 1) return;
  const sh = lensShape(cx, cy, r, sides);
  items.push({ shape: sh, fill: C.void, opacity: 0.96 * o, screen: true });
  items.push({ shape: sh, stroke: C.ink2, width: 1.4, opacity: 0.7 * o, screen: true });
}
// A plotter line: points every 18 px with a hair of wobble.
export function plotter(x, y, len, r) {
  const p = [];
  for (let s = 0; s <= len; s += 18) p.push(x + Math.min(s, len), y + (r() - 0.5) * 0.8);
  if (p.length < 4) p.push(x + len, y);
  return contour(new Float32Array(p), false);
}
// A person, drawn as a maker's mark: a head and shoulders in fine line.
export function person(x, y, s = 1) {
  const head = circle(x, y - 22 * s, 11 * s, 28);
  const p = [];
  for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * Math.PI; p.push(x + Math.cos(a) * 22 * s, y + 18 * s + Math.sin(a) * 20 * s); }
  return [...head, contour(new Float32Array(p), false)];
}
