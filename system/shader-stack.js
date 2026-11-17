/* shader-stack.js: several fragment shaders and pictures blended into one frame, on one WebGL 1 context.

   The base is the shader being edited. Above it sit up to MAX_LAYERS layers. A layer is either a shader (GLSL with
   the runner's mainImage contract, see shader-runner.js `wrap`) or a picture (a canvas, an image, or a function that
   returns one, read again each frame). Each layer has a blend mode, a mix amount from 0 to 1, and a key from 0 to 1
   that lets the layer's own light steer how much of it lands on each pixel (weightOf).

   How a frame is drawn: with no layers the base draws straight to the canvas, as the plain runner does. With layers,
   each shader draws once into its own texture, each picture is uploaded once, and one composite pass reads them all
   and blends them in order. So a frame of N shader layers is N + 2 draws (base, layers, composite), whatever the
   blend modes are. The old Retro Studio stack ran one WebGL context per layer and blended them with a 2D canvas.

   The composite is exact where it should be: textures are read at texel centres with nearest filtering and dither is
   off, so a layer at mix 0 leaves every pixel as it was without that layer. Zero dependencies. */
import { wrap, PREAMBLE_LINES, PALETTE_SIZE } from "./shader-runner.js";

// Eight textures is the least a WebGL 1 fragment shader is guaranteed (MAX_TEXTURE_IMAGE_UNITS >= 8): the base and seven.
export const MAX_LAYERS = 7;
export const BLENDS = Object.freeze([
  ["normal", "Normal"], ["add", "Add"], ["multiply", "Multiply"], ["screen", "Screen"],
  ["overlay", "Overlay"], ["difference", "Difference"], ["lighten", "Lighten"], ["darken", "Darken"],
]);
const MODE = Object.fromEntries(BLENDS.map(([id], i) => [id, i]));
export const blendIndex = (id) => (id in MODE ? MODE[id] : 0);

const VERT = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";
const N = MAX_LAYERS + 1;
// A layer's weight on a pixel, as the composite computes it: its mix, times its alpha, eased toward its own luminance
// there by its key (0: the same everywhere; 1: in proportion to how light the layer is). The key is the first property
// of a layer's own that steers its blend; shader-layers.mjs says what each source is and what it carries.
export const weightOf = (mix, key, rgb, alpha = 1) => mix * alpha * (1 + (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] - 1) * key);
// The same blend on the CPU, for tests and for anyone checking the GLSL below: a and b are 0..1 per channel.
export function blendOne(mode, a, b) {
  switch (typeof mode === "number" ? mode : blendIndex(mode)) {
    case 1: return Math.min(a + b, 1);
    case 2: return a * b;
    case 3: return 1 - (1 - a) * (1 - b);
    case 4: return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
    case 5: return Math.abs(a - b);
    case 6: return Math.max(a, b);
    case 7: return Math.min(a, b);
    default: return b;
  }
}
export function compositeSource() {
  let s = "precision highp float;\nuniform vec2 uRes;\nuniform float uMode[" + N + "];\nuniform float uMix[" + N + "];\nuniform float uKey[" + N + "];\nuniform int uCount;\n";
  for (let i = 0; i < N; i++) s += "uniform sampler2D uL" + i + ";\n";
  s += "vec3 bl(float m, vec3 a, vec3 b){\n" +
    " if (m < 0.5) return b;\n if (m < 1.5) return min(a + b, vec3(1.0));\n if (m < 2.5) return a * b;\n" +
    " if (m < 3.5) return 1.0 - (1.0 - a) * (1.0 - b);\n" +
    " if (m < 4.5) return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));\n" +
    " if (m < 5.5) return abs(a - b);\n if (m < 6.5) return max(a, b);\n return min(a, b);\n}\n" +
    // how much of a layer lands on a pixel: its mix, its alpha and, as far as its key asks, its own light there
    "float weight(float m, float k, vec4 s){ return m * s.a * mix(1.0, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)), k); }\n" +
    "void main(){\n vec2 uv = gl_FragCoord.xy / uRes;\n vec3 c = texture2D(uL0, uv).rgb;\n vec4 s;\n";
  for (let i = 1; i < N; i++) s += " if (uCount > " + i + ") { s = texture2D(uL" + i + ", uv); c = mix(c, bl(uMode[" + i + "], c, s.rgb), weight(uMix[" + i + "], uKey[" + i + "], s)); }\n";
  return s + " gl_FragColor = vec4(c, 1.0);\n}\n";
}
function fixLog(log) {
  return String(log || "shader error").split("\n").filter(Boolean)
    .map((l) => l.replace(/ERROR:\s*\d+:(\d+):/g, (m, n) => `line ${Math.max(1, parseInt(n, 10) - PREAMBLE_LINES)}:`)).join("\n");
}

