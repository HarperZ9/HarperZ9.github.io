/* ============================================================================
   hero-gl.js -- the living technical instrument, shipped.

   A self-contained vanilla-JS WebGL1 hero for harperz9.github.io (Project Telos).
   No dependencies, no build step. Mounts to the committed system.css scaffolding:

       <canvas id="gl">     the generative scene   (z-index 0, fixed full-viewport)
       <canvas id="motes">  a drifting ember layer  (z-index 2, over the scene)

   Lineage: this is the _preview/hero-ultimate.html scene, mined and elevated for
   production. Kept: the dusk-dreamscape ground, flow-field streamlines, the
   reaction-diffusion labyrinth, voronoi chitin, contour topographies, industrial
   ember haze, a procedural organism-tissue field, and god-rays. Added: a slow
   living iris (the eclipse-aperture witness mark) drawn in the scene itself, so
   the witness persists instead of vanishing with a one-shot boot overlay.

   Trimmed from the preview, on purpose:
     - the weeping eye and the mini-eyes  (too literal for a portfolio hero, and
       the two most expensive layers in the preview shader)
     - the Witness / Instrument / Specimen world-grades and the world switcher
       (Witness inverts to near-white bone, Instrument pushes steel-cyan -- both
       would break the mineral-dark, orange-and-amber, no-cool-drift mandate)
     - the ASCII / perceive second pass, its FBO, and its glyph atlas
     - the three photo textures (u_tex0/1/2). Those JPGs were retired and no
       longer exist in /img, so depending on them would be a broken dependency.
       Their role -- a slow, structured field that tells the line networks where
       to concentrate -- is now generated procedurally in the shader.

   Palette is locked strictly to the system.css tokens:
     --void #0d1b1c  ground      --bone #e9e2d0  light
     --orange #df5e00 + --ember #efab30  the primary signal
     --verified #5fae93 + --prussian #476762  teal depth
     --muted #8a9b92

   Engineering contract:
     - WebGL1 only. Constant integer loop bounds. No float swizzles. Per-helper
       local-name prefixes (inherited from the preview's convention) so nothing
       collides at global shader scope.
     - Fail-safe: if WebGL is unavailable or the program fails to compile/link,
       both canvases are hidden and we return. The --void body background shows
       through cleanly.
     - Renders the scene below native resolution (RENDER_SCALE) with a capped DPR,
       for a smooth 60fps on integrated GPUs.
     - Pauses the RAF loop on visibilitychange (hidden tab).
     - Honors prefers-reduced-motion: one still frame, no scene loop, no motes.
     - Resize-aware. Passive listeners. Eased pointer parallax.
     - No em-dashes (U+2014) anywhere, including these comments.
   ============================================================================ */
