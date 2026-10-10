// Text and equations as paths. A glyph atlas (scripts/glyph_atlas.py writes
// one from any TrueType or WOFF font you may redistribute) holds each glyph's
// outline as SVG path data in font units, with advances and kerning. Laid-out
// text is a shape like any other, so it can be drawn on, filled, and morphed
// into other text or into a figure.
//
//   const atlas = await (await fetch("hanken-600.json")).json();
//   const t = text("130,800,757 hours", { atlas, size: 64, x: 960, y: 540, anchor: "center" });
//   t.shape         // contours in scene units, y down
//   const eq = tex("21{,}800{,}126 \\times 6\\,\\text{h}", { atlas, size: 64, x: 200, y: 400 });
//
// tex() lays out a small subset of TeX: characters, groups, ^ and _, \frac,
// \text, \times \div \approx \cdot \to \pm \le \ge, and the spaces \, \; \quad.
// A page that loads MathJax can pass its SVG output's path data through
// parsePath() instead; both give shapes.
import { parsePath, transform, contour } from "./path.mjs";

const cache = new WeakMap();
function glyphShape(atlas, ch) {
  let m = cache.get(atlas);
  if (!m) { m = new Map(); cache.set(atlas, m); }
  if (!m.has(ch)) {
    const g = atlas.glyphs[ch] || atlas.glyphs["?"];
    m.set(ch, g && g.d ? parsePath(g.d, { tolerance: atlas.unitsPerEm / 2000 }) : []);
  }
  return m.get(ch);
}
const adv = (atlas, ch) => (atlas.glyphs[ch] || atlas.glyphs["?"] || { adv: atlas.unitsPerEm / 2 }).adv;
const kern = (atlas, a, b) => (atlas.kern && atlas.kern[a + b]) || 0;

// One run of glyphs on a baseline. Returns { shape, glyphs, width, ascent, descent }.
export function glyphRun(str, { atlas, size = 48, x = 0, y = 0, tracking = 0 }) {
  const s = size / atlas.unitsPerEm, glyphs = [], shape = [];
  let pen = 0;
  const chars = [...str];
  chars.forEach((ch, i) => {
    const g = glyphShape(atlas, ch);
    const gx = x + pen * s;
    const placed = transform(g, [s, 0, 0, -s, gx, y]);
    glyphs.push({ ch, x: gx, shape: placed });
    shape.push(...placed);
    pen += adv(atlas, ch) + (i + 1 < chars.length ? kern(atlas, ch, chars[i + 1]) : 0) + tracking * atlas.unitsPerEm;
  });
  return { shape, glyphs, width: pen * s, ascent: atlas.ascender * s, descent: -atlas.descender * s };
}

const ANCHOR = { left: 0, start: 0, center: 0.5, middle: 0.5, right: 1, end: 1 };
export function text(str, { atlas, size = 48, x = 0, y = 0, anchor = "left", tracking = 0 }) {
  const run = glyphRun(str, { atlas, size, x: 0, y: 0, tracking });
  const dx = x - run.width * (ANCHOR[anchor] ?? 0);
  return place(run, dx, y);
}
function place(run, dx, dy) {
  const m = [1, 0, 0, 1, dx, dy];
  const glyphs = run.glyphs.map((g) => ({ ...g, x: g.x + dx, shape: transform(g.shape, m) }));
  return { ...run, glyphs, shape: glyphs.flatMap((g) => g.shape), x: dx, y: dy };
}

// Group thousands: 130800757 -> "130,800,757".
export function fmt(n, digits = 0) {
  const [i, f] = Math.abs(n).toFixed(digits).split(".");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
}

// --- A small TeX subset -------------------------------------------------------
const SYMBOLS = { times: "\u00d7", div: "\u00f7", approx: "\u2248", cdot: "\u00b7", to: "\u2192", pm: "\u00b1",
  le: "\u2264", ge: "\u2265", minus: "\u2212", uparrow: "\u2191", rightarrow: "\u2192", infty: "\u221e",
  alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4", theta: "\u03b8", lambda: "\u03bb", mu: "\u03bc",
  pi: "\u03c0", sigma: "\u03c3", tau: "\u03c4", phi: "\u03c6", omega: "\u03c9", Delta: "\u0394", Sigma: "\u03a3", sqrt: "\u221a" };
const SPACES = { ",": 0.17, ";": 0.28, quad: 1, qquad: 2, " ": 0.25 };
const BINARY = new Set(["\u00d7", "\u00f7", "\u2248", "\u00b7", "\u2192", "\u00b1", "\u2264", "\u2265", "=", "+", "\u2212", "<", ">"]);

function tokenize(src) {
  const out = [];
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      out.push({ cmd: m[1] }); i += m[0].length;
      if (/^[A-Za-z]/.test(m[1])) while (src[i] === " ") i++;
    } else if (c === "{" || c === "}" || c === "^" || c === "_") { out.push({ op: c }); i++; }
    else if (c === " ") i++;
    else { out.push({ ch: c }); i++; }
  }
  return out;
}

