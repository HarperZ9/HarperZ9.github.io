// site-art-domains.mjs: one aperture plate per catalog domain, for render-site-art.mjs.
// Each draw function takes the Doc and the renderer's shared line-work kit. Each plate
// carries one idea from its domain, and each reads differently at thumbnail size.

// Agent systems: a lead aperture and five small ones, joined by bundles of strands
// that all turn the same way, with dashed handoffs along the orbit between them.
function agents(d, K) {
  const { P, R } = d, { TAU, circle, arc, ticks, blades, lw } = K, cx = 600, cy = 450, orbit = 300;
  K.lift(d, cx, cy, 660);
  const sats = Array.from({ length: 5 }, (_, k) => { const t = -Math.PI / 2 + k * TAU / 5 + 0.22; return [cx + orbit * Math.cos(t), cy + orbit * Math.sin(t), t]; });
  const strand = d.pen(P.ink, 0.8, lw(d, 0.42, 0.48)), hand = d.pen(P.pen2, 1.1, 0.7, ` stroke-dasharray="3 8"`);
  sats.forEach(([sx, sy, t], k) => {
    for (let j = 0; j < 18; j++) {
      const f = j / 17 - 0.5, a0 = t + f * 0.5, x0 = cx + 96 * Math.cos(a0), y0 = cy + 96 * Math.sin(a0);
      const back = Math.atan2(cy - sy, cx - sx) - f * 1.1, x1 = sx + 44 * Math.cos(back), y1 = sy + 44 * Math.sin(back);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, L = Math.hypot(x1 - x0, y1 - y0), bow = 16 + 14 * f + 4 * R();
      const qx = mx - (y1 - y0) / L * bow, qy = my + (x1 - x0) / L * bow, pts = [];
      for (let s = 0; s <= 1.0001; s += 1 / 30) pts.push([(1 - s) ** 2 * x0 + 2 * (1 - s) * s * qx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * qy + s * s * y1]);
      strand.line(pts);
    }
    const t1 = sats[(k + 1) % 5][2] + (k === 4 ? TAU : 0), [ox, oy] = sats[(k + 2) % 5];
    hand.line(arc(cx, cy, orbit, t + 0.16, t1 - 0.16));
    const L = Math.hypot(ox - sx, oy - sy), ux = (ox - sx) / L, uy = (oy - sy) / L;
    hand.line([[sx + ux * 48, sy + uy * 48], [ox - ux * 48, oy - uy * 48]]);
  });
  const ring = d.pen(P.ink, 1.2, lw(d, 0.85, 0.85), "", 10), fine = d.pen(P.ink, 0.8, lw(d, 0.55, 0.6));
  sats.forEach(([sx, sy]) => {
    [28, 36].forEach((r) => ring.line(circle(sx, sy, r, null, 40)));
    ticks(fine, sx, sy, 39, 48, 8);
    blades(fine, sx, sy, 6, 26, 28, 1.2, R);
  });
  [72, 80].forEach((r) => ring.line(circle(cx, cy, r)));
  ticks(d.pen(P.ink, 1, lw(d, 0.6, 0.65)), cx, cy, 86, 120, 9);
  K.core(d, cx, cy, 84, 1.1);
  K.flare(d, cx, cy, 78, -1.1, 0.8, 2, 1.8);
  K.veil(d);
}

