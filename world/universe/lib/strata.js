// strata.js: the world's seven strata as translucent sheets behind the road. Each stratum is a wide band in its
// tuned colour, laid one under another and overlapping its neighbours, so where two meet they overprint (multiply
// in light, screen in the dark). The visitor's depth (world.mjs depthAt) sets which stratum fills the view: going
// deeper moves the view down through them. The strata are the shared space between places, so no place's law
// governs them (BLEED.md section 9): a caller may opt one in for a view of its own (`water` applies Beer's
// red-first absorption at depth), and the road does not.
//
//   const strata = strataPainter(canvas, world.strata);
//   strata.draw(depth, { s, dark });   // s is the distance along the road (the edges' only clock)
import { beer } from "./world.mjs";

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export function strataPainter(canvas, strata, { alpha = 0.16, edge = 0.32 } = {}) {
  const rgb = strata.map((s) => hexRGB(s.tuned));
  let last = "";
  return {
    draw(depth, { s = 0, dark = false, water = false } = {}) {
      const W = canvas.width, H = canvas.height; if (!W || !H) return;
      const key = `${W}x${H}:${depth.toFixed(3)}:${s.toFixed(3)}:${dark}`; if (key === last) return; last = key;
      const x = canvas.getContext("2d", { colorSpace: "display-p3" }); x.clearRect(0, 0, W, H);
      const step = H * 0.62, top0 = H * 0.24 - depth * step;  // the current stratum's top sits near the top of the view
      x.globalCompositeOperation = dark ? "screen" : "multiply";
      for (let k = 0; k < strata.length; k++) {
        const top = top0 + k * step, bottom = top + step * 1.3;  // each band runs 30% into the next: the overlap overprints
        if (bottom < -20 || top > H + 20) continue;
        const [r, g, b] = rgb[k], a = (dark ? alpha * 0.55 : alpha) * (0.75 + 0.25 * (strata[k].density ?? 1));
        const wave = (px, phase) => top + Math.sin(px / W * 5.2 + k * 1.9 + s * 0.9 + phase) * H * 0.018 + Math.sin(px / W * 13 + k * 0.7 - s * 0.5) * H * 0.006;
        x.beginPath(); x.moveTo(0, wave(0, 0));
        for (let px = 0; px <= W; px += 24) x.lineTo(px, wave(px, 0));
        x.lineTo(W, bottom); x.lineTo(0, bottom); x.closePath();
        x.fillStyle = `rgba(${r},${g},${b},${a})`; x.fill();
        x.beginPath(); for (let px = 0; px <= W; px += 24) px ? x.lineTo(px, wave(px, 0)) : x.moveTo(px, wave(px, 0));  // the stratum's edge, inked
        x.strokeStyle = `rgba(${r},${g},${b},${dark ? edge * 0.6 : edge})`; x.lineWidth = Math.max(1, W / 1400); x.stroke();
      }
      if (water && !dark) {  // law-beer-absorption: the stack seen through water at this depth, red lost first
        const T = beer(depth); x.fillStyle = `rgb(${T.map((t) => Math.round(255 * t)).join(",")})`; x.fillRect(0, 0, W, H);
      }
      x.globalCompositeOperation = "source-over";
    },
  };
}
