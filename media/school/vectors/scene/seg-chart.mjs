// The first half of the vectors film, on Pylon's chart: the cold open from the harbour, the title,
// one crate as a place and an arrow, arrows adding and stretching, the dot product as the second
// crate swings (with the held question), and the cosine on a gauge.
import { rect, circle, polyline, span, ease, lerp, window, words, label, plate, C } from "../../shared/lib.mjs";
import { K, P, O, desk, paper, arrow, vec, arc, rightMark, crate, tag, pylon, talking } from "./chart.mjs";
import { harbour, sortedThings, S } from "../../../raw-native/tree-ada041f/templates/guides/worlds/harbour.mjs";

export const A_VEC = [4, 1.5];
export const aA = Math.atan2(A_VEC[1], A_VEC[0]);
const polar = (ang, r) => [r * Math.cos(ang), r * Math.sin(ang)];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1], len = (u) => Math.hypot(u[0], u[1]);
export const f2 = (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const PY = [1745, 1015];

// The desk, the chart and Pylon: the base of every chart shot.
export function base(t, A, { dim = 0, grid = 1, axes = 1, talk = true, pose = {} } = {}) {
  return { back: [...desk(t, dim), ...paper(A, { grid, axes })], guide: pylon(t, PY[0], PY[1], 0.52, { talk: talk ? talking(A.rows, t) : 0, ...pose }) };
}
// The readout plate, top left, in screen space: lines of mono text.
export function readout(A, lines, a = 1, { x = 360, y = 40, w = 1000 } = {}) {
  if (a <= 0) return [];
  const out = [{ shape: rect(x, y, w, 30 + 56 * lines.length, 10), fill: [0.06, 0.045, 0.03, 0.86 * a], screen: true }];
  lines.forEach(([s, size = 34, fill = K.night], i) => out.push(label(A, s, size, x + 26, y + 58 + i * 56, fill, "left", a, "mono")));
  return out;
}

// Cold open: the harbour at night in its painted look, the camera pushes to the office window;
// a cut through black to the desk, where the chart slides out from under the lamp.
export function open(t, A, T) {
  if (t < 3.0) {
    const H = harbour(A.W, []), push = span(t, 0, 3.0, ease.inOut), [wx, wy] = S(2, 7.5, 1.6);
    const items = [...H.back, ...sortedThings(H.things), ...H.front, { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, span(t, 2.3, 3.0)] }];
    return { items, camera: { x: lerp(1000, wx, push), y: lerp(560, wy, push), zoom: lerp(0.9, 2.2, push) }, painted: true };
  }
  const B = base(t, A, { talk: false }), slide = span(t, 3.0, T.openEnd + 0.6, ease.out), items = [...desk(t)];
  items.push(...paper(A).map((it) => ({ ...it, opacity: (it.opacity ?? 1) * slide })), ...B.guide);
  items.push(...crate(A, A_VEC, { alpha: span(t, 3.4, 3.9) }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 1 - span(t, 3.0, 3.5)] });
  return { items, camera: { x: 960, y: 540 + 200 * (1 - slide), zoom: 1 } };
}

// Title: the lesson's name stamped on the chart's cartouche.
export function title(t, A, T) {
  const B = base(t, A), items = [...B.back, ...crate(A, A_VEC), ...B.guide], a = window(t, T.say, T.end, 0.6, 0.8), stamp = span(t, T.say, T.say + 0.25, ease.out);
  items.push({ shape: rect(380, 140, 760, 200, 8), fill: [0.95, 0.9, 0.78, 0.92 * a], stroke: K.ink, width: 3 });
  items.push({ shape: words("Vectors", A.head, 104 * (1.3 - 0.3 * stamp), 760, 268, "center"), fill: K.ink, opacity: a * stamp });
  items.push({ shape: words("a list of numbers is a place", A.sans, 34, 760, 318, "center"), fill: K.dim, opacity: span(t, T.sub, T.sub + 0.6) * a });
  return { items, camera: { x: 960, y: 540, zoom: 1 + 0.02 * span(t, T.say, T.end) } };
}

