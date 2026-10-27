// media/core.js: shared WebGL2 runner with a Canvas 2D fallback. No dependencies.
// A medium is { id, name, params:{key:[default,min,max]}, glsl, canvas(ctx,src,p,t,H), passes?(p) }.
// glsl defines  vec4 fx(vec2 uv)  and returns a PREMULTIPLIED colour. T(uv) samples the input (straight alpha).
export const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

const PRE = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_time, u_seed, u_pass;
vec4 T(vec2 p){ vec4 c=texture(u_tex,clamp(p,0.,1.)); return c.a>0.002?vec4(c.rgb/c.a,c.a):vec4(0.); }
vec4 P(vec2 uv, vec3 col){ float a=T(uv).a; return vec4(col*a,a); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash1(float n){ return fract(sin(n*91.345+u_seed)*47453.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
float luma(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
vec2 AS(){ return vec2(u_res.x/u_res.y,1.); }
vec2 px(){ return 1./u_res; }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
vec3 blur3(vec2 uv, float r){ vec3 s=vec3(0.); vec2 e=px()*r; for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) s+=T(uv+vec2(float(i),float(j))*e).rgb; return s/9.; }
float edge(vec2 uv, float r){ vec2 e=px()*r; float a=luma(T(uv+vec2(-e.x,-e.y)).rgb),b=luma(T(uv+vec2(0,-e.y)).rgb),c=luma(T(uv+vec2(e.x,-e.y)).rgb),d=luma(T(uv+vec2(-e.x,0)).rgb),f=luma(T(uv+vec2(e.x,0)).rgb),g=luma(T(uv+vec2(-e.x,e.y)).rgb),h=luma(T(uv+vec2(0,e.y)).rgb),i=luma(T(uv+vec2(e.x,e.y)).rgb); float gx=-a-2.*d-g+c+2.*f+i, gy=-a-2.*b-c+g+2.*h+i; return length(vec2(gx,gy)); }
`;
const POST = `\nvoid main(){ o=fx(v); }`;
const VS = `#version 300 es\nin vec2 p; out vec2 v; void main(){ v=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;

export const defaults = m => Object.fromEntries(Object.entries(m.params || {}).map(([k, a]) => [k, a[0]]));

class GLRunner {
  constructor() {
    this.cv = mk(2, 2);
    const gl = this.cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl; this.prog = new Map(); this.w = 0; this.h = 0;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.src = gl.createTexture(); this.ping = [0, 1].map(() => ({ t: gl.createTexture(), f: gl.createFramebuffer() }));
  }
  program(m) {
    if (this.prog.has(m.id)) return this.prog.get(m.id);
    const gl = this.gl, uni = Object.keys(m.params || {}).map(k => `uniform float u_${k};`).join('\n');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(m.id + ': ' + gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, PRE + uni + '\n' + m.glsl + POST));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(m.id + ': ' + gl.getProgramInfoLog(pr));
    const loc = {}; for (const n of ['u_tex', 'u_res', 'u_time', 'u_seed', 'u_pass', ...Object.keys(m.params || {}).map(k => 'u_' + k)]) loc[n] = gl.getUniformLocation(pr, n);
    const e = { pr, loc }; this.prog.set(m.id, e); return e;
  }
  size(w, h) {
    if (this.w === w && this.h === h) return; const gl = this.gl; this.w = w; this.h = h; this.cv.width = w; this.cv.height = h;
    for (const p of this.ping) {
      gl.bindTexture(gl.TEXTURE_2D, p.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.filt();
      gl.bindFramebuffer(gl.FRAMEBUFFER, p.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.t, 0);
    }
  }
  filt() { const gl = this.gl; for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b); }
  run(src, chain, w, h, t, seed) {
    const gl = this.gl; this.size(w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); this.filt();
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const jobs = []; for (const [m, p] of chain) { const n = m.passes ? m.passes(p) : 1; for (let i = 0; i < n; i++) jobs.push([m, p, i]); }
    let cur = this.src, k = 0; gl.viewport(0, 0, w, h);
    jobs.forEach(([m, p, i], j) => {
      const last = j === jobs.length - 1, e = this.program(m); gl.useProgram(e.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, last ? null : this.ping[k].f);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur); gl.uniform1i(e.loc.u_tex, 0);
      gl.uniform2f(e.loc.u_res, w, h); gl.uniform1f(e.loc.u_time, t); gl.uniform1f(e.loc.u_seed, seed + i * 7.31); gl.uniform1f(e.loc.u_pass, i);
      for (const key in m.params) gl.uniform1f(e.loc['u_' + key], p[key] ?? m.params[key][0]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!last) { cur = this.ping[k].t; k ^= 1; }
    });
    if (!jobs.length) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
}

let runner, runnerFailed = false;
export const backend = () => {
  if (/[?&]nogl\b/.test(location.search) || runnerFailed) return 'canvas';
  try { runner = runner || new GLRunner(); return 'webgl2'; } catch (e) { runnerFailed = true; return 'canvas'; }
};

// Canvas fallback helpers
let noiseTile;
export const H = {
  noise() { if (noiseTile) return noiseTile; const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256), r = rng(9);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return noiseTile = c; },
  grain(ctx, a, mode = 'overlay') { const p = ctx.createPattern(this.noise(), 'repeat'); ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = mode; ctx.fillStyle = p; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); },
  fill(ctx, col, mode, a = 1) { ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); },
  filter(ctx, src, f, dx = 0, dy = 0) { ctx.save(); ctx.globalCompositeOperation = 'copy'; if ('filter' in ctx) ctx.filter = f; ctx.drawImage(src, dx, dy, ctx.canvas.width, ctx.canvas.height); ctx.restore(); },
  vignette(ctx, a) { const w = ctx.canvas.width, h = ctx.canvas.height, g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); },
  mk,
};
let wa, wb;
function runCanvas(src, chain, out, t) {
  const w = out.width, h = out.height; wa = wa && wa.width === w && wa.height === h ? wa : mk(w, h); wb = wb && wb.width === w && wb.height === h ? wb : mk(w, h);
  let cur = src, flip = true;
  for (const [m, p] of chain) { const n = m.passes ? m.passes(p) : 1; for (let i = 0; i < n; i++) {
    const dst = flip ? wa : wb, x = dst.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; if ('filter' in x) x.filter = 'none'; x.clearRect(0, 0, w, h);
    x.drawImage(cur, 0, 0, w, h); (m.canvas || (() => {}))(x, cur, { ...p, pass: i }, t, H); cur = dst; flip = !flip; } }
  const ox = out.getContext('2d'); ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, w, h); ox.drawImage(cur, 0, 0);
}

// apply(src, chain, out, {t, seed}): src is a canvas, image or video; out is a 2D canvas; chain is [[medium, params], ...]
export function apply(src, chain, out, o = {}) {
  const t = o.t ?? performance.now() / 1000, seed = o.seed ?? 1, ch = chain.map(c => Array.isArray(c) ? [c[0], { ...defaults(c[0]), ...(c[1] || {}) }] : [c, defaults(c)]);
  if (ch[0] && ch[0][0].points) return ch[0][0].render(src, out, ch[0][1], t, seed);
  if (backend() === 'webgl2') {
    try { runner.run(src, ch, out.width, out.height, t, seed); const x = out.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, out.width, out.height); x.drawImage(runner.cv, 0, 0); return 'webgl2'; }
    catch (e) { console.error(e); runnerFailed = true; }
  }
  runCanvas(src, ch, out, t); return 'canvas';
}
