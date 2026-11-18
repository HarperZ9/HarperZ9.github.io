// Shared by every pass of the world traversal: the frame block, the lamps, the maps, noise, the
// sky and the air, and the light model. x runs east, y up, z south; one unit is one metre.
// Every pass draws linear light into a float target; post.wgsl adds the fog volumes, the bloom
// and the film curve.

diagnostic(off, derivative_uniformity);

struct Frame {
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  cam: vec4f,       // position, time in seconds
  key: vec4f,       // direction to the light that shades the ground (sun, or moon at night), strength
  sun: vec4f,       // direction to the sun, disc strength
  moon: vec4f,      // direction to the moon, lit share
  zenith: vec4f,    // sky colour overhead, star amount
  horizon: vec4f,   // sky colour at the horizon, cloud cover
  fog: vec4f,       // air colour, density per metre at the fog base
  fogp: vec4f,      // fog base height, falloff per metre, cloud-sea top, cloud-sea density per metre
  wx: vec4f,        // rain, snow, wind, wetness
  ev: vec4f,        // aurora, halo, comet, lightning flash
  misc: vec4f,      // night 0..1, snow-line shift in degrees, exposure, storm
  keyCol: vec4f,    // colour of the key light
  amb: vec4f,       // ambient colour
  lamp: vec4f,      // the lamp hue of this place
  world: vec4f,     // width m, depth m, cell m, raster width
  glow: vec4f,      // colour of the glow round the sun, strength
  near: vec4f,      // the near maps: west edge m, north edge m, side m, 1 when baked
  snowp: vec4f,     // new snow depth m, thaw 0..1, dusting 0..1, old-snow share 0..1
  gfog: vec4f,      // ground fog density per m, thickness m, wisp share, lamp haze per m
  view: vec4f,      // target width, height, mirror level m, 1 when the mirror is drawn
  walk: vec4f,      // the walker: x, y, z, speed m/s
  trail: array<vec4f, 8>,   // where the walker has just been: x, y, z, how open the fog still is
  shadowVP: mat4x4f,
  shp: vec4f,       // 1 when the shadow map is drawn, texel size, depth bias, wind phase
  clip: vec4f,      // keep fragments above this height when y > 0.5; z: 1 in the mirror pass; w: 1 when drawing the sheet of far trees
}
struct Light { pos: vec4f, col: vec4f, dir: vec4f }   // place + reach; colour + sodium share; aim + cos of the cone (-1: all round)
struct Lights { n: vec4u, l: array<Light, 64> }

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<uniform> LS: Lights;
@group(0) @binding(2) var heightTex: texture_2d<f32>;   // ground, metres
@group(0) @binding(3) var waterTex: texture_2d<f32>;    // water surface, metres; -512 where dry
@group(0) @binding(4) var albTex: texture_2d<f32>;      // ground colour by cover, a = river
@group(0) @binding(5) var auxTex: texture_2d<f32>;      // normal x, normal z, canopy, built
@group(0) @binding(6) var samp: sampler;                // linear, clamped
@group(0) @binding(7) var nearA: texture_2d<f32>;       // round the walker, 1 m: canopy, broadleaf share, shelter, trunk
@group(0) @binding(8) var nearB: texture_2d<f32>;       // road, surface kind, height offset, wear
@group(0) @binding(9) var rsamp: sampler;               // linear, repeating, mipped
@group(0) @binding(10) var atlasTex: texture_2d<f32>;   // drawn foliage, lattice and bark cards
@group(0) @binding(11) var farTex: texture_2d<f32>;     // whole trees drawn once, for the far forest
@group(0) @binding(12) var mirrorTex: texture_2d<f32>;  // the world upside down in still water
@group(0) @binding(13) var shadowTex: texture_depth_2d;
@group(0) @binding(14) var shadowSamp: sampler_comparison;

