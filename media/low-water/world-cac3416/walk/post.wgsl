// After the world is drawn: the fog that lies on the ground and the light the lamps throw into
// the air, then bloom, then the film curve.
//
// Ground fog is a layer that hugs the terrain, lies deeper where the ground sits below the
// country round it, drifts in wisps, and opens round the walker for about a second
// (the video pass: fog is a fluid with a closing time). It is marched, 20 steps a pixel.
//
// Lamp light in the air is worked out exactly, with no steps and no noise: the light a point
// source scatters toward the eye along a ray is (atan((t1 - b) / h) - atan((t0 - b) / h)) / h,
// with b the place on the ray nearest the lamp and h the distance there. A shaded lamp counts
// only the stretch of the ray inside its cone, so the cone stands in the air with a hard edge
// and the weather moves through it.

@group(1) @binding(0) var srcTex: texture_2d<f32>;
@group(1) @binding(1) var depthTex: texture_depth_2d;
@group(1) @binding(2) var bloomTex: texture_2d<f32>;
@group(1) @binding(3) var coarseTex: texture_2d<f32>;   // the ground averaged over half a kilometre, metres

struct POut { @builtin(position) clip: vec4f, @location(0) uv: vec2f }

@vertex fn vsFull(@builtin(vertex_index) i: u32) -> POut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: POut; o.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(p.x, 1.0 - p.y); return o;
}

fn ign(px: vec2f) -> f32 { return fract(52.9829189 * fract(dot(px, vec2f(0.06711056, 0.00583715)))); }

fn fogDensity(p: vec3f) -> f32 {
  let g = texel(vec2i(floor(p.xz / F.world.z)));
  let low = textureSampleLevel(coarseTex, samp, p.xz / F.world.xy, 0.0).r;
  // the layer's floor is the ground, and it stands deeper in a hollow than on a rise
  let depthHere = F.gfog.y * (1.0 + clamp((low - g) / 30.0, -0.7, 2.5));
  var d = F.gfog.x * exp(-max(p.y - g, 0.0) / max(depthHere, 0.5));
  let t = F.cam.w;
  let q = p * vec3f(0.055, 0.11, 0.055) + vec3f(t * 0.012 * (1.0 + 6.0 * F.wx.z), -t * 0.004, t * 0.007);
  let wisp = vnoise3(q) * 0.62 + vnoise3(q * 2.9 + 5.0) * 0.38;
  d *= mix(1.0, smoothstep(0.28, 0.80, wisp) * 2.3, F.gfog.z);
  // the walker opens it, and it closes behind
  for (var i = 0; i < 8; i++) {
    let w = F.trail[i];
    if (w.w > 0.0) { let r = p - w.xyz; d *= 1.0 - w.w * exp(-dot(r, r) / 5.3); }
  }
  return d;
}

