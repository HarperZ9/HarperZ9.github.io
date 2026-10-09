// The title and segment 1, "One reference". The title's letters turn into an
// invented reference by point correspondence; its parts are named as the voice
// names them; copies stamp out around it as fast as a chatbot writes them; the
// search for the original is slow; then the camera pulls back through scale
// until the reference is one dot among 636 (segment 2).
import { rect, trim, bounds, contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { morph } from "../../../raw-native/web-23ec93f/motion/morph.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, rng, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, line, arc, circle, scrim } from "./lib.mjs";
import { cell, HOME, SPACING, GROUPS, translateShape } from "./s2-list.mjs";

export const CARD = { w: 22, h: 7.6 };
const REF = ["Hale, R., & Morrow, J. (2019).", "Signal decay in peer networks.", "Journal of Applied Inference, 12(3), 44-61."];
const PARTS = [[0, "Hale, R., & Morrow, J.", "two authors", "two authors"], [0, "(2019)", "a year", "a year"], [1, "Signal decay in peer networks.", "a title", "a title"],
  [2, "Journal of Applied Inference", "a journal", "a journal"], [2, "44-61", "page numbers", "some page numbers"]];

// x-range of a substring in a laid-out line.
function spanOf(layout, str, sub) {
  const i = str.indexOf(sub), g = layout.glyphs;
  const x0 = g[i].x, last = g[i + sub.length - 1];
  const b = bounds(last.shape.length ? last.shape : [contour([last.x, 0, last.x, 0], false)]);
  return [x0, Math.max(b.x1, last.x)];
}

export function prepare(A, T) {
  const [cx, cy] = cell(HOME.g, HOME.i);
  const s = 0.78, lh = 1.95, left = cx - CARD.w / 2 + 1.1;
  const lines = REF.map((str, k) => ({ str, layout: text(str, { atlas: A.sans, size: s, x: left, y: cy - lh + k * lh + 0.28 }) }));
  const title = [text("Claiming got cheap.", { atlas: A.head, size: 1.55, x: cx, y: cy - 0.55, anchor: "center" }),
    text("Checking did not.", { atlas: A.head, size: 1.55, x: cx, y: cy + 1.55, anchor: "center" })];
  const refShape = lines.flatMap((l) => l.layout.shape);
  const parts = PARTS.map(([k, sub, name, phrase]) => {
    const [x0, x1] = spanOf(lines[k].layout, lines[k].str, sub), y = lines[k].layout.y + 0.32;
    const tag = text(name, { atlas: A.sans, size: 0.5, x: (x0 + x1) / 2, y: y + 0.8, anchor: "center" });
    return { under: [contour([x0, y, x1, y], false)], tag: tag.shape, at: T.word(1, 0, 0, phrase) };
  });
  // Neighbouring cells that fill with copies, nearest first.
  const r = rng(7);
  const copies = [];
  const G = GROUPS[HOME.g];
  for (let i = 0; i < G.n; i++) {
    if (i === HOME.i) continue;
    const dc = (i % G.cols) - (HOME.i % G.cols), dr = Math.floor(i / G.cols) - Math.floor(HOME.i / G.cols);
    const d = Math.hypot(dc * 1.6, dr * 3.4);
    if (d < 9.5) copies.push({ i, d, bars: [0.55 + 0.4 * r(), 0.6 + 0.35 * r(), 0.7 + 0.28 * r()] });
  }
  copies.sort((a, b) => a.d - b.d);
  A.s1cells = new Set(copies.map((c) => c.i));
  const card = rect(cx - CARD.w / 2, cy - CARD.h / 2, CARD.w, CARD.h, 0.5);
  A.s1 = {
    cx, cy, lines, title, parts, copies, card,
    // Line by line: the first title line becomes the authors and title, the second the journal.
    titleToRef: ((a, b) => (u) => [...a(u), ...b(u)])(
      morph(title[0].shape, [...lines[0].layout.shape, ...lines[1].layout.shape], { density: 0.02 }),
      morph(title[1].shape, lines[2].layout.shape, { density: 0.02 })),
    refShape,
    invented: text("invented for this video", { atlas: A.sans, size: 0.55, x: cx + CARD.w / 2, y: cy + CARD.h / 2 + 0.95, anchor: "right" }).shape,
    unverified: text("unverified", { atlas: A.sans, size: 0.62, x: cx + CARD.w / 2 - 0.9, y: cy - CARD.h / 2 - 0.55, anchor: "right" }).shape,
    labels: {
      fast: text("A chatbot writes one like it in under a second.", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }).shape,
      page: text("Nothing on the page says whether the work exists.", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }).shape,
      look: text("To find out, someone has to go and look.", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }).shape,
    },
  };
}

