// forge/family/kern.mjs
// Spacing and kerning from measured white, the upstream forge's "tracy-spacing" and "geometric-kern"
// rules made strong enough for text.
//
// A glyph side becomes a profile: for each horizontal band, how far the ink sits from the edge of the
// advance. The white between two glyphs in a band is the sum of the two profiles, clipped at D (white
// deeper than D reads as open space either way). The measure of a pair blends the mean clipped white
// over the bands both glyphs ink with the nearest approach, so a bar (T) and an open diagonal (V)
// both count.
//
// 1. Spacing: each letter with a straight or round side is moved so it measures like the reference
//    (n for lowercase, H for capitals), within +-30% of the straight sidebearing.
// 2. Kerning: what spacing cannot fix is a property of the pair: the pair is pulled toward the
//    reference white, capped, guarded against collisions, and vetoed for confusable pairs
//    (r+n must never read as m; c+l never as d).

const BAND = 20, D_FRAC = 0.55, BLEND = 0.5, GAIN = 0.7, CAP_FRAC = 0.24, THRESH = 10;
export const VETO_NEGATIVE = new Set(["r n", "r m", "r u", "r h", "c l", "c I", "r r", "v v", "V V", "l l", "I l", "l I", "I I", "1 l", "l 1"]);

function crossings(contours, y) {
  let lo = Infinity, hi = -Infinity;
  for (const c of contours) {
    const P = c.pts, n = P.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % n];
      if ((y0 <= y && y1 >= y) || (y1 <= y && y0 >= y)) {
        const x = y1 === y0 ? Math.min(x0, x1) : x0 + (x1 - x0) * (y - y0) / (y1 - y0);
        const x2 = y1 === y0 ? Math.max(x0, x1) : x;
        lo = Math.min(lo, x); hi = Math.max(hi, x2);
      }
    }
  }
  return lo === Infinity ? null : [lo, hi];
}

export function profile(g, ymin, ymax, contours = g.contours) {
  const L = [], R = [];
  for (let y = ymin + BAND / 2; y < ymax; y += BAND) {
    const c = crossings(contours, y);
    L.push(c ? c[0] : null); R.push(c ? g.advance - c[1] : null);
  }
  return { L, R };
}

export function measure(pa, pb, D) {
  let sum = 0, n = 0, min = Infinity;
  for (let i = 0; i < pa.R.length; i++) {
    if (pa.R[i] === null || pb.L[i] === null) continue;
    const w = pa.R[i] + pb.L[i];
    sum += Math.min(w, D); n++; min = Math.min(min, w);
  }
  if (!n) return null;
  return { A: (1 - BLEND) * (sum / n) + BLEND * Math.min(min, D), min };
}

export function moveGlyph(g, dl, dr) {
  const sh = (p) => [Math.round((p[0] + dl) * 100) / 100, p[1]];
  g.contours = g.contours.map((c) => ({ pts: c.pts.map(sh), on: c.on }));
  g.skeleton = g.skeleton.map((s) => s.map(sh));
  for (const a of Object.keys(g.anchors)) g.anchors[a] += dl;
  if (g.ink) { g.ink.x0 += dl; g.ink.x1 += dl; }
  g.lsb += dl; g.advance = Math.round((g.advance + dl + dr) * 100) / 100;
}

const isUpper = (n) => /^[A-Z]$/.test(n) || ["AE", "OE", "Oslash", "Thorn", "Eth", "Eng", "Lslash", "Hbar", "Tbar", "Dcroat"].includes(n);