export function createShaderStack(canvas, baseSource) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false })
    || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
  if (!gl) return { ok: false, error: "WebGL is unavailable in this browser." };
  gl.disable(gl.DITHER);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const inputs = { mouse: [0, 0, 0, 0], audio: [0, 0, 0, 0], knobs: [0.5, 0.5, 0.5], palette: new Float32Array(PALETTE_SIZE * 3), paletteSize: 0 };
  const channel = { tex: texture(), source: null, live: false, size: [1, 1] };
  const programs = new Map();   // glsl -> { prog, error, at }: a layer's program is compiled once, whatever order it moves to
  let base = null, layers = [], frame = 0, composite = null, targets = [], tw = 0, th = 0;
  const pictureTex = [];   // a picture layer has a texture of its own, at the picture's size, apart from the shader targets
  gl.bindTexture(gl.TEXTURE_2D, channel.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  function texture(filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, f], [gl.TEXTURE_MAG_FILTER, f], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }
  function upload(tex, source) {
    const w = source.videoWidth || source.naturalWidth || source.width, h = source.videoHeight || source.naturalHeight || source.height;
    if (!w || !h) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); } catch (e) { console.error("shader stack: a picture could not be read", e); return null; }
    return [w, h];
  }
  function compile(type, src) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return { sh };
    const err = gl.getShaderInfoLog(sh); gl.deleteShader(sh); return { err };
  }
  function link(fragFull) {
    const vs = compile(gl.VERTEX_SHADER, VERT); if (vs.err) return { error: fixLog(vs.err) };
    const fs = compile(gl.FRAGMENT_SHADER, fragFull); if (fs.err) { gl.deleteShader(vs.sh); return { error: fixLog(fs.err) }; }
    const p = gl.createProgram(); gl.attachShader(p, vs.sh); gl.attachShader(p, fs.sh); gl.linkProgram(p);
    gl.deleteShader(vs.sh); gl.deleteShader(fs.sh);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const err = gl.getProgramInfoLog(p); gl.deleteProgram(p); return { error: fixLog(err) }; }
    return { prog: p, at: new Map(), aPos: gl.getAttribLocation(p, "aPos") };
  }
  const where = (P, name) => { if (!P.at.has(name)) P.at.set(name, gl.getUniformLocation(P.prog, name)); return P.at.get(name); };
  function programFor(glsl) {
    if (!programs.has(glsl)) programs.set(glsl, link(wrap(glsl)));
    return programs.get(glsl);
  }
  function setBase(glsl) {
    const P = link(wrap(glsl));
    if (P.error) return { ok: false, error: P.error };
    if (base) gl.deleteProgram(base.prog);
    base = P; frame = 0; return { ok: true };
  }
  function ensureTargets() {
    if (tw === canvas.width && th === canvas.height && targets.length) return;
    for (const t of targets) { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); }
    tw = canvas.width; th = canvas.height; targets = [];
    for (let i = 0; i < N; i++) {
      const tex = texture("nearest"); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      targets.push({ fb, tex });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function quad(P) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(P.aPos);
    gl.vertexAttribPointer(P.aPos, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawShader(P, t, fb) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(P.prog);
    const u = (n) => where(P, n), { mouse: m, audio: a, knobs: k } = inputs;
    gl.uniform3f(u("iResolution"), canvas.width, canvas.height, 1); gl.uniform1f(u("iTime"), t);
    gl.uniform4f(u("iMouse"), m[0], m[1], m[2], m[3]); gl.uniform1i(u("iFrame"), frame);
    gl.uniform4f(u("iAudio"), a[0], a[1], a[2], a[3]);
    gl.uniform1f(u("iKnobA"), k[0]); gl.uniform1f(u("iKnobB"), k[1]); gl.uniform1f(u("iKnobC"), k[2]);
    gl.uniform3fv(u("iPalette"), inputs.palette); gl.uniform1f(u("iPaletteSize"), inputs.paletteSize);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, channel.tex);
    gl.uniform1i(u("iChannel0"), 0); gl.uniform3f(u("iChannelResolution"), channel.size[0], channel.size[1], 1);
    quad(P);
  }
  // Each layer's texture for this frame: a shader draws into its target, a picture is uploaded into it. null: nothing to show.
  function layerTexture(L, i, t) {
    if (L.kind === "shader") { const P = programFor(L.glsl); if (!P.prog) return null; drawShader(P, t, targets[i].fb); return targets[i].tex; }
    const src = typeof L.source === "function" ? L.source() : L.source;
    if (!src) return null;
    const tex = pictureTex[i] || (pictureTex[i] = texture());
    return upload(tex, src) ? tex : null;
  }
  function drawComposite(t) {
    ensureTargets();
    drawShader(base, t, targets[0].fb);
    const used = [targets[0].tex], mode = new Float32Array(N), mix = new Float32Array(N), key = new Float32Array(N);
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i], tex = layerTexture(L, i + 1, t); if (!tex) continue;
      mode[used.length] = blendIndex(L.blend); mix[used.length] = Math.max(0, Math.min(1, +L.mix || 0)); key[used.length] = Math.max(0, Math.min(1, +L.key || 0)); used.push(tex);
    }
    if (!composite) composite = link(compositeSource());
    const P = composite; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(P.prog);
    used.forEach((tex, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(where(P, "uL" + i), i); });
    for (let i = used.length; i < N; i++) gl.uniform1i(where(P, "uL" + i), 0);
    gl.uniform2f(where(P, "uRes"), canvas.width, canvas.height); gl.uniform1i(where(P, "uCount"), used.length);
    gl.uniform1fv(where(P, "uMode"), mode); gl.uniform1fv(where(P, "uMix"), mix); gl.uniform1fv(where(P, "uKey"), key);
    quad(P); gl.activeTexture(gl.TEXTURE0);
    return used.length - 1;
  }
  function draw(t) {
    if (!base) return 0;
    if (channel.source && channel.live) { const s = upload(channel.tex, channel.source); if (s) channel.size = s; }
    let shown = 0;
    if (!layers.length) drawShader(base, t, null); else shown = drawComposite(t);
    frame++; return shown;
  }
  const first = setBase(baseSource);

  return {
    ok: first.ok, error: first.error || null, canvas, gl,
    setSource: (glsl) => setBase(glsl),
    renderFrame(t = 0) { draw(t); return canvas; },
    // The layers above the base, bottom first: { kind: 'shader', glsl } or { kind: 'picture', source }, each with blend and mix.
    // Returns, per layer, null when it is ready or the compile error of its shader.
    setLayers(list = []) {
      layers = list.slice(0, MAX_LAYERS).map((L) => ({ ...L }));
      const keep = new Set(layers.filter((L) => L.kind === "shader").map((L) => L.glsl));
      for (const [g, P] of programs) if (!keep.has(g)) { if (P.prog) gl.deleteProgram(P.prog); programs.delete(g); }
      return layers.map((L) => (L.kind === "shader" ? programFor(L.glsl).error || null : null));
    },
    // The time a frame takes, measured: each frame waits for the card with a one-pixel read, so the number is the whole frame.
    measure(t = 0, frames = 30) {
      const px = new Uint8Array(4); draw(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) { draw(t + i / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return (performance.now() - t0) / frames;
    },
    setMouse(x, y, down, click) { const m = inputs.mouse; m[0] = x; m[1] = y; m[2] = down ? 1 : 0; m[3] = click ? 1 : 0; },
    setAudio(b, m, t, l) { const a = inputs.audio; a[0] = b || 0; a[1] = m || 0; a[2] = t || 0; a[3] = l || 0; },
    setKnobs(a, b, c) { const k = inputs.knobs; k[0] = a; k[1] = b; k[2] = c; },
    setPalette(hexes = []) {
      const list = hexes.filter((h) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, PALETTE_SIZE); inputs.paletteSize = list.length; inputs.palette.fill(0);
      list.forEach((h, i) => { for (let c = 0; c < 3; c++) inputs.palette[i * 3 + c] = parseInt(h.slice(1 + c * 2, 3 + c * 2), 16) / 255; });
      return inputs.paletteSize;
    },
    setPicture(source, { live = false } = {}) {
      channel.source = source || null; channel.live = !!live; if (!channel.source) return false;
      const s = upload(channel.tex, channel.source); if (s) channel.size = s; return !!s;
    },
    destroy() {
      for (const P of programs.values()) if (P.prog) gl.deleteProgram(P.prog);
      if (base) gl.deleteProgram(base.prog); if (composite?.prog) gl.deleteProgram(composite.prog);
      for (const t of targets) { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); }
      for (const t of pictureTex) if (t) gl.deleteTexture(t);
      gl.deleteBuffer(buf); gl.deleteTexture(channel.tex); channel.source = null; programs.clear();
    },
  };
}
