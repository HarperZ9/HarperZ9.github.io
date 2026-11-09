// Raked: letters pressed into a surface (no ink, only depth) and found by a low lamp, the way a conservator reads an
// indent with raking light. The relief is a real height field, not a filter:
//   chamfer   the wall is a 45 degree ramp over a set share of the stroke, from the letter's sdf, then a flat floor;
//   uneven    the press depth varies slowly across the word, as a hand-set die never bites evenly;
//   crush     aggregate at the wall's lip is crushed and chipped, the floor is burnished smoother than the field;
//   substrate the surface's own scan (CC0 concrete, Poly Haven) gives albedo and micro height, so the grain is the
//             grain the press deformed;
//   light     Lambert plus a weak specular from the lamp's normals, a short shadow march toward the lamp for the micro
//             shadows inside each wall, and ambient occlusion from the height field in the counters.
// The lamp sweeps once and rests low at the upper left; the pointer then holds it (bearing sets the azimuth, distance
// from the centre lowers it). Shading law as in techniques/lib/raking.js.
import { createGL } from '../../../techniques/lib/gl.js';
import { shade } from '../../../techniques/lib/raking.js';
import { fbm, hash2, smoothstep, clamp, image, canvas } from '../paint.mjs';

export const meta = {
  id: 'raked', title: 'Raked', renderer: 'webgl', ground: 'own', weight: 800,
  lineage: 'Raking-light examination of documents; Polynomial Texture Maps (Malzbender, Gelb and Wolters, 2001).',
  does: 'Letters pressed into concrete with a chamfered wall, uneven depth and crushed lip, found by a low lamp.',
  params: {
    depth: 'press depth in height units, 0.1 to 0.5 (default 0.3; the field sits at 0.7)',
    chamfer: 'wall width as a share of the half stroke, 0.2 to 1.0 (default 0.55)',
    uneven: 'depth variation, 0 to 0.6 of the depth (default 0.35)',
    substrate: '"concrete" (concrete-wall.jpg, CC0) or "paper"',
    rest: 'lamp at rest, azimuth 2.35 rad (upper left), elevation 0.32 rad (18 degrees)',
  },
};

// Height field in [0,1] and its maps. Returns { height, ao, floor } as Float32Arrays.
export function pressField(g, o = {}) {
  const { w, h, sdf } = g, n = w * h, seed = o.seed ?? 3, depth = o.depth ?? 0.3, uneven = o.uneven ?? 0.35;
  const bevel = Math.max(1.2, g.half * (o.chamfer ?? 0.55)), micro = o.micro ?? null;
  const height = new Float32Array(n), floor = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = sdf[i], p = clamp(d / bevel);              // 0 on the field, 1 on the floor, linear wall
    const sub = micro ? (micro[i] - 0.5) * 0.12 : (fbm(x / 2.6, y / 1.4, seed, 3) - 0.5) * 0.06;
    const bite = depth * (1 - uneven / 2 + uneven * fbm(x / (g.half * 9), y / (g.half * 9), seed + 21, 2));
    const nearWall = Math.exp(-((d - bevel * 0.1) ** 2) / (bevel * bevel * 0.5));
    // crushed lip: chips (hash pits) and high-frequency roughness concentrated where the die edge struck
    const chip = hash2(x >> 1, y >> 1, seed + 5) > 0.86 ? -0.05 : 0, rough = (fbm(x / 0.9, y / 0.9, seed + 9, 2) - 0.5) * 0.08;
    const lip = d < 0 ? Math.exp(-((d + bevel * 0.6) ** 2) / (bevel * bevel * 0.25)) * 0.035 : 0;
    // the floor is burnished: the substrate's grain is pressed down to a third
    const grain = sub * (1 - 0.66 * p);
    height[i] = clamp(0.7 + grain - bite * p + lip + nearWall * (chip + rough));
    floor[i] = p;
  }
  // ambient occlusion: how far a point sits below its neighbourhood (a box mean at two radii)
  const ao = new Float32Array(n), r1 = Math.max(2, Math.round(g.half * 0.6)), r2 = Math.max(4, Math.round(g.half * 1.6));
  const m1 = boxMean(height, w, h, r1), m2 = boxMean(height, w, h, r2);
  for (let i = 0; i < n; i++) ao[i] = clamp(1 - 3.2 * Math.max(0, m1[i] - height[i]) - 1.6 * Math.max(0, m2[i] - height[i]));
  return { height, ao, floor };
}

