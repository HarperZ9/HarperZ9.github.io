// Trees and what grows under them: instanced meshes of tubes and drawn cards (flora/grow.mjs),
// and the far forest as one upright card a tree, cut from a sheet on which every form was drawn
// once (the bake entry point draws that sheet).
// An instance is 8 floats: place, turn; size, seed, form, height in metres.

struct TOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) uv: vec2f,
  @location(3) m: vec4f,
  @location(4) @interpolate(flat) inst: vec4f,   // seed, height m, base y, size
  @location(5) local: vec3f,
}

@vertex fn vsTree(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) m: vec4f, @location(4) i0: vec4f, @location(5) i1: vec4f) -> TOut {
  var l = pos * i1.x;
  // wind: the whole tree leans from the butt, and the foliage shivers on top of that
  let w = F.wx.z; let t = F.cam.w; let ph = i1.y * 6.28;
  let gust = sin(t * 0.45 + i0.x * 0.021 + i0.z * 0.017) * 0.5 + 0.5;
  let bend = (sin(t * (0.9 + 0.4 * i1.y) + ph) * 0.6 + sin(t * 2.1 + ph * 1.7) * 0.2 + 0.5) * w * (0.35 + gust);
  let hgt = max(l.y, 0.0);
  l.x += bend * hgt * hgt * 0.0020; l.z += bend * hgt * hgt * 0.0011;
  if (m.x > 0.5 && m.x < 1.5) {
    let fl = m.z * (0.02 + w) * (0.3 + gust);
    l += vec3f(sin(t * 3.1 + pos.x * 2.0 + ph), sin(t * 2.3 + pos.z * 1.7) * 0.6, cos(t * 2.7 + pos.y * 1.3 + ph)) * 0.045 * fl;
  }
  let c = cos(i0.w); let s = sin(i0.w);
  var o: TOut;
  o.wp = vec3f(l.x * c + l.z * s, l.y, -l.x * s + l.z * c) + i0.xyz;
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.n = vec3f(nrm.x * c + nrm.z * s, nrm.y, -nrm.x * s + nrm.z * c);
  o.uv = uv; o.m = m;
  o.inst = vec4f(i1.y, i1.w, i0.y, i1.x);
  o.local = l;
  return o;
}

// bark by species: p is metres round the stem and metres along it, h the height above the butt
fn bark(sp: f32, p: vec2f, h: f32, tall: f32) -> vec3f {
  var c: vec3f;
  if (sp < 0.5) {            // spruce: thin grey-brown scales
    let v = voro(vec2f(p.x * 7.0, p.y * 4.0));
    c = mix(vec3f(0.050, 0.040, 0.035), vec3f(0.105, 0.088, 0.078), v.z) * (0.45 + 0.55 * smoothstep(0.0, 0.12, v.y));
    c = mix(c, vec3f(0.17, 0.19, 0.155), smoothstep(0.60, 0.72, vnoise(p * 1.3 + 4.0)) * 0.7);
  } else if (sp < 1.5) {     // pine: deep plates below, orange flakes above
    let v = voro(vec2f(p.x * 5.0, p.y * 1.6));
    let low = mix(vec3f(0.060, 0.047, 0.040), vec3f(0.125, 0.092, 0.072), v.z) * (0.4 + 0.6 * smoothstep(0.0, 0.15, v.y));
    let f = voro(vec2f(p.x * 9.0, p.y * 5.0));
    let high = vec3f(0.30, 0.135, 0.052) * (0.65 + 0.6 * f.z) * (0.7 + 0.3 * smoothstep(0.0, 0.1, f.y));
    c = mix(low, high, smoothstep(0.42, 0.62, h / max(tall, 1.0)));
  } else if (sp < 2.5) {     // cedar: long fibrous strips, red-brown going grey
    let f = vnoise(vec2f(p.x * 34.0, p.y * 1.1)); let g = vnoise(vec2f(p.x * 9.0, p.y * 0.4) + 7.0);
    c = mix(vec3f(0.062, 0.040, 0.030), vec3f(0.165, 0.105, 0.078), f * 0.7 + g * 0.3);
    c = mix(c, vec3f(0.135, 0.128, 0.120), smoothstep(0.45, 0.8, vnoise(p * 0.7)) * 0.6);
  } else if (sp < 3.5) {     // birch: white, with dark lenticels, black scars, a rough dark butt
    c = vec3f(0.50, 0.485, 0.45) * (0.82 + 0.3 * vnoise(vec2f(p.x * 3.0, p.y * 1.0)));
    c = mix(c, vec3f(0.42, 0.33, 0.27), smoothstep(0.55, 0.8, vnoise(p * vec2f(1.5, 0.6) + 3.0)) * 0.5);
    c *= 1.0 - 0.78 * smoothstep(0.60, 0.72, vnoise(vec2f(p.x * 9.0, p.y * 70.0)));
    let s = voro(vec2f(p.x * 2.2, p.y * 0.9));
    c = mix(c, vec3f(0.022, 0.020, 0.018), smoothstep(0.16, 0.07, s.x + abs(fract(p.y * 0.9) - 0.5) * 0.1));
    let butt = smoothstep(2.2, 0.4, h + vnoise(p * 2.0) * 1.2);
    let fis = voro(vec2f(p.x * 6.0, p.y * 1.4));
    c = mix(c, vec3f(0.050, 0.044, 0.040) * (0.5 + 0.5 * smoothstep(0.0, 0.14, fis.y)), butt);
  } else {                   // a dead stem, bleached, cracked along the grain
    let f = vnoise(vec2f(p.x * 26.0, p.y * 0.9));
    c = vec3f(0.17, 0.165, 0.155) * (0.55 + 0.6 * f);
  }
  return c;
}

