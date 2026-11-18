// Masses: trees, grass and placeholder architecture, all instances of five unit meshes.
// A unit mesh spans x and z from -0.5 to 0.5 and y from 0 to 1. An instance gives it a place,
// a turn, a size, a taper toward the top, a colour and a kind:
//   0 plain   1 building (lit windows at night)   2 glowing   3 tree (sways, takes snow)   4 grass
//   5 plant (industrial structure: small work lamps all over it at night)

struct MOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) col: vec3f,
  @location(3) @interpolate(flat) kind: f32,
  @location(4) @interpolate(flat) base: vec3f,
  @location(5) local: vec3f,
}

@vertex fn vsMass(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) p0: vec4f, @location(3) p1: vec4f, @location(4) p2: vec4f) -> MOut {
  let s = mix(1.0, p1.w, pos.y);
  var l = vec3f(pos.x * s * p1.x, pos.y * p1.y, pos.z * s * p1.z);
  let kind = p2.w;
  if (kind > 2.5) {
    // wind: the top leans and shivers
    let sway = (sin(F.cam.w * (0.7 + F.wx.z) + p0.x * 0.05 + p0.z * 0.07) * 0.5 + sin(F.cam.w * 2.3 + p0.x) * 0.15) * F.wx.z;
    l.x += sway * pos.y * pos.y * p1.y * 0.12;
  }
  let c = cos(p0.w); let sn = sin(p0.w);
  let w = vec3f(l.x * c + l.z * sn, l.y, -l.x * sn + l.z * c) + p0.xyz;
  var o: MOut;
  o.wp = w;
  o.clip = F.viewProj * vec4f(w, 1.0);
  o.n = vec3f(nrm.x * c + nrm.z * sn, nrm.y, -nrm.x * sn + nrm.z * c);
  o.col = p2.rgb;
  o.kind = kind;
  o.base = p0.xyz;
  o.local = l;
  return o;
}

@fragment fn fsMass(v: MOut) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  let n = normalize(v.n);
  var col = v.col;
  let seed = hash21(v.base.xz * 0.37);
  if (v.kind > 2.5) { col *= 0.75 + 0.5 * seed; col *= 0.55 + 0.45 * clamp(v.local.y / 6.0, 0.0, 1.0); }
  // snow settles on what faces up where it is cold
  let cold = smoothstep(-0.6, -2.2, warmth(v.wp));
  var snow = cold * smoothstep(0.25, 0.7, n.y);
  if (v.kind > 2.5) { snow = cold * smoothstep(-0.2, 0.6, n.y) * 0.6; }
  col = mix(col, vec3f(0.86, 0.89, 0.95), snow);
  col *= 1.0 - 0.3 * F.wx.w * (1.0 - snow);
  let ndl = max(dot(n, F.key.xyz), 0.0);
  var lit = col * (F.amb.rgb * (0.6 + 0.4 * n.y) + F.keyCol.rgb * F.key.w * ndl);
  lit += col * F.ev.w * vec3f(0.7, 0.75, 0.9);
  let night = F.misc.x;
  if (v.kind > 0.5 && v.kind < 1.5 && abs(n.y) < 0.4) {
    // windows: a grid of 3.2 m floors and 3 m bays; a few are lit, and a lit one keeps its own hue
    let t = normalize(vec3f(-n.z, 0.0, n.x));
    let bay = floor(dot(v.wp - v.base, t) / 3.0);
    let flr = floor((v.wp.y - v.base.y) / 3.2);
    let cell = vec2f(bay + seed * 91.0, flr + seed * 57.0);
    let pick = hash21(cell);
    let inBay = step(0.25, fract(dot(v.wp - v.base, t) / 3.0)) * step(fract(dot(v.wp - v.base, t) / 3.0), 0.75);
    let inFlr = step(0.3, fract((v.wp.y - v.base.y) / 3.2)) * step(fract((v.wp.y - v.base.y) / 3.2), 0.8);
    let on = step(pick, 0.035 + 0.05 * night) * inBay * inFlr;
    var hue = F.lamp.rgb;
    let odd = hash21(cell + 13.0);
    if (odd > 0.86) { hue = vec3f(0.45, 1.0, 0.7); }
    if (odd > 0.95) { hue = vec3f(0.55, 0.7, 1.0); }
    lit += hue * on * (0.02 + 2.6 * night);
    // by day a window is a darker pane
    lit *= 1.0 - 0.10 * inBay * inFlr * (1.0 - night);
  }
  if (v.kind > 4.5) {
    // work lamps: one to a 5 m cell on about half the cells, white, mercury green or sodium
    let q = (v.wp - v.base) / 5.0;
    let cell = floor(q + vec3f(seed * 7.0));
    let f = fract(q) - 0.5;
    let pick = hash31(cell);
    let spot = smoothstep(0.22, 0.05, length(f)) * step(pick, 0.45);
    var hue = vec3f(0.95, 0.97, 1.0);
    if (pick < 0.15) { hue = vec3f(0.45, 1.0, 0.62); } else if (pick < 0.27) { hue = vec3f(1.0, 0.6, 0.2); }
    lit += hue * spot * (0.05 + 5.0 * night);
    lit += v.col * F.lamp.rgb * 0.5 * night;       // the structure itself catches its own lamps
  }
  if (v.kind > 1.5 && v.kind < 2.5) {
    lit += v.col * (0.6 + 3.0 * night) * (0.8 + 0.2 * sin(F.cam.w * 3.0 + seed * 20.0));
  }
  return vec4f(toneMap(inAir(lit, v.wp)), 1.0);
}
