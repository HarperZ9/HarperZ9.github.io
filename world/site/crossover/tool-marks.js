// Tool marks: each tool on the index drawn the way Pintori drew the Olivetti machines, as what it does. The shape
// comes from the mechanism; the geometry stays to simple solids (disc, quarter-disc, bar, square, ring); the colour
// comes from the colour keyboard (keyboard.js), whose roles follow the mechanism: what arrives is sky, what is held
// is sand, what the tool does is landscape (land red for a stop or flag, leaf green for a pass or fix), a boundary
// is velvet. Tools that share a mechanism share a family and differ by their own parameters.
// Units: a mark lives in a 1000 x 1000 square centred on (0, 0), y down.

const TAU = Math.PI * 2;
const KEY = ["sky", "mist", "sand", "straw", "land", "leaf", "velvet", "clear"];
const [SKY, MIST, SAND, STRAW, LAND, LEAF, VELVET, CLEAR] = KEY.map((_, i) => i);
const groups = (edge = 16) => KEY.map((ink) => ({ ink, edge, z: ink === "clear" ? 0.5 : 0.7 }));
const D = (g, x, y, r) => ({ t: "disc", g, c: [x, y], r });
const B = (g, ax, ay, bx, by, r) => ({ t: "bar", g, a: [ax, ay], b: [bx, by], r });
const X = (g, x, y, w, h, rr = 10, ang = 0) => ({ t: "box", g, c: [x, y], hw: [w, h], rr, ang });
const P = (g, x, y, r, ang, ap) => ({ t: "pie", g, c: [x, y], r, ang, ap });
const R = (g, x, y, r, w) => ({ t: "ring", g, c: [x, y], r, w });
// an arc drawn as short bars, so a boundary can keep an opening
const arc = (g, cx, cy, r, a0, a1, w, n = 18) => Array.from({ length: n }, (_, i) => { const u = a0 + (a1 - a0) * i / n, v = a0 + (a1 - a0) * (i + 1) / n;
  return B(g, cx + Math.cos(u) * r, cy + Math.sin(u) * r, cx + Math.cos(v) * r, cy + Math.sin(v) * r, w); });
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function fnv(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
async function sha(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }

// ---- families: one per mechanism ----
const F = {
  // a recorded hash over today's: two rows of bars from the same SHA-256 nibbles; where they agree the glass doubles
  async compare(id, o = {}) { // the recorded hash rises from the line, today's hangs below it: a match is a mirror
    const h = await sha(id), s = [], n = 7, w = 600 / n;
    for (let i = 0; i < n; i++) { const x = -300 + w * (i + 0.5), v = 70 + (h[i] & 15) * 14;
      s.push(B(SAND, x, -30, x, -30 - v, 28), B(SKY, x, 30, x, 30 + v, 28)); }
    s.push(B(STRAW, -340, 0, 340, 0, 12));
    if (o.ring) s.push(R(VELVET, 0, 0, 450, 24));
    if (o.second) s.push(D(LEAF, 400, -300, 56), D(LEAF, 400, 300, 56));
    return s;
  },
  // a claim laid over its record: the overlap is the part the record supports
  claim(id, o = {}) {
    const s = [X(SAND, -60, 40, 300, 170, 24), B(o.k ?? SKY, -380, -120, 300, -120, 46)];
    (o.sources || [-260, 0, 260]).forEach((x, i) => s.push(D(i === 1 && o.flag ? LAND : LEAF, x, 300, 52), B(STRAW, x, 240, x, 140, 10)));
    return s;
  },
  // many sources fall into one held bowl; each keeps a tag of where it came from
  collect(id, o = {}) {
    const r = rng(fnv(id)), s = [P(SAND, 0, 150, 280, 0, Math.PI / 2 * 0.98)], n = o.n || 6;
    for (let i = 0; i < n; i++) { const a = -Math.PI * 0.88 + (i / (n - 1)) * Math.PI * 0.76, R0 = 250 + r() * 110;
      const x = Math.cos(a) * R0 * 1.15, y = Math.sin(a) * R0 + 40; s.push(D(i % 2 ? MIST : SKY, x, y, 42 + r() * 26), D(o.tag ?? LEAF, x + 40, y - 40, 16)); }
    if (o.redact) s.push(X(VELVET, 0, 60, 150, 40, 8));
    if (o.one) s.push(X(LAND, 0, 60, 120, 120, 16));
    return s;
  },
  // lines of prose or code with marks at the places a check names
  lines(id, o = {}) {
    const r = rng(fnv(id)), s = [], n = o.n || 5;
    for (let i = 0; i < n; i++) { const y = -300 + i * (600 / (n - 1)), len = 380 + r() * 260;
      if (o.tokens) { let x = -360; while (x < -360 + len) { const w = 50 + r() * 110; s.push(B([SKY, SAND, LEAF, LAND][Math.floor(r() * 4)], x, y, Math.min(x + w, -360 + len), y, 26)); x += w + 40; } }
      else s.push(B(o.k ?? STRAW, -360, y, -360 + len, y, 26));
      if (!o.tokens && r() < (o.p ?? 0.6)) { const x = -330 + r() * (len - 60); s.push(o.fix ? D(LEAF, x, y, 48) : B(LAND, x, y - 62, x, y + 62, 22)); } }
    if (o.sweep) s.unshift(P(MIST, -420, 0, 860, Math.PI / 2, 0.42));
    if (o.redact) for (let i = 0; i < 3; i++) s.push(X(VELVET, -150 + i * 140, -300 + i * 300, 90, 52, 8));
    return s;
  },
  // a reply traced back to its sources; a ring closes around sources that move together
  origins(id) {
    const s = [D(LAND, 220, 180, 110)], src = [[-330, -300], [-80, -360], [-380, 0], [-300, 280], [140, -280]];
    src.forEach(([x, y], i) => s.push(B(STRAW, x, y, 220, 180, 12), D(i < 3 ? SKY : MIST, x, y, 70)));
    s.push(R(VELVET, -270, -220, 230, 22));
    return s;
  },
  // a map of what depends on what: nodes and the bars between them
  graph(id, o = {}) {
    const r = rng(fnv(id)), pts = [], s = [];
    for (let i = 0; i < (o.n || 7); i++) { const a = i / (o.n || 7) * TAU + r() * 0.4, d = i === 0 ? 0 : 230 + r() * 150; pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    pts.forEach((p, i) => { if (i) s.push(B(STRAW, pts[i === 1 ? 0 : Math.floor(r() * i)][0], pts[i === 1 ? 0 : Math.floor(r() * i)][1], p[0], p[1], 12)); });
    pts.forEach((p, i) => s.push(o.ports && i ? X(i % 2 ? SKY : SAND, p[0], p[1], 64, 64, 12) : D(i ? (i % 3 ? SKY : SAND) : LAND, p[0], p[1], i ? 60 : 96)));
    if (o.ports) pts.forEach((p, i) => { if (i) s.push(D(i % 2 ? LEAF : LAND, p[0] + 64, p[1], 24)); });
    return s;
  },
  // a boundary with one opening: what was granted passes, the rest stops at the ring
  gate(id, o = {}) {
    const s = [...arc(VELVET, 60, 0, 360, -Math.PI + 0.42, Math.PI - 0.42, 30, 20), D(SAND, 110, 0, 95)];
    s.push(B(LEAF, -500, 0, 20, 0, 34), B(LAND, -520, -225, -330, -225, 30), B(LAND, -520, 225, -330, 225, 30));
    if (o.undo) s.push(...arc(STRAW, 110, 0, 180, -Math.PI * 0.85, Math.PI * 0.35, 16, 10));
    if (o.hooks) [-130, 130].forEach((y) => s.push(D(STRAW, -250, y, 34)));
    if (o.web) s.push(D(SKY, 110, -190, 50), D(MIST, 110, 190, 50), B(STRAW, 110, -140, 110, 140, 10));
    return s;
  },
  // one task enters and splits into lanes, each ending where it is sent
  route(id, o = {}) {
    const n = o.n || 3, s = [B(SKY, -440, 0, -160, 0, 34)];
    for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * (600 / Math.max(n - 1, 1)); s.push(B(SKY, -160, 0, 240, y, 26), D(i === 0 && o.flag ? LAND : [LEAF, SAND, LAND][i % 3], 330, y, 50 + i * 16)); }
    if (o.ledger) s.push(B(SAND, -420, 360, 420, 360, 30));
    if (o.ring) s.push(R(VELVET, 120, 0, 380, 18));
    return s;
  },
  // parallel runs held inside one bound, each reporting to a line beneath
  parallel(id) {
    const r = rng(fnv(id)), s = [B(VELVET, 360, -330, 360, 250, 22)];
    for (let i = 0; i < 4; i++) { const y = -270 + i * 160; s.push(B(SKY, -380, y, -380 + 300 + r() * 380, y, 34)); }
    s.push(B(SAND, -380, 360, 360, 360, 28));
    return s;
  },
  // what was meant over what was done: two rows; where they part, the gap shows
  divergence(id, o = {}) {
    const s = [];
    for (let i = 0; i < 5; i++) { const x = -340 + i * 170, off = i === 3 ? 120 : 0;
      s.push(X(o.top ?? SKY, x, -110, 60, 80, 10), X(i === 3 ? LAND : LEAF, x + off, 110, 60, 80, 10)); }
    if (o.membrane) s.push(B(VELVET, -440, 0, 440, 0, 12));
    return s;
  },
  // each file stamped where it was read: boxes, each with a seal
  stamp(id, o = {}) {
    const s = [];
    for (let i = 0; i < (o.n || 4); i++) { const x = -300 + i * 200, y = (i % 2) * 120 - 60;
      s.push(X(o.k ?? SKY, x, y, 80, 110, 10), D(LAND, x + 60, y - 90, 40)); }
    if (o.packet) s.push(B(VELVET, -420, 230, 420, 230, 26));
    if (o.board) s.push(B(SAND, -440, -300, 440, -300, 26));
    return s;
  },
  // a request split across a team in a ring, written to a ledger beneath
  team() {
    const s = [D(SKY, 0, -60, 90)];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU, x = Math.cos(a) * 300, y = Math.sin(a) * 300 - 60; s.push(B(MIST, 0, -60, x, y, 12), D([LEAF, SAND, LAND, LEAF, SAND][i], x, y, 66)); }
    s.push(B(SAND, -400, 380, 400, 380, 30));
    return s;
  },
  // a claim beside its measurement: equal bars match, a short one has drifted
  measure(id, o = {}) {
    const s = [], v = o.v || [1, 1, 0.7];
    v.forEach((m, i) => { const y = -260 + i * 260; s.push(B(SKY, -380, y - 40, 380, y - 40, 30), B(m === 1 ? LEAF : LAND, -380, y + 40, -380 + 760 * m, y + 40, 30)); });
    return s;
  },
  // a fact recalled with a bar back to the turn it came from
  recall() {
    const s = [];
    for (let i = 0; i < 5; i++) s.push(X(i === 1 ? SAND : STRAW, -260, -320 + i * 160, 160, 52, 12));
    s.push(B(LAND, -100, -160, 280, 200, 18), D(LAND, 300, 220, 110));
    return s;
  },
  // work passes a comb of tests; only what passes reaches the far side
  tests() {
    const s = [];
    for (let i = 0; i < 5; i++) s.push(B(VELVET, 0, -360 + i * 180 - 60, 0, -360 + i * 180 + 60, 22));
    [[-300, -270, LEAF, 330], [-300, 90, LEAF, 330], [-300, -90, LAND, -60], [-300, 270, LAND, -60]].forEach(([x, y, k, e]) => s.push(B(k, x, y, e, y, 30)));
    return s;
  },
  // judged by the state left behind: a grid of cells, the transcript faded beside it
  endstate(id) {
    const r = rng(fnv(id)), s = [];
    for (let i = 0; i < 3; i++) s.push(B(CLEAR, -420, -200 + i * 200, -200, -200 + i * 200, 20));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.push(X(r() < 0.75 ? LEAF : LAND, -20 + i * 160, -160 + j * 160, 62, 62, 10));
    return s;
  },
  // one record written into many hosts
  fanout(id, o = {}) {
    const n = o.n || 4, s = [X(SAND, -300, 0, 130, 170, 16)];
    for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * (720 / n); s.push(B(STRAW, -170, 0, 220, y, 12), X(o.k ?? SKY, 300, y, 80, 60, 10)); }
    return s;
  },
  // spaced repetition: reviews along a line, the gaps growing as recall holds
  spacing() {
    const s = [B(STRAW, -440, 0, 440, 0, 24)]; let x = -400, g = 70;
    for (let i = 0; i < 5; i++) { s.push(D(i === 2 ? LAND : LEAF, x, 0, 64)); x += g; g *= 1.75; }
    return s;
  },
  // identifiers swapped for a profile, with the way back kept
  swap() {
    const s = [];
    for (let i = 0; i < 4; i++) { const y = -270 + i * 180; s.push(X(SKY, -230, y, 110, 56, 10), X(SAND, 230, y, 110, 56, 10), B(STRAW, -110, y, 110, y, 10)); }
    s.push(...arc(STRAW, 0, -270, 230, Math.PI + 0.25, TAU - 0.25, 14, 12), D(LAND, -222, -330, 30));
    return s;
  },
  // voices clustered by theme, the split between them drawn as velvet
  themes(id) {
    const r = rng(fnv(id)), s = [B(VELVET, 40, -420, -40, 420, 16)], c = [[-230, -150, SKY], [-210, 200, MIST], [260, 30, SAND]];
    c.forEach(([cx, cy, k], j) => { for (let i = 0; i < 6 + j; i++) { const a = r() * TAU, d = r() * 140; s.push(D(k, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 30 + r() * 26)); } });
    return s;
  },
  // light split and recombined: overlapping primaries, measured against a target ring
  primaries(id, o = {}) {
    const s = [D(LAND, -110, -60, 230), D(LEAF, 110, -60, 230), D(SKY, 0, 130, 230)];
    if (o.target) s.push(R(VELVET, 0, 20, 380, 18));
    return s;
  },
  // a series of samples; the odd one stands out, or a fan of what may come next
  series(id, o = {}) {
    const r = rng(fnv(id)), s = [], n = o.fft ? 9 : 11;
    for (let i = 0; i < n; i++) { const x = -400 + i * (800 / (n - 1)); let v = o.fft ? 380 * Math.exp(-i * 0.35) + 30 : 120 + r() * 120;
      const out = o.outlier && i === 7; if (out) v = 420;
      s.push(B(out ? LAND : i > (o.change ?? 99) ? SAND : SKY, x, 300, x, 300 - v, 24)); }
    if (o.change != null) { const x = -400 + (o.change + 0.5) * 80; s.push(B(VELVET, x, -380, x, 380, 14)); }
    if (o.band) s.push(B(VELVET, -440, 20, 440, 20, 14), B(VELVET, -440, 330, 440, 330, 14));
    if (o.fan) s.push(P(LEAF, 330, 140, 460, Math.PI * 1.5, 0.42));
    return s;
  },
  // one seed played back the same each time: copies that coincide
  replay() {
    return [D(LAND, -260, 0, 90), B(STRAW, -170, 0, 120, 0, 12), D(SKY, 220, -130, 130), D(SKY, 250, -100, 130), D(SKY, 280, -70, 130)];
  },
  // a lost engine's pieces, some back in place
  revive(id, o = {}) {
    const s = [];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, lost = k === 3 && !o.whole; s.push(P(lost ? CLEAR : k % 2 ? SAND : LAND, Math.cos(a + Math.PI / 4) * (lost ? 120 : 20), Math.sin(a + Math.PI / 4) * (lost ? 120 : 20), 300, a + Math.PI / 4 - Math.PI / 2, Math.PI / 4)); }
    if (o.base) s.push(B(SKY, -420, 400, 420, 400, 30));
    return s;
  },
  // a computed sky: bands of air over a held ground, with the sun or the clouds as the act
  sky(id, o = {}) {
    const s = [];
    for (let i = 0; i < (o.bands || 3); i++) s.push(B(i ? MIST : SKY, -420, -260 + i * 130, 420, -260 + i * 130, 56));
    s.push(X(SAND, 0, 300, 440, 90, 30));
    if (o.sun) s.push(D(LAND, 220, -60, 90));
    if (o.cloud) s.push(D(CLEAR, -120, -60, 120), D(CLEAR, 30, -90, 90), D(CLEAR, -240, -40, 80));
    if (o.many) for (let i = 0; i < 5; i++) s.push(D([LAND, LEAF, SAND][i % 3], -320 + i * 160, 140, 34));
    return s;
  },
  // a live state handed across: two discs and the bar between
  bridge(id, o = {}) {
    const s = [D(SKY, -300, 0, 140), D(LAND, 300, 0, 140), B(SAND, -160, 0, 160, 0, 40)];
    if (o.shared) s.push(D(SAND, 0, -320, 90), B(STRAW, 0, -230, -280, -120, 12), B(STRAW, 0, -230, 280, -120, 12));
    return s;
  },
  // a fast effect beside a slow reference: almost coinciding, the sliver between is the reading
  reference() { return [D(SKY, -40, 0, 300), D(LAND, 40, 0, 300), B(VELVET, 0, 380, 80, 380, 26)]; },
  // one seed fans into many media
  seed(id, o = {}) {
    const n = o.n || 6, s = [D(LAND, 0, 0, 90)], K = [SKY, SAND, LEAF, MIST, STRAW, LAND];
    for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2; s.push(P(K[i % 6], Math.cos(a) * 250, Math.sin(a) * 250, 180, a - Math.PI / 2 + Math.PI, Math.PI / n)); }
    return s;
  },
  // a lens: two quarter-discs back to back, rays bending through
  lens() {
    return [P(SKY, -60, 0, 340, Math.PI / 2, 0.55), P(SKY, 60, 0, 340, -Math.PI / 2, 0.55), B(SAND, -440, -140, -40, -140, 16), B(SAND, -440, 140, -40, 140, 16), B(LAND, 40, -140, 420, 60, 16), B(LAND, 40, 140, 420, -60, 16)];
  },
  // a frame and the instruments that read it
  frame(id, o = {}) {
    const s = [X(SKY, 0, -40, 330, 210, 14)];
    if (o.pixels) { const r = rng(fnv(id)); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if (r() < 0.5) s.push(X([LAND, SAND, LEAF][(i + j) % 3], -275 + i * 110, -190 + j * 100, 40, 40, 2)); }
    else { s.push(B(LAND, -330, 300, 330, 300, 22)); for (let i = 0; i < 5; i++) s.push(B(SAND, -330 + i * 165, 260, -330 + i * 165, 340, 12)); }
    return s;
  },
  // a call stack that narrows as it rises: a callee holds only what its caller grants
  stack(id, o = {}) {
    const caps = [SKY, SAND, LAND, LEAF], frames = [[0, 1, 2, 3], [0, 1, 3], [0, 3], [0]], s = [];
    frames.forEach((held, f) => { const y = 320 - f * 190, w = 400 - f * 80; s.push(B(VELVET, -w, y, w, y, 14));
      held.forEach((c, j) => { const bw = (2 * w) / held.length; s.push(X(caps[c], -w + bw * (j + 0.5), y - 70, bw * 0.42, 50, 10)); }); });
    return s;
  },
  // modules bundled together: boxes inside one ring
  bundle(id, o = {}) {
    const r = rng(fnv(id)), s = o.ring ? [R(VELVET, 0, 0, 420, 22)] : [];
    const n = o.n || 6;
    for (let i = 0; i < n; i++) { const a = i / n * TAU, d = o.grid ? 0 : 220; const x = o.grid ? -240 + (i % 3) * 240 : Math.cos(a) * d, y = o.grid ? -120 + Math.floor(i / 3) * 240 : Math.sin(a) * d;
      s.push(X([SKY, SAND, LEAF, LAND, MIST, STRAW][i % 6], x, y, o.grid ? 90 : 70 + r() * 30, o.grid ? 70 : 70 + r() * 30, 14)); }
    return s;
  },
  // many plugs into one rail
  plugs() {
    const s = [B(SAND, -440, 300, 440, 300, 34)];
    for (let i = 0; i < 12; i++) { const a = Math.PI * (1.08 + i / 11 * 0.84), x = Math.cos(a) * 400, y = Math.sin(a) * 400 + 280; s.push(B(STRAW, x, y, x * 0.62, 266, 10), D([SKY, LEAF, LAND, MIST][i % 4], x, y, 36)); }
    return s;
  },
  // the platform chain: links each placed on the one before
  chain() {
    const s = [];
    for (let i = 0; i < 5; i++) { const x = -360 + i * 180; s.push({ t: "link", g: i % 2 ? SAND : LAND, a: [x - 50, 0], b: [x + 50, 0], r: 60, w: 18 }); }
    return s;
  },
  // a signed note pinned to a public board
  board() {
    const s = [B(SAND, -440, -320, 440, -320, 26)];
    for (let i = 0; i < 3; i++) { const x = -280 + i * 280; s.push(X(i === 1 ? MIST : SKY, x, 20, 110, 150, 12), D(LAND, x + 70, 130, 40), B(STRAW, x, -300, x, -130, 10)); }
    return s;
  },
};

