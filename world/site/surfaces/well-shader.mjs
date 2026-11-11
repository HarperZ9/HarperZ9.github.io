// well-shader.mjs: the well's picture, one fragment shader with two grounds.
//
// PAPER (uFx.x = 1). A light paper with a height field, its tooth. Every element is a wash of pigment with a
// thickness; the washes lie in the order the elements were chosen, first lowest, and the reaction's product lies
// on top. Each wash is a Kubelka-Munk layer (see km.mjs: absorption K, scattering S, reflectance and transmittance)
// and the layers composite on the paper by the Kubelka-Munk layering formula, so an overlap shows both washes and
// a hue of its own. Three things move the thickness:
//   edge       where a wash ends, pigment gathers in a rim as it dries (uFx.y is how dry); the rim is strong for
//              an element with hard measured edges and absent where the wash met a wet neighbour, where the edge
//              is wider and softer instead
//   tooth      pigment settles into the paper's low points (granulation), by the element's roughness slope
//   body       the element's own grain, from its measured wave length, angle, strength and coverage, as before
// DARK WATER (uFx.x = 0). The earlier look: pigments as coloured bodies on dark water, mixed by the geometric
// mean of their reflectances; the product is drawn in its own colour.
// uFlatOn = 1 is a probe for tests: four flat layers of the thicknesses in uFlat on untextured paper.
export const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
export const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uDye, uDisp, uProd;
uniform vec3 uGround, uPaper, uLin[5], uK[5], uS[5];   // slot 4 is the reaction's product
uniform vec4 uA[4], uB[4], uC[4], uD[4];   // A: feature frequency, cos, sin, stretch. B: octave gain, gradient width, coverage, vein strength. C: rows, slot seed, on, unused. D: granulation, rim, bleed, unused
uniform vec4 uFx, uGain, uFlat;            // Fx: paper, dry, product softness, mean link strength. Gain: granulation, rim, tooth, product (1 each; tests set one to 0)
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
vec3 enc(vec3 lin){ lin = clamp(lin, 0., 1.); return mix(12.92 * lin, 1.055 * pow(lin, vec3(1. / 2.4)) - .055, step(.0031308, lin)); }
void main(){
  if (uFlatOn > .5){ vec3 R = uPaper;
    R = lay(R, uK[0], uS[0], uFlat.x); R = lay(R, uK[1], uS[1], uFlat.y); R = lay(R, uK[2], uS[2], uFlat.z); R = lay(R, uK[3], uS[3], uFlat.w);
    gl_FragColor = vec4(enc(R), 1.); return; }
  vec2 uv = vec2(v.x, 1. - v.y);
  vec4 dye = texture2D(uDye, uv), dsp = texture2D(uDisp, uv);
  vec2 q = uv - (dsp.xy - .5) * .6; q.x *= uAspect;
  float paper = uFx.x, sum = dye.r + dye.g + dye.b + dye.a;
  // the paper's tooth: a height from 0 (a low point) to 1, fixed to the sheet
  vec2 pq = vec2(uv.x * uAspect, uv.y) * 120.;
  float th = .5 * vn(pq) + .3 * vn(pq * 2.1 + 9.) + .2 * vn(pq * 4.3 + 31.);
  vec3 R = uPaper * (1. + uGain.z * .16 * (th - .5)), logmix = vec3(0.); float tot = 0., seen = 0.;
  for (int i = 0; i < 4; i++){
    if (uC[i].z < .5) continue;
    float c = i == 0 ? dye.r : i == 1 ? dye.g : i == 2 ? dye.b : dye.a;
    // the element's own grain: turned to its measured wave angle, drawn out along it by the wave's strength
    vec2 p = vec2(dot(q, uA[i].yz), dot(q, vec2(-uA[i].z, uA[i].y))); p.y /= uA[i].w; p = p * uA[i].x + uC[i].y;
    vec2 warp = vec2(fbm(p + 3.1, .5), fbm(p + 7.7, .5)) - .5;          // marbling: the grain is folded through itself
    float n = fbm(p + 1.6 * warp, uB[i].x);
    float rows = uC[i].x > 1.5 ? .09 * sin(6.2831853 * uC[i].x * uv.y) : 0.;
    float body = smoothstep(.5 - uB[i].y, .5 + uB[i].y, n + rows + (uB[i].z - .45) * .5);   // thick and thin pigment; the gradient is the edge softness
    float vein = 1. - smoothstep(0., .07, abs(fract(n * 6.) - .5));     // fine lines where the pigment parts
    if (paper > .5){
      float wet = smoothstep(.06, .5, sum - c);                         // another pigment is here: wet into wet
      float s = clamp(uB[i].y * .6, .02, .22) * (1. + 2.2 * wet * uD[i].z);
      float e = c * (.3 + 1.05 * uB[i].z) + (n + rows - .5) * .62 - .4;   // how far inside the wash's edge this point is
      float m = smoothstep(-s, s, e); seen += m;
      float d = m * (.3 + 1.0 * uB[i].z) * (.5 + .5 * body) * (1. - .5 * uB[i].w * vein) * (.45 + .55 * c);
      float rim = exp(-pow((e - s - .03) / (s * .5 + .04), 2.)) * (1. - wet);
      d += uGain.y * uFx.y * uD[i].y * rim * (.8 + 1.3 * uB[i].z);
      d *= max(0., 1. + uGain.x * uD[i].x * 1.9 * (.5 - th));           // granulation: more pigment in the low points
      R = lay(R, uK[i], uS[i], d);
    } else {
      float d = c * (.25 + 1.25 * uB[i].z) * (.3 + .9 * body) * (1. - uB[i].w * vein);
      logmix += d * log(max(uLin[i], vec3(.004))); tot += d;
    }
  }
  // the reaction's product, where linked elements have met: a pigment of its own, with its own pattern, laid where the washes themselves show
  float pm = uGain.w * (.25 + .75 * uFx.w) * smoothstep(.16, .5 + 1.4 * uFx.z, texture2D(uProd, uv).r);   // softer for soft-edged pairs
  if (paper > .5) R = lay(R, uK[4], uS[4], pm * smoothstep(.3, 1.3, seen) * .6 * max(0., 1. + uGain.x * 1.7 * (.5 - th)));
  else { R = uGround;
    if (tot > .0002) R = mix(uGround, exp(logmix / tot), 1. - exp(-tot * 2.4));   // subtractive: the geometric mean of the reflectances, by amount
    R = mix(R, uLin[4], .7 * pm * smoothstep(.0, .5, tot)); }
  gl_FragColor = vec4(enc(R), 1.);
}`;
