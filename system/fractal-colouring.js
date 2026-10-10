// fractal-colouring.js: the colouring algorithms every 2D fractal program shares.
//
// A program iterates, then hands its orbit statistics to colourize(). Which statistic picks the
// colour is the colouring mode, chosen at draw time by a uniform, so switching modes does not
// recompile anything:
//
//   0  Smooth iteration count (Quilez / van Nieuwpoort), with relief and the cross-trap glow: the
//      Studio's original look, and the default.
//   1  Distance estimation. d = |z| log|z| / |dz/dc| is the distance to the set (Milnor; Thurston),
//      measured here in pixels. The palette runs on log2 d, and pixels nearer the set than one
//      pixel fade toward black, so filaments thinner than a pixel still print as lines.
//   2  Point trap: the orbit's closest approach to a point P (Pickover's "stalks" and their kin).
//   3  Line trap: the closest approach to a line through P at an angle.
//   4  Cross trap: the closest approach to either axis, as its own colouring.
//   5  Image trap: the last orbit point that lands in a square around P picks a texel of an image.
//   6  Triangle inequality average (Kerry Mitchell, 2000): the mean over the orbit of
//      (|z_n| - m) / (M - m), where m = | |z_{n-1}^2| - |c| | and M = |z_{n-1}^2| + |c| bound
//      |z_n| by the triangle inequality. The last two partial means are blended by the smooth
//      iteration fraction, so the result is continuous.
//   7  Histogram equalisation: a first pass writes mu, the CPU builds the cumulative histogram of
//      the frame, and the palette runs on that, so every colour covers an equal share of the frame.
//
// Everything is in linear light; the palette ramp is the shared OKLab spline (RAMP_LIB), and the
// final encode is ENCODE_LIB's. The CPU twin of each mode is colourizeCPU() below.

export const COLOUR_MODES = ["smooth", "distance", "trap-point", "trap-line", "trap-cross", "trap-image", "tia", "histogram"];
export const MODE_INDEX = Object.fromEntries(COLOUR_MODES.map((m, i) => [m, i]));
// Mode 8 is internal: the first histogram pass, which writes mu instead of a colour.
export const MODE_MU_OUT = 8;

// Per-orbit statistics and their update, pasted into each program before its loop.
export const ORBIT_GLSL = `
uniform int   u_colourMode;
uniform vec2  u_trapP;        // trap point (and the line's anchor, the image's centre)
uniform vec2  u_trapDir;      // unit direction of the line trap
uniform float u_trapSize;     // half the side of the image trap's square
uniform float u_density;      // palette cycles per unit of the mode's statistic
uniform float u_offset;       // palette phase, in stops (colour cycling moves it)
uniform sampler2D u_trapImg;  // image trap texture
uniform sampler2D u_cdf;      // histogram equalisation table, 1024 x 1 RGBA8 (24-bit values)
uniform vec2  u_muRange;      // the mu range the table covers
float o_point, o_line, o_cross, o_tia, o_tiaPrev, o_tiaN, o_imgHit;
float o_deg;                   // the map's degree: TIA bounds |z_n| by |z_{n-1}|^d and |c|
vec2  g_z;                     // the escaped z, set by the program before colourize()
vec2  o_imgUV;
void orbitInit() {
  o_point = 1e20; o_line = 1e20; o_cross = 1e20; o_tia = 0.0; o_tiaPrev = 0.0; o_tiaN = 0.0; o_imgHit = 0.0; o_imgUV = vec2(0.0);
  o_deg = 2.0;
}
// z is the new iterate, zp the one before, c the parameter.
void orbitStep(vec2 z, vec2 zp, vec2 c) {
  vec2 d = z - u_trapP;
  o_point = min(o_point, dot(d, d));
  o_line  = min(o_line, abs(d.x * u_trapDir.y - d.y * u_trapDir.x));
  o_cross = min(o_cross, min(abs(z.x), abs(z.y)));
  // The last landing, not the first: early iterates barely differ across a zoomed view, so a
  // first-hit trap painted one texel over the whole frame.
  if (abs(d.x) < u_trapSize && abs(d.y) < u_trapSize) { o_imgHit = 1.0; o_imgUV = d / (2.0 * u_trapSize) + 0.5; }
  float zp2 = pow(length(zp), o_deg), cl = length(c);
  float lo = abs(zp2 - cl), hi = zp2 + cl;
  if (hi - lo > 1e-12) { o_tiaPrev = o_tia; o_tiaN += 1.0; o_tia += ((length(z) - lo) / (hi - lo) - o_tia) / o_tiaN; }
}
`;

