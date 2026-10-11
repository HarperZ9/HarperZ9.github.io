// Title and segment 1, "Every test passes". The code lines converge into an aperture
// around the title, then lay themselves out as a program. Three tests sweep it like
// light; the lines each one runs glow, and each lands "pass". The camera then dollies to
// the changed line, which no sweep touched, and a hairline crack opens in it.
import { contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, N, BROKEN, TESTS, lineShape } from "./world.mjs";

const AP = { x: 960, y: 540, r: 330 };

export function prepare(A) {
  const P = A.prog, t = (s, o) => text(s, o);
  // Each line's radial twin: the same number of points along a ray out of the aperture.
  const radial = P.lines.map((L, i) => {
    const th = (i / N) * Math.PI * 2 - Math.PI / 2, n = L.pts.length / 2, len = 60 + L.len * 0.22, o = new Float32Array(L.pts.length);
    for (let k = 0; k < n; k++) { const r = AP.r + (len * k) / Math.max(1, n - 1); o[2 * k] = AP.x + Math.cos(th) * r; o[2 * k + 1] = AP.y + Math.sin(th) * r; }
    return o;
  });
  const B = P.lines[BROKEN], cut = B.x + B.len * 0.55;
  A.p1 = {
    radial,
    title: [t("A passing check", { atlas: A.head, size: 58, x: AP.x, y: AP.y - 8, anchor: "center" }).shape,
      t("can still be wrong.", { atlas: A.head, size: 58, x: AP.x, y: AP.y + 62, anchor: "center" }).shape],
    names: TESTS.map((s, k) => t(s, { atlas: A.mono, size: 30, x: 1330, y: 330 + k * 56 }).shape),
    pass: TESTS.map((_, k) => t("pass", { atlas: A.mono, size: 30, x: 1660, y: 330 + k * 56 }).shape),
    changed: t("changed", { atlas: A.mono, size: 20, x: B.x - 16, y: B.y + 6, anchor: "right" }).shape,
    never: t("never run by any test", { atlas: A.mono, size: 30, x: 960, y: 640, anchor: "center" }).shape,
    found: t("a pass: the check found nothing", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }).shape,
    could: t("not: the check could have found it", { atlas: A.sans, size: 34, x: 960, y: 1004, anchor: "center" }).shape,
    // The crack: a gap in the line and a jagged hairline across it.
    crackAt: cut,
    crack: [contour(new Float32Array([cut - 2, B.y - 10, cut + 1.8, B.y - 5, cut - 1.2, B.y - 0.5, cut + 2.2, B.y + 4, cut - 0.6, B.y + 9.5]), false)],
  };
}

// The part of a polyline with x in [a, b], cut at exact interpolated points.
function clip(p, a, b) {
  const out = [];
  for (let k = 0; k + 2 < p.length; k += 2) {
    const x0 = p[k], y0 = p[k + 1], x1 = p[k + 2], y1 = p[k + 3];
    const lo = Math.max(a, Math.min(x0, x1)), hi = Math.min(b, Math.max(x0, x1));
    if (lo > hi) continue;
    const at = (x) => [x, y0 + (y1 - y0) * ((x - x0) / (x1 - x0 || 1))];
    const s = at(x0 < x1 ? lo : hi), e = at(x0 < x1 ? hi : lo);
    if (!out.length || out[out.length - 2] !== s[0]) out.push(...s);
    out.push(...e);
  }
  return new Float32Array(out);
}

// How far each test's sweep has passed down the program at time t (0 to 1).
export const sweep = (t, T, k) => span(t, T.passes + k * 0.6, T.passes + k * 0.6 + 0.9, ease.inOut);

export function camera(t, T, A) {
  const B = A.prog.lines[BROKEN], tx = A.p1.crackAt, ty = B.y;
  const inU = span(t, T.never, T.never + 2.0, ease.inOut), outU = span(t, T.found, T.found + 1.8, ease.inOut);
  const u = inU * (1 - outU), z = Math.exp(lerp(0, Math.log(3.0), u));
  return { x: lerp(960, tx, u), y: lerp(545, ty, u), zoom: z };
}

