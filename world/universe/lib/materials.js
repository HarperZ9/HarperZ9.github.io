// Threads drawn as materials. One function per edge type; the material is the type, so the map needs no key.
// All drawing is in screen space: callers pass screen points. Ink only; strength 0..1 sets alpha and weight.
const TAU = Math.PI * 2;

function sag(a, b, k = 0.12) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  return [mx - dy * k, my + dx * k];  // control point: threads hang a little, like cord
}
function pts(a, b, k, n) {
  const c = sag(a, b, k), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
function normalAt(p, i) {
  const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [-dy / L, dx / L, dx / L, dy / L];
}
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function line(ctx, p) { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }

// motif: rope, two strands laid around each other, with the lay marks across them
function rope(ctx, a, b, s) {
  const n = Math.max(8, Math.round(len(a, b) / 4)), p = pts(a, b, 0.1, n), w = 1.2 + 1.6 * s;
  for (const ph of [0, Math.PI]) {
    line(ctx, p.map((q, i) => { const [nx, ny] = normalAt(p, i), o = Math.sin(i * 0.9 + ph) * w; return [q[0] + nx * o, q[1] + ny * o]; }));
  }
  ctx.save(); ctx.lineWidth *= 0.7;
  for (let i = 2; i < p.length - 2; i += 3) { const [nx, ny, tx, ty] = normalAt(p, i), q = p[i];
    ctx.beginPath(); ctx.moveTo(q[0] - nx * w - tx * w * 0.8, q[1] - ny * w - ty * w * 0.8); ctx.lineTo(q[0] + nx * w + tx * w * 0.8, q[1] + ny * w + ty * w * 0.8); ctx.stroke(); }
  ctx.restore();
}

// cites: an engraved line that swells in the middle and tapers to nothing, filled, not stroked
function engraving(ctx, a, b, s, double = false) {
  const n = Math.max(10, Math.round(len(a, b) / 6)), p = pts(a, b, 0.06, n), w = 0.5 + 1.4 * s;
  const ribbon = (off) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const [nx, ny] = normalAt(p, i), h = Math.sin((i / n) * Math.PI) * w; ctx.lineTo(p[i][0] + nx * (off + h), p[i][1] + ny * (off + h)); }
    for (let i = n; i >= 0; i--) { const [nx, ny] = normalAt(p, i), h = Math.sin((i / n) * Math.PI) * w; ctx.lineTo(p[i][0] + nx * (off - h), p[i][1] + ny * (off - h)); }
    ctx.closePath(); ctx.fill();
  };
  if (!double) return ribbon(0);
  ribbon(-2.2); ribbon(2.2);  // same-source: two burin lines cut side by side, hatched across
  for (let i = 3; i < n - 2; i += 3) { const [nx, ny] = normalAt(p, i), q = p[i]; ctx.beginPath(); ctx.moveTo(q[0] - nx * 3, q[1] - ny * 3); ctx.lineTo(q[0] + nx * 3 + 2, q[1] + ny * 3 + 2); ctx.stroke(); }
}

// material: a running stitch through cloth, alternating above and below the seam
function stitch(ctx, a, b) {
  const n = Math.max(6, Math.round(len(a, b) / 9)), p = pts(a, b, 0.04, n);
  for (let i = 0; i < n; i += 2) { const q = p[i], r = p[i + 1]; const [nx, ny] = normalAt(p, i), o = i % 4 ? 1.4 : -1.4;
    ctx.beginPath(); ctx.moveTo(q[0] + nx * o, q[1] + ny * o); ctx.lineTo(r[0] - nx * o, r[1] - ny * o); ctx.stroke(); }
}

// twin: a blade, two edges that meet at both points
function blade(ctx, a, b, s) {
  const n = 24, p = pts(a, b, 0, n), w = 2 + 3 * s;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const [nx, ny] = normalAt(p, i), h = Math.sin((i / n) * Math.PI) * w; ctx.lineTo(p[i][0] + nx * h, p[i][1] + ny * h); }
  for (let i = n; i >= 0; i--) { const [nx, ny] = normalAt(p, i), h = Math.sin((i / n) * Math.PI) * w; ctx.lineTo(p[i][0] - nx * h, p[i][1] - ny * h); }
  ctx.closePath(); ctx.stroke(); line(ctx, p);  // the fuller down the middle
}

// literary: pricked holes, the way a scribe marks the ruling of a page
function pricking(ctx, a, b, s) {
  const n = Math.max(5, Math.round(len(a, b) / 7)), p = pts(a, b, 0.14, n), r = 0.9 + 0.8 * s;
  for (const q of p) { ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, TAU); ctx.fill(); }
}

