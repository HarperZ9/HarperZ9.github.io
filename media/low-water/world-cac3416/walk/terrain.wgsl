// Heightfield terrain with continuous level of detail (CDLOD, Strugar 2009): one 32 x 32 grid
// drawn once per quadtree node, each vertex sliding onto the next coarser grid as it nears the
// edge of its level's range, so levels meet without cracks. Vertices stand 1 m apart under the
// walker. The fragment stage lays the materials of materials.wgsl by slope, cover, wetness and
// wear, then snow in three ages, then the light. The second entry point draws the water surface
// on the same nodes, with the mirror pass in it where the water is still.

const GRID: f32 = 32.0;
const RANGE0: f32 = 62.5;

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) wet: f32,
}

fn waterTexel(c: vec2i) -> f32 {
  let s = vec2i(textureDimensions(waterTex));
  return textureLoad(waterTex, clamp(c, vec2i(0), s - vec2i(1)), 0).r;
}
// water level and how much of the four texels round a point is water
fn waterAt(xz: vec2f) -> vec2f {
  let q = xz / F.world.z - 0.5; let i = vec2i(floor(q)); let f = fract(q);
  let a = waterTexel(i); let b = waterTexel(i + vec2i(1, 0)); let c = waterTexel(i + vec2i(0, 1)); let d = waterTexel(i + vec2i(1, 1));
  let level = max(max(a, b), max(c, d));
  let wa = step(-500.0, a); let wb = step(-500.0, b); let wc = step(-500.0, c); let wd = step(-500.0, d);
  return vec2f(level, mix(mix(wa, wb, f.x), mix(wc, wd, f.x), f.y));
}

// slide a grid point toward the coarser grid by k
fn morphed(grid: vec2f, inst: vec4f, k: f32) -> vec2f {
  let gi = grid * GRID;
  let odd = fract(gi * 0.5) * 2.0;
  return inst.xy + (gi - odd * k) / GRID * inst.z;
}
fn morphK(p: vec3f, level: f32) -> f32 {
  let range = RANGE0 * exp2(level);
  return clamp((distance(p, F.cam.xyz) - range * 0.70) / (range * 0.24), 0.0, 1.0);
}

// new snow lifts the ground where it can settle: not under roofs, less where feet and wheels pack it
fn snowLift(xz: vec2f, y: f32) -> f32 {
  if (F.snowp.x <= 0.0) { return 0.0; }
  let nu = nearUV(xz);
  let na = textureSampleLevel(nearA, samp, nu.xy, 0.0);
  let nb = textureSampleLevel(nearB, samp, nu.xy, 0.0);
  let open = 1.0 - nu.z * max(na.b, max(na.r * 0.6, nb.a * 0.75));
  let dune = 0.75 + 0.5 * lnoise(xz / 2.7 + 13.0);
  return F.snowp.x * snowCold(vec3f(xz.x, y, xz.y)) * open * dune;
}

@vertex fn vsGround(@location(0) grid: vec2f, @location(1) inst: vec4f) -> VOut {
  var xz = inst.xy + grid * inst.z;
  let k = morphK(vec3f(xz.x, rasterAt(xz), xz.y), inst.w);
  xz = morphed(grid, inst, k);
  let d = distance(vec3f(xz.x, rasterAt(xz), xz.y), F.cam.xyz);
  var y = groundAt(xz, d);
  y += snowLift(xz, y) * (1.0 - smoothstep(120.0, 240.0, d));
  var o: VOut;
  o.wp = vec3f(xz.x, y, xz.y);
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.wet = 0.0;
  return o;
}

@vertex fn vsWater(@location(0) grid: vec2f, @location(1) inst: vec4f) -> VOut {
  var xz = inst.xy + grid * inst.z;
  let k = morphK(vec3f(xz.x, max(waterAt(xz).x, 0.0), xz.y), inst.w);
  xz = morphed(grid, inst, k);
  let w = waterAt(xz);
  var o: VOut;
  o.wp = vec3f(xz.x, max(w.x, -1.0), xz.y);
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.wet = w.y;
  return o;
}