// Evaluation and verification: a resolution test chart. A star of converging wedges,
// drawn as close arcs, blurs out at the lit center, over a stepped tone wedge.
function evaluation(d, K) {
  const { W, P } = d, { TAU, circle, arc, ticks, lw } = K, cx = 600, cy = 420, Rs = 268, n = 36;
  K.lift(d, cx, cy, 640);
  const wedge = d.pen(P.ink, lw(d, 1.5, 1.7), lw(d, 0.62, 0.74));
  for (let k = 0; k < n; k += 2) for (let r = 56; r <= Rs; r += 4) wedge.line(arc(cx, cy, r, k * TAU / n, (k + 1) * TAU / n, Math.max(2, Math.round(r * TAU / n / 14))));
  const rim = d.pen(P.ink, 1.3, lw(d, 0.85, 0.85), "", 10);
  [50, Rs + 6].forEach((r) => rim.line(circle(cx, cy, r)));
  ticks(d.pen(P.ink, 1, lw(d, 0.6, 0.65)), cx, cy, Rs + 12, 180, 12);
  const ret = d.pen(P.ink, 1.1, lw(d, 0.75, 0.8));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ret.line([[cx + dx * (Rs + 34), cy + dy * (Rs + 34)], [cx + dx * (Rs + 120), cy + dy * (Rs + 120)]]);
    for (let s = Rs + 40; s <= Rs + 120; s += 10) ret.line([[cx + dx * s - dy * 5, cy + dy * s - dx * 5], [cx + dx * s + dy * 5, cy + dy * s + dx * 5]]);
  }
  const x0 = 380, y0 = 770, bw = 40, bh = 64, step = d.pen(P.ink, 1, lw(d, 0.8, 0.82));
  for (let i = 0; i < 11; i++) {
    const bx = x0 + i * bw, sp = 16 - i * 1.3;
    step.line([[bx, y0], [bx + bw, y0], [bx + bw, y0 + bh], [bx, y0 + bh]], true);
    if (i) for (let x = bx + sp / 2; x < bx + bw; x += sp) step.line([[x, y0 + 2], [x, y0 + bh - 2]]);
  }
  const reg = d.pen(P.pen2, 1, 0.75, "", 10);
  [[130, cy], [W - 130, cy]].forEach(([x, y]) => { reg.line(circle(x, y, 18, null, 24)); reg.line([[x - 30, y], [x + 30, y]]); reg.line([[x, y - 30], [x, y + 30]]); });
  K.core(d, cx, cy, 70, 1.1);
  K.flare(d, cx, cy, Rs + 6, -0.7, 0.55, 2.2, 2);
  K.veil(d);
}

