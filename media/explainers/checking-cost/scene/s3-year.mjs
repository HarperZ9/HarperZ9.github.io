// Segment 3, "A year of checking" (Aczel, Szaszi and Holcombe 2021).
// One review is six hour squares that fill one after another. The six become
// one review cell, and the camera pulls back through powers of ten while the
// square of reviews grows to 21,800,126; every review then splits into its six
// hours (130,800,757) and the sum is turned into years (14,932, the paper's
// figure). The estimate's edge is drawn soft, with the authors' own caveat.
import { rect, contour, trim } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { morph } from "../../../raw-native/web-23ec93f/motion/morph.mjs";
import { text, tex, fmt } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp, lerpLog } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, brace, dashed } from "./lib.mjs";
import { cell } from "./s2-list.mjs";

const CELL = 3, GAP = 0.45, REVIEWS = 21800126, HOURS = 130800757;
export const ORIGIN = { g: 1, i: 9 * 23 + 11 };   // a real reference in the GPT-4 grid

export function prepare(A) {
  const [ox, oy] = cell(ORIGIN.g, ORIGIN.i);
  const hours = Array.from({ length: 6 }, (_, k) => rect(ox + (k - 2.5) * (CELL + GAP) - CELL / 2, oy - CELL / 2, CELL, CELL, 0.12));
  const left = ox - 2.5 * (CELL + GAP) - CELL / 2, right = ox + 2.5 * (CELL + GAP) + CELL / 2;
  const one = rect(ox - CELL / 2, oy - CELL / 2, CELL, CELL, 0.12);
  A.s3 = {
    ox, oy, hours, one, left, right,
    sixToOne: morph(hours.flat(), one, { density: 0.05 }),
    brace: brace(left, right, oy + CELL / 2 + 0.6, 0.9),
    review: text("one peer review: about 6 hours", { atlas: A.sans, size: 0.95, x: ox, y: oy + CELL / 2 + 3.1, anchor: "center" }).shape,
    hourTag: text("1 hour", { atlas: A.sans, size: 0.62, x: left + CELL / 2, y: oy - CELL / 2 - 0.6, anchor: "center" }).shape,
    eqHours: tex("21{,}800{,}126 \\times 6\\,\\text{hours} \\approx 130{,}800{,}757\\,\\text{hours}", { atlas: A.mono, size: 44, x: 960, y: 150, anchor: "center" }).shape,
    eqYears: tex("130{,}800{,}757\\,\\text{hours} \\div 8{,}760 \\approx 14{,}932\\,\\text{years}", { atlas: A.mono, size: 44, x: 960, y: 150, anchor: "center" }).shape,
    years: text("about 15,000 years of work, spent in one year", { atlas: A.head, size: 46, x: 960, y: 960, anchor: "center" }).shape,
    caveat: text("an estimate from approximate rates; the authors expect the true figure to be higher", { atlas: A.sans, size: 28, x: 960, y: 1010, anchor: "center" }).shape,
    paper: text("the paper's own figures", { atlas: A.sans, size: 24, x: 960, y: 196, anchor: "center" }).shape,
    pays: text("Science already pays people to check.", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }).shape,
  };
}

