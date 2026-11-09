// WGSL twin of scene.mjs (the pixel-art diorama) and of the OKLab styling in probe.mjs.
export const SCENE_WGSL = /* wgsl */ `
fn sbox(p: vec3f, c: vec3f, b: vec3f) -> f32 { let q = abs(p - c) - b; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
fn ssph(p: vec3f, c: vec3f, r: f32) -> f32 { return length(p - c) - r; }
fn scyl(p: vec3f, cx: f32, cz: f32, y0: f32, y1: f32, r: f32) -> f32 { return max(length(vec2f(p.x - cx, p.z - cz)) - r, abs(p.y - (y0 + y1) / 2.0) - (y1 - y0) / 2.0); }
// x: distance, y: material, z: object
fn scene_map(p: vec3f) -> vec3f {
  var r = vec3f(p.y, 0.0, 0.0);
  let pond = max(length(vec2f(p.x - 2.2, (p.z - 1.6) * 1.4)) - 0.9, abs(p.y + 0.02) - 0.03); if (pond < r.x) { r = vec3f(pond, 1.0, 1.0); }
  let walls = sbox(p, vec3f(-1.0, 0.8, -0.6), vec3f(1.2, 0.8, 0.9)); if (walls < r.x) { r = vec3f(walls, 2.0, 2.0); }
  let rx = (p.x + 1.0) * 0.7071 + (p.y - 1.6) * 0.7071; let ry = -(p.x + 1.0) * 0.7071 + (p.y - 1.6) * 0.7071;
  let roof = max(sbox(vec3f(rx, ry, p.z), vec3f(0.0, 0.0, -0.6), vec3f(0.95, 0.95, 1.05)), -p.y + 1.6); if (roof < r.x) { r = vec3f(roof, 3.0, 3.0); }
  let door = sbox(p, vec3f(-0.5, 0.45, 0.32), vec3f(0.22, 0.45, 0.04)); if (door < r.x) { r = vec3f(door, 4.0, 4.0); }
  let win = sbox(p, vec3f(-1.45, 0.95, 0.32), vec3f(0.25, 0.2, 0.03)); if (win < r.x) { r = vec3f(win, 5.0, 5.0); }
  let trunk = scyl(p, 1.9, -1.2, 0.0, 1.1, 0.13); if (trunk < r.x) { r = vec3f(trunk, 6.0, 6.0); }
  let leaves = min(ssph(p, vec3f(1.9, 1.5, -1.2), 0.62), ssph(p, vec3f(2.25, 1.15, -0.95), 0.42)); if (leaves < r.x) { r = vec3f(leaves, 7.0, 7.0); }
  let body = scyl(p, 0.6, 1.0, 0.0, 0.62, 0.16); if (body < r.x) { r = vec3f(body, 8.0, 8.0); }
  let head = ssph(p, vec3f(0.6, 0.78, 1.0), 0.13); if (head < r.x) { r = vec3f(head, 9.0, 9.0); }
  let post = scyl(p, 0.2, 1.75, 0.0, 0.9, 0.035); if (post < r.x) { r = vec3f(post, 10.0, 10.0); }
  let lamp = sbox(p, vec3f(0.2, 0.98, 1.75), vec3f(0.08, 0.09, 0.08)); if (lamp < r.x) { r = vec3f(lamp, 11.0, 11.0); }
  let rock = ssph(p, vec3f(-2.3, 0.15, 1.4), 0.38) + 0.04 * sin(p.x * 9.0) * sin(p.z * 7.0); if (rock < r.x) { r = vec3f(rock, 12.0, 12.0); }
  return r;
}
fn albedo(m: i32) -> vec3f {
  var A = array<vec3f, 13>(vec3f(0.17, 0.32, 0.1), vec3f(0.08, 0.2, 0.32), vec3f(0.62, 0.5, 0.36), vec3f(0.45, 0.13, 0.09), vec3f(0.28, 0.16, 0.08), vec3f(1.0, 0.8, 0.4),
    vec3f(0.25, 0.15, 0.08), vec3f(0.1, 0.3, 0.09), vec3f(0.15, 0.22, 0.45), vec3f(0.75, 0.55, 0.42), vec3f(0.1, 0.1, 0.1), vec3f(1.0, 0.75, 0.35), vec3f(0.4, 0.4, 0.42));
  return A[m];
}
fn scene_normal(p: vec3f) -> vec3f {
  let e = 1e-3;
  return normalize(vec3f(scene_map(p + vec3f(e, 0.0, 0.0)).x - scene_map(p - vec3f(e, 0.0, 0.0)).x,
    scene_map(p + vec3f(0.0, e, 0.0)).x - scene_map(p - vec3f(0.0, e, 0.0)).x, scene_map(p + vec3f(0.0, 0.0, e)).x - scene_map(p - vec3f(0.0, 0.0, e)).x));
}
// x: t, y: material, z: object; t < 0 for a miss.
fn scene_march(o: vec3f, r: vec3f, tMax: f32) -> vec3f {
  var t = 0.0;
  for (var i = 0; i < 160 && t < tMax; i++) {
    let h = scene_map(o + r * t);
    if (h.x < 1e-3 * (1.0 + t)) { return vec3f(t, h.y, h.z); }
    t += h.x * 0.9;
  }
  return vec3f(-1.0, -1.0, -1.0);
}
const SUN = vec3f(-0.4523, 0.8041, 0.402);
fn sun_dir() -> vec3f { return normalize(vec3f(-0.45, 0.8, 0.4)); }
fn sky_col(r: vec3f) -> vec3f { let k = max(0.0, r.y); return vec3f(0.85 - 0.6 * k, 0.82 - 0.4 * k, 0.78 + 0.1 * k); }
fn shade_point(p: vec3f, n: vec3f, m: i32) -> vec3f {
  if (m == 5) { return albedo(5) * 1.6; } if (m == 11) { return albedo(11) * 4.0; }
  var alb = albedo(m);
  if (m == 0) { if (((i32(floor(p.x * 2.0)) + i32(floor(p.z * 2.0))) & 1) == 0) { alb = alb * 0.86; } }
  let L = sun_dir(); let sh = scene_march(p + L * 0.02, L, 12.0);
  let sun = max(0.0, dot(n, L)) * select(0.0, 1.0, sh.x < 0.0) * 2.6;
  let skyF = (0.55 + 0.45 * n.y) * 0.55;
  let lv = vec3f(0.2, 0.98, 1.75) - p; let ld = length(lv); let lan = max(0.0, dot(n, lv) / ld) * 1.2 / (ld * ld + 0.2);
  return alb * (sun * vec3f(1.0, 0.93, 0.8) + skyF * vec3f(0.6, 0.75, 1.0) + lan * vec3f(1.0, 0.7, 0.35));
}
fn to_oklab(c: vec3f) -> vec3f {
  let l = pow(0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z, 1.0 / 3.0);
  let m = pow(0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z, 1.0 / 3.0);
  let s = pow(0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z, 1.0 / 3.0);
  return vec3f(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
fn from_oklab(c: vec3f) -> vec3f {
  let l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z; let m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z; let s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  let l = l_ * l_ * l_; let m = m_ * m_ * m_; let s = s_ * s_ * s_;
  return vec3f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
fn stylise(rgb: vec3f, bands: f32, dL: f32) -> vec3f {
  let lab = to_oklab(max(rgb, vec3f(0.0)));
  let Lq = clamp(floor((lab.x + dL) * bands + 0.5) / bands, 0.0, 1.0);
  return max(from_oklab(vec3f(Lq, lab.y, lab.z)), vec3f(0.0));
}
fn face_dir(f: u32, u: f32, v: f32) -> vec3f {
  switch (f) { case 0u: { return vec3f(1.0, -v, -u); } case 1u: { return vec3f(-1.0, -v, u); } case 2u: { return vec3f(u, 1.0, v); }
    case 3u: { return vec3f(u, -1.0, -v); } case 4u: { return vec3f(u, -v, 1.0); } default: { return vec3f(-u, -v, -1.0); } }
}
`;
