/* shader-runner.js — a live, user-editable GLSL fragment-shader sandbox.

   A visitor writes a fragment shader; it compiles and renders live to a canvas,
   which becomes a source for the Retro Engine (shader -> pixelate -> palette ->
   CRT). Shadertoy-style contract: define

     void mainImage(out vec4 fragColor, in vec2 fragCoord) { ... }

   with iResolution (vec3), iTime (float), iMouse (vec4), iFrame (int) available,
   and what other tools hand in: iPalette[5] (vec3 colours, iPaletteSize of them
   set) and iChannel0 (a picture, with iChannelResolution; black until one is set).
   Compile errors are returned with corrected line numbers, never thrown, so a
   bad shader shows a message instead of breaking the page. WebGL1, zero deps. */

const VERT = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";

// Lines the wrapper injects before the user's code, so compile-error line
// numbers can be mapped back to what the user actually typed.
export const PREAMBLE_LINES = 13;
export const PALETTE_SIZE = 5;

// The whole fragment shader a visitor's source becomes: the inputs, the source, and a main() that calls mainImage.
export function wrap(frag) {
  return (
    "precision highp float;\n" +
    "uniform vec3 iResolution;\n" +
    "uniform float iTime;\n" +
    "uniform vec4 iMouse;\n" +
    "uniform int iFrame;\n" +
    "uniform vec4 iAudio;\n" +          // x bass, y mid, z treble, w level
    "uniform float iKnobA;\n" +
    "uniform float iKnobB;\n" +
    "uniform float iKnobC;\n" +
    "uniform vec3 iPalette[5];\n" +     // colours handed in by another tool, the lead first
    "uniform float iPaletteSize;\n" +   // how many of the five are set (0 when none was handed in)
    "uniform sampler2D iChannel0;\n" +  // a picture handed in by another tool
    "uniform vec3 iChannelResolution;\n" +
    frag +
    "\nvoid main(){vec4 c=vec4(0.0);mainImage(c, gl_FragCoord.xy);gl_FragColor=vec4(clamp(c.rgb,0.0,1.0),1.0);}\n"
  );
}

// A quasicrystal interference field in the outrun palette — on-aesthetic default.
export const DEFAULT_FRAG = `// edit me — a live fragment shader.
void mainImage(out vec4 O, in vec2 U){
  vec2 p = (U - 0.5*iResolution.xy) / iResolution.y;
  float a = 0.0;
  for (int i = 0; i < 7; i++){
    float k = float(i) * 0.8975979;      // golden-ish angle
    a += sin(cos(k)*p.x*9.0 + sin(k)*p.y*9.0 + iTime*0.5);
  }
  float v = 0.5 + 0.5*sin(a*1.5);
  vec3 col = mix(vec3(0.04,0.02,0.09), vec3(1.0,0.30,0.63), v);
  col += vec3(0.31,0.86,0.94) * pow(v, 4.0) * 0.7;   // cyan crest bloom
  O = vec4(col, 1.0);
}`;

function fixLog(log) {
  if (!log) return "shader error";
  // ANGLE/GLSL logs look like "ERROR: 0:25: '...'": 25 is a line of the wrapped source,
  // so the preamble's lines come off to give the line the visitor typed.
  return log
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/ERROR:\s*\d+:(\d+):/g, (m, n) => {
      const ln = parseInt(n, 10);
      const adj = Math.max(1, ln - PREAMBLE_LINES);
      return `line ${adj}:`;
    }))
    .join("\n");
}

