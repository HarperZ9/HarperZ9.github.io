// Looks and light for the guide stages: each template's ground, label ink and post stack,
// and the overlays that light a guide inside a template world.
import { rad } from "./rig.mjs";
import { rect, circle } from "../../web/motion/path.mjs";
import { text } from "../../web/motion/text.mjs";
import { SHORE_PALETTE } from "./worlds/tidepool_tiles.mjs";

// Looks per style: ground colour, ink for labels, and the template's post stack.
// The thriller's exposure and darkness (PROGRESS.md, step 17: brightened for reel size).
export const THRILLER = { ev: 1, dark: 0.75 };
export const setThriller = (v) => { Object.assign(THRILLER, v); for (const p of LOOKS.thriller.post.passes) if (p.pass === "film") p.ev = THRILLER.ev; };
export const LOOKS = {
  // The retro-thriller template's own stack: colour negative film (the Motion pass, which
  // decodes the sRGB colours first, raw-native #101), then the soft tube.
  thriller: { ground: [0.012, 0.011, 0.014], ink: "#d9cdb4", dim: "#8a8070",
    post: { bloom: 0.2, threshold: 1.0, vignette: 0.2, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: THRILLER.ev },
      { pass: "crt-classic", cell: 3, scanlines: true, scanStrength: 0.25, mask: "grille", maskStrength: 0.15, bloom: 0.1, curvature: 0.06, aberration: 0.08, vignette: 0.35 }] } },
  // The painted isometric template: the registered paint pass (raw-native #55).
  painted: { ground: [0.02, 0.022, 0.03], ink: "#f1e4c8", dim: "#b29d7e", post: { bloom: 0.06, threshold: 1.0, vignette: 0.3, grain: 0, passes: [{ pass: "paint", preset: "oil-grotesque" }] } },
  // Pixel 2.5D: pixel mode at 480 x 270 (or 960 x 540 for a sheet), quantised to the tidepool's
  // own fixed palette (worlds/tidepool_tiles.mjs) with an ordered dither.
  pixel: { ground: [0.043, 0.039, 0.07], ink: "#efe6cf", dim: "#9cc4b2", pixelSize: [480, 270],
    post: { bloom: 0, vignette: 0, grain: 0, passes: [{ pass: "dither", palette: SHORE_PALETTE, mode: "none" }] } },
};

export const label = (A, s, size, x, y, fill, anchor = "center") => ({ shape: text(s, { atlas: A, size, x, y, anchor }).shape, fill, screen: true });

// A dark overlay with a hole of light at (lx, ly) on screen: the practical-light model of the
// thriller template. Everything outside the guide's light falls away.
export function darkness(lx, ly, r, k = 0.9) {
  return { shape: rect(-10, -10, 1940, 1100), screen: true,
    fill: rad(lx, ly, r, [0, [0, 0, 0, 0]], [0.35, [0, 0, 0, 0.12 * k]], [0.7, [0, 0, 0, 0.62 * k]], [1, [0, 0, 0, k]]) };
}
export const glow = (x, y, r, c = [1, 0.62, 0.28], a = 0.5) =>
  ({ shape: circle(x, y, r, 96), screen: true, blend: "add", fill: rad(x, y, r, [0, [...c, a]], [0.4, [...c, a * 0.35]], [1, [...c, 0]]) });

// Screen position of a scene point under a camera (Motion's mapping at depth 0).
export const toScreen = (cam, x, y) => [960 + (x - cam.x) * cam.zoom, 540 + (y - cam.y) * cam.zoom];
