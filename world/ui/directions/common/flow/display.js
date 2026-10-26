// display.js: how the medium is seen. Fields: dye = (pour A, sediment, pour B, -), vel = (vx, vy, temperature, -).
// Mode 0 is the ground: soak-stain pours (Frankenthaler: density varies, feathered bleeding edges, a crisp tide
// line only where the water has stopped), the page grid refracted through the water, slow caustics, one soft
// moving highlight, overprinted pours (multiply by day, screen by night). Mode 1 is the mosaic reading: tiny
// digit tesserae set as tone, laid in courses that turn along the current (andamento). Modes 2 to 5 solo a layer.
export const DISPLAY = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uDye, uVel; uniform vec3 uWall, uInk; uniform vec2 uRes; uniform float uCap, uDark, uCells, uPx, uTime;
uniform int uMode; uniform vec4 uLamp[4]; uniform int uNL; uniform vec4 uLampC; uniform vec4 uClear[8]; uniform int uNC; uniform float uFeather;
uniform vec4 uGrid[4]; uniform float uGridP[4]; uniform int uNG; uniform vec4 uGridC;

float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
float clearAt(vec2 dp){ float k = 1.;
  for (int i = 0; i < 8; i++) { if (i >= uNC) break; vec4 r = uClear[i];
    vec2 q = max(max(r.xy - dp, dp - r.zw), 0.); k = min(k, smoothstep(uFeather * .3, uFeather, length(q))); }
  return k; }
float lampAt(vec2 dp){ float a = 0.;
  for (int i = 0; i < 4; i++) { if (i >= uNL) break; vec4 L = uLamp[i]; a = max(a, 1. - clamp(length((dp - L.xy) / L.zw) / .7, 0., 1.)); }
  return a; }
// the page's twelve-column rules, drawn by the medium so the water can bend them (dp in device px, GL y up)
float gridAt(vec2 dp){ float g = 0.;
  for (int i = 0; i < 4; i++) { if (i >= uNG) break; vec4 r = uGrid[i];
    if (dp.x < r.x || dp.x > r.z || dp.y < r.y || dp.y > r.w) continue;
    float d = mod(dp.x - r.x, uGridP[i]); d = min(d, uGridP[i] - d);
    g = max(g, 1. - smoothstep(.5 * uPx, 1.1 * uPx, d)); }
  return g; }
vec2 warpAt(vec2 pc){                                          // the pour's outline wanders: a domain-warped lookup
  return (vec2(fbm(pc * .008), fbm(pc * .008 + 17.3)) - .5) * 44. * uPx / uRes; }
// Layers carry their own laws (BLEED.md section 9 and 11: the shared space has no law; a law is a weight on a shape).
// Each layer declares, through uLaw[i] = (law, weight, night, -):
//   law 0 trap    a sheet landing on ink already printed covers uTrap of it (kept for comparison; superseded);
//   law 4 density_add  printing ink over ink: densities add, and ink laid over ink adds only uDW of its density
//                 (lib/medium/sheets.mjs; beat the trap on held-out Olivetti patches, density rmse 0.298 to 0.399);
//   law 5 screen  light: 1 - (1 - c)(1 - cover * light);
//   law 1 weber   a transparent stack: each sheet adds less perceived density, ln(1 + a D / U) (Albers XX-1);
//   law 2 add     light: it adds;
//   law 3 multiply plain transmission, for anything that declares it.
// weight 0..1 multiplies the sheet's cover (0 leaves the colour as it was), as lib/medium/sheets.mjs reads it. night 1 means the layer prints as a
// negative by night (its own law, run on the inverted colour), so light pigment reads as light in dark water.
// Each layer applies its law to the colour as it finds it, in print order; nothing above the layers decides.
uniform float uTrap, uWeber, uDW; uniform vec4 uLaw[6];
vec3 L_(vec3 c){ return pow(max(c, vec3(0.)), vec3(2.2)); }
vec3 G_(vec3 c){ return pow(max(c, vec3(0.)), vec3(1. / 2.2)); }
float inked = 0.; vec3 wD = vec3(0.), wU = vec3(0.);
vec3 perceivedW(vec3 D, vec3 U){ return mix(D, U * log(1. + uWeber * D / max(U, vec3(1e-6))) / log(1. + uWeber), step(vec3(1e-6), U)); }
vec3 layer(vec3 col, int i, float cover, vec3 ink){
  vec4 L = uLaw[i]; int law = int(L.x); float w = clamp(L.y, 0., 1.); bool neg = L.z > .5 && uDark > .5;
  vec3 c0 = neg ? 1. - col : col, k = neg ? 1. - ink : ink, P = L_(c0), K = L_(k), r = P;
  float cv = clamp(cover * w, 0., 1.);   // the weight is the sheet's cover multiplier (agreed with lib/medium)
  if (law == 0) { float c = cv * (1. - (1. - uTrap) * inked); r = P * (1. - c * (1. - K)); inked = min(1., inked + cv); }
  else if (law == 1) { vec3 dd = -log(max(vec3(1e-4), 1. - cv * (1. - K))); vec3 before = perceivedW(wD, wU);
    wD += dd; wU = max(wU, dd); r = P * exp(-(perceivedW(wD, wU) - before)); }
  else if (law == 2) r = P + K * cv;
  else if (law == 4) { vec3 t = 1. - cv * (1. - K); r = inked > 0. ? P * pow(max(t, vec3(1e-4)), vec3(1. - (1. - uDW) * inked)) : P * t; inked = min(1., inked + cv); }
  else if (law == 5) r = 1. - (1. - P) * (1. - cv * K);
  else r = P * (1. - cv * (1. - K));
  vec3 out_ = G_(r);
  return neg ? 1. - out_ : out_; }

