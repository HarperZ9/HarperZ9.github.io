// laws-draw2.js: the second half of the drawn laws (sound, tools, investigations). Same contract as laws-draw.js:
// LAWS2[name](x, g, box, s) with box { x, y, w, h } in backing px and s { ink, accent, wall, px, data }.
// Sound laws read the theme's own score when the page passes it (s.data.hum: hum4-theme-hits.json, Hum v4).
const steps = (g, n = 6) => Math.round(g.approach * n);

// law-kac-drum: sand on a square plate gathers on the nodal lines of its mode; higher pitch, finer figure
const MODES = [[1, 2], [1, 3], [2, 3], [1, 4], [2, 5], [3, 5], [4, 7]];
function chladni(x, g, b, s) {
  const [n, m] = MODES[Math.min(MODES.length - 1, steps(g, MODES.length - 1))], N = 200;
  x.fillStyle = s.ink; const side = Math.min(b.w, b.h), x0 = b.x + (b.w - side) / 2, y0 = b.y + (b.h - side) / 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, f = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) - Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
    if (Math.abs(f) < 0.06) x.fillRect(x0 + u * side, y0 + v * side, Math.max(1.5, s.px * 2), Math.max(1.5, s.px * 2));
  }
}

// music-dark-room: an impulse in a dark room: a 1.5 s decay, its highs gone first
function darkRoom(x, g, b, s) {
  const T = 1.5, shown = g.approach; let r = 7; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5);
  x.strokeStyle = s.ink; x.lineWidth = s.px; x.beginPath();
  for (let q = 0; q < 600 * shown; q++) {
    const t = (q / 600) * 2, env = Math.exp((-6.9 * t) / T), X = b.x + (t / 2) * b.w, Y = b.y + b.h / 2 + rnd() * env * b.h * 0.9;
    q ? x.lineTo(X, Y) : x.moveTo(X, Y);
  }
  x.stroke();
}

// music-pad-ducks-kick: the pad's level across two bars of the theme's cell, dipping 6 dB under each kick
function ducking(x, g, b, s) {
  const hum = s.data?.hum; if (!hum) return; const bar = 60 / hum.bpm * 4, t0 = 16 * bar, span = 2 * bar;
  const kicks = hum.hits.filter((h) => h.name.startsWith("kick") && h.t >= t0 && h.t < t0 + span).map((h) => [(h.t - t0) / span, h.vel]);
  const shown = g.approach, dbToY = (db) => b.y + b.h * (0.15 + (-db / 9) * 0.7);
  x.strokeStyle = s.ink; x.lineWidth = 2 * s.px; x.beginPath();
  for (let q = 0; q <= 300 * shown; q++) {
    const u = q / 300; let db = 0; for (const [k, v] of kicks) { const d = u - k; if (d >= 0 && d < 0.06) db = Math.min(db, -6 * v * (1 - d / 0.06)); }
    q ? x.lineTo(b.x + u * b.w, dbToY(db)) : x.moveTo(b.x + u * b.w, dbToY(db));
  }
  x.stroke(); x.fillStyle = s.accent;
  for (const [k, v] of kicks) if (k <= shown) x.fillRect(b.x + k * b.w - s.px, b.y + b.h * 0.92 - v * b.h * 0.12, 2 * s.px, v * b.h * 0.12);
}

// music-third-thin: the minor colour without the third: root, fifth and flat sixth full, the third a hairline
function thirdThin(x, g, b, s) {
  const tones = [[0, 1], [3, 0.12], [7, 1], [8, 1], [12, 0.6]], n = steps(g, tones.length);
  tones.slice(0, n).forEach(([semi, wgt]) => {
    const Y = b.y + b.h * (0.9 - (semi / 12) * 0.8); x.strokeStyle = semi === 8 ? s.accent : s.ink; x.lineWidth = Math.max(s.px * 0.6, wgt * 7 * s.px);
    x.beginPath(); x.moveTo(b.x, Y); x.lineTo(b.x + b.w, Y); x.stroke();
  });
}

// music-b6-colour: the theme's chord cycle, the flat-sixth chords as the one colour move
function cycle(x, g, b, s) {
  const chords = s.data?.hum?.cycle || ["i5", "bVI/i", "bVIIsus2/i", "bVI/i", "i5(add9)", "bVImaj7/i"], n = Math.max(1, steps(g, chords.length));
  const w = b.w / chords.length; x.font = `600 ${Math.min(w * 0.18, b.h * 0.12)}px Conso, ui-monospace, monospace`; x.textBaseline = "middle";
  chords.slice(0, n).forEach((c, i) => {
    const six = c.startsWith("bVI") && !c.startsWith("bVII"); x.fillStyle = six ? s.accent : s.ink; x.globalAlpha = six ? 0.95 : 0.25;
    x.fillRect(b.x + i * w + 2 * s.px, b.y + b.h * 0.25, w - 4 * s.px, b.h * 0.5); x.globalAlpha = 1; x.fillStyle = six ? s.wall : s.ink; x.fillText(c, b.x + i * w + 6 * s.px, b.y + b.h * 0.5);
  });
}

