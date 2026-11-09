// The tidepool's pixel kit: the shore palette and the small drawing helpers its tiles and
// sprites share. Original art for raw-native under its licence.
import { pixelTile } from "../../../web/world/author.mjs";

// The palette: void and night for the sky, sea teals, bone and sand, rock, kelp, the crab's
// rust, one amber and the four prism colours that only the flare and Tallow's flame use.
export const SHORE = {
  K: "#0b0a12", N: "#141a33", B: "#23305a", T: "#2f5866", S: "#3f8a8a", F: "#9cc4b2", W: "#efe6cf",
  G: "#b8a585", D: "#7d6b5a", R: "#3d3a42", r: "#5d5865", k: "#4b5a2e", C: "#b4492b", c: "#e07a4c",
  A: "#f2b450", P: "#c9877d", y: "#f0e04a", e: "#e8443a", b: "#6fd3e8", v: "#8a5cf0",
};
export const SHORE_PALETTE = Object.values(SHORE);
export const KEY = { ".": null, ...SHORE };
export const T = (rows) => pixelTile(rows, KEY);
export const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// A canvas of w x h characters, drawn into with small helpers, then made a tile.
export function canvas(w, h, ch = ".") {
  const g = Array.from({ length: h }, () => Array(w).fill(ch));
  return {
    g, w, h,
    set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h && c) g[y][x] = c; },
    span(y, x0, x1, c) { for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) g[y][x] = c; },
    // Lay hand-drawn rows at (x, y); "." in the rows leaves what is under.
    stamp(rows, x, y) { rows.forEach((row, j) => [...row].forEach((c, i) => c !== "." && this.set(x + i, y + j, c))); },
    tile() { return T(g.map((r) => r.join(""))); },
  };
}

// A two-colour ordered dither step: fraction f of the pixels take colour b.
export const step = (a, b, f, x, y) => ((BAYER4[y & 3][x & 3] + 0.5) / 16 < f ? b : a);
export function skyTile(a, b, f0, f1, stars = []) {
  const c = canvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.set(x, y, step(a, b, f0 + (f1 - f0) * (y / 15), x, y));
  for (const [x, y, s] of stars) c.set(x, y, s);
  return c.tile();
}