// the light lamp i scatters toward the eye along the ray o + t d, t in 0..tmax
fn lampAir(i: u32, o: vec3f, d: vec3f, tmax: f32) -> f32 {
  let L = LS.l[i].pos.xyz; let R = LS.l[i].pos.w;
  let q = L - o; let b = dot(q, d); let h2 = dot(q, q) - b * b;
  if (h2 > R * R) { return 0.0; }
  let half = sqrt(R * R - h2);
  var t0 = max(b - half, 0.0); var t1 = min(b + half, tmax);
  if (t1 <= t0) { return 0.0; }
  let c = LS.l[i].dir.w;
  if (c > -0.5) {
    // the stretch of the ray inside the cone: where ((p - L) . a)^2 >= c^2 |p - L|^2 on the lit side
    let a = LS.l[i].dir.xyz; let co = -q;
    let da = dot(d, a); let ca = dot(co, a);
    let A = da * da - c * c; let B = 2.0 * (da * ca - c * c * dot(d, co)); let C = ca * ca - c * c * dot(co, co);
    let disc = B * B - 4.0 * A * C;
    if (disc < 0.0 || abs(A) < 1e-6) { return 0.0; }
    let s = sqrt(disc); var r0 = (-B - s) / (2.0 * A); var r1 = (-B + s) / (2.0 * A);
    if (r0 > r1) { let x = r0; r0 = r1; r1 = x; }
    if (A < 0.0) {
      // inside between the roots, if that stretch is on the lit side
      if (ca + da * (r0 + r1) * 0.5 <= 0.0) { return 0.0; }
      t0 = max(t0, r0); t1 = min(t1, r1);
    } else {
      // inside before the first root or after the second: take the lit one
      if (ca + da * (r1 + 1.0) > 0.0) { t0 = max(t0, r1); } else if (ca + da * (r0 - 1.0) > 0.0) { t1 = min(t1, r0); } else { return 0.0; }
    }
    if (t1 <= t0) { return 0.0; }
  }
  let h = sqrt(max(h2, 0.0004));
  let air = (atan((t1 - b) / h) - atan((t0 - b) / h)) / h;
  // the reach window, taken at the nearest lit point of the ray
  let tm = clamp(b, t0, t1); let dm2 = h2 + (tm - b) * (tm - b);
  let w = clamp(1.0 - dm2 * dm2 / (R * R * R * R), 0.0, 1.0);
  // what drifts through the cone: the air is never even
  let pm = o + d * tm;
  let tt = F.cam.w;
  let wx = vnoise3(pm * 0.9 + vec3f(tt * 0.35 * (0.4 + 3.0 * F.wx.z), -tt * 0.5, tt * 0.21)) * 0.6 + vnoise3(pm * 0.21 + vec3f(tt * 0.06, 0.0, tt * 0.04)) * 0.4;
  return air * w * w * (0.55 + 0.9 * wx);
}

@fragment fn fsFog(v: POut) -> @location(0) vec4f {
  let px = vec2i(v.clip.xy);
  let src = textureLoad(srcTex, px, 0).rgb;
  let depth = textureLoad(depthTex, px, 0);
  let ndc = vec2f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0);
  let far = F.invViewProj * vec4f(ndc, 0.5, 1.0);
  let rd = normalize(far.xyz / far.w - F.cam.xyz);
  var dist = 40000.0;
  if (depth > 1e-7) { let w = F.invViewProj * vec4f(ndc, depth, 1.0); dist = distance(w.xyz / w.w, F.cam.xyz); }
  let ro = F.cam.xyz;
  var T = 1.0; var S = vec3f(0.0);
  if (F.gfog.x > 0.0) {
    let tmax = min(dist, 420.0);
    let jit = ign(v.clip.xy);
    let N = 20.0;
    // what lights the fog: the dome, and the key light where it gets through
    let mu = dot(rd, F.key.xyz);
    let phase = 0.55 + 1.6 * pow(max(mu, 0.0), 6.0);
    let amb = mix(F.fog.rgb, F.amb.rgb * 2.2, 0.35) + F.ev.w * vec3f(0.5, 0.55, 0.7);
    for (var i = 0.0; i < N; i += 1.0) {
      let a = pow(i / N, 1.7) * tmax; let b = pow((i + 1.0) / N, 1.7) * tmax;
      let p = ro + rd * mix(a, b, jit);
      let dens = fogDensity(p);
      if (dens < 1e-6) { continue; }
      let keep = exp(-dens * (b - a));
      let nu = nearUV(p.xz);
      let crown = textureSampleLevel(nearA, samp, nu.xy, 0.0).r * nu.z;
      var light = amb * mix(1.0, 0.45, crown);
      if (F.key.w > 0.02) { light += F.keyCol.rgb * F.key.w * phase * 0.5 * keyShadow(p, vec3f(0.0)) * mix(1.0, 0.25, crown * (1.0 - F.shp.x)); }
      S += T * (1.0 - keep) * light;
      T *= keep;
    }
  }
  var col = src * T + S;
  // lamps in the air
  if (F.gfog.w > 0.0) {
    var air = vec3f(0.0);
    for (var i = 0u; i < LS.n.y; i++) { air += LS.l[i].col.rgb * lampAir(i, ro, rd, dist); }
    col += air * F.gfog.w;
  }
  return vec4f(col, 1.0);
}

