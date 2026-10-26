// dotfield2.js: tens of thousands of marks, each a tone glyph on a print screen. Drop-in for the exhibit's dot field
// (same export names, same parameters, same five mode slots), resynthesized after the 2026-10-23 playbook flagged the
// first version as one reference's look (its five-ink ramp and four modes matched one author's four clips).
//
// What it joins now, none of it from that reference:
//   the halftone screen (area-modulated cells on a rotated lattice, the screen angle of process printing);
//   the glyph cell (tone carried by the mark's shape as well as its size: dot, dash, cross, solid, as in the
//     lettering glyph-cell technique and the dot-matrix sign);
//   Chladni's sand (grains migrate to the nodal set of a vibrating plate; Newton steps on the plate equation);
//   the phyllotaxis spiral (seeds at a printed divergence angle, 137.508 degrees, the golden angle).
// Inks are the house's own: five stops taken from the studio material palettes (chladni ground, ink-brush accent,
// glass accent, raked-concrete accent, light ink), mixed in OKLab. No spectral ramp.
// Modes: 0 image as a halftone of tone glyphs; 1 Chladni grains on a square plate; 2 grains on the nodes of two
// (or three, with the pointer) interfering sources inside a dish; 3 phyllotaxis; 4 clusters set in glyph cells.
// One GL point per vertex id, no buffers. Self-contained (no imports) so the exhibit can vendor it byte for byte.
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

export const RAMP = ['#141a2e', '#3f5f8a', '#a7c4c6', '#d9cdb4', '#f3eee2'];
export const SOURCES = Object.freeze({ '#141a2e': 'studio chladni ground', '#3f5f8a': 'studio ink-brush accent', '#a7c4c6': 'studio glass accent', '#d9cdb4': 'studio raked-concrete accent', '#f3eee2': 'studio light ink' });
export const SCREEN_DEG = 15;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const RAMP3 = RAMP.map(rgb);

