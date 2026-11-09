// web/living-gl.mjs: living type on the GPU. The CPU (in a worker, web/living-worker.mjs) paints each stop and runs
// each move's flow once; per frame the shader only does the sum lib/living/compose.mjs and reveal.mjs do: read the
// carried material through the position map, pick the medium the process field has reached, overprint on the front,
// smear along the motion, or wash the top film off the layer beneath. One full-screen pass, five texture reads.
//   const g = createLivingGL(canvas); g.stop(i, part); g.move(i, part); g.draw({ i, p, t, mode })
import { PATCH_GLSL, SPREAD } from '../lib/living/axes.mjs';
const VERT = `#version 300 es
in vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }`;
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uA, uB, uF; uniform vec2 uSize, uGrid, uCell; uniform float uK, uKeys, uMode, uDark, uSame, uAmp2, uRate2, uLevels, uLevel, uLevelsA, uLevelA, uLevelsB, uLevelB, uT, uAmp, uRate, uP, uSeed; uniform vec3 uPaper;
out vec4 o;
vec4 fld(vec2 g, float k) { g = clamp(g, vec2(0.5), uGrid - 0.5); return texture(uF, vec2(g.x / uGrid.x, (k * uGrid.y + g.y) / (uGrid.y * uKeys))); }
vec2 drift(vec2 p, float amp, float rate) { if (amp <= 0. || rate <= 0.) return vec2(0.); float ph = 6.2831853 * rate * uT; return vec2(amp * sin(ph + p.y * 0.045 + uSeed) * cos(ph * 0.7 + p.x * 0.013), amp * 0.6 * cos(ph * 0.8 + p.x * 0.05 + uSeed)); }
${PATCH_GLSL}
// a side of a move whose cut's rule is moving: its levels are stacked; the level is read at the sampled position, as the
// CPU composes the stop's frame first and then samples it where the flow says
vec3 lv(sampler2D t, float n, float level, vec2 pos) {
  if (n < 1.5) return texture(t, pos / uSize).rgb;
  float k = clamp(floor(level + ${SPREAD.toFixed(2)} * (patchN(pos) - 0.5) + 0.5), 0., n - 1.);
  return texture(t, vec2(pos.x / uSize.x, (k + clamp(pos.y / uSize.y, 0.5 / uSize.y, 1. - 0.5 / uSize.y)) / n)).rgb;
}
vec3 enc(vec3 v) { return mix(v * 12.92, 1.055 * pow(max(v, 0.), vec3(1. / 2.4)) - 0.055, step(0.0031308, v)); }
void main() {
  vec2 px0 = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); vec3 c;
  vec2 d = drift(px0, uAmp, uRate) * (uMode < 0.5 ? 1. : 1. - uP) + (uMode < 0.5 ? vec2(0.) : drift(px0, uAmp2, uRate2) * uP);
  vec2 px = px0 + d, uv = px / uSize;
  if (uMode < 0.5) {
    // a stop whose cut's rule moves: its levels are stacked in uA; each pixel reads the level at its place on the patch field
    float k = uLevels > 1. ? clamp(floor(uLevel + ${SPREAD.toFixed(2)} * (patchN(px0) - 0.5) + 0.5), 0., uLevels - 1.) : 0.;
    c = texture(uA, vec2(uv.x, (k + clamp(uv.y, 0.5 / uSize.y, 1. - 0.5 / uSize.y)) / max(1., uLevels))).rgb;
  } else {
    float k0 = floor(uK), f = uK - k0, k1 = min(k0 + 1., uKeys - 1.); vec2 g = (px + 0.5) / uCell;
    vec4 F0 = fld(g, k0), F1 = fld(g, k1), F = mix(F0, F1, f);
    vec2 X = (F.xy + 0.5) * uCell - 0.5, v = (F1.xy - F0.xy) * uCell;
    if (uMode < 1.5) {
      vec3 a = vec3(0.), b = vec3(0.);
      for (int q = 0; q < 3; q++) { vec2 s = X - v * float(q) * 0.5 + 0.5; a += lv(uA, uLevelsA, uLevelA, s) / 3.; b += lv(uB, uLevelsB, uLevelB, s) / 3.; }
      float e = (F.z - 0.5) / 0.16;
      c = e <= -1. ? a : e >= 1. ? b : (uDark > 0.5 ? max(a, b) : uSame > 0.5 ? min(a, b) : a * b / max(uPaper, vec3(1e-4)));
    } else {
      vec3 top = lv(uA, uLevelsA, uLevelA, X + 0.5), und = lv(uB, uLevelsB, uLevelB, px);
      float film = 1. - 0.07 * clamp(F.z, 0., 1.) * (1. - uP * 0.8), lip = clamp(1. - abs(F.z - 0.55) * 6., 0., 1.) * 0.05 * (1. - uP), al = pow(clamp(F.w * 1.1, 0., 1.), 1.6);
      c = mix(und, top, al) * film + lip;
    }
  }
  o = vec4(enc(clamp(c, 0., 1.)), 1.);
}`;

export function createLivingGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false }); if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(`living-gl: ${gl.getShaderInfoLog(x)}`); return x; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`living-gl: ${gl.getProgramInfoLog(prog)}`);
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n); ['uA', 'uB', 'uF'].forEach((n, i) => gl.uniform1i(U(n), i));
  const tex = (unit, w, h, internal, format, type, data, linear = true) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    const f = linear ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
  };
  const stops = new Map(), moves = new Map();
  const img = (part, w, h) => tex(0, w, h, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, part);
  return {
    gl,
    /** part: { w, h, rgba (sRGB8), breath } */
    stop(i, part) { stops.set(i, { t: img(part.rgba, part.w, part.h * (part.levels ?? 1)), ...part, rgba: null }); },
    /** part: { kind, w, h, a (sRGB8), b (sRGB8), fields (Uint16 half floats, nx x ny*keys RGBA), nx, ny, keys, sx, sy, paper, dark } */
    move(i, part) { moves.set(i, { ...part, ta: img(part.a, part.w, part.h * (part.levelsA ?? 1)), tb: img(part.b, part.w, part.h * (part.levelsB ?? 1)), tf: tex(2, part.nx, part.ny * part.keys, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, part.fields), a: null, b: null, fields: null }); },
    has: (kind, i) => (kind === 'stop' ? stops : moves).has(i),
    /** Forget every stop and move (a new scheme repaints them); textures are freed. */
    reset() { for (const v of stops.values()) gl.deleteTexture(v.t); for (const v of moves.values()) { gl.deleteTexture(v.ta); gl.deleteTexture(v.tb); gl.deleteTexture(v.tf); } stops.clear(); moves.clear(); },
    draw({ i, p = 0, t = 0, mode = 'stop', seed = 1, breath = null, breath2 = null, level = 0, levelA = 0, levelB = 0 }) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U('uSize'), canvas.width, canvas.height); gl.uniform1f(U('uT'), t); gl.uniform1f(U('uSeed'), seed);
      if (mode === 'stop') {
        const s = stops.get(i); if (!s) return false;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.t); gl.uniform1f(U('uMode'), 0); gl.uniform1f(U('uLevels'), s.levels ?? 1); gl.uniform1f(U('uLevel'), level); gl.uniform1f(U('uAmp'), s.breath?.amp ?? 0); gl.uniform1f(U('uRate'), s.breath?.rate ?? 0);
      } else {
        const m = moves.get(i); if (!m) return false;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.ta); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.tb); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, m.tf);
        gl.uniform1f(U('uLevels'), 1); gl.uniform1f(U('uLevelsA'), m.levelsA ?? 1); gl.uniform1f(U('uLevelA'), levelA); gl.uniform1f(U('uLevelsB'), m.levelsB ?? 1); gl.uniform1f(U('uLevelB'), levelB);
        gl.uniform1f(U('uAmp'), breath?.amp ?? 0); gl.uniform1f(U('uRate'), breath?.rate ?? 0); gl.uniform1f(U('uAmp2'), breath2?.amp ?? 0); gl.uniform1f(U('uRate2'), breath2?.rate ?? 0);
        gl.uniform1f(U('uMode'), m.kind === 'reveal' ? 2 : 1); gl.uniform1f(U('uK'), Math.min(1, Math.max(0, p)) * (m.keys - 1)); gl.uniform1f(U('uKeys'), m.keys);
        gl.uniform2f(U('uGrid'), m.nx, m.ny); gl.uniform2f(U('uCell'), m.sx, m.sy); gl.uniform3fv(U('uPaper'), m.paper); gl.uniform1f(U('uDark'), m.dark ? 1 : 0); gl.uniform1f(U('uSame'), m.same ? 1 : 0); gl.uniform1f(U('uP'), p);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3); return true;
    },
  };
}
