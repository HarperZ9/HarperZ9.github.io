// The vector pass (see shaders.mjs for how it covers a path, and vector.mjs for
// the instances, segments, flags and paints it reads).
import { PAINT_WGSL } from "./paint.mjs";

export const VECTOR_WGSL = /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
// box; fill and stroke colour (premultiplied; the opacity when a paint is used);
// p: half width, blur, rule (1 even-odd), flags (1 stroke outline, 2 clip even-odd, 4 clip,
//   8 exact fill edges, 16 exact clip edges: contours that cross; see region_cov);
// list: segment start and count, stroke outline start and count; list2: clip start and count, fill and stroke paint.
struct Inst { box: vec4f, fill: vec4f, stroke: vec4f, p: vec4f, list: vec4u, list2: vec4u, }
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var<storage, read> segs: array<vec4f>;
@group(0) @binding(3) var<storage, read> idx: array<u32>;
@group(0) @binding(4) var<storage, read> paints: array<vec4f>;
@group(0) @binding(5) var atlas: texture_2d<f32>;
@group(0) @binding(6) var atlasSampler: sampler;
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
${PAINT_WGSL}
// One pass over a list of segments: the winding number and crossing count at p, and
// the nearest edge and the nearest edge at an angle to it, with their nearest points
// and inside normals. An index's top bit marks an internal edge (exact edges,
// edges.mjs): it counts for the winding number but is not an edge to measure to.
// Bit 30 says the inside is on the right of the segment's travel.
struct Walk { d: f32, w: i32, crossings: u32, d2: f32, n1: vec2f, n2: vec2f, o1: vec2f, o2: vec2f, start: u32, count: u32, di: f32, ni: vec2f, d1: f32, }
fn walk(p: vec2f, start: u32, count: u32) -> Walk {
  var r = Walk(1e9, 0i, 0u, 1e9, vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0), start, count, 1e9, vec2f(0.0), 1e9);
  for (var k = 0u; k < count; k = k + 1u) {
    let raw = idx[start + k];
    let s = segs[raw & 0x3fffffffu];
    let a = s.xy;
    let ab = s.zw - s.xy;
    let ap = p - a;
    if ((raw & 0x80000000u) == 0u) {
      let h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
      let dd = length(ap - ab * h);
      let c = a + ab * h;
      r.d = min(r.d, dd);
      // Corners are taken between the two nearest edges at least a pixel long that
      // meet at an angle: shorter ones are the facets of a flattened curve or of a
      // round join's polygon. d1 is the nearest long edge.
      if (dd < r.d2 && dot(ab, ab) >= 1.0) {
        var n = normalize(vec2f(-ab.y, ab.x) + vec2f(1e-12, 0.0));
        if ((raw & 0x40000000u) == 0u) { n = -n; }
        if (dd < r.d1) {
          if (abs(n.x * r.n1.y - n.y * r.n1.x) > 0.02) { r.d2 = r.d1; r.n2 = r.n1; r.o2 = r.o1; }
          r.d1 = dd; r.n1 = n; r.o1 = c;
        } else if (abs(n.x * r.n1.y - n.y * r.n1.x) > 0.02) { r.d2 = dd; r.n2 = n; r.o2 = c; }
      }
    } else {
      // An internal edge: keep the nearest, to settle a pixel centre that lies on one.
      let h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
      let dd = length(ap - ab * h);
      if (dd < r.di) { r.di = dd; r.ni = normalize(vec2f(-ab.y, ab.x) + vec2f(1e-12, 0.0)); }
    }
    if ((a.y <= p.y) != (s.w <= p.y)) {
      let x = a.x + (p.y - a.y) * ab.x / ab.y;
      if (x > p.x) {
        if (s.w > a.y) { r.w = r.w + 1i; } else { r.w = r.w - 1i; }
        r.crossings = r.crossings + 1u;
      }
    }
  }
  return r;
}
fn inside_at(q: vec2f, start: u32, count: u32, evenodd: bool) -> bool {
  var w = 0i;
  var c = 0u;
  for (var k = 0u; k < count; k = k + 1u) {
    let s = segs[idx[start + k] & 0x3fffffffu];
    if ((s.y <= q.y) != (s.w <= q.y)) {
      if (s.x + (q.y - s.y) * (s.z - s.x) / (s.w - s.y) > q.x) { w = w + select(-1i, 1i, s.w > s.y); c = c + 1u; }
    }
  }
  return select(w != 0i, (c & 1u) == 1u, evenodd);
}
// Coverage of the region in a pixel: a ramp over the distance to the nearest edge.
// With exact edges, where two edges meet within 1.5 px at an angle (a corner), a
// convex corner runs from the smaller half-plane coverage (edges nearly in line) to
// the product of the two (at right angles or sharper), and a concave corner from the
// larger to one minus the product of the complements.
fn region_cov(g: Walk, evenodd: bool, p: vec2f, aa: f32, exact: bool) -> f32 {
  var pin = select(g.w != 0i, (g.crossings & 1u) == 1u, evenodd);
  // On an internal edge the crossing count at p is not reliable in float; just off
  // it, on either side, the answer is the same.
  if (exact && g.di < 0.01) { pin = inside_at(p + g.ni * 0.05, g.start, g.count, evenodd); }
  let single = clamp(0.5 + select(-g.d, g.d, pin) / aa, 0.0, 1.0);
  if (!exact || g.d2 >= 1.0 || g.d1 >= 1.0) { return single; }
  let t1 = vec2f(g.n1.y, -g.n1.x);
  let t2 = vec2f(g.n2.y, -g.n2.x);
  let den = t1.x * t2.y - t1.y * t2.x;
  let u = ((g.o2.x - g.o1.x) * t2.y - (g.o2.y - g.o1.y) * t2.x) / den;
  if (length(g.o1 + t1 * u - p) > 1.5) { return single; }
  let s1 = dot(p - g.o1, g.n1);
  let s2 = dot(p - g.o2, g.n2);
  let c1 = clamp(0.5 + s1 / aa, 0.0, 1.0);
  let c2 = clamp(0.5 + s2 / aa, 0.0, 1.0);
  var convex = true;
  if (pin != (s1 > 0.0 && s2 > 0.0)) { convex = false; }
  else if (pin == (s1 > 0.0 || s2 > 0.0)) {
    // Both readings agree at p: test a point inside the first edge and outside the second.
    convex = !inside_at(p + g.n1 * (max(-s1, 0.0) + 0.25) - g.n2 * (max(s2, 0.0) + 0.25), g.start, g.count, evenodd);
  }
  let f = clamp(1.0 - dot(g.n1, g.n2), 0.0, 1.0);
  return select(mix(max(c1, c2), 1.0 - (1.0 - c1) * (1.0 - c2), f), mix(min(c1, c2), c1 * c2, f), convex);
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let I = inst[o.i];
  let p = o.pos.xy;
  let flags = u32(I.p.w);
  let g = walk(p, I.list.x, I.list.y);
  let aa = 1.0 + 2.0 * I.p.y;
  var col = vec4f(0.0);
  if (I.fill.a > 0.0) {
    let cov = region_cov(g, I.p.z > 0.5, p, aa, (flags & 8u) != 0u);
    var fc = I.fill;
    if (I.list2.z > 0u) { fc = paint_at(I.list2.z, p) * I.fill.a; }
    col = fc * cov;
  }
  if (I.stroke.a > 0.0) {
    var k = 0.0;
    if ((flags & 1u) != 0u) {
      k = region_cov(walk(p, I.list.z, I.list.w), false, p, aa, true);
    } else {
      let hw = max(I.p.x, 0.5);
      k = clamp(0.5 + (hw - g.d) / aa, 0.0, 1.0) * min(1.0, I.p.x * 2.0);
    }
    var sc = I.stroke;
    if (I.list2.w > 0u) { sc = paint_at(I.list2.w, p) * I.stroke.a; }
    col = sc * k + col * (1.0 - sc.a * k);
  }
  if ((flags & 4u) != 0u) {
    col = col * region_cov(walk(p, I.list2.x, I.list2.y), (flags & 2u) != 0u, p, aa, (flags & 16u) != 0u);
  }
  if (col.a <= 0.0005) { discard; }
  return col;
}`;