// a ring: a ripple's rings spread and hold their spacing (the ring bridge's shape)
function ring(x, g, b, s) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) * 0.48, n = 1 + steps(g, 9);
  x.strokeStyle = s.ink; x.lineWidth = 1.4 * s.px;
  for (let i = 1; i <= n; i++) { x.globalAlpha = 1 - i / (n + 2); x.beginPath(); x.ellipse(cx, cy, (R * i) / 10, (R * i) / 10 * 0.62, 0, 0, 6.283); x.stroke(); }
  x.globalAlpha = 1;
}

// rule-time-boxed-practice: a fixed half hour, filled minute by minute; the clock is part of the work
function timebox(x, g, b, s) {
  const mins = Math.round(g.approach * 30), cols = 10, cw = b.w / cols, ch = Math.min(cw, b.h / 5);
  for (let k = 0; k < 30; k++) { x.fillStyle = s.ink; x.globalAlpha = k < mins ? 0.85 : 0.12; x.fillRect(b.x + (k % cols) * cw + s.px, b.y + ((k / cols) | 0) * ch + s.px, cw - 2 * s.px, ch - 2 * s.px); }
  x.globalAlpha = 1; x.fillStyle = s.ink; x.font = `400 ${ch * 0.45}px Conso, ui-monospace, monospace`; x.textBaseline = "top";
  x.fillText(`Done in ${String(mins).padStart(2, "0")}:00`, b.x, b.y + ch * 3.2);
}

// rule-argument-movements: premises, a presupposition (dashed) and the conclusion, joined by turns you can check
function argument(x, g, b, s) {
  const n = steps(g, 6), bx = (u, v, w, h, dashed, hot) => { x.setLineDash(dashed ? [5 * s.px, 4 * s.px] : []); x.strokeStyle = hot ? s.accent : s.ink; x.lineWidth = (hot ? 2.5 : 1.5) * s.px; x.strokeRect(b.x + u * b.w, b.y + v * b.h, w * b.w, h * b.h); };
  const line = (a, c) => { x.setLineDash([]); x.strokeStyle = s.ink; x.lineWidth = s.px; x.beginPath(); x.moveTo(b.x + a[0] * b.w, b.y + a[1] * b.h); x.lineTo(b.x + c[0] * b.w, b.y + c[1] * b.h); x.stroke(); };
  if (n >= 1) bx(0.02, 0.06, 0.28, 0.2); if (n >= 2) bx(0.36, 0.06, 0.28, 0.2); if (n >= 3) bx(0.7, 0.06, 0.28, 0.2, true);
  if (n >= 4) { line([0.16, 0.26], [0.5, 0.62]); line([0.5, 0.26], [0.5, 0.62]); line([0.84, 0.26], [0.5, 0.62]); }
  if (n >= 5) bx(0.3, 0.62, 0.4, 0.24, false, n >= 6);
  x.setLineDash([]);
}

// network: the world's bridges as threads between the places they join, places ringed by stratum
function network(x, g, b, s) {
  const w = s.data?.world; if (!w) return; const places = w.raw.places, idx = new Map(places.map((p, i) => [p.id, i])), N = places.length;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) * 0.46, pos = (i) => [cx + R * Math.cos((i / N) * 6.283), cy + R * Math.sin((i / N) * 6.283)];
  places.forEach((p, i) => { const [X, Y] = pos(i); x.fillStyle = w.strata[w.depth(p.id)]?.tuned || s.ink; x.fillRect(X - s.px, Y - s.px, 2.5 * s.px, 2.5 * s.px); });
  const shown = Math.round(g.approach * w.raw.bridges.length);
  w.raw.bridges.slice(0, shown).forEach((br, k) => {
    const ids = br.joins.map((j) => idx.get(j)).filter((v) => v != null); x.strokeStyle = k === shown - 1 ? s.accent : s.ink; x.globalAlpha = k === shown - 1 ? 0.95 : 0.55; x.lineWidth = 1.5 * s.px;
    for (let a = 0; a < ids.length - 1; a++) { const [x1, y1] = pos(ids[a]), [x2, y2] = pos(ids[a + 1]); x.beginPath(); x.moveTo(x1, y1); x.quadraticCurveTo(cx, cy, x2, y2); x.stroke(); }
  });
  x.globalAlpha = 1;
}

export const LAWS2 = { "law-kac-drum": chladni, chladni, "music-dark-room": darkRoom, "music-pad-ducks-kick": ducking, "music-third-thin": thirdThin,
  "music-b6-colour": cycle, ring, "rule-time-boxed-practice": timebox, "rule-argument-movements": argument, network };
