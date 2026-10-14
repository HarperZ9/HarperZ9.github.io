// An animated, game-like source frame at console resolution (R'G'B' signal values), for the
// live showcase: a banded sky, two parallax ridges, a tiled floor, a bobbing sprite, a blinking
// pickup and a dialogue box of one-pixel strokes (where composite video and the mask show).
export function gameFrame(w = 256, h = 224, t = 0) {
  const d = new Float32Array(w * h * 4), set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= w || y >= h) return; d.set([r, g, b, 1], (y * w + x) * 4); };
  const ridge = (x, s, a, f) => Math.floor(h * a + 10 * Math.sin((x + t * s) * f) + 6 * Math.sin((x + t * s) * f * 2.7 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const band = Math.floor((y / h) * 8) / 8;
    let c = [0.12 + 0.5 * band, 0.1 + 0.25 * band, 0.35 - 0.1 * band];
    if (y > ridge(x, 12, 0.48, 0.035)) c = [0.18, 0.12, 0.28];
    if (y > ridge(x, 30, 0.6, 0.05)) c = [0.08, 0.22, 0.2];
    if (y > h * 0.78) c = (((x + Math.floor(t * 60)) >> 4) + (y >> 4)) & 1 ? [0.42, 0.3, 0.2] : [0.36, 0.25, 0.16];
    set(x, y, ...c);
  }
  const sx = Math.floor(w * 0.35), sy = Math.floor(h * 0.78) - 24 + Math.round(2 * Math.sin(t * 8));
  for (let y = 0; y < 24; y++) for (let x = 0; x < 14; x++) {
    const head = y < 8 && x > 2 && x < 11, body = y >= 8 && y < 18 && x > 1 && x < 12, legs = y >= 18 && (x === 3 || x === 4 || x === 9 || x === 10);
    if (head) set(sx + x, sy + y, 0.96, 0.78, 0.6); else if (body) set(sx + x, sy + y, 0.85, 0.15, 0.2); else if (legs) set(sx + x, sy + y, 0.15, 0.2, 0.6);
  }
  if (Math.floor(t * 4) % 2 === 0) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) set(Math.floor(w * 0.62) + x, Math.floor(h * 0.62) + y, 1, 0.86, 0.2);
  const bx = 16, by = Math.floor(h * 0.06), bw = w - 32, bh = 34;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const edge = x < 2 || y < 2 || x >= bw - 2 || y >= bh - 2; set(bx + x, by + y, ...(edge ? [0.95, 0.95, 0.95] : [0.04, 0.05, 0.14])); }
  for (let i = 0; i < 26; i++) for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (((i * 7 + x * 3 + y * 5) % 4) === 0 || x === 0) set(bx + 8 + i * 8 + x, by + 8 + y + (i > 12 ? 10 : 0) - (i > 12 ? 0 : 0), 0.95, 0.95, 0.9);
  return { width: w, height: h, data: d };
}