const VS = `#version 300 es
precision highp float;
uniform sampler2D u_src; uniform vec2 u_res; uniform float u_time,u_dpr,u_n,u_mode,u_size,u_dissolve,u_mix,u_thresh,u_invert,u_height,u_amp,u_freq,u_speed,u_swirl,u_hasSrc,u_ncl,u_alpha;
uniform vec4 u_two[2]; uniform vec4 u_cl[8]; uniform vec3 u_ptr; uniform float u_pr,u_only,u_sync; uniform vec3 u_ramp[5];
out vec4 vc; out float vshape; out float vang;
const float PI=3.14159265;
float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
vec3 ramp(float t){ t=clamp(t,0.,1.)*4.; int i=int(min(3.,floor(t))); return mix(u_ramp[i],u_ramp[i+1],t-float(i)); }
float lum(vec2 uv){ vec3 c=texture(u_src,clamp(uv,0.,1.)).rgb; return dot(c,vec3(.299,.587,.114)); }
float terr(vec2 p){ return .5+.3*sin(p.x*4.+u_time*.3)*cos(p.y*3.-u_time*.2)+.2*sin((p.x+p.y)*9.); }
float tier(float v){ return v<.3?0.:v<.52?1.:v<.74?2.:3.; }
void cull(){ gl_Position=vec4(2.,2.,0.,1.); gl_PointSize=0.; vc=vec4(0.); vshape=0.; vang=0.; }
void main(){
  float id=float(gl_VertexID), A=u_res.x/u_res.y; vec2 p=vec2(.5); float val=0., sz=1., al=u_alpha, spacing=4., shape=0., ang=0.; vec3 col=vec3(1.);
  if(u_mode<.5){                                         // halftone screen at 15 degrees, tone glyphs
    ang=${(SCREEN_DEG * Math.PI / 180).toFixed(6)}; float c=cos(ang),s=sin(ang); vec2 E=vec2(A*c+s,A*s+c); float cell=sqrt(E.x*E.y/u_n), cols=floor(E.x/cell);
    vec2 r=vec2((mod(id,cols)+.5)*cell,(floor(id/cols)+.5)*cell)-E*.5; vec2 q=vec2(c*r.x-s*r.y,s*r.x+c*r.y)+vec2(A,1.)*.5; p=vec2(q.x/A,q.y);
    if(p.x<0.||p.x>1.||p.y<0.||p.y>1.){ cull(); return; }
    spacing=cell*u_res.y; val=u_hasSrc>.5?lum(p):terr(p); val=mix(val,1.-val,u_invert); val=mix(val,.5+.5*sin(u_time*u_speed*1.3),u_sync*step(u_thresh,val));
    if(val<u_thresh){ cull(); return; }
    vec3 sc=u_hasSrc>.5?texture(u_src,p).rgb:vec3(1.); col=mix(ramp(.25+.75*val),sc,u_mix); shape=tier(val); sz=.42+.7*sqrt(val);
  } else if(u_mode<1.5){                                 // Chladni grains: Newton steps toward f = 0 on a free square plate
    float side=floor(sqrt(u_n)); vec2 g=(vec2(mod(id,side),floor(id/side))+vec2(h1(id),h1(id+7.)))/side; float n=1.+floor(u_height*3.), m=n+2.;
    float settle=(.5-.5*cos(u_time*u_speed*.35))*(.72+.28*h1(id+5.)); vec2 u=g;
    for(int k=0;k<3;k++){ float f=cos(n*PI*u.x)*cos(m*PI*u.y)-cos(m*PI*u.x)*cos(n*PI*u.y);
      vec2 gr=PI*vec2(-n*sin(n*PI*u.x)*cos(m*PI*u.y)+m*sin(m*PI*u.x)*cos(n*PI*u.y), -m*cos(n*PI*u.x)*sin(m*PI*u.y)+n*cos(m*PI*u.x)*sin(n*PI*u.y));
      vec2 st=f*gr/max(dot(gr,gr),1e-4); float L=length(st); u-=settle*st*min(1.,.08/max(L,1e-5)); }
    float f=cos(n*PI*u.x)*cos(m*PI*u.y)-cos(m*PI*u.x)*cos(n*PI*u.y); u+=(vec2(h1(id+11.),h1(id+13.))-.5)*(.004+.02*(1.-settle)); float S=min(1.,1./A)*.92; p=vec2(.5)+(u-.5)*vec2(S,S*A);
    val=1.-clamp(abs(f)*3.,0.,1.); col=ramp(.35+.65*val); sz=.45+.4*h1(id+3.); spacing=u_res.y*S/side*1.1; al*=.55+.45*val;
  } else if(u_mode<2.5){                                 // grains on the nodes of interfering sources, in a dish
    float cols=floor(sqrt(u_n*A)), rows=ceil(u_n/cols); vec2 g=vec2((mod(id,cols)+.5+.5*mod(floor(id/cols),2.))/cols,(floor(id/cols)+.5)/rows); spacing=u_res.x/cols;
    vec2 q=(g-.5)*vec2(A,1.); float pz=u_ptr.z, wsum=u_two[0].z+u_two[1].z+pz*.9; float v=0.; vec2 gv=vec2(0.);
    for(int k=0;k<3;k++){ vec3 S3=k<2?vec3((u_two[k].xy-.5)*vec2(A,1.),u_two[k].z):vec3((u_ptr.xy-.5)*vec2(A,1.),pz*.9); if(S3.z<=0.) continue;
      vec2 d=q-S3.xy; float r=max(length(d),1e-4), ph=r*u_freq-u_time*u_speed; v+=S3.z*sin(ph); gv+=S3.z*cos(ph)*u_freq*d/r; }
    float settle=.65*u_amp; vec2 st=v*gv/max(dot(gv,gv),1e-3); float L=length(st), lim=.45*PI/u_freq; q-=settle*st*min(1.,lim/max(L,1e-5));
    p=q/vec2(A,1.)+.5; float sn=v/max(wsum,.01); val=1.-clamp(abs(sn)*1.6,0.,1.); col=ramp(.3+.7*val); shape=val>.8?0.:1.; ang=atan(gv.y,gv.x)+PI*.5;
    sz=(.35+.6*val)*(.45+.55*u_amp); al*=(.3+.7*val)*(.3+.7*u_amp); if(length((g-.5)*vec2(A,1.))>.5*min(A,1.)+.05*A){ al=0.; }
  } else if(u_mode<3.5){                                 // phyllotaxis at a printed divergence angle
    float dv=(137.508+u_swirl*.35*sin(u_time*u_speed*.05))*PI/180., R=.47*min(1.,A), j=id+.5, r=R*sqrt(j/u_n), a=j*dv+u_time*.03*u_speed;
    p=vec2(.5)+vec2(cos(a),sin(a))*r/vec2(A,1.); val=1.-.75*sqrt(j/u_n); col=ramp(.2+.8*val); shape=tier(val); ang=a; sz=.5+.5*sqrt(j/u_n); spacing=u_res.y*R*2.*1.6/sqrt(u_n);
  } else {                                               // clusters, each grain set into a glyph cell
    float k=mod(id,max(u_ncl,1.)); vec4 c=u_cl[int(k)]; if(h1(id*7.1)>c.w){ cull(); return; }
    float rr=sqrt(-2.*log(max(h1(id+1.7),1e-4)))*c.z*.55, an=6.2832*h1(id+8.3); vec2 pp=c.xy+vec2(cos(an)*rr/A,sin(an)*rr); spacing=u_res.x/110.;
    vec2 cell=vec2(spacing)/u_res; p=(floor(pp/cell)+.5)*cell; float dens=exp(-rr*rr/(c.z*c.z*.18)); val=clamp(.15+.85*dens,0.,1.);
    col=ramp(.3+.55*k/max(u_ncl-1.,1.)+.15*dens); shape=tier(val); sz=.55+.45*dens;
  }
  float pf=0.; if(u_ptr.z>0.){ vec2 dq=(p-u_ptr.xy)*vec2(A,1.); float dd=length(dq); float f=exp(-dd*dd/(u_pr*u_pr))*u_ptr.z; vec2 dir=dq/max(dd,1e-3)/vec2(A,1.);
    float push=u_mode<.5?1.:u_mode<1.5?.6:u_mode<2.5?0.:u_mode<3.5?-1.:-.7; p+=dir*f*.05*push; col=mix(col,ramp(clamp(val+f*.5,0.,1.)),clamp(f*1.2,0.,1.)); sz*=1.+f*.5; pf=f; }
  if(u_only>.5) al*=clamp(pf*2.5,0.,1.);
  float d=u_dissolve; if(d>0.){ vec2 rp=vec2(h1(id+.31),h1(id+.77)); p=mix(p,rp+vec2(0.,-d*.12),d); sz*=1.-.45*d; al*=1.-.55*d; shape=mix(shape,0.,step(.5,d)); }
  gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.); gl_PointSize=max(2.,spacing*u_size*sz*u_dpr*.95); vc=vec4(col,al); vshape=shape; vang=ang;
}`;
const FS = `#version 300 es
precision highp float; in vec4 vc; in float vshape; in float vang; out vec4 o;
float box(vec2 q, vec2 b){ vec2 d=abs(q)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
void main(){ vec2 q=gl_PointCoord-.5; float c=cos(vang),s=sin(vang); q=vec2(c*q.x+s*q.y,-s*q.x+c*q.y); float aa=max(fwidth(gl_PointCoord.x),1e-3);
  float d = vshape<.5 ? length(q)-.3 : vshape<1.5 ? box(q,vec2(.36,.12)) : vshape<2.5 ? min(box(q,vec2(.34,.1)),box(q,vec2(.1,.34))) : length(q)-.47;
  float a=clamp(.5-d/aa,0.,1.)*vc.a; o=vec4(vc.rgb*a,a); }`;

