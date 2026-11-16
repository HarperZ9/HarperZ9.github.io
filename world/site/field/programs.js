// programs.js: the field's WebGL2 context and its nine shader programs.
//
// The scene shader is large. Asking a driver whether it compiled makes the page wait for the answer, and on a
// cold driver that wait was measured at 22 seconds (Chrome on Direct3D 11, 15 November 2026): nothing on the page
// answered a press in that time. prepareField() hands every program to the driver without asking, then looks
// every 50 ms whether they are done (KHR_parallel_shader_compile), so the page keeps answering while the driver
// works. createField() then finds the programs linked and only reads their status. Where the extension is
// missing, prepareField() resolves false and createField() compiles as before, waiting on the driver.
import { TRANS_FRAG, MS_FRAG, SKY_FRAG } from "./atmosphere.glsl.js";
import { WAVE_FRAG, SCENE_FRAG, POST_FRAG, VERT } from "./scene.glsl.js";
import { SETTLE_FRAG, UPSCALE_FRAG, SHARPEN_FRAG } from "./upscale.glsl.js";

const FRAGS = [TRANS_FRAG, MS_FRAG, SKY_FRAG, WAVE_FRAG, SCENE_FRAG, POST_FRAG, SETTLE_FRAG, UPSCALE_FRAG, SHARPEN_FRAG];
const LINKED = new WeakMap();   // context -> Map(fragment source -> program handed to the driver)

// The one context of a canvas. A second call returns the first context, so prepareField and createField share it.
export function context(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) throw new Error("glass-water field: WebGL2 with float targets is not available here");
  // a software rasteriser (SwiftShader, llvmpipe, WARP) runs this shader on the CPU and blocks the page; such a
  // device keeps the rendered plate. ?gpu=any lifts the check, for renders made on purpose (the 4K plates)
  const dbg = gl.getExtension("WEBGL_debug_renderer_info"), who = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  if (/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|warp/i.test(who) && new URLSearchParams(location.search).get("gpu") !== "any") throw new Error(`software renderer (${who})`);
  return gl;
}
// compile and link with no question asked of the driver
function begin(gl, frag) {
  const p = gl.createProgram();
  for (const [src, type] of [[VERT, gl.VERTEX_SHADER], [frag, gl.FRAGMENT_SHADER]]) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s); }
  gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p);
  return p;
}
// A linked program and its uniform locations. Reading the status waits for the driver unless prepareField ran first.
export function program(gl, frag) {
  const p = LINKED.get(gl)?.get(frag) ?? begin(gl, frag);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error([gl.getProgramInfoLog(p), ...gl.getAttachedShaders(p).map((s) => gl.getShaderInfoLog(s))].filter(Boolean).join("\n"));
  const u = new Proxy({}, { get: (c, n) => (n in c ? c[n] : (c[n] = gl.getUniformLocation(p, n))) });
  return { p, u };
}
// Start every program and resolve once the driver has finished them all. True when the page never waited.
export async function prepareField(canvas, { every = 50 } = {}) {
  const gl = context(canvas), ext = gl.getExtension("KHR_parallel_shader_compile");
  if (!ext) return false;
  const made = new Map(FRAGS.map((f) => [f, begin(gl, f)]));
  LINKED.set(gl, made); gl.flush();
  while (![...made.values()].every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR))) {
    if (gl.isContextLost()) throw new Error("glass-water field: the context was lost while the shaders compiled");
    await new Promise((r) => setTimeout(r, every));
  }
  return true;
}