(function () {
  "use strict";

  var sceneCanvas = document.getElementById("gl");
  var moteCanvas  = document.getElementById("motes");

  // Nothing to mount to. The page that composes around these canvases has not
  // placed them yet (or this script loaded on a page without the hero). Quietly
  // do nothing; the --void background is already correct.
  if (!sceneCanvas) { return; }

  var REDUCED = !!(window.matchMedia &&
                   window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ----------------------------------------------------------------------------
  // TUNING -- ported from the preview's KNOBS, biased for a calm production hero.
  // The preview pushed everything to maximum for a demo; here the structure reads
  // rich but never shouts, and the composition leans right (CENTER_X > 0) so the
  // best activity clears the darkened, scrim-covered left column.
  // ----------------------------------------------------------------------------
  var TIME_SCALE      = 0.24;   // slow, instrument-like drift
  var RENDER_SCALE    = 0.66;   // draw below native res, then CSS-upscale
  var MAX_DPR         = 1.5;    // cap device pixel ratio on dense displays
  var MIN_BACKING     = 480;    // never let the backing store get tiny on resize

  var FLOW_DENSITY    = 15.0;
  var RD_SCALE        = 6.6;
  var VORONOI_SCALE   = 9.5;
  var CONTOUR_FREQ    = 30.0;
  var LINE_SHARP      = 0.22;
  var GEO_BRIGHT      = 2.05;   // the master contrast lever for the line networks
  var HAZE_STRENGTH   = 0.55;
  var HAZE_MIX        = 0.46;
  var GODRAY_OPACITY  = 0.60;
  var EMBER_INTENSITY = 1.18;
  var STEEL_BALANCE   = 0.50;
  var SCANLINE_WEIGHT = 0.42;
  var GRAIN_STRENGTH  = 0.55;
  var VIGNETTE_POWER  = 1.70;
  var MOUSE_INFLUENCE = 0.34;
  var APERTURE_GLOW   = 1.0;    // the witness iris; 0 would hide it entirely
  var CENTER_X        = 0.30;   // right-bias: where the organism concentrates

  // ----------------------------------------------------------------------------
  // VERTEX SHADER -- one full-screen triangle.
  // ----------------------------------------------------------------------------
  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  // ----------------------------------------------------------------------------
  // SCENE FRAGMENT SHADER
  //
  // WebGL1 safety audit (carried forward from the preview and re-checked for the
  // trimmed/added layers):
  //   (a) Locals are unique per helper via a prefix strategy. main() uses bare
  //       names, each unique within main. Prefixes:
  //         gh2 -> none   gnoise -> gn_   fbm -> fb_   fbm6 -> f6_
  //         vh1 -> none   vnoise -> vn_   rot2 -> r2_  vfbm4 -> v4_  vfbm6 -> v6_
  //         warpedFbm -> wf_   organismField -> of_   godRays -> gr_
  //         voronoiEdge -> ve_   apertureMark -> ap_
  //   (b) Every .x/.y/.z/.w/.r/.g/.b targets a vec2/vec3/vec4. No float swizzle.
  //   (c) All for() bounds are constant integer literals (4, 6, 18, 3, 3, 8).
  //   (d) No texture sampling at all: the organism field is procedural, so there
  //       are no sampler uniforms and no async asset dependency.
  // ----------------------------------------------------------------------------
  var FRAG = [
    "precision highp float;",

    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",

    "uniform float u_flow_density;",
    "uniform float u_rd_scale;",
    "uniform float u_voronoi_scale;",
    "uniform float u_contour_freq;",
    "uniform float u_line_sharp;",
    "uniform float u_geo_bright;",
    "uniform float u_haze_strength;",
    "uniform float u_haze_mix;",
    "uniform float u_godray_opacity;",
    "uniform float u_ember_intensity;",
    "uniform float u_steel_balance;",
    "uniform float u_scanline_weight;",
    "uniform float u_grain_strength;",
    "uniform float u_vignette_power;",
    "uniform float u_mouse_influence;",
    "uniform float u_aperture_glow;",
    "uniform float u_center_x;",

    // -- gradient hash (no locals) --
    "vec2 gh2(vec2 p){",
    "  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));",
    "  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);",
    "}",

    // -- value-gradient noise: prefix gn_ --
    "float gnoise(vec2 p){",
    "  vec2 gn_i = floor(p), gn_f = fract(p);",
    "  vec2 gn_u = gn_f * gn_f * (3.0 - 2.0 * gn_f);",
    "  return mix(",
    "    mix(dot(gh2(gn_i), gn_f), dot(gh2(gn_i + vec2(1.0, 0.0)), gn_f - vec2(1.0, 0.0)), gn_u.x),",
    "    mix(dot(gh2(gn_i + vec2(0.0, 1.0)), gn_f - vec2(0.0, 1.0)), dot(gh2(gn_i + vec2(1.0, 1.0)), gn_f - vec2(1.0, 1.0)), gn_u.x),",
    "  gn_u.y);",
    "}",

    // -- fbm, 4 octaves: prefix fb_ --
    "float fbm(vec2 p){",
    "  float fb_s = 0.0, fb_a = 0.55;",
    "  mat2 fb_m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for(int fb_i = 0; fb_i < 4; fb_i++){ fb_s += fb_a * gnoise(p); p = fb_m * p; fb_a *= 0.5; }",
    "  return fb_s;",
    "}",

    // -- fbm, 6 octaves: prefix f6_ --
    "float fbm6(vec2 p){",
    "  float f6_s = 0.0, f6_a = 0.50;",
    "  mat2 f6_m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for(int f6_i = 0; f6_i < 6; f6_i++){ f6_s += f6_a * gnoise(p); p = f6_m * p; f6_a *= 0.50; }",
    "  return f6_s;",
    "}",

    // -- value hash (no locals) --
    "float vh1(vec2 p){",
    "  p = fract(p * vec2(234.7, 381.3));",
    "  p += dot(p, p + 19.17);",
    "  return fract(p.x * p.y) * 2.0 - 1.0;",
    "}",

    // -- value noise: prefix vn_ --
    "float vnoise(vec2 p){",
    "  vec2 vn_i = floor(p), vn_f = fract(p);",
    "  vec2 vn_u = vn_f * vn_f * vn_f * (vn_f * (vn_f * 6.0 - 15.0) + 10.0);",
    "  return mix(mix(vh1(vn_i), vh1(vn_i + vec2(1.0, 0.0)), vn_u.x),",
    "             mix(vh1(vn_i + vec2(0.0, 1.0)), vh1(vn_i + vec2(1.0, 1.0)), vn_u.x), vn_u.y);",
    "}",

    // -- 2x2 rotation: prefix r2_ --
    "mat2 rot2(float a){ float r2_c = cos(a), r2_s = sin(a); return mat2(r2_c, -r2_s, r2_s, r2_c); }",

    // -- rotated value fbm, 4 octaves: prefix v4_ --
    "float vfbm4(vec2 p){",
    "  float v4_v = 0.0; float v4_a = 0.55;",
    "  mat2 v4_rm = rot2(0.6);",
    "  for(int v4_i = 0; v4_i < 4; v4_i++){ v4_v += v4_a * vnoise(p); p = v4_rm * p * 1.93; v4_a *= 0.48; }",
    "  return v4_v;",
    "}",

    // -- rotated value fbm, 6 octaves: prefix v6_ --
    "float vfbm6(vec2 p){",
    "  float v6_v = 0.0; float v6_a = 0.52;",
    "  mat2 v6_rm = rot2(0.7);",
    "  for(int v6_i = 0; v6_i < 6; v6_i++){ v6_v += v6_a * vnoise(p); p = v6_rm * p * 2.01; v6_a *= 0.46; }",
    "  return v6_v;",
    "}",

    // -- domain-warped fbm: prefix wf_ --
    "float warpedFbm(vec2 p, float ws){",
    "  vec2 wf_qa = vec2(vfbm4(p), vfbm4(p + vec2(4.0, 2.2)));",
    "  vec2 wf_ra = vec2(vfbm4(p + ws * wf_qa + vec2(1.7, 9.2)), vfbm4(p + ws * wf_qa + vec2(8.3, 2.8)));",
    "  return vfbm4(p + ws * wf_ra);",
    "}",

    // -- ORGANISM FIELD: prefix of_ --
    // Replaces the three retired photo-luminance samplers (lumA/lumB/lumC). It is
    // a slow, structured, domain-warped field in 0..1 that plays the exact role
    // the photographs played: telling the flow / RD / voronoi / contour networks
    // where to thicken, so the geometry reads as growing on living tissue rather
    // than as a flat overlay. Three decorrelated probes give pA/pB/pC analogues.
    "vec3 organismField(vec2 p, float t){",
    "  vec2 of_w = vec2(vfbm4(p * 1.3 + vec2(0.0, t * 0.03)),",
    "                   vfbm4(p * 1.3 + vec2(5.2, 1.7 - t * 0.02)));",
    "  vec2 of_pw = p + of_w * 1.6;",
    "  float of_a = vfbm6(of_pw * 1.1 + vec2(1.3, 4.7)) * 0.5 + 0.5;",
    "  float of_b = warpedFbm(p * 0.9 + vec2(7.0, 2.0), 0.9) * 0.5 + 0.5;",
    "  float of_c = vfbm4(of_pw * 2.2 + vec2(9.1, 0.4)) * 0.5 + 0.5;",
    // a soft lobe biased to the right so tissue concentrates where activity reads
    "  float of_lobe = 1.0 - smoothstep(0.20, 0.95, length((p - vec2(0.30, 0.04)) * vec2(0.92, 1.18)));",
    "  of_a = clamp(of_a * (0.55 + 0.85 * of_lobe), 0.0, 1.0);",
    "  return vec3(of_a, of_b, of_c);",
    "}",

    // -- god-ray accumulator: prefix gr_ --
    "float godRays(vec2 uv, vec2 lp, float t){",
    "  vec2 gr_delta = (lp - uv) * (1.0 / 18.0);",
    "  float gr_acc = 0.0;",
    "  vec2 gr_gp = uv;",
    "  float gr_decay = 1.0;",
    "  for(int gr_gi = 0; gr_gi < 18; gr_gi++){",
    "    gr_gp += gr_delta;",
    "    float gr_mask = clamp(vfbm6(gr_gp * 2.4 + t * 0.04) * 0.5 + 0.6, 0.0, 1.0);",
    "    gr_acc += gr_mask * gr_decay;",
    "    gr_decay *= 0.88;",
    "  }",
    "  float gr_distFade = 1.0 - smoothstep(0.0, 1.3, length(uv - lp));",
    "  return gr_acc * gr_distFade * (1.0 / 18.0);",
    "}",

    // -- voronoi 2nd-minus-1st edge distance: prefix ve_ --
    "float voronoiEdge(vec2 p){",
    "  vec2 ve_ip = floor(p);",
    "  vec2 ve_fp = fract(p);",
    "  float ve_md = 1e9;",
    "  float ve_md2 = 1e9;",
    "  for(int ve_j = 0; ve_j < 3; ve_j++){",
    "    for(int ve_i = 0; ve_i < 3; ve_i++){",
    "      vec2 ve_nb = vec2(float(ve_i) - 1.0, float(ve_j) - 1.0);",
    "      vec2 ve_seed = ve_nb + 0.5 + 0.48 * sin(ve_ip + ve_nb + vec2(3.71, 1.53));",
    "      float ve_d = length(ve_fp - ve_seed);",
    "      if(ve_d < ve_md){ ve_md2 = ve_md; ve_md = ve_d; }",
    "      else if(ve_d < ve_md2){ ve_md2 = ve_d; }",
    "    }",
    "  }",
    "  return ve_md2 - ve_md;",
    "}",

    // -- APERTURE MARK: prefix ap_ --
    // The eclipse-aperture witness mark, drawn into the scene. A thin orange
    // annulus with eight iris-blade notches and a dark pupil, breathing on a slow
    // cycle (the iris never quite closes; it watches). Returns an additive color
    // contribution so it sits as luminous signal over the mineral ground. Placed
    // on the right, where the composition is richest and the scrim is thinnest.
    "vec3 apertureMark(vec2 uvn, float t, vec3 cOrange, vec3 cAmber){",
    "  vec2  ap_c = vec2(u_center_x + 0.20, 0.07);",
    "  vec2  ap_v = uvn - ap_c;",
    "  float ap_r = length(ap_v);",
    "  float ap_ang = atan(ap_v.y, ap_v.x);",
    // slow breathing iris radius
    "  float ap_breathe = 0.5 + 0.5 * sin(t * 0.45);",
    "  float ap_R = mix(0.118, 0.140, ap_breathe);",
    "  float ap_pupil = mix(0.030, 0.052, ap_breathe);",
    // outer ring, a hairline annulus
    "  float ap_ring = smoothstep(0.006, 0.0, abs(ap_r - ap_R));",
    // eight iris blades: a petal modulation that scallops the inner edge
    "  float ap_blades = 0.5 + 0.5 * cos(ap_ang * 8.0 - t * 0.12);",
    "  float ap_inner = ap_R - 0.018 - 0.012 * ap_blades;",
    "  float ap_irisEdge = smoothstep(0.010, 0.0, abs(ap_r - ap_inner));",
    // faint engraved tick ring just outside, the instrument bezel
    "  float ap_tickWave = 0.5 + 0.5 * cos(ap_ang * 36.0);",
    "  float ap_ticks = smoothstep(0.004, 0.0, abs(ap_r - (ap_R + 0.016)))",
    "                 * smoothstep(0.55, 0.95, ap_tickWave);",
    // the dark pupil and a warm corona just inside the iris
    "  float ap_hole = smoothstep(ap_pupil + 0.004, ap_pupil - 0.004, ap_r);",
    "  float ap_corona = exp(-pow((ap_r - ap_inner * 0.7) / 0.05, 2.0)) * (1.0 - ap_hole);",
    // assemble: orange structure, amber corona, all faded by an overall envelope
    "  vec3  ap_col = cOrange * (ap_ring + ap_irisEdge) * 0.9;",
    "  ap_col += cAmber * ap_ticks * 0.5;",
    "  ap_col += cAmber * ap_corona * 0.32;",
    "  float ap_env = 1.0 - smoothstep(ap_R + 0.02, ap_R + 0.10, ap_r);",
    "  return ap_col * ap_env * u_aperture_glow;",
    "}",

    // ==========================================================================
    // MAIN
    // ==========================================================================
    "void main(){",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec2 uvn  = (frag - 0.5 * u_res) / u_res.y;",
    "  float t   = u_time;",

    // -- LAYER 1 -- DUSK DREAMSCAPE (the warm mineral ground) --
    "  float lhz = -0.20;",
    "  float lfog = fbm(vec2(uvn.x * 1.4 - t * 0.010, uvn.y * 2.0 + t * 0.006));",
    "  vec3 lTop = vec3(0.030, 0.066, 0.070);",   // deep void teal at the top
    "  vec3 lSky = vec3(0.066, 0.120, 0.126);",   // oxide teal mid sky
    "  vec3 lHor = vec3(0.760, 0.330, 0.020);",   // orange horizon ember
    "  vec3 lGnd = vec3(0.018, 0.045, 0.050);",   // near-void ground
    "  vec3 lSkyCol = mix(lSky, lTop, smoothstep(0.05, 0.8, uvn.y));",
    "  lSkyCol = mix(lHor, lSkyCol, smoothstep(lhz, 0.20, uvn.y));",
    "  vec3 col = mix(lGnd, lSkyCol, smoothstep(lhz - 0.06, lhz + 0.06, uvn.y));",
    "  vec2 sunPos = vec2(u_center_x, lhz + 0.02);",
    "  col += vec3(0.900, 0.520, 0.10) * exp(-pow(length((uvn - sunPos) * vec2(0.6, 1.6)) / 0.38, 2.0)) * 0.48;",
    "  col += (lfog - 0.5) * 0.028 * vec3(1.0, 0.82, 0.5);",
    "  col  = mix(col, col * 1.16 + vec3(0.14, 0.09, 0.02), exp(-pow((uvn.y - lhz) / 0.05, 2.0)) * 0.36);",
    "  col += vec3(0.94, 0.60, 0.20) * exp(-pow((uvn.y - lhz) / 0.006, 2.0)) * 0.48;",

    // -- LAYER 2 -- GENERATIVE GEOMETRY ON THE ORGANISM FIELD --
    // Procedural field stands in for the retired photo luminances.
    "  vec2 ofUV = (uvn - vec2(u_center_x, 0.04)) / 0.85 + 0.5;",
    "  vec3 fld = organismField(ofUV, t);",
    "  float pA = fld.x;",   // tissue-concentration analogue (right-biased lobe)
    "  float pB = fld.y;",   // labyrinth seed analogue
    "  float pC = fld.z;",   // growth seed analogue

    // 2a. Flow-field streamlines.
    "  vec2 ff0 = uvn * u_flow_density + vec2(t * 0.07, -t * 0.04);",
    "  float ffA = fbm(ff0 * 0.41 + vec2(1.7, 3.1));",
    "  float ffB = fbm(ff0 * 0.41 + vec2(9.2, 6.4));",
    "  vec2 ff1 = ff0 + vec2(ffA, ffB) * 2.2;",
    "  float ffC = fbm(ff1 * 0.68 + vec2(t * 0.03, 0.5)) * (0.5 + 0.9 * pA);",
    "  float ffD = fbm(ff1 * 0.68 + vec2(2.3, t * 0.02 + 1.1)) * (0.5 + 0.9 * pA);",
    "  vec2 ff2 = ff1 + vec2(ffC, ffD) * 1.5;",
    "  float ffE = gnoise(ff2 * 1.6 + vec2(t * 0.06, 4.7)) * 0.55;",
    "  float ffF = gnoise(ff2 * 1.6 + vec2(7.3, t * 0.05)) * 0.55;",
    "  vec2 ff3 = ff2 + vec2(ffE, ffF) * 0.9;",
    "  float ffVal  = fbm6(ff3);",
    "  float ffN    = ffVal * 0.5 + 0.5;",
    "  float ffBand = fract(ffN * 18.0);",
    "  float flowLine = smoothstep(u_line_sharp * 0.055, 0.0, ffBand) * 0.5 +",
    "                   smoothstep(u_line_sharp * 0.055, 0.0, 1.0 - ffBand) * 0.5;",
    "  float flowDens = smoothstep(0.02, 0.35, pA) * 0.45 + 0.55;",
    "  flowLine *= flowDens;",

    // 2b. Reaction-diffusion labyrinth.
    "  vec2 rdP  = uvn * u_rd_scale + vec2(t * 0.014, -t * 0.008);",
    "  vec2 rdSd = vec2(pB * 0.6, (1.0 - pB) * 0.4);",
    "  vec2 rdPS = rdP + rdSd * 2.5;",
    "  float rdFine   = fbm6(rdPS * 2.1 + vec2(3.0, 1.4));",
    "  float rdCoarse = fbm(rdPS * 0.9 + vec2(7.2, 0.8));",
    "  float rdSig = rdFine - rdCoarse * 0.7;",
    "  float rdB0 = smoothstep(-0.02, 0.0, rdSig) - smoothstep(0.0, 0.04, rdSig);",
    "  float rdB1 = smoothstep(0.18, 0.20, rdSig) - smoothstep(0.20, 0.24, rdSig);",
    "  float rdB2 = smoothstep(0.38, 0.40, rdSig) - smoothstep(0.40, 0.44, rdSig);",
    "  float rdLine = (rdB0 + rdB1 * 0.80 + rdB2 * 0.60);",
    "  rdLine *= smoothstep(0.03, 0.45, pB) * 0.45 + 0.55;",

    // 2c. Voronoi chitin.
    "  vec2 vp1 = uvn * u_voronoi_scale + vec2(t * 0.018, -t * 0.011);",
    "  vp1 += vec2(pA * 1.1, (1.0 - pA) * 0.7);",
    "  float vE1 = voronoiEdge(vp1);",
    "  vec2 vp2 = uvn * u_voronoi_scale * 2.2 + vec2(-t * 0.014, t * 0.009) + vec2(pA * 0.8, pB * 0.6);",
    "  float vE2 = voronoiEdge(vp2);",
    "  float vW1 = smoothstep(0.12 * u_line_sharp, 0.0, vE1);",
    "  float vW2 = smoothstep(0.08 * u_line_sharp, 0.0, vE2) * 0.60;",
    "  float vLine = vW1 + vW2;",
    "  float vGrow = smoothstep(0.55, 0.88, pC) * smoothstep(0.40, 0.80, vE2);",
    "  vLine = vLine + vGrow * 0.45;",

    // 2d. Contour topographies.
    "  vec2 cp  = uvn * 5.8 + vec2(t * 0.009, t * 0.013);",
    "  float cpW = fbm(cp * 0.7 + vec2(pA * 2.0, 0.9));",
    "  cp += vec2(cpW, fbm(cp * 0.7 + vec2(4.2, pB * 1.8))) * 1.2;",
    "  float ctField = fbm6(cp);",
    "  float ctFreq  = u_contour_freq * (0.45 + 1.1 * pA);",
    "  float ctN     = fract((ctField * 0.5 + 0.5) * ctFreq * (1.0 / 12.0) * 12.0);",
    "  float ctLine  = smoothstep(u_line_sharp * 0.035, 0.0, ctN) +",
    "                  smoothstep(u_line_sharp * 0.035, 0.0, 1.0 - ctN);",
    "  ctLine *= smoothstep(0.03, 0.32, pA + pB * 0.5) * 0.50 + 0.50;",

    // -- Compose the geometry in the locked palette --
    "  vec3 cOrange = vec3(0.873, 0.369, 0.000);",   // --orange #df5e00
    "  vec3 cAmber  = vec3(0.937, 0.671, 0.188);",   // --ember  #efab30
    "  vec3 cTeal   = vec3(0.373, 0.682, 0.576);",   // --verified #5fae93
    "  vec3 cDeep   = vec3(0.278, 0.404, 0.384);",   // --prussian #476762
    "  vec3 cWhite  = vec3(1.0, 0.95, 0.88);",        // hot line core

    "  vec3 geoCol = col;",
    // flow lines, blazing orange-amber
    "  geoCol += cAmber  * flowLine * u_geo_bright * 0.84;",
    "  geoCol += cOrange * flowLine * flowLine * u_geo_bright * 0.62;",
    "  geoCol += cWhite  * flowLine * flowLine * flowLine * u_geo_bright * 0.24;",
    // RD labyrinth, teal with amber highs
    "  geoCol += cTeal   * rdLine * u_geo_bright * 0.70;",
    "  geoCol += cAmber  * rdLine * rdLine * u_geo_bright * 0.34;",
    // voronoi chitin walls
    "  geoCol += cOrange * vW1 * u_geo_bright * 0.66;",
    "  geoCol += cAmber  * vW1 * vW1 * u_geo_bright * 0.36;",
    "  geoCol += cDeep   * vW2 * u_geo_bright * 0.42;",
    "  geoCol += cAmber  * vGrow * u_geo_bright * 0.30;",
    // contour topographies
    "  geoCol += cAmber  * ctLine * u_geo_bright * 0.48;",
    "  geoCol += cOrange * ctLine * u_geo_bright * 0.26;",

    "  float geoAlpha = clamp(flowLine * 0.78 + rdLine * 0.66 + vLine * 0.60 + ctLine * 0.46, 0.0, 1.0);",
    "  col = mix(col, geoCol, geoAlpha * 0.92);",

    // -- LAYER 3 -- ORGANISM TISSUE (procedural, no photo) --
    // A soft membrane form that the geometry sits on. Uses the same field, plus a
    // gyroid-style interference for the membrane veining the preview drew from the
    // texture's gyroid term, now generated directly.
    "  vec2 tDelta = uvn - vec2(u_center_x, 0.04);",
    "  float tL = pA;",
    "  vec3 tissue = mix(vec3(0.030, 0.062, 0.066), vec3(0.255, 0.392, 0.366), smoothstep(0.10, 0.5, tL));",
    "  tissue = mix(tissue, vec3(0.900, 0.490, 0.066), smoothstep(0.62, 0.94, tL));",
    "  tissue = mix(tissue, tissue * vec3(1.05, 0.92, 0.70) + cAmber * 0.05, pC * 0.20);",
    "  vec3 tGPV = vec3(ofUV * 10.0, tL * 5.0 + t * 0.05);",
    "  float tGyr = sin(tGPV.x) * cos(tGPV.y) + sin(tGPV.y) * cos(tGPV.z) + sin(tGPV.z) * cos(tGPV.x);",
    "  float tMemb = smoothstep(0.12, 0.0, abs(tGyr));",
    "  tissue = mix(tissue, tissue * 0.5 + vec3(0.900, 0.610, 0.170), tMemb * 0.50);",
    "  float tDD  = length(tDelta * vec2(0.84, 1.0));",
    "  float tForm = smoothstep(0.58, 0.16, tDD) * smoothstep(0.20, 0.55, tL);",
    "  col = mix(col, tissue, tForm * 0.62);",

    // -- LAYER 4 -- INDUSTRIAL EMBER HAZE --
    "  vec2 mShift = u_mouse * u_mouse_influence * 0.18;",
    "  vec2 hzPos  = uvn * 2.8 - mShift + vec2(t * 0.055, t * 0.022);",
    "  float hzVal = warpedFbm(hzPos, u_haze_strength);",
    "  float haze  = hzVal * 0.5 + 0.5;",
    "  vec2 hzPos2 = uvn * 4.6 + vec2(-t * 0.038, t * 0.028) - mShift * 0.5;",
    "  float hzDet = vfbm4(hzPos2) * 0.5 + 0.5;",
    "  vec3 cVoid  = vec3(0.030, 0.066, 0.070);",
    "  vec3 cOxide = vec3(0.062, 0.110, 0.116);",
    "  vec3 cMetal = vec3(0.180, 0.205, 0.200);",
    "  vec3 cRust  = vec3(0.150, 0.066, 0.016);",
    "  vec3 hazeCol = cVoid;",
    "  hazeCol = mix(hazeCol, cOxide, smoothstep(0.08, 0.42, haze));",
    "  hazeCol = mix(hazeCol, cMetal, smoothstep(0.40, 0.70, haze) * u_steel_balance * 0.34);",
    "  hazeCol = mix(hazeCol, hazeCol * 1.06 + vec3(0.008, 0.006, 0.004), smoothstep(0.55, 0.80, hzDet) * 0.18);",
    "  vec2 heatA = vec2(u_center_x + 0.085, 0.056) + vec2(0.03 * sin(t * 0.11), -0.02 * cos(t * 0.09));",
    "  float hdA  = length(uvn - heatA);",
    "  vec2 heatB = vec2(u_center_x + 0.24 + 0.025 * cos(t * 0.07), 0.24 + 0.018 * sin(t * 0.13));",
    "  float hdB  = length(uvn - heatB);",
    "  float glwA = exp(-hdA * hdA * 8.0)  * smoothstep(0.20, 0.65, haze);",
    "  float glwB = exp(-hdB * hdB * 15.0) * smoothstep(0.30, 0.72, hzDet) * 0.55;",
    "  float rstA = exp(-hdA * hdA * 2.8)  * smoothstep(0.60, 0.18, haze) * 0.72;",
    "  hazeCol += cRust   * rstA * u_ember_intensity;",
    "  hazeCol += cOrange * glwA * 0.50 * u_ember_intensity;",
    "  hazeCol += cAmber  * glwA * glwA * 0.26 * u_ember_intensity;",
    "  hazeCol += cOrange * glwB * 0.26 * u_ember_intensity;",
    "  float hzKrnlA = exp(-hdA * hdA * 160.0);",
    "  hazeCol += cAmber * hzKrnlA * 1.7 * u_ember_intensity;",
    "  float hzVertW = smoothstep(0.60, -0.50, uvn.y) * 0.55 + 0.45;",
    "  col = mix(col, hazeCol, u_haze_mix * hzVertW);",

    // -- LAYER 5 -- GOD-RAYS (from the aperture and the sun) --
    "  vec2 apPos = vec2(u_center_x + 0.20, 0.07);",
    "  float apRays  = godRays(uvn, apPos, t);",
    "  float sunRays = godRays(uvn, sunPos, t) * 0.60;",
    "  col += mix(cOrange, cAmber, 0.45) * apRays * 0.55 * u_godray_opacity;",
    "  col += mix(cOrange, vec3(0.94, 0.55, 0.12), 0.3) * sunRays * u_godray_opacity * 0.70;",

    // -- LAYER 6 -- THE APERTURE WITNESS MARK (drawn in-scene) --
    "  col += apertureMark(uvn, t, cOrange, cAmber);",

    // -- LAYER 7 -- CRT / GRAIN / VIGNETTE POST --
    "  col = mix(col, vec3(dot(col, vec3(0.34, 0.42, 0.24))), 0.07);",
    "  col += vec3(0.04, 0.030, 0.034) * lfog * 0.4;",
    "  float vigR = length(uvn);",
    "  float vig  = pow(1.0 - clamp(vigR * 0.78, 0.0, 1.0), u_vignette_power);",
    "  col *= mix(0.50, 1.0, vig);",
    "  col *= 1.0 - dot(uvn, uvn) * 0.03;",
    "  float scanFreq = 1.7 + u_scanline_weight * 1.8;",
    "  float scan = 0.5 + 0.5 * sin(frag.y * scanFreq);",
    "  col *= 1.0 - u_scanline_weight * 0.12 * (1.0 - scan);",
    "  col  = floor(col * 48.0 + 0.5) / 48.0;",   // gentle quantize (less crushed than the preview's 32)
    "  float grnSeed = dot(frag, vec2(12.9898, 78.2330)) + t;",
    "  float grn     = fract(sin(grnSeed) * 43758.5453) - 0.5;",
    "  col += grn * u_grain_strength * 0.022;",
    "  col  = col * 0.94 + vec3(0.005, 0.007, 0.007);",
    "  col  = pow(max(col, 0.0), vec3(0.95));",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  // ----------------------------------------------------------------------------
  // GL helpers
  // ----------------------------------------------------------------------------
  function compileShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      // Log once, with context, then let the caller fail-safe.
      if (window.console && console.error) {
        console.error("hero-gl: shader compile failed.\n" + gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function linkProgram(gl, vsh, fsh) {
    var prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console && console.error) {
        console.error("hero-gl: program link failed.\n" + gl.getProgramInfoLog(prog));
      }
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  // Hide both canvases and let the --void body background show through. Called on
  // any unrecoverable GL failure so the page degrades cleanly to a flat mineral field.
  function failSafe() {
    if (sceneCanvas) { sceneCanvas.style.display = "none"; }
    if (moteCanvas)  { moteCanvas.style.display  = "none"; }
  }

  // ----------------------------------------------------------------------------
  // SCENE BOOTSTRAP
  // ----------------------------------------------------------------------------
  var gl = null;
  try {
    gl = sceneCanvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false })
       || sceneCanvas.getContext("experimental-webgl", { antialias: false, alpha: false, depth: false, stencil: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) { failSafe(); return; }

  var vsh = compileShader(gl, gl.VERTEX_SHADER, VERT);
  var fsh = vsh ? compileShader(gl, gl.FRAGMENT_SHADER, FRAG) : null;
  var prog = (vsh && fsh) ? linkProgram(gl, vsh, fsh) : null;
  if (!prog) { failSafe(); return; }

  // Full-screen triangle.
  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  gl.useProgram(prog);
  var aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Uniform locations.
  var U = {
    res:       gl.getUniformLocation(prog, "u_res"),
    time:      gl.getUniformLocation(prog, "u_time"),
    mouse:     gl.getUniformLocation(prog, "u_mouse"),
    flowDen:   gl.getUniformLocation(prog, "u_flow_density"),
    rdScale:   gl.getUniformLocation(prog, "u_rd_scale"),
    voroS:     gl.getUniformLocation(prog, "u_voronoi_scale"),
    contF:     gl.getUniformLocation(prog, "u_contour_freq"),
    lineShp:   gl.getUniformLocation(prog, "u_line_sharp"),
    geoBright: gl.getUniformLocation(prog, "u_geo_bright"),
    hazeStr:   gl.getUniformLocation(prog, "u_haze_strength"),
    hazeMix:   gl.getUniformLocation(prog, "u_haze_mix"),
    ray:       gl.getUniformLocation(prog, "u_godray_opacity"),
    ember:     gl.getUniformLocation(prog, "u_ember_intensity"),
    steel:     gl.getUniformLocation(prog, "u_steel_balance"),
    scan:      gl.getUniformLocation(prog, "u_scanline_weight"),
    grain:     gl.getUniformLocation(prog, "u_grain_strength"),
    vig:       gl.getUniformLocation(prog, "u_vignette_power"),
    mouseInf:  gl.getUniformLocation(prog, "u_mouse_influence"),
    aperture:  gl.getUniformLocation(prog, "u_aperture_glow"),
    centerX:   gl.getUniformLocation(prog, "u_center_x")
  };

  // Static uniforms (set once; they never change after boot).
  function setStaticUniforms() {
    gl.uniform1f(U.flowDen,   FLOW_DENSITY);
    gl.uniform1f(U.rdScale,   RD_SCALE);
    gl.uniform1f(U.voroS,     VORONOI_SCALE);
    gl.uniform1f(U.contF,     CONTOUR_FREQ);
    gl.uniform1f(U.lineShp,   LINE_SHARP);
    gl.uniform1f(U.geoBright, GEO_BRIGHT);
    gl.uniform1f(U.hazeStr,   HAZE_STRENGTH);
    gl.uniform1f(U.hazeMix,   HAZE_MIX);
    gl.uniform1f(U.ray,       GODRAY_OPACITY);
    gl.uniform1f(U.ember,     EMBER_INTENSITY);
    gl.uniform1f(U.steel,     STEEL_BALANCE);
    gl.uniform1f(U.scan,      SCANLINE_WEIGHT);
    gl.uniform1f(U.grain,     GRAIN_STRENGTH);
    gl.uniform1f(U.vig,       VIGNETTE_POWER);
    gl.uniform1f(U.mouseInf,  MOUSE_INFLUENCE);
    gl.uniform1f(U.aperture,  APERTURE_GLOW);
    gl.uniform1f(U.centerX,   CENTER_X);
  }
  setStaticUniforms();

  // DPR capped, then the scene is rendered below native via RENDER_SCALE. CSS holds
  // the canvas at full layout size, so the GPU draws fewer pixels and the browser
  // upscales. This is the integrated-GPU budget lever.
  var DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  var W = 1, H = 1;

  function resizeScene() {
    var cw = sceneCanvas.clientWidth  || window.innerWidth  || 1;
    var ch = sceneCanvas.clientHeight || window.innerHeight || 1;
    W = Math.max(MIN_BACKING, Math.floor(cw * DPR * RENDER_SCALE));
    H = Math.max(Math.floor(MIN_BACKING * (ch / Math.max(cw, 1))),
                 Math.floor(ch * DPR * RENDER_SCALE));
    if (sceneCanvas.width !== W)  { sceneCanvas.width = W; }
    if (sceneCanvas.height !== H) { sceneCanvas.height = H; }
    gl.viewport(0, 0, W, H);
  }
  window.addEventListener("resize", resizeScene, { passive: true });
  resizeScene();

  // Eased pointer parallax. Aspect-corrected so the warp tracks the cursor evenly.
  // Default target leans right to seat the composition before any pointer input.
  var mTarget = [CENTER_X, 0.0];
  var mEased  = [CENTER_X, 0.0];
  if (!REDUCED) {
    window.addEventListener("mousemove", function (e) {
      var rect = sceneCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) { return; }
      mTarget[0] = ((e.clientX - rect.left) / rect.width - 0.5) * (rect.width / rect.height);
      mTarget[1] = (0.5 - (e.clientY - rect.top) / rect.height);
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (!e.touches || !e.touches.length) { return; }
      var rect = sceneCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) { return; }
      var tch = e.touches[0];
      mTarget[0] = ((tch.clientX - rect.left) / rect.width - 0.5) * (rect.width / rect.height);
      mTarget[1] = (0.5 - (tch.clientY - rect.top) / rect.height);
    }, { passive: true });
  }

  var startTime = (window.performance && performance.now) ? performance.now() : Date.now();
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function drawScene(elapsedSeconds) {
    mEased[0] += (mTarget[0] - mEased[0]) * 0.025;
    mEased[1] += (mTarget[1] - mEased[1]) * 0.025;
    gl.useProgram(prog);
    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, elapsedSeconds);
    gl.uniform2f(U.mouse, mEased[0], mEased[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ----------------------------------------------------------------------------
  // RENDER LOOP -- pausable on tab-hide; single still frame under reduced motion.
  // ----------------------------------------------------------------------------
  var rafId = 0;
  var running = false;

  function frame() {
    if (!running) { return; }
    var elapsed = (nowMs() - startTime) / 1000 * TIME_SCALE;
    drawScene(elapsed);
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || REDUCED) { return; }
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  if (REDUCED) {
    // One still frame at a fixed, composed time. No loop.
    drawScene(6.0 * TIME_SCALE);
  } else {
    startLoop();
    // Pause when the tab is hidden; resume (and re-anchor time) when visible.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopLoop();
      } else if (!running) {
        startTime = nowMs() - 6000;  // keep a little motion history on resume
        startLoop();
      }
    }, { passive: true });
    // Redraw on resize while hidden would be wasteful; the loop covers visible resizes.
  }

  // ----------------------------------------------------------------------------
  // MOTES -- a drifting ember / ash layer over the scene (#motes, z-index 2).
  // Skipped entirely under reduced motion (and system.css already sets
  // #motes { display:none } in that case, so this is belt-and-suspenders).
  // ----------------------------------------------------------------------------
  (function moteLayer() {
    if (!moteCanvas || REDUCED) { return; }
    var ctx = moteCanvas.getContext && moteCanvas.getContext("2d");
    if (!ctx) { return; }

    var mW = 1, mH = 1;
    function moteResize() {
      mW = moteCanvas.width  = moteCanvas.clientWidth  || window.innerWidth  || 1;
      mH = moteCanvas.height = moteCanvas.clientHeight || window.innerHeight || 1;
    }
    window.addEventListener("resize", moteResize, { passive: true });
    moteResize();

    // Count scales down a touch on small screens; embers are the bright few, ash
    // the slow many. Colors interpolate --orange -> --ember by per-mote heat.
    var COUNT = (mW < 760) ? 34 : 50;
    var motes = [];
    for (var i = 0; i < COUNT; i++) {
      var isAsh = i > Math.floor(COUNT * 0.72);
      motes.push({
        x:    Math.random() * mW,
        y:    Math.random() * mH,
        r:    isAsh ? Math.random() * 2.6 + 1.0 : Math.random() * 1.3 + 0.3,
        vy:   isAsh ? Math.random() * 0.16 + 0.05 : Math.random() * 0.44 + 0.11,
        ph:   Math.random() * 6.2832,
        wx:   Math.random() * 0.32 + 0.07,
        o:    isAsh ? Math.random() * 0.20 + 0.05 : Math.random() * 0.44 + 0.16,
        hot:  !isAsh && Math.random() < 0.20,
        heat: isAsh ? 0.35 : Math.random(),
        ash:  isAsh
      });
    }

    function lerp(a, b, k) { return a + (b - a) * k; }

    var moteStart = nowMs();
    var moteRaf = 0;
    var moteRunning = false;

    function moteFrame() {
      if (!moteRunning) { return; }
      ctx.clearRect(0, 0, mW, mH);
      var sec = (nowMs() - moteStart) / 1000;
      for (var j = 0; j < motes.length; j++) {
        var p = motes[j];
        p.y -= p.vy;
        p.x += Math.sin(p.y * 0.012 + p.ph + sec * 0.4) * p.wx;
        if (p.y < -8)    { p.y = mH + 8; p.x = Math.random() * mW; }
        if (p.x < -10)   { p.x = mW + 10; }
        if (p.x > mW + 10) { p.x = -10; }
        var pulse = p.hot
          ? p.o * (0.60 + 0.40 * Math.sin(sec * 3.8 + p.ph * 4.0))
          : p.ash
            ? p.o * (0.50 + 0.50 * Math.sin(sec * 0.9 + p.ph))
            : p.o * (0.55 + 0.45 * Math.sin(sec * 1.4 + p.ph));
        // --orange #df5e00 (223,94,0) -> --ember #efab30 (239,171,48)
        var cr = Math.round(lerp(0xdf, 0xef, p.heat));
        var cg = Math.round(lerp(0x5e, 0xab, p.heat));
        var cb = Math.round(lerp(0x00, 0x30, p.heat));
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + pulse.toFixed(3) + ")";
        if (p.ash) { ctx.shadowColor = "rgba(200,160,80,0.4)"; ctx.shadowBlur = 4; }
        else       { ctx.shadowColor = "rgba(" + cr + "," + cg + "," + cb + ",0.85)"; ctx.shadowBlur = p.hot ? 10 : 5; }
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      moteRaf = requestAnimationFrame(moteFrame);
    }

    function moteStartLoop() {
      if (moteRunning) { return; }
      moteRunning = true;
      moteRaf = requestAnimationFrame(moteFrame);
    }
    function moteStopLoop() {
      moteRunning = false;
      if (moteRaf) { cancelAnimationFrame(moteRaf); moteRaf = 0; }
    }

    moteStartLoop();
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { moteStopLoop(); }
      else { moteStart = nowMs(); moteStartLoop(); }
    }, { passive: true });
  })();

})();
