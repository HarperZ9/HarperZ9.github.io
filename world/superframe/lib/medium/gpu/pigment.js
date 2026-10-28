// pigment.js: spectral pigment for the top view, so a coloured pour mixes band by band as it does in the side view
// (lib/medium/spectral.mjs). A pour with props.color (a hex colour, or a 16-band reflectance spectrum) or
// props.absorbS (16 absorbances) is its own element, "pigment": it carries its amount in the dye field's fourth
// channel and its absorbance spectrum, times the amount, in four RGBA textures (bands 0 to 3, 4 to 7, 8 to 11,
// 12 to 15). Its law is Beer-Lambert per band: absorbances add where pours overlap, and the transmittance
// exp(-3.9 D) filters the ground's spectrum. The ground under it is lifted to a spectrum with spectral.mjs's
// three-basis upsampling (exact in RGB under D65) and the product projected once with the CIE observer.
import { BANDS, spectrumRGB, rgbToSpectrum, absorbance, absorbanceOf } from "../spectral.mjs";

// the projection as two 16 x 3 matrices: PM[b] is the linear RGB of band b alone (under D65, white-normalised), and
// BM[b] is band b of the spectrum of unit linear red, green and blue. Both are linear, so the shader applies them
// per pixel: spectrum_b = max(0, BM[b] . rgb), rgb' = sum_b PM[b] * spectrum_b * T_b.
export function bandMatrices(illum = "D65") {
  const PM = new Float32Array(BANDS * 3), BM = new Float32Array(BANDS * 3);
  const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((c) => rgbToSpectrum(c));
  for (let b = 0; b < BANDS; b++) {
    const e = new Array(BANDS).fill(0); e[b] = 1;
    PM.set(spectrumRGB(e, illum), b * 3);
    BM.set([basis[0][b], basis[1][b], basis[2][b]], b * 3);
  }
  return { PM, BM };
}

const cache = new Map();
// the absorbance spectrum a pour carries (spectral.mjs units: reflectance = exp(-3.9 A))
export function absorbS(p) {
  if (Array.isArray(p.absorbS) && p.absorbS.length === BANDS) return Float32Array.from(p.absorbS);
  if (Array.isArray(p.color) && p.color.length === BANDS) return Float32Array.from(absorbance(p.color));
  if (typeof p.color === "string") { if (!cache.has(p.color)) cache.set(p.color, Float32Array.from(absorbanceOf(p.color))); return cache.get(p.color); }
  return null;
}
export const isPigment = (p) => !!(p && (p.absorbS || p.color));

const HEAD = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;`;

// advection of the four band textures: the same back-trace, capillary spread and rinse as the pours (shaders.js)
export const ADVECT_SPEC = `${HEAD}
uniform sampler2D uVel, uSrc; uniform vec2 uSimTexel; uniform float uDt, uShift, uRinse, uSpread;
void main(){
  vec2 uv = vUv - vec2(0., uShift);
  vec2 back = uv - uDt * texture(uVel, uv).xy * uSimTexel;
  vec4 s = texture(uSrc, back);
  vec2 t2 = uSimTexel * .5;
  vec4 nb = .25 * (texture(uSrc, back + vec2(t2.x, 0)) + texture(uSrc, back - vec2(t2.x, 0)) + texture(uSrc, back + vec2(0, t2.y)) + texture(uSrc, back - vec2(0, t2.y)));
  float aR = .12 * uSpread;
  if (aR > .004) s = mix(s, nb, aR);
  if (uRinse > 0.) s *= exp(-uRinse * uDt);
  if (uv.y < 0. || uv.y > 1.) s = vec4(0.);
  o = s; }`;

// splat of one band group: kind 6 (pigment) adds amount x gauss x its absorbance for these four bands
export const SPLAT_SPEC = `${HEAD}
uniform sampler2D uSrc; uniform int uN; uniform vec4 uP[16]; uniform vec4 uV[16]; uniform vec4 uS[16]; uniform float uAspect;
void main(){
  vec4 s = texture(uSrc, vUv);
  for (int i = 0; i < 16; i++) { if (i >= uN) break;
    vec4 P = uP[i]; if (int(P.w) != 6) continue;
    vec2 d = vUv - P.xy; d.x *= uAspect;
    float g = exp(-dot(d, d) / (P.z * P.z));
    s += uV[i].z * g * uS[i]; }
  o = s; }`;

// display: GLSL pasted into display.js after the tide line. c is the ground so far (display-encoded), d the dye
// sample, wu the warped lookup, feather, fib and dried as computed there.
export const SPECTRAL_GLSL = `
uniform sampler2D uS0, uS1, uS2, uS3; uniform int uSpecOn; uniform float uGrainS; uniform vec3 uPM[16], uBM[16];
vec3 spectralPour(vec3 c, vec4 d, vec2 wu, vec2 pc, float feather, float fib, float dried, float clr){
  if (uSpecOn == 0 || d.a < .002) return c;
  vec4 s0 = texture(uS0, wu), s1 = texture(uS1, wu), s2 = texture(uS2, wu), s3 = texture(uS3, wu);
  float D[16] = float[16](s0.x, s0.y, s0.z, s0.w, s1.x, s1.y, s1.z, s1.w, s2.x, s2.y, s2.z, s2.w, s3.x, s3.y, s3.z, s3.w);
  float gS = fbm(pc * .02 + 70.), grainS = mix(1., .55 + .45 * gS * gS * 1.8, uGrainS);   // opts.grain 0: an even body, for checks
  float eS = d.a + feather * .2 + fib * .05;
  float sS = d.a + feather * .2, wS = fwidth(sS) * 1.3 + .002;
  float rimS = (1. - smoothstep(0., wS, abs(sS - .2))) * dried;
  // the density laid is the amount poured (D already carries it); grain and the fibrous margin modulate it
  float sh = (grainS * (.6 + .4 * smoothstep(.04, .3, eS)) + rimS * .6) * clr;
  vec3 lin = L_(c), outc = vec3(0.);
  for (int b = 0; b < 16; b++) outc += uPM[b] * max(0., dot(uBM[b], lin)) * exp(-3.9 * D[b] * sh);
  return G_(outc); }
`;
