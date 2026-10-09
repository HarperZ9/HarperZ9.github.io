// WGSL for the Motion renderer. Written in the subset scripts/wgsl_to_hlsl.py
// documents where it can be; the vector pass loops over a per-band segment list
// and needs no texture, so a D3D12 port is mechanical.

// Vector paths: one instance per horizontal band of a path. The fragment walks
// the band's segments once, for the nonzero (or even-odd) winding number and
// the exact distance to the outline, and turns both into analytic coverage:
// fill = clamp(0.5 + signed distance / w), stroke = clamp(0.5 + (half width -
// distance) / w), where w is one pixel plus the defocus blur. No MSAA and no
// tessellation, so a shape can change every frame at no extra cost.
export const VECTOR_WGSL = /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
struct Inst { box: vec4f, fill: vec4f, stroke: vec4f, p: vec4f, list: vec4u, }
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var<storage, read> segs: array<vec4f>;
@group(0) @binding(3) var<storage, read> idx: array<u32>;
struct VO { @builtin(position) pos: vec4f, @location(0) @interpolate(flat) i: u32, }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VO {
  let b = inst[i].box;
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u));
  let p = mix(b.xy, b.zw, c);
  var o: VO;
  o.pos = vec4f(p.x * V.inv.x * 2.0 - 1.0, 1.0 - p.y * V.inv.y * 2.0, 0.0, 1.0);
  o.i = i;
  return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let I = inst[o.i];
  let p = o.pos.xy;
  var d = 1e9;
  var w = 0i;
  var crossings = 0u;
  for (var k = 0u; k < I.list.y; k = k + 1u) {
    let s = segs[idx[I.list.x + k]];
    let a = s.xy;
    let ab = s.zw - s.xy;
    let ap = p - a;
    let h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
    d = min(d, length(ap - ab * h));
    if ((a.y <= p.y) != (s.w <= p.y)) {
      let x = a.x + (p.y - a.y) * ab.x / ab.y;
      if (x > p.x) {
        if (s.w > a.y) { w = w + 1i; } else { w = w - 1i; }
        crossings = crossings + 1u;
      }
    }
  }
  let aa = 1.0 + 2.0 * I.p.y;
  var inside = w != 0i;
  if (I.p.z > 0.5) { inside = (crossings & 1u) == 1u; }
  var col = vec4f(0.0);
  if (I.fill.a > 0.0) {
    var sd = -d;
    if (inside) { sd = d; }
    col = I.fill * clamp(0.5 + sd / aa, 0.0, 1.0);
  }
  if (I.stroke.a > 0.0) {
    let hw = max(I.p.x, 0.5);
    let k = clamp(0.5 + (hw - d) / aa, 0.0, 1.0) * min(1.0, I.p.x * 2.0);
    col = I.stroke * k + col * (1.0 - I.stroke.a * k);
  }
  if (col.a <= 0.0005) { discard; }
  return col;
}`;

// Particles: positions are a pure function of time. Each particle moves from
// formation A to formation B with its own delay, plus a curl-like drift whose
// amplitude the scene sets, so a scrubbed frame is the same as a played one.
export const PARTICLE_WGSL = /* wgsl */ `
struct P { cam: vec4f, mixv: vec4f, look: vec4f, size: vec4f, }
// cam: scale (px per unit), offset x, offset y, unused
// mixv: t, spread (fraction of the run each particle's move takes), drift (units), time
// look: blur px, glow, count, seed
// size: radius px A, radius px B, opacity, unused
struct Part { a: vec2f, b: vec2f, ca: u32, cb: u32, k: f32, r: f32, }
@group(0) @binding(0) var<uniform> U: P;
@group(0) @binding(1) var<storage, read> parts: array<Part>;
@group(0) @binding(2) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> outc: array<vec4f>;
fn hash(n: u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}
fn ease(t: f32) -> f32 { let c = clamp(t, 0.0, 1.0); return c * c * c * (c * (c * 6.0 - 15.0) + 10.0); }
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= u32(U.look.z)) { return; }
  let q = parts[i];
  let start = q.k * (1.0 - U.mixv.y);
  let u = ease((U.mixv.x - start) / max(U.mixv.y, 1e-4));
  var pos = mix(q.a, q.b, u);
  let ph = hash(i ^ u32(U.look.w)) * 6.2831853;
  let tt = U.mixv.w;
  let lift = sin(u * 3.14159265);
  let amp = U.mixv.z * (0.35 + lift);
  pos = pos + amp * vec2f(sin(tt * 0.7 + ph + pos.y * 0.004), cos(tt * 0.6 + ph * 1.3 + pos.x * 0.004));
  let px = pos * U.cam.x + U.cam.yz;
  out[i] = vec4f(px, mix(U.size.x, U.size.y, u) * q.r, U.look.x);
  outc[i] = mix(unpack4x8unorm(q.ca), unpack4x8unorm(q.cb), u) * vec4f(1.0, 1.0, 1.0, U.size.z);
}`;

export const SPRITE_WGSL = /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> col: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) i: u32, }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VO {
  let q = pos[i];
  let r = q.z + q.w + 1.0;
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let p = q.xy + c * r;
  var o: VO;
  o.p = vec4f(p.x * V.inv.x * 2.0 - 1.0, 1.0 - p.y * V.inv.y * 2.0, 0.0, 1.0);
  o.uv = c * r;
  o.i = i;
  return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let q = pos[o.i];
  let d = length(o.uv);
  let aa = 1.0 + 2.0 * q.w;
  let k = clamp(0.5 + (max(q.z, 0.5) - d) / aa, 0.0, 1.0) * min(1.0, q.z * 2.0);
  let c = col[o.i];
  if (k * c.a <= 0.002) { discard; }
  return vec4f(c.rgb * c.a * k, c.a * k);
}`;

