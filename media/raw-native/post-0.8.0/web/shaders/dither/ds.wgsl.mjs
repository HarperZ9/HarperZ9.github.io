// Double-single arithmetic in WGSL: a value is a vec2f (hi, lo) with |lo| <= ulp(hi) / 2,
// about 44 bits of mantissa. WGSL has no f64, and the dither decisions (nearest palette entry,
// bracketing pair, threshold) must agree with an f64 reference. Error-free transforms after
// Knuth (two-sum) and Dekker (split, two-product), written without fma, so the result does not
// depend on whether the backend fuses. The JavaScript side splits an f64 into (hi, lo) with
// dsSplit(); dsValue() reads one back.
export const DS_WGSL = /* wgsl */ `
fn two_sum(a: f32, b: f32) -> vec2f { let s = a + b; let bb = s - a; return vec2f(s, (a - (s - bb)) + (b - bb)); }
fn quick_two_sum(a: f32, b: f32) -> vec2f { let s = a + b; return vec2f(s, b - (s - a)); }
fn split_f(a: f32) -> vec2f { let c = 4097.0 * a; let big = c - a; let hi = c - big; return vec2f(hi, a - hi); }
fn two_prod(a: f32, b: f32) -> vec2f {
  let p = a * b; let as_ = split_f(a); let bs = split_f(b);
  let e = ((as_.x * bs.x - p) + as_.x * bs.y + as_.y * bs.x) + as_.y * bs.y;
  return vec2f(p, e);
}
fn ds(a: f32) -> vec2f { return vec2f(a, 0.0); }
fn ds_add(a: vec2f, b: vec2f) -> vec2f {
  var s = two_sum(a.x, b.x); let t = two_sum(a.y, b.y);
  s.y += t.x; s = quick_two_sum(s.x, s.y); s.y += t.y; return quick_two_sum(s.x, s.y);
}
fn ds_neg(a: vec2f) -> vec2f { return -a; }
fn ds_sub(a: vec2f, b: vec2f) -> vec2f { return ds_add(a, -b); }
fn ds_mul(a: vec2f, b: vec2f) -> vec2f { var p = two_prod(a.x, b.x); p.y += a.x * b.y + a.y * b.x; return quick_two_sum(p.x, p.y); }
fn ds_div(a: vec2f, b: vec2f) -> vec2f {
  let q1 = a.x / b.x; var r = ds_sub(a, ds_mul(b, ds(q1)));
  let q2 = r.x / b.x; r = ds_sub(r, ds_mul(b, ds(q2)));
  let q3 = r.x / b.x;
  return ds_add(quick_two_sum(q1, q2), ds(q3));
}
fn ds_lt(a: vec2f, b: vec2f) -> bool { return a.x < b.x || (a.x == b.x && a.y < b.y); }
fn ds_gt(a: vec2f, b: vec2f) -> bool { return ds_lt(b, a); }
fn ds_le(a: vec2f, b: vec2f) -> bool { return !ds_lt(b, a); }
fn ds_abs(a: vec2f) -> vec2f { if (a.x < 0.0 || (a.x == 0.0 && a.y < 0.0)) { return -a; } return a; }
fn ds_min(a: vec2f, b: vec2f) -> vec2f { if (ds_lt(b, a)) { return b; } return a; }
fn ds_clamp01(a: vec2f) -> vec2f { if (ds_lt(a, ds(0.0))) { return ds(0.0); } if (ds_gt(a, ds(1.0))) { return ds(1.0); } return a; }
// Cube root: an f32 estimate, then one Newton step in double-single (error about 2^-46).
fn ds_cbrt(x: vec2f) -> vec2f {
  if (x.x == 0.0) { return ds(0.0); }
  let y0 = sign(x.x) * pow(abs(x.x), 1.0 / 3.0);
  let yy = ds_mul(ds(y0), ds(y0)); let y3 = ds_mul(yy, ds(y0));
  return ds_add(ds(y0), ds_div(ds_sub(x, y3), ds_mul(ds(3.0), yy)));
}
`;

// JavaScript side: an f64 as (hi, lo) f32 pair, and back.
export function dsSplit(v) { const hi = Math.fround(v); return [hi, Math.fround(v - hi)]; }
export const dsValue = (hi, lo) => hi + lo;
