// system/media-engine/plugins/type.mjs
// The type forge as an engine plugin: text set in a freshly minted Zain Mint face, drawn straight
// from the outlines with Path2D (no font file, no network). A refused mint draws nothing and says
// why. The frame can go on to the Retro pipeline or the Loom like any other plugin's.
//
// params: { text, weight, contrast, width, style }

import { mint } from "../../type-forge/forge.mjs";

export const type = {
  id: "type",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params }) {
    let p = { text: "Adhesion", ...params }, drawn = "", face = null;
    const faceParams = () => {
      const out = {};
      for (const k of ["weight", "contrast", "width", "x_height", "roundness", "aperture", "style"]) if (p[k] !== undefined && p[k] !== "") out[k] = p[k];
      return out;
    };
    return {
      backend: "canvas2d",
      static: true,
      get face() { return face; },
      frame() {
        const key = JSON.stringify(p) + "|" + canvas.width + "x" + canvas.height;
        if (drawn === key) return;
        face = mint(faceParams(), 58);
        const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ebe5d8"; ctx.fillRect(0, 0, w, h);
        drawn = key;
        if (face.refused) return;
        // Lay the text out in font units, then scale the whole line to fit the stage.
        const xh = face.metrics.x_height, H = 2.2 * xh;
        let x = 40, prev = null;
        const paths = [];
        for (const ch of String(p.text || "")) {
          if (ch === " ") { x += 250; prev = null; continue; }
          const g = face.glyphs[ch];
          if (!g) continue;
          if (prev) x += face.kerning[prev + ch] || 0;
          prev = ch;
          paths.push([x, g]);
          x += g.advance;
        }
        const total = x + 40, k = Math.min(w / total, h / (H + 60)) * 0.92;
        ctx.setTransform(k, 0, 0, -k, (w - total * k) / 2, (h + (H + 60) * k) / 2 - 60 * k);
        ctx.fillStyle = "#15130f";
        for (const [ox, g] of paths) {
          const path = new Path2D();
          for (const ring of g.contours) {
            ring.forEach(([px, py], i) => (i ? path.lineTo(ox + px, py) : path.moveTo(ox + px, py)));
            path.closePath();
          }
          ctx.fill(path, "nonzero");
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
      setParams(next) { p = { ...p, ...next }; },
      readPixels() { return new Uint8Array(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.buffer); },
      dispose() {},
    };
  },
};
