// What the ground is made of at walking distance. Each surface gives a colour, a bump height in
// metres, a roughness and a gloss; ground.wgsl layers them by slope, cover, wetness and wear.
// `det` is 1 under the walker and 0 where a grain is smaller than a pixel: every surface eases to
// its own mean colour there, so nothing shimmers.

struct Mat { c: vec3f, h: f32, r: f32, g: f32 }

fn mixMat(a: Mat, b: Mat, t: f32) -> Mat {
  // the higher surface wins where two meet: stones stand out of soil, moss fills the cracks
  let k = clamp((t - 0.5) * 1.6 + 0.5 + (b.h - a.h) * 9.0 * (1.0 - abs(t * 2.0 - 1.0)), 0.0, 1.0);
  return Mat(mix(a.c, b.c, k), mix(a.h, b.h, k), mix(a.r, b.r, k), mix(a.g, b.g, k));
}

// fallen needles and leaves: rust under conifers, umber, ochre and rot under birch
fn litterMat(p: vec2f, broad: f32, det: f32) -> Mat {
  let big = fbm(p * 0.35);
  let st = vnoise(p * 31.0) * 0.6 + vnoise(vec2f(p.x * 17.0 - p.y * 23.0, p.x * 23.0 + p.y * 17.0)) * 0.4;
  let twig = voro(p * 2.3 + big);
  var needle = mix(vec3f(0.060, 0.042, 0.030), vec3f(0.125, 0.078, 0.045), big) * (0.82 + 0.36 * st * det);
  needle *= 1.0 - 0.55 * det * (1.0 - smoothstep(0.0, 0.035, twig.y)) * step(0.6, twig.z);
  // leaves lie over one another at every angle: two sets of cells, the upper hiding the lower in places
  let v1 = voro(p * 11.0 + big * 2.0); let v2 = voro(vec2f(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8) * 15.0 + 9.0);
  var v = v1; if (v2.z > 0.45) { v = v2; }
  var leaf = mix(vec3f(0.095, 0.064, 0.038), vec3f(0.215, 0.140, 0.062), v.z);
  if (v.z > 0.90) { leaf = vec3f(0.30, 0.215, 0.07); }
  if (v.z < 0.2) { leaf = vec3f(0.045, 0.036, 0.028); }
  let edge = smoothstep(0.0, 0.07, v.y);
  leaf = mix(vec3f(0.125, 0.085, 0.045), leaf * (0.72 + 0.28 * edge) * (0.85 + 0.3 * st), det);
  let c = mix(needle, leaf, broad);
  let h = mix(st * 0.004, edge * (1.0 - v.x) * 0.014, broad) * det;
  return Mat(c, h + 0.006, 0.9, 0.02);
}

// moss cushions: the one deep green the land keeps
fn mossMat(p: vec2f, det: f32) -> Mat {
  let v = voro(p * 3.1);
  let cushion = 1.0 - v.x * v.x;
  let fuzz = vnoise(p * 64.0);
  var c = mix(vec3f(0.030, 0.052, 0.016), vec3f(0.098, 0.135, 0.034), cushion * 0.55 + 0.45 * fbm(p * 0.9));
  c *= 0.86 + 0.28 * fuzz * det;
  return Mat(c, cushion * 0.05 + fuzz * 0.004 * det + 0.012, 0.97, 0.0);
}

fn soilMat(p: vec2f, det: f32) -> Mat {
  let n = fbm(p * 1.7);
  let g = vnoise(p * 45.0);
  return Mat(mix(vec3f(0.050, 0.040, 0.032), vec3f(0.095, 0.074, 0.055), n) * (0.85 + 0.3 * g * det), g * 0.004 * det, 0.85, 0.03);
}

// a gravel road: stones a thumb across, a few a fist across
fn gravelMat(p: vec2f, det: f32) -> Mat {
  let v = voro(p * 26.0);
  let w = voro(p * 8.0 + 5.3);
  var tone = 0.55 + 0.9 * v.z;
  var c = vec3f(0.150, 0.142, 0.134) * tone;
  if (v.z > 0.72) { c *= vec3f(1.12, 0.98, 0.84); }
  c *= 0.45 + 0.55 * smoothstep(0.0, 0.12, v.y);
  c = mix(vec3f(0.135, 0.128, 0.120), c, det);
  let big = step(0.84, w.z) * (1.0 - smoothstep(0.0, 0.42, w.x));
  c = mix(c, vec3f(0.20, 0.195, 0.19) * (0.7 + 0.5 * w.z), big * det);
  return Mat(c, ((1.0 - v.x) * 0.011 + big * 0.035) * det, 0.8, 0.04);
}

