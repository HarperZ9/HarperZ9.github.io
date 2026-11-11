// well-shader.mjs: the well's picture, one fragment shader with a ground for each medium (uFx.x is its number,
// uEnv.x its variant, uBase its colour; grounds.mjs names them and states each rule, and mixOn() there is the same
// arithmetic). The numbers below are the first; the variants are listed after them.
//
//   0 paper         absorbent and toothed. Each element is a wash with a thickness; washes lie in the order chosen
//                   and stack as Kubelka-Munk layers (km.mjs). A dried rim (uFx.y is how dry), wet-into-wet edges and
//                   granulation into the tooth move the thickness.
//   1 stone         hard, coarse grain: the same layers, but pigment sits on top, beads to hard edges and pools.
//   2 metal plate   hard, brushed: the same layers on a bright ground with a sheen where it is bare.
//   3 glass         clear: light comes through from behind, each wash is a filter, the filters multiply.
//   4 water         fluid: pigment mixed in dark water band by band over 16 bands of the spectrum (km.mjs mixture(),
//                   which is world/superframe/lib/medium/spectral.mjs): uKS holds each pigment's 16 ratios of
//                   absorption to scattering, uPM each band's colour.
//   5 air, mist     a scattering volume: pigment as smoke, the plain average by amount over the air's own colour.
//   6 light         emissive: colours add on black.
//   7 screen pixel  emissive: the same sum, shown through a grid of red, green and blue cells.
//   8 data          symbolic: a lattice of cells, one mark per pigment per cell, its area by the amount there.
//   9 powder        a field of grains: each grain is bare or takes one pigment whole, so the eye averages by area.
// Variants: paper 1 fibre sheet (long fibres along x, pigment in the hollows between them), 2 the same sheet wet;
// stone 1 wood; glass 1 ice (cracks, frost); water 1 melt (it glows), 2 pulp (loose fibres); powder 0 sand, 1 snow,
// 2 wood chips.
// A CHANGE OF STATE (uTo.w = 1) draws the old ground and the new one and joins them along the solver's front, which
// arrives in the blue channel of uDisp; uTo.z is the operation, which colours the front's line.
// WRITING (uInk.a = 1): a mask of letters in uWrite is laid as one more paint layer on a layered ground. On a fibre
// sheet it feathers along the fibres and lies thicker in the hollows.
// BRUSHED PAINT (uBr.x = 1): uBrush holds, per pigment, how much paint the site's brush engine left at each point
// (brush-field.mjs), ten times finer than the solver's field. Each amount is one more layer by the ground's rule. On a
// ground with a tooth, thin paint catches on the high points only, so a nearly dry brush breaks up over the tooth.
// uFlatOn = 1 is a probe for tests: flat layers of the thicknesses in uFlat on the bare ground, by the ground's rule.
export const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
export const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uDye, uDisp, uProd, uWrite, uBrush;
uniform vec3 uBase, uBase2, uLin[5], uK[6], uS[6];   // slot 4 is the reaction's product, slot 5 the written ink
uniform vec4 uA[4], uB[4], uC[4], uD[4];   // A: feature frequency, cos, sin, stretch. B: octave gain, gradient width, coverage, vein strength. C: rows, slot seed, on, unused. D: granulation, rim, bleed, unused
uniform vec4 uKS[16]; uniform vec3 uPM[16];   // KS: pigment i's 16 bands are uKS[4 i] to uKS[4 i + 3]. PM: each band's colour
uniform vec4 uFx, uGain, uFlat, uTo, uEnv, uInk, uBr;   // Fx: ground, dry, product softness, mean link strength. Gain: granulation, rim, tooth, product (1 each; tests set one to 0)
// To: the next ground, its variant, the operation (1 heat, 2 cool or dry, 3 grind, 4 soak, 5 press), on. Env: this ground's variant, tilt x, tilt y. Ink: unused rgb, on
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
// the rules that are sums: mixture (water), volume (air), additive (light, screen), partitive (data)
vec3 wetmix(mat4 kq, float tot){ vec3 o = vec3(0.);
  for (int j = 0; j < 4; j++){ vec4 q = kq[j] / tot, r = 1. + q - sqrt(q * q + 2. * q); for (int c = 0; c < 4; c++) o += uPM[j * 4 + c] * r[c]; }
  return clamp(o, 0., 1.); }
