// A procedural scene-linear test frame (Rec.709 linear light, unbounded): a dark night street
// wall with practical lights far over white (where halation shows), a neon tube, a skin-tone
// and colour-patch row, a grey ramp in stops (where the tone curve and grain show), and a
// soft gradient sky. Deterministic, so tests and images use the same frame.
export function sceneCard(w = 480, h = 270, t = 0) {
  const d = new Float32Array(w * h * 4);
  const patches = [[0.45, 0.32, 0.25], [0.18, 0.12, 0.09], [0.12, 0.18, 0.32], [0.10, 0.14, 0.06], [0.28, 0.06, 0.05], [0.06, 0.18, 0.12], [0.45, 0.35, 0.04], [0.05, 0.06, 0.25]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h; let c;
    if (v < 0.35) { const k = 0.02 + 0.06 * (1 - v / 0.35); c = [k * 0.6, k * 0.75, k * 1.2]; }
    else if (v < 0.7) { const n = 0.012 + 0.006 * Math.sin(x * 0.7) * Math.sin(y * 1.3); c = [n * 1.1, n, n * 0.8]; }
    else if (v < 0.85) { const p = patches[Math.min(7, Math.floor(u * 8))]; c = p.slice(); }
    else { const st = Math.floor(u * 12) - 8; const g = 0.18 * Math.pow(2, st); c = [g, g, g]; }
    const lamp = (cx, cy, r, L, col) => { const dd = Math.hypot((u - cx) * w, (v - cy) * h); if (dd < r) c = col.map((k) => k * L); };
    // t moves one lamp and flickers the neon; t = 0 is the fixed test frame.
    lamp(0.18 + 0.05 * Math.sin(t * 0.7), 0.25, 4, 60, [1, 0.8, 0.55]); lamp(0.82, 0.22, 2.5, 120, [1, 0.9, 0.7]); lamp(0.5, 0.12, 6, 25, [0.9, 0.95, 1]);
    const neon = t > 0 && Math.sin(t * 23) > 0.93 ? 0.3 : 1;
    if (v > 0.42 && v < 0.44 && u > 0.3 && u < 0.7) c = [8 * neon, 0.4 * neon, 1.6 * neon];
    if (u > 0.65 && u < 0.67 && v > 0.36 && v < 0.6) c = [0.3, 2.5, 6];
    d.set([c[0], c[1], c[2], 1], (y * w + x) * 4);
  }
  return { width: w, height: h, data: d };
}
