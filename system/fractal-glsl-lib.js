// fractal-glsl-lib.js: the shared GLSL library the Studio's GPU fractal programs are assembled from.
//
// Everything here is a string; nothing in this file touches a GL context. Each export is a self
// contained block of GLSL that BOTH precision variants paste verbatim, so the two programs cannot
// drift apart in how they colour, shade or encode a pixel. fractal-glsl.js assembles them into whole
// fragment shaders; fractal-gl.js compiles and runs those.
//
// The image recipe MIRRORS fractal.js so the GPU frame reads the same as the gated CPU reference:
// bailout R=256, smooth (normalized) iteration count (Quilez/van Nieuwpoort), a cross orbit trap
// blended toward the palette's lightest stop at 30%, the palette cycled at mu/8, Catmull-Rom
// interpolation between stops in LINEAR light, Lambert relief from the escape-orbit derivative, and
// a triangular dither on the way to 8 bits.

export const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// Compile-time ceiling on the GLSL escape loop (WebGL1 needs a constant loop bound). The actual
// iteration count is the u_maxIter uniform, clamped JS-side to [1, MAX_ITERS]. 2000 matches the
// deepest CPU preset (Seahorse Deep / Period-2 Minibrot) so GPU detail keeps up at depth.
export const MAX_ITERS = 2000;

// Bailout R=256 (R^2=65536), same as fractal.js BAILOUT, required for the smooth-coloring formula.
export const BAILOUT2 = 65536.0;

// -- Deep zoom: emulated double precision -------------------------------------------------------
// A float32 mantissa is 24 bits, so near |c| ~ 1 the smallest representable step is 2^-24 ~ 6e-8.
// The "Seahorse Deep" preset frames 6.25e-6 of the complex plane across ~1600 pixels, a step of
// 3.9e-9 per pixel, roughly 15x FINER than float32 can represent. Every 15 neighbouring pixels
// therefore collapse onto the same coordinate and the image goes blocky (measured before this fix:
// 105 distinct x-coordinates across a 512px view). The iteration has the same problem: z reaches
// magnitude ~1, so per-pixel differences below 6e-8 vanish inside the loop too.
//
// The fix is "double-single" (df64) arithmetic: carry each real number as an UNEVALUATED SUM of two
// float32s (hi + lo), giving ~48 mantissa bits, about 14 decimal digits. The primitives are Knuth's
// two-sum and Dekker's two-product, in the GPU form given by Thall, "Extended-Precision
// Floating-Point Numbers for GPU Computation" (2006).
//
// THE CATCH, measured on this hardware rather than assumed: compensated arithmetic works by keeping
// the rounding error that a plain add throws away, and every step of it is an algebraic no-op that
// an optimizer is delighted to delete. ANGLE/D3D11 on an RTX 4090 folds `t1 = a + b; e = t1 - a`
// straight back to `e = b`, confirmed by a shader where the increment was small enough to be
// swallowed entirely (`t1 == a`) and yet `e == b` still came back true, which is only possible if
// the subtraction never happened. Written naively, df64 compiles down to exactly the float32 program
// it was meant to replace, silently.
//
// So every foldable identity here is routed through dsBar(), a multiply by a uniform that always
// holds 1.0. Multiplying by exactly 1.0 is exact in IEEE754, so the numbers are untouched; the
// compiler simply cannot prove the identity any more and has to emit the subtraction. The check that
// this still holds on a given GPU is fractal-precision-probe.js, and the receipts are in
// project-docs/2026-08-03-fractal-precision.md.
export const DS_LIB = `
const float DS_SPLIT = 8193.0;          // 2^13 + 1, Dekker's split constant for a 24-bit mantissa

uniform float u_one;                    // always exactly 1.0; opaque to the shader compiler

// Optimizer barrier. Numerically the identity function; algebraically a wall, because the compiler
// cannot know u_one is 1.0 and so cannot simplify across it. Wrap the operand whose repetition makes
// a compensation step foldable, never the result, or the compensation is lost anyway.
float dsBar(float x) { return x * u_one; }

// Exact sum of two df numbers (Knuth two-sum + the low-order terms).
// dsBar(t1) stops the (t1 - a.x) step collapsing to b.x, which would discard the whole correction.
vec2 dsAdd(vec2 a, vec2 b) {
  float t1 = a.x + b.x;
  float e  = dsBar(t1) - a.x;
  float t2 = ((b.x - e) + (a.x - (dsBar(t1) - e))) + (a.y + b.y);
  float hi = t1 + t2;
  return vec2(hi, t2 - (dsBar(hi) - t1));
}

// Product of two df numbers. Dekker split each hi into two 12-bit halves so the partial products
// are exact in float32, then reassemble with the cross terms. The splits are the most fragile step:
// the split is an identity in exact arithmetic and only survives because of the rounding inside it,
// so the inner occurrence of cona goes through the barrier.
vec2 dsMul(vec2 a, vec2 b) {
  float cona = a.x * DS_SPLIT;
  float conb = b.x * DS_SPLIT;
  float a1   = cona - (dsBar(cona) - a.x);
  float b1   = conb - (dsBar(conb) - b.x);
  float a2   = a.x - a1;
  float b2   = b.x - b1;
  float c11  = a.x * b.x;
  float c21  = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));
  float c2   = a.x * b.y + a.y * b.x;
  float t1   = c11 + c2;
  float e    = dsBar(t1) - c11;
  float t2   = a.y * b.y + ((c2 - e) + (c11 - (dsBar(t1) - e))) + c21;
  float hi   = t1 + t2;
  return vec2(hi, t2 - (dsBar(hi) - t1));
}

// |a| for a df number: negating both limbs negates the represented sum exactly.
vec2 dsAbs(vec2 a) { return a.x < 0.0 ? -a : a; }
`;