// Pass 1. The side class decides who gets respaced: straight (H), round (O) and r's arm (R) only.
export function autospace(glyphs, k, sides) {
  const D = D_FRAC * k.xh, report = {};
  const range = (n) => (isUpper(n) ? [0, k.cap] : [0, k.xh]);
  const ref = (n) => (isUpper(n) ? "H" : "n");
  const target = {};
  for (const r of ["H", "n"]) { const [a, b] = range(r), p = profile(glyphs[r], a, b); target[r] = measure(p, p, D).A; }
  for (const [name, [ls, rs]] of Object.entries(sides)) {
    const g = glyphs[name];
    if (!g || name === "H" || name === "n") continue;
    const [a, b] = range(name), rp = profile(glyphs[ref(name)], a, b), gp = profile(g, a, b), lim = 0.3 * (isUpper(name) ? k.sbCap : k.sb);
    const fix = (m) => (m ? Math.max(-lim, Math.min(lim, 0.6 * (target[ref(name)] - m.A))) : 0);
    const dl = ["H", "O", "R"].includes(ls) ? fix(measure(rp, gp, D)) : 0;
    const dr = ["H", "O", "R"].includes(rs) ? fix(measure(gp, rp, D)) : 0;
    if (dl || dr) { moveGlyph(g, dl, dr); report[name] = [Math.round(dl), Math.round(dr)]; }
  }
  return report;
}

// The hand pass (2026-10-23, read off specimen/kerning.html at 44 and 64 px). Values are em units x 1000
// at the Text style's regular weight and scale with the x-height. A hand value replaces the measured one
// only where it is tighter; the collision floor and the vetoes still apply afterwards.
const ROUND_LC = ["a", "c", "d", "e", "g", "o", "q", "s"], OPEN_LC = ["u", "r", "v", "w", "y", "z", "m", "n", "p"];
function handPairs() {
  const out = {};
  const put = (as, bs, v) => { for (const a of as) for (const b of bs) out[`${a} ${b}`] = v; };
  put(["T"], ROUND_LC, -62); put(["T"], OPEN_LC, -44);
  put(["V", "W"], ROUND_LC, -44); put(["V", "W"], OPEN_LC, -24);
  put(["Y"], ROUND_LC, -62); put(["Y"], OPEN_LC, -38);
  put(["T", "V", "W", "Y", "P", "F"], ["period", "comma", "ellipsis"], -70);
  put(["L"], ["quoteright", "quotedblright", "quotesingle", "quotedbl", "T", "V", "W", "Y"], -66);
  put(["A"], ["T", "V", "W", "Y"], -52); put(["T", "V", "W", "Y"], ["A"], -52);
  put(["seven"], ["period", "comma"], -46); put(["r", "v", "w", "y"], ["period", "comma"], -40);
  put(["quotedblleft", "quoteleft"], ["A"], -36); put(["A"], ["quotedblright", "quoteright"], -36);
  return out;
}
const HAND = handPairs();

// Pass 2. Pair kerning over the kerning set, in font units.
export function kernPairs(glyphs, k, names) {
  // Text kerns gently (a pair pulled tight merges at 12 px); display faces kern at full strength.
  const D = D_FRAC * k.xh, cap = (k.kernCap ?? CAP_FRAC) * k.xh, gain = k.kernGain ?? GAIN, ymin = k.desc, ymax = k.asc + 40;
  const prof = Object.fromEntries(names.filter((n) => glyphs[n]?.contours?.length).map((n) => [n, profile(glyphs[n], ymin, ymax)]));
  // Letters measure against the straight reference of their case; everything else against itself, so
  // punctuation and figures only kern where a letter's shape makes the difference.
  const isLower = (n) => /^[a-z]$/.test(n) || ["ae", "oe", "oslash", "germandbls", "thorn", "eth", "dotlessi", "eng", "lslash", "kgreenlandic"].includes(n);
  const ref = (n) => (isUpper(n) ? "H" : isLower(n) ? "n" : n);
  const pairs = {};
  for (const a of Object.keys(prof)) for (const b of Object.keys(prof)) {
    const m = measure(prof[a], prof[b], D);
    if (!m) continue;
    const t = measure(prof[ref(a)], prof[ref(b)], D);
    if (!t) continue;
    let v = gain * (t.A - m.A);
    v = Math.max(-cap, Math.min(cap * 0.5, v));
    const hand = k.style.startsWith("text") ? HAND[`${a} ${b}`] : undefined;
    if (hand !== undefined) v = Math.min(v, hand * k.xh / 500);
    const floor = Math.max(0.55 * k.sb, 30);
    if (m.min + v < floor) v = floor - m.min;
    if (v < 0 && VETO_NEGATIVE.has(`${a} ${b}`)) v = 0;
    if (Math.abs(v) >= THRESH) pairs[`${a} ${b}`] = Math.round(v);
  }
  return pairs;
}
