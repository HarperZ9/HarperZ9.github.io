// fractal3d-de.js: distance estimators for the 3D fractal renderer (fractal3d-pro.js).
//
// Each formula is GLSL ES 3.00. The escape-time family (Mandelbox, Mandelbulb, Amazing Surf) is
// written as one step, step_<name>(inout vec3 z, inout float dr, vec3 c), so a hybrid can apply a
// different formula on each iteration, as Mandelbulber's hybrid sequences do. Menger and the
// pseudo-Kleinian have their own loops and stand alone.
//
// Sources, as the formulas are written here:
//   Mandelbox: Tom Lowe (2010); scalar DE after Rudi Chen / Hvidtfeldt (Syntopia, "Distance
//     estimated 3D fractals", parts V and VI, 2011): box fold, sphere fold, z = s z + c,
//     dr = dr |s| + 1, DE = |z| / |dr|.
//   Mandelbulb: White and Nylander (2009), triplex power in spherical coordinates;
//     dr = p r^(p-1) dr + 1, DE = 0.5 ln(r) r / dr.
//   Amazing Surf: the Mandelbox with its box fold on two axes only (a surface-like variant from
//     the Mandelbulber formula set); the same scalar DE.
//   Menger sponge: Inigo Quilez, "Menger fractal" (iquilezles.org): the box, minus the repeated
//     crosses of each level, by max().
//   Pseudo-Kleinian: Knighty's estimator (fractalforums, 2011): box fold, inversion by
//     max(k / |z|^2, 1), and a closing distance from the xy-radius.

export const DE_GLSL = `
uniform float u_boxScale;     // Mandelbox scale
uniform float u_boxFold;      // fold limit
uniform float u_minR2;        // inner sphere-fold radius squared
uniform float u_fixedR2;      // outer sphere-fold radius squared
uniform float u_power;        // Mandelbulb power
uniform vec3  u_kSize;        // pseudo-Kleinian box size
uniform float u_kInv;         // pseudo-Kleinian inversion strength
uniform float u_mScale;       // Menger scale

void sphereFold(inout vec3 z, inout float dr) {
  float r2 = dot(z, z);
  if (r2 < u_minR2) { float t = u_fixedR2 / u_minR2; z *= t; dr *= t; }
  else if (r2 < u_fixedR2) { float t = u_fixedR2 / r2; z *= t; dr *= t; }
}
void step_box(inout vec3 z, inout float dr, vec3 c) {
  z = clamp(z, -u_boxFold, u_boxFold) * 2.0 - z;
  sphereFold(z, dr);
  z = u_boxScale * z + c;
  dr = dr * abs(u_boxScale) + 1.0;
}
void step_surf(inout vec3 z, inout float dr, vec3 c) {
  z.xy = clamp(z.xy, -u_boxFold, u_boxFold) * 2.0 - z.xy;
  sphereFold(z, dr);
  z = u_boxScale * z + c;
  dr = dr * abs(u_boxScale) + 1.0;
}
void step_bulb(inout vec3 z, inout float dr, vec3 c) {
  float r = max(length(z), 1e-9);
  float theta = acos(clamp(z.z / r, -1.0, 1.0)) * u_power;
  float phi = atan(z.y, z.x) * u_power;
  dr = pow(r, u_power - 1.0) * u_power * dr + 1.0;
  z = pow(r, u_power) * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + c;
}

// Quilez's Menger sponge: the unit box, with the cross-shaped holes of each level carved out by
// a max() against the distance to the level's repeated cross.
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float de_menger(vec3 p, int iters, out float trap) {
  float d = sdBox(p, vec3(1.0));
  float s = 1.0;
  trap = 1e10;
  for (int m = 0; m < 8; m++) {
    if (m >= iters) break;
    vec3 a = mod(p * s, 2.0) - 1.0;
    s *= u_mScale;
    vec3 r = abs(1.0 - u_mScale * abs(a));
    float da = max(r.x, r.y), db = max(r.y, r.z), dc = max(r.z, r.x);
    float c = (min(da, min(db, dc)) - 1.0) / s;
    if (c > d) { d = c; trap = min(trap, dot(a, a)); }
  }
  if (trap > 1e9) trap = dot(p, p);
  return d;
}

float de_kleinian(vec3 p, int iters, out float trap) {
  float k = 1.0;
  trap = 1e10;
  for (int i = 0; i < 24; i++) {
    if (i >= iters) break;
    p = 2.0 * clamp(p, -u_kSize, u_kSize) - p;
    float f = max(u_kInv / dot(p, p), 1.0);
    p *= f;
    k *= f;
    trap = min(trap, dot(p, p));
  }
  float rxy = length(p.xy);
  return max(rxy - 0.92784, abs(rxy * p.z) / length(p)) / k;
}
`;

/**
 * The scene's de(p) for a formula or a hybrid sequence. seq is a list of step names
 * ("box", "bulb", "surf"); a single name is an ordinary formula. Returns GLSL defining
 * float de(vec3 p) and the running orbit trap g_trap.
 */
export function buildDE(kind, seq) {
  if (kind === "menger") return `float g_trap; float de(vec3 p) { return de_menger(p, u_iterations, g_trap); }`;
  if (kind === "kleinian") return `float g_trap; float de(vec3 p) { return de_kleinian(p, u_iterations, g_trap); }`;
  const steps = (seq && seq.length ? seq : [kind === "mandelbulb" ? "bulb" : kind === "surf" ? "surf" : "box"]).slice(0, 4);
  const onlyBulb = steps.every((s) => s === "bulb");
  const call = (s) => `step_${s === "bulb" ? "bulb" : s === "surf" ? "surf" : "box"}(z, dr, p);`;
  const pick = steps.length === 1 ? call(steps[0])
    : `int s = i - (i / ${steps.length}) * ${steps.length};\n      ${steps.map((s, k) => `${k ? "else " : ""}if (s == ${k}) ${call(s)}`).join("\n      ")}`;
  // A pure Mandelbulb escapes at r > 2 and takes the log estimate; anything with a fold takes the
  // linear one, and a hybrid with a bulb step stops at r = 100 before the power overflows.
  return `float g_trap;
float de(vec3 p) {
  vec3 z = p;
  float dr = 1.0;
  g_trap = 1e10;
  for (int i = 0; i < 40; i++) {
    if (i >= u_iterations) break;
    ${onlyBulb ? "if (dot(z, z) > 4.0) break;" : steps.includes("bulb") ? "if (dot(z, z) > 1e4) break;" : "if (dot(z, z) > 1e6) break;"}
    ${pick}
    g_trap = min(g_trap, dot(z, z));
  }
  float r = length(z);
  return ${onlyBulb ? "0.5 * log(max(r, 1e-9)) * r / dr" : "r / abs(dr)"};
}`;
}
