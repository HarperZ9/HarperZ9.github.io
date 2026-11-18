// What people have built, drawn from meshes made by rule (build/): houses of the snow town and
// the steel of the works. A vertex is 12 floats: place (metres from the chunk's corner), normal,
// uv, then a material and three numbers it reads:
//   10 timber wall (tone)          11 roof metal (tone)        12 snow on a roof
//   13 window (lit, hue, panes)    14 door (tone)              15 stone footing
//   16 light: colour               17 icicles (atlas card)
//   20 painted steel: colour       21 rusted plate (tone)      22 concrete (tone)
//   23 lattice (atlas card; tone)  24 lagged pipe (tone)       25 ribbed sheet: colour
//   26 banded stack (height m)     27 lit strip of shed windows (seed)
// An instance is the chunk's corner in the world.

struct BOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) m: vec4f,
}

@vertex fn vsBuilt(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) m: vec4f, @location(4) i0: vec4f) -> BOut {
  var o: BOut;
  o.wp = pos + i0.xyz;
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.n = nrm; o.uv = uv; o.m = m;
  return o;
}

// rust: plate gone orange-brown in streaks that run down from every seam
fn rust(p: vec2f, tone: f32) -> vec3f {
  let run = fbm(vec2f(p.x * 1.3, p.y * 0.22) + tone * 9.0);
  let blotch = fbm(p * 0.6 + 3.0);
  var c = mix(vec3f(0.070, 0.036, 0.022), vec3f(0.215, 0.085, 0.030), run);
  c = mix(c, vec3f(0.045, 0.040, 0.040), smoothstep(0.5, 0.75, blotch) * 0.7);
  return c * (0.8 + 0.4 * vnoise(p * 9.0));
}

