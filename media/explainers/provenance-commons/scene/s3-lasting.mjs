// Segment 3, "What lasting commons do" (shots 3.1 to 3.5). Three small worlds sit in the net as
// knots with their members around them: water, trees, channels. An octagonal lens forms over one,
// one facet per design principle, and two brighten: making the rules (3) and monitoring (4). The
// members link to each other with short threads, and no tower appears. Then the review, as a
// share bar (the lecture gives "over 100" studies, not a count to draw one mark each), and the
// 178 forest user groups as 178 rings, one ring per group, arranged by us.
import { C, words, drawLens, lensShape, contour, circle, rect, span, window, ease, lerp, rng } from "./world.mjs";

const CX = 960, CY = 450, R = 300;
// The three worlds, in world units around the 'lasting' knot (700, 300).
export const WORLDS = [[600, 250], [700, 300], [790, 248]];

function icons() {
  const [[ax, ay], [bx, by], [cx, cy]] = WORLDS, out = [];
  const big = (sh, x, y) => sh.map((c) => { const p = new Float32Array(c.pts); for (let i = 0; i < p.length; i += 2) { p[i] = x + (p[i] - x) * 1.8; p[i + 1] = y + (p[i + 1] - y) * 1.8; } return contour(p, c.closed); });
  // Water: two wave lines. Trees: two small triangles. Channels: a stem with two branches.
  for (const dy of [-3, 3]) { const p = []; for (let k = 0; k <= 12; k++) p.push(ax - 12 + k * 2, ay - 14 + dy + Math.sin(k * 0.9) * 1.6); out.push(contour(new Float32Array(p), false)); }
  for (const dx of [-6, 6]) out.push(contour(new Float32Array([bx + dx - 5, by - 10, bx + dx, by - 20, bx + dx + 5, by - 10]), true));
  out.push(contour(new Float32Array([cx, cy - 6, cx, cy - 22]), false), contour(new Float32Array([cx, cy - 14, cx - 8, cy - 22]), false), contour(new Float32Array([cx, cy - 14, cx + 8, cy - 22]), false));
  return [...big(out.slice(0, 2), ax, ay), ...big(out.slice(2, 4), bx, by), ...big(out.slice(4), cx, cy)];
}

export function prepare(A) {
  const r = rng(2010);
  const members = WORLDS.flatMap(([x, y]) => Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + r(); return [x + Math.cos(a) * 26, y + Math.sin(a) * 18]; }));
  // Facets: eight triangles from the centre to the octagon's edges.
  const oct = lensShape(CX, CY, R, 8)[0].pts, facets = [];
  for (let k = 0; k < 8; k++) { const j = (k + 1) % 8; facets.push([contour(new Float32Array([CX, CY, oct[2 * k], oct[2 * k + 1], oct[2 * j], oct[2 * j + 1]]), true)]); }
  // The users around the rim, linked to each other (monitoring among them).
  const users = Array.from({ length: 8 }, (_, k) => { const a = -Math.PI / 2 + (k / 8) * Math.PI * 2; return [CX + Math.cos(a) * (R + 40), CY + Math.sin(a) * (R + 40)]; });
  const links = users.map(([x, y], k) => { const [u, v] = users[(k + 1) % 8]; return contour(new Float32Array([x, y, u, v]), false); });
  // 178 rings in rows of 18 (the last row holds 16): one ring per forest user group.
  const rings = [];
  for (let i = 0; i < 178; i++) { const x = CX - 17 * 21 + (i % 18) * 42, y = 268 + Math.floor(i / 18) * 42; rings.push(...circle(x, y, 13, 24), ...circle(x, y, 9, 20)); }
  const t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  // Facet labels sit outside the octagon, beside facets 3 and 4 (counted clockwise from the top).
  const mid = (k) => { const j = (k + 1) % 8; return [(oct[2 * k] + oct[2 * j]) / 2, (oct[2 * k + 1] + oct[2 * j + 1]) / 2]; };
  // The two lit facets face the right side, where their labels have room above the captions.
  const [f3x, f3y] = mid(0), [f4x, f4y] = mid(1);
  A.s3 = {
    icons: icons(), members, facets, users, links, rings,
    eight: t("8 principles", 44, 960, 128, A.head),
    p3: t("the users make the rules", 32, f3x + 70, f3y + 4, A.mono, "left"),
    p4: t("the users watch each other", 32, f4x + 110, f4y + 40, A.mono, "left"),
    accountable: t("“accountable to or are the users”", 40, 960, 712),
    review: t("over 100 studies . about two thirds supported", 40, 960, 380),
    corr: t("correlational field studies", 30, 960, 560, A.mono),
    groups: t("178 groups . more monitoring, denser forest", 40, 960, 748),
    oneRing: t("1 ring = 1 forest user group . arrangement, not data", 28, 960, 236, A.mono),
    aCorr: t("a correlation", 30, 960, 112, A.mono),
  };
}