function boxMean(f, w, h, r) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h), k = 2 * r + 1;
  for (let y = 0; y < h; y++) { let a = 0; for (let i = -r; i <= r; i++) a += f[y * w + clamp(i, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = a / k; a += f[y * w + Math.min(w - 1, x + r + 1)] - f[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += t[clamp(i, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = a / k; a += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  return o;
}

// Contrast an indent wall shows under a lamp: |shade(wall) - shade(field)| / shade(field). For the tests:
// flat light (high elevation) hides the press, raking light shows it.
export function wallContrast(az, el, slope = 0.6) {
  const n = [Math.sin(-slope) * Math.cos(az), Math.sin(-slope) * Math.sin(az), Math.cos(slope)], flat = shade([0, 0, 1], az, el);
  return Math.abs(shade(n, az, el) - flat) / Math.max(1e-6, flat);
}

const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D u_h, u_alb; uniform vec2 u_size; uniform float u_az, u_el, u_k, u_ks;
float H(vec2 q){ vec4 s=texture(u_h,q); return s.r+s.g/255.; }
void main(){
  vec2 e=1./u_size; vec4 m=texture(u_h,uv); float h0=H(uv);
  vec3 n=normalize(vec3(-(H(uv+vec2(e.x,0))-H(uv-vec2(e.x,0)))*u_k, -(H(uv+vec2(0,e.y))-H(uv-vec2(0,e.y)))*u_k, 1.));
  vec3 L=vec3(cos(u_az)*cos(u_el), sin(u_az)*cos(u_el), sin(u_el));
  // micro shadow: march toward the lamp; a neighbour above the ray occludes. u_ks converts height to texels.
  float sh=1.; vec2 dir=normalize(L.xy)*e; float tanEl=tan(u_el);
  for(int i=1;i<=14;i++){ float s=float(i)*1.5; float hh=H(uv+dir*s); float ray=h0+s*tanEl/u_ks; sh=min(sh, clamp(1.-(hh-ray)*u_ks*.9,0.,1.)); }
  float dif=max(dot(n,L),0.)*mix(.25,1.,sh), ao=m.b, burn=m.a;
  vec3 alb=texture(u_alb,uv).rgb*mix(1.,.86,burn);
  float spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),mix(18.,46.,burn))*mix(.03,.16,burn)*sh;
  float amb=(.16+.10*sin(u_el))*mix(.45,1.,ao);
  vec3 c=alb*(amb+dif*1.15/max(sin(u_el)+.32,.55))*mix(.7,1.,ao)+spec;
  vec2 lp=vec2(.5)+vec2(cos(u_az),sin(u_az))*.9; float fall=1.-.18*smoothstep(0.,1.6,distance(uv,lp));
  vec3 g=c*fall; float q=fract(sin(dot(uv*u_size,vec2(12.9898,78.233)))*43758.5453)/255.;
  o=vec4(pow(g,vec3(.95))+q-.5/255.,1.);
}`;

function pack(F, w, h) {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = Math.round(F.height[i] * 65535); d[i * 4] = v >> 8; d[i * 4 + 1] = v & 255; d[i * 4 + 2] = Math.round(F.ao[i] * 255); d[i * 4 + 3] = Math.round(F.floor[i] * 255); }
  return { data: d, w, h, channels: 4 };
}

// The substrate scan drawn to the glyph frame: albedo canvas and a micro-height (its luma, high-passed).
async function substrate(g, which) {
  const c = canvas(g.w, g.h), x = c.getContext('2d', { willReadFrequently: true });
  if (which === 'paper') { x.fillStyle = '#e9e3d6'; x.fillRect(0, 0, g.w, g.h); return { albedo: c, micro: null }; }
  const img = await image('concrete-wall.jpg'), s = Math.max(g.w / img.naturalWidth, g.h / img.naturalHeight) * 1.6;
  x.filter = 'grayscale(.75) contrast(1.05)'; x.drawImage(img, 0, 0, img.naturalWidth * s, img.naturalHeight * s); x.filter = 'none';
  const d = x.getImageData(0, 0, g.w, g.h).data, l = new Float32Array(g.w * g.h);
  for (let i = 0; i < l.length; i++) l[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  const lo = boxMean(l, g.w, g.h, 6), micro = new Float32Array(l.length); for (let i = 0; i < l.length; i++) micro[i] = clamp(0.5 + (l[i] - lo[i]) * 2.2);
  // lift and warm the albedo so the lamp has room to work in both directions
  x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(70,64,56,1)'; x.fillRect(0, 0, g.w, g.h); x.globalCompositeOperation = 'source-over';
  return { albedo: c, micro };
}

export async function create(g, env) {
  const G = createGL(env.canvas);
  if (!G) return { failed: 'WebGL2 unavailable', draw() { return false; } };
  const o = env.opts, sub = await substrate(g, o.substrate ?? 'concrete');
  const F = pressField(g, { seed: env.seed % 31, depth: o.depth, chamfer: o.chamfer, uneven: o.uneven, micro: sub.micro });
  const prog = G.program(FS), tex = G.texture(pack(F, g.w, g.h)), alb = G.texture(sub.albedo);
  // u_k: height-to-normal gain so a full-depth chamfer leans about 50 degrees; u_ks: height units per texel for the march
  const bevel = Math.max(1.2, g.half * (o.chamfer ?? 0.55)), depth = o.depth ?? 0.3, kRelief = (bevel / depth) * 0.6, ks = bevel / depth;
  const REST = { az: 2.35, el: 0.32 }, sweep = o.sweep ?? 5.5;
  const st = { az: REST.az, el: REST.el, azT: REST.az, elT: REST.el, held: false, done: false };
  return {
    fields: F,
    draw(_, t) {
      if (!st.held && !st.done && t < sweep) { const u = t / sweep; st.azT = REST.az + 1.6 * Math.cos(u * Math.PI); st.elT = 0.26 + 0.12 * Math.sin(u * Math.PI); }
      else if (!st.held) { st.azT = REST.az; st.elT = REST.el; }
      st.az += Math.atan2(Math.sin(st.azT - st.az), Math.cos(st.azT - st.az)) * 0.18; st.el += (st.elT - st.el) * 0.18;
      G.draw(prog, { u_size: [g.w, g.h], u_az: st.az, u_el: st.el, u_k: kRelief, u_ks: ks }, { u_h: tex, u_alb: alb });
      return (t < sweep && !st.done) || Math.abs(st.elT - st.el) + Math.abs(Math.sin(st.azT - st.az)) > 0.002;
    },
    pointer(x, y, inside) {
      if (!inside) { st.held = false; return; }
      const nx = (x / g.w) * 2 - 1, ny = (y / g.h) * 2 - 1; st.held = true;
      st.azT = Math.atan2(-ny, nx); st.elT = 0.14 + 0.9 * (1 - clamp(Math.hypot(nx, ny * 0.6)));
    },
    finish() { st.done = true; st.az = st.azT = REST.az; st.el = st.elT = REST.el; }, replay() { st.done = false; },
  };
}
export { smoothstep };