// symbol: a hairline carrying a struck stamp at its middle, a postmark ring with its bar
function stamp(ctx, a, b, s) {
  const p = pts(a, b, 0.05, 16), m = p[8], r = 5 + 4 * s;
  ctx.save(); ctx.lineWidth *= 0.6; line(ctx, p); ctx.restore();
  ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(0.35);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0.3, TAU - 0.3); ctx.stroke();
  ctx.fillRect(-r * 1.5, -0.7, r * 3, 1.4);
  ctx.restore();
}

// question: a line that turns back on itself before it reaches, the hook of an asked thing
function hook(ctx, a, b, s) {
  const p = pts(a, b, 0.18, 20); line(ctx, p);
  const q = p[15], [nx, ny] = normalAt(p, 15), r = 3 + 2 * s;
  ctx.beginPath(); ctx.arc(q[0] + nx * r, q[1] + ny * r, r, 0, Math.PI * 1.5); ctx.stroke();
}

// series: a binder's kettle stitch, little crosses along the spine of a gathering
function binding(ctx, a, b) {
  const n = Math.max(4, Math.round(len(a, b) / 16)), p = pts(a, b, 0.02, n);
  ctx.save(); ctx.lineWidth *= 0.6; line(ctx, p); ctx.restore();
  for (let i = 1; i < n; i++) { const q = p[i]; ctx.beginPath(); ctx.moveTo(q[0] - 2.5, q[1] - 2.5); ctx.lineTo(q[0] + 2.5, q[1] + 2.5); ctx.moveTo(q[0] + 2.5, q[1] - 2.5); ctx.lineTo(q[0] - 2.5, q[1] + 2.5); ctx.stroke(); }
}

export const MATERIAL = {
  motif: rope, cites: (c, a, b, s) => engraving(c, a, b, s), "same-source": (c, a, b, s) => engraving(c, a, b, s, true),
  material: stitch, twin: blade, literary: pricking, symbol: stamp, question: hook, series: binding,
};
export const MATERIAL_NAME = {
  motif: "rope", cites: "engraved line", "same-source": "double engraved line", material: "stitch",
  twin: "blade", literary: "pricked ruling", symbol: "stamp", question: "hook", series: "binding",
};

export function drawEdge(ctx, type, a, b, s) { (MATERIAL[type] || engraving)(ctx, a, b, s); }

// Node marks: the shape says what kind of place it is.
export function mark(ctx, kind, x, y, r) {
  ctx.beginPath();
  if (kind === "room") { ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.stroke(); ctx.fillRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9); return; }
  if (kind === "place") { ctx.arc(x, y, r * 1.05, 0, TAU); ctx.fill(); return; }
  if (kind === "essay") { ctx.rect(x - r * 0.75, y - r, r * 1.5, r * 2); ctx.stroke(); for (let i = 0; i < 3; i++) ctx.fillRect(x - r * 0.45, y - r * 0.5 + i * r * 0.45, r * 0.9, 1); return; }
  if (kind === "film") { ctx.rect(x - r * 1.2, y - r * 0.8, r * 2.4, r * 1.6); ctx.stroke(); for (let i = -1; i <= 1; i++) { ctx.fillRect(x + i * r * 0.7 - 1, y - r * 0.68, 2, 2); ctx.fillRect(x + i * r * 0.7 - 1, y + r * 0.5, 2, 2); } return; }
  // object: a perforated plate, the edge of a stamp sheet
  ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.stroke();
  for (let i = -2; i <= 2; i++) for (const [px, py] of [[x + i * r * 0.4, y - r], [x + i * r * 0.4, y + r], [x - r, y + i * r * 0.4], [x + r, y + i * r * 0.4]]) { ctx.beginPath(); ctx.arc(px, py, 0.9, 0, TAU); ctx.fill(); }
}

// A small drawn sample of a material, for the thread list beside each place.
export function swatch(type, ink) {
  const c = document.createElement("canvas"), d = Math.min(devicePixelRatio || 1, 2.5), W = 44, H = 16;
  c.width = Math.round(W * d); c.height = Math.round(H * d); c.style.width = W + "px"; c.style.height = H + "px";
  c.setAttribute("aria-hidden", "true"); c.className = "swatch"; c.dataset.art = "";
  const x = c.getContext("2d"); x.scale(d, d); x.strokeStyle = x.fillStyle = ink; x.lineWidth = 1; x.lineCap = "round";
  drawEdge(x, type, [4, 9], [40, 7], 0.7);
  return c;
}