// Is the key light blocked by the ground between here and it? A march over the heightfield with
// steps that grow, so a ridge 6 km off still throws its shadow at dusk.
fn groundShadow(p: vec3f) -> f32 {
  let l = F.key.xyz;
  if (l.y <= 0.01 || F.key.w < 0.02) { return 1.0; }
  var shade = 1.0; var s = 70.0;
  for (var i = 0; i < 14; i++) {
    let q = p + l * s;
    let h = rasterAt(q.xz);
    shade = min(shade, clamp((q.y - h) / (s * 0.10) + 1.0, 0.0, 1.0));
    s *= 1.45;
  }
  return shade;
}

// rings where rain meets standing water
fn rainRings(p: vec2f) -> f32 {
  var r = 0.0;
  for (var k = 0; k < 2; k++) {
    let q = p * (2.6 + f32(k) * 1.7) + f32(k) * 17.0;
    let c = floor(q); let f = fract(q) - 0.5;
    let t = fract(F.cam.w * (0.9 + 0.3 * hash21(c)) + hash21(c + 5.0));
    let d = length(f - (hash22(c) - 0.5) * 0.5);
    r += sin((d - t * 0.45) * 60.0) * smoothstep(0.06, 0.0, abs(d - t * 0.45)) * (1.0 - t);
  }
  return r;
}

