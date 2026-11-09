// forge/family/svg.mjs
// TrueType contours (on/off-curve points) to SVG path data, read the way a rasteriser reads them:
// two off-curve points in a row imply an on-curve point at their midpoint. Proof sheets drawn with this
// show exactly the curves the font files carry.

const f1 = (v) => (Math.round(v * 10) / 10).toString();

export function contourD(c, dx = 0, dy = 0, s = 1, H = 0) {
  const P = c.pts.map(([x, y]) => [dx + x * s, H - (dy + y * s)]), on = c.on, n = P.length;
  if (!n) return "";
  let start = on.indexOf(true), pts = P, flags = on;
  if (start < 0) {   // all off-curve: start at an implied midpoint
    const m = [(P[0][0] + P[n - 1][0]) / 2, (P[0][1] + P[n - 1][1]) / 2];
    pts = [m, ...P]; flags = [true, ...on]; start = 0;
  } else { pts = P.slice(start).concat(P.slice(0, start)); flags = on.slice(start).concat(on.slice(0, start)); }
  const N = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 1; i <= N; i++) {
    const p = pts[i % N], fp = flags[i % N];
    if (fp) { d += `L${f1(p[0])} ${f1(p[1])}`; continue; }
    const q = pts[(i + 1) % N], fq = flags[(i + 1) % N];
    const end = fq ? q : [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += `Q${f1(p[0])} ${f1(p[1])} ${f1(end[0])} ${f1(end[1])}`;
    if (fq) i++;
  }
  return d + "Z";
}

export const glyphD = (g, dx, dy, s, H) => g.contours.map((c) => contourD(c, dx, dy, s, H)).join("");

// Resolve a composite into plain contours (components shifted), recursively.
export function flatten(glyphs, name, dx = 0, dy = 0, depth = 0) {
  const g = glyphs[name];
  if (!g || depth > 4) return [];
  const own = (g.contours || []).map((c) => ({ pts: c.pts.map(([x, y]) => [x + dx, y + dy]), on: c.on }));
  for (const cmp of g.components || []) own.push(...flatten(glyphs, cmp.name, dx + cmp.dx, dy + cmp.dy, depth + 1));
  return own;
}
