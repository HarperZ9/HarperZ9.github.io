// Segment 4, "A tube, simulated as a tube". First one scanline of the box as a voltage: the
// picture as a signal. Then the engine's tube pass (the "crt" pass, a composite set with a notch
// decoder) draws the box on the tube. For the electron beams the camera goes in past the glass
// to one triad of the slot mask (drawn, not rendered: the pass works at the frame's size), and
// comes back out to the whole tube, where the dot crawl on the box's edges is the decoder's own
// error. Then the parity number lands.
import { contour, rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { C, box, view, inFacet, put, T, tab, tag, fact, span, window, ease, lerp, FACET } from "./world.mjs";

const V = { yaw: 34, pitch: 22, dist: 9.5, cy: 470 }, LINE_Y = 470;

// Brightness along one row of the box view: the last face (in draw order) that holds each x.
function scanline(items, y, x0 = 160, x1 = 1760, n = 400) {
  const polys = items.filter((it) => it.fill && it.shape[0].closed).map((it) => ({ p: it.shape[0].pts, v: lum(it.fill) * (it.opacity ?? 1) }));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    let v = 0;
    for (const q of polys) if (inside(q.p, x, y)) v = q.v;
    out.push(x, v);
  }
  return out;
}
const lum = (f) => (Array.isArray(f) ? 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] : 0.5);
function inside(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
  return c;
}

// One triad of a slot mask at millimetre scale, with the beam's gaussian spot over it.
function triads(cx, cy, s, beamX, glow) {
  const out = [], cols = [[1, 0.25, 0.2], [0.3, 1, 0.35], [0.3, 0.45, 1]];
  for (let r = -4; r <= 4; r++) for (let q = -7; q <= 7; q++) for (let k = 0; k < 3; k++) {
    const x = cx + (q * 3 + k) * 12 * s, y = cy + r * 40 * s + (q % 2 ? 20 * s : 0);
    const d = Math.abs(x - beamX) / (60 * s), lit = Math.exp(-d * d) * glow;
    out.push({ shape: rect(x - 4 * s, y - 15 * s, 8 * s, 30 * s, 3 * s), fill: cols[k].map((v) => v * (0.12 + 0.88 * lit)), screen: true });
  }
  return out;
}

export function prepare(A, facts, c) {
  const items = box(view(V)), ev = A.ev;
  const wave = scanline(items, LINE_Y), pts = [];
  for (let i = 0; i < wave.length; i += 2) pts.push(wave[i], 760 - wave[i + 1] * 200);
  A.s4 = {
    items, wave: [contour(pts, false)], line: [contour([160, LINE_Y, 1760, LINE_Y], false)],
    signal: T(A, "the picture as a signal", { size: 38, x: 960, y: 196 }),
    mask: T(A, "slot mask . 1 triad", { size: 38, x: 960, y: 196 }),
    drawn: tag(A, "a depiction, not a readout"),
    decoder: T(A, "the decoder's error, not a painted effect", { size: 38, x: 960, y: 196 }),
    parity: T(A, `${fact(ev, "crt_cases")} tube settings . GPU within ${fact(ev, "crt_code")} step in 255 of the CPU`, { size: 34, x: 960, y: 262, atlas: "mono" }),
    tabS: tab(A, ev, "rn-shaders"), tabP: tab(A, ev, "rn-crt-parity"),
  };
  A.T4 = { enter: c.at(4, 0, 0), encodes: c.at(4, 0, 1), beams: c.word(4, 0, 1, "electron beams"), crawl: c.at(4, 1, 0), parity: c.at(4, 2, 0), exit: c.at(5, 0, 0) };
  A.T4.maskOut = A.T4.crawl - 0.4;
}
export const stops = (c) => [["tube", c.at(4, 0, 0)]];

// The tube pass runs from "encodes" on, except while the camera is inside the mask.
export function look(t, A, cam) {
  const T4 = A.T4, f = FACET.tube;
  if (t < T4.encodes || t > T4.exit + 1 || Math.hypot(cam.x - f.cx, cam.y - f.cy) > 1) return null;
  if (t > T4.beams && t < T4.maskOut) return { post: {}, since: T4.beams };
  return { post: { passes: [{ pass: "crt", preset: "slot-tv", source: [320, 240] }], bloom: 0.1 }, since: t < T4.beams ? T4.encodes : T4.maskOut };
}

export function draw(t, A, items) {
  const S = A.s4, T4 = A.T4;
  if (t < T4.enter - 2 || t > T4.exit + 1) return;
  const content = [...S.items];
  const sig = window(t, T4.enter + 0.4, T4.beams, 0.8, 0.6);
  if (sig > 0) content.push({ shape: S.line, stroke: C.hot, width: 2.5, opacity: sig }, { shape: S.wave, stroke: C.ink, width: 4, opacity: sig });
  items.push(...inFacet(content, "tube"));
  const o = window(t, T4.enter, T4.exit + 0.3, 0.6, 0.8);
  put(items, S.signal, C.ink, o * window(t, T4.enter + 0.6, T4.beams - 0.2, 0.5, 0.4));
  put(items, S.tabS, C.ink2, o * 0.85 * window(t, T4.enter + 0.6, T4.parity, 0.5, 0.4));
  // Inside the glass: the mask fills the frame, a beam sweeps across and its spot grows with brightness.
  const inMask = window(t, T4.beams, T4.maskOut, 0.5, 0.5);
  if (inMask > 0) {
    const u = span(t, T4.beams, T4.maskOut, ease.linear), s = lerp(1.2, 2.4, ease.smooth(Math.min(1, u * 2)));
    items.push({ shape: rect(0, 0, 1920, 1080), fill: [0.01, 0.01, 0.012], opacity: inMask, screen: true });
    for (const it of triads(960, 560, s, lerp(200, 1720, u), 0.4 + 0.6 * Math.sin(u * Math.PI))) items.push({ ...it, opacity: inMask });
    put(items, S.mask, C.ink, inMask);
    put(items, S.drawn, C.hot, inMask);
  }
  put(items, S.decoder, C.ink, o * window(t, T4.crawl + 0.3, T4.parity, 0.5, 0.4));
  put(items, S.parity, C.ink, o * span(t, T4.parity, T4.parity + 0.6));
  put(items, S.tabP, C.ink2, o * 0.85 * span(t, T4.parity - 0.2, T4.parity + 0.4));
}