// -- Palette ramp -------------------------------------------------------------------------------
// The stops arrive from palToFloats() already converted to OKLab (Ottosson, 2020), so the spline
// below runs in a perceptual space and ramp() hands back linear light at the end.
//
// Which space the ramp interpolates in is the single biggest call in this file, and it is not the
// same call as the rest of the pipeline. Relief and the trap glow act on radiance because they model
// light. A palette does not: it is six colours a person picked by eye, and the gradient between them
// is meant to be read. Interpolating those as radiance spends most of the distance near the bright
// end, which turned the segment wrapping from the lightest stop back to the darkest one, a full
// sixth of every cycle, into a pale neutral band. On ember it measured #bcbdb3 where the authored
// palette implies #867e78, and the effect was strongest on exactly the wide smooth fields where a
// flat wash is most visible. OKLab holds both hue and lightness across that span.
//
// Interpolation is a cyclic Catmull-Rom spline (Catmull and Rom, 1974) instead of a straight line,
// so the ramp is C1 continuous through every stop. Piecewise-linear leaves a slope discontinuity AT
// each stop, and because the smooth-iteration field sweeps the ramp many times across one frame,
// those six kinks print as six visible facets per cycle. The spline removes them without moving the
// stops themselves. Overshoot is left alone in the two chroma axes, where it reads as a small
// saturation lift, and clipped in L, where it would mean a lightness below black.
//
// Shared verbatim by both precision variants so the two programs colour identically.
export const RAMP_LIB = `
// OKLab -> linear sRGB. Only this direction is needed on the GPU; the stops are converted once per
// frame on the CPU. Components are clipped at zero because a spline through OKLab can leave the sRGB
// gamut, and negative radiance has no meaning downstream.
vec3 oklabToLinear(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  vec3 lms = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
  return max(vec3(
     4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z), vec3(0.0));
}

// WebGL1 forbids dynamic indexing of a uniform array, so the fetch is a branch ladder.
vec3 palStop(int i) {
  if (i == 0)      return u_pal[0];
  else if (i == 1) return u_pal[1];
  else if (i == 2) return u_pal[2];
  else if (i == 3) return u_pal[3];
  else if (i == 4) return u_pal[4];
  return u_pal[5];
}

vec3 ramp(float t) {
  t = mod(t, 6.0);
  if (t < 0.0) t += 6.0;
  int i = int(floor(t));
  float f = t - floor(t);
  int ia = i  == 0 ? 5 : i  - 1;
  int ic = i  == 5 ? 0 : i  + 1;
  int id = ic == 5 ? 0 : ic + 1;
  vec3 p0 = palStop(ia), p1 = palStop(i), p2 = palStop(ic), p3 = palStop(id);
  float f2 = f * f;
  float f3 = f2 * f;
  vec3 c = 0.5 * ((2.0 * p1)
                + (p2 - p0) * f
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * f2
                + (3.0 * p1 - p0 - 3.0 * p2 + p3) * f3);
  return oklabToLinear(vec3(max(c.x, 0.0), c.y, c.z));
}`;