export function draw(t, A, T, items) {
  const S = A.p1, P = A.prog;
  if (t > T.exit + 0.5) return;
  // Title: the lines fly in to the aperture, then lay out as the program.
  const inU = span(t, 0, 2.6, ease.out), lay = span(t, T.enter, T.enter + 1.5, ease.inOut);
  const titleA = window(t, 0.4, T.enter - 0.1, 0.8, 0.5);
  if (titleA > 0) for (const sh of S.title) items.push({ shape: sh, fill: C.ink, opacity: titleA });
  const lit = new Float32Array(N);
  for (let k = 0; k < 3; k++) {
    const u = sweep(t, T, k), yb = lerp(P.box.y0, P.box.y1, u);
    for (const i of P.runs[k]) if (P.lines[i].y < yb) lit[i] = Math.max(lit[i], 1);
  }
  const dimLit = 1 - 0.45 * span(t, T.could, T.could + 1.2);
  for (let i = 0; i < N; i++) {
    const L = P.lines[i], R = S.radial[i], o = new Float32Array(L.pts.length);
    const far = lerp(2.3, 1, inU);
    for (let k = 0; k < o.length; k += 2) {
      const rx = AP.x + (R[k] - AP.x) * far, ry = AP.y + (R[k + 1] - AP.y) * far;
      o[k] = lerp(rx, L.pts[k], lay); o[k + 1] = lerp(ry, L.pts[k + 1], lay);
    }
    let shape = [contour(o, false)];
    if (i === BROKEN && lay >= 1) {
      // Split the broken line at the crack once the crack opens.
      const gap = 2.2 * span(t, T.never + 0.6, T.never + 1.8, ease.out);
      if (gap > 0) {
        shape = [clip(o, -Infinity, S.crackAt - gap), clip(o, S.crackAt + gap, Infinity)].filter((p) => p.length >= 4).map((p) => contour(p, false));
      }
    }
    const base = lerp(0.85, 0.3, lay), op = Math.min(1, base + 0.55 * lit[i] * dimLit) * Math.min(1, inU * 1.5 + 0.2);
    items.push({ shape, stroke: C.ink, width: 1.5, opacity: op * window(t, -1, T.exit, 1, 0.5) });
    if (lit[i] > 0) items.push({ shape, stroke: C.ink, width: 3.6, opacity: 0.12 * dimLit, blend: "add" });   // lime is kept for the control
  }
  // The sweeps themselves: a soft band of light.
  for (let k = 0; k < 3; k++) {
    const u = sweep(t, T, k);
    if (u > 0 && u < 1) {
      const yb = lerp(P.box.y0, P.box.y1, u);
      items.push({ shape: [contour(new Float32Array([P.box.x0, yb, P.box.x1, yb]), false)], stroke: C.ink, width: 2, opacity: 0.55, blend: "add" });
    }
  }
  const scr = (shape, color, o) => { if (o > 0) items.push({ shape, fill: color, opacity: o, screen: true }); };
  const away = 1 - span(t, T.never - 0.3, T.never + 0.4);
  for (let k = 0; k < 3; k++) {
    scr(S.names[k], C.ink2, window(t, T.tests + k * 0.25, T.exit, 0.5, 0.5) * away);
    scr(S.pass[k], C.ink, span(t, T.passes + k * 0.6 + 0.9, T.passes + k * 0.6 + 1.2) * away * window(t, -1, T.exit, 1, 0.5));
  }
  if (t >= T.wrong) items.push({ shape: S.changed, fill: C.ink2, opacity: window(t, T.wrong, T.never + 0.3, 0.5, 0.4) });
  const crackA = span(t, T.never + 0.6, T.never + 1.8, ease.out);
  if (crackA > 0) items.push({ shape: S.crack, stroke: C.hot, width: 0.9, opacity: crackA * window(t, -1, T.exit, 1, 0.5) });
  scr(S.never, C.hot, window(t, T.never + 1.4, T.found + 0.6, 0.5, 0.5));
  scr(S.found, C.ink, window(t, T.found + 0.3, T.exit, 0.5, 0.5));
  scr(S.could, C.ink2, window(t, T.could + 0.2, T.exit, 0.5, 0.5));
}
