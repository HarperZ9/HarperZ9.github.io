// ground-draw.js: the region grounds as pure drawing, with no DOM, so the same code runs on the page or in a
// worker (ground-worker.js). ENV holds the plates (Image or ImageBitmap), their luminance grids and the survey data.
export const R = 360;  // world radius of a region's ground
export const ENV = { img: {}, lum: {}, survey: [] };
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Dots whose radius follows a plate's darkness: the halftone screen every print region shares.
function screen(x, k, S, cell, off = [0, 0], gamma = 1) {
  const P = ENV.lum[k]; if (!P) return;
  cell = Math.max(cell, S / 140);  // at most about 20,000 dots a ground, so a new zoom bucket costs milliseconds, not seconds
  for (let py = 0; py < S; py += cell) for (let px = 0; px < S; px += cell) {
    const u = Math.min(P.w - 1, Math.floor((px / S) * P.w)), v = Math.min(P.h - 1, Math.floor((py / S) * P.h));
    const r = Math.pow(1 - P.L[v * P.w + u], gamma) * cell * 0.62;
    if (r > 0.25) { x.beginPath(); x.arc(px + off[0], py + off[1], r, 0, 6.2832); x.fill(); }
  }
}

const DRAW = {
  // The survey sheet (feed-test-25 RESYNTHESIS): a ruled Bauhaus page cut into bands, where every mark
  // points at a computed value. Here the values are the focused grid place's own threads: one tile per
  // thread, in the measured Bauhaus set, a ruler whose ticks fall on the tile pitch, and per-band numerals
  // that print the count of each thread type. Nothing on it is decoration without a number behind it.
  grid(x, S, s) {
    const P = ["#c8322b", "#d79e35", "#1d2562", null], bands = ENV.survey.length ? ENV.survey : [["", 1]];
    const m = S * 0.2, W = S - 2 * m, pitch = W * 0.074, f = Math.max(9, pitch * 0.42);
    x.save(); x.globalAlpha = 0.9;
    const rowsAll = bands.reduce((s2, [, n]) => s2 + Math.ceil(n / 13), 0);
    let y = (S - (rowsAll * pitch + bands.length * pitch * 0.35 + pitch * 0.5)) / 2;  // the sheet centred in its window
    bands.forEach(([type, n], b) => {
      for (let i = 0; i < n; i++) {
        const cx = m + (i % 13) * pitch, cy = y + Math.floor(i / 13) * pitch, c = P[(b + i) % 4];
        if (c) { x.fillStyle = c; x.fillRect(cx + 1, cy + 1, pitch - 2, pitch - 2); }
        else { x.fillStyle = x.strokeStyle; for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(cx + pitch * (0.25 + (k % 3) * 0.25), cy + pitch * (0.25 + Math.floor(k / 3) * 0.25), pitch * 0.07, 0, 6.2832); x.fill(); } }
      }
      const rows = Math.ceil(n / 13);
      x.fillStyle = x.strokeStyle; x.font = `400 ${f}px Conso, ui-monospace, monospace`; x.textBaseline = "middle";
      x.fillText(String(n), m + Math.min(13, n) * pitch + pitch * 0.3, y + pitch * 0.5);  // the band's count
      y += rows * pitch + pitch * 0.35;
    });
    x.fillStyle = x.strokeStyle;  // the ruler: ticks on the tile pitch, a long tick every fifth
    for (let i = 0; i <= 13; i++) { const tx = m + i * pitch, L = i % 5 ? pitch * 0.25 : pitch * 0.5; x.fillRect(tx, y, Math.max(1, s * 0.8), L); }
    x.fillRect(m, y, 13 * pitch, Math.max(1, s * 0.8));
    x.restore();
  },
  deco(x, S, s) {
    const c = S / 2; x.globalAlpha = 0.25; if (ENV.img.deco) x.drawImage(ENV.img.deco, S * 0.2, S * 0.08, S * 0.6, S * 0.84); x.globalAlpha = 1;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * 6.2832; for (const o of [-0.004, 0, 0.004]) { x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(a + o) * c, c + Math.sin(a + o) * c); x.stroke(); } }
    for (let k = 1; k <= 4; k++) { const r = (k / 5) * c; x.beginPath(); for (let j = 0; j <= 16; j++) { const a = Math.PI + (j / 16) * Math.PI, rr = r * (j % 2 ? 0.94 : 1); x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } x.stroke(); }
  },
  brut(x, S, s) {
    x.save(); x.beginPath(); x.moveTo(S * 0.05, S * 0.3); x.lineTo(S * 0.98, S * 0.08); x.lineTo(S * 0.9, S * 0.82); x.lineTo(S * 0.12, S * 0.96); x.closePath(); x.clip();
    screen(x, "brut", S, Math.max(3, 6 * s), [0, 0], 0.8); x.restore();
  },
  surreal(x, S) {
    const r = rng(7); x.save(); x.beginPath();
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * 6.2832, rr = S * (0.36 + r() * 0.06); x.lineTo(S / 2 + Math.cos(a) * rr * 1.1, S / 2 + Math.sin(a) * rr * 0.86); }
    x.clip(); x.globalAlpha = 0.5; if (ENV.img.surreal) x.drawImage(ENV.img.surreal, S * 0.12, S * -0.1, S * 0.8, S * 1.18); x.restore();
  },
  print(x, S, s) {
    x.globalAlpha = 0.9; screen(x, "print", S, Math.max(3, 5 * s), [0, 0], 1.2);
    x.globalAlpha = 0.45; screen(x, "print", S, Math.max(3, 5 * s), [3 * s, -2 * s], 1.2);  // the second drum, misregistered
  },
  glitch(x, S, s) {
    screen(x, "glitch", S, Math.max(3, 4 * s), [0, 0], 2.2);
    const r = rng(11); x.globalAlpha = 0.5; for (let y = 0; y < S; y += Math.max(2, 3 * s)) x.fillRect(0, y, S, Math.max(1, 0.5 * s));
    x.globalAlpha = 1; for (let i = 0; i < 9; i++) { const y = r() * S, h = (6 + r() * 30) * s, dx = (r() - 0.5) * 40 * s; x.drawImage(x.canvas, 0, y, S, h, dx, y, S, h); }
  },
  archive(x, S, s) {
    x.globalAlpha = 0.55; if (ENV.img.archive) x.drawImage(ENV.img.archive, S * 0.1, S * 0.1, S * 0.8, S * 0.8); x.globalAlpha = 0.6;
    for (let y = S * 0.08; y < S * 0.92; y += 18 * s) x.fillRect(S * 0.12, y, S * 0.76, Math.max(1, 0.5 * s));
    x.globalAlpha = 0.18; x.save(); x.translate(S * 0.2, S * 0.18); x.rotate(-0.3); x.fillRect(0, 0, S * 0.22, 26 * s); x.restore();
    x.save(); x.translate(S * 0.7, S * 0.78); x.rotate(0.4); x.fillRect(0, 0, S * 0.2, 26 * s); x.restore();
  },
};


// A feathered ground for one region at a pixel scale (px per world unit).
export function paint(regionId, px, ink) {
  const S = Math.min(2600, Math.round(2 * R * px)), s = S / (2 * R) / 1.6, c = new OffscreenCanvas(S, S), x = c.getContext("2d");
  x.fillStyle = x.strokeStyle = ink; x.lineWidth = Math.max(1, s * 0.6);
  DRAW[regionId](x, S, s);
  x.globalCompositeOperation = "destination-in";
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.7, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}
