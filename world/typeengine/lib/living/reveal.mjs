// lib/living/reveal.mjs: one reveal, shared. What lies under a surface comes up because something on the surface is
// carried away: water poured across paint washes the top word downstream and the word beneath shows through.
// Living type uses it for a translation or an etymology under a word; Daylight uses the same call for what lies under
// a claim (BLEED.md section 5). It takes pictures, not type, so any two images on a light ground can use it.
//
//   const r = createReveal({ top, under, w, h, law: 'pour', mask })   top, under: linear RGB images (w*h*3); top is
//   an opaque painted surface (its ground hides the under layer), under is what the wash uncovers
//   r.frame(p) -> linear RGB at progress p in 0..1 (the law's own time; p = 1 is fully revealed)
//   r.seconds  how long the law takes in its own physics
// mask (optional): coverage of the top material, so the flow knows where the pigment is (it drives nothing else).
import { simulate } from './transfer.mjs';
import { fieldsAt, bilerp, sample } from './compose.mjs';
import { clamp } from './fields.mjs';

export function createReveal({ top, under, w, h, law = 'pour', mask = null, seed = 1 }) {
  const G = { w, h, coverage: { data: mask ?? new Float32Array(w * h) }, strokes: { strokes: [] } };
  const sim = simulate(law, { w, h, G, seed });
  return {
    sim, seconds: sim.seconds,
    frame(p, now = {}) {
      const top_ = now.top ?? top, under_ = now.under ?? under; // a side that is moving on its own clock
      const F = fieldsAt(sim, p), { nx, ny, sx, sy } = sim, out = new Float32Array(w * h * 3), a = [0, 0, 0], u = [0, 0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gx = (x + 0.5) / sx - 0.5, gy = (y + 0.5) / sy - 0.5, X = (bilerp(F.px, nx, ny, gx, gy) + 0.5) * sx - 0.5, Y = (bilerp(F.py, nx, ny, gx, gy) + 0.5) * sy - 0.5;
        const R = bilerp(F.R, nx, ny, gx, gy), Wv = bilerp(F.W, nx, ny, gx, gy), o = (y * w + x) * 3;
        sample(top_, w, h, X, Y, a); sample(under_, w, h, x, y, u);
        // the top is a film of paint over what lies beneath: carried by the water and thinned where it has passed
        // (R), so it hides the under layer until the wash opens it; the water darkens a little and catches a highlight
        // on its leading edge
        const film = 1 - 0.07 * clamp(Wv) * (1 - p * 0.8), lip = clamp(1 - Math.abs(Wv - 0.55) * 6) * 0.05 * (1 - p), alpha = Math.pow(clamp(R * 1.1), 1.6);
        for (let c = 0; c < 3; c++) out[o + c] = (u[c] * (1 - alpha) + a[c] * alpha) * film + lip;
      }
      return out;
    },
  };
}