// Layers under the vectors: the Threads frame (a packed RGBA8 buffer at its own
// size, sampled bilinearly) or a Worlds frame (a texture).
export const LAYER_BUFFER_WGSL = /* wgsl */ `
struct L { dst: vec4f, src: vec4f, look: vec4f, }
// dst: target width, height; src: source width, height; look: opacity, unused
@group(0) @binding(0) var<uniform> U: L;
@group(0) @binding(1) var<storage, read> frame: array<u32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn px(x: i32, y: i32) -> vec4f {
  let w = i32(U.src.x);
  let h = i32(U.src.y);
  return unpack4x8unorm(frame[u32(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1))]);
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let s = q.xy / U.dst.xy * U.src.xy - 0.5;
  let f = fract(s);
  let b = vec2i(floor(s));
  let c = mix(mix(px(b.x, b.y), px(b.x + 1, b.y), f.x), mix(px(b.x, b.y + 1), px(b.x + 1, b.y + 1), f.x), f.y);
  return vec4f(c.rgb * U.look.x, U.look.x);
}`;

export const LAYER_TEXTURE_WGSL = /* wgsl */ `
struct L { dst: vec4f, src: vec4f, look: vec4f, }
@group(0) @binding(0) var<uniform> U: L;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  // look.y: defocus in source pixels, a 9-tap disc.
  let uv = q.xy / U.dst.xy;
  let r = U.look.y / U.src.xy;
  var c = textureSampleLevel(tex, smp, uv, 0.0).rgb;
  if (U.look.y > 0.25) {
    for (var k = 0; k < 8; k = k + 1) {
      let a = f32(k) * 0.785398;
      c = c + textureSampleLevel(tex, smp, uv + vec2f(cos(a), sin(a)) * r, 0.0).rgb;
    }
    c = c / 9.0;
  }
  return vec4f(c * U.look.x, U.look.x);
}`;

// Post: bright pass and blur at quarter size for bloom, then the finish:
// bloom, vignette, a fine grain seeded by the frame index (so offline frames
// are repeatable), and output to the target format.
export const POST_WGSL = /* wgsl */ `
struct Post { size: vec4f, look: vec4f, }
// size: dst w, h, src w, h ; look: bloom, vignette, grain, frame (finish) or threshold (bright)
@group(0) @binding(0) var<uniform> U: Post;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var glow: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn hash(p: vec2u, f: u32) -> f32 {
  var x = p.x * 1973u + p.y * 9277u + f * 26699u;
  x = x * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}
@fragment fn finish(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let uv = q.xy / U.size.xy;
  var c = textureSampleLevel(src, smp, uv, 0.0).rgb;
  c = c + textureSampleLevel(glow, smp, uv, 0.0).rgb * U.look.x;
  let v = uv - 0.5;
  c = c * (1.0 - U.look.y * dot(v, v) * 1.6);
  c = c + (hash(vec2u(q.xy), u32(U.look.w)) - 0.5) * U.look.z;
  return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
@fragment fn bright(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let uv = q.xy / U.size.xy;
  let c = textureSampleLevel(src, smp, uv, 0.0).rgb;
  let l = max(c.r, max(c.g, c.b));
  return vec4f(c * smoothstep(U.look.x, U.look.x + 0.45, l), 1.0);
}
@fragment fn blurx(@builtin(position) q: vec4f) -> @location(0) vec4f { return blur(q.xy, vec2f(1.0, 0.0)); }
@fragment fn blury(@builtin(position) q: vec4f) -> @location(0) vec4f { return blur(q.xy, vec2f(0.0, 1.0)); }
fn blur(p: vec2f, dir: vec2f) -> vec4f {
  var w = array<f32, 7>(0.1964, 0.1748, 0.1232, 0.0688, 0.0304, 0.0106, 0.0029);
  let px = dir / U.size.xy * 2.0;
  let uv = p / U.size.xy;
  var c = textureSampleLevel(src, smp, uv, 0.0).rgb * w[0];
  for (var k = 1; k < 7; k = k + 1) {
    c = c + (textureSampleLevel(src, smp, uv + px * f32(k), 0.0).rgb + textureSampleLevel(src, smp, uv - px * f32(k), 0.0).rgb) * w[k];
  }
  return vec4f(c, 1.0);
}`;