const U = ['u_src', 'u_res', 'u_time', 'u_dpr', 'u_n', 'u_mode', 'u_size', 'u_dissolve', 'u_mix', 'u_thresh', 'u_invert', 'u_height', 'u_amp', 'u_freq', 'u_speed', 'u_swirl', 'u_hasSrc', 'u_ncl', 'u_alpha', 'u_two', 'u_cl', 'u_ptr', 'u_pr', 'u_only', 'u_sync', 'u_ramp'];
let R;
function runner() {
  if (R) return R; const cv = mk(2, 2), gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no webgl2');
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('dotfield2 ' + gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('dotfield2 link ' + gl.getProgramInfoLog(pr));
  const loc = Object.fromEntries(U.map((n) => [n, gl.getUniformLocation(pr, n)])); return (R = { cv, gl, pr, loc, tex: gl.createTexture(), vao: gl.createVertexArray() });
}
export const dotCount = (small = innerWidth < 700) => (small ? 52000 : 110000);
const D = { mode: 0, count: 0, size: 1, dissolve: 0, mix: 0, thresh: 0, invert: 0, height: 1, amp: 1, freq: 38, speed: 2, swirl: 1, alpha: 1 };

function gpu(src, out, p, t) {
  const { cv, gl, pr, loc, tex, vao } = runner(), w = out.width, h = out.height; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(pr); gl.bindVertexArray(vao); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  if (src) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b); gl.uniform1i(loc.u_src, 0); }
  const n = p.count || dotCount(), two = p.two || [0.3, 0.5, 1, 0, 0.7, 0.5, 1, 0], cl = p.clusters || [];
  gl.uniform2f(loc.u_res, w, h); gl.uniform1f(loc.u_time, t); gl.uniform1f(loc.u_dpr, Math.max(1, w / Math.max(1, out.clientWidth || w))); gl.uniform1f(loc.u_n, n);
  for (const k of ['mode', 'size', 'dissolve', 'mix', 'thresh', 'invert', 'height', 'amp', 'freq', 'speed', 'swirl', 'alpha']) gl.uniform1f(loc['u_' + k], p[k]);
  const pt = p.ptr || [0.5, 0.5, 0]; gl.uniform3f(loc.u_ptr, pt[0], pt[1], pt[2]); gl.uniform1f(loc.u_pr, p.pr || 0.16); gl.uniform1f(loc.u_only, p.only ? 1 : 0); gl.uniform1f(loc.u_sync, p.sync || 0); gl.uniform1f(loc.u_hasSrc, src ? 1 : 0); gl.uniform1f(loc.u_ncl, cl.length);
  gl.uniform4fv(loc.u_two, new Float32Array(two.concat([0, 0, 0, 0]).slice(0, 8))); const flat = new Float32Array(32); cl.slice(0, 8).forEach((c, i) => flat.set(c, i * 4)); gl.uniform4fv(loc.u_cl, flat);
  gl.uniform3fv(loc.u_ramp, new Float32Array(RAMP3.flat()));
  gl.drawArrays(gl.POINTS, 0, n);
  const x = out.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.drawImage(cv, 0, 0);
}