// Side of the square of reviews (in world units) at time t, and the count shown.
function reviews(t, T) {
  const u = span(t, T.count, T.count + 4.6, ease.inOut);
  const n = u >= 1 ? REVIEWS : Math.max(1, Math.round(lerpLog(1, REVIEWS, u)));
  return n;
}
function side(t, T, hours = 6) {
  const n = reviews(t, T);
  const h = span(t, T.six, T.six + 2.2, ease.inOut);
  return CELL * Math.sqrt(n) * lerp(1, Math.sqrt(hours), h);
}
const texNum = (n) => fmt(n).replace(/,/g, "{,}");
// The arithmetic at a chosen number of hours per review; at 6 it is the paper's own.
function sums(A, hours) {
  const S = A.s3;
  if (hours === 6) return { eqHours: S.eqHours, eqYears: S.eqYears, years: S.years, note: S.paper };
  const key = String(hours);
  S.what = S.what || new Map();
  if (!S.what.has(key)) {
    const total = REVIEWS * hours, years = Math.round(total / 8760);
    const eq = (src) => tex(src, { atlas: A.mono, size: 44, x: 960, y: 150, anchor: "center" }).shape;
    S.what.set(key, {
      eqHours: eq(`21{,}800{,}126 \\times ${hours}\\,\\text{hours} = ${texNum(total)}\\,\\text{hours}`),
      eqYears: eq(`${texNum(total)}\\,\\text{hours} \\div 8{,}760 \\approx ${texNum(years)}\\,\\text{years}`),
      years: text(`about ${fmt(years)} years of work, at ${hours} hours a review`, { atlas: A.head, size: 46, x: 960, y: 960, anchor: "center" }).shape,
      note: text("your value; the paper uses about 6 hours a review", { atlas: A.sans, size: 24, x: 960, y: 196, anchor: "center" }).shape,
    });
  }
  return S.what.get(key);
}

export function camera(t, A, T, reduced, from) {
  const S = A.s3, step = (u) => (reduced ? (u < 0.5 ? 0 : 1) : u);
  const block = { x: S.ox, y: S.oy, zoom: 44 };
  if (t < T.count) {
    const u = step(span(t, T.enter, T.enter + 2.2, ease.inOut));
    const z = lerpLog(from.zoom, block.zoom, u), w = (1 / z - 1 / from.zoom) / (1 / block.zoom - 1 / from.zoom);
    return { x: lerp(from.x, block.x, w), y: lerp(from.y, block.y, w), zoom: z };
  }
  // The square grows from the review cell's top-left corner; keep it framed.
  const L = side(t, T, A.params ? A.params.hours : 6), x0 = S.ox - CELL / 2, y0 = S.oy - CELL / 2;
  const fit = Math.min(44, 600 / L);
  const out = span(t, T.exit - 1.3, T.exit, ease.in);
  return { x: x0 + L / 2, y: y0 + L / 2, zoom: fit * lerpLog(1, 0.02, out) };
}