@fragment fn fsGround(v: VOut) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  let uv = v.wp.xz / F.world.xy;
  let dist = distance(v.wp, F.cam.xyz);
  let view = normalize(v.wp - F.cam.xyz);
  // Far from the eye the mesh is coarse, and a triangle that spans the shore can stand above water
  // that the raster says is there. Where the true ground is under water, show the water.
  let wl = waterAt(v.wp.xz);
  let trueGround = rasterAt(v.wp.xz);
  if (wl.y > 0.5 && trueGround < wl.x - 0.3 && v.wp.y > wl.x - 0.2 && dist > 300.0) {
    let c = waterColour(vec3f(v.wp.x, wl.x, v.wp.z), wl.x - trueGround, v.clip.xy);
    return vec4f(c.rgb, 1.0);
  }
  let alb = textureSampleLevel(albTex, samp, uv, 0.0);
  let aux = textureSampleLevel(auxTex, samp, uv, 0.0);
  let nu = nearUV(v.wp.xz);
  let na = textureSampleLevel(nearA, samp, nu.xy, 0.0) * nu.z;
  let nb = textureSampleLevel(nearB, samp, nu.xy, 0.0);
  let near = 1.0 - smoothstep(150.0, 2500.0, dist);
  let det = 1.0 - smoothstep(5.0, 26.0, dist);
  let mid = 1.0 - smoothstep(40.0, 260.0, dist);

  // the shape of the ground: the walked surface close by, the baked map beyond
  var n = vec3f(aux.r * 2.0 - 1.0, 0.0, aux.g * 2.0 - 1.0);
  let e = 0.35;
  let big = vec2f(vnoise(v.wp.xz * 0.013 + vec2f(e, 0.0)) - vnoise(v.wp.xz * 0.013 - vec2f(e, 0.0)), vnoise(v.wp.xz * 0.013 + vec2f(0.0, e)) - vnoise(v.wp.xz * 0.013 - vec2f(0.0, e)));
  n = vec3f(n.x - big.x * 0.10, 0.0, n.z - big.y * 0.10);
  n.y = sqrt(max(1.0 - n.x * n.x - n.z * n.z, 0.04));
  n = normalize(n);
  if (dist < 420.0) {
    let s = max(0.5, dist * 0.006);
    let h0 = groundAt(v.wp.xz, dist); let hx = groundAt(v.wp.xz + vec2f(s, 0.0), dist); let hz = groundAt(v.wp.xz + vec2f(0.0, s), dist);
    n = normalize(mix(n, normalize(vec3f(h0 - hx, s, h0 - hz)), 1.0 - smoothstep(260.0, 420.0, dist)));
  }
  let slope = 1.0 - n.y;
  let lie = 1.0 - sqrt(max(1.0 - (aux.r * 2.0 - 1.0) * (aux.r * 2.0 - 1.0) - (aux.g * 2.0 - 1.0) * (aux.g * 2.0 - 1.0), 0.04));

  // what stands over this ground and what has crossed it
  let cover = mix(aux.b * 0.8, na.r, nu.z);                       // crowns overhead
  let forest = smoothstep(0.2, 0.55, max(aux.b, na.r));
  let broad = mix(0.3 + 0.4 * vnoise(v.wp.xz * 0.02), na.g, nu.z);
  let road = nb.r * nu.z; let wear = nb.a * nu.z; let kind = nb.g;
  let shelter = smoothstep(0.6, 0.9, na.b);
  let p = v.wp.xz;
  let hollow = lnoise(p / 4.0 + 50.0) * 0.6 + lnoise(p / 16.0) * 0.4;
  let wetAir = F.wx.w;

  // the far look of the cover, never one colour
  var farCol = alb.rgb * (0.82 + 0.36 * fbm(p * 0.004)) * (0.92 + 0.16 * near * fbm(p * 0.05));
  farCol = mix(farCol, mix(vec3f(0.070, 0.052, 0.036), vec3f(0.060, 0.074, 0.044), fbm(p * 0.03)), forest * 0.75);

  // layers, lowest first
  var m = turfMat(p, farCol, det);
  if (mid > 0.0) {
    let lit = litterMat(p, broad, det);
    let mossAmt = smoothstep(0.52, 0.74, fbm(p * 0.21 + 7.0) * (0.55 + 0.6 * cover + 0.25 * wetAir) + (1.0 - hollow) * 0.12);
    var floorM = mixMat(lit, mossMat(p, det), mossAmt * 0.85);
    floorM = mixMat(floorM, soilMat(p, det), smoothstep(0.62, 0.8, fbm(p * 0.6 + 21.0)) * 0.7);
    m = mixMat(m, floorM, forest);
  }
  let rockAmt = smoothstep(0.16, 0.34, lie + (fbm(p * 0.35) - 0.5) * 0.10 * mid);
  if (rockAmt > 0.0) {
    var rk = rockMat(v.wp, det);
    rk = mixMat(rk, mossMat(p * 1.3, det), smoothstep(0.5, 0.7, fbm(p * 0.8 + 3.0)) * (0.3 + 0.5 * cover) * n.y);
    m = mixMat(m, rk, rockAmt * 0.9);
  }
  // roads and yards
  var puddle = 0.0;
  if (road > 0.0) {
    var surf = gravelMat(p, det);
    if (kind > 0.875) { surf = settMat(p, det); } else if (kind > 0.375 && kind <= 0.625) { surf = asphaltMat(p, det); } else if (kind > 0.125 && kind <= 0.375) { surf = concreteMat(p, det); }
    // wheel and foot wear packs the surface, darkens it and holds the water
    surf.c *= 1.0 - 0.28 * wear;
    surf.h -= 0.03 * wear;
    m = mixMat(m, surf, smoothstep(0.30, 0.52, road + (fbm(p * 1.3) - 0.5) * 0.25));
    puddle = smoothstep(0.50, 0.66, fbm(p * 0.55 + 3.0) * (0.55 + 0.6 * wear) + 0.25 * wetAir - m.h * 3.0) * smoothstep(0.35, 0.6, road) * smoothstep(0.05, 0.3, wetAir + F.snowp.y);
  }
  m.c = mix(farCol * (1.0 - 0.4 * forest * (1.0 - mid)), m.c, max(mid, smoothstep(0.3, 0.5, road)));

  // snow: lying where it is cold, a first dusting where the sky is open, gone where wheels run
  let cold = snowCold(v.wp) * (1.0 - smoothstep(0.30, 0.55, slope));
  let sn = fbm(p * 0.9 + 40.0);
  let lying = cold * (1.0 - cover * 0.45) * (1.0 - shelter);
  let open = smoothstep(0.75, 0.2, cover);
  let dust = F.snowp.z * open * (1.0 - shelter) * smoothstep(0.0, 0.25, 1.0 - slope * 2.2) * (1.0 - wear * 0.97) * (1.0 - 0.45 * smoothstep(0.3, 0.5, road) * (1.0 - wear));
  var cov = max(lying, dust * smoothstep(0.50, 0.80, sn * 0.75 + fbm(p * 0.07 + 11.0) * 0.5 + open * 0.08));
  // a thaw opens holes from the high points of the surface down
  cov = cov * smoothstep(F.snowp.y * 1.15 - 0.12, F.snowp.y * 1.15 + 0.10, sn * 0.7 + (1.0 - wear) * 0.25 + (0.3 - m.h * 5.0) + lying * 0.2) + 0.0;
  cov = clamp(mix(cov, smoothstep(0.42, 0.56, cov + (sn - 0.5) * 0.5 - m.h * 5.0 * det), mid), 0.0, 1.0);
  // age: wear packs it, edges and thaw grey it, new fall resets it
  let fresh = clamp(F.snowp.x * 3.0 + F.wx.y * 0.6, 0.0, 1.0);
  let age = clamp(wear * 0.75 + F.snowp.w * (0.5 + 0.6 * fbm(p * 0.13)) + (1.0 - cov) * 0.5 + F.snowp.y * 0.5 - fresh * 0.55 * (1.0 - wear * 0.6), 0.0, 1.0);
  if (cov > 0.0) {
    var s = snowMat(p, age, det);
    s.h += 0.03;
    // slush where wheels pass in a thaw
    s.c = mix(s.c, vec3f(0.20, 0.19, 0.18), wear * F.snowp.y * 0.8);
    m = Mat(mix(m.c, s.c, cov), mix(m.h, s.h, cov), mix(m.r, s.r, cov), mix(m.g, s.g, cov));
  }

  // wet: darker, glossier; standing water lies flat and mirrors
  let wet = clamp(wetAir * (1.0 - cov * 0.8) + puddle + F.snowp.y * 0.4 * (1.0 - cov), 0.0, 1.0);
  m.c *= 1.0 - 0.42 * wet * (1.0 - cov);
  m.r = mix(m.r, 0.25, wet * 0.7); m.g = mix(m.g, 0.5, wet * 0.6);
  var bump = m.h;
  if (puddle > 0.0) {
    bump = mix(bump, 0.0, puddle);
    m.c = mix(m.c, m.c * 0.35, puddle); m.r = mix(m.r, 0.03, puddle); m.g = mix(m.g, 1.0, puddle);
    bump += rainRings(p) * 0.0015 * F.wx.x * puddle;
  }
  // the bump bends the normal (Mikkelsen 2010, surface gradient from screen derivatives)
  if (det > 0.0) {
    let dpx = dpdx(v.wp); let dpy = dpdy(v.wp); let dhx = dpdx(bump); let dhy = dpdy(bump);
    let r1 = cross(dpy, n); let r2 = cross(n, dpx); let dt = dot(dpx, r1);
    let g = (r1 * dhx + r2 * dhy) * sign(dt);
    let bent = abs(dt) * n - g * 1.6;
    if (dot(bent, bent) > 1e-20) { n = normalize(mix(n, normalize(bent), det)); }
  }

  // light: the sky through the crowns, the key light, every lamp
  let floorLight = mix(1.0, 0.16, cover) * (0.80 + 0.20 * hollow) * (1.0 - 0.5 * na.a);
  let ndl = clamp((dot(n, F.key.xyz) + 0.25 * cov) / (1.0 + 0.25 * cov), 0.0, 1.0);
  var keyShade = groundShadow(vec3f(v.wp.x, trueGround, v.wp.z) + vec3f(0.0, 6.0, 0.0)) * keyShadow(v.wp, n);
  if (F.shp.x < 0.5) { keyShade *= mix(1.0, 0.12, cover); }
  var lit = m.c * (F.amb.rgb * (0.55 + 0.45 * n.y) * floorLight + F.keyCol.rgb * F.key.w * ndl * keyShade);
  lit += m.c * F.ev.w * vec3f(0.7, 0.75, 0.9);
  lit += lampLight(v.wp, n, -view, m.c, m.r, m.g, 0.3 * cov);
  // far towns still glow on their ground where the lamps are too far to count one by one
  let pool = smoothstep(0.35, 0.8, vnoise(p * 0.011)) * (0.4 + 0.6 * vnoise(p * 0.07));
  lit += m.c * aux.a * aux.a * F.misc.x * mix(vec3f(1.0, 0.55, 0.16), F.lamp.rgb, 0.3) * 1.6 * pool * smoothstep(250.0, 900.0, dist);
  // what the wet and the ice mirror: the sky between the crowns
  let fres = m.g * (0.04 + 0.96 * pow(1.0 - max(dot(-view, n), 0.0), 5.0));
  let r = reflect(view, n);
  var mirrored = skyBase(vec3f(r.x, abs(r.y), r.z)) * mix(1.0, 0.35, cover);
  if (F.view.w > 0.5 && F.clip.z < 0.5 && abs(v.wp.y - F.view.z) < 0.6 && m.g > 0.2) {
    // the mirror was drawn for a level plane at the walker's feet: good for a yard, a lane, a puddle
    let suv = v.clip.xy / F.view.xy + n.xz * vec2f(0.06, 0.10);
    mirrored = mix(mirrored, textureSampleLevel(mirrorTex, samp, clamp(suv, vec2f(0.001), vec2f(0.999)), 0.0).rgb, smoothstep(0.6, 0.25, abs(v.wp.y - F.view.z)));
  }
  lit = mix(lit, mirrored, clamp(fres, 0.0, 1.0));
  // new snow glints
  if (cov > 0.2 && det > 0.0) {
    let cell = floor(v.wp.xz * 220.0);
    let gl = step(0.9965, hash21(cell)) * pow(max(dot(normalize(hash22(cell + 3.0).xyx - 0.5 + n * 1.2), normalize(F.key.xyz - view)), 0.0), 30.0);
    lit += (F.keyCol.rgb * F.key.w * keyShade + lampLight(v.wp, n, -view, vec3f(1.0), 1.0, 0.0, 1.0)) * gl * 9.0 * cov * det * (1.0 - age);
  }
  // rivers: a ribbon of dark water that takes the sky
  let river = smoothstep(0.30, 0.55, alb.a) * (1.0 - smoothstep(0.5, 0.75, slope));
  if (river > 0.0) {
    let fr = 0.04 + 0.96 * pow(1.0 - max(-view.y, 0.0), 5.0);
    let waterCol = mix(vec3f(0.02, 0.035, 0.04) * (F.amb.rgb + F.keyCol.rgb * F.key.w), skyBase(reflect(view, vec3f(0.0, 1.0, 0.0))), 0.25 + 0.75 * fr);
    lit = mix(lit, waterCol, river);
  }
  return vec4f(inAir(lit, v.wp), 1.0);
}