// The final colour, from the statistics and the shared smooth count. grad is the direction relief
// shades from; dePx the distance estimate in pixels (negative when the program has none).
export const COLOURIZE_GLSL = `
vec4 packMu(float mu) {
  float v = clamp(mu * 256.0, 0.0, 16777215.0);
  float b2 = floor(v / 65536.0), b1 = floor((v - b2 * 65536.0) / 256.0), b0 = v - b2 * 65536.0 - b1 * 256.0;
  return vec4(b2, b1, b0, 255.0) / 255.0;
}
float cdfBin(float i) {
  vec4 s = texture2D(u_cdf, vec2((i + 0.5) / 1024.0, 0.5)) * 255.0;
  return (s.r * 65536.0 + s.g * 256.0 + s.b) / 16777215.0;
}
// The table is 24-bit values packed in bytes, which filtering would scramble, so it is read with
// nearest sampling and interpolated here: without it the 1024 steps printed as contour bands.
float cdfAt(float mu) {
  float t = clamp((mu - u_muRange.x) / max(u_muRange.y - u_muRange.x, 1e-6), 0.0, 1.0) * 1023.0;
  float i = floor(t);
  return mix(cdfBin(i), cdfBin(min(i + 1.0, 1023.0)), t - i);
}
vec3 colourize(float mu, float shade, float dePx, vec3 glow) {
  int m = u_colourMode;
  if (m == 1) {
    if (dePx < 0.0) return ramp(mu / 8.0 * u_density + u_offset) * shade + glow;
    float l = log2(max(dePx, 1e-6));
    return ramp(l * 0.6 * u_density + u_offset) * shade * smoothstep(0.0, 1.0, dePx);
  }
  // Trap distances span many decades between the orbits that graze the trap and those that pass
  // wide, so the palette runs on their logarithm; a linear map spent the whole palette on the
  // near misses and left the frame one dark colour.
  if (m == 2) return ramp(-log2(sqrt(o_point) + 1e-6) * 0.75 * u_density + u_offset) * shade;
  if (m == 3) return ramp(-log2(o_line + 1e-6) * 0.75 * u_density + u_offset) * shade;
  if (m == 4) return ramp(-log2(o_cross + 1e-6) * 0.75 * u_density + u_offset) * shade;
  if (m == 5) {
    if (o_imgHit > 0.5) return srgbDecode(texture2D(u_trapImg, vec2(o_imgUV.x, 1.0 - o_imgUV.y)).rgb);
    return ramp(mu / 8.0 * u_density + u_offset) * shade * 0.35;
  }
  if (m == 6) {
    // Mitchell's interpolation: the fraction of the last step the orbit spent inside the bailout
    // radius (R = 256 here), 1 + log2(ln R / ln|z|), blends the mean without the last term
    // into the mean with it.
    float f = clamp(1.0 + log2(5.5451774 / max(log(length(g_z)), 1e-6)), 0.0, 1.0);
    float t = mix(o_tiaPrev, o_tia, f);
    return ramp(t * 12.0 * u_density + u_offset) * shade;
  }
  if (m == 7) return ramp(cdfAt(mu) * float(u_palN) * u_density + u_offset) * shade;
  return ramp(mu / 8.0 * u_density + u_offset) * shade + glow;
}
`;

// sRGB decode for the image trap's texels (IEC 61966-2-1).
export const DECODE_GLSL = `
vec3 srgbDecode(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
`;

/** The colouring settings of a view, with defaults. */
export function colourSettings(view) {
  const c = view.colouring || {};
  const angle = (c.trapAngle ?? 30) * Math.PI / 180;
  return {
    mode: MODE_INDEX[c.mode] ?? 0,
    trapP: [c.trapX ?? 0, c.trapY ?? 0],
    trapDir: [Math.cos(angle), Math.sin(angle)],
    trapSize: c.trapSize ?? 0.25,
    density: c.density ?? 1,
    offset: c.offset ?? 0,
    image: c.image || null,
  };
}
