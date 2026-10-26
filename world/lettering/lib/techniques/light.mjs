// Light: a word written in light, the way a light painter draws in a long exposure. The pen runs the letter's centre
// lines in reading order. The trace takes its colour from two-beam thin-film interference (the soap-film law in
// techniques/lib/light.js) over a thickness that drifts along the stroke, and dispersion splits the channels across
// the line's width. A four-point star marks the pen. Light only adds, so it is drawn on its own dark plate.
import { createGL } from '../../../techniques/lib/gl.js';
import { revealOut } from '../../../techniques/lib/timing.js';
import { filmRGB } from '../../../techniques/lib/light.js';
import { svgDoc, polyD } from '../paint.mjs';

export const meta = {
  id: 'light', title: 'Light', renderer: 'webgl', ground: 'own', weight: 500,
  lineage: 'Newton on thin plates (Opticks, 1704); Gjon Mili\'s light drawings with Picasso (1949); the star filter.',
  does: 'A pen of light traces each stroke; thin-film colour and dispersion split the trace; a star marks the pen.',
  params: { duration: 'write-on time, seconds, 1.8 to 4.2 (default length / 55 half strokes)', shimmer: 'seconds the film keeps moving after the pen stops, 0 to 10 (default 5)', film: 'thickness 330 to 710 nm, index 1.38' },
};

const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D u_f; uniform vec2 u_size, u_tip; uniform float u_prog, u_t, u_half, u_dmax, u_on, u_seed;
float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float film(float d, float lam){ return .5-.5*cos(12.566*1.38*d/lam); }
vec3 F(vec2 q){ vec4 s=texture(u_f,q); return vec3(s.r*u_dmax, s.g+s.b/255., s.a); }
float line(vec2 q){ vec3 f=F(q); float vis=step(f.y,u_prog); float w=u_half*.34; return vis*(exp(-(f.x*f.x)/(w*w))*1.15 + exp(-f.x/(u_half*1.2))*.22); }
void main(){
  vec2 px=1./u_size; vec3 f=F(uv);
  // normal across the stroke from the distance field's gradient; dispersion offsets R and B along it
  vec2 g=vec2(F(uv+vec2(px.x,0)).x-F(uv-vec2(px.x,0)).x, F(uv+vec2(0,px.y)).x-F(uv-vec2(0,px.y)).x); vec2 n=length(g)>1e-4?normalize(g):vec2(0);
  float disp=u_half*.16;
  vec3 L=vec3(line(uv+n*px*disp), line(uv), line(uv-n*px*disp));
  float d=330.+380.*vn(vec2(f.y*26.+u_seed, u_t*.18))+120.*vn(uv*u_size/(u_half*6.));
  vec3 tf=vec3(film(d,650.),film(d,532.),film(d,450.));
  vec3 col=L*(.42+.9*tf);
  // the pen: a hot core and a four-point star
  vec2 e=(uv-u_tip)*u_size/u_half; float r=length(e);
  float star=(exp(-r*r*1.8)*1.4+exp(-abs(e.y)*16.)*exp(-abs(e.x)*.45)+exp(-abs(e.x)*16.)*exp(-abs(e.y)*.45))*u_on;
  col+=vec3(1.,.95,.86)*star;
  vec3 ground=vec3(.028,.027,.034)+h(uv*u_size)*.012;
  o=vec4(1.-(1.-ground)*(1.-clamp(col,0.,1.)),1.);
}`;

// Pack the arc field: R distance to centre line, G and B arc position (16 bit), A inside the letter.
export function packArc(g, dmax) {
  const A = g.arc, n = g.w * g.h, d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.min(65535, Math.round(A.arc[i] * 65535));
    d[i * 4] = Math.min(255, Math.round((A.dist[i] / dmax) * 255)); d[i * 4 + 1] = a >> 8; d[i * 4 + 2] = a & 255; d[i * 4 + 3] = g.mask[i] > 0.5 ? 255 : 0;
  }
  return { data: d, w: g.w, h: g.h, channels: 4 };
}

// The pen position at word-arc fraction p.
export function tipAt(g, p) {
  const L = p * g.total;
  for (const s of g.strokes) {
    if (L > s.start + s.len) continue;
    let acc = s.start; const P = s.pts;
    for (let i = 2; i < P.length; i += 2) { const l = Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]); if (acc + l >= L) { const t = (L - acc) / (l || 1); return [P[i - 2] + (P[i] - P[i - 2]) * t, P[i - 1] + (P[i + 1] - P[i - 1]) * t]; } acc += l; }
    return [P[P.length - 2], P[P.length - 1]];
  }
  const s = g.strokes[g.strokes.length - 1]; return s ? [s.pts[s.pts.length - 2], s.pts[s.pts.length - 1]] : [0, 0];
}

export async function create(g, env) {
  const G = createGL(env.canvas);
  if (!G) return { failed: 'WebGL2 unavailable', draw() { return false; } };
  const dmax = g.half * 6, prog = G.program(FS), tex = G.texture(packArc(g, dmax));
  const dur = env.opts.duration ?? Math.max(1.8, Math.min(4.2, g.total / (g.half * 55))), shimmer = env.opts.shimmer ?? 5;
  let done = false;
  return {
    duration: dur,
    draw(_, t) {
      const p = done ? 1.001 : Math.min(1.001, revealOut(t, 0.05, dur) * 1.001), tip = tipAt(g, Math.min(1, p));
      const on = done ? 0 : Math.max(0, 1 - Math.max(0, t - dur) * 2.5);
      G.draw(prog, { u_size: [g.w, g.h], u_tip: [tip[0] / g.w, 1 - tip[1] / g.h], u_prog: p, u_t: done ? 0 : t, u_half: g.half, u_dmax: dmax, u_on: on, u_seed: env.seed % 113 }, { u_f: tex });
      return !done && t < dur + shimmer;
    },
    finish() { done = true; }, replay() { done = false; },
    svg() {
      const stops = [0, 0.25, 0.5, 0.75, 1].map(u => { const c = filmRGB(330 + 380 * u, 1.38).map(v => Math.round(60 + 195 * v)); return `<stop offset="${u}" stop-color="rgb(${c})"/>`; }).join('');
      const body = g.strokes.map(s => `<path d="${polyD(s.pts)}"/>`).join('');
      return svgDoc(g, `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="url(#film)" stroke-width="${(g.half * 1.6).toFixed(1)}" opacity=".25">${body}</g><g stroke="url(#film)" stroke-width="${(g.half * 0.55).toFixed(1)}">${body}</g></g>`,
        { ground: '#07070a', defs: `<linearGradient id="film" x1="0" x2="1">${stops}</linearGradient>` });
    },
  };
}