// id: [family, options, alt]. The alt says what the shape draws, in the tool's own terms. The flagships flywheel and
// buildlang carry no row mark: the platform's own mark above them already draws the same mechanism.
export const TOOLS = {
  // THE FLYWHEEL
  emet: ["compare", {}, "Two rows of bars from one SHA-256, the recorded row over today's; where they agree the glass doubles."],
  "seal-watch": ["compare", { ring: true }, "The recorded hash over today's clone, inside the ring of a daily check."],
  "bootloops-second-checker": ["compare", { second: true }, "A receipt's hash checked twice, by two checkers that do not share a path."],
  "model-provenance-validator": ["claim", { k: SKY }, "A release claim laid over its provenance record; the overlap is what the record supports."],
  "flywheel-evidence-task": ["claim", { k: LAND }, "A claim over the sources that decide it, each source tied below."],
  "agent-routing-kit": ["route", { n: 3 }, "One task entering and splitting into lanes by capability, risk and budget."],
  relay: ["tests", {}, "Work passing a comb of tests; only what passes reaches the far side."],
  "public-surface-sweeper": ["lines", { sweep: true, p: 0.5 }, "A sweep across a repository's lines, with a flag where something should not ship."],
  "repo-proof-index": ["collect", { n: 6, one: true }, "Proof packets gathered into one summary for a reviewer."],
  "agent-hook-pack": ["gate", { hooks: true }, "Hooks at a repository's gate: what passes the checks goes through the opening."],
  "accountable-surface": ["gate", { undo: true }, "A granted action passing the one opening; the others stop at the ring, and a failed write turns back."],
  telos: ["gate", { web: true }, "Web, CI and browser reached only through the opening you granted."],
  "proof-surface": ["gate", {}, "An agent's trace against its grant: allowed through, denied at the ring."],
  "proof-surface-report": ["lines", { k: SAND, p: 0.35 }, "A packet written out as lines a reviewer reads, its findings marked."],
  "secret-redact-io": ["lines", { redact: true, p: 0 }, "Lines of output with the secret-shaped spans covered."],
  index: ["graph", { n: 8 }, "A map of repositories: nodes and what depends on what."],
  plexus: ["graph", { n: 6, ports: true }, "Tools as blocks with colour-matched ports, wired output to input."],
  "workflow-harness-lite": ["parallel", {}, "Commands running side by side inside one bound, reporting to one line."],
  "gpu-trace-validator": ["measure", { v: [1, 1, 0.82] }, "Trace values against the schema, one assertion short."],
  crucible: ["measure", { v: [1, 0.64, 1] }, "Each claim beside its measurement: equal bars match, the short one drifted."],
  "context-curator-lite": ["collect", { n: 5, redact: true, tag: SAND }, "A small bundle of context gathered, with one span redacted and each source tagged."],
  gather: ["collect", { n: 7, tag: LAND }, "Material from many sources falling into one store, each keeping a tag of where it came from."],
  "provenance-sensorium": ["stamp", {}, "Files and git state, each stamped with its hash."],
  "release-surface-scanner": ["stamp", { packet: true, k: SAND }, "Required files hashed and bound into one release packet."],
  "agent-audit": ["divergence", {}, "What the agent said it would do over what it did; one step parts from the plan."],
  "coherence-membrane": ["divergence", { membrane: true, top: MIST }, "What was expected and what was observed, held apart by a membrane."],
  forum: ["team", {}, "One request split across a team of agents, written to a ledger you can replay."],
  mneme: ["recall", {}, "A recalled fact with a bar back to the turn it came from."],
  "terminal-state-fixtures": ["endstate", {}, "An agent judged by the state it leaves, with the transcript faded beside it."],
  canon: ["fanout", { n: 4 }, "One record of instructions written into each host's file."],
  discover: ["lines", { fix: true, p: 0.55, k: MIST }, "A project's pages checked for being found, with the fixes marked."],
  bulletin: ["board", {}, "Signed messages pinned to a public board."],
  plugins: ["plugs", {}, "Twelve plugs running into one rail."],
  // THE COMMONS
  cmmns: ["origins", {}, "A reply traced back to where it came from, a ring around the sources that move together."],
  learn: ["spacing", {}, "Reviews along a line, the gaps growing as recall holds; one missed and brought closer."],
  phantom: ["swap", {}, "Hardware identifiers swapped for a profile, with the way back kept."],
  chorus: ["themes", {}, "A comment section clustered by theme, the split drawn between."],
  "open-archives": ["collect", { n: 6, tag: LEAF }, "Many archives searched at once into one store, each download tagged with its licence."],
  // THE PLAYGROUND
  "calibrate-pro": ["primaries", { target: true }, "Three primaries measured against a target ring."],
  "build-color": ["primaries", {}, "Three primaries overlapping; every mixture between them computed."],
  raw: ["sky", { bands: 3, many: true }, "Effect passes layered over a frame."],
  "raw-native": ["reference", {}, "A fast effect beside a slow reference; the sliver between them is the reading."],
  "anomaly-kernels": ["series", { outlier: true }, "A telemetry baseline with one outlier standing out."],
  "signal-kernels": ["series", { fft: true }, "A spectrum: energy falling across frequency."],
  reconcile: ["replay", {}, "One generator played back the same each time."],
  "engine-revival": ["revive", {}, "A lost engine's pieces, three back in place and one still missing."],
  "brender-archival": ["revive", { whole: true, base: true }, "A 1990s engine whole again on a new floor."],
  "truth-enb": ["sky", { sun: true, cloud: true }, "A computed sky with clouds over the ground."],
  "elder-enb": ["sky", { bands: 3, sun: true }, "Weather themes layered over the land."],
  "elder-weathers": ["sky", { bands: 4, cloud: true }, "Weathers built from layers of a physical atmosphere."],
  "enb-runtime-core": ["bridge", { shared: true }, "One runtime shared by two renderers."],
  skyrimbridge: ["bridge", {}, "Live engine state handed across to the shaders."],
  "enb-validation-lab": ["tests", {}, "Packages passing the checks before release."],
  superstack: ["replay", {}, "One seed, one byte stream, renderers and sound engines landing on the same result."],
  superframe: ["seed", { n: 6 }, "One seed fanning into paint, type, line, material, sound and touch."],
  "lens-room": ["lens", {}, "A lens with rays bending through it."],
  studio: ["frame", {}, "A frame and the scale that measures it."],
  "retro-engine": ["frame", { pixels: true }, "A frame cut into pixels and a hardware palette."],
  gallery: ["seed", { n: 4 }, "A named seed drawn out by an instrument into a plate."],
  // ARTICULATE
  articulate: ["lines", { p: 0.7 }, "Lines of prose with a mark on each line where a writing pattern sits."],
  // BUILDLANG
  "build-finance": ["series", { band: true }, "A price series inside a risk band."],
  "build-oracle": ["series", { change: 5 }, "A series with the changepoint where its behaviour turns."],
  "build-engine": ["series", { fan: true }, "A series and the fan of what may come next."],
  "build-universe": ["bundle", { n: 6, grid: true }, "Example modules side by side."],
  "build-ui": ["bundle", { n: 4, grid: true }, "Shared widgets on one theme."],
  "build-ecosystem": ["bundle", { n: 6, ring: true }, "The Build tools bundled in one ring."],
  "buildlang-tmlanguage": ["lines", { tokens: true }, "Lines of code with each token coloured by its kind."],
  "buildlang-vscode": ["lines", { tokens: true, n: 4 }, "Lines of BuildLang highlighted in an editor."],
};

export async function toolMark(id) {
  const t = TOOLS[id]; if (!t) throw new Error(`tool marks: no mark for "${id}"`);
  return { groups: groups(), shapes: await F[t[0]](id, t[1]) };
}
export const TOOL_ALT = Object.fromEntries(Object.entries(TOOLS).map(([k, v]) => [k, v[2]]));