export function createShaderRunner(canvas, fragSource = DEFAULT_FRAG) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false })
    || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
  if (!gl) return { ok: false, error: "WebGL is unavailable in this browser." };

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  let program = null, raf = 0, startMs = 0, frame = 0;
  const mouse = [0, 0, 0, 0];
  const audio = [0, 0, 0, 0];       // bass, mid, treble, level
  const knobs = [0.5, 0.5, 0.5];
  const palette = new Float32Array(PALETTE_SIZE * 3); let paletteSize = 0;
  // iChannel0: one texture, black and 1 by 1 until a picture is set; a live source (a canvas) is read again each frame
  const tex = gl.createTexture(); let texSource = null, texLive = false, texSize = [1, 1];
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  function upload() {
    const w = texSource.videoWidth || texSource.naturalWidth || texSource.width, h = texSource.videoHeight || texSource.naturalHeight || texSource.height;
    if (!w || !h) return false;
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texSource); } catch (e) { console.error("shader runner: the picture could not be read", e); texSource = null; return false; }
    texSize = [w, h]; return true;
  }

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      return { err: log };
    }
    return { sh };
  }

  function build(frag) {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    if (vs.err) return { ok: false, error: fixLog(vs.err) };
    const fs = compile(gl.FRAGMENT_SHADER, wrap(frag));
    if (fs.err) { gl.deleteShader(vs.sh); return { ok: false, error: fixLog(fs.err) }; }
    const p = gl.createProgram();
    gl.attachShader(p, vs.sh); gl.attachShader(p, fs.sh); gl.linkProgram(p);
    gl.deleteShader(vs.sh); gl.deleteShader(fs.sh);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(p); gl.deleteProgram(p);
      return { ok: false, error: fixLog(err) };
    }
    if (program) gl.deleteProgram(program);
    program = p; frame = 0;
    return { ok: true };
  }

  function draw(tSeconds) {
    if (!program) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3f(gl.getUniformLocation(program, "iResolution"), canvas.width, canvas.height, 1);
    gl.uniform1f(gl.getUniformLocation(program, "iTime"), tSeconds);
    gl.uniform4f(gl.getUniformLocation(program, "iMouse"), mouse[0], mouse[1], mouse[2], mouse[3]);
    gl.uniform1i(gl.getUniformLocation(program, "iFrame"), frame);
    gl.uniform4f(gl.getUniformLocation(program, "iAudio"), audio[0], audio[1], audio[2], audio[3]);
    gl.uniform1f(gl.getUniformLocation(program, "iKnobA"), knobs[0]);
    gl.uniform1f(gl.getUniformLocation(program, "iKnobB"), knobs[1]);
    gl.uniform1f(gl.getUniformLocation(program, "iKnobC"), knobs[2]);
    gl.uniform3fv(gl.getUniformLocation(program, "iPalette"), palette);
    gl.uniform1f(gl.getUniformLocation(program, "iPaletteSize"), paletteSize);
    if (texSource && texLive) upload();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(program, "iChannel0"), 0);
    gl.uniform3f(gl.getUniformLocation(program, "iChannelResolution"), texSize[0], texSize[1], 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame++;
  }

  const first = build(fragSource);

  return {
    ok: first.ok,
    error: first.error || null,
    canvas,
    gl,
    // Recompile with new source; returns { ok, error } so a UI can show the log.
    setSource(frag) { return build(frag); },
    // Render one frame at time t (seconds). Use for still capture / feeding retro.
    renderFrame(tSeconds = 0) { draw(tSeconds); return canvas; },
    setMouse(x, y, down, click) { mouse[0] = x; mouse[1] = y; mouse[2] = down ? 1 : 0; mouse[3] = click ? 1 : 0; },
    // Live audio into the shader: [bass, mid, treble, level], each 0..1.
    setAudio(b, m, t, lvl) { audio[0] = b || 0; audio[1] = m || 0; audio[2] = t || 0; audio[3] = lvl || 0; },
    // Three user knobs, 0..1.
    setKnobs(a, b, c) { knobs[0] = a; knobs[1] = b; knobs[2] = c; },
    // Colours from another tool: up to five "#rrggbb", the lead first. An empty list clears them.
    setPalette(hexes = []) {
      const list = hexes.filter((h) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, PALETTE_SIZE); paletteSize = list.length; palette.fill(0);
      list.forEach((h, i) => { for (let c = 0; c < 3; c++) palette[i * 3 + c] = parseInt(h.slice(1 + c * 2, 3 + c * 2), 16) / 255; });
      return paletteSize;
    },
    // A picture from another tool (a canvas, an image or a bitmap) for iChannel0. live: read it again each frame.
    setPicture(source, { live = false } = {}) { texSource = source || null; texLive = !!live; return texSource ? upload() : false; },
    // Animate via rAF. onFrame(t) fires after each draw (e.g. to re-run the retro pass).
    start(onFrame) {
      const loop = (now) => {
        if (!startMs) startMs = now;
        const t = (now - startMs) / 1000;
        draw(t);
        if (onFrame) onFrame(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    destroy() { if (raf) cancelAnimationFrame(raf); if (program) gl.deleteProgram(program); if (buf) gl.deleteBuffer(buf); gl.deleteTexture(tex); texSource = null; },
  };
}
