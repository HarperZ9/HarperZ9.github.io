// lib/register.js: two-witness misregistration. One ink drum prints what the photograph's tone says (mass),
// the other prints what its edges say (contour). Where the two readings disagree, the plates drift out of
// register; where they agree, they lock. The pointer is a registration pin: attention brings them back together.
import { boxBlur, sobel, fbm, clamp, toLuma } from './util.js';
import { createGL } from './gl.js';

// separate(luma, w, h): returns { tone, edge, dis, angle } as Float32Arrays in [0,1].
export function separate(luma, w, h, o = {}) {
  const n = w * h, tone = new Float32Array(n), edge = new Float32Array(n);
  const sm = boxBlur(luma, w, h, 1), { gx, gy } = sobel(sm, w, h);
  let emax = 1e-6; const mag = new Float32Array(n);
  for (let i = 0; i < n; i++) { mag[i] = Math.hypot(gx[i], gy[i]); if (mag[i] > emax) emax = mag[i]; }
  const sorted = Float32Array.from(mag).sort(), p95 = sorted[Math.floor(n * 0.95)] || emax;
  for (let i = 0; i < n; i++) { tone[i] = Math.pow(1 - sm[i], 1.1); edge[i] = clamp(mag[i] / p95); }
  const r = o.radius ?? 6, ta = boxBlur(tone, w, h, r), ea = boxBlur(edge, w, h, r), dis = new Float32Array(n);
  let dmax = 1e-6; for (let i = 0; i < n; i++) { dis[i] = Math.abs(ta[i] - ea[i] * 1.6); if (dis[i] > dmax) dmax = dis[i]; }
  for (let i = 0; i < n; i++) dis[i] = Math.pow(dis[i] / dmax, 0.8);
  const angle = new Float32Array(n), seed = o.seed ?? 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) angle[y * w + x] = fbm(x / 90, y / 90, seed, 3);
  return { tone, edge: boxBlur(edge, w, h, 1), dis, angle };
}

// Mean disagreement: a single number for the wall label and the tests.
export const meanDisagreement = s => s.dis.reduce((a, b) => a + b, 0) / s.dis.length;

export function pack(s, w, h) {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = s.tone[i] * 255; d[i * 4 + 1] = s.edge[i] * 255; d[i * 4 + 2] = s.dis[i] * 255; d[i * 4 + 3] = s.angle[i] * 255; }
  return { data: d, w, h, channels: 4 };
}

const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D u_s; uniform vec2 u_res, u_ptr, u_img; uniform float u_t, u_amp, u_pin;
float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
vec2 fit(vec2 q){ float ar=u_res.x/u_res.y, ir=u_img.x/u_img.y; vec2 s = ar>ir ? vec2(ar/ir,1.) : vec2(1.,ir/ar); return (q-.5)*s*.94+.5; }
vec2 drift(vec2 q){ vec4 s=texture(u_s,q); float a=s.a*12.566+u_t*.15; float pin=1.-u_pin*exp(-dot(q-u_ptr,q-u_ptr)*28.); return vec2(cos(a),sin(a))*s.b*u_amp*pin; }
void main(){
  vec2 q=fit(uv); vec2 d=drift(q);
  float inA = texture(u_s, q+d*.6).r, inB = texture(u_s, q-d).g;
  // blue: an amplitude-modulated dot screen at 22.5 degrees, the way a duplicator screens a tone;
  // red: line work, printed nearly solid with a stencil mottle
  vec2 fc=gl_FragCoord.xy; float cell=max(3.2,u_res.x/260.);
  mat2 R=mat2(.924,-.383,.383,.924); vec2 g=fract(R*fc/cell)-.5;
  float tone=smoothstep(.18,.92,inA), r=sqrt(tone)*.62, aa=1.2/cell;
  float covA=smoothstep(r+aa,r-aa,length(g))*step(.03,tone);
  float m=h(floor(fc/2.)); float covB=smoothstep(.28,.62,inB*1.15+(m-.5)*.25);
  float out_ = step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.); covA*=out_; covB*=out_;
  vec3 paper = vec3(.952,.93,.885)*(.965+.05*h(floor(gl_FragCoord.xy/3.)));
  vec3 blue = vec3(.13,.24,.52), red = vec3(.93,.32,.24);
  vec3 c = paper*mix(vec3(1.),blue,covA*.93)*mix(vec3(1.),red,covB*.88);
  o = vec4(c,1.);
}`;

export function create(cv, assets, opts = {}) {
  const img = assets.steel, w = 420, h = Math.round(w * img.naturalHeight / img.naturalWidth);
  const { luma } = toLuma(img, w, h);
  const t0 = performance.now(), s = separate(luma, w, h), prepMs = performance.now() - t0;
  const G = createGL(cv);
  if (!G) return { label: 'register', failed: 'WebGL2 unavailable', draw() { return false; }, animated: false };
  const prog = G.program(FS), tex = G.texture(pack(s, w, h));
  const st = { ptr: [-9, -9], pin: 0, pinT: 0, amp: opts.amp ?? 0.028 };
  return {
    label: 'register', prepMs, mean: meanDisagreement(s),
    get animated() { return !opts.reduced; },
    draw(time) {
      st.pin += (st.pinT - st.pin) * 0.1;
      G.draw(prog, { u_res: [cv.width, cv.height], u_img: [w, h], u_t: opts.reduced ? 0 : time, u_amp: st.amp, u_ptr: st.ptr, u_pin: st.pin }, { u_s: tex });
      return !opts.reduced || Math.abs(st.pinT - st.pin) > 0.01;
    },
    pointer(nx, ny, inside) { const ar = cv.width / cv.height, ir = w / h, sc = ar > ir ? [ar / ir, 1] : [1, ir / ar]; st.ptr = [(nx * 0.5) * sc[0] * 0.94 + 0.5, (-ny * 0.5) * sc[1] * 0.94 + 0.5]; st.pinT = inside ? 1 : 0; },
    setAmp(a) { st.amp = a; },
  };
}