// One crate: dropped, walked to (4 east, 1.5 north), written as a list, then read as an arrow.
export function place(t, A, T) {
  const B = base(t, A), items = [...B.back], drop = span(t, T.here, T.here + 0.6, ease.out), walk = span(t, T.walk, T.walk + 3.6, ease.inOut);
  const [ox, oy] = P([0, 0]), [cx] = P([4 * Math.min(1, walk * 1.6), 0]), north = Math.max(0, walk * 1.6 - 1) / 0.6;
  if (walk > 0) {
    items.push({ shape: polyline([ox, oy, cx, oy]), fill: null, stroke: K.rust, width: 5, dash: [14, 10] });
    for (let k = 1; k <= Math.min(4, Math.floor(walk * 1.6 * 4)); k++) items.push({ shape: words(String(k), A.mono, 26, ...P([k, -0.3]), "center"), fill: K.rust });
    if (north > 0) items.push({ shape: polyline([...P([4, 0]), ...P([4, 1.5 * Math.min(1, north)])]), fill: null, stroke: K.rust, width: 5, dash: [14, 10] });
  }
  const arrowA = span(t, T.arrow, T.arrow + 1.4, ease.inOut), swap = window(t, T.same - 0.2, T.end, 0.4, 0.3) * (0.5 + 0.5 * Math.sin((t - T.same) * 4));
  items.push(...vec(A_VEC, K.ink, 7, arrowA));
  items.push(...crate(A, A_VEC, { lift: 1 - drop, alpha: Math.max(0.15, 1 - 0.85 * arrowA * swap) }));
  if (t >= T.list) items.push(...tag(A, "(4, 1.5)", ...P([4.2, 2.35]), { size: 36, alpha: span(t, T.list, T.list + 0.5) }));
  if (t >= T.vector) items.push(...tag(A, "a vector", ...P([4.2, 3.1]), { size: 28, alpha: span(t, T.vector, T.vector + 0.5), ink: K.rust }));
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 + 0.08 * window(t, T.walk, T.list + 2, 1, 1) } };
}

