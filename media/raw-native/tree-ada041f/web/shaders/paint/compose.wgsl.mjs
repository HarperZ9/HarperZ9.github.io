import { CANVAS_SAMPLER_WGSL } from "./canvas.wgsl.mjs";
export const RELIEF_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> os: array<vec4f>;
@group(0) @binding(3) var<storage, read> Hs: array<vec2f>;
@group(0) @binding(4) var<storage, read> T: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> Rl: array<vec4f>;
@group(0) @binding(6) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(7) var<storage, read> Kv: array<f32>;
` + CANVAS_SAMPLER_WGSL + `
fn xdog(x: i32, y: i32) -> f32 {
  let sg = P[P_lineSigma]; let k = 1.6; let R = i32(ceil(3.0 * sg * k)); var a = 0.0; var b = 0.0; var wa = 0.0; var wb = 0.0;
  for (var dy = -R; dy <= R; dy++) { for (var dx = -R; dx <= R; dx++) {
    let q = os[clamp(y + dy, 0, H() - 1) * W() + clamp(x + dx, 0, W() - 1)].xyz; let l = 0.2126 * q.x + 0.7152 * q.y + 0.0722 * q.z;
    let r2 = f32(dx * dx + dy * dy); let g1 = exp(-r2 / (2.0 * sg * sg)); let g2 = exp(-r2 / (2.0 * sg * sg * k * k));
    a += g1 * l; wa += g1; b += g2 * l; wb += g2;
  } }
  let D = a / wa - 0.985 * (b / wb);
  if (D >= -0.004) { return 1.0; } return 1.0 + tanh(P[P_lineSharp] * (D + 0.004));
}
fn hs(x: i32, y: i32) -> f32 {
  let xx = clamp(x, 0, W() - 1); let yy = clamp(y, 0, H() - 1);
  return P[P_impasto] * Hs[yy * W() + xx].x + 0.12 * cnoise(2u, f32(xx), f32(yy), 0.5);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let i = y * W() + x; var line = 1.0; if (P[P_lines] > 0.0) { line = xdog(x, y); }
  let nx = -(hs(x + 1, y) - hs(x - 1, y)) * 2.5; let ny = -(hs(x, y + 1) - hs(x, y - 1)) * 2.5;
  let n = vec3f(nx, ny, 1.0) / length(vec3f(nx, ny, 1.0)); let L = vec3f(-0.5, -0.6, 0.62) / length(vec3f(-0.5, -0.6, 0.62));
  let ndl = dot(n, L); let rz = 2.0 * ndl * n.z - L.z;
  Rl[i] = vec4f(line, 1.0 + 0.9 * (ndl - L.z), P[P_gloss] * pow(max(0.0, rz), 24.0) * 0.35, smooth_(0.012, 0.05, sqrt(T[i].x + T[i].z)));
}`;

// WGSL for the painterly compose pass and the display encode. Mirrors compose.mjs.
export const COMPOSE_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> olat: array<vec4f>;
@group(0) @binding(3) var<storage, read> Hs: array<vec2f>;
@group(0) @binding(4) var<storage, read> Rl: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(6) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(7) var<storage, read> Kv: array<f32>;
` + CANVAS_SAMPLER_WGSL + `
fn bil4(x: f32, y: f32) -> vec4f {
  let fx = clamp(x, 0.0, f32(W() - 1)); let fy = clamp(y, 0.0, f32(H() - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W() - 1, x0 + 1); let y1 = min(H() - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  return (Rl[y0 * W() + x0] * (1.0 - tx) + Rl[y0 * W() + x1] * tx) * (1.0 - ty) + (Rl[y1 * W() + x0] * (1.0 - tx) + Rl[y1 * W() + x1] * tx) * ty;
}
fn bilH(x: f32, y: f32) -> vec2f {
  let fx = clamp(x, 0.0, f32(W() - 1)); let fy = clamp(y, 0.0, f32(H() - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W() - 1, x0 + 1); let y1 = min(H() - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  return (Hs[y0 * W() + x0] * (1.0 - tx) + Hs[y0 * W() + x1] * tx) * (1.0 - ty) + (Hs[y1 * W() + x0] * (1.0 - tx) + Hs[y1 * W() + x1] * tx) * ty;
}
fn bil(x: f32, y: f32) -> array<vec4f, 2> {
  let fx = clamp(x, 0.0, f32(W() - 1)); let fy = clamp(y, 0.0, f32(H() - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W() - 1, x0 + 1); let y1 = min(H() - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  var o: array<vec4f, 2>;
  for (var c = 0; c < 2; c++) {
    o[c] = (olat[2 * (y0 * W() + x0) + c] * (1.0 - tx) + olat[2 * (y0 * W() + x1) + c] * tx) * (1.0 - ty)
         + (olat[2 * (y1 * W() + x0) + c] * (1.0 - tx) + olat[2 * (y1 * W() + x1) + c] * tx) * ty;
  }
  return o;
}
fn glaze(c: vec4f, X: f32, Rg: f32) -> vec3f {
  var o = vec3f(0.0);
  for (var w = 0u; w < NL; w++) {
    let K = dot(c, vec4f(pig[T_K + 4u * w], pig[T_K + 4u * w + 1u], pig[T_K + 4u * w + 2u], pig[T_K + 4u * w + 3u]));
    let S = max(dot(c, vec4f(pig[T_S + 4u * w], pig[T_S + 4u * w + 1u], pig[T_S + 4u * w + 2u], pig[T_S + 4u * w + 3u])), 1e-6);
    let a = 1.0 + K / S; let b = sqrt(a * a - 1.0); let z = min(b * S * X, 30.0);
    let sh = sinh(z); let ch = cosh(z); let den = a * sh + b * ch; let R = sh / den; let Tt = b / den;
    let Rt = R + (Tt * Tt * Rg) / (1.0 - R * Rg);
    o += Rt * vec3f(pig[T_W + 3u * w], pig[T_W + 3u * w + 1u], pig[T_W + 3u * w + 2u]);
  }
  return o;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let ox = P[P_ox]; let oy = P[P_oy]; var wv = vec2f(0.0);
  _ = ox; _ = oy;
  if (P[P_warp] > 0.0) { wv = vec2f(cnoise(5u, f32(x), f32(y), 0.0), cnoise(6u, f32(x), f32(y), 0.0)); }
  let sx = f32(x) + wv.x * P[P_warp]; let sy = f32(y) + wv.y * P[P_warp];
  let l = bil(sx, sy); var c = l[0]; let res = l[1].xyz;
  let dec0 = km_decode(c); let D = max(dec0 + res, vec3f(0.0)); let v = clamp(0.2126 * D.x + 0.7152 * D.y + 0.0722 * D.z, 0.0, 1.0);
  let mx = max(D.x, max(D.y, D.z)); let mn = min(D.x, min(D.y, D.z));
  let keep = smooth_(0.15, 0.6, (mx - mn) / max(mx, 1e-3));
  let pk = P[P_push] * (1.0 - 0.85 * keep);
  c.w += pk * (1.0 - v) * (1.0 - v); c.z += 0.6 * pk * (1.0 - v) * (1.0 - v); c.y += pk * 0.08 * v * v;
  let jit = (bilH(sx, sy).y - 0.5) * 2.0; let rel = bil4(sx, sy); let bk = P[P_broken] * (1.0 - 0.85 * v * v) * (1.0 - 0.7 * keep);
  c.y += bk * max(jit, 0.0); c.w += bk * max(-jit, 0.0); c.z += 0.5 * bk * abs(jit) * (1.0 - v);
  c = c / (c.x + c.y + c.z + c.w);
  var rgb = D * min(vec3f(4.0), (km_decode(c) + vec3f(0.01)) / (dec0 + vec3f(0.01)));
  if (P[P_valueBands] > 0.0) {
    let vy = 0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * rgb.z; let f = min(vy, 1.0) * P[P_valueBands]; let fl = floor(f);
    let vq = max(min(vy, 0.02), (fl + smooth_(0.3, 0.7, f - fl)) / P[P_valueBands]);
    let g = 1.0 + (vq / max(vy, 1e-6) - 1.0) * (1.0 - 0.6 * keep);
    rgb = rgb * g;
  }
  let paper = cnoise(3u, f32(x), f32(y), 0.5);
  if (P[P_medium] > 1.5) {
    let valley = cnoise(4u, f32(x), f32(y), 0.5); let Rg = 0.86 * (0.93 + 0.07 * paper);
    let X0 = 1.5; let X = X0 * (1.0 + P[P_granulation] * (0.5 - valley) * 2.0) * (1.0 + P[P_edge] * rel.w);
    let g0 = glaze(c, X0, 0.86); let g1 = glaze(c, X, Rg);
    let lw = vec3f(0.2126, 0.7152, 0.0722); let sr = dot(lw, g1) / max(dot(lw, g0), 1e-4);
    let ratio = clamp(vec3f(sr) + (g1 / max(g0, vec3f(1e-4)) - vec3f(sr)) * keep, vec3f(0.5), vec3f(2.0));
    let wc = clamp(rgb * ratio, vec3f(0.0), vec3f(1.0));
    rgb = select(pow(wc, vec3f(P[P_dilution])), vec3f(0.0), wc <= vec3f(0.0));   // pow(0, y) is undefined in WGSL
  } else { rgb = rgb * rel.y + rel.z; }
  let t = 1.0 - P[P_lines] * (1.0 - rel.x);
  img[y * W() + x] = vec4f(max(rgb * t, vec3f(0.0)), 1.0);
}`;

export const PAINT_ENCODE_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> img: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> out8: array<u32>;
fn enc(v: f32) -> u32 { return u32(floor(linear_to_srgb(v) * 255.0 + 0.5)); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let c = img[y * W() + x];
  out8[y * W() + x] = enc(c.x) | (enc(c.y) << 8u) | (enc(c.z) << 16u) | (255u << 24u);
}`;