// The CPU mirror: the same modes in JS, one callback per mark { x, y (0..1), r (px), shape 0..3, ang, col [r,g,b], a }.
// Used by the Canvas 2D fallback (capped near 9,000 marks) and by the node tests and goldens.
const hs = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
export const ramp = (t) => { t = Math.max(0, Math.min(1, t)) * 4; const i = Math.min(3, Math.floor(t)), f = t - i; return RAMP3[i].map((v, k) => v + (RAMP3[i + 1][k] - v) * f); };
const tier = (v) => (v < 0.3 ? 0 : v < 0.52 ? 1 : v < 0.74 ? 2 : 3);
const plateF = (n, m, x, y) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
export function marks(p, w, h, t, lum, emit) {
  const A = w / h, n = p.count || 9000, P = Math.PI;
  for (let id = 0; id < n; id++) {
    let x, y, val, r, shape = 0, ang = 0, col, a = p.alpha;
    if (p.mode === 1) {
      const side = Math.floor(Math.sqrt(n)), N = 1 + Math.floor(p.height * 3), M = N + 2, settle = (0.5 - 0.5 * Math.cos(t * p.speed * 0.35)) * (0.72 + 0.28 * hs(id + 5)); let u = (id % side + hs(id)) / side, v = (Math.floor(id / side) + hs(id + 7)) / side;
      for (let k = 0; k < 3; k++) { const f = plateF(N, M, u, v), gx = P * (-N * Math.sin(N * P * u) * Math.cos(M * P * v) + M * Math.sin(M * P * u) * Math.cos(N * P * v)), gy = P * (-M * Math.cos(N * P * u) * Math.sin(M * P * v) + N * Math.cos(M * P * u) * Math.sin(N * P * v)), g2 = Math.max(gx * gx + gy * gy, 1e-4), sx = (f * gx) / g2, sy = (f * gy) / g2, L = Math.hypot(sx, sy), c = settle * Math.min(1, 0.08 / Math.max(L, 1e-5)); u -= sx * c; v -= sy * c; }
      u += (hs(id + 11) - 0.5) * (0.004 + 0.02 * (1 - settle)); v += (hs(id + 13) - 0.5) * (0.004 + 0.02 * (1 - settle));
      const S = Math.min(1, 1 / A) * 0.92; x = 0.5 + (u - 0.5) * S; y = 0.5 + (v - 0.5) * S * A; val = 1 - Math.min(1, Math.abs(plateF(N, M, u, v)) * 3); col = ramp(0.35 + 0.65 * val); r = (h * S / side) * 0.55 * (0.45 + 0.4 * hs(id + 3)) * p.size; a *= 0.55 + 0.45 * val;
    } else if (p.mode === 3) {
      const dv = ((137.508 + p.swirl * 0.35 * Math.sin(t * p.speed * 0.05)) * P) / 180, R = 0.47 * Math.min(1, A), j = id + 0.5, rr = R * Math.sqrt(j / n), an = j * dv + t * 0.03 * p.speed;
      x = 0.5 + (Math.cos(an) * rr) / A; y = 0.5 + Math.sin(an) * rr; val = 1 - 0.75 * Math.sqrt(j / n); col = ramp(0.2 + 0.8 * val); shape = tier(val); ang = an; r = ((h * R * 2 * 1.6) / Math.sqrt(n)) * 0.5 * (0.5 + 0.5 * Math.sqrt(j / n)) * p.size;
    } else {
      const ag = (SCREEN_DEG * P) / 180, c = Math.cos(ag), s = Math.sin(ag), Ex = A * c + s, Ey = A * s + c, cell = Math.sqrt((Ex * Ey) / n), cols = Math.floor(Ex / cell);
      const rx = ((id % cols) + 0.5) * cell - Ex / 2, ry = (Math.floor(id / cols) + 0.5) * cell - Ey / 2; x = (c * rx - s * ry + A / 2) / A; y = s * rx + c * ry + 0.5;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue; val = lum(x, y); if (p.invert) val = 1 - val; if (val < p.thresh) continue;
      col = ramp(0.25 + 0.75 * val); shape = tier(val); ang = ag; r = cell * h * 0.5 * (0.42 + 0.7 * Math.sqrt(val)) * p.size;
    }
    if (p.dissolve > 0) { const d = p.dissolve; x += (hs(id + 0.31) - x) * d; y += (hs(id + 0.77) - y - d * 0.12) * d; r *= 1 - 0.45 * d; a *= 1 - 0.55 * d; }
    emit({ x, y, r: Math.max(0.6, r), shape, ang, col, a });
  }
}

