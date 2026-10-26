// stop.mjs: the stop grammar, as pure numbers (no DOM). Every stop on the road uses all four moves, driven by
// the visitor's approach (0 far, 1 arrived), quantised to the place's own steps (each place keeps its own clock; there is no master clock):
//
//   unravel  a ribbon of tiles starts wound into a curl and unrolls as the visitor comes forward;
//   mosaic   the stop's picture starts as coarse tiles and resolves to fine ones; each tile turns over whole
//            (it narrows to its edge over the plain ground and opens on the new face), never a ghosted blend;
//   sheets   the stop is a stack of translucent sheets (content, ground, motion, annotation) that fan apart as
//            the visitor approaches and settle into one overprinted image on arrival; a visitor can lift them;
//   timing   all of it steps on the place's own clock; reduced motion shows the finished state.
//
// The overprint model is ideal multiply (each sheet a transmission, the overlap the product). The Olivetti study
// (reference library, st-rronberishagrit) measured that ideal multiply gets lightness right and misses hue by
// 14 to 21 CIE76; a fitted per-ink table is the open gap there.

export const SHEETS = Object.freeze(["ground", "motion", "content", "annotation"]);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Quantise a continuous approach to steps: the reveal advances in held beats, the way the studio holds frames.
export function onBeat(approach, steps = 6) { return Math.min(1, Math.floor(clamp(approach) * steps + 1e-6) / steps); }

// No master clock: each place keeps its own time. A clock maps the visitor's approach (0..1) to the place's own
// progress before it is held on steps. "even" is the walk itself; "sqrt" is diffusion's time (a dye's radius grows
// as sqrt(t), so early steps come fast and later ones slow); "drying" holds wet, then dries fast at the end
// (evaporation pins the edge late); "ratio" is Weber-Fechner's (each added layer reads as a smaller step).
// A place that keeps time with the sound theme passes its own function.
export const CLOCKS = Object.freeze({
  even: (a) => a,
  sqrt: (a) => Math.sqrt(a),
  drying: (a) => a * a * a,
  ratio: (a) => Math.log1p(9 * a) / Math.log(10),
});
// A clock may be a name, a function, or a weighted mix of clocks ({ even: 0.3, hum: 0.7 }): a timing layer with
// weights. Extra clocks (such as the theme's, built by humClock) are passed in by the page.
export function clockOf(c, extra = {}) {
  if (typeof c === "function") return c;
  if (c && typeof c === "object") {
    const parts = Object.entries(c).map(([k, w]) => [clockOf(k, extra), w]), sum = parts.reduce((a, [, w]) => a + w, 0) || 1;
    return (a) => parts.reduce((acc, [f, w]) => acc + w * f(a), 0) / sum;
  }
  return extra[c] || CLOCKS[c] || CLOCKS.even;
}
// The sound theme's own clock (Hum v4): progress follows the kicks of two bars of "the cell" (bars 16 and 17), so a
// place that keeps time with the theme moves on its kicks and holds between them. hits: hum4-theme-hits.json.
export function humClock(hum, { fromBar = 16, bars = 2 } = {}) {
  const bar = (60 / hum.bpm) * 4, t0 = fromBar * bar, span = bars * bar;
  const kicks = hum.hits.filter((h) => h.name.startsWith("kick") && h.t >= t0 && h.t < t0 + span).map((h) => [(h.t - t0) / span, h.vel]);
  const total = kicks.reduce((a, [, v]) => a + v, 0) || 1;
  // each kick's share arrives over a short attack (ramp, a sixteenth of the two bars), so the clock steps on the kicks
  // without a jump: a stepped clock would cut a transfer at every kick
  const ramp = 1 / 32;
  return (a) => { let m = 0; for (const [u, v] of kicks) m += v * Math.min(1, Math.max(0, (a - u) / ramp)); return a >= 1 ? 1 : Math.min(1, m / total); };
}