// Parse into a tree: list of atoms { ch } | { space } | { group } | { frac: [a, b] } | { text } with sup/sub.
function parse(toks, pos = { i: 0 }, stop = null) {
  const list = [];
  const atom = () => {
    const t = toks[pos.i++];
    if (!t) return null;
    if (t.op === "{") return { group: parse(toks, pos, "}") };
    if (t.ch !== undefined) return { ch: t.ch };
    if (t.cmd !== undefined) {
      if (t.cmd === "frac") return { frac: [atom(), atom()] };
      if (t.cmd === "text" || t.cmd === "mathrm") {
        const g = toks[pos.i++];
        let s = "";
        if (g && g.op === "{") { while (toks[pos.i] && toks[pos.i].op !== "}") { const u = toks[pos.i++]; s += u.ch ?? (u.cmd === " " ? " " : SYMBOLS[u.cmd] ?? ""); } pos.i++; }
        return { text: s };
      }
      if (SPACES[t.cmd] !== undefined) return { space: SPACES[t.cmd] };
      if (SYMBOLS[t.cmd]) return { ch: SYMBOLS[t.cmd] };
      if (t.cmd === "{" || t.cmd === "}" || t.cmd === "%" || t.cmd === "$") return { ch: t.cmd };
      throw new Error("tex: unsupported command \\" + t.cmd);
    }
    throw new Error("tex: unexpected " + (t.op || "token"));
  };
  while (pos.i < toks.length) {
    const t = toks[pos.i];
    if (stop && t.op === stop) { pos.i++; break; }
    if (t.op === "^" || t.op === "_") {
      pos.i++;
      const prev = list.length ? list[list.length - 1] : (list.push({ group: [] }), list[0]);
      prev[t.op === "^" ? "sup" : "sub"] = atom();
      continue;
    }
    list.push(atom());
  }
  return list;
}

// Lay out a tree at the origin; returns { shape, width, ascent, descent }.
function layout(list, atlas, size) {
  const shape = [];
  let x = 0, asc = size * 0.72, desc = size * 0.22;
  const ex = size * 0.45;
  const put = (box, dx, dy) => { shape.push(...transform(box.shape, [1, 0, 0, 1, dx, dy])); };
  for (const a of list) {
    let box;
    if (a.space !== undefined) { x += a.space * size; continue; }
    if (a.ch !== undefined || a.text !== undefined) {
      const s = a.ch ?? a.text, bin = a.ch !== undefined && BINARY.has(a.ch);
      if (bin) x += size * 0.22;
      const r = glyphRun(s, { atlas, size });
      box = { shape: r.shape, width: r.width, ascent: r.ascent, descent: r.descent };
      put(box, x, 0); x += box.width;
      if (bin) x += size * 0.22;
    } else if (a.group) {
      box = layout(a.group, atlas, size); put(box, x, 0); x += box.width;
    } else if (a.frac) {
      const n = layout(a.frac[0].group || [a.frac[0]], atlas, size * 0.8), d = layout(a.frac[1].group || [a.frac[1]], atlas, size * 0.8);
      const w = Math.max(n.width, d.width) + size * 0.2, axis = -ex * 0.6, rule = Math.max(1, size * 0.05);
      put(n, x + (w - n.width) / 2, axis - rule - n.descent - size * 0.12);
      put(d, x + (w - d.width) / 2, axis + rule + d.ascent + size * 0.12);
      shape.push(contour([x, axis - rule / 2, x + w, axis - rule / 2, x + w, axis + rule / 2, x, axis + rule / 2], true));
      asc = Math.max(asc, -axis + n.ascent + n.descent + size * 0.2); desc = Math.max(desc, axis + d.ascent + d.descent + size * 0.2);
      box = { width: w }; x += w;
    }
    if (a.sup || a.sub) {
      const k = size * 0.62;
      let w = 0;
      if (a.sup) { const s = layout(a.sup.group || [a.sup], atlas, k); put(s, x, -ex * 0.95); w = s.width; asc = Math.max(asc, ex * 0.95 + s.ascent); }
      if (a.sub) { const s = layout(a.sub.group || [a.sub], atlas, k); put(s, x, size * 0.2); w = Math.max(w, s.width); }
      x += w;
    }
  }
  return { shape, width: x, ascent: asc, descent: desc };
}

export function tex(src, { atlas, size = 48, x = 0, y = 0, anchor = "left" }) {
  const box = layout(parse(tokenize(src)), atlas, size);
  const dx = x - box.width * (ANCHOR[anchor] ?? 0);
  return { ...box, shape: transform(box.shape, [1, 0, 0, 1, dx, y]), x: dx, y };
}