const PI: f32 = 3.14159265;

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}
fn hash22(p: vec2f) -> vec2f {
  var q = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
fn hash31(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x), mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn vnoise3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(hash31(i), hash31(i + vec3f(1.0, 0.0, 0.0)), u.x), mix(hash31(i + vec3f(0.0, 1.0, 0.0)), hash31(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y);
  let b = mix(mix(hash31(i + vec3f(0.0, 0.0, 1.0)), hash31(i + vec3f(1.0, 0.0, 1.0)), u.x), mix(hash31(i + vec3f(0.0, 1.0, 1.0)), hash31(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y);
  return mix(a, b, u.z);
}
// Noise on an integer lattice with an integer hash: the walker's feet (data.mjs) compute the same
// function, so the ground the eye sees is the ground the walker stands on.
fn ihash(x: i32, y: i32) -> f32 {
  var h = (u32(x) * 0x9E3779B1u) ^ (u32(y) * 0x85EBCA77u);
  h ^= h >> 15u; h *= 0x2C1B3C6Du; h ^= h >> 12u; h *= 0x297A2D39u; h ^= h >> 15u;
  return f32(h) / 4294967296.0;
}
fn lnoise(p: vec2f) -> f32 {
  let i = vec2i(floor(p)); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ihash(i.x, i.y), ihash(i.x + 1, i.y), u.x), mix(ihash(i.x, i.y + 1), ihash(i.x + 1, i.y + 1), u.x), u.y);
}
// small relief the 64 m raster cannot hold: swells 16 m across, lumps 4 m across and hummocks a
// stride across, each faded out before the mesh gets too coarse to carry it
fn relief(xz: vec2f, dist: f32) -> f32 {
  return (lnoise(xz / 16.0) - 0.5) * 3.2 * (1.0 - smoothstep(700.0, 1600.0, dist))
    + (lnoise(xz / 4.0 + 50.0) - 0.5) * 0.6 * (1.0 - smoothstep(150.0, 420.0, dist))
    + (lnoise(xz / 1.3 + 90.0) - 0.5) * 0.16 * (1.0 - smoothstep(40.0, 110.0, dist));
}
fn fbm(p: vec2f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < 4; i++) { s += a * vnoise(q); q = vec2f(q.x * 0.8 - q.y * 0.6, q.x * 0.6 + q.y * 0.8) * 2.03 + 7.1; a *= 0.5; }
  return s;
}
// cells: distance to the nearest seed, gap to the second, and the seed's own number
fn voro(p: vec2f) -> vec3f {
  let i = floor(p); let f = fract(p);
  var d1 = 8.0; var d2 = 8.0; var id = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let g = vec2f(f32(x), f32(y)); let o = hash22(i + g);
    let d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = hash21(i + g + 17.0); } else if (d < d2) { d2 = d; }
  } }
  return vec3f(d1, d2 - d1, id);
}
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

// ---------------------------------------------------------------- the ground under a point
fn texel(c: vec2i) -> f32 {
  let s = vec2i(textureDimensions(heightTex));
  return textureLoad(heightTex, clamp(c, vec2i(0), s - vec2i(1)), 0).r;
}
fn rasterAt(xz: vec2f) -> f32 {
  let q = xz / F.world.z - 0.5; let i = vec2i(floor(q)); let f = fract(q);
  return mix(mix(texel(i), texel(i + vec2i(1, 0)), f.x), mix(texel(i + vec2i(0, 1)), texel(i + vec2i(1, 1)), f.x), f.y);
}
// the near maps cover a square round the walker; z is 0 outside it and eases in over 24 m
fn nearUV(xz: vec2f) -> vec3f {
  let uv = (xz - F.near.xy) / F.near.z;
  let e = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)) * F.near.z;
  return vec3f(uv, clamp(e / 24.0, 0.0, 1.0) * F.near.w);
}
// The ground as it is walked: raster, relief, and what roads and yards have done to it.
// data.mjs groundAt computes the same number.
fn groundAt(xz: vec2f, dist: f32) -> f32 {
  var y = rasterAt(xz);
  let built = textureSampleLevel(auxTex, samp, xz / F.world.xy, 0.0).a;
  let nu = nearUV(xz);
  let nb = textureSampleLevel(nearB, samp, nu.xy, 0.0);
  let road = nb.r * nu.z;
  y += relief(xz, dist) * (1.0 - built) * clamp(y, 0.0, 1.0) * (1.0 - 0.85 * smoothstep(0.15, 0.6, road));
  y += (nb.b - 0.50196) * 3.984375 * nu.z;
  return y;
}

