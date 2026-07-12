// emphasis-field.js: the emphasized words rendered as 3D-lit letters through the house
// shader tooling, not a flat CSS highlight.
//
// Each word's glyphs are drawn to an offscreen 2D canvas (in the page's own font) and
// uploaded as a texture. The fragment shader treats the glyph coverage as a height field,
// derives a per-pixel surface normal from its gradient, and lights it: a light that orbits
// so every letter catches it in turn, a verified-green diffuse, a white specular glint, an
// edge rim, and a soft glow. Each letter reads as a small dimensional, lit object.
//
// The DOM `.emph-text` stays in place (it holds the layout and is the accessible text). When
// the shader mounts it adds `.emph-lit` to the host so the flat text turns transparent and the
// lit letters show; if WebGL is absent the class is never added and the text shows normally.
//
// mountEmphasis(canvas, { kind, seed, reduced }) -> { destroy() }.
// isEmphasisAvailable() gates the callers.

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

const FRAG = `precision highp float;
uniform vec2 u_res; uniform float u_time; uniform float u_seed; uniform int u_kind;
uniform sampler2D u_tex; uniform vec2 u_texel;

float cover(vec2 uv){ return texture2D(u_tex, clamp(uv, 0.0, 1.0)).a; }

// blurred coverage -> a smooth height field so the glyph edges read as a rounded bevel
float height(vec2 uv){
  float s = cover(uv) * 4.0;
  s += cover(uv + u_texel*vec2( 1.0, 0.0)) + cover(uv + u_texel*vec2(-1.0, 0.0));
  s += cover(uv + u_texel*vec2( 0.0, 1.0)) + cover(uv + u_texel*vec2( 0.0,-1.0));
  s += (cover(uv + u_texel*vec2( 1.0, 1.0)) + cover(uv + u_texel*vec2(-1.0, 1.0))
      + cover(uv + u_texel*vec2( 1.0,-1.0)) + cover(uv + u_texel*vec2(-1.0,-1.0))) * 0.7;
  return s / 10.8;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float cov = cover(uv);

  // 3D extruded side: march down-right (away from the key light) and darken with depth,
  // so each letter reads as a solid object standing off the surface, not flat text.
  vec2 ext = u_texel * vec2(1.35, -1.55);
  float side = 0.0, depth = 0.0;
  for(int k = 1; k <= 7; k++){
    float s = cover(uv + ext * float(k));
    side = max(side, s);
    if(s > 0.5) depth = max(depth, float(k));
  }
  side *= (1.0 - cov);

  // lit-face normal from the height gradient (a rounded bevel on the top surface)
  vec2 e = u_texel * 3.2;
  float hL = height(uv - vec2(e.x, 0.0));
  float hR = height(uv + vec2(e.x, 0.0));
  float hD = height(uv - vec2(0.0, e.y));
  float hU = height(uv + vec2(0.0, e.y));
  vec3 N = normalize(vec3((hL - hR) * 4.4, (hD - hU) * 4.4, 1.0));

  // a key light that orbits, so each letter is lit in turn as it sweeps across the word
  float a = u_time * 0.8 + u_seed;
  vec3 L = normalize(vec3(cos(a) * 0.9, sin(a) * 0.55 + 0.15, 0.66));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 28.0);
  float rim  = pow(1.0 - clamp(N.z, 0.0, 1.0), 2.0);

  vec3 green = vec3(0.62, 0.92, 0.24);
  vec3 face = green * (0.55 + 0.62 * diff)            // lit top, floored so it stays legible
            + vec3(0.90, 1.0, 0.75) * spec * 1.1      // white specular glint
            + green * rim * 0.45;                      // rim light on the beveled edge
  vec3 sideCol = vec3(0.16, 0.28, 0.05) * (1.0 - depth * 0.085);   // extruded side, darker with depth

  vec3 col = face;
  float aa = cov;
  if(cov < 0.5 && side > 0.01){ col = sideCol; aa = side; }   // draw the extruded side where the face isn't

  float glow = height(uv);
  aa = max(aa, smoothstep(0.03, 0.55, glow) * 0.16);
  gl_FragColor = vec4(col, clamp(aa, 0.0, 1.0));
}`;