// rock: beds, cracks, lichen
fn rockMat(p: vec3f, det: f32) -> Mat {
  let bed = sin(p.y * 7.0 + fbm(p.xz * 0.3) * 6.0);
  let cr = voro(p.xz * 1.7 + p.y * 0.8);
  var c = mix(vec3f(0.115, 0.115, 0.122), vec3f(0.215, 0.208, 0.200), fbm(p.xz * 2.0 + p.y)) * (0.9 + 0.1 * bed);
  c *= 0.4 + 0.6 * smoothstep(0.0, 0.07, cr.y);
  let li = smoothstep(0.60, 0.70, vnoise(p.xz * 3.1 + 9.0)) * det;
  c = mix(c, vec3f(0.30, 0.32, 0.25), li * 0.7);
  c = mix(c, vec3f(0.42, 0.29, 0.08), smoothstep(0.80, 0.84, vnoise(p.xz * 5.3)) * det * 0.6);
  return Mat(c, cr.y * 0.10 + bed * 0.012 + 0.03, 0.75, 0.03);
}

// turf and heath under the blades: the cover's own colour, tufted
fn turfMat(p: vec2f, base: vec3f, det: f32) -> Mat {
  let v = voro(p * 5.0);
  let t = vnoise(p * 30.0);
  let c = base * (0.62 + 0.5 * (1.0 - v.x) * det + 0.2 * (1.0 - det)) * (0.9 + 0.2 * t * det);
  return Mat(c, (1.0 - v.x) * 0.03 * det, 0.95, 0.0);
}

// poured concrete in bays, stained by what ran across it
fn concreteMat(p: vec2f, det: f32) -> Mat {
  let bay = abs(fract(p / 4.2) - 0.5);
  let joint = 1.0 - smoothstep(0.004, 0.012, 0.5 - max(bay.x, bay.y));
  let n = fbm(p * 0.7);
  let stain = smoothstep(0.5, 0.8, fbm(vec2f(p.x * 0.33, p.y * 1.9) + 4.0));
  let cr = voro(p * 0.9 + n);
  var c = vec3f(0.185, 0.180, 0.172) * (0.78 + 0.44 * n) * (0.92 + 0.16 * vnoise(p * 70.0) * det);
  c = mix(c, c * vec3f(0.5, 0.42, 0.36), stain * 0.6);
  c *= 1.0 - 0.6 * joint * det - 0.45 * det * (1.0 - smoothstep(0.0, 0.012, cr.y)) * step(0.55, cr.z);
  return Mat(c, 0.01 - joint * 0.008, 0.78, 0.05);
}

fn asphaltMat(p: vec2f, det: f32) -> Mat {
  let g = vnoise(p * 110.0);
  let patchy = fbm(p * 0.6);
  let c = vec3f(0.030, 0.031, 0.034) * (0.75 + 0.6 * g * det) * (0.8 + 0.5 * patchy);
  return Mat(c, g * 0.002 * det, 0.72, 0.06);
}

// setts: squared stones in rows, dirt in the joints
fn settMat(p: vec2f, det: f32) -> Mat {
  let row = floor(p.y / 0.16);
  let q = vec2f(p.x / 0.24 + 0.5 * (row - 2.0 * floor(row / 2.0)), p.y / 0.16);
  let f = abs(fract(q) - 0.5);
  let id = hash21(floor(q));
  let top = smoothstep(0.5, 0.36, max(f.x, f.y));
  var c = mix(vec3f(0.10, 0.10, 0.105), vec3f(0.21, 0.20, 0.19), id) * (0.35 + 0.65 * top);
  c = mix(vec3f(0.13, 0.128, 0.125), c, det);
  return Mat(c, top * 0.014 * det, 0.6, 0.08);
}

// Snow in three ages. age 0: new, bright, soft. 0.5: packed by wind or feet, rippled, greyer.
// 1: old, grey, pitted and granular, wet at its edges in a thaw.
fn snowMat(p: vec2f, age: f32, det: f32) -> Mat {
  let drift = fbm(p * 0.45);
  let fine = vnoise(p * 9.0);
  let newC = vec3f(0.86, 0.89, 0.94);
  // wind-packed: ripples across the wind, a crust that breaks in plates
  let rip = sin((p.x * 0.8 + p.y * 0.6) * 5.0 + drift * 9.0) * 0.5 + 0.5;
  let plate = voro(p * 1.4 + drift);
  let packC = vec3f(0.70, 0.73, 0.78) * (0.9 + 0.1 * rip) * (0.88 + 0.12 * smoothstep(0.0, 0.05, plate.y));
  // old: sun cups and grit
  let cup = voro(p * 4.5);
  let grit = step(0.93, vnoise(p * 40.0)) * det;
  let oldC = vec3f(0.44, 0.45, 0.47) * (0.75 + 0.35 * cup.x) * (1.0 - 0.45 * grit);
  let a = clamp(age * 2.0, 0.0, 1.0); let b = clamp(age * 2.0 - 1.0, 0.0, 1.0);
  let c = mix(mix(newC, packC, a), oldC, b);
  let h = mix(mix(drift * 0.10 + fine * 0.004, drift * 0.05 + rip * 0.012 * det, a), drift * 0.03 + cup.x * 0.03 * det, b);
  return Mat(c, h, mix(mix(0.95, 0.7, a), 0.45, b), mix(mix(0.02, 0.06, a), 0.22, b));
}
