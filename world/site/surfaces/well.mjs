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
// carried it. The picture is one fragment shader: every element draws its marks from its drive numbers, and the
// elements mix in OKLab by how much of each is in the water at that point. Coordinates are fractions of the well,
// x right, y down. Reduced motion: no drift; each act settles at once into a still.
import { Fluid, STEP } from '../../studio/lib/fluid.mjs';

const NX = 96, NY = 72, SLOTS = 4;
const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uDye, uDisp;
uniform vec3 uGround, uOk[4];
uniform vec4 uA[4], uB[4], uC[4];   // A: wavelength, cos, sin, peak. B: gain, softness, threshold, base frequency. C: chroma, rows, slot seed, on
uniform float uAspect;
float h(vec2 q){ q = fract(q * vec2(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.x); }
float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 q, float gain){ float a = 1., s = 0., t = 0.; for (int k = 0; k < 5; k++){ s += a * vn(q); t += a; q = q * 2.03 + 17.; a *= gain; } return s / t; }
vec3 ok2rgb(vec3 c){ float l = c.x + .3963377774 * c.y + .2158037573 * c.z, m = c.x - .1055613458 * c.y - .0638541728 * c.z, s = c.x - .0894841775 * c.y - 1.291485548 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 r = vec3(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s);
  r = clamp(r, 0., 1.); return mix(12.92 * r, 1.055 * pow(r, vec3(1. / 2.4)) - .055, step(.0031308, r)); }
void main(){
  vec2 uv = vec2(v.x, 1. - v.y);
  vec4 dye = texture2D(uDye, uv);
  vec2 q = uv - (texture2D(uDisp, uv).xy - .5) * .5; q.x *= uAspect;
  vec3 acc = vec3(0.); float tot = 0.;
  for (int i = 0; i < 4; i++){
    if (uC[i].w < .5) continue;
    float c = i == 0 ? dye.r : i == 1 ? dye.g : i == 2 ? dye.b : dye.a;
    float n = fbm(q * uB[i].w + uC[i].z, uB[i].x);
    float w = sin(6.2831853 * dot(q, uA[i].yz) / uA[i].x);
    float f = n + .22 * uA[i].w * w + (uC[i].y > 1.5 ? .05 * sin(6.2831853 * uC[i].y * uv.y) : 0.);
    float mark = smoothstep(uB[i].z - uB[i].y, uB[i].z + uB[i].y, f);
    vec3 ok = uOk[i]; ok.yz *= uC[i].x; ok.x += (mark - .5) * .16;
    float a = c * mix(.3, 1., mark);
    acc += a * ok; tot += a;
  }
  vec3 g = uGround;
  vec3 col = tot > .0001 ? mix(g, acc / tot, 1. - exp(-tot * 2.6)) : g;
  gl_FragColor = vec4(ok2rgb(col), 1.);
}`;

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
      // the wave runs across its crests: an orientation of 90 degrees gives horizontal bands, as in the measured spectra
      A.set([clamp(d.wavelength, 0.004, 0.2) * 3, Math.cos(th), Math.sin(th), d.peak], i * 4);
      B.set([clamp(Math.pow(2, -(d.beta - 1)), 0.2, 0.75), clamp(d.softness * 0.006, 0.004, 0.14), 0.74 - 0.5 * clamp(d.coverage, 0, 1), 3 + 70 * d.density], i * 4);
      C.set([d.saturation, d.rows, 11.3 * (i + 1), 1], i * 4);
      O.set(p.ok, i * 3);
      sp += p.weight * d.speed; cu += p.weight * d.curl; co += p.weight * d.coherence; w += p.weight;
    });
    flow = w ? { speed: sp / w, curl: cu / w, coherence: co / w } : flow;
    gl.uniform4fv(U('uA'), A); gl.uniform4fv(U('uB'), B); gl.uniform4fv(U('uC'), C); gl.uniform3fv(U('uOk'), O);
    gl.uniform3fv(U('uGround'), new Float32Array(ground));
  }
  // The elements' own measured motion moves the water a little: mean speed sets the drift, coherence how much of it
  // runs one way, curl how much turns. Slow by rule; the visitor's hand is always the stronger force.
  function ambient(dt) {
    clock += dt;
    const s = 26 * flow.speed, c = clamp(flow.coherence * 1.6, 0, 1), a = clock * 0.11;
    if (s > 0.01) {
      fluid.impulse(NX * (0.5 + 0.3 * Math.cos(a)), NY * (0.5 + 0.3 * Math.sin(a * 1.3)), s * c * dt * 9, s * c * 0.2 * Math.sin(a) * dt * 9, 16);
      const k = 60 * flow.curl * (1 - c * 0.5) * dt * 9, x = 0.5 + 0.22 * Math.sin(a * 0.7), y = 0.5 + 0.22 * Math.cos(a * 0.9);
      fluid.impulse(NX * x, NY * (y - 0.12), k, 0, 9); fluid.impulse(NX * x, NY * (y + 0.12), -k, 0, 9);
    }
    if (tiltX || tiltY) for (let i = 0; i < n; i++) { fluid.u[i] += tiltX * dt * 30; fluid.v[i] += tiltY * dt * 30; }
  }
  function step(dt, drift = true) {
    if (drift) ambient(dt);
    fluid.step(dt);
    for (const F of [...dye.slice(0, Math.max(1, parts.length)), dx, dy]) { fluid._advect(F, fluid.t0, dt); F.set(fluid.t0); }
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
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { size(); draw(); }) : null;
  ro?.observe(canvas);
  const onVis = () => { if (!document.hidden && !reduced && performance.now() < idleAt && !raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVis);
  size();

  const api = {
    reduced, grid: [NX, NY],
    // parts: up to four. reseed false keeps the water as it is and only changes how the elements are drawn.
    set(next, { reseed = true } = {}) { parts = next.slice(0, SLOTS); uniforms(); if (reseed) seed(); wake(); if (reduced) draw(); return api; },
    pour(slot, x, y, amount = 0.5) { if (slot < parts.length) splat(dye[slot], x, y, 0.09, amount); wake(); return api; },
    stir(x, y, vx, vy) { fluid.impulse(x * NX, y * NY, vx * NX, vy * NY, 7); wake(); return api; },
    tilt(tx, ty) { tiltX = clamp(tx, -1, 1); tiltY = clamp(ty, -1, 1); wake(); return api; },
    reset() { seed(); wake(); if (reduced) draw(); return api; },
    // for checks and for the take-away: the picture as it stands, drawn now
    still() { draw(); return canvas; },
    read(w = 48, h = 36) { draw(); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; },
    energy: () => fluid.energy(),
    amounts: () => dye.map((F) => { let s = 0; for (let i = 0; i < n; i++) s += F[i]; return s / n; }),
    destroy() { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  return api;
}
