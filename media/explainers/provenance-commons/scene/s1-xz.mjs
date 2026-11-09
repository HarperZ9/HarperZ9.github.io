// Segment 1, "One small library" (storyboard shots 1.1 to 1.7). The camera dives into one knot,
// xz, and it opens into a small library: its file tree as plotter lines (no file is named, so
// the picture adds no claim). One maintainer; a newcomer whose patches arrive one by one; a
// signed release buds off; then the public source and the release download side by side, row
// for row, with the one row that exists only in the download lit in drift (the film's hot mark).
// Last, the login that ran slow, as two bars drawn to scale.
import { C, words, plotter, person, drawLens, rect, contour, circle, span, window, ease, lerp, rng, trim } from "./world.mjs";

export const LENS = { x: 960, y: 450, r: 660 };
const ROWS = 14, EXTRA = 10, DY = 28, Y0 = 236;   // EXTRA: the row only the tarball has
const ONE_X = 760, GIT_X = 430, TAR_X = 1000, W = 400;

function tree(seed, extra) {
  const r = rng(seed), rows = [];
  let indent = 0;
  for (let i = 0; i < ROWS + (extra ? 1 : 0); i++) {
    if (r() < 0.3) indent = Math.max(0, Math.min(3, indent + (r() < 0.5 ? -1 : 1)));
    const len = 70 + r() * (W - 70 - indent * 40);
    rows.push({ indent, len });
  }
  return rows;
}

export function prepare(A) {
  const base = tree(2022, false);
  // The download's tree: the same rows, with one more inserted at EXTRA.
  const tar = [...base.slice(0, EXTRA), { indent: 1, len: 300 }, ...base.slice(EXTRA)];
  const shapeRows = (rows, x, skip = -1) => {
    const r = rng(7), out = [];
    rows.forEach((row, i) => { const y = Y0 + i * DY; if (i !== skip) out.push(plotter(x + row.indent * 28, y, row.len, r)); });
    return out;
  };
  const t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  A.s1 = {
    base, tar,
    // The single tree, centred, and the same rows as git (left) and tarball (right, one row more).
    one: shapeRows(base, ONE_X),
    tarRows: shapeRows(tar, TAR_X, EXTRA),
    extra: [plotter(TAR_X + 28, Y0 + EXTRA * DY, 300, rng(5))],
    gap: [contour(new Float32Array([GIT_X + 28, Y0 + EXTRA * DY, GIT_X + 328, Y0 + EXTRA * DY]), false)],
    head: t("xz . a compression library", 44, 960, 158, A.head),
    hGit: t("public source (git)", 30, GIT_X, 200, A.mono, "left"),
    hTar: t("release download (tarball)", 30, TAR_X, 200, A.mono, "left"),
    maint: person(1330, 380, 1.3), newc: person(0, 380, 1.3),
    hobby: t("“this is an unpaid hobby project”", 40, 960, 712),
    since: t("patches since 2021", 30, 1420, 468, A.mono),
    comaint: t("“practically a co-maintainer already”", 40, 960, 712),
    release: t("5.6.0 . signed by the new maintainer", 40, 960, 712),
    onlyTar: t("in the tarball, not in git", 40, 960, 712),
    login: t("a remote login", 34, 470, 330, A.mono, "left"),
    fast: t("about 0.01 s", 36, 500, 444, A.mono, "left"),
    slow: t("about 0.5 s", 36, 1090, 564, A.mono, "left"),
    scale: t("bars drawn to scale", 28, 470, 600, A.mono, "left"),
  };
  // git's rows: the same rows as the tarball's, with an empty slot at EXTRA.
  const r2 = rng(7), gitRows = [];
  base.forEach((row, i) => { const slot = i < EXTRA ? i : i + 1; gitRows.push(plotter(GIT_X + row.indent * 28, Y0 + slot * DY, row.len, r2)); });
  A.s1.git = gitRows;
  A.s1.box = rect(1150, 620, 70, 46, 4);
}

const offset = (shape, dx, dy = 0) => shape.map((c) => { const p = new Float32Array(c.pts); for (let i = 0; i < p.length; i += 2) { p[i] += dx; p[i + 1] += dy; } return contour(p, c.closed); });

