// What falls: snow and rain as 50,000 points in a box that travels with the walker. A flake
// drifts and wanders on the wind; a drop is a streak. Each takes the light of every lamp where
// it is, so the fall shows inside a lamp's reach and goes dark outside it: the lamp stands still
// and the weather moves through it. Nothing falls under a roof, and little under the crowns.

struct AOut {
  @builtin(position) clip: vec4f,
  @location(0) q: vec2f,
  @location(1) col: vec4f,
  @location(2) @interpolate(flat) half: f32,   // half the streak's length, in widths
}

@vertex fn vsAir(@builtin(vertex_index) vi: u32, @location(0) seed: vec4f) -> AOut {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let B = vec3f(34.0, 22.0, 34.0);
  let t = F.cam.w;
  let rain = seed.w * (F.wx.x + F.wx.y) < F.wx.x;
  let wind = vec3f(1.0, 0.0, 0.35) * F.wx.z;
  var vel = vec3f(wind.x * 2.6, -(0.85 + 0.75 * fract(seed.w * 7.0)), wind.z * 2.6);
  if (rain) { vel = vec3f(wind.x * 5.0, -8.0 - 2.5 * fract(seed.w * 7.0), wind.z * 5.0); }
  var p = seed.xyz * B + vel * t;
  if (!rain) {
    let ph = seed.w * 40.0;
    let wob = vec3f(sin(t * 0.9 + ph) * 0.3 + sin(t * 0.31 + seed.x * 20.0) * 0.55, sin(t * 1.3 + ph) * 0.08, cos(t * 0.7 + ph * 0.8) * 0.3 + cos(t * 0.27 + seed.z * 20.0) * 0.45);
    p += wob; vel += vec3f(cos(t * 0.9 + ph) * 0.27, 0.0, -sin(t * 0.7 + ph * 0.8) * 0.21);
  }
  p = F.cam.xyz + (fract(p / B - F.cam.xyz / B) - 0.5) * B;
  let nu = nearUV(p.xz);
  let na = textureSampleLevel(nearA, samp, nu.xy, 0.0) * nu.z;
  let ground = rasterAt(p.xz);
  var alive = step(ground, p.y);
  if (na.b > 0.75 && p.y < ground + 3.2) { alive = 0.0; }
  if (na.r > 0.6 && p.y < ground + 9.0 && fract(seed.w * 13.0) > 0.25) { alive = 0.0; }
  let c0 = F.viewProj * vec4f(p, 1.0);
  // the shutter is open a twenty-fifth of a second: a drop draws a line, a flake a short dash
  let c1 = F.viewProj * vec4f(p - vel * select(0.012, 0.035, rain), 1.0);
  let s0 = c0.xy / max(c0.w, 0.01);
  // a drop passing the lens has no far end to draw to: it is a point, and no streak is longer than 70 pixels
  var s1 = s0; if (c1.w > 0.3) { s1 = c1.xy / c1.w; }
  var along = (s1 - s0) * F.view.xy * 0.5;
  let la0 = max(length(along), 0.001);
  let la = min(la0, 70.0);
  s1 = s0 + (s1 - s0) * (la / la0);
  let dirv = along / la;
  let r = select(0.006 + 0.008 * fract(seed.w * 3.0), 0.004, rain);
  let px = r * F.view.y * 0.5 * F.viewProj[1][1] / max(c0.w, 0.05);
  let wide = max(px, 0.75);
  let dim = min(px / 0.75, 1.0);
  let off = dirv * (corner.x * (la * 0.5 + wide)) + vec2f(-dirv.y, dirv.x) * corner.y * wide;
  var o: AOut;
  o.clip = vec4f(((s0 + s1) * 0.5 + off * 2.0 / F.view.xy) * c0.w, c0.z, c0.w);
  o.half = (la * 0.5 + wide) / wide;
  o.q = vec2f(corner.x * o.half, corner.y);
  let light = F.amb.rgb * 1.3 + F.keyCol.rgb * F.key.w * 0.6 + lampLight(p, vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(1.0), 1.0, 0.0, 6.0) * 2.2 + F.ev.w * vec3f(0.7, 0.75, 0.9);
  let dist = distance(p, F.cam.xyz);
  let a = alive * dim * dim * smoothstep(0.8, 2.6, dist) * select(0.85, 0.5, rain) * wide / (la * 0.5 + wide);
  o.col = vec4f(light * select(0.8, 0.35, rain), a);
  if (c0.w < 0.05 || a <= 0.0) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); }
  return o;
}

@fragment fn fsAir(v: AOut) -> @location(0) vec4f {
  // a streak with round ends
  let d = length(vec2f(max(abs(v.q.x) - (v.half - 1.0), 0.0), v.q.y));
  let a = smoothstep(1.0, 0.25, d) * v.col.a;
  return vec4f(v.col.rgb * a, a * 0.55);
}