// bloom: each level down is a 13-tap filter that keeps small bright points from flickering
// (Jimenez 2014); each level up is a tent that adds the level below.
fn down(v: POut) -> vec3f {
  let s = 1.0 / vec2f(textureDimensions(srcTex));
  let u = v.uv;
  let a = textureSampleLevel(srcTex, samp, u + s * vec2f(-2.0, -2.0), 0.0).rgb; let b = textureSampleLevel(srcTex, samp, u + s * vec2f(0.0, -2.0), 0.0).rgb; let c = textureSampleLevel(srcTex, samp, u + s * vec2f(2.0, -2.0), 0.0).rgb;
  let d = textureSampleLevel(srcTex, samp, u + s * vec2f(-2.0, 0.0), 0.0).rgb; let e = textureSampleLevel(srcTex, samp, u, 0.0).rgb; let f = textureSampleLevel(srcTex, samp, u + s * vec2f(2.0, 0.0), 0.0).rgb;
  let g = textureSampleLevel(srcTex, samp, u + s * vec2f(-2.0, 2.0), 0.0).rgb; let h = textureSampleLevel(srcTex, samp, u + s * vec2f(0.0, 2.0), 0.0).rgb; let i = textureSampleLevel(srcTex, samp, u + s * vec2f(2.0, 2.0), 0.0).rgb;
  let j = textureSampleLevel(srcTex, samp, u + s * vec2f(-1.0, -1.0), 0.0).rgb; let k = textureSampleLevel(srcTex, samp, u + s * vec2f(1.0, -1.0), 0.0).rgb;
  let l = textureSampleLevel(srcTex, samp, u + s * vec2f(-1.0, 1.0), 0.0).rgb; let m = textureSampleLevel(srcTex, samp, u + s * vec2f(1.0, 1.0), 0.0).rgb;
  var col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  return max(col, vec3f(0.0));
}
// the first level tames single hot pixels (the sun, a lamp one pixel wide)
@fragment fn fsDown0(v: POut) -> @location(0) vec4f { let c = down(v); return vec4f(c / (1.0 + lum(c) * 0.02), 1.0); }
@fragment fn fsDown(v: POut) -> @location(0) vec4f { return vec4f(down(v), 1.0); }
@fragment fn fsUp(v: POut) -> @location(0) vec4f {
  let s = 1.0 / vec2f(textureDimensions(srcTex));
  var c = textureSampleLevel(srcTex, samp, v.uv, 0.0).rgb * 4.0;
  c += (textureSampleLevel(srcTex, samp, v.uv + s * vec2f(1.0, 0.0), 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv - s * vec2f(1.0, 0.0), 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv + s * vec2f(0.0, 1.0), 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv - s * vec2f(0.0, 1.0), 0.0).rgb) * 2.0;
  c += textureSampleLevel(srcTex, samp, v.uv + s, 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv - s, 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv + s * vec2f(1.0, -1.0), 0.0).rgb + textureSampleLevel(srcTex, samp, v.uv + s * vec2f(-1.0, 1.0), 0.0).rgb;
  return vec4f(c / 16.0 * 0.62, 1.0);
}

@fragment fn fsFinal(v: POut) -> @location(0) vec4f {
  let px = vec2i(v.clip.xy);
  var c = textureLoad(srcTex, px, 0).rgb;
  let bloom = textureSampleLevel(bloomTex, samp, v.uv, 0.0).rgb;
  // precipitation and night air carry more glow than a clear day
  c = mix(c, bloom, 0.045 + 0.05 * F.misc.x + 0.05 * max(F.wx.x, F.wx.y));
  // the lens darkens a little toward its corners
  let q = v.uv - 0.5;
  c *= 1.0 - 0.32 * dot(q, q);
  // a filmic curve (Narkowicz's fit to ACES): deep shadows, a soft shoulder
  let x = c * F.misc.z * 0.9;
  var m = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  m = pow(clamp(m, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  // the print: shadows lean to blue-green, lights stay where they are, a little colour taken out
  let l = lum(m);
  m = mix(vec3f(l), m, 0.90) * mix(vec3f(0.90, 1.0, 1.05), vec3f(1.0), smoothstep(0.0, 0.6, l));
  // grain, so a dark gradient does not band
  m += (ign(v.clip.xy + fract(F.cam.w) * 61.0) - 0.5) / 255.0 * 1.5;
  return vec4f(m, 1.0);
}