@fragment fn fsBuilt(v: BOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  var n = normalize(v.n);
  let view = normalize(v.wp - F.cam.xyz);
  let dist = distance(v.wp, F.cam.xyz);
  let det = 1.0 - smoothstep(8.0, 40.0, dist);
  let k = v.m.x; let night = F.misc.x;
  var alb = vec3f(0.1); var rough = 0.85; var gloss = 0.03; var glow = vec3f(0.0); var wrap = 0.0; var card = false;
  let cold = snowCold(v.wp);
  if (k < 10.5) {
    // boards a hand wide, tarred, the grain running up; pale where the weather has had them
    let b = v.uv.x / 0.15; let id = hash21(vec2f(floor(b), v.m.y * 31.0));
    let gap = smoothstep(0.0, 0.06, abs(fract(b) - 0.5) * -2.0 + 1.0);
    let grain = vnoise(vec2f(v.uv.x * 60.0, v.uv.y * 3.0 + id * 9.0));
    alb = mix(vec3f(0.030, 0.023, 0.018), vec3f(0.085, 0.060, 0.042), id * 0.6 + grain * 0.4) * (0.5 + 0.5 * gap) * (0.8 + 0.4 * v.m.y);
    alb = mix(alb, vec3f(0.16, 0.15, 0.14), smoothstep(0.55, 0.9, fbm(v.uv * vec2f(0.8, 0.3) + v.m.y * 7.0)) * 0.5);
    // snow blown against the foot of the wall
    alb = mix(alb, vec3f(0.80, 0.84, 0.90), cold * smoothstep(0.9, 0.2, v.uv.y + vnoise(v.uv * vec2f(1.2, 3.0)) * 0.7));
    gloss = 0.05 * F.wx.w;
  } else if (k < 11.5) {
    let rib = abs(fract(v.uv.x / 0.4) - 0.5);
    alb = mix(vec3f(0.035, 0.036, 0.040), vec3f(0.070, 0.050, 0.040), fbm(v.uv * 0.9 + v.m.y * 5.0)) * (0.7 + 0.3 * smoothstep(0.0, 0.06, rib));
    rough = 0.5; gloss = 0.3;
  } else if (k < 12.5) {
    let s = snowMat(v.wp.xz + v.wp.y * 0.7, clamp(v.m.y + F.snowp.w * 0.5 - F.wx.y * 0.4, 0.0, 1.0), det);
    alb = s.c; rough = s.r; gloss = s.g; wrap = 0.45;
    // the load is rounded by wind: the normal rolls with a slow noise
    let e = 0.2;
    let g = vec2f(fbm(v.wp.xz * 0.9 + vec2f(e, 0.0)) - fbm(v.wp.xz * 0.9 - vec2f(e, 0.0)), fbm(v.wp.xz * 0.9 + vec2f(0.0, e)) - fbm(v.wp.xz * 0.9 - vec2f(0.0, e)));
    n = normalize(n + vec3f(-g.x, 0.0, -g.y) * 0.9);
    // a thaw greys it and wets its edge
    alb = mix(alb, alb * vec3f(0.62, 0.64, 0.68), F.snowp.y * 0.6);
  } else if (k < 13.5) {
    // a window: a frame, glazing bars, and behind them a room. Lit rooms differ: paper screens,
    // a bare bulb, a curtain half drawn. Lamps come on after the sky has gone.
    let panes = max(v.m.w, 1.0);
    let q = v.uv * vec2f(panes, max(floor(panes * 0.75), 1.0));
    let bar = min(min(fract(q.x), 1.0 - fract(q.x)), min(fract(q.y), 1.0 - fract(q.y)));
    let frame = min(min(v.uv.x, 1.0 - v.uv.x), min(v.uv.y, 1.0 - v.uv.y));
    let wood = step(bar, 0.07) + step(frame, 0.045);
    let lit = step(0.5, v.m.y) * smoothstep(0.25, 0.7, night + (v.m.y - 0.75) * 0.6);
    var hue = mix(vec3f(1.0, 0.70, 0.36), vec3f(1.0, 0.86, 0.62), fract(v.m.z * 3.0));
    if (v.m.z > 0.86) { hue = vec3f(0.62, 0.86, 1.0); }
    let paper = 0.55 + 0.45 * vnoise(v.uv * vec2f(3.0, 5.0) + v.m.z * 40.0);
    let curtain = smoothstep(0.35, 0.3, abs(v.uv.x - 0.5 - (fract(v.m.z * 7.0) - 0.5) * 0.8)) * step(0.6, fract(v.m.z * 11.0));
    // the room: brightest low down where the lamp stands, a shadow crossing it
    let room = (0.35 + 0.65 * smoothstep(1.0, 0.2, v.uv.y)) * paper * (1.0 - 0.6 * curtain);
    alb = mix(vec3f(0.012, 0.016, 0.022), vec3f(0.05, 0.04, 0.035), min(wood, 1.0));
    glow = hue * lit * room * 0.5 * (1.0 - min(wood, 1.0));
    rough = 0.1; gloss = 0.22 * (1.0 - min(wood, 1.0)) * (1.0 - lit);
    // frost creeps in from the corners of cold glass
    let fr = cold * smoothstep(0.30, 0.0, frame + vnoise(v.uv * 14.0) * 0.14);
    alb = mix(alb, vec3f(0.5, 0.55, 0.6), fr * (1.0 - min(wood, 1.0))); glow *= 1.0 - 0.5 * fr;
  } else if (k < 14.5) {
    let b = v.uv.x / 0.2;
    alb = mix(vec3f(0.05, 0.030, 0.020), vec3f(0.11, 0.055, 0.030), v.m.y) * (0.6 + 0.4 * smoothstep(0.0, 0.05, abs(fract(b) - 0.5)));
  } else if (k < 15.5) {
    let c = voro(v.uv * vec2f(2.2, 3.4));
    alb = mix(vec3f(0.035, 0.035, 0.04), vec3f(0.085, 0.08, 0.078), c.z) * (0.4 + 0.6 * smoothstep(0.0, 0.08, c.y));
    alb = mix(alb, vec3f(0.80, 0.84, 0.90), cold * smoothstep(0.8, 0.3, v.uv.y + vnoise(v.uv * 2.0) * 0.5));
  } else if (k < 16.5) {
    // a lit box: brighter at its heart than at its edge, like paper round a flame
    alb = v.m.yzw * 0.2;
    let heart = 0.45 + 0.55 * smoothstep(0.0, 0.5, min(min(fract(v.uv.x * 0.9999), 1.0 - fract(v.uv.x * 0.9999)), 0.5));
    glow = v.m.yzw * (0.04 + 0.96 * smoothstep(0.2, 0.75, night)) * 0.5 * heart;
  } else if (k < 17.5 || (k > 22.5 && k < 23.5)) {
    let tx = textureSample(atlasTex, rsamp, v.uv);
    let lod = log2(max(max(length(dpdx(v.uv)), length(dpdy(v.uv))) * 2048.0, 1.0));
    if (textureSampleLevel(atlasTex, rsamp, v.uv, min(lod, 2.5)).a < 0.4) { discard; }
    card = true;
    if (k < 17.5) { alb = vec3f(0.55, 0.62, 0.70); rough = 0.08; gloss = 0.8; wrap = 0.6; }
    else { alb = mix(rust(v.wp.xy + v.wp.zz, v.m.y), tx.rgb * vec3f(0.30, 0.31, 0.33), step(0.5, v.m.y)); rough = 0.6; gloss = 0.15; }
  } else if (k < 20.5) {
    // paint over steel: chipped at the edges, streaked under every bolt
    let chip = smoothstep(0.62, 0.8, fbm(v.wp.xz * 1.1 + v.wp.y * 1.7));
    alb = mix(v.m.yzw * (0.75 + 0.3 * vnoise(v.wp.xy * 3.0 + v.wp.z)), rust(v.wp.xy + v.wp.zz, 0.3), chip * 0.7);
    rough = 0.45; gloss = 0.2;
  } else if (k < 21.5) {
    alb = rust(vec2f(v.uv.x, v.uv.y), v.m.y); rough = 0.8; gloss = 0.05;
    // plates riveted in courses
    let course = abs(fract(v.uv.y / 2.4) - 0.5); alb *= 0.75 + 0.25 * smoothstep(0.0, 0.02, 0.5 - course);
  } else if (k < 22.5) {
    let c = concreteMat(v.uv, det);
    alb = c.c * (0.8 + 0.4 * v.m.y);
    // rain has run down it for years
    alb *= 0.65 + 0.35 * smoothstep(0.25, 0.7, fbm(vec2f(v.uv.x * 0.9, v.uv.y * 0.12) + v.m.y * 3.0));
    rough = 0.8;
  } else if (k < 24.5) {
    // lagging in sheet-metal jackets: bands every metre, dull silver
    let band = abs(fract(v.uv.y / 1.1) - 0.5);
    alb = mix(vec3f(0.20, 0.21, 0.22), vec3f(0.36, 0.37, 0.38), vnoise(vec2f(v.uv.y * 0.6, v.m.y * 9.0))) * (0.7 + 0.3 * smoothstep(0.0, 0.03, 0.5 - band));
    alb = mix(alb, rust(v.uv, v.m.y), smoothstep(0.6, 0.85, fbm(v.uv * 0.5 + v.m.y * 11.0)) * 0.6);
    rough = 0.35; gloss = 0.45;
  } else if (k < 25.5) {
    let rib = abs(fract(v.uv.x / 0.25) - 0.5);
    alb = v.m.yzw * (0.65 + 0.35 * smoothstep(0.05, 0.25, rib)) * (0.7 + 0.5 * fbm(vec2f(v.uv.x * 0.4, v.uv.y * 0.1)));
    alb = mix(alb, rust(v.uv, 0.5), smoothstep(0.55, 0.8, fbm(vec2f(v.uv.x * 0.7, v.uv.y * 0.2) + 5.0)) * 0.55);
    rough = 0.5; gloss = 0.2;
  } else if (k < 26.5) {
    // a stack: concrete, with red and white bands near its top
    let band = step(0.5, fract(v.uv.y / 18.0)) * step(v.m.y * 0.55, v.uv.y);
    alb = mix(vec3f(0.19, 0.185, 0.18) * (0.7 + 0.5 * fbm(vec2f(v.uv.x * 0.3, v.uv.y * 0.05))), mix(vec3f(0.5, 0.5, 0.48), vec3f(0.42, 0.045, 0.03), band), step(v.m.y * 0.55, v.uv.y));
  } else {
    // a strip of shed windows: most dark, some lit green-white, grime on all of them
    let pane = floor(v.uv.x / 1.4); let lit = step(0.45, hash21(vec2f(pane, v.m.y * 91.0)));
    let bar = step(abs(fract(v.uv.x / 1.4) - 0.5), 0.44) * step(abs(v.uv.y - 0.5), 0.42);
    alb = vec3f(0.02, 0.025, 0.03);
    glow = mix(vec3f(0.75, 1.0, 0.85), vec3f(1.0, 0.8, 0.5), step(0.8, hash21(vec2f(pane, 3.0)))) * lit * bar * (0.5 + 0.5 * vnoise(v.uv * 3.0)) * (0.1 + 1.2 * night);
    rough = 0.2; gloss = 0.4;
  }
  if (!front && card) { n = -n; }
  // snow on whatever faces the sky
  if (k > 19.5 || (k > 13.5 && k < 15.5)) { alb = mix(alb, vec3f(0.82, 0.85, 0.91), cold * smoothstep(0.55, 0.85, n.y)); }
  // wet steel and wet boards
  alb *= 1.0 - 0.3 * F.wx.w * (1.0 - cold);
  gloss = mix(gloss, max(gloss, 0.35), F.wx.w);
  let ndl = clamp((dot(n, F.key.xyz) + wrap) / (1.0 + wrap), 0.0, 1.0);
  var lit = alb * (F.amb.rgb * (0.6 + 0.4 * n.y) + F.keyCol.rgb * F.key.w * ndl * keyShadow(v.wp, n));
  lit += alb * F.ev.w * vec3f(0.7, 0.75, 0.9);
  lit += lampLight(v.wp, n, -view, alb, rough, gloss, wrap);
  let fres = gloss * (0.04 + 0.96 * pow(1.0 - max(dot(-view, n), 0.0), 5.0));
  let r = reflect(view, n);
  lit = mix(lit, skyBase(vec3f(r.x, abs(r.y), r.z)), clamp(fres, 0.0, 1.0) * 0.6);
  return vec4f(inAir(lit + glow, v.wp), 1.0);
}
@fragment fn fsBuiltShadow(v: BOut) {
  if ((v.m.x > 16.5 && v.m.x < 17.5) || (v.m.x > 22.5 && v.m.x < 23.5)) { if (textureSample(atlasTex, rsamp, v.uv).a < 0.4) { discard; } }
}
