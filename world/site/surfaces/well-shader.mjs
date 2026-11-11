// well-shader.mjs: the well's picture, one fragment shader with a ground for each medium (uFx.x is its number,
// uBase its colour; grounds.mjs names them and states each rule, and mixOn() there is the same arithmetic).
//
//   0 paper         absorbent and toothed. Each element is a wash with a thickness; washes lie in the order chosen
//                   and stack as Kubelka-Munk layers (km.mjs). A dried rim (uFx.y is how dry), wet-into-wet edges and
//                   granulation into the tooth move the thickness.
//   1 stone         hard, coarse grain: the same layers, but pigment sits on top, beads to hard edges and pools.
//   2 metal plate   hard, brushed: the same layers on a bright ground with a sheen where it is bare.
//   3 glass         clear: light comes through from behind, each wash is a filter, the filters multiply.
//   4 water         fluid: pigment mixed in dark water by the geometric mean of reflectances (the earlier look).
//   5 air, mist     a scattering volume: pigment as smoke, the plain average by amount over the air's own colour.
//   6 light         emissive: colours add on black.
//   7 screen pixel  emissive: the same sum, shown through a grid of red, green and blue cells.
//   8 data          symbolic: a lattice of cells, one mark per pigment per cell, its area by the amount there.
// uFlatOn = 1 is a probe for tests: flat layers of the thicknesses in uFlat on the bare ground, by the ground's rule.
export const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
export const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uDye, uDisp, uProd;
uniform vec3 uBase, uLin[5], uK[5], uS[5];   // slot 4 is the reaction's product
uniform vec4 uA[4], uB[4], uC[4], uD[4];   // A: feature frequency, cos, sin, stretch. B: octave gain, gradient width, coverage, vein strength. C: rows, slot seed, on, unused. D: granulation, rim, bleed, unused
uniform vec4 uFx, uGain, uFlat;            // Fx: ground, dry, product softness, mean link strength. Gain: granulation, rim, tooth, product (1 each; tests set one to 0)
uniform float uAspect, uFlatOn;
float h(vec2 q){ q = fract(q * vec2(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.x); }
float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 q, float gain){ float a = 1., s = 0., t = 0.; for (int k = 0; k < 5; k++){ s += a * vn(q); t += a; q = q * 2.03 + 17.; a *= gain; } return s / t; }
void km(vec3 K, vec3 S, float d, out vec3 R, out vec3 T){
  K = max(K, vec3(1e-4)); S = max(S, vec3(1e-4));
  vec3 a = 1. + K / S, b = sqrt(a * a - 1.), x = b * S * d, e = exp(-2. * x), den = a * (1. - e) + b * (1. + e);
  R = (1. - e) / den; T = 2. * b * exp(-x) / den; }
vec3 lay(vec3 under, vec3 K, vec3 S, float d){ vec3 R, T; km(K, S, d, R, T); return R + T * T * under / (1. - R * under); }
vec3 thru(vec3 K, vec3 S, float d){ vec3 R, T; km(K, S, d, R, T); return T; }
vec3 enc(vec3 lin){ lin = clamp(lin, 0., 1.); return mix(12.92 * lin, 1.055 * pow(lin, vec3(1. / 2.4)) - .055, step(.0031308, lin)); }
// the rules that are sums: geometric (water), volume (air), additive (light, screen), partitive (data)
vec3 blendBy(float med, vec3 acc, vec3 logmix, float tot, float area){
  if (med < 4.5) return tot > .0002 ? mix(uBase, exp(logmix / tot), 1. - exp(-tot * 2.4)) : uBase;
  if (med < 5.5) return tot > .0002 ? mix(uBase, acc / tot, 1. - exp(-tot * 1.6)) : uBase;
  if (med < 7.5) return min(vec3(1.), .9 * acc);
  return acc + (1. - area) * uBase; }