// T: { enter, eight, rules, watch, review, groups, exit }
export function draw(t, A, T, items, cam) {
  const S = A.s3;
  if (t < T.enter - 0.5 || t > T.exit + 1.2) return;
  const all = window(t, T.enter - 0.5, T.exit, 0.8, 1.0);
  // In the net (world units): the three small worlds and their members.
  const w = all * (1 - span(t, T.eight, T.eight + 1.0));
  if (w > 0.003) {
    items.push({ shape: S.icons, stroke: C.ink, width: 1.4, opacity: w });
    const dots = S.members.flatMap(([x, y]) => circle(x, y, 3, 10));
    items.push({ shape: dots, fill: C.ink2, opacity: 0.9 * w });
  }
  // The octagon opens over the middle world; it grows to hold the review and the rings.
  const open = span(t, T.eight - 0.4, T.eight + 0.9, ease.out), big = span(t, T.review - 0.6, T.review + 0.8, ease.inOut);
  const o = all * open;
  drawLens(items, CX, CY + 20 * big, lerp(R, 640, big) * open, o, 8);
  const put = (shape, fill, a) => { if (a * o > 0.003) items.push({ shape, fill, opacity: a * o, screen: true }); };
  const line = (shape, stroke, a, width = 1.4) => { if (a * o > 0.003) items.push({ shape, stroke, width, opacity: a * o, screen: true }); };
  const fac = 1 - big;
  S.facets.forEach((f, k) => {
    const lit = k === 0 ? span(t, T.rules, T.rules + 0.8) : k === 1 ? span(t, T.watch, T.watch + 0.8) : 0;
    line(f, C.ink2, (0.35 + 0.5 * lit) * fac * span(t, T.eight, T.eight + 0.2 + k * 0.12), 1.2);
    if (lit > 0) put(f, C.ink, 0.16 * lit * fac);
  });
  put(S.eight, C.ink, window(t, T.eight, T.review, 0.6, 0.6));
  put(S.p3, C.ink, span(t, T.rules, T.rules + 0.8) * fac);
  put(S.p4, C.ink, span(t, T.watch, T.watch + 0.8) * fac);
  // The users around the rim; on "watch" they link to each other.
  const u = window(t, T.rules - 0.4, T.review, 0.8, 0.6);
  put(S.users.flatMap(([x, y]) => circle(x, y, 6, 16)), C.ink, u);
  const ln = span(t, T.watch + 0.3, T.watch + 1.6, ease.inOut);
  if (ln > 0) line(S.links.slice(0, Math.ceil(ln * 8)), C.ink, u, 1.4);
  put(S.accountable, C.ink, window(t, T.watch + 0.2, T.review, 0.6, 0.5));
  // The review as a share: two thirds lit, a third outlined.
  const rv = window(t, T.review, T.groups, 0.6, 0.6), fill = span(t, T.twoThirds, T.twoThirds + 1.0, ease.out);
  if (rv > 0) {
    put(S.review, C.ink, rv);
    line(rect(510, 430, 900, 40, 3), C.ink2, rv, 1.4);
    put(rect(510, 430, 600 * fill, 40, 3), C.ink, rv * 0.9);
    put(S.corr, C.hot, rv * fill);
  }
  // 178 rings land as one texture.
  const g = window(t, T.groups, T.exit, 0.6, 0.8);
  if (g > 0) {
    const n = Math.round(178 * span(t, T.groups, T.groups + 1.6, ease.out));
    line(S.rings.slice(0, n * 2), C.ink, g, 1.2);
    put(S.groups, C.ink, g); put(S.oneRing, C.dim, g);
    put(S.aCorr, C.hot, g * span(t, T.groups + 1.0, T.groups + 1.8));
  }
}