// The whole grammar at one approach. `reduced` shows the finished, uncovered state with the sheets settled.
export function grammar(approach, { reduced = false, steps = 6, clock = "even", clocks = {} } = {}) {
  const a = reduced ? 1 : onBeat(clockOf(clock, clocks)(clamp(approach)), steps);
  return {
    approach: a,
    unroll: a,                                  // 0 wound, 1 laid flat
    tileLevel: Math.round(a * 5),               // 0 coarsest .. 5 finest: tile side = base / 2^level
    reveal: a,                                  // share of tiles turned to the picture face
    fan: reduced ? 0 : 1 - a,                   // sheets apart (1) .. settled (0)
    settled: a >= 1,
  };
}

// ---- unravel: a Divisumma ribbon of n tiles, wound as a spiral at u = 0 and flat at u = 1 ----
// Returns each tile's centre and angle in unit space (x 0..1 along the flat row, y around 0).
export function ribbon(n, u, { turns = 1.6 } = {}) {
  const out = [], flatLen = clamp(u) * n;  // tiles already laid flat, from the left
  for (let i = 0; i < n; i++) {
    if (i < flatLen) { out.push({ i, x: (i + 0.5) / n, y: 0, angle: 0, flat: true }); continue; }
    // the rest stay wound: a spiral that starts where the flat run ends and tightens inward
    const k = i - flatLen, r = Math.max(0.012, 0.09 * (1 - k / (n - flatLen + 1)) ** 0.8), th = -Math.PI / 2 + (k / Math.max(1, n - flatLen)) * turns * 2 * Math.PI;
    const cx = flatLen / n + 0.09;
    out.push({ i, x: cx + r * Math.cos(th), y: -0.09 + r * Math.sin(th) + 0.09, angle: th + Math.PI / 2, flat: false });
  }
  return out;
}

// ---- mosaic: tile side and per-tile turn state ----
export function tileSide(level, base = 64) { return Math.max(4, base / 2 ** level); }
// Each tile turns once, in a wave from the road's side (rank 0..1 = distance from the near edge plus a seeded
// jitter). turn(t) is 0 not started .. 1 done; while 0 < turn < 1 the tile is drawn narrowed to its edge.
export function tileTurn(reveal, rank) { return clamp((reveal * 1.25 - rank) / 0.25); }
// Squash of a turning tile (width factor) and which face shows: the narrowest point is the edge.
export function turnFace(turn) { const w = Math.abs(Math.cos(Math.PI * turn)); return { width: w, face: turn < 0.5 ? "old" : "new" }; }
export function seededRank(i, j, cols, rows, seed = 1) {
  let h = (i * 73856093) ^ (j * 19349663) ^ (seed * 83492791); h = (h ^ (h >>> 13)) >>> 0; const jit = (h % 1000) / 1000;
  return clamp((j / Math.max(1, rows - 1)) * 0.8 + jit * 0.2);  // bottom rows (nearest the road) first
}

// ---- sheets: where each sheet sits at a fan value, and the overprint of colours ----
// offset in CSS px for a sheet index (0 bottom .. n-1 top) at fan 0..1; lifted adds a larger, deliberate spread.
export function sheetOffset(index, n, fan, lifted = false) {
  const spread = lifted ? 1 : fan * 0.35, k = index - (n - 1) / 2;
  return { x: k * 18 * spread, y: -k * 26 * spread, rotate: k * 1.2 * spread, scale: 1 - (lifted ? 0.06 : 0.02 * fan) };
}
// Ideal subtractive overprint of sRGB hex inks (multiply in linear light).
export function overprint(...hexes) {
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const srgb = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
  const prod = [1, 1, 1];
  for (const h of hexes) { const n = parseInt(h.slice(1), 16); [(n >> 16) & 255, (n >> 8) & 255, n & 255].forEach((c, i) => { prod[i] *= lin(c); }); }
  return "#" + prod.map((v) => srgb(v).toString(16).padStart(2, "0")).join("");
}