function cpu(src, out, p, t) {
  const x = out.getContext('2d'), w = out.width, h = out.height; x.clearRect(0, 0, w, h); let data = null, sw = 0, sh = 0;
  if (src) { const c = mk(96, Math.round((96 * h) / w)); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); sw = c.width; sh = c.height; data = c.getContext('2d').getImageData(0, 0, sw, sh).data; }
  const lum = (u, v) => { if (!data) return 0.5 + 0.3 * Math.sin(u * 4 + t * 0.3) * Math.cos(v * 3); const i = (Math.min(sh - 1, (v * sh) | 0) * sw + Math.min(sw - 1, (u * sw) | 0)) * 4; return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255; };
  const q = { ...p, mode: p.mode === 2 || p.mode === 4 ? 0 : p.mode, count: Math.min(9000, p.count || 9000) };
  marks(q, w, h, t, lum, (m) => { x.fillStyle = `rgba(${m.col.map((v) => Math.round(v * 255)).join(',')},${m.a})`; x.beginPath(); x.arc(m.x * w, m.y * h, m.r, 0, 6.2832); x.fill(); });
}

export const dotfield = {
  id: 'dotfield', name: 'Dot field', date: 'Halftone screens, 1880s; Chladni plates, 1787; phyllotaxis, 1830s', medium: 'Tens of thousands of tone marks on a print screen',
  history: 'Process printing breaks a picture into cells on a screen turned off the vertical, and each cell carries its tone as the area of a mark. Ernst Chladni scattered sand on a bowed plate in 1787 and watched it run to the lines that do not move. The Bravais brothers measured the angle between successive leaves and seeds in the 1830s and found it near 137.5 degrees. A dot field uses all three: a screen, a mark whose shape tells its weight, and sand that settles where the field is still.',
  analogy: 'A count. Each mark is one observation, and its shape says how much it weighs. The picture only appears when you stop looking at any single mark, and it falls apart again as soon as you do.',
  demo: null, params: { size: [1, 0.3, 1.8], dissolve: [0, 0, 1], mix: [0, 0, 1], height: [1, 0.2, 1.6] },
  defaults: D, points: true,
  render(src, out, p, t) { const q = { ...D, ...p }; if (!window.__nogl && !/[?&]nogl\b/.test(location.search)) { try { gpu(src, out, q, t); return 'webgl2'; } catch (e) { console.error(e); window.__nogl = true; } } cpu(src, out, q, t); return 'canvas'; },
};

export const SPEC = Object.freeze({
  inputs: { src: 'image or canvas (optional)', out: 'canvas', t: 's' },
  params: {
    mode: { range: [0, 4], unit: '0 halftone, 1 Chladni plate, 2 two-source nodes, 3 phyllotaxis, 4 glyph-cell clusters', default: 0 },
    count: { range: [1000, 150000], unit: 'marks', default: 0 }, size: { range: [0.3, 1.8], unit: 'x cell', default: 1 },
    thresh: { range: [0, 1], unit: 'luma share below which no mark', default: 0 }, height: { range: [0.2, 1.6], unit: 'plate mode index (n = 1 + floor(3 x height))', default: 1 },
    freq: { range: [4, 80], unit: 'rad per frame height (mode 2)', default: 38 }, speed: { range: [0, 6], unit: 'rad per s', default: 2 },
    screen: { range: [15, 15], unit: 'deg, halftone screen angle', default: 15 },
  },
  determinism: 'marks(p, w, h, t, lum) is pure; GPU and CPU follow the same equations',
  budget: '110,000 marks in one draw call, no buffers',
});