// Security and privacy: a lattice of diamond cells, every other cell closed with fine
// hatch, magnified by a lens around the one open cell where the core sits.
function privacy(d, K) {
  const { W, H, P } = d, { circle, ticks, lw } = K, cx = 600, cy = 450, sp = 46;
  K.lift(d, cx, cy, 640);
  const warp = ([x, y]) => { const dx = x - cx, dy = y - cy, g = 1 + 1.15 * Math.exp(-(dx * dx + dy * dy) / (240 * 240)); return [cx + dx * g, cy + dy * g]; };
  // Source space is rotated forty-five degrees: u and v run along the two wire directions.
  const at = (u, v) => [cx + (u + v) / Math.SQRT2, cy + (v - u) / Math.SQRT2];
  const onCanvas = ([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60;
  const open = (u, v) => Math.floor(u / sp + 0.5) === 0 && Math.floor(v / sp + 0.5) === 0;
  const closed = (u, v) => (Math.floor(u / sp + 0.5) + Math.floor(v / sp + 0.5)) % 2 !== 0 && !open(u, v);
  const run = (pen, fixed, along, keep) => {
    let cur = [];
    for (let t = -900; t <= 900; t += 5) {
      const [u, v] = along ? [t, fixed] : [fixed, t], p = at(u, v);
      if (onCanvas(p) && keep(u, v)) cur.push(warp(p)); else { if (cur.length > 1) pen.line(cur); cur = []; }
    }
    if (cur.length > 1) pen.line(cur);
  };
  const fill = d.pen(P.ink, 1, lw(d, 0.6, 0.66)), wire = d.pen(P.ink, 1.3, lw(d, 0.8, 0.8));
  for (let c = -900; c <= 900; c += 5) run(fill, c, true, closed);
  for (let c = -sp * 20 + sp / 2; c <= sp * 20; c += sp) { run(wire, c, true, () => true); run(wire, c, false, () => true); }
  const lens = d.pen(P.ink, 1.3, lw(d, 0.85, 0.85), "", 10);
  [336, 342].forEach((r) => lens.line(circle(cx, cy, r)));
  ticks(d.pen(P.ink, 1, lw(d, 0.6, 0.65)), cx, cy, 348, 180, 12);
  K.core(d, cx, cy, 70, 1.15);
  K.flare(d, cx, cy, 340, 0.6, 0.5, 2.2, 2);
  K.veil(d);
}

// Developer infrastructure: a field of level lines lifted over a hidden stepped
// platform, each terrace hiding the lines behind it, with the core on the top tier.
function infrastructure(d, K) {
  const { W, P, N } = d, { lw } = K, cx = 600, cz = 610, n = 86;
  const smooth = (e) => Math.max(0, Math.min(1, (e + 5) / 10));
  const lifted = (x, y) => {
    let h = 0;
    for (let k = 0; k < 5; k++) h += 30 * smooth(Math.min(430 - k * 88 - Math.abs(x - cx), (250 - k * 48) - Math.abs(y - cz)));
    return h + 2.4 * (N(x * 0.02, y * 0.02) + 1);
  };
  const top = cz - 4 * 30 - 140 * 0.5;
  K.lift(d, cx, top, 620);
  K.core(d, cx, top - 20, 150, 0.9);
  const pens = [d.pen(P.pen2, 0.9, 0.45), d.pen(P.ink, 1, lw(d, 0.6, 0.64)), d.pen(P.ink, 1.5, lw(d, 0.9, 0.9))];
  K.ridges(n, 30, W - 30, 4, (i) => 90 + i * 9.4, (i, x) => lifted(x, 90 + i * 9.4), (i) => (i % 6 === 0 ? pens[2] : i < n * 0.35 ? pens[0] : pens[1]));
  K.flare(d, cx, top - 20, 62, -2.5, 0.8, 2, 1.8);
  K.veil(d);
}

// Graphics and media: parallel rays through a lens, gathered to a lit focus and
// split past it into the plate's one spectral fan.
function graphics(d, K) {
  const { W, P } = d, { lw } = K, lx = 460, cy = 450, hh = 290, sag = 38, fx = 870;
  K.lift(d, fx, cy, 620);
  const Rs = (hh * hh + sag * sag) / (2 * sag), face = (y, side) => lx + side * (Rs - Math.sqrt(Math.max(0, Rs * Rs - (y - cy) ** 2)) - sag) * -1;
  const ray = d.pen(P.ink, 0.9, lw(d, 0.55, 0.6)), past = d.pen(P.pen2, 0.8, 0.45);
  for (let y = cy - 270; y <= cy + 270.1; y += 12) {
    const inX = face(y, -1), outX = face(y, 1), t = (y - cy) / 270;
    ray.line([[0, y], [inX, y]]);
    ray.line([[inX, y], [outX, y], [fx, cy + t * 3]]);
    past.line([[fx, cy + t * 3], [W + 10, cy + t * 3 + (W + 10 - fx) * (cy + t * 3 - y) / (fx - outX)]]);
  }
  const glass = d.pen(P.pen2, 0.8, 0.5), edge = d.pen(P.ink, 1.5, lw(d, 0.9, 0.9));
  for (const side of [-1, 1]) {
    const pts = []; for (let y = cy - hh; y <= cy + hh + 0.1; y += 6) pts.push([face(y, side), y]);
    edge.line(pts);
    for (let k = 1; k < 7; k++) glass.line(pts.map(([x, y]) => [lx + (x - lx) * (1 - k / 7), y]).filter(([, y]) => Math.abs(y - cy) < hh - k * 8));
  }
  const sensor = d.pen(P.ink, 1.1, 0.8, ` stroke-dasharray="6 6"`), tick = d.pen(P.ink, 1, 0.75);
  sensor.line([[1090, 120], [1090, 780]]);
  for (let y = 120; y <= 780; y += 30) tick.line([[1090, y], [1090 + (y % 150 === 0 ? 18 : 9), y]]);
  const blend = ` style="mix-blend-mode:${P.blend}"`;
  P.flare.forEach((c, k) => d.pen(c, 2.2, P.dark ? 0.9 : 0.85, blend, 10).line([[fx, cy], [W + 10, cy + (k - 3) * 22 + 60]]));
  K.core(d, fx, cy, 96, 1.1);
  K.veil(d);
}

// Research and education: a dendrite grown by accretion outward from a ring around
// the core, walker by walker, with each branch drawn heavier the more it carries.
function research(d, K) {
  const { W, H, P, R } = d, { TAU, lw } = K, c = 5, gw = W / c, gh = H / c, gx = gw / 2, gy = gh / 2;
  const occ = new Int32Array(gw * gh).fill(-1), parts = [];
  const put = (i, j, p) => { occ[j * gw + i] = parts.length; parts.push([i, j, p]); };
  for (let k = 0; k < 30; k++) { const t = k / 30 * TAU; put(Math.round(gx + 8 * Math.cos(t)), Math.round(gy + 8 * Math.sin(t)), -1); }
  let rmax = 9;
  const hit = (i, j) => { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = occ[(j + b) * gw + i + a]; if (q >= 0) return q; } return -1; };
  for (let n = 0; n < 9000 && rmax < gh / 2 - 8; n++) {
    let t = R() * TAU, x = gx + (rmax + 4) * Math.cos(t), y = gy + (rmax + 4) * Math.sin(t);
    for (let s = 0; s < 40000; s++) {
      const r = Math.hypot(x - gx, y - gy);
      if (r > rmax + 30) { t = R() * TAU; x = gx + (rmax + 4) * Math.cos(t); y = gy + (rmax + 4) * Math.sin(t); continue; }
      const jump = Math.max(1, r - rmax - 3), a = R() * TAU;
      x += jump * Math.cos(a); y += jump * Math.sin(a);
      const i = Math.round(x), j = Math.round(y);
      if (i < 1 || j < 1 || i >= gw - 1 || j >= gh - 1 || occ[j * gw + i] >= 0) continue;
      const q = hit(i, j);
      if (q >= 0 && R() < 0.4) { put(i, j, q); rmax = Math.max(rmax, Math.hypot(i - gx, j - gy)); break; }
    }
  }
  const load = new Int32Array(parts.length).fill(1);
  for (let k = parts.length - 1; k >= 0; k--) if (parts[k][2] >= 0) load[parts[k][2]] += load[k];
  K.lift(d, W / 2, H / 2, 620);
  const pens = [d.pen(P.pen2, 0.8, 0.6), d.pen(P.ink, 1.2, lw(d, 0.72, 0.74)), d.pen(P.ink, 2, lw(d, 0.9, 0.9))];
  parts.forEach(([i, j, p], k) => { if (p >= 0) pens[load[k] > 60 ? 2 : load[k] > 8 ? 1 : 0].line([[i * c, j * c], [parts[p][0] * c, parts[p][1] * c]]); });
  K.core(d, W / 2, H / 2, 70, 1.2);
  K.flare(d, W / 2, H / 2, 40, -2.2, 0.9, 2, 1.8);
  K.veil(d);
}

export function domainPieces(K) {
  const table = [
    ["agent-systems", agents], ["evaluation-verification", evaluation], ["security-privacy", privacy],
    ["developer-infrastructure", infrastructure], ["graphics-media", graphics], ["research-education", research],
  ];
  return table.map(([id, draw], k) => ({ slug: `domain-${id}`, page: "catalog.html", w: 1200, h: 900, seed: 70401 + k, draw: (d) => draw(d, K) }));
}