export function draw(t, A, T, items, zoom) {
  const S = A.s3, hours = A.params ? A.params.hours : 6, Q = sums(A, hours);
  const vis = window(t, T.enter, T.exit + 0.4, 0.6, 0.6);
  if (vis <= 0) return;
  const scr = (shape, color, o) => { if (o > 0) items.push({ shape, fill: color, opacity: o * vis, screen: true }); };
  scr(S.pays, C.ink, window(t, T.enter + 0.4, T.review - 0.1, 0.5, 0.4));
  // Six hours: each square fills like a clock face sweeping.
  const collapse = span(t, T.count - 0.2, T.count + 0.6, ease.inOut);
  if (collapse <= 0) {
    for (let k = 0; k < 6; k++) {
      const f = span(t, T.review + 0.6 + k * 0.62, T.review + 1.2 + k * 0.62, ease.out);
      items.push({ shape: S.hours[k], stroke: C.ink2, width: 0.08, opacity: span(t, T.enter + 0.8, T.enter + 1.8) });
      if (f > 0) items.push({ shape: rect(S.ox + (k - 2.5) * (CELL + GAP) - CELL / 2, S.oy + CELL / 2 - CELL * f, CELL, CELL * f, 0.1), fill: C.ink, opacity: 0.85 });
    }
    const b = span(t, T.review + 3.4, T.review + 4.4, ease.out);
    if (b > 0) {
      items.push({ shape: trim(S.brace, 0, b), stroke: C.ink2, width: 0.09 });
      items.push({ shape: S.review, fill: C.ink, opacity: b });
    }
    items.push({ shape: S.hourTag, fill: C.ink2, opacity: window(t, T.review + 0.6, T.review + 3.5, 0.4, 0.6) });
  } else if (collapse < 1) {
    items.push({ shape: S.sixToOne(collapse), fill: C.ink, opacity: 0.85 });
  }
  // The square of reviews (then hours), with grid lines at every power of ten.
  if (collapse > 0) {
    const L = side(t, T, hours), x0 = S.ox - CELL / 2, y0 = S.oy - CELL / 2;
    const h = span(t, T.six, T.six + 2.2, ease.inOut);
    const unit = lerp(CELL, CELL / Math.sqrt(6), h);        // a review cell, then an hour cell
    let finest = -1;
    items.push({ shape: rect(x0, y0, L, L), fill: C.ink, opacity: 0.1 * collapse });
    items.push({ shape: rect(x0, y0, L, L), stroke: C.ink, width: 1.6 / zoom, opacity: collapse });
    for (let j = 0; j < 8; j++) {
      const sp = unit * Math.pow(10, j), px = sp * zoom;
      const a = span(px, 5, 40, ease.linear) * (1 - span(px, 500, 2000, ease.linear));
      if (a <= 0.01 || sp >= L) continue;
      const lines = [];
      for (let v = sp; v < L - 1e-9; v += sp) { lines.push(contour([x0 + v, y0, x0 + v, y0 + L], false), contour([x0, y0 + v, x0 + L, y0 + v], false)); }
      items.push({ shape: lines, stroke: C.ink2, width: 1 / zoom, opacity: a * 0.55 * collapse });
      if (finest < 0 && a > 0.3) finest = j;
    }
    // Name the smallest square still drawn: the scale the camera has reached.
    if (finest >= 0 && t < T.caveat) {
      const n = Math.pow(10, finest), unitName = h < 0.5 ? (n === 1 ? "review" : "reviews") : (n === 1 ? "hour" : "hours");
      const sh = text(`each small square: ${fmt(n)} ${unitName}`, { atlas: A.mono, size: 30, x: 960, y: 925, anchor: "center" }).shape;
      items.push({ shape: sh, fill: C.ink2, opacity: vis * collapse * (1 - span(t, T.caveat - 0.8, T.caveat)), screen: true });
    }
    // The estimate's edge: a soft, larger outline that keeps growing.
    const cav = span(t, T.caveat, T.caveat + 3.5, ease.out);
    if (cav > 0) {
      const g = L * lerp(1, 1.12, cav);
      items.push({ shape: [...dashed(x0, y0, x0 + g, y0, 12 / zoom, 9 / zoom), ...dashed(x0 + g, y0, x0 + g, y0 + g, 12 / zoom, 9 / zoom),
        ...dashed(x0 + g, y0 + g, x0, y0 + g, 12 / zoom, 9 / zoom), ...dashed(x0, y0 + g, x0, y0, 12 / zoom, 9 / zoom)], stroke: C.unv, width: 1.6 / zoom, opacity: cav });
    }
  }
  // The count and the arithmetic, in screen space.
  const counting = window(t, T.count, T.six + 0.2, 0.4, 0.3);
  if (counting > 0) scr(text(`${fmt(reviews(t, T))} reviews in 2020`, { atlas: A.mono, size: 44, x: 960, y: 150, anchor: "center" }).shape, C.ink, counting);
  const eqH = window(t, T.six + 0.2, T.years + 0.2, 0.5, 0.4), eqY = window(t, T.years + 0.2, T.exit, 0.5, 0.4);
  scr(Q.eqHours, C.ink, eqH);
  scr(Q.eqYears, C.ink, eqY);
  scr(Q.note, C.ink2, Math.max(eqH, eqY) * 0.9);
  scr(Q.years, C.ink, window(t, T.years + 0.8, T.exit, 0.6, 0.4));
  scr(S.caveat, C.unv, window(t, T.caveat, T.exit, 0.6, 0.4));
}
