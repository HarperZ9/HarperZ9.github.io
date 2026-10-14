// Segment 3, "Lines and colour". The line-work facet: the box's outline as vector strokes whose
// joins and dashes change while the error tag lands. The colour facet: the box with its light
// pushed far past what a screen shows, finished by the engine's own colour pipelines in turn
// (post.colour): clip, then AgX, then ACES 2.0, each named as it comes on.
import { contour } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { C, box, view, inFacet, put, T, tab, fact, span, window, FACET, ZF } from "./world.mjs";

const PIPES = [["clip", "clip/srgb"], ["AgX", "agx/srgb"], ["ACES 2.0", "aces2-sdr/srgb"]];

// The box's silhouette and its visible edges as one open path set, for stroking.
function outline(v) {
  const P = v.proj, E = [[[-1, 0, 1], [1, 0, 1]], [[1, 0, 1], [1, 0, -1]], [[-1, 2, 1], [1, 2, 1]], [[1, 2, 1], [1, 2, -1]], [[1, 2, -1], [-1, 2, -1]],
    [[-1, 2, -1], [-1, 2, 1]], [[-1, 0, 1], [-1, 2, 1]], [[1, 0, 1], [1, 2, 1]], [[1, 0, -1], [1, 2, -1]]];
  return E.map(([a, b]) => contour([...P(a), ...P(b)], false));
}

export function prepare(A, facts, c) {
  const v = view({ yaw: 34, pitch: 22, dist: 9.5 });
  const ev = A.ev;
  A.s3 = {
    edges: outline(v), floor: box(v).slice(0, 1),
    hdr: box(v, { faceColour: (n, l) => [l * 7.6, l * 7.2, l * 6.4], floorGrid: false, edges: [0, 0, 0], edgeWidth: 1 }),
    joins: ["miter", "round", "bevel"].map((j) => T(A, `join: ${j}`, { size: 32, x: 1500, y: 300, atlas: "mono" })),
    vec: T(A, `${fact(ev, "vector_cases")} test drawings . mean edge error under ${fact(ev, "vector_edge")} in each`, { size: 34, x: 960, y: 262, atlas: "mono" }),
    names: PIPES.map(([n]) => T(A, n, { size: 56, x: 960, y: 196, atlas: "head" })),
    gpu: T(A, `GPU against C++: at most ${fact(ev, "colour_code")} step in 255`, { size: 34, x: 960, y: 262, atlas: "mono" }),
    ocio: T(A, `ACES 2.0 against OpenColorIO: dE ${fact(ev, "ocio_de")}`, { size: 34, x: 960, y: 312, atlas: "mono" }),
    tabV: tab(A, ev, "rn-vector"), tabC: tab(A, ev, "rn-colour-gpu"), tabO: tab(A, ev, "rn-ocio"),
  };
  A.T3 = { enter: c.at(3, 0, 0), over: c.at(3, 0, 1), colour: c.at(3, 1, 0), tone: c.word(3, 1, 0, "tone mapper"), gpu: c.at(3, 1, 1),
    aces: c.word(3, 1, 1, "ACES 2.0"), ocio: c.word(3, 1, 1, "OpenColorIO"), exit: c.at(4, 0, 0) };
}
export const stops = (c) => [["lines", c.at(3, 0, 0)], ["colour", c.at(3, 1, 0)]];

// Which pipeline finishes the frame at time t.
const pipeAt = (t, T3) => (t < T3.tone ? 0 : t < T3.aces ? 1 : 2);

export function look(t, A, cam) {
  const T3 = A.T3, f = FACET.colour;
  if (t < T3.colour - 1 || t > T3.exit + 1 || Math.hypot(cam.x - f.cx, cam.y - f.cy) > 1) return null;
  return { post: { colour: PIPES[pipeAt(t, T3)][1], bloom: 0.15 }, since: null };
}

export function draw(t, A, items) {
  const S = A.s3, T3 = A.T3;
  if (t < T3.enter - 2 || t > T3.exit + 1) return;
  // Line-work: the outline stroked wide, the join style stepping, a dash marching.
  const j = Math.min(2, Math.floor(Math.max(0, t - T3.enter) / 2.6)), dashOn = span(t, T3.over, T3.over + 1);
  const lines = [...S.floor, { shape: S.edges, stroke: C.ink, width: 26, join: ["miter", "round", "bevel"][j], cap: "square",
    ...(dashOn > 0 ? { dash: [60, 26], dashOffset: (t - T3.over) * 40 } : {}) },
  { shape: S.edges, stroke: C.void, width: 6, opacity: 0.9 }];
  items.push(...inFacet(lines, "lines"));
  items.push(...inFacet(S.hdr, "colour"));
  const oL = window(t, T3.enter, T3.colour, 0.6, 0.6), oC = window(t, T3.colour, T3.exit + 0.3, 0.6, 0.8);
  put(items, S.joins[j], C.ink2, oL * window(t, T3.enter + 0.2, T3.over + 0.5, 0.4, 0.4));
  put(items, S.vec, C.ink, oL * span(t, T3.over, T3.over + 0.6));
  put(items, S.tabV, C.ink2, oL * 0.85 * span(t, T3.over - 0.4, T3.over + 0.2));
  const p = pipeAt(t, T3), at = [T3.colour, T3.tone, T3.aces][p];
  put(items, S.names[p], C.ink, oC * span(t, at, at + 0.5));
  put(items, S.gpu, C.ink, oC * span(t, T3.gpu, T3.gpu + 0.6));
  put(items, S.ocio, C.ink, oC * span(t, T3.ocio, T3.ocio + 0.6));
  put(items, S.tabC, C.ink2, oC * 0.85 * window(t, T3.gpu - 0.3, T3.ocio, 0.4, 0.4));
  put(items, S.tabO, C.ink2, oC * 0.85 * span(t, T3.ocio - 0.2, T3.ocio + 0.3));
}