struct Surf { alb: vec3f, n: vec3f, soft: f32, snow: f32 }

fn treeSurface(v: TOut, front: bool) -> Surf {
  var s: Surf;
  s.n = normalize(v.n); s.soft = 0.0; s.snow = 0.0;
  let h = v.wp.y - v.inst.z;
  // lying snow loads a tree; a first snow only frosts the skin of the crown
  let cold = max(snowCold(v.wp), F.snowp.z * 0.5 * smoothstep(0.5, 1.0, v.m.w));
  if (v.m.x < 0.5) {
    s.alb = bark(v.m.y, vec2f(v.uv.x * max(v.m.z, 0.1), v.uv.y * v.inst.w), h, v.inst.y);
    // moss climbs the butt and the wet side of the stem
    let mossy = smoothstep(1.6, 0.1, h + fbm(v.wp.xz * 1.7 + v.wp.y) * 2.0) * 0.8 + smoothstep(0.55, 0.75, fbm(vec2f(v.uv.x * 3.0 + v.inst.x * 9.0, v.wp.y * 0.35))) * max(-s.n.z, 0.0) * 0.6;
    if (v.m.y < 3.5 && v.m.y > -0.5) { s.alb = mix(s.alb, vec3f(0.050, 0.078, 0.022) * (0.7 + 0.6 * vnoise(v.wp.xz * 40.0 + v.wp.y * 30.0)), clamp(mossy, 0.0, 1.0) * (0.35 + 0.65 * F.wx.w)); }
    // snow sticks to the top of a limb and the weather side of a stem
    s.snow = cold * (smoothstep(0.35, 0.8, s.n.y) + 0.35 * smoothstep(0.3, 0.9, s.n.x * 0.8 + s.n.z * 0.6) * smoothstep(0.45, 0.7, vnoise(vec2f(v.uv.x * 5.0, v.wp.y * 1.5))));
  } else if (v.m.x > 1.5) {
    // a boulder: the rock of the ground, moss on its head
    let dist = distance(v.wp, F.cam.xyz);
    let rk = rockMat(v.wp * 1.7, 1.0 - smoothstep(6.0, 30.0, dist));
    let top = smoothstep(0.35, 0.8, s.n.y + (fbm(v.wp.xz * 2.1) - 0.5) * 0.7);
    s.alb = mix(rk.c, mossMat(v.wp.xz * 1.5, 1.0).c, top * (0.45 + 0.5 * F.wx.w));
    s.snow = cold * smoothstep(0.5, 0.85, s.n.y) * 1.6;
  } else {
    let tx = textureSample(atlasTex, rsamp, v.uv);
    // a thin twig is less than a texel wide from far off: count what coverage is left as more
    // a twig thinner than a texel would vanish in the small copies of the sheet, so the cut is
    // made on a copy no smaller than a third, and a card too far to show twigs at all is dropped
    let lod = log2(max(max(length(dpdx(v.uv)), length(dpdy(v.uv))) * 2048.0, 1.0));
    let thin = v.m.z < 0.2 || v.m.z > 1.3;
    if (thin && lod > 5.2) { discard; }
    if (textureSampleLevel(atlasTex, rsamp, v.uv, min(lod, select(1.4, 1.6, thin))).a < 0.33) { discard; }
    s.alb = tx.rgb;
    if (v.m.y >= 2.0) { s.alb = vec3f(lum(tx.rgb)) * vec3f(0.95, 0.90, 0.84); }   // dead twigs: grey
    else { s.alb *= 0.78 + 0.5 * fract(v.m.y * 7.31 + v.inst.x * 3.7); }
    s.soft = 0.45;
    // a card is seen from both sides: its normal turns to the eye
    if (!front) { s.n = -s.n; }
    // frost sits on some needles and not on others: a speckle on the skin of the crown, never a wash
    let grain = vnoise(v.uv * 520.0) * 0.55 + vnoise(v.wp.xz * 2.3 + v.wp.y * 1.1) * 0.45;
    s.snow = smoothstep(0.80 - 0.42 * cold, 0.88 - 0.42 * cold, grain + s.n.y * 0.12) * step(0.02, cold) * select(1.0, 0.0, thin) * select(1.0, 0.4, v.inst.y > 39.5);
    // needles are not one green: the sheet's own lights and darks carry further
    s.alb *= 0.7 + 1.3 * smoothstep(0.02, 0.12, lum(tx.rgb));
  }
  s.alb = mix(s.alb, vec3f(0.84, 0.87, 0.92), clamp(s.snow, 0.0, 1.0));
  return s;
}

