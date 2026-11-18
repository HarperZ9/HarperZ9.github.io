// The sky, drawn as one triangle behind everything: the dome, sun and moon, stars and the Milky
// Way, a cloud layer with storm cells, and the optical events: a 22 degree halo, aurora, a comet.

struct SOut { @builtin(position) clip: vec4f, @location(0) ndc: vec2f }

@vertex fn vsSky(@builtin(vertex_index) i: u32) -> SOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: SOut; o.clip = vec4f(p, 0.0, 1.0); o.ndc = p; return o;
}

fn stars(d: vec3f) -> f32 {
  // cells on the unit sphere by projecting onto a cube of 220 cells a side
  let a = abs(d); var uv: vec2f; var face = 0.0;
  if (a.x > a.y && a.x > a.z) { uv = d.yz / a.x; face = 1.0 + step(0.0, d.x); }
  else if (a.y > a.z) { uv = d.xz / a.y; face = 3.0 + step(0.0, d.y); }
  else { uv = d.xy / a.z; face = 5.0 + step(0.0, d.z); }
  let g = uv * 110.0; let c = floor(g); let f = fract(g) - 0.5;
  let h = hash31(vec3f(c, face));
  let pos = vec2f(hash31(vec3f(c, face + 9.0)), hash31(vec3f(c, face + 17.0))) - 0.5;
  let r = length(f - pos * 0.7);
  let bright = pow(h, 14.0) * 5.0 + step(0.985, h) * 0.9;
  let twinkle = 0.8 + 0.2 * sin(F.cam.w * (2.0 + h * 5.0) + h * 40.0);
  return bright * smoothstep(0.11, 0.0, r) * twinkle;
}

