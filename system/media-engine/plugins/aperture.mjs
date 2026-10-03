// system/media-engine/plugins/aperture.mjs
// The aperture as an engine plugin. The shader is the one hero-aperture.js already ships (imported,
// not copied), so the Gallery, Retro Engine and Loom heroes and this plugin draw the same form.
// What changes is who owns the loop: the engine scheduler decides when a frame is drawn, so the
// off-screen, hidden-tab and reduced-motion rules live in one place instead of in each module.
//
// params: { preset: "gallery" | "retro" | "loom", light: boolean | undefined }

import { VERT, FRAG, UNIFORMS, APERTURES } from "../../hero-aperture.js";
import { program, fullscreenTriangle } from "../gl2.mjs";

function lightPole() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "light";
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
}

export const aperture = {
  id: "aperture",
  version: "0.2.0",
  backends: ["webgl2", "webgl"],
  create({ canvas, params, backend, reduced }) {
    const attrs = { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power", preserveDrawingBuffer: true };
    let gl = backend === "webgl" ? null : canvas.getContext("webgl2", attrs);
    const used = gl ? "webgl2" : "webgl";
    if (!gl) gl = canvas.getContext("webgl", attrs);
    if (!gl) throw new Error("aperture needs WebGL");
    // WebGL2 accepts GLSL ES 1.00, so the shipped WebGL1 shader runs unchanged on either context.
    const { prog, loc } = program(gl, FRAG, VERT);
    let tri = null, buf = null;
    if (used === "webgl2") tri = fullscreenTriangle(gl);
    else {
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    let p = { ...params };
    const apply = () => {
      gl.useProgram(prog);
      const preset = { ...UNIFORMS, ...(APERTURES[p.preset] || {}) };
      for (const k in UNIFORMS) if (loc["u_" + k]) gl.uniform1f(loc["u_" + k], preset[k]);
    };
    apply();
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    };
    return {
      backend: used,
      frame(t) {
        size();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(prog);
        gl.uniform2f(loc.u_res, canvas.width, canvas.height);
        // hero-aperture.js advances u_time at 0.0019 per millisecond; t arrives in seconds.
        gl.uniform1f(loc.u_time, reduced ? 0 : t * 1.9);
        gl.uniform1f(loc.u_light, (p.light ?? lightPole()) ? 1 : 0);
        if (tri) { tri.draw(); return; }
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      setParams(next) { p = { ...next }; apply(); },
      readPixels() {
        const out = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return out;
      },
      dispose() {
        if (tri) tri.dispose(); if (buf) gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      },
    };
  },
};