vec3 blendBy(float med, vec3 B, vec3 acc, mat4 kq, float tot, float area){
  if (med < 4.5) return tot > .0002 ? mix(B, wetmix(kq, tot), 1. - exp(-tot * 2.4)) : B;
  if (med < 5.5) return tot > .0002 ? mix(B, acc / tot, 1. - exp(-tot * 1.6)) : B;
  if (med < 7.5) return min(vec3(1.), .9 * acc);
  return acc + (1. - area) * B; }
float part(vec4 d, int i){ return i == 0 ? d.r : i == 1 ? d.g : i == 2 ? d.b : d.a; }
vec3 shade(float med, float var, vec3 B, vec2 uv, vec4 dye, vec2 q);
void main(){
  float med = uFx.x; bool layered = med < 2.5, glass = med > 2.5 && med < 3.5, hard = med > .5 && med < 3.5, stone = med > .5 && med < 1.5, metal = med > 1.5 && med < 2.5;
  if (uFlatOn > .5){ vec3 R = uBase, acc = vec3(0.); mat4 lg = mat4(0.); float tot = 0., area = 0.;
    for (int i = 0; i < 4; i++){ float d = i == 0 ? uFlat.x : i == 1 ? uFlat.y : i == 2 ? uFlat.z : uFlat.w;
      if (layered) R = lay(R, uK[i], uS[i], d); else if (glass) R *= thru(uK[i], uS[i], d);
      else if (med > 7.5){ float a = .18 * min(1., d); acc += a * uLin[i]; area += a; }
      else { acc += d * uLin[i]; for (int j = 0; j < 4; j++) lg[j] += d * uKS[i * 4 + j]; tot += d; } }
    gl_FragColor = vec4(enc(med < 3.5 ? R : blendBy(med, uBase, acc, lg, tot, area)), 1.); return; }
  vec2 uv = vec2(v.x, 1. - v.y);
  vec4 dye = texture2D(uDye, uv), dsp = texture2D(uDisp, uv);
  vec2 q = uv - (dsp.xy - .5) * .6; q.x *= uAspect;
  vec3 R = shade(med, uEnv.x, uBase, uv, dye, q);
  if (uTo.w > .5){   // the front: ragged, and its line is coloured by the operation
    float ph = dsp.b, m = smoothstep(.3, .7, ph + (fbm(vec2(uv.x * uAspect, uv.y) * 11., .55) - .5) * 2.4 * ph * (1. - ph)), line = 4. * m * (1. - m);
    if (ph > .004) R = mix(R, shade(uTo.x, uTo.y, uBase2, uv, dye, q), m);
    if (uTo.z < 1.5) R += line * vec3(1., .42, .08) + .25 * ph * (1. - m) * vec3(.9, .25, .02);
    else if (uTo.z < 2.5) R = mix(R, vec3(.88, .95, 1.), .7 * line);
    else if (uTo.z < 3.5) R = R * (1. - .65 * line) + .25 * line * step(.6, h(floor(uv * vec2(260. * uAspect, 260.))));
    else R *= 1. - .45 * line;
  }
  gl_FragColor = vec4(enc(R), 1.);
}
vec3 shade(float med, float var, vec3 B, vec2 uv, vec4 dye, vec2 q){
  bool layered = med < 2.5, glass = med > 2.5 && med < 3.5, hard = med > .5 && med < 3.5, stone = med > .5 && med < 1.5, metal = med > 1.5 && med < 2.5, powder = med > 8.5;
  bool fibre = med < .5 && var > .5, wood = stone && var > .5, ice = glass && var > .5, wet = med > 3.5 && med < 4.5, melt = wet && var > .5 && var < 1.5, pulp = wet && var > 1.5;
  float sum = dye.r + dye.g + dye.b + dye.a;
  // the ground's own surface: paper's tooth, a sheet's fibres, stone's coarse grain, wood's rings, metal's brushing. A height from 0 (low) to 1.
  vec2 at = vec2(uv.x * uAspect, uv.y), pq = at * (stone ? 34. : 120.);
  if (metal) pq = vec2(pq.x * .04, pq.y * 2.2);
  if (fibre) pq = vec2(pq.x * .09, pq.y * 1.5 + 3. * vn(at * vec2(2.5, 1.)));
  float th = .5 * vn(pq) + .3 * vn(pq * 2.1 + 9.) + .2 * vn(pq * 4.3 + 31.), strand = 0.;
  if (fibre){ vec2 fq = vec2(at.x * 5., at.y * 150. + 5. * vn(at * vec2(3., 2.) + 5.)); strand = smoothstep(.74, .95, vn(fq)) + .6 * smoothstep(.8, .97, vn(fq * vec2(1.7, .6) + 40.)); th = clamp(th + .45 * strand, 0., 1.); }
  if (wood){ float ring = .5 + .5 * sin(46. * (uv.y + .16 * vn(at * vec2(1.4, 5.)) + .03 * vn(at * vec2(30., 6.)))); th = .65 * ring + .35 * vn(at * vec2(8., 160.)); }
  vec3 R = B * (1. + uGain.z * (stone ? .5 : fibre ? .3 : .16) * (th - .5)), acc = vec3(0.); mat4 logmix = mat4(0.); float tot = 0., seen = 0., area = 0.;
  if (fibre) R *= 1. + .16 * strand * (var > 1.5 ? .4 : 1.);
  if (glass) R = B * (.9 + .1 * vn(uv * 3.));
  if (melt) B *= .5 + 1.1 * fbm(q * 3.2 + 2., .55);
  if (pulp) B *= .82 + .4 * smoothstep(.6, .95, vn(vec2(q.x * 9., q.y * 70.) + 3. * vn(q * 6.)));
  // the data ground: a lattice, read at each cell's middle. The powder ground: grains, each read at its own middle.
  vec2 cells = powder ? (var > 1.5 ? vec2(34. * uAspect, 72.) : vec2(66. * uAspect, 66.)) : vec2(44. * uAspect, 44.);
  vec2 guv = powder ? vec2(uv.x + .5 * mod(floor(uv.y * cells.y), 2.) / cells.x, uv.y) : uv, cell = (floor(guv * cells) + .5) / cells, in01 = fract(guv * cells);
  vec4 dyeC = texture2D(uDye, cell);
  vec4 br = uBr.x > .5 && med < 7.5 ? texture2D(uBrush, uv) : vec4(0.);
  float gr2 = h(floor(guv * cells) + 91.3); vec3 grain = B * (.62 + .76 * gr2); bool taken = false;
  if (powder){ q = cell - (texture2D(uDisp, cell).xy - .5) * .6; q.x *= uAspect; }   // a grain takes its colour whole, so the pigment's pattern is read at the grain's middle
  for (int i = 0; i < 4; i++){
    if (uC[i].z < .5) continue;
    float c = powder ? part(dyeC, i) : part(dye, i);
    if (med > 7.5 && !powder){ float cc = part(dyeC, i);   // one mark per pigment, each in its own quarter of the cell
      vec2 mk = vec2(i == 0 || i == 2 ? .27 : .73, i < 2 ? .27 : .73); float rr = .24 * sqrt(clamp(cc * cc * (.5 + uB[i].z), 0., 1.));
      float on = 1. - smoothstep(rr - .03, rr + .03, max(abs(in01.x - mk.x), abs(in01.y - mk.y))); acc += on * uLin[i]; area += on; continue; }
    // the element's own grain: turned to its measured wave angle, drawn out along it by the wave's strength
    vec2 p = vec2(dot(q, uA[i].yz), dot(q, vec2(-uA[i].z, uA[i].y))); p.y /= uA[i].w; p = p * uA[i].x + uC[i].y;
    vec2 warp = vec2(fbm(p + 3.1, .5), fbm(p + 7.7, .5)) - .5;          // marbling: the grain is folded through itself
    float n = fbm(p + 1.6 * warp, uB[i].x);
    float rows = uC[i].x > 1.5 ? .09 * sin(6.2831853 * uC[i].x * uv.y) : 0.;
    float body = smoothstep(.5 - uB[i].y, .5 + uB[i].y, n + rows + (uB[i].z - .45) * .5);   // thick and thin pigment; the gradient is the edge softness
    float vein = 1. - smoothstep(0., .07, abs(fract(n * 6.) - .5));     // fine lines where the pigment parts
    if (powder){ float a = smoothstep(-.12, .12, c * (.42 + .95 * uB[i].z) + (n + rows - .5) * .62 - .4) * (.3 + .55 * min(1., c));   // the share of grains this pigment stains here
      if (!taken && h(floor(guv * cells) + 17.3 * float(i + 1)) < a){ grain = uLin[i] * (.72 + .56 * gr2); taken = true; } continue; }
    if (med < 3.5){
      float wet = smoothstep(.06, .5, sum - c);                         // another pigment is here: wet into wet
      float s = clamp(uB[i].y * .6, .02, .22) * (1. + 2.2 * wet * uD[i].z) * (hard ? .3 : 1.);   // on a hard ground pigment beads: its edge is sharp
      float e = c * (.42 + .95 * uB[i].z) + (n + rows - .5) * .62 - .4;  // how far inside the wash's edge this point is
      float m = smoothstep(-s, s, e); seen += m;
      float d = m * (.3 + 1.0 * uB[i].z) * (.5 + .5 * body) * (1. - .5 * uB[i].w * vein) * (.45 + .55 * c);
      if (hard) d = m * (.3 + 1.0 * uB[i].z) * (.7 + 1.1 * smoothstep(0., .5, e));   // and pools: thickest away from the edge
      float rim = exp(-pow((e - s - .03) / (s * .5 + .04), 2.)) * (1. - wet);
      d += uGain.y * uFx.y * uD[i].y * rim * (.8 + 1.3 * uB[i].z);
      if (med < 1.5) d *= max(0., 1. + uGain.x * (fibre ? max(uD[i].x, .7) * 2.6 : uD[i].x * 1.9) * (.5 - th));   // granulation: more pigment in the low points of paper and stone, and between a sheet's fibres
      if (glass) R *= thru(uK[i], uS[i], d); else R = lay(R, uK[i], uS[i], d);
      float b = part(br, i);
      if (b > .004){ float bt = glass ? 1. : smoothstep(.07, .34, b + uGain.z * (stone ? 1.1 : fibre ? .9 : .6) * (th - .5)), bd = b * bt * 1.7 * (.3 + uB[i].z); seen += b * bt;   // brushed paint, caught by the tooth
        if (glass) R *= thru(uK[i], uS[i], bd); else R = lay(R, uK[i], uS[i], bd); }
    } else {
      float d = c * (.25 + 1.25 * uB[i].z) * (.3 + .9 * body) * (1. - uB[i].w * vein);
      if (med > 4.5 && med < 5.5) d = c * (.3 + 1.1 * uB[i].z) * (.25 + 1.9 * n * n);   // smoke: soft, no veins
      if (med > 5.5 && med < 7.5) d = c * c * (.3 + 1.5 * uB[i].z) * (.04 + 2.3 * body * body * body) * (1. - .6 * uB[i].w * vein);   // light: bright where the pigment is thick, dark between
      d += 1.3 * part(br, i) * (.3 + uB[i].z);   // brushed paint not yet carried off
      if (wet) for (int j = 0; j < 4; j++) logmix[j] += d * uKS[i * 4 + j];
      acc += d * uLin[i]; tot += d;
    }
  }
  // the reaction's product, where linked elements have met: a pigment of its own, with its own pattern, laid where the pigments themselves show
  float pm = uGain.w * (.25 + .75 * uFx.w) * smoothstep(.16, .5 + 1.4 * uFx.z, texture2D(uProd, uv).r);
  if (powder){ float gd = length(in01 - .5); return mix(grain, uLin[4], .35 * pm * step(.5, gr2)) * (1. - .5 * smoothstep(.28, .62, gd)) * (var > .5 && var < 1.5 ? 1. + .5 * step(.93, gr2) : 1.); }
  if (med < 3.5){ float pd = pm * smoothstep(.3, 1.3, seen) * .6 * max(0., 1. + uGain.x * 1.7 * (.5 - th));
    if (glass) R *= thru(uK[4], uS[4], pd); else R = lay(R, uK[4], uS[4], pd);
    if (uInk.a > .5 && layered){ float w0 = texture2D(uWrite, uv).r, wk = 0., reach = fibre ? .0035 * (.4 + 1.2 * th) : .0012;   // written ink: it feathers along the fibres
      for (int k = -3; k <= 3; k++) wk += texture2D(uWrite, uv + vec2(float(k) * reach, 0.)).r;
      R = lay(R, uK[5], uS[5], 1.7 * max(w0, .75 * wk / 7.) * max(.25, 1. + (fibre ? 1.8 : .6) * (.5 - th))); }
    if (metal){ float bare = 1. - .8 * smoothstep(0., .8, seen), hx = .5 + .4 * uEnv.y, hy = .5 + .4 * uEnv.z;   // metal: a highlight in the plate's own tint, which moves as the plate tilts; paint dulls it
      float spec = exp(-pow((uv.x - hx) / .17, 2.)) * (.45 + 1.1 * th) + .35 * exp(-pow((uv.y - hy) / .3, 2.)) * th;
      R = R * (.62 + .3 * bare * th) + bare * spec * B * 1.15; }
    if (glass) R += .1 * smoothstep(.75, 1., vn(uv * vec2(2.2, 5.) + 4.)) * (1. - .5 * smoothstep(0., 1., seen));   // glass: a soft glare
    if (ice){ float cr = 1. - smoothstep(0., .012, abs(vn(at * 7. + 1.2 * vn(at * 3.)) - .5)), rimf = smoothstep(.2, 0., min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y)));   // ice: cracks, and frost toward the edge
      R = mix(R, vec3(.93, .97, 1.), .32 * cr + .45 * rimf * fbm(at * 40., .6)); }
  } else {
    if (med > 5.5 && med < 7.5) acc += pm * smoothstep(0., .5, tot) * uLin[4];                 // on light the product is one more light
    R = blendBy(med, B, acc, logmix, tot, min(1., area));
    if (med < 5.5) R = mix(R, uLin[4], .7 * pm * smoothstep(0., .5, tot));
    if (melt) R += vec3(.5, .16, .01) * smoothstep(.45, .9, fbm(q * 5. + 9., .6)) * exp(-tot * 1.5);   // the melt gives off its own light where no pigment covers it
    if (med > 7.5) R = mix(R, uLin[4], .35 * pm * smoothstep(0., .5, sum));
    if (med > 6.5 && med < 7.5){ vec2 px = uv * vec2(60. * uAspect, 60.); float sx = fract(px.x) * 3.;   // screen: red, green and blue cells with a dark line between rows; a lit cell spills a little into the next
      vec3 mask = vec3(step(sx, 1.), step(1., sx) * step(sx, 2.), step(2., sx)); R = R * (.34 + 2.3 * mask) * smoothstep(.0, .12, fract(px.y)) * smoothstep(1., .88, fract(px.y)); }
  }
  return R;
}`;