@fragment fn fsSky(v: SOut) -> @location(0) vec4f {
  let far = F.invViewProj * vec4f(v.ndc, 0.5, 1.0);
  let d = normalize(far.xyz / far.w - F.cam.xyz);
  var col = skyBase(d);
  let cover = F.horizon.a;
  let up = max(d.y, 0.0);
  let night = F.misc.x;

  // stars and the Milky Way: a band of dense faint stars and dust along a tilted great circle
  if (F.zenith.a > 0.01 && d.y > -0.02) {
    let pole = normalize(vec3f(0.45, 0.55, -0.70));
    let band = exp(-pow(dot(d, pole) * 3.6, 2.0));
    let dust = fbm(vec2f(atan2(d.x, d.z) * 3.0, d.y * 5.0) + 3.0);
    let milky = band * (0.35 + 0.65 * dust) * vec3f(0.34, 0.38, 0.52) * 0.22;
    col += (vec3f(stars(d)) * (0.5 + 1.2 * band) + milky) * F.zenith.a * smoothstep(-0.02, 0.12, d.y);
  }

  // aurora: curtains in the northern sky, green below, violet above, slow folds
  if (F.ev.x > 0.01 && d.y > 0.02) {
    let north = smoothstep(0.35, -0.6, d.z);
    let t = F.cam.w * 0.02;
    // a curtain hangs along a wavy line on a plane 120 km up
    let p = d.xz / max(d.y, 0.05) * 1.2;
    let fold = fbm(vec2f(p.x * 0.35 + t, p.y * 0.12)) * 2.2;
    let line = abs(fract(p.y * 0.42 + fold) - 0.5) * 2.0;
    let curtain = pow(1.0 - line, 7.0) * (0.5 + 0.5 * vnoise(vec2f(p.x * 6.0 + t * 9.0, p.y * 0.7)));
    let height = smoothstep(0.03, 0.22, d.y) * (1.0 - smoothstep(0.45, 0.95, d.y));
    let hue = mix(vec3f(0.20, 1.0, 0.45), vec3f(0.55, 0.25, 0.9), smoothstep(0.2, 0.65, d.y + 0.25 * vnoise(p * 0.8)));
    col += hue * curtain * height * north * F.ev.x * 0.9;
  }

  // sun: a disc that reddens and widens as it sinks
  let sd = dot(d, F.sun.xyz);
  if (F.sun.w > 0.0) {
    let disc = smoothstep(0.99985, 0.99996, sd);
    col += F.glow.rgb * disc * 14.0 * F.sun.w * (1.0 - cover * 0.9);
  }
  // moon: a lit disc with a soft limb, and a small glow
  let md = dot(d, F.moon.xyz);
  if (F.moon.y > -0.05) {
    let disc = smoothstep(0.99990, 0.99996, md);
    let glow = pow(max(md, 0.0), 900.0) * 0.5 + pow(max(md, 0.0), 60.0) * 0.06;
    col += vec3f(0.92, 0.94, 1.0) * (disc * 2.2 + glow) * F.moon.w * (0.25 + 0.75 * night) * (1.0 - cover * 0.8);
  }
  // 22 degree halo round whichever is up: ice crystals put a ring at cos = 0.927, red on the inside
  if (F.ev.y > 0.01) {
    var c = md; if (F.sun.w > 0.0 && F.sun.y > 0.0) { c = sd; }
    let ang = acos(clamp(c, -1.0, 1.0)) * 57.2958;
    let ring = exp(-pow((ang - 22.3) / 0.9, 2.0));
    let inner = exp(-pow((ang - 21.7) / 0.5, 2.0));
    col += (vec3f(0.85, 0.88, 0.95) * ring + vec3f(0.5, 0.12, 0.05) * inner) * F.ev.y * 0.35;
  }
  // comet: a head low in the north-west and a tail pointing away from the sun's place below the horizon
  if (F.ev.z > 0.01) {
    let head = normalize(vec3f(-0.62, 0.30, -0.72));
    let tail = normalize(vec3f(-0.25, 0.9, -0.2));
    let hd = dot(d, head);
    let along = dot(d - head, tail);
    let across = length((d - head) - tail * along);
    let t = exp(-across * across * 2600.0 / (1.0 + along * 40.0)) * smoothstep(0.0, 0.01, along) * exp(-along * 9.0);
    col += vec3f(0.8, 0.9, 1.0) * (pow(max(hd, 0.0), 30000.0) * 3.0 + t * 0.5) * F.ev.z;
  }

  // clouds: a flat layer 2.4 km up, thickened and darkened where storm cells stand
  if (d.y > 0.004) {
    let p = d.xz / d.y * 2400.0 + F.cam.xz;
    let drift = vec2f(F.cam.w * 6.0 * (0.3 + F.wx.z), F.cam.w * 2.0);
    let base = fbm((p + drift) * 0.00016);
    let storm = F.misc.w * smoothstep(0.45, 0.8, fbm(p * 0.00004 + 9.0));
    let amount = smoothstep(1.0 - cover * 1.05 - storm * 0.4, 1.0 - cover * 1.05 + 0.28, base + 0.18 * fbm((p + drift * 2.0) * 0.0009));
    let sunSide = pow(max(sd, 0.0), 3.0);
    var cloud = mix(F.horizon.rgb * 1.15 + F.keyCol.rgb * F.key.w * 0.25, F.zenith.rgb * 0.45 + F.fog.rgb * 0.25, clamp(base * 1.2 + storm, 0.0, 1.0));
    cloud += F.glow.rgb * F.glow.a * sunSide * 0.55 * (1.0 - storm);
    cloud = mix(cloud, cloud * 0.35, storm);
    cloud += vec3f(0.8, 0.85, 1.0) * F.ev.w * (0.3 + storm);
    // moonlight through thin cloud
    cloud += vec3f(0.5, 0.55, 0.65) * pow(max(md, 0.0), 40.0) * F.moon.w * night * 0.5;
    let fade = smoothstep(0.004, 0.10, d.y);
    col = mix(col, cloud, amount * fade);
  }
  // precipitation veils the lower sky
  col = mix(col, F.fog.rgb, clamp((F.wx.x + F.wx.y) * 0.5 * (1.0 - up), 0.0, 0.8));
  return vec4f(toneMap(col), 1.0);
}