// A copy: the card outline with three bars for lines of text.
function copyShape(c0, c1, bars) {
  const out = [...rect(c0 - CARD.w / 2, c1 - CARD.h / 2, CARD.w, CARD.h, 0.5)];
  return out.concat(bars.flatMap((w, k) => rect(c0 - CARD.w / 2 + 1.1, c1 - 2.3 + k * 1.95, (CARD.w - 2.2) * w, 0.62, 0.3)));
}

export function draw(t, A, T, items, zoom) {
  const S = A.s1, [cx, cy] = [S.cx, S.cy];
  if (t > T.cardGone + 0.1) return;
  // Title: claiming draws on quickly, checking slowly; then the letters become the reference.
  const m = span(t, T.morph, T.morph + 1.5, ease.inOut);
  if (m <= 0) {
    const d1 = span(t, 0.5, 1.5, ease.out), d2 = span(t, 2.2, 3.7, ease.inOut);
    const f1 = span(t, 1.3, 1.9), f2 = span(t, 3.3, 3.9);
    items.push({ shape: trim(S.title[0].shape, 0, d1), stroke: C.ink, width: 0.03, fill: f1 > 0 ? C.ink : null, opacity: 1 });
    if (f1 > 0) items.push({ shape: S.title[0].shape, fill: C.ink, opacity: f1 });
    if (d2 > 0) items.push({ shape: trim(S.title[1].shape, 0, d2), stroke: C.ink, width: 0.03 });
    if (f2 > 0) items.push({ shape: S.title[1].shape, fill: C.ink, opacity: f2 });
  }
  // How far the card has become a dot, from the camera's zoom (segment 2 uses the same rule).
  const toDot = A.cardToDotU(zoom);
  const textA = span(Math.log(zoom), Math.log(4.5), Math.log(9), ease.linear);
  if (m > 0 && toDot < 1) items.push({ shape: m < 1 ? S.titleToRef(m) : S.refShape, fill: C.ink, opacity: Math.min(1, textA) });
  // The parts of a reference, named as the voice names them.
  const partsA = window(t, T.parts, T.frame + 0.6, 0.3, 0.6);
  for (const p of S.parts) {
    const u = span(t, p.at - 0.15, p.at + 0.45, ease.out);
    if (u <= 0 || partsA <= 0) continue;
    items.push({ shape: trim(p.under, 0, u), stroke: C.ink2, width: 0.07, opacity: partsA });
    items.push({ shape: p.tag, fill: C.ink2, opacity: partsA * u });
  }
  // The card around it: "It looks like every other reference you have read."
  const frameU = span(t, T.frame, T.frame + 1.1, ease.inOut);
  if (frameU > 0) {
    const shape = toDot > 0 ? A.cardToDot(toDot, cx, cy) : trim(S.card, 0, frameU);
    items.push({ shape, stroke: toDot > 0.5 ? null : C.ink2, fill: toDot > 0 ? C.ink : null, width: 0.08, opacity: toDot > 0 ? Math.max(toDot, 0.25) : 1 });
  }
  const inv = window(t, T.invented, T.copies + 0.4, 0.5, 0.6);
  if (inv > 0) {
    items.push({ shape: S.invented, fill: C.hot, opacity: inv });
    items.push({ shape: [contour([cx + CARD.w / 2 - 0.2, cy + CARD.h / 2 + 0.25, cx + CARD.w / 2 - 0.2, cy + CARD.h / 2 - 0.1], false)], stroke: C.hot, width: 0.06, opacity: inv });
  }
  // Copies: one a beat, each drawn in a fraction of a second.
  const n = S.copies.length;
  for (let k = 0; k < n; k++) {
    const c = S.copies[k], at = T.copies + 0.35 + (k / n) * (T.page - T.copies + 1.2);
    const u = span(t, at, at + 0.22, ease.out);
    if (u <= 0) continue;
    const [x, y] = cell(HOME.g, c.i);
    if (toDot > 0) { items.push({ shape: A.cardToDot(toDot, x, y), fill: C.ink, opacity: 0.25 + 0.75 * toDot }); continue; }
    // Each copy flies in from in front of the camera, out of focus, and lands in the grid's plane.
    const sh = copyShape(x, y, c.bars), z = lerp(-520, 0, span(t, at - 0.05, at + 0.55, ease.out));
    items.push({ shape: [sh[0]], stroke: C.ink2, width: 0.08, opacity: u, z });
    items.push({ shape: sh.slice(1), fill: C.dim, opacity: u * 0.8, z });
    if (u < 1) items.push({ shape: arc(x, y, 3.2, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2), stroke: C.ink, width: 0.12, opacity: 1 - u });
  }
  // The search: slow, line by line, and the verdict until it ends.
  const look = span(t, T.look + 0.7, T.pull - 0.1, ease.linear);
  if (look > 0 && look < 1 && toDot <= 0) {
    const k = Math.min(2, Math.floor(look * 3)), u = look * 3 - k, L = S.lines[k].layout;
    const gx = lerp(L.x, L.x + L.width, u), gy = L.y - 0.25;
    items.push({ shape: circle(gx, gy, 0.75, 48), stroke: C.unv, width: 0.08 });
    items.push({ shape: [contour([gx + 0.53, gy + 0.53, gx + 1.25, gy + 1.25], false)], stroke: C.unv, width: 0.1 });
  }
  const unv = window(t, T.look + 0.6, T.pull + 1.4, 0.5, 1.0);
  if (unv > 0) items.push({ shape: S.unverified, fill: C.unv, opacity: unv });
  // Screen captions for this stretch.
  const lab = (sh, a, b) => { const o = window(t, a, b, 0.4, 0.4); if (o > 0) items.push({ ...scrim(sh), opacity: 0.72 * o }, { shape: sh, fill: C.ink, opacity: o, screen: true }); };
  lab(S.labels.fast, T.copies + 0.3, T.page - 0.1);
  lab(S.labels.page, T.page, T.look - 0.1);
  lab(S.labels.look, T.look, T.pull + 0.6);
}

