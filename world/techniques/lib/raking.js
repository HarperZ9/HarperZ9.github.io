// lib/raking.js: the raking-light cursor. A scanned page is rebuilt as relief (letterpress bites into paper, fibre
// lifts it), and the cursor becomes a low lamp held at the edge of the sheet. Under flat light the page reads as
// printed. Under raking light a sentence pressed into the sheet from above appears: we wrote it, and say so.
import { boxBlur, fbm, clamp, toLuma, canvas } from './util.js';
import { createGL } from './gl.js';

// relief(ink, indent, w, h): height in [0,1] from ink coverage (letterpress bite), an indent mask and paper fibre.
export function relief(ink, indent, w, h, o = {}) {
  const bite = o.bite ?? 0.55, press = o.press ?? 0.4, fibre = o.fibre ?? 0.22, out = new Float32Array(w * h);
  const ib = boxBlur(ink, w, h, 1), nb = boxBlur(indent, w, h, 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, f = fbm(x / 3.1, y / 1.7, 9, 3) * 0.6 + fbm(x / 22, y / 22, 3, 3) * 0.4;
    out[i] = clamp(0.62 + fibre * (f - 0.5) - bite * ib[i] * 0.5 - press * nb[i] * 0.5);
  }
  return out;
}

// Normal of a height field at (x, y) by central differences, scale k. Unit length. Used by the tests.
export function normalAt(hf, w, h, x, y, k = 8) {
  const at = (a, b) => hf[clamp(b, 0, h - 1) * w + clamp(a, 0, w - 1)];
  const nx = -(at(x + 1, y) - at(x - 1, y)) * k, ny = -(at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(nx, ny, 1);
  return [nx / l, ny / l, 1 / l];
}

// Lambert shading under a lamp at azimuth az and elevation el. Exported so the claim "flat light hides the indent,
// raking light shows it" is a tested number rather than a sentence.
export function shade(n, az, el) { const L = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)]; return Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); }

export function pack(hf, ink, w, h) {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = hf[i] * 65535; d[i * 4] = v >> 8; d[i * 4 + 1] = v & 255; d[i * 4 + 2] = ink[i] * 255; d[i * 4 + 3] = 255; }
  return { data: d, w, h, channels: 4 };
}

const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D u_h; uniform vec2 u_res, u_img; uniform float u_az, u_el, u_k;
float H(vec2 q){ vec4 s=texture(u_h,q); return s.r+s.g/255.; }
float hh(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
// highlight shoulder: linear to 0.8, then an exponential roll toward 1 (quality pass: 29.7% of pixels were pinned at 255)
vec3 sh(vec3 x){ vec3 t=max(x-.8,0.); return min(x,.8)+.17*(1.-exp(-t/.17)); }  // peaks at 0.97 (247)
void main(){
  float ar=u_res.x/u_res.y, ir=u_img.x/u_img.y; vec2 sc = ar>ir ? vec2(ar/ir,1.) : vec2(1.,ir/ar);
  vec2 q=(uv-.5)*sc*1.02+.5; vec2 e=1./u_img;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){ o=vec4(vec3(.06,.055,.05),1.); return; }
  vec3 n=normalize(vec3(-(H(q+vec2(e.x,0))-H(q-vec2(e.x,0)))*u_k, -(H(q+vec2(0,e.y))-H(q-vec2(0,e.y)))*u_k, 1.));
  vec3 L=vec3(cos(u_az)*cos(u_el), sin(u_az)*cos(u_el), sin(u_el));
  float ink=texture(u_h,q).b, dif=max(dot(n,L),0.);
  vec3 alb=mix(vec3(.93,.9,.83), vec3(.08,.07,.06), ink*.92);
  float spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),40.)*ink*.25;
  float amb=.08+.1*sin(u_el);
  vec3 c=alb*(amb+dif*1.25/max(sin(u_el)+.35,.6))+spec;
  o=vec4(sh(pow(c,vec3(.95)))+(hh(gl_FragCoord.xy)-hh(gl_FragCoord.yx+7.))/255.,1.);
}`;

// The sentence pressed into the sheet: written by us, announced on the wall label. No hidden claims.
export const INDENT = 'Every copy keeps the groove.';

export function create(cv, assets, opts = {}) {
  const img = assets.page, w = img.naturalWidth * 2, h = img.naturalHeight * 2;
  const t0 = performance.now(), { luma } = toLuma(img, w, h), ink = luma.map(v => clamp((0.82 - v) / 0.55));
  const ic = canvas(w, h), ix = ic.getContext('2d', { willReadFrequently: true });
  ix.translate(w * 0.5, h * 0.56); ix.rotate(-0.06); ix.font = `italic 400 ${w * 0.072}px "Hanken Grotesk", sans-serif`; ix.textAlign = 'center'; ix.fillStyle = '#fff';
  ix.fillText(INDENT, 0, 0);
  const id = ix.getImageData(0, 0, w, h).data, indent = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) indent[i] = id[i * 4] / 255;
  const hf = relief(ink, indent, w, h), prepMs = performance.now() - t0;
  const G = createGL(cv);
  if (!G) return { label: 'raking', failed: 'WebGL2 unavailable', draw() { return false; }, animated: false };
  const prog = G.program(FS), tex = G.texture(pack(hf, ink, w, h));
  const st = { az: 2.4, el: 1.25, azT: 2.4, elT: 1.25 };
  return {
    label: 'raking', prepMs, get animated() { return false; },
    draw() {
      st.az += Math.atan2(Math.sin(st.azT - st.az), Math.cos(st.azT - st.az)) * 0.2; st.el += (st.elT - st.el) * 0.2;
      G.draw(prog, { u_res: [cv.width, cv.height], u_img: [w, h], u_az: st.az, u_el: st.el, u_k: 9 }, { u_h: tex });
      return Math.abs(st.elT - st.el) + Math.abs(Math.sin(st.azT - st.az)) > 0.003;
    },
    // nx, ny in [-1,1], y down. Distance from centre lowers the lamp; the angle sets its bearing.
    pointer(nx, ny, inside) { if (!inside) { st.elT = 1.25; return; } st.azT = Math.atan2(-ny, nx); st.elT = 0.12 + 1.0 * (1 - clamp(Math.hypot(nx, ny))); },
    lamp(az, el) { st.azT = az; st.elT = el; },
    get light() { return { az: st.azT, el: st.elT }; },
  };
}