// ---------------------------------------------------------------- sky and air
// The sky dome without discs and stars: what the air looks like in a direction.
fn skyBase(d: vec3f) -> vec3f {
  let up = clamp(d.y, -0.2, 1.0);
  let t = pow(1.0 - max(up, 0.0), 3.2);
  var c = mix(F.zenith.rgb, F.horizon.rgb, t);
  // the glow near the sun, flattened along the horizon
  let s = max(dot(d, F.sun.xyz), 0.0);
  let low = 1.0 - smoothstep(0.0, 0.5, abs(F.sun.y));
  c += F.glow.rgb * F.glow.a * (pow(s, 6.0) * 0.5 + pow(s, 40.0) * 0.8) * (0.4 + 0.6 * low) * (1.0 - 0.75 * F.horizon.a);
  // below the horizon the dome darkens into the far ground haze
  c = mix(c, F.fog.rgb, smoothstep(0.0, -0.12, d.y));
  return c;
}
// Air between the eye and a point: a fog that thins with height, plus a flat cloud deck that is
// dense below its top (the cloud sea) and absent above it. Far ground takes the sky's hue.
fn airAmount(p: vec3f) -> f32 {
  let d = p - F.cam.xyz; let dist = length(d);
  let b = F.fogp.y; let t = b * d.y;
  var k = 1.0;
  if (abs(t) > 0.001) { k = (1.0 - exp(-t)) / t; }
  var od = F.fog.a * exp(-b * max(F.cam.y - F.fogp.x, -200.0)) * dist * k;
  let top = F.fogp.z;
  if (top > 0.0) {
    let y0 = F.cam.y; let y1 = p.y; var frac = 0.0;
    if (y0 < top && y1 < top) { frac = 1.0; }
    else if (abs(d.y) > 0.01) { frac = clamp((top - min(y0, y1)) / abs(d.y), 0.0, 1.0); }
    od += F.fogp.w * dist * frac;
  }
  return 1.0 - exp(-od);
}
fn airColour(dir: vec3f) -> vec3f {
  let flat_dir = normalize(vec3f(dir.x, max(dir.y, 0.02), dir.z));
  return mix(F.fog.rgb, skyBase(flat_dir), 0.55);
}
fn inAir(col: vec3f, p: vec3f) -> vec3f {
  let a = airAmount(p);
  return mix(col, airColour(normalize(p - F.cam.xyz)), a);
}
// yearly mean temperature of a place in degrees, by the generator's own rule
fn warmth(p: vec3f) -> f32 {
  let v = clamp(p.z / F.world.y, 0.0, 1.0);
  return -3.0 + 16.5 * v - 5.0 * max(p.y, 0.0) / 1000.0 - 4.0 * max(0.35 - v, 0.0) / 0.35;
}
// how cold a place is for snow: 0 bare, 1 lying (never on the sheet of far trees, clip.w)
fn snowCold(p: vec3f) -> f32 {
  return smoothstep(-0.8, -2.4, warmth(p) + (fbm(p.xz * 0.0016) - 0.5) * 3.0) * (1.0 - F.clip.w);
}
// kept for the passes written before the float target: the film curve now runs once, in post
fn toneMap(c: vec3f) -> vec3f { return c; }

// ---------------------------------------------------------------- light
// the key light through the shadow map round the walker: 1 lit, 0 shaded
fn keyShadow(p: vec3f, n: vec3f) -> f32 {
  if (F.shp.x < 0.5) { return 1.0; }
  let q = F.shadowVP * vec4f(p + n * 0.12, 1.0);
  let uv = q.xy * vec2f(0.5, -0.5) + 0.5;
  var s = 0.0; let e = F.shp.y;
  for (var j = -1; j <= 1; j++) { for (var i = -1; i <= 1; i++) {
    s += textureSampleCompareLevel(shadowTex, shadowSamp, uv + vec2f(f32(i), f32(j)) * e, q.z + F.shp.z);
  } }
  let edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  return mix(1.0, s / 9.0, smoothstep(0.0, 0.06, edge));
}
// how much of lamp i reaches a point: direction to it, then strength by distance, reach and cone
fn lampReach(i: u32, p: vec3f) -> vec4f {
  let q = LS.l[i].pos.xyz - p; let d2 = dot(q, q); let r = LS.l[i].pos.w;
  if (d2 > r * r) { return vec4f(0.0); }
  let d = sqrt(d2); let l = q / max(d, 0.001);
  let w = 1.0 - d2 * d2 / (r * r * r * r);
  var a = w * w / (d2 + 0.6);
  let c = LS.l[i].dir.w;
  if (c > -0.5) { a *= smoothstep(c, mix(c, 1.0, 0.45), dot(-l, LS.l[i].dir.xyz)); }
  return vec4f(l, a);
}
// Every lamp on a surface. Sodium light carries value only: under it a surface keeps its
// brightness and loses its hue, and colour returns near a warm lamp (the sodium law).
// wrap > 0 lets light bend round the form (snow, leaves); gloss is the share that mirrors.
fn lampLight(p: vec3f, n: vec3f, v: vec3f, alb: vec3f, rough: f32, gloss: f32, wrap: f32) -> vec3f {
  var sum = vec3f(0.0);
  let a = max(rough * rough, 0.004); let a2 = a * a;
  for (var i = 0u; i < LS.n.x; i++) {
    let r = lampReach(i, p);
    if (r.w <= 0.0) { continue; }
    let ndl = clamp((dot(n, r.xyz) + wrap) / (1.0 + wrap), 0.0, 1.0);
    let col = LS.l[i].col.rgb;
    let seen = mix(alb, vec3f(lum(alb)), LS.l[i].col.a);
    var c = seen * ndl;
    if (gloss > 0.0) {
      let h = normalize(r.xyz + v); let nh = max(dot(n, h), 0.0);
      let d = a2 / (PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
      c += vec3f(min(d, 400.0) * gloss * max(dot(n, r.xyz), 0.0) * 0.25);
    }
    sum += col * c * r.w;
  }
  return sum;
}
// the surface a mirror pass must not draw: everything under the water plane
fn clipped(p: vec3f) -> bool { return F.clip.y > 0.5 && p.y < F.clip.x; }