void main(){
  float med = uFx.x; bool layered = med < 2.5, glass = med > 2.5 && med < 3.5, hard = med > .5 && med < 3.5, stone = med > .5 && med < 1.5, metal = med > 1.5 && med < 2.5;
  if (uFlatOn > .5){ vec3 R = uBase, acc = vec3(0.), lg = vec3(0.); float tot = 0., area = 0.;
    for (int i = 0; i < 4; i++){ float d = i == 0 ? uFlat.x : i == 1 ? uFlat.y : i == 2 ? uFlat.z : uFlat.w;
      if (layered) R = lay(R, uK[i], uS[i], d); else if (glass) R *= thru(uK[i], uS[i], d);
      else if (med > 7.5){ float a = .18 * min(1., d); acc += a * uLin[i]; area += a; }
      else { acc += d * uLin[i]; lg += d * log(max(uLin[i], vec3(.004))); tot += d; } }
    gl_FragColor = vec4(enc(med < 3.5 ? R : blendBy(med, acc, lg, tot, area)), 1.); return; }
  vec2 uv = vec2(v.x, 1. - v.y);
  vec4 dye = texture2D(uDye, uv), dsp = texture2D(uDisp, uv);
  vec2 q = uv - (dsp.xy - .5) * .6; q.x *= uAspect;
  float sum = dye.r + dye.g + dye.b + dye.a;
  // the ground's own surface: paper's tooth, stone's coarse grain, metal's brushing. A height from 0 (low) to 1.
  vec2 pq = vec2(uv.x * uAspect, uv.y) * (stone ? 34. : 120.);
  if (metal) pq = vec2(pq.x * .04, pq.y * 2.2);
  float th = .5 * vn(pq) + .3 * vn(pq * 2.1 + 9.) + .2 * vn(pq * 4.3 + 31.);
  vec3 R = uBase * (1. + uGain.z * (stone ? .5 : .16) * (th - .5)), logmix = vec3(0.), acc = vec3(0.); float tot = 0., seen = 0., area = 0.;
  if (glass) R = uBase * (.9 + .1 * vn(uv * 3.));
  // the data ground: a lattice, read at each cell's middle
  vec2 cells = vec2(30. * uAspect, 30.), cell = (floor(uv * cells) + .5) / cells, in01 = fract(uv * cells);
  vec4 dyeC = texture2D(uDye, cell);
  for (int i = 0; i < 4; i++){
    if (uC[i].z < .5) continue;
    float c = i == 0 ? dye.r : i == 1 ? dye.g : i == 2 ? dye.b : dye.a;
    if (med > 7.5){ float cc = i == 0 ? dyeC.r : i == 1 ? dyeC.g : i == 2 ? dyeC.b : dyeC.a;   // one mark per pigment, each in its own quarter of the cell
      vec2 at = vec2(i == 0 || i == 2 ? .27 : .73, i < 2 ? .27 : .73); float rr = .24 * sqrt(clamp(cc * cc * (.5 + uB[i].z), 0., 1.));
      float on = 1. - smoothstep(rr - .03, rr + .03, max(abs(in01.x - at.x), abs(in01.y - at.y))); acc += on * uLin[i]; area += on; continue; }
    // the element's own grain: turned to its measured wave angle, drawn out along it by the wave's strength
    vec2 p = vec2(dot(q, uA[i].yz), dot(q, vec2(-uA[i].z, uA[i].y))); p.y /= uA[i].w; p = p * uA[i].x + uC[i].y;
    vec2 warp = vec2(fbm(p + 3.1, .5), fbm(p + 7.7, .5)) - .5;          // marbling: the grain is folded through itself
    float n = fbm(p + 1.6 * warp, uB[i].x);
    float rows = uC[i].x > 1.5 ? .09 * sin(6.2831853 * uC[i].x * uv.y) : 0.;
    float body = smoothstep(.5 - uB[i].y, .5 + uB[i].y, n + rows + (uB[i].z - .45) * .5);   // thick and thin pigment; the gradient is the edge softness
    float vein = 1. - smoothstep(0., .07, abs(fract(n * 6.) - .5));     // fine lines where the pigment parts
    if (med < 3.5){
      float wet = smoothstep(.06, .5, sum - c);                         // another pigment is here: wet into wet
      float s = clamp(uB[i].y * .6, .02, .22) * (1. + 2.2 * wet * uD[i].z) * (hard ? .3 : 1.);   // on a hard ground pigment beads: its edge is sharp
      float e = c * (.42 + .95 * uB[i].z) + (n + rows - .5) * .62 - .4;  // how far inside the wash's edge this point is
      float m = smoothstep(-s, s, e); seen += m;
      float d = m * (.3 + 1.0 * uB[i].z) * (.5 + .5 * body) * (1. - .5 * uB[i].w * vein) * (.45 + .55 * c);
      if (hard) d = m * (.3 + 1.0 * uB[i].z) * (.7 + 1.1 * smoothstep(0., .5, e));   // and pools: thickest away from the edge
      float rim = exp(-pow((e - s - .03) / (s * .5 + .04), 2.)) * (1. - wet);
      d += uGain.y * uFx.y * uD[i].y * rim * (.8 + 1.3 * uB[i].z);
      if (med < 1.5) d *= max(0., 1. + uGain.x * uD[i].x * 1.9 * (.5 - th));   // granulation: more pigment in the low points of paper and stone
      if (glass) R *= thru(uK[i], uS[i], d); else R = lay(R, uK[i], uS[i], d);
    } else {
      float d = c * (.25 + 1.25 * uB[i].z) * (.3 + .9 * body) * (1. - uB[i].w * vein);
      if (med > 4.5 && med < 5.5) d = c * (.3 + 1.1 * uB[i].z) * (.25 + 1.9 * n * n);   // smoke: soft, no veins
      logmix += d * log(max(uLin[i], vec3(.004))); acc += d * uLin[i]; tot += d;
    }
  }
  // the reaction's product, where linked elements have met: a pigment of its own, with its own pattern, laid where the pigments themselves show
  float pm = uGain.w * (.25 + .75 * uFx.w) * smoothstep(.16, .5 + 1.4 * uFx.z, texture2D(uProd, uv).r);
  if (med < 3.5){ float pd = pm * smoothstep(.3, 1.3, seen) * .6 * max(0., 1. + uGain.x * 1.7 * (.5 - th));
    if (glass) R *= thru(uK[4], uS[4], pd); else R = lay(R, uK[4], uS[4], pd);
    if (metal) R += .22 * uBase * pow(th, 6.) * (1. - smoothstep(0., .8, seen));                                    // metal: a sheen where the plate is bare
    if (glass) R += .1 * smoothstep(.75, 1., vn(uv * vec2(2.2, 5.) + 4.)) * (1. - .5 * smoothstep(0., 1., seen));   // glass: a soft glare
  } else {
    if (med > 5.5 && med < 7.5) acc += pm * smoothstep(0., .5, tot) * uLin[4];                 // on light the product is one more light
    R = blendBy(med, acc, logmix, tot, min(1., area));
    if (med < 5.5) R = mix(R, uLin[4], .7 * pm * smoothstep(0., .5, tot));
    if (med > 7.5) R = mix(R, uLin[4], .35 * pm * smoothstep(0., .5, sum));
    if (med > 6.5 && med < 7.5){ vec2 px = uv * vec2(60. * uAspect, 60.); float sx = fract(px.x) * 3.;   // screen: red, green and blue cells with a dark line between rows
      vec3 mask = vec3(step(sx, 1.), step(1., sx) * step(sx, 2.), step(2., sx)); R = R * mask * 2.6 * smoothstep(.0, .12, fract(px.y)) * smoothstep(1., .88, fract(px.y)); }
  }
  gl_FragColor = vec4(enc(R), 1.);
}`;