// The camera from the title to the end of the pull-back.
export function camera(t, A, T, reduced) {
  const S = A.s1;
  const Z0 = 68, Z1 = 15, Z2 = 40;
  const fly = (u, za, zb, ca, cb) => {
    // Interpolate zoom in log space and the centre so the screen moves evenly.
    const z = Math.exp(lerp(Math.log(za), Math.log(zb), u));
    const w = (1 / z - 1 / za) / (1 / zb - 1 / za || 1);
    return { x: lerp(ca[0], cb[0], w), y: lerp(ca[1], cb[1], w), zoom: z };
  };
  const home = [S.cx, S.cy], world = [960, 545];
  const step = (u) => (reduced ? (u < 0.5 ? 0 : 1) : u);
  if (t < T.copies + 0.2) return { x: S.cx, y: S.cy, zoom: Z0 };
  if (t < T.look) return { ...fly(step(span(t, T.copies + 0.2, T.copies + 2.6, ease.inOut)), Z0, Z1, home, home), aperture: 0.6 };
  if (t < T.pull) return fly(step(span(t, T.look, T.look + 1.2, ease.inOut)), Z1, Z2, home, home);
  return fly(step(span(t, T.pull, T.pull + 4.6, ease.inOut)), Z2, 1, home, world);
}
export { SPACING, translateShape };
