// well.mjs: the bench's well. A small body of water that carries up to four elements, each drawn from its own
// measured numbers, and that answers the visitor: drag stirs it, a press pours, the arrow keys tilt it.
//
//   const well = createWell(canvas, { reduced });
//   well.set([{ ok: [L, a, b], weight, drive: { wavelength, orientation, peak, beta, softness, coverage,
//                                               density, saturation, rows, speed, curl, coherence } }]);
//   well.pour(slot, x, y); well.stir(x, y, vx, vy); well.tilt(dx, dy); well.reset(); well.destroy();
//
// The water is the studio's own solver (world/studio/lib/fluid.mjs, stable fluids on a fixed clock). It moves four
// dye fields, one per element, and a displacement field that bends each element's pattern where the water has
// carried it. The picture is one fragment shader: every element is a pigment whose grain comes from its drive
// numbers, the pigment diffuses, and where pigments meet they mix subtractively (the geometric mean of their
// reflectances in linear light, weighted by how much of each is there). Coordinates are fractions of the well,
// x right, y down. Reduced motion: no drift; each act settles at once into a still.
import { Fluid, STEP } from '../../studio/lib/fluid.mjs';

const NX = 96, NY = 72, SLOTS = 4, DIFFUSE = 0.03;
const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uDye, uDisp;
uniform vec3 uGround, uLin[4];      // linear-light colours: the water, and each element's pigment
uniform vec4 uA[4], uB[4], uC[4];   // A: feature frequency, cos, sin, stretch. B: octave gain, gradient width, coverage, vein strength. C: rows, slot seed, on, unused
uniform float uAspect;
float h(vec2 q){ q = fract(q * vec2(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.x); }
float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 q, float gain){ float a = 1., s = 0., t = 0.; for (int k = 0; k < 5; k++){ s += a * vn(q); t += a; q = q * 2.03 + 17.; a *= gain; } return s / t; }
void main(){
  vec2 uv = vec2(v.x, 1. - v.y);
  vec4 dye = texture2D(uDye, uv);
  vec2 q = uv - (texture2D(uDisp, uv).xy - .5) * .6; q.x *= uAspect;
  vec3 logmix = vec3(0.); float tot = 0.;
  for (int i = 0; i < 4; i++){
    if (uC[i].z < .5) continue;
    float c = i == 0 ? dye.r : i == 1 ? dye.g : i == 2 ? dye.b : dye.a;
    // the element's own grain: turned to its measured wave angle, drawn out along it by the wave's strength
    vec2 p = vec2(dot(q, uA[i].yz), dot(q, vec2(-uA[i].z, uA[i].y))); p.y /= uA[i].w; p = p * uA[i].x + uC[i].y;
    vec2 warp = vec2(fbm(p + 3.1, .5), fbm(p + 7.7, .5)) - .5;          // marbling: the grain is folded through itself
    float n = fbm(p + 1.6 * warp, uB[i].x);
    float rows = uC[i].x > 1.5 ? .09 * sin(6.2831853 * uC[i].x * uv.y) : 0.;
    float body = smoothstep(.5 - uB[i].y, .5 + uB[i].y, n + rows + (uB[i].z - .45) * .5);   // thick and thin pigment; the gradient is the edge softness
    float vein = 1. - smoothstep(0., .07, abs(fract(n * 6.) - .5));     // fine lines where the pigment parts
    float d = c * (.25 + 1.25 * uB[i].z) * (.3 + .9 * body) * (1. - uB[i].w * vein);
    logmix += d * log(max(uLin[i], vec3(.004))); tot += d;
  }
  // Where pigments meet they mix subtractively: the geometric mean of their reflectances in linear light, by amount.
  vec3 lin = uGround;
  if (tot > .0002) lin = mix(uGround, exp(logmix / tot), 1. - exp(-tot * 2.4));
  lin = clamp(lin, 0., 1.);
  gl_FragColor = vec4(mix(12.92 * lin, 1.055 * pow(lin, vec3(1. / 2.4)) - .055, step(.0031308, lin)), 1.);
}`;

// OKLab to linear sRGB, with the chroma scaled first: how the saturation drive reaches the pigment.
function okToLinear([L, A, B], chroma = 1) {
  A *= chroma; B *= chroma;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => Math.min(1, Math.max(0, x)));
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
// Where each slot starts: one element fills the well; more share it as soft-edged bodies that meet in the middle.
const HOMES = { 1: [[0.5, 0.5, 0.62]], 2: [[0.3, 0.5, 0.42], [0.7, 0.5, 0.42]], 3: [[0.28, 0.36, 0.36], [0.72, 0.36, 0.36], [0.5, 0.72, 0.36]],
  4: [[0.28, 0.3, 0.32], [0.72, 0.3, 0.32], [0.28, 0.72, 0.32], [0.72, 0.72, 0.32]] };

export function createWell(canvas, { reduced = false, ground = [0.2, -0.01, -0.03] } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (src, type) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('well shader: ' + gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(VERT, gl.VERTEX_SHADER)); gl.attachShader(prog, sh(FRAG, gl.FRAGMENT_SHADER));
  gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('well link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
    return t; };
  const tDye = tex(0), tDisp = tex(1);
  gl.uniform1i(U('uDye'), 0); gl.uniform1i(U('uDisp'), 1);

  const n = NX * NY, fluid = new Fluid(NX, NY, { seed: 7, iters: 16, dissipation: 1 });
  const dye = Array.from({ length: SLOTS }, () => new Float32Array(n)), dx = new Float32Array(n), dy = new Float32Array(n);
  const bDye = new Uint8Array(n * 4), bDisp = new Uint8Array(n * 4);
  let parts = [], raf = 0, last = 0, dead = false, clock = 0, tiltX = 0, tiltY = 0, idleAt = 0, flow = { speed: 0.3, curl: 0.3, coherence: 0.4 };

  function splat(F, x, y, r, amount) {
    const cx = x * NX, cy = y * NY, rr = r * NX;
    for (let j = Math.max(0, Math.floor(cy - rr * 2)); j < Math.min(NY, Math.ceil(cy + rr * 2)); j++)
      for (let i = Math.max(0, Math.floor(cx - rr * 2)); i < Math.min(NX, Math.ceil(cx + rr * 2)); i++) {
        const k = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (rr * rr));
        F[j * NX + i] = Math.min(1.4, F[j * NX + i] + amount * k);
      }
  }
  function seed() {
    for (const F of dye) F.fill(0); dx.fill(0); dy.fill(0); fluid.u.fill(0); fluid.v.fill(0); clock = 0; tiltX = tiltY = 0;
    const homes = HOMES[Math.max(1, Math.min(SLOTS, parts.length))] || [];
    const sum = parts.reduce((s, p) => s + p.weight, 0) || 1;
    parts.forEach((p, i) => { const [x, y, r] = homes[i]; splat(dye[i], x, y, r * (0.6 + 0.8 * p.weight * parts.length / sum) , 0.95); });
  }
  function uniforms() {
    const A = new Float32Array(16), B = new Float32Array(16), C = new Float32Array(16), O = new Float32Array(12);
    let sp = 0, cu = 0, co = 0, w = 0;
    parts.slice(0, SLOTS).forEach((p, i) => {
      const d = p.drive, th = (d.orientation ?? 90) * Math.PI / 180;
      // dominant wavelength sets the feature size; the angle turns the grain; wave strength draws it out into bands
      A.set([clamp(0.085 / clamp(d.wavelength, 0.003, 0.3), 0.9, 22), Math.cos(th), Math.sin(th), 1 + 5 * clamp(d.peak, 0, 1.2)], i * 4);
      // spectral slope sets the roughness (a steeper slope keeps less fine detail); edge softness is the width of every gradient
      B.set([clamp(Math.pow(2, -(d.beta - 1.1)), 0.18, 0.8), clamp(d.softness * 0.035, 0.03, 0.5), clamp(d.coverage, 0, 1), clamp(d.density * 8, 0, 0.95)], i * 4);
      C.set([d.rows, 11.3 * (i + 1), 1, 0], i * 4);
      O.set(okToLinear(p.ok, d.saturation), i * 3);
      sp += p.weight * d.speed; cu += p.weight * d.curl; co += p.weight * d.coherence; w += p.weight;
    });
    flow = w ? { speed: sp / w, curl: cu / w, coherence: co / w } : flow;
    gl.uniform4fv(U('uA'), A); gl.uniform4fv(U('uB'), B); gl.uniform4fv(U('uC'), C); gl.uniform3fv(U('uLin'), O);
    gl.uniform3fv(U('uGround'), new Float32Array(okToLinear(ground)));
  }
  // The elements' own measured motion moves the water a little: mean speed sets the drift, coherence how much of it
  // runs one way, curl how much turns. Slow by rule; the visitor's hand is always the stronger force.
  function ambient(dt) {
    clock += dt;
    const s = 34 * flow.speed, c = clamp((flow.coherence - 0.25) * 3.4, 0, 1), a = clock * 0.11;
    if (s > 0.01) {
      fluid.impulse(NX * (0.5 + 0.3 * Math.cos(a)), NY * (0.5 + 0.3 * Math.sin(a * 1.3)), s * c * dt * 9, s * c * 0.2 * Math.sin(a) * dt * 9, 16);
      const k = 110 * flow.curl * (1 - c * 0.5) * dt * 9, x = 0.5 + 0.22 * Math.sin(a * 0.7), y = 0.5 + 0.22 * Math.cos(a * 0.9);
      fluid.impulse(NX * x, NY * (y - 0.12), k, 0, 9); fluid.impulse(NX * x, NY * (y + 0.12), -k, 0, 9);
    }
    if (tiltX || tiltY) for (let i = 0; i < n; i++) { fluid.u[i] += tiltX * dt * 30; fluid.v[i] += tiltY * dt * 30; }
  }
  function step(dt, drift = true) {
    if (drift) ambient(dt);
    fluid.step(dt);
    for (const F of [...dye.slice(0, Math.max(1, parts.length)), dx, dy]) { fluid._advect(F, fluid.t0, dt); F.set(fluid.t0); }
    // pigment also spreads on its own, slowly: where two bodies touch, a mixing zone grows between them
    for (const F of dye.slice(0, Math.max(1, parts.length))) { const T = fluid.t0; T.set(F);
      for (let y = 1; y < NY - 1; y++) for (let x = 1, i = y * NX + 1; x < NX - 1; x++, i++) F[i] = T[i] + DIFFUSE * (T[i - 1] + T[i + 1] + T[i - NX] + T[i + NX] - 4 * T[i]); }
    for (let i = 0; i < n; i++) {
      fluid.u[i] *= 0.985; fluid.v[i] *= 0.985;                        // the water comes to rest
      dx[i] = (dx[i] + fluid.u[i] * dt / NX) * 0.997; dy[i] = (dy[i] + fluid.v[i] * dt / NY) * 0.997;   // and the pattern eases back
    }
  }
  function draw() {
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 4; c++) bDye[i * 4 + c] = clamp(dye[c][i], 0, 1) * 255;
      bDisp[i * 4] = clamp(dx[i] + 0.5, 0, 1) * 255; bDisp[i * 4 + 1] = clamp(dy[i] + 0.5, 0, 1) * 255; bDisp[i * 4 + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tDye); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, bDye);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tDisp); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, bDisp);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(U('uAspect'), canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function size() {
    const r = Math.min(devicePixelRatio || 1, 2), w = Math.max(2, Math.round(canvas.clientWidth * r)), h = Math.max(2, Math.round(canvas.clientHeight * r));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function frame(now) {
    raf = 0; if (dead) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (dt > 0) step(STEP); draw();
    if (now > idleAt || document.hidden) { last = 0; return; }    // the water has had its time: hold the still
    raf = requestAnimationFrame(frame);
  }
  // an act wakes the water for a while; under reduced motion it settles at once and holds a still
  function wake(ms = 45000) {
    if (dead) return;
    if (reduced) { for (let i = 0; i < 24; i++) step(STEP, false); draw(); return; }
    idleAt = performance.now() + ms; if (!raf) raf = requestAnimationFrame(frame);
  }
  // Reduced motion never sees the drift, so a fresh well is carried a fixed way along its own measured flow first:
  // the still then shows the elements' speed, turning and direction, the same every time.
  function settle() { if (reduced) for (let i = 0; i < 150; i++) step(STEP, true); }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { size(); draw(); }) : null;
  ro?.observe(canvas);
  const onVis = () => { if (!document.hidden && !reduced && performance.now() < idleAt && !raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVis);
  size();

  const api = {
    reduced, grid: [NX, NY],
    // parts: up to four. reseed false keeps the water as it is and only changes how the elements are drawn.
    // Under reduced motion the flow drives can only show in the still, so a change to one of them starts the still again.
    set(next, { reseed = true } = {}) { const was = JSON.stringify(flow); parts = next.slice(0, SLOTS); uniforms();
      if (reseed || (reduced && was !== JSON.stringify(flow))) { seed(); settle(); } if (reduced) draw(); else wake(); return api; },
    pour(slot, x, y, amount = 0.5) { if (slot < parts.length) splat(dye[slot], x, y, 0.09, amount); wake(); return api; },
    stir(x, y, vx, vy) { fluid.impulse(x * NX, y * NY, vx * NX, vy * NY, 7); wake(); return api; },
    tilt(tx, ty) { tiltX = clamp(tx, -1, 1); tiltY = clamp(ty, -1, 1); wake(); return api; },
    reset() { seed(); settle(); if (reduced) draw(); else wake(); return api; },
    // for checks and for the take-away: the picture as it stands, drawn now
    still() { draw(); return canvas; },
    read(w = 48, h = 36) { draw(); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; },
    energy: () => fluid.energy(),
    amounts: () => dye.map((F) => { let s = 0; for (let i = 0; i < n; i++) s += F[i]; return s / n; }),
    destroy() { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  return api;
}
