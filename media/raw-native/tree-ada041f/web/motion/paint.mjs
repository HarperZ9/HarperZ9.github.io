// Paints: what fills or strokes an item, besides a flat colour.
//   { linear: [x0, y0, x1, y1], stops: [[t, colour], ...] }   a linear gradient
//   { radial: [cx, cy, r], stops: [[t, colour], ...] }         a radial gradient
//   { image: name, rect: [x, y, w, h] }                         an image stretched over rect
// Coordinates are in scene units and move with the camera like the shape. Up to
// eight stops; colours interpolate unpremultiplied and pad outside [0, 1]. Images
// filter bilinearly and clamp to their edge. Pure: runs in Node.

export const PAINT = 56;          // floats per packed paint (14 vec4f)
export const MAX_STOPS = 8;

const hex = (c) => {
  if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] ?? 1];
  const h = c.replace("#", ""), n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length >= 8 ? n(6) : 1];
};

export const isPaint = (p) => p != null && typeof p === "object" && !Array.isArray(p);

// Pack a paint for the shader, mapped to pixels by scale k and offset (ox, oy).
// images: name -> { uv: [u0, v0, u1, v1] in the atlas, size: [w, h] }.
export function packPaint(out, p, k, ox, oy, images) {
  const f = new Float32Array(PAINT);
  if (p.linear) {
    const [x0, y0, x1, y1] = p.linear;
    f[0] = 1; f.set([x0 * k + ox, y0 * k + oy, x1 * k + ox, y1 * k + oy], 4);
  } else if (p.radial) {
    const [cx, cy, r] = p.radial;
    f[0] = 2; f.set([cx * k + ox, cy * k + oy, r * k, 0], 4);
  } else if (p.image) {
    const im = images && images[p.image];
    if (!im) throw new Error(`image paint: no image named ${p.image}`);
    const [x, y, w, h] = p.rect;
    f[0] = 3; f[2] = im.size[0]; f[3] = im.size[1];
    f.set(im.uv, 8);
    f.set([x * k + ox, y * k + oy, w * k, h * k], 12);
  } else throw new Error("a paint needs linear, radial or image");
  if (p.stops) {
    const stops = p.stops.slice(0, MAX_STOPS);
    f[1] = stops.length;
    stops.forEach(([t, c], i) => { f[16 + i] = t; f.set(hex(c), 24 + 4 * i); });
  }
  out.push(...f);
  return out.n / PAINT - 1;
}

// The paint's premultiplied colour at pixel (px, py): the CPU twin of the shader's
// paint_at. sample(u, v) returns the image's straight RGBA at atlas uv (bilinear).
export function paintAt(P, i, px, py, sample) {
  const t0 = P[i];
  if (t0 === 3) {
    const w = P[i + 2], h = P[i + 3];
    let u = (px - P[i + 12]) / P[i + 14], v = (py - P[i + 13]) / P[i + 15];
    u = Math.min(Math.max(u, 0.5 / w), 1 - 0.5 / w); v = Math.min(Math.max(v, 0.5 / h), 1 - 0.5 / h);
    const c = sample(P[i + 8] + (P[i + 10] - P[i + 8]) * u, P[i + 9] + (P[i + 11] - P[i + 9]) * v);
    return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
  }
  let t;
  if (t0 === 1) {
    const ex = P[i + 6] - P[i + 4], ey = P[i + 7] - P[i + 5];
    t = ((px - P[i + 4]) * ex + (py - P[i + 5]) * ey) / Math.max(ex * ex + ey * ey, 1e-12);
  } else t = Math.hypot(px - P[i + 4], py - P[i + 5]) / Math.max(P[i + 6], 1e-12);
  const n = P[i + 1];
  let c;
  if (t <= P[i + 16]) c = P.subarray(i + 24, i + 28);
  else if (t >= P[i + 16 + n - 1]) c = P.subarray(i + 24 + 4 * (n - 1), i + 28 + 4 * (n - 1));
  else {
    let k = 0;
    while (k < n - 2 && t > P[i + 17 + k]) k++;
    const a = P[i + 16 + k], b = P[i + 17 + k], u = b > a ? (t - a) / (b - a) : 0;
    c = [0, 1, 2, 3].map((j) => P[i + 24 + 4 * k + j] + (P[i + 28 + 4 * k + j] - P[i + 24 + 4 * k + j]) * u);
  }
  return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
}

export const PAINT_WGSL = /* wgsl */ `
fn paint_at(i: u32, p: vec2f) -> vec4f {
  let b = i * 14u;
  let head = paints[b];
  let g = paints[b + 1u];
  if (head.x > 2.5) {
    let uvr = paints[b + 2u];
    let dst = paints[b + 3u];
    var u = (p - dst.xy) / dst.zw;
    u = clamp(u, 0.5 / head.zw, 1.0 - 0.5 / head.zw);
    let c = textureSampleLevel(atlas, atlasSampler, mix(uvr.xy, uvr.zw, u), 0.0);
    return vec4f(c.rgb * c.a, c.a);
  }
  var t = 0.0;
  if (head.x < 1.5) {
    let e = g.zw - g.xy;
    t = dot(p - g.xy, e) / max(dot(e, e), 1e-12);
  } else { t = length(p - g.xy) / max(g.z, 1e-12); }
  let n = u32(head.y);
  let o0 = paints[b + 4u];
  let o1 = paints[b + 5u];
  var offs = array<f32, 8>(o0.x, o0.y, o0.z, o0.w, o1.x, o1.y, o1.z, o1.w);
  var c = paints[b + 6u];
  if (t >= offs[n - 1u]) { c = paints[b + 6u + n - 1u]; }
  else if (t > offs[0]) {
    var k = 0u;
    loop { if (k >= n - 2u || t <= offs[k + 1u]) { break; } k = k + 1u; }
    let a = offs[k];
    let bb = offs[k + 1u];
    var u = 0.0;
    if (bb > a) { u = (t - a) / (bb - a); }
    c = mix(paints[b + 6u + k], paints[b + 7u + k], u);
  }
  return vec4f(c.rgb * c.a, c.a);
}`;
