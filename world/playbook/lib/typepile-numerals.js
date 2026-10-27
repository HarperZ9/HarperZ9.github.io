// lib/typepile-numerals.js: our own stroke numerals, the track layout that lays bodies along them, and a
// seven-segment reader used to test that a packed numeral stays legible. Dependency-free.
//
// The numerals are built on a 0.6 x 1 cell from seven straight segments, so every digit is a set of tracks a body
// can lie along end to end. The count-as-shape idea comes from the digit columns in favourite Hf9W; the segment
// form is the plainest numeral a pile of words can still draw.

// Segments a to g on the 0.6 x 1 cell: a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle.
export const SEG = Object.freeze({ a: [0, 0, 0.6, 0], b: [0.6, 0, 0.6, 0.5], c: [0.6, 0.5, 0.6, 1], d: [0.6, 1, 0, 1], e: [0, 1, 0, 0.5], f: [0, 0.5, 0, 0], g: [0, 0.5, 0.6, 0.5] });
export const DIGIT_SEGS = Object.freeze(['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcfgd']);

// Strokes for a string of digits: each segment is one straight track. Digits sit 0.95 cells apart.
// stack: digits one above another (for tall, narrow frames), 1.15 cells apart.
export function numeralTracks(digits, { x = 0, y = 0, H = 100, advance = 0.95, stack = false } = {}) {
  const out = [];
  [...String(digits)].forEach((ch, k) => {
    const d = DIGIT_SEGS[+ch]; if (d === undefined) throw new Error(`typepile: not a digit: ${ch}`);
    const dx = stack ? 0 : k * advance, dy = stack ? k * 1.15 : 0, segs = [...d].map((s) => SEG[s].slice());
    // join collinear segments that meet (b and c, e and f): one straight track needs no corner inset in the middle
    for (let i = 0; i < segs.length; i++) for (let j = 0; j < segs.length; j++) {
      const A = segs[i], B = segs[j]; if (i === j || !A || !B) continue;
      const same = Math.sign(A[2] - A[0]) === Math.sign(B[2] - B[0]) && Math.sign(A[3] - A[1]) === Math.sign(B[3] - B[1]);
      if (same && A[2] === B[0] && A[3] === B[1]) { segs[i] = [A[0], A[1], B[2], B[3]]; segs[j] = null; j = -1; }
    }
    for (const g of segs) if (g) { const [x0, y0, x1, y1] = g; out.push([x + (x0 + dx) * H, y + (y0 + dy) * H, x + (x1 + dx) * H, y + (y1 + dy) * H]); }
  });
  return out;
}
export const numeralWidth = (digits, advance = 0.95, stack = false) => (stack ? 0.6 : (String(digits).length - 1) * advance + 0.6);
export const numeralHeight = (digits, stack = false) => (stack ? (String(digits).length - 1) * 1.15 + 1 : 1);

// Lay bodies along tracks in `lanes` parallel rows per track, in reading order, so that every row is used: a body
// goes to the row that holds the middle of its share of the total length, and each row is justified (its bodies
// spread evenly along it). Each body is { len, r } and gets { ax, ay, bx, by } endpoint targets.
// Returns null when a row would stay empty (a segment of the numeral would be missing) or a row overflows by 15%.
// across: bodies lie across the track like rungs, so a body uses only its thickness along the row and its length
// becomes the stroke weight (the form of a digit column).
export function fillTracks(tracks, bodies, { lanes = 1, pitch = 20, inset = 0, across = false } = {}) {
  const rows = [];
  for (const [x0, y0, x1, y1] of tracks) {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
    for (let l = 0; l < lanes; l++) { const o = (l - (lanes - 1) / 2) * pitch; rows.push({ x: x0 + nx * o + ux * inset, y: y0 + ny * o + uy * inset, ux, uy, len: Math.max(0, L - 2 * inset), items: [] }); }
  }
  const ext = (b) => (across ? 2 * (b.r ?? 0) : b.len + 2 * (b.r ?? 0)), E = bodies.reduce((s, b) => s + ext(b), 0), total = rows.reduce((s, r) => s + r.len, 0);
  let acc = 0, r = 0, edge = rows[0]?.len ?? 0;
  for (const b of bodies) {
    const mid = ((acc + ext(b) / 2) / E) * total; acc += ext(b);
    while (r < rows.length - 1 && mid > edge) { r++; edge += rows[r].len; }
    rows[r].items.push(b);
  }
  const out = new Map();
  for (const row of rows) {
    const used = row.items.reduce((s, b) => s + ext(b), 0);
    if (!row.items.length || used > row.len * 1.15) return null;
    const gap = (row.len - used) / row.items.length; let s = gap / 2;
    for (const b of row.items) {
      if (across) { const c = s + (b.r ?? 0), cx = row.x + row.ux * c, cy = row.y + row.uy * c, hl = b.len / 2; out.set(b, { ax: cx + row.uy * hl, ay: cy - row.ux * hl, bx: cx - row.uy * hl, by: cy + row.ux * hl }); }
      else { const c0 = s + (b.r ?? 0), c1 = c0 + b.len; out.set(b, { ax: row.x + row.ux * c0, ay: row.y + row.uy * c0, bx: row.x + row.ux * c1, by: row.y + row.uy * c1 }); }
      s += ext(b) + gap;
    }
  }
  return bodies.map((b) => out.get(b));
}

// Read digits back from a coverage image by sampling the seven segment zones of each digit cell.
// cov(x, y) returns 0..1. A zone is the middle 70% of the segment, 0.12 H wide; lit when its mean exceeds `on`.
export function readSegments(cov, n, { x = 0, y = 0, H = 64, advance = 0.95, on = 0.3, stack = false } = {}) {
  let s = '';
  for (let k = 0; k < n; k++) {
    let lit = '';
    for (const [name, [x0, y0, x1, y1]] of Object.entries(SEG)) {
      const dx = stack ? 0 : k * advance, dy = stack ? k * 1.15 : 0, ax = x + (x0 + dx) * H, ay = y + (y0 + dy) * H, bx = x + (x1 + dx) * H, by = y + (y1 + dy) * H, L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      let sum = 0, c = 0;
      for (let u = 0.15; u <= 0.85; u += 0.5 / L) for (let v = -0.06 * H; v <= 0.06 * H; v += 1) { sum += cov(Math.round(ax + (bx - ax) * u + nx * v), Math.round(ay + (by - ay) * u + ny * v)); c++; }
      if (sum / c > on) lit += name;
    }
    const sorted = [...lit].sort().join(''), idx = DIGIT_SEGS.findIndex((d) => [...d].sort().join('') === sorted);
    s += idx < 0 ? '?' : String(idx);
  }
  return s;
}