// Arrows add (tip to tail, the sum, place by place) and stretch (times two, times minus one).
export function arrows(t, A, T) {
  const B = base(t, A), items = [...B.back], b = [1, 2], sum = [5, 3.5], c = [1.5, 0.8];
  const add = window(t, T.add, T.stretch - 0.2, 0.4, 0.5), slide = span(t, T.walk, T.walk + 1.6, ease.inOut), sumG = span(t, T.sum, T.sum + 1.2, ease.inOut);
  if (add > 0) {
    items.push(...vec(A_VEC, K.ink, 7, 1, add), ...vec(b, K.rust, 7, 1, add * (1 - 0.6 * slide)), ...vec(b, K.rust, 7, slide > 0 ? 1 : 0, add, [4 * slide, 1.5 * slide]));
    items.push(...vec(sum, "#3b5a7a", 8, sumG, add));
    if (sumG > 0) items.push(...readout(A, [["(4, 1.5) + (1, 2) = (4 + 1, 1.5 + 2) = (5, 3.5)", 34]], sumG * add));
  }
  const st = span(t, T.stretch, T.stretch + 0.5), two = span(t, T.two, T.two + 1.6, ease.inOut), neg = span(t, T.neg, T.neg + 1.6, ease.inOut);
  if (st > 0) {
    const k = lerp(lerp(1, 2, two), -1, neg);
    items.push(...vec(c, K.ink, 7, 1, 0.3 * st), ...vec([c[0] * k, c[1] * k], K.rust, 8, 1, st));
    items.push(...readout(A, [[`${f2(k)} x (1.5, 0.8) = (${f2(1.5 * k)}, ${f2(0.8 * k)})`, 34]], st));
  }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The game: b swings while the dot product keeps count. During the held question the sum is hidden.
export function bDot(t, T) {
  const r = 3.6, hold = aA + 1.0, right = aA + Math.PI / 2;
  let ang = aA + 0.35 + 0.65 * span(t, T.swing, T.ask.start, ease.inOut);
  if (t >= T.reveal) ang = lerp(hold, right, span(t, T.reveal, T.reveal + 1.2, ease.inOut));
  if (t >= T.tour) {
    const u = t - T.tour;
    ang = lerp(lerp(lerp(right, aA + 0.08, span(u, 0, 2.2, ease.inOut)), right, span(u, 3.2, 4.6, ease.inOut)), aA + 2.3, span(u, 5.6, 7.2, ease.inOut));
    return polar(ang, lerp(r, 2.3, span(u, 5.6, 7.2, ease.inOut)));
  }
  return polar(ang, r);
}
export function dotSeg(t, A, T) {
  const B = base(t, A), items = [...B.back], b = bDot(t, T), d = dot(A_VEC, b), ang = Math.atan2(b[1], b[0]);
  const hidden = t >= T.ask.start && t < T.reveal, isRight = Math.abs(ang - aA - Math.PI / 2) < 0.01 && t >= T.reveal;
  items.push(arc(aA, ang, 1.1, K.rust, 4), ...vec(A_VEC, K.ink, 7), ...vec(b, K.rust, 7));
  if (isRight) items.push(rightMark(aA, 0.45, K.rust));
  items.push(...crate(A, A_VEC, { label: "a" }), ...crate(A, b, { label: "b", colour: "#9a5a3a" }));
  const prods = span(t, T.products, T.products + 0.8);
  items.push(...readout(A, [[`a = (4.00, 1.50)     b = (${f2(b[0])}, ${f2(b[1])})`, 30, K.nightDim],
    [`4.00 x ${f2(b[0])}  +  1.50 x ${f2(b[1])}  =  ${hidden ? "?" : f2(d)}`, 38, isRight ? K.ember : K.night],
    ...(t >= T.named ? [["the dot product", 30, K.nightDim]] : [])], prods));
  // The sum as a bar beside the readout: up for positive, down (rust) for negative.
  if (prods > 0 && !hidden) { const h = Math.max(-150, Math.min(150, d * 12)); items.push({ shape: rect(1390, 190 - Math.max(0, h), 26, Math.abs(h) + 2, 3), fill: d >= 0 ? K.night : K.ember, opacity: prods, screen: true }); }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The catch, then the cosine: b pushed twice as far doubles the dot product; dividing by both
// lengths leaves the cosine, which a gauge shows as b swings.
export function cosSeg(t, A, T) {
  const B = base(t, A), items = [...B.back];
  let L = lerp(2, 4, span(t, T.push + 2.4, T.push + 4.4, ease.inOut)), ang = aA + 0.75;
  if (t >= T.angle && t < T.dial) L = 3 + Math.sin((t - T.angle) * 2.2);
  if (t >= T.dial) {
    const u1 = T.wSame, u2 = T.wZero, u3 = T.wOpp;
    L = 3; ang = lerp(lerp(lerp(aA + 0.75, aA, span(t, u1 - 0.6, u1 + 0.4, ease.inOut)), aA + Math.PI / 2, span(t, u2 - 0.6, u2 + 0.4, ease.inOut)), aA + Math.PI, span(t, u3 - 0.6, u3 + 0.4, ease.inOut));
  }
  const b = polar(ang, L), d = dot(A_VEC, b), la = len(A_VEC), cs = d / (la * L), d1 = dot(A_VEC, polar(aA + 0.75, 2));
  items.push(arc(aA, ang, 1.0, K.rust, 4), ...vec(A_VEC, K.ink, 7), ...vec(b, K.rust, 7), ...crate(A, A_VEC, { label: "a" }), ...crate(A, b, { label: "b", colour: "#9a5a3a" }));
  const hidden = t >= T.push + 2.4 && t < T.reveal;
  const lines = [[`length of b = ${f2(L)}`, 30, K.nightDim], [`a . b = ${hidden ? "?" : f2(d)}${t >= T.reveal && t < T.divide ? `   (was ${f2(d1)}: x 2)` : ""}`, 38]];
  if (t >= T.divide) lines.push([`cosine = a . b / (length a x length b) = ${f2(d)} / (${f2(la)} x ${f2(L)}) = ${f2(cs)}`, 32, K.ember]);
  items.push(...readout(A, lines, 1, { w: 1180 }));
  // The gauge: a half dial from minus one to one, with stop pins at both ends.
  const g = span(t, T.dial - 0.6, T.dial + 0.4);
  if (g > 0) {
    const gx = 1330, gy = 400, R = 150, pin = window(t, T.never, T.end, 0.2, 0.5) * (0.5 + 0.5 * Math.sin(t * 9));
    const half = []; for (let k = 0; k <= 40; k++) { const a = Math.PI * (k / 40); half.push(gx + R * Math.cos(a), gy - R * Math.sin(a)); }
    items.push({ shape: polyline([...half, gx - R, gy], true), fill: [0.97, 0.93, 0.83, 0.95 * g], stroke: K.ink, width: 3 });
    for (const [v, s] of [[1, "1"], [0, "0"], [-1, "-1"]]) { const a = Math.acos(v); items.push({ shape: words(s, A.mono, 26, gx + (R + 30) * Math.cos(a), gy - (R + 30) * Math.sin(a) + 8, "center"), fill: K.ink, opacity: g }); }
    for (const sx of [gx + R, gx - R]) items.push({ shape: circle(sx, gy, 10, 16), fill: K.rust, opacity: g * (0.4 + 0.6 * pin) });
    const na = Math.acos(Math.max(-1, Math.min(1, cs)));
    items.push({ shape: polyline([gx, gy, gx + (R - 18) * Math.cos(na), gy - (R - 18) * Math.sin(na)]), fill: null, stroke: K.rust, width: 6, opacity: g }, { shape: circle(gx, gy, 10, 16), fill: K.ink, opacity: g });
    items.push({ shape: words("cosine", A.sans, 28, gx, gy + 44, "center"), fill: K.dim, opacity: g });
  }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
export { dot, len };
