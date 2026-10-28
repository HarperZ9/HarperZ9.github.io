// lib/light.js: light as a material. Iridescent streaks are drawn from physics rather than from an overlay image:
// thin-film interference sets the hue from a film thickness, dispersion splits the channels across each streak,
// and a four-point star kernel marks each source. The result is composited with Screen, which can only add light.
// Family A in feed set 20's CLAIMS.md. The streaks follow the photograph's own tone contours, so the light seems
// to belong to the scene. Here the scene is a 1936 WPA poster in which headlights catch two deer on a road.
import { clamp } from './util.js';
import { createGL } from './gl.js';
import { revealOut } from './timing.js';

// Thin-film reflectance at wavelength lambda (nm) for a film of thickness d (nm) and index n, at normal incidence.
// Two-beam approximation for a soap film in air: one reflection inverts phase, so R ~ 1 - cos(4 pi n d / lambda),
// which is zero as d goes to zero (the black film just before a bubble bursts).
export function thinFilm(d, lambda, n = 1.33) { return 0.5 - 0.5 * Math.cos((4 * Math.PI * n * d) / lambda); }
export const filmRGB = (d, n = 1.33) => [thinFilm(d, 650, n), thinFilm(d, 532, n), thinFilm(d, 450, n)];
// Screen blend: never darker than either input, never past white.
export const screen = (a, b) => 1 - (1 - a) * (1 - b);

const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D u_img; uniform vec2 u_res, u_img_size, u_l1, u_l2, u_ptr; uniform float u_t, u_gain, u_in;
float h(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.02+7.3; a*=.5; } return s; }
float film(float d, float lam){ return .5-.5*cos(12.566*1.33*d/lam); }
vec2 fit(vec2 q){ float ar=u_res.x/u_res.y, ir=u_img_size.x/u_img_size.y; vec2 s = ar>ir ? vec2(ar/ir,1.) : vec2(1.,ir/ar); return (q-.5)*s+.5; }
// stream function: the poster's blurred tone (from a high mip) plus a slow curl of noise
float psi(vec2 q){ float tone=dot(textureLod(u_img,q,5.).rgb,vec3(.3,.59,.11)); return tone*3.2+q.y*1.4+fbm(q*2.3+vec2(u_t*.02,-u_t*.015)+u_ptr*.3)*1.1; }
float streak(float s, float k){ float c=.5+.5*cos(s*6.2832); return pow(c,k); }
vec3 star(vec2 q, vec2 c, float a){
  vec2 d=(q-c)*vec2(u_res.x/u_res.y,1.); float r=length(d);
  float core=exp(-r*38.)*1.6+exp(-r*9.)*.35;
  float sp=exp(-abs(d.y)*420.)*exp(-abs(d.x)*7.)+exp(-abs(d.x)*420.)*exp(-abs(d.y)*7.);
  vec2 e=mat2(.707,-.707,.707,.707)*d; float sp2=(exp(-abs(e.y)*700.)*exp(-abs(e.x)*16.)+exp(-abs(e.x)*700.)*exp(-abs(e.y)*16.))*.4;
  return vec3(1.,.97,.86)*(core+sp+sp2)*a;
}
void main(){
  vec2 q=fit(uv);
  vec3 base=texture(u_img,q).rgb;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) base=vec3(.03);
  float s=psi(q)*3.2, env=smoothstep(.55,.85,fbm(vec2(s*.25,q.x*1.3)+3.1))*smoothstep(.95,.35,q.y);
  float comb=.75+.25*streak(s*9.,2.);
  float disp=.035; vec3 lines=vec3(streak(s+disp,3.),streak(s,3.),streak(s-disp,3.))*comb*env;
  float d=280.+520.*fbm(q*3.1+s*.02);
  vec3 tf=vec3(film(d,650.),film(d,532.),film(d,450.));
  vec3 L=lines*(.35+.65*tf)*.9*u_gain*u_in;
  L+=star(q,u_l1,u_gain*u_in)+star(q,u_l2,u_gain*u_in);
  o=vec4(1.-(1.-base)*(1.-clamp(L,0.,1.)),1.);
}`;

export function create(cv, assets, opts = {}) {
  const img = assets.poster, G = createGL(cv);
  if (!G) return { label: 'light', failed: 'WebGL2 unavailable', draw() { return false; }, animated: false };
  const prog = G.program(FS), tex = G.texture(img, { mip: true });
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // the two headlights in the 1936 poster, in texture space (y up)
  const l1 = [0.503, 1 - 0.311], l2 = [0.695, 1 - 0.322];
  const st = { gain: 1, t0: null, ptr: [0, 0] };
  return {
    label: 'light', get animated() { return !opts.reduced; },
    draw(time) {
      if (st.t0 === null) st.t0 = time;
      const into = opts.reduced ? 1 : revealOut(time - st.t0);
      G.draw(prog, { u_res: [cv.width, cv.height], u_img_size: [iw, ih], u_l1: l1, u_l2: l2, u_t: opts.reduced ? 0 : time, u_gain: st.gain, u_in: into, u_ptr: st.ptr }, { u_img: tex });
      return !opts.reduced;
    },
    pointer(nx, ny, inside) { if (inside) st.ptr = [nx, ny]; },
    set(g) { st.gain = clamp(g, 0, 3); }, replay() { st.t0 = null; },
  };
}