function mulberry32(a){ return function(){ a|=0; a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

function compile(gl, type, src){
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error("emphasis compile: " + log); }
  return sh;
}

export function isEmphasisAvailable(){
  try { if (typeof document === "undefined") return false; const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch (_) { return false; }
}

const KIND = { mark: 0, pill: 1, tick: 2 };

export function mountEmphasis(canvas, opts){
  const o = opts || {};
  const kind = KIND[o.kind] != null ? KIND[o.kind] : 0;
  const reduced = !!o.reduced;
  const seedN = mulberry32((o.seed != null ? o.seed : 58) >>> 0)() * 6.283;
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true })
    || canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) throw new Error("emphasis needs WebGL");

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("emphasis link: " + gl.getProgramInfoLog(prog));
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { res: U("u_res"), time: U("u_time"), seed: U("u_seed"), kind: U("u_kind"), tex: U("u_tex"), texel: U("u_texel") };

  const host = canvas.parentElement;
  const textEl = host ? host.querySelector(".emph-text") : null;
  const word = textEl ? textEl.textContent : "";

  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(u.seed, seedN);
  gl.uniform1i(u.kind, kind);
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(u.tex, 0);

  // The lit letters are the visible word now: turn the flat DOM text transparent.
  if (host) host.classList.add("emph-lit");

  // Draw the word into an offscreen 2D canvas at the WebGL buffer's exact pixel size, in the
  // page's own font, and upload it as the coverage texture. Rebuilt when the size changes or
  // once the web font has finished loading (so the glyph shapes are correct, not a fallback).
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");
  let texW = 0, texH = 0;
  const buildTexture = () => {
    if (disposed || !octx || canvas.width < 2 || canvas.height < 2) return;
    off.width = canvas.width; off.height = canvas.height;
    octx.clearRect(0, 0, off.width, off.height);
    if (textEl && word) {
      const cs = getComputedStyle(textEl);
      const dpr = off.width / (canvas.getBoundingClientRect().width || off.width);
      const fs = parseFloat(cs.fontSize) * dpr;
      octx.font = (cs.fontStyle || "normal") + " " + (cs.fontWeight || "600") + " " + fs + "px " + (cs.fontFamily || "sans-serif");
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#fff";
      try { if ("letterSpacing" in octx) octx.letterSpacing = ((parseFloat(cs.letterSpacing) || 0) * dpr) + "px"; } catch (_) {}
      octx.fillText(word, off.width / 2, off.height / 2 + fs * 0.06);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    texW = off.width; texH = off.height;
  };

  let raf = 0, t0 = 0, running = false, disposed = false;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round((r.width || 1) * dpr));
    const h = Math.max(1, Math.round((r.height || 1) * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; buildTexture(); }
  };
  const draw = (tms) => {
    size();
    if (texW < 2) buildTexture();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.tex, 0);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.texel, 1.0 / Math.max(1, texW), 1.0 / Math.max(1, texH));
    gl.uniform1f(u.time, reduced ? 0 : tms * 0.001);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (tms) => { if (!running || disposed) return; if (!t0) t0 = tms; draw(tms - t0); raf = requestAnimationFrame(loop); };
  const start = () => { if (running || disposed || reduced) return; running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => { if (document.hidden) stop(); else start(); };

  let io = null;
  if (typeof IntersectionObserver !== "undefined") { io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0.01 }); io.observe(canvas); }
  document.addEventListener("visibilitychange", onVis);
  // Redraw once the web font is ready so the glyphs are the real face, not a fallback.
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!disposed) { buildTexture(); draw(0); } }).catch(() => {});
  }

  draw(0);
  if (!reduced) start();

  return { destroy(){ disposed = true; stop(); if (host) host.classList.remove("emph-lit"); document.removeEventListener("visibilitychange", onVis); if (io) io.disconnect(); const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } };
}