// wave slope from sliding noises; wind lengthens the swell
fn waveNormal(xz: vec2f, dist: f32) -> vec3f {
  let t = F.cam.w; let w = 0.4 + F.wx.z;
  let e = 0.6;
  var g = vec2f(0.0);
  let p1 = xz * 0.045 + vec2f(t * 0.6, t * 0.25) * w;
  let p2 = xz * 0.17 - vec2f(t * 0.5, -t * 0.8) * w;
  let p3 = xz * 0.008 + vec2f(-t * 0.12, t * 0.2) * w;
  g += vec2f(vnoise(p1 + vec2f(e, 0.0)) - vnoise(p1 - vec2f(e, 0.0)), vnoise(p1 + vec2f(0.0, e)) - vnoise(p1 - vec2f(0.0, e))) * 0.32;
  g += vec2f(vnoise(p2 + vec2f(e, 0.0)) - vnoise(p2 - vec2f(e, 0.0)), vnoise(p2 + vec2f(0.0, e)) - vnoise(p2 - vec2f(0.0, e))) * 0.30 * (1.0 - smoothstep(200.0, 1500.0, dist));
  let p4 = xz * 0.9 + vec2f(t * 1.1, t * 0.7) * w;
  g += vec2f(vnoise(p4 + vec2f(e, 0.0)) - vnoise(p4 - vec2f(e, 0.0)), vnoise(p4 + vec2f(0.0, e)) - vnoise(p4 - vec2f(0.0, e))) * 0.16 * (1.0 - smoothstep(30.0, 250.0, dist));
  g += vec2f(vnoise(p3 + vec2f(e, 0.0)) - vnoise(p3 - vec2f(e, 0.0)), vnoise(p3 + vec2f(0.0, e)) - vnoise(p3 - vec2f(0.0, e))) * 0.22;
  g *= w * (1.0 - 0.6 * smoothstep(3000.0, 30000.0, dist));
  return normalize(vec3f(-g.x, 1.0, -g.y));
}