// T: { dive, open, xz, hobby, newc, months, release, only, hold, slow, exit }
export function draw(t, A, T, items) {
  const S = A.s1;
  if (t < T.open - 0.6 || t > T.exit + 1.2) return;
  const lensO = span(t, T.open - 0.6, T.open + 0.6, ease.out) * (1 - span(t, T.exit, T.exit + 1.0, ease.inOut));
  const r = LENS.r * span(t, T.open - 0.6, T.open + 0.9, ease.out) * (1 - 0.95 * span(t, T.exit, T.exit + 1.0, ease.inOut));
  drawLens(items, LENS.x, LENS.y, r, lensO);
  const vis = lensO;
  const put = (shape, fill, o, extra = {}) => { if (o * vis > 0.003) items.push({ shape, fill, opacity: o * vis, screen: true, ...extra }); };
  const line = (shape, stroke, o, width = 1.6) => { if (o * vis > 0.003) items.push({ shape, stroke, width, opacity: o * vis, screen: true }); };
  // The library's file tree draws itself in as the knot opens, then splits into two trees.
  const split = span(t, T.only - 0.2, T.only + 1.8, ease.inOut);
  const dimForBars = 1 - 0.75 * span(t, T.slow - 0.2, T.slow + 0.8);
  const grow = span(t, T.open, T.open + 1.6, ease.out);
  line(trim(S.one, 0, grow), C.ink, 0.85 * (1 - split));
  line(S.git, C.ink, 0.85 * split * dimForBars);
  line(S.tarRows, C.ink, 0.85 * split * dimForBars);
  // The row only the tarball has: the hot mark (motif), and git's empty slot dashed.
  const only = span(t, T.only + 0.6, T.only + 1.6);
  line(S.extra, C.hot, only * dimForBars, 4);
  if (only > 0) items.push({ shape: S.extra, stroke: C.hot, width: 14, blur: 8, opacity: 0.35 * only * dimForBars * vis, screen: true });
  if (only > 0) put(circle(TAR_X - 14, Y0 + EXTRA * DY, 5, 16), C.hot, only * dimForBars);
  if (only > 0 && vis > 0) items.push({ shape: S.gap, stroke: C.dim, width: 1.2, dash: [6, 8], opacity: 0.7 * only * vis * dimForBars, screen: true });
  put(S.hGit, C.ink2, split * dimForBars); put(S.hTar, C.ink2, split * dimForBars);
  put(S.head, C.ink, window(t, T.xz, T.only, 0.6, 0.6));
  // The maintainer, alone; then the newcomer arrives with patches, one per beat.
  const solo = window(t, T.hobby - 0.2, T.only, 0.8, 0.8);
  line(S.maint, C.ink, solo, 2);
  put(S.hobby, C.ink, window(t, T.hobby, T.months, 0.6, 0.5));
  const nx = lerp(1720, 1470, span(t, T.newc - 0.3, T.newc + 1.4, ease.out));
  line(offset(S.newc, nx), C.ink, window(t, T.newc - 0.3, T.only, 0.6, 0.8), 2);
  put(S.since, C.ink2, window(t, T.newc + 0.4, T.months, 0.6, 0.6));
  const env = [];
  for (let k = 0; k < 6; k++) {
    const a = T.newc + 0.6 + k * 0.55, u = span(t, a, a + 1.1, ease.inOut);
    if (u <= 0 || u >= 1) continue;
    const x = lerp(nx - 40, ONE_X + 420, u), y = lerp(370, Y0 + (2 + k * 2) * DY, u);
    env.push(...rect(x - 13, y - 9, 26, 18, 2), contour(new Float32Array([x - 13, y - 9, x, y + 2, x + 13, y - 9]), false));
  }
  if (env.length) line(env, C.ink2, window(t, T.newc, T.release, 0.4, 0.4), 1.4);
  put(S.comaint, C.ink, window(t, T.months, T.release, 0.6, 0.5));
  // The release: a box buds off the tree and the newcomer signs it.
  const bud = span(t, T.release - 0.1, T.release + 1.0, ease.out);
  const rel = window(t, T.release - 0.1, T.only + 0.8, 0.4, 0.8);
  line(offset(S.box, 0, lerp(-200, 0, bud)), C.ink, rel * bud, 1.8);
  const sig = span(t, T.signed, T.signed + 0.8, ease.inOut);
  if (sig > 0) line(trim([contour(new Float32Array([1158, 652, 1170, 644, 1180, 656, 1192, 640, 1206, 652, 1212, 646]), false)], 0, sig), C.ink, rel, 1.6);
  put(S.release, C.ink, window(t, T.release, T.only, 0.6, 0.5));
  put(S.onlyTar, C.hot, window(t, T.only + 0.6, T.slow, 0.6, 0.6));
  // The slow login: 0.01 s against 0.5 s, the bars to the same scale (600 px for 0.5 s).
  const b = window(t, T.slow, T.exit, 0.6, 0.8);
  if (b > 0) {
    const g1 = span(t, T.slow + 0.2, T.slow + 1.2, ease.out), g2 = span(t, T.slowWord, T.slowWord + 1.6, ease.out);
    put(S.login, C.ink2, b);
    put(rect(470, 420, Math.max(1, 12 * g1), 22, 2), C.ink, b);
    put(S.fast, C.ink, b * g1);
    put(rect(470, 540, Math.max(1, 600 * g2), 22, 2), C.ink, b);
    put(S.slow, C.ink, b * g2);
    put(S.scale, C.dim, b * g2 * 0.9);
  }
}