// -- Relief from the escape-orbit derivative ----------------------------------------------------
// The escape-time field is a height field, and the derivative dz/dc of the orbit gives its gradient
// for free: u = z / dz points along the steepest ascent of the potential at the escape point, which
// is the analytic normal of the level surface (Cheritat's normal map, Munafo's distance-estimator
// shading). Lambert against a fixed light turns a flat colour wash into something with a lit side
// and a shaded side, which is what makes the filaments read as structure rather than as pattern.
//
// The result is a MULTIPLIER centred on 1.0, so mean exposure across the frame is unchanged and only
// local contrast is added. That matters here: the palette is the subject, and a shading term that
// also dimmed the image would quietly re-grade every preset.
//
// Shared verbatim by both precision variants (in the df64 program the derivative rides on the hi
// limbs in plain float32, which is ample: it only has to be accurate enough to point somewhere).
export const SHADE_LIB = `
const vec2  LIGHT   = vec2(-0.6246950, 0.7808688);   // unit vector; light from the upper left
const float LIGHT_H = 1.35;   // how far the light sits above the plane; larger reads flatter
const float RELIEF  = 0.42;   // shading depth

// The trap opacity is authored in DISPLAY code values, where 0.30 reads as a light veil over black.
// Radiance is not code value, so compositing that same 0.30 in linear light lands at roughly twice
// the weight it was drawn at: 0.30 of the radiance encodes to 0.58 of the code value. The tint is
// the palette's LIGHTEST stop, so the whole frame drifts toward it and every palette turns pastel.
// TRAP_GAMMA converts an authored display opacity into the radiance fraction that encodes back to
// it. Measured against the encoded blend it replaces, 2.2 lands within a couple of code values at
// full strength and falls off faster below it, which tightens the haze into a filament.
const float TRAP_GAMMA = 2.2;

float trapWeight(float a) { return pow(a, TRAP_GAMMA); }

vec2 cdiv(vec2 a, vec2 b) {
  float q = dot(b, b);
  return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / q;
}

float relief(vec2 z, vec2 dz) {
  float dd = dot(dz, dz);
  // Degrade to flat shading, never to a black pixel, if the derivative left the usable range. The
  // NaN case falls through the same way: the comparison is false, so the negation returns 1.0.
  if (!(dd > 1e-20 && dd < 1e20)) return 1.0;
  vec2 u = cdiv(z, dz);
  float ul = length(u);
  if (!(ul > 1e-20)) return 1.0;
  u /= ul;
  float t = clamp((dot(u, LIGHT) + LIGHT_H) / (1.0 + LIGHT_H), 0.0, 1.0);
  return mix(1.0 - RELIEF, 1.0 + RELIEF, t);
}

// Hue-preserving highlight hold. relief() multiplies by up to 1 + RELIEF, which on the bright end of
// a palette pushes a channel past 1.0, and letting each channel clip on its own drains the colour:
// ocean's lightest stop under a full highlight clips green and blue first and prints white, so the
// filaments that the shading was added to light up were exactly the ones losing their hue. Dividing
// the whole triple by its own maximum walks the colour back to the gamut boundary ALONG ITS OWN HUE
// instead, spending highlight headroom rather than saturation.
vec3 holdGamut(vec3 c) {
  float m = max(max(c.r, c.g), c.b);
  return m > 1.0 ? c / m : c;
}`;

// -- Output encode ------------------------------------------------------------------------------
// One place, at the very end, where linear radiance becomes display code values. Everything above
// this line is linear.
//
// The dither is not decoration. A WebGL1 default framebuffer is 8 bits per channel, and the dark end
// of these palettes spans very few code values over a large area: the ocean stops run 0x000810 to
// 0x002244 across a whole sixth of the cycle, so a smooth gradient there quantises into a handful of
// visible contour bands. A sub-LSB perturbation before quantisation converts that contour into noise
// the eye integrates back to the smooth original.
export const ENCODE_LIB = `
// sRGB opto-electronic transfer function (IEC 61966-2-1).
vec3 srgbEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// Interleaved gradient noise (Jimenez, "Next Generation Post Processing in Call of Duty: Advanced
// Warfare", SIGGRAPH 2014). Cheap, and its spectrum is far better behaved than a hash of the pixel.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Two independent samples subtracted give a TRIANGULAR distribution over one code value either way.
// Triangular rather than uniform because uniform dither leaves the residual error correlated with
// the signal, which is visible as band edges breathing; triangular decorrelates it.
vec3 encodeOut(vec3 linearRGB, vec2 frag) {
  vec3 srgb = srgbEncode(linearRGB);
  float d = (ign(frag) + ign(frag + vec2(23.0, 41.0)) - 1.0) / 255.0;
  vec3 outv = clamp(srgb + d, 0.0, 1.0);
  // A channel that is exactly zero keeps its dither off. Clamping a symmetric offset at zero makes
  // it one-sided, which prints faint speckle across the solid black interior: the largest flat
  // region in most frames, and the one most likely to show it.
  return mix(outv, vec3(0.0), step(linearRGB, vec3(0.0)));
}`;