// What water looks like at a surface point with `depth` metres under it. a is how solid it reads.
// px is the pixel, for the mirror pass.
fn waterColour(p: vec3f, depth: f32, px: vec2f) -> vec4f {
  let dist = distance(p, F.cam.xyz);
  let view = normalize(p - F.cam.xyz);
  let n = waveNormal(p.xz, dist);
  let r = reflect(view, n);
  let fres = 0.03 + 0.97 * pow(1.0 - max(dot(-view, n), 0.0), 5.0);
  // the body of the water: shallow shows the bed, deep goes to black-green
  let lightAll = F.amb.rgb + F.keyCol.rgb * F.key.w * max(F.key.y, 0.0);
  let shallow = vec3f(0.10, 0.16, 0.15); let deep = vec3f(0.012, 0.03, 0.04);
  let body = mix(shallow, deep, 1.0 - exp(-depth * 0.35)) * lightAll;
  var mirror = skyBase(vec3f(r.x, abs(r.y), r.z));
  if (F.view.w > 0.5 && F.clip.z < 0.5) {
    // Still water doubles what stands over it. A ripple moves the image far more up and down
    // than sideways at a low angle, so each lamp becomes a long broken streak toward the eye.
    let suv = px / F.view.xy;
    let lean = 1.0 / max(-view.y, 0.04);
    var acc = vec3f(0.0);
    for (var k = 0; k < 5; k++) {
      let fk = f32(k);
      let q = p.xz * (0.35 + 0.22 * fk) + vec2f(F.cam.w * (0.17 + 0.05 * fk), F.cam.w * 0.11 - fk * 3.0);
      let wob = (vnoise(q) - 0.5) + (vnoise(q * 3.1 + 9.0) - 0.5) * 0.5;
      let off = vec2f(n.x * 0.03 + wob * 0.002, (n.z * 0.5 + wob) * 0.0042 * min(lean, 14.0) * (0.5 + F.wx.z));
      acc += textureSampleLevel(mirrorTex, samp, clamp(suv + off, vec2f(0.001), vec2f(0.999)), 0.0).rgb;
    }
    mirror = acc / 5.0;
  }
  var col = mix(body, mirror, fres);
  // the path of the light on the water
  let spec = pow(max(dot(r, F.key.xyz), 0.0), 220.0) * 6.0 + pow(max(dot(r, F.key.xyz), 0.0), 24.0) * 0.25;
  col += F.keyCol.rgb * F.key.w * spec * (1.0 - 0.8 * F.horizon.a);
  // far towns: their glow on the water where the mirror does not reach
  let aux = textureSampleLevel(auxTex, samp, p.xz / F.world.xy, 1.0);
  col += aux.a * F.misc.x * F.lamp.rgb * 0.6 * pow(vnoise(vec2f(p.x * 0.03, p.z * 0.004 + F.cam.w * 0.05)), 3.0) * (1.0 - F.view.w);
  col += lampLight(p, n, -view, vec3f(0.0), 0.05, 1.0, 0.0);
  // foam where the water is thin and the wind is up
  let foam = (1.0 - smoothstep(0.0, 1.6 + 2.5 * F.wx.z, depth)) * smoothstep(0.45, 0.75, vnoise(p.xz * 0.35 + F.cam.w * 0.3)) * (0.3 + F.wx.z) * (1.0 - smoothstep(400.0, 2500.0, dist));
  col = mix(col, lightAll * 0.8, clamp(foam, 0.0, 1.0));
  col += F.ev.w * vec3f(0.35, 0.4, 0.5) * fres;
  return vec4f(inAir(col, p), clamp(0.55 + depth * 0.5 + fres, 0.0, 1.0));
}

@fragment fn fsWater(v: VOut) -> @location(0) vec4f {
  if (v.wet < 0.5) { discard; }
  let depth = v.wp.y - rasterAt(v.wp.xz);
  if (depth < 0.0) { discard; }
  return waterColour(v.wp, depth, v.clip.xy);
}