// the light on anything that stands in the forest: the sky through the crowns, the key light, the lamps
fn standLight(wp: vec3f, n: vec3f, alb: vec3f, shade: f32, soft: f32, h: f32, top: f32) -> vec3f {
  let view = normalize(wp - F.cam.xyz);
  let nu = nearUV(wp.xz);
  let crown = textureSampleLevel(nearA, samp, nu.xy, 0.0).r * nu.z;
  // under the crowns little sky reaches the floor; a crown's own top sees all of it
  let up = clamp(h / max(top * 0.8, 0.5), 0.0, 1.0);
  let skyVis = mix(mix(1.0, 0.17, crown), 1.0, up * up) * shade;
  var keyVis = keyShadow(wp, n) * shade;
  if (F.shp.x < 0.5) { keyVis *= mix(mix(1.0, 0.12, crown), 1.0, up * up); }
  let ndl = clamp((dot(n, F.key.xyz) + soft) / (1.0 + soft), 0.0, 1.0);
  let through = soft * pow(max(dot(view, F.key.xyz), 0.0), 3.0) * 0.6;
  var lit = alb * (F.amb.rgb * (0.6 + 0.4 * n.y) * skyVis + F.keyCol.rgb * F.key.w * (ndl + through) * keyVis);
  lit += alb * F.ev.w * vec3f(0.7, 0.75, 0.9);
  lit += lampLight(wp, n, -view, alb, 0.9, 0.0, soft) * mix(0.5, 1.0, shade);
  return lit;
}

@fragment fn fsTree(v: TOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  let s = treeSurface(v, front);
  let lit = standLight(v.wp, s.n, s.alb, v.m.w, s.soft, v.wp.y - v.inst.z, v.inst.y);
  return vec4f(inAir(lit, v.wp), 1.0);
}
// the sheet of far trees: colour and shade only, no light, so the far card can be lit where it stands
@fragment fn fsTreeBake(v: TOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let s = treeSurface(v, front);
  return vec4f(s.alb * mix(0.55, 1.0, v.m.w), 1.0);
}
// depth alone, for the shadow map: a card casts the shape drawn on it
@fragment fn fsTreeShadow(v: TOut) {
  if (v.m.x > 0.5 && v.m.x < 1.5 && textureSample(atlasTex, rsamp, v.uv).a < 0.33) { discard; }
}

struct FOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) uv: vec2f,
  @location(2) q: vec2f,
  @location(3) @interpolate(flat) inst: vec4f,
  @location(4) right: vec3f,
}
// the sheet holds 6 forms across and 2 down; each cell is half as wide as it is tall
@vertex fn vsFar(@builtin(vertex_index) vi: u32, @location(0) i0: vec4f, @location(1) i1: vec4f) -> FOut {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  let to = normalize(vec3f(F.cam.x - i0.x, 0.0, F.cam.z - i0.z));
  let right = vec3f(to.z, 0.0, -to.x);
  let tall = i1.w;
  var o: FOut;
  o.wp = i0.xyz + right * (corner.x * 2.0 - 1.0) * tall * 0.25 + vec3f(0.0, corner.y * tall, 0.0);
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  let col = i1.z - 6.0 * floor(i1.z / 6.0); let row = floor(i1.z / 6.0);
  let flip = step(0.5, fract(i1.y * 17.0));
  let cx = mix(corner.x, 1.0 - corner.x, flip);
  o.uv = vec2f((col + mix(0.01, 0.99, cx)) / 6.0, (row + mix(0.995, 0.005, corner.y)) / 2.0);
  o.q = vec2f(corner.x * 2.0 - 1.0, corner.y);
  o.inst = vec4f(i1.y, tall, i0.y, i1.x);
  o.right = right;
  return o;
}
@fragment fn fsFar(v: FOut) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  let tx = textureSample(farTex, samp, v.uv);
  if (tx.a < 0.4) { discard; }
  // a round crown: the normal leans out to the sides and up toward the top
  let to = cross(v.right, vec3f(0.0, 1.0, 0.0));
  let n = normalize(v.right * v.q.x * 0.8 - to * 0.55 + vec3f(0.0, 0.25 + 0.5 * v.q.y, 0.0));
  var alb = tx.rgb * (0.85 + 0.3 * fract(v.inst.x * 5.3));
  let cold = max(snowCold(v.wp), F.snowp.z * 0.35);
  alb = mix(alb, vec3f(0.84, 0.87, 0.92), cold * 0.14 * smoothstep(0.1, 0.5, lum(tx.rgb) * 9.0));
  let lit = standLight(v.wp, n, alb, 1.0, 0.4, v.wp.y - v.inst.z, v.inst.y);
  return vec4f(inAir(lit, v.wp), 1.0);
}
