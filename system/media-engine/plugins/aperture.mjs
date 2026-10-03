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
    // Reading clientWidth every frame forced a layout on each one (15 ms/s on the Retro page, where
    // the panel writes text between frames). The box is read on mount and when it resizes.
    let boxW = canvas.clientWidth, boxH = canvas.clientHeight;
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { boxW = canvas.clientWidth; boxH = canvas.clientHeight; }) : null;
    if (ro) ro.observe(canvas);
    const size = () => {
      if (!ro) { boxW = canvas.clientWidth; boxH = canvas.clientHeight; }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(boxW * dpr)), h = Math.max(1, Math.round(boxH * dpr));
      if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    };
    // The light pole changes with the theme switch or the system scheme; read it when either does.
    let light = lightPole();
    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
    const onScheme = () => { light = lightPole(); };
    if (mq && mq.addEventListener) mq.addEventListener("change", onScheme);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(onScheme) : null;
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return {
      backend: used,
      frame(t) {
        size();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(prog);
        gl.uniform2f(loc.u_res, canvas.width, canvas.height);
        // hero-aperture.js advances u_time at 0.0019 per millisecond; t arrives in seconds.
        gl.uniform1f(loc.u_time, reduced ? 0 : t * 1.9);
        gl.uniform1f(loc.u_light, (p.light ?? light) ? 1 : 0);
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
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onScheme);
        if (tri) tri.dispose(); if (buf) gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      },
    };
  },
};