void main(){
  vec2 dp = vUv * uRes, pc = dp / uPx; vec4 v = texture(uVel, vUv);
  float clr = clearAt(dp);
  if (uMode == 1) {
    // mosaic reading: tesserae of uCells css px, each one digit (0 to 9) of the value under it, set small enough to
    // read as tone. Courses turn along the current; still water lays no tiles.
    vec2 fl = texture(uVel, vUv).xy; float sp = length(fl);
    float th = sp > .4 ? atan(fl.y, fl.x) : .35;
    mat2 R = mat2(cos(th), -sin(th), sin(th), cos(th));
    vec2 q = R * pc / uCells; vec2 id = floor(q), f = fract(q);
    vec2 cpc = (transpose(R) * ((id + .5) * uCells)); vec2 cuv = cpc * uPx / uRes;
    vec4 d = texture(uDye, cuv); vec4 vv = texture(uVel, cuv);
    float m = max(max(1. - exp(-(d.r + d.b) * 1.4), min(1., d.g * 2.)), max(clamp(vv.z, 0., 1.), clamp(length(vv.xy) * .03, 0., 1.)));
    float a = 0.;
    if (m > .05) {
      int dg = int(floor(min(m, .999) * 10.)); int G[10] = int[10](31599, 11415, 29671, 29647, 23497, 31183, 31215, 29257, 31727, 31695);
      int col = int(floor(f.x * 4.)), row = int(floor((1. - f.y) * 6.));            // 3 x 5 figure in a 4 x 6 cell
      if (col < 3 && row < 5 && ((G[dg] >> (14 - (row * 3 + col))) & 1) == 1) a = .18 + .62 * m;
    }
    o = vec4(mix(uWall, uInk, a * mix(.12, 1., clr)), 1.); return; }
  if (uMode >= 2) {
    vec4 d = texture(uDye, vUv);
    float x = uMode == 2 ? 1. - exp(-(d.r + d.b) * 1.6) : uMode == 3 ? clamp(v.z, 0., 1.) : uMode == 4 ? clamp(length(v.xy) * .04, 0., 1.) : d.g;
    o = vec4(mix(uWall, uInk, x * .8 * clr), 1.); return; }

  // ---- the ground ----
  vec3 c = mix(uWall, uLampC.rgb, uLampC.a * lampAt(dp));
  vec4 d0 = texture(uDye, vUv);
  vec3 warm = uDark > .5 ? vec3(.10, .06, .02) : vec3(.035, .012, -.02);
  if (d0.r + d0.g + d0.b < .0015) {                            // dry ground (most of the page): grid, lamp, tooth only
    c = mix(c, uGridC.rgb, uGridC.a * gridAt(dp));
    c += warm * clamp(v.z, 0., 1.) * .8 * clr + (h1(floor(pc * 1.5)) - .5) * .016;
    o = vec4(c, 1.); return; }
  vec2 wu = vUv + warpAt(pc);
  vec4 d = texture(uDye, wu);
  vec2 tx = 1.5 / vec2(textureSize(uDye, 0));
  vec4 dR = texture(uDye, wu + vec2(tx.x, 0)), dL = texture(uDye, wu - vec2(tx.x, 0)), dT = texture(uDye, wu + vec2(0, tx.y)), dB = texture(uDye, wu - vec2(0, tx.y));
  float hR = dR.r + dR.b, hL = dL.r + dL.b, hT = dT.r + dT.b, hB = dB.r + dB.b;
  vec2 grad = vec2(hR - hL, hT - hB);                           // the water's surface slope
  float A = d.r, B = d.b, H = A + B, wet = smoothstep(.01, .12, H);
  float speed = length(v.xy);
  // the grid seen through the water: lines bend with the surface slope
  vec2 bent = dp - grad * 22. * uPx * wet * uLaw[5].y;   // the grid layer's law is refraction; its weight bends it
  c = mix(c, uGridC.rgb, uGridC.a * gridAt(bent));

  // pigment: density varies through the pour (pooled darker, thinner where it ran), feathered at the edge
  float gA = fbm(pc * .018), gB = fbm(pc * .015 + 40.);
  float grainA = .45 + .55 * gA * gA * 1.8, grainB = .45 + .55 * gB * gB * 1.8;      // pigment settles unevenly: blooms and thin runs
  float feather = fbm(pc * .05) - .5, fib = fbm(pc * vec2(.2, .045)) - .5;           // the bleed follows the weave
  float eA = A + feather * .2 + fib * .1, eB = B + feather * .2 - fib * .1;
  // a soak is a wash, not a cloud: a flat body that thins over a short, fibrous margin
  float kA = smoothstep(.1, .45, eA) * grainA + smoothstep(1., 2.2, A) * .3;           // and pools darker where it gathered
  float kB = smoothstep(.1, .45, eB) * grainB + smoothstep(1., 2.2, B) * .25;
  vec3 pigA = uInk, pigB = uDark > .5 ? mix(uInk, vec3(.50, .63, .80), .6) : mix(uInk, vec3(.50, .33, .17), .7);
  // covers are set in linear light, where a sheet reads lighter than a gamma mix: the factor keeps the wash's body
  c = layer(c, 0, kA * uCap * 2.1 * clr, pigA);   // pour A: overprint ink
  c = layer(c, 1, kB * uCap * 2.0 * clr, pigB);   // pour B: a transparent wash
  // the tide line forms only where the front has stopped and dried: long stretches stay wet and show no line,
  // and where it has formed it fades in and out along its length
  float still = 1. - smoothstep(.2, 1.6, speed);
  float dried = still * smoothstep(.47, .58, fbm(pc * .009 + 3.)) * smoothstep(.25, .6, fbm(pc * .04 + 9.));
  float sA = A + feather * .2, sB = B + feather * .2;                                  // the dried front is smoother than the bleed
  float wA = fwidth(sA) * 1.3 + .002, wB = fwidth(sB) * 1.3 + .002;
  float rim = max(1. - smoothstep(0., wA, abs(sA - .2)), (1. - smoothstep(0., wB, abs(sB - .2))) * .8) * dried;
  c = layer(c, 2, rim * uCap * 2.6 * clr, mix(pigA, pigB, step(sA, sB)));   // tide line: dried pigment
  // sediment: short broken marks laid where reading settled (Mehretu's layered gesture, at the floor)
  float sed = d.g * step(.62, fract(pc.y / 1.5 + vn(pc * vec2(.01, .15)) * .8)) * (.5 + .5 * vn(pc * .035));
  c = layer(c, 3, sed * .3 * uCap * 3. * clr, uInk);   // sediment: marks laid in transparent strata
  // caustics and one soft highlight, both faint, both drifting slowly
  float t = uTime;
  vec2 cq = pc * .05 + grad * 3. + vec2(t * .04, -t * .03);
  float cn = 1. - abs(2. * vn(cq) - 1.), cn2 = 1. - abs(2. * vn(cq * 1.7 + 5.) - 1.);
  float caus = pow(cn * cn2, 4.) * wet;
  vec3 n = normalize(vec3(-grad * 6., 1.)), L = normalize(vec3(cos(t * .06), .55 + .25 * sin(t * .05), .8));
  float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.), 90.) * wet;
  vec3 lite = uDark > .5 ? uLampC.rgb : vec3(1.);
  c = layer(c, 4, (caus * .035 + spec * .22) * clr, lite);   // caustics and highlight: light adds
  c += warm * clamp(v.z, 0., 1.) * .8 * clr;
  c += (h1(floor(pc * 1.5)) - .5) * .016;                 // the paper's tooth: the ground is never a flat fill
  o = vec4(c, 1.); }`;
