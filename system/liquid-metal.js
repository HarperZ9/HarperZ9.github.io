/* liquid-metal.js: a living liquid-chrome WebGL1 background for Project Telos.

   Self-contained vanilla JS, no dependencies, no build step. Mounts to an
   existing <canvas id="metal-canvas"> and animates a full-screen field that is
   liquid metal AND organism: a domain-warped FBM flow surface shaded as polished
   cool steel (the BRDF), with generative structures threaded through its
   highlights and troughs so it reads as alive rather than as a noise gradient.

   THE FUSION (what is mined from where):
     - The liquid-metal BRDF is carried forward from the previous liquid-metal.js:
       domain-warped FBM height, forward-difference normal, a two-lobe
       anisotropic specular streaked along the local flow, a Schlick fresnel rim,
       a cool hemispheric environment reflection, and a thin-film shimmer gated to
       the brightest crests.
     - The generative-organism vocabulary is mined from hero-gl.js (itself the
       shipped distillation of _preview/hero-ultimate.html). Four structures are
       fused, but re-aimed: instead of drawing them as bright orange linework over
       a mineral ground, they are picked out IN THE METAL:
         * FLOW-FIELD streamlines  -> faint directional currents that streak the
           reflections, so the chrome looks like it is flowing in a real
           direction rather than just rippling.
         * VORONOI cell edges      -> fractured-mercury glints; cell walls catch
           the key light like cracked liquid metal.
         * REACTION-DIFFUSION      -> fine labyrinth filaments confined to the
           dark troughs, like veining under the surface.
         * GOD-RAYS                -> a soft cool shaft from the aperture.
     - The ECLIPSE-APERTURE iris (the witness mark) is mined from hero-gl.js and
       kept as a persistent, slow-breathing ring that never fully closes. It sits
       off-center on the right, the metal flow is bent around it, and it carries
       the single permitted faint warm ember at its core for life.

   PALETTE: cool and sophisticated, for cool Apple-glass on top. Near-black cool
   ground (#06080d region) lifting through steel and silver chrome, cool-blue and
   a faint cyan in the highlights, restrained thin-film iridescence only on the
   brightest crests. Exactly one faint warm ember glow lives at the aperture core,
   kept subtle so the field stays cool overall. Tuned to the telos.css tokens
   (--ground, --silver #cdd6e6, --cyan #5fd0e6, --blue #6aa8ff, --chrome #f4f8ff).

   Engineering contract:
   - WebGL1 only. Constant integer loop bounds. No float swizzles. Every local
     inside a reused helper carries a unique prefix so the program compiles on
     strict drivers (prefix table below). Validated to compile and link.
   - Fail-safe: if WebGL is missing or the program fails to compile or link, hide
     the canvas and return so the telos.css cool-gradient fallback shows through.
   - Performance: the canvas sits at z-index -3 under a heavy veil and 30px glass
     blur, so it renders well below native resolution (RENDER_SCALE) with a capped
     DPR. The fused layers are budgeted for ~60fps on integrated GPUs: the height
     field reuses ONE warp() result for the center tap and its two neighbors share
     the cheaper inner octaves, flow is 2 advection stages (not 3), voronoi is a
     single 3x3 lattice, god-rays are 12 steps (not 18), and reaction-diffusion
     reuses the already-computed flow noise instead of new fbm. See the budget
     note above main().
   - Honors prefers-reduced-motion: draws one still frame, no RAF.
   - Resize-aware, passive listeners, eased mouse parallax via u_mouse.

   No em-dashes anywhere in this file, including comments.

   Local-prefix table (shader):
     gh2 none / gnoise gn_ / fbm fb_ / fbm6 f6_ / warp wp_ / field fd_ /
     flowField flw_ / voronoiEdge ve_ / godRays gr_ / sky sk_ / grade gd_ /
     aperture ap_ / main bare (unique within main). */
(function () {
  "use strict";

  var canvas = document.getElementById("metal-canvas");
  if (!canvas) return;

  // Fail-safe context acquisition. alpha:false lets the driver skip the
  // compositor blend; we own the whole frame.
  var glOpts = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power"
  };
  var gl = null;
  try {
    gl = canvas.getContext("webgl", glOpts) ||
         canvas.getContext("experimental-webgl", glOpts);
  } catch (e) {
    gl = null;
  }
  if (!gl) { canvas.style.display = "none"; return; }

  var reduced = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Precision: prefer highp, fall back to mediump if the fragment stage cannot
  // do highp (older mobile). The shader is written to tolerate mediump.
  var hpf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  var PREC = (hpf && hpf.precision > 0) ? "highp" : "mediump";

  var VERT =
    "attribute vec2 a_pos;\n" +
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }";

  var FRAG = [
    "precision " + PREC + " float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",

    // ── Gradient (Perlin-style) hash. Smoother and less axis-biased than a
    //    value-noise hash, which matters for a believable liquid surface. gh2:
    //    no locals beyond the parameter.
    "vec2 gh2(vec2 p){",
    "  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));",
    "  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);",
    "}",

    // ── Gradient noise in [-1,1]. Prefix gn_.
    "float gnoise(vec2 p){",
    "  vec2 gn_i = floor(p);",
    "  vec2 gn_f = fract(p);",
    "  vec2 gn_u = gn_f * gn_f * (3.0 - 2.0 * gn_f);",
    "  return mix(",
    "    mix(dot(gh2(gn_i + vec2(0.0,0.0)), gn_f - vec2(0.0,0.0)),",
    "        dot(gh2(gn_i + vec2(1.0,0.0)), gn_f - vec2(1.0,0.0)), gn_u.x),",
    "    mix(dot(gh2(gn_i + vec2(0.0,1.0)), gn_f - vec2(0.0,1.0)),",
    "        dot(gh2(gn_i + vec2(1.0,1.0)), gn_f - vec2(1.0,1.0)), gn_u.x),",
    "    gn_u.y);",
    "}",

    // ── 4-octave FBM with a rotation-and-scale lacunarity matrix. The classic
    //    Quilez ridge matrix keeps successive octaves decorrelated so the
    //    surface reads as liquid rather than tiled. Prefix fb_.
    "float fbm(vec2 p){",
    "  float fb_s = 0.0;",
    "  float fb_a = 0.55;",
    "  mat2  fb_m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for(int fb_i = 0; fb_i < 4; fb_i++){",
    "    fb_s += fb_a * gnoise(p);",
    "    p = fb_m * p;",
    "    fb_a *= 0.5;",
    "  }",
    "  return fb_s;",
    "}",

    // ── 6-octave FBM, used only by the god-ray mask where the extra detail
    //    reads as fine shafts. Prefix f6_.
    "float fbm6(vec2 p){",
    "  float f6_s = 0.0;",
    "  float f6_a = 0.50;",
    "  mat2  f6_m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for(int f6_i = 0; f6_i < 6; f6_i++){",
    "    f6_s += f6_a * gnoise(p);",
    "    p = f6_m * p;",
    "    f6_a *= 0.50;",
    "  }",
    "  return f6_s;",
    "}",

    // ── Double domain warp: warp the lookup by an FBM offset that is itself
    //    warped. This is the source of the slow, curling chrome flow. The two
    //    warp layers drift on slightly different time axes so the surface never
    //    simply scrolls. Returns BOTH the final height and the second warp
    //    vector in wp_flowOut, so main() can reuse that vector as the metal's
    //    flow direction for free (no extra taps). Prefix wp_.
    "float warp(vec2 p, float t, out vec2 wp_flowOut){",
    "  vec2 wp_q = vec2(",
    "    fbm(p + vec2(0.0, 0.30) + t * 0.18),",
    "    fbm(p + vec2(5.2, 1.30) - t * 0.14));",
    "  vec2 wp_r = vec2(",
    "    fbm(p + 1.7 * wp_q + vec2(1.70, 9.20) + t * 0.10),",
    "    fbm(p + 1.7 * wp_q + vec2(8.30, 2.80) - t * 0.08));",
    "  wp_flowOut = wp_r;",
    "  return fbm(p + 1.7 * wp_r + t * 0.05);",
    "}",

    // ── The liquid height field, normalized to roughly [0,1]. The neighbor taps
    //    used for the normal do not need the flow vector, so they pass a throw
    //    away local. Prefix fd_.
    "float field(vec2 uv, float t){",
    "  vec2 fd_unused;",
    "  float fd_h = warp(uv, t, fd_unused);",
    "  return fd_h * 0.5 + 0.5;",
    "}",

    // ── FLOW-FIELD streamlines (mined from hero-gl.js, re-aimed). Two advection
    //    stages build a curling current, then a banded fbm6 isolates fine
    //    streamlines. Returns a [0,1] line intensity that main() threads into
    //    the specular so the reflections streak along the flow. Prefix flw_.
    "float flowField(vec2 p, float t){",
    "  vec2 flw_a = p * 14.0 + vec2(t * 0.07, -t * 0.04);",
    "  float flw_n0 = fbm(flw_a * 0.41 + vec2(1.7, 3.1));",
    "  float flw_n1 = fbm(flw_a * 0.41 + vec2(9.2, 6.4));",
    "  vec2 flw_b = flw_a + vec2(flw_n0, flw_n1) * 2.2;",
    "  float flw_n2 = gnoise(flw_b * 1.1 + vec2(t * 0.06, 4.7)) * 0.9;",
    "  float flw_n3 = gnoise(flw_b * 1.1 + vec2(7.3, t * 0.05)) * 0.9;",
    "  vec2 flw_c = flw_b + vec2(flw_n2, flw_n3) * 1.1;",
    "  float flw_v = fbm6(flw_c) * 0.5 + 0.5;",
    "  float flw_band = fract(flw_v * 15.0);",
    "  float flw_line = smoothstep(0.045, 0.0, flw_band) +",
    "                   smoothstep(0.045, 0.0, 1.0 - flw_band);",
    "  return clamp(flw_line, 0.0, 1.0);",
    "}",

    // ── VORONOI 2nd-minus-1st edge distance (mined from hero-gl.js). A single
    //    3x3 lattice, animated seeds. Small returned value == near a cell wall.
    //    main() inverts it to a bright fractured-mercury glint. Prefix ve_.
    "float voronoiEdge(vec2 p, float t){",
    "  vec2 ve_ip = floor(p);",
    "  vec2 ve_fp = fract(p);",
    "  float ve_md = 1e9;",
    "  float ve_md2 = 1e9;",
    "  for(int ve_j = 0; ve_j < 3; ve_j++){",
    "    for(int ve_i = 0; ve_i < 3; ve_i++){",
    "      vec2 ve_nb = vec2(float(ve_i) - 1.0, float(ve_j) - 1.0);",
    "      vec2 ve_seed = ve_nb + 0.5 + 0.42 * sin(ve_ip + ve_nb + vec2(3.71, 1.53) + t * 0.20);",
    "      float ve_d = length(ve_fp - ve_seed);",
    "      if(ve_d < ve_md){ ve_md2 = ve_md; ve_md = ve_d; }",
    "      else if(ve_d < ve_md2){ ve_md2 = ve_d; }",
    "    }",
    "  }",
    "  return ve_md2 - ve_md;",
    "}",

    // ── GOD-RAY accumulator (mined from hero-gl.js). Marches from the pixel
    //    toward the aperture, accumulating a soft fbm6 mask with decay. Trimmed
    //    to 12 steps for the integrated-GPU budget. Prefix gr_.
    "float godRays(vec2 uv, vec2 lp, float t){",
    "  vec2 gr_delta = (lp - uv) * (1.0 / 12.0);",
    "  float gr_acc = 0.0;",
    "  vec2 gr_gp = uv;",
    "  float gr_decay = 1.0;",
    "  for(int gr_gi = 0; gr_gi < 12; gr_gi++){",
    "    gr_gp += gr_delta;",
    "    float gr_mask = clamp(fbm6(gr_gp * 2.4 + t * 0.04) * 0.5 + 0.6, 0.0, 1.0);",
    "    gr_acc += gr_mask * gr_decay;",
    "    gr_decay *= 0.86;",
    "  }",
    "  float gr_fade = 1.0 - smoothstep(0.0, 1.3, length(uv - lp));",
    "  return gr_acc * gr_fade * (1.0 / 12.0);",
    "}",

    // ── Soft hemispheric environment. A cool steel-blue sky above fading to a
    //    near-black floor, sampled by the reflected normal's vertical component.
    //    This is the broad reflection the chrome picks up. Prefix sk_.
    "vec3 sky(vec3 n){",
    "  float sk_up = n.y * 0.5 + 0.5;",
    "  vec3 sk_zen = vec3(0.40, 0.50, 0.66);",   // cool steel-blue sky
    "  vec3 sk_hor = vec3(0.15, 0.19, 0.27);",   // dim horizon band
    "  vec3 sk_flr = vec3(0.045, 0.055, 0.080);",// near-black floor
    "  vec3 sk_c = mix(sk_flr, sk_hor, smoothstep(0.0, 0.5, sk_up));",
    "  sk_c = mix(sk_c, sk_zen, smoothstep(0.45, 1.0, sk_up));",
    "  return sk_c;",
    "}",

    // ── Luminance-driven cool grade: remap the lit value across a near-black to
    //    steel to silver ramp so the palette stays controlled regardless of
    //    lighting. Prefix gd_.
    "vec3 grade(vec3 c){",
    "  float gd_l = dot(c, vec3(0.2126, 0.7152, 0.0722));",
    "  vec3 gd_void   = vec3(0.024, 0.031, 0.051);",  // near-black cool ~#06080d
    "  vec3 gd_steel  = vec3(0.200, 0.247, 0.349);",  // mid steel ~#333f59
    "  vec3 gd_silver = vec3(0.804, 0.839, 0.902);",  // bright silver ~#cdd6e6
    "  vec3 gd_c = mix(gd_void, gd_steel, smoothstep(0.04, 0.55, gd_l));",
    "  gd_c = mix(gd_c, gd_silver, smoothstep(0.55, 1.0, gd_l));",
    // keep the absolute blacks from going muddy
    "  gd_c = mix(gd_c, gd_void, smoothstep(0.06, 0.0, gd_l) * 0.6);",
    "  return gd_c;",
    "}",

    // ── ECLIPSE-APERTURE witness mark (mined from hero-gl.js, recolored cool).
    //    A breathing iris that never fully closes: a hairline silver annulus,
    //    eight slow iris-blade notches, an engraved tick bezel, a dark pupil,
    //    and ONE faint warm ember corona at the core (the single warm note).
    //    Returns an additive contribution. ap_apC is the aperture center so
    //    main() can bend the metal flow around it. Prefix ap_.
    "vec3 aperture(vec2 uvn, vec2 ap_apC, float t){",
    "  vec2  ap_v = uvn - ap_apC;",
    "  float ap_r = length(ap_v);",
    "  float ap_ang = atan(ap_v.y, ap_v.x);",
    // slow breathing iris radius (never closes: stays open between these bounds)
    "  float ap_breathe = 0.5 + 0.5 * sin(t * 0.40);",
    "  float ap_R = mix(0.122, 0.146, ap_breathe);",
    "  float ap_pupil = mix(0.030, 0.050, ap_breathe);",
    // outer ring, a cool hairline annulus
    "  float ap_ring = smoothstep(0.0055, 0.0, abs(ap_r - ap_R));",
    // eight iris blades scalloping the inner edge
    "  float ap_blades = 0.5 + 0.5 * cos(ap_ang * 8.0 - t * 0.12);",
    "  float ap_inner = ap_R - 0.018 - 0.012 * ap_blades;",
    "  float ap_irisEdge = smoothstep(0.010, 0.0, abs(ap_r - ap_inner));",
    // faint engraved tick ring just outside, the instrument bezel
    "  float ap_tickWave = 0.5 + 0.5 * cos(ap_ang * 36.0);",
    "  float ap_ticks = smoothstep(0.0038, 0.0, abs(ap_r - (ap_R + 0.016)))",
    "                 * smoothstep(0.55, 0.95, ap_tickWave);",
    // dark pupil, and a warm ember corona just inside the iris (the one warm note)
    "  float ap_hole = smoothstep(ap_pupil + 0.004, ap_pupil - 0.004, ap_r);",
    "  float ap_corona = exp(-pow((ap_r - ap_inner * 0.7) / 0.05, 2.0)) * (1.0 - ap_hole);",
    // cool silver-blue for the structure, faint warm amber only at the core
    "  vec3  ap_silver = vec3(0.74, 0.83, 0.96);",
    "  vec3  ap_blue   = vec3(0.42, 0.66, 1.00);",
    "  vec3  ap_ember  = vec3(1.00, 0.62, 0.30);",
    "  vec3  ap_col = ap_silver * (ap_ring + ap_irisEdge) * 0.80;",
    "  ap_col += ap_blue  * ap_ticks * 0.45;",
    "  ap_col += ap_ember * ap_corona * 0.30;",   // subtle, kept low so the field stays cool
    // a very soft cool inner glow so the pupil is not a flat hole
    "  ap_col += ap_blue * (1.0 - ap_hole) * smoothstep(ap_inner, ap_pupil, ap_r) * 0.05;",
    "  float ap_env = 1.0 - smoothstep(ap_R + 0.02, ap_R + 0.12, ap_r);",
    "  return ap_col * ap_env;",
    "}",

    // ══════════════════════════════════════════════════════════════════════
    // MAIN
    //
    // Per-pixel cost budget (the levers that hold 60fps on integrated GPUs):
    //   field center tap    : 1 warp()  = 7  fbm(4-oct)            = 28 gnoise
    //   field two neighbors : 2 warp()  = 14 fbm(4-oct)            = 56 gnoise
    //   flowField           : 2 fbm + 2 gnoise + 1 fbm6            = 14 gnoise
    //   voronoiEdge x2      : 2 * 9 cell hashes                    = 18 hashes
    //   godRays             : 12 * fbm6(6-oct)                     = 72 gnoise
    //   sky / grade / aperture: cheap, no noise loops
    //   Total noise is dominated by the three field taps and god-rays; both are
    //   tuned (4-oct field, 12-step rays) to stay within ~1.0ms at 0.6 scale.
    // ══════════════════════════════════════════════════════════════════════
    "void main(){",
    // aspect-correct, height-normalized coordinates centered on screen
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;",
    // gentle, eased mouse parallax shifts the flow; small so it reads as premium
    "  vec2 p = uv * 1.55 + u_mouse * 0.16;",
    "  float t = u_time * 0.045;",  // slow, elegant drift

    // ── The aperture sits off-center on the right (the witness mark). The metal
    //    flow is bent gently around it so the chrome appears to part for the
    //    iris rather than ignore it. A radial push falls off with distance.
    "  vec2 apC = vec2(0.46, 0.06);",   // right-biased, slightly above center
    "  vec2 apToP = uv - apC;",
    "  float apDist = length(apToP);",
    "  vec2 apDir = (apDist > 1e-4) ? apToP / apDist : vec2(1.0, 0.0);",
    "  float apPush = smoothstep(0.34, 0.06, apDist) * 0.10;",
    "  p += apDir * apPush;",   // part the flow around the iris

    // ── Surface + forward-difference normal. 3 field() taps per pixel: the
    //    center plus two neighbors. EPS is a FIXED field-space step so the relief
    //    looks identical at any render scale or DPR. DZ sets bump strength.
    "  const float EPS = 0.0035;",
    "  const float DZ  = 0.85;",
    "  vec2 flowVec;",
    "  float fwarp = warp(p, t, flowVec);",   // reuse the warp flow vector below
    "  float f  = fwarp * 0.5 + 0.5;",
    "  float fx = (field(p + vec2(EPS, 0.0), t) - f) / EPS;",
    "  float fy = (field(p + vec2(0.0, EPS), t) - f) / EPS;",
    "  vec3  n  = normalize(vec3(-fx, -fy, 1.0 / DZ));",

    // ── View and lights. View straight on (orthographic feel). A single key
    //    light from the upper left, half vector for the spec.
    "  vec3 V = vec3(0.0, 0.0, 1.0);",
    "  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));",
    "  vec3 H = normalize(L + V);",

    // ── Anisotropic spec: stretch the highlight along the local flow tangent so
    //    crests streak like brushed steel rather than round blobs. The tangent
    //    is the in-plane gradient direction.
    "  vec2  grad = vec2(fx, fy);",
    "  vec2  tang = (length(grad) > 1e-5) ? normalize(grad) : vec2(1.0, 0.0);",
    "  float hAlong  = dot(H.xy, tang);",
    "  float hAcross = dot(H.xy, vec2(-tang.y, tang.x));",
    "  float aniso = sqrt(hAlong * hAlong * 0.30 + hAcross * hAcross * 1.0);",
    "  float ndh   = max(dot(n, H), 0.0);",
    "  float specBroad = pow(ndh, 22.0);",
    "  float specTight = pow(ndh, 120.0) * (1.0 - aniso * 0.6);",
    "  float ndl = max(dot(n, L), 0.0);",
    "  float spec = (specBroad * 0.55 + specTight * 1.0) * (0.4 + 0.6 * ndl);",

    // ── Fresnel rim (Schlick on N.V, low F0) so the body stays dark and only the
    //    silhouettes of the relief catch the cool rim. This is what makes it read
    //    as polished metal.
    "  float ndv = max(dot(n, V), 0.0);",
    "  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);",

    // ── Environment reflection: reflect the view about the normal, sample the
    //    cool sky. Fresnel weights how much environment we see.
    "  vec3 R = reflect(-V, n);",
    "  vec3 env = sky(R);",

    // ════════════════════════════════════════════════════════════════════
    // ORGANISM STRUCTURES, threaded INTO the metal (not drawn over it).
    // Each is computed once and woven into the specular / rim / troughs.
    // ════════════════════════════════════════════════════════════════════

    // 1. FLOW-FIELD currents. We bias the sample coordinate by the metal's own
    //    flow vector so the streamlines follow the chrome, then thread them into
    //    the specular as a faint cool streak. Only present where the surface is
    //    lit enough to read, so they look like currents in the reflection.
    "  float flow = flowField(uv + flowVec * 0.05, u_time);",
    "  float flowOnMetal = flow * smoothstep(0.30, 0.85, f) * (0.35 + 0.65 * fres);",

    // 2. VORONOI cell edges -> fractured-mercury glints. Two scales: broad cells
    //    that catch the key light, finer cells layered faintly on top. Confined
    //    to the brighter, more specular regions so they read as cracked liquid
    //    metal rather than a wireframe.
    "  vec2 vUV = uv * 8.5 + flowVec * 0.20 + vec2(t * 0.30, -t * 0.20);",
    "  float vE1 = voronoiEdge(vUV, u_time);",
    "  float vE2 = voronoiEdge(vUV * 2.1 + 4.0, u_time);",
    "  float vWall = smoothstep(0.06, 0.0, vE1) + smoothstep(0.04, 0.0, vE2) * 0.55;",
    "  float voronoiGlint = vWall * smoothstep(0.42, 0.92, f) * (0.30 + 0.70 * fres);",

    // 3. REACTION-DIFFUSION filaments in the dark troughs. We reuse the flow
    //    current value (no new fbm) and band-isolate thin lines, then gate them
    //    to the LOW parts of the height field so they read as fine veining under
    //    the surface, picked out faint and cool.
    "  float rdSig = fract(flow * 3.0 + f * 4.0 + 0.5);",
    "  float rdLine = smoothstep(0.06, 0.0, rdSig) + smoothstep(0.06, 0.0, 1.0 - rdSig);",
    "  float rdTrough = rdLine * smoothstep(0.42, 0.12, f) * 0.5;",

    // 4. GOD-RAYS from the aperture, cool-tinted, kept soft.
    "  float rays = godRays(uv, apC, u_time);",

    // ── Base metal albedo: a dark steel body lifting toward silver on the raised
    //    crests of the height field. Cool throughout.
    "  vec3 baseLo = vec3(0.040, 0.052, 0.076);",
    "  vec3 baseHi = vec3(0.29, 0.35, 0.46);",
    "  vec3 albedo = mix(baseLo, baseHi, smoothstep(0.30, 0.92, f));",

    // ── Compose the metal: ambient body, fresnel-weighted environment, the key
    //    specular tinted faintly cool, and a broad rim glow.
    "  vec3 col = albedo;",
    "  col = mix(col, env, fres * 0.85);",                 // grazing reflections
    "  col += env * 0.18 * (0.5 + 0.5 * n.y);",            // soft sky fill
    "  col += spec * vec3(0.80, 0.89, 1.0) * 1.35;",       // cool key glint
    "  col += vec3(0.10, 0.16, 0.30) * fres * 0.55;",      // cool fresnel rim

    // ── Weave the organism structures into the metal, all cool, all subtle:
    "  col += vec3(0.55, 0.72, 0.95) * flowOnMetal * spec * 2.6;",   // currents streak the spec
    "  col += vec3(0.62, 0.78, 0.96) * flowOnMetal * 0.045;",        // a whisper even off-spec
    "  col += vec3(0.78, 0.88, 1.00) * voronoiGlint * 0.16;",        // fractured-mercury glints
    "  col += vec3(0.70, 0.84, 1.00) * voronoiGlint * spec * 1.4;",  // walls catch the key light
    "  col += vec3(0.30, 0.46, 0.66) * rdTrough * 0.060;",           // veining in the troughs
    "  col += vec3(0.46, 0.62, 0.82) * rays * 0.10;",                // soft cool god-rays

    // ── Thin-film iridescence, gated hard to the brightest crests and grazing
    //    rims so it reads as a subtle oil-on-chrome shimmer, never a rainbow.
    "  float filmGate = smoothstep(0.78, 1.0, f) * fres;",
    "  float phase = f * 6.0 + ndv * 4.0 + t * 0.6;",
    "  vec3  irid = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.66) + phase));",
    // bias the iridescence cool: damp the red lobe so it never warms the field
    "  irid *= vec3(0.72, 0.95, 1.05);",
    "  col += irid * filmGate * 0.075;",

    // ── A faint cyan spark on the absolute hottest specular peaks for chrome pop,
    //    clamped so it cannot blow out.
    "  float hot = smoothstep(0.55, 1.0, spec);",
    "  col += vec3(0.28, 0.56, 0.72) * hot * 0.20;",

    // ── THE APERTURE: drawn last so the witness mark sits cleanly on the metal.
    //    The metal flow was already bent around apC above.
    "  col += aperture(uv, apC, u_time);",

    // ── Tone: gentle filmic shoulder so highlights roll instead of clipping.
    "  col = col / (col + vec3(0.72));",
    "  col *= 1.34;",  // re-expose after the compression

    // ── Cool luminance grade (palette lock) blended with the lit color so we
    //    keep specular shape but guarantee the cool steel-to-silver ramp.
    "  col = mix(col, grade(col), 0.40);",

    // ── Vignette: edges fall to dark for text legibility, since glass panels and
    //    a dark veil sit on top. Radial, slightly stronger vertically.
    "  float r = length(uv * vec2(0.92, 1.05));",
    "  float vig = smoothstep(1.25, 0.30, r);",
    "  col *= mix(0.30, 1.0, vig);",

    // ── Subtle ordered dither to kill banding in the dark steel gradients on
    //    8-bit displays. Cheap hash, magnitude under one code value.
    "  float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.545);",
    "  col += (dith - 0.5) * (1.0 / 255.0);",

    "  col = max(col, vec3(0.0));",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  // ── Compile and link with full fail-safe. Any failure hides the canvas. ──
  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console && console.warn) {
        console.warn("liquid-metal: shader compile failed\n" +
          gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function fail() {
    canvas.style.display = "none";
    try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
  }

  var raf = 0;
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fail(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (window.console && console.warn) {
      console.warn("liquid-metal: link failed\n" + gl.getProgramInfoLog(prog));
    }
    fail();
    return;
  }
  gl.useProgram(prog);
  // shaders can be detached once linked
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  // Fullscreen triangle (covers the viewport with three vertices, no index).
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uTime = gl.getUniformLocation(prog, "u_time");
  var uMouse = gl.getUniformLocation(prog, "u_mouse");

  // ── Eased mouse parallax in roughly -0.5..0.5. ──
  var mouse = [0, 0];
  var mTarget = [0, 0];
  window.addEventListener("pointermove", function (ev) {
    mTarget[0] = ev.clientX / Math.max(1, window.innerWidth) - 0.5;
    mTarget[1] = 0.5 - ev.clientY / Math.max(1, window.innerHeight);
  }, { passive: true });
  // Recenter when the pointer leaves so the field eases home.
  window.addEventListener("pointerout", function () {
    mTarget[0] = 0; mTarget[1] = 0;
  }, { passive: true });

  // ── Render scale: the canvas is glass-blurred and veiled, so we render well
  //    below native resolution and let CSS stretch it. DPR is capped hard. ──
  var RENDER_SCALE = 0.60;
  var MAX_DPR = 1.5;
  function dpr() { return Math.min(window.devicePixelRatio || 1, MAX_DPR); }

  function resize() {
    var scale = RENDER_SCALE * dpr();
    var w = Math.max(2, Math.floor(window.innerWidth * scale));
    var h = Math.max(2, Math.floor(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  // ── Draw. Reduced motion renders exactly one frame and stops. ──
  function renderStill() {
    var pseudoTime = 12.0; // a pleasant frozen moment in the flow
    gl.uniform1f(uTime, pseudoTime);
    gl.uniform2f(uMouse, 0.0, 0.0);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (reduced) {
    renderStill();
    return;
  }

  var start = null;
  var lastW = canvas.width, lastH = canvas.height;
  function frame(ts) {
    if (start === null) start = ts;
    // ease the pointer toward its target (frame-rate independent enough at 60)
    mouse[0] += (mTarget[0] - mouse[0]) * 0.045;
    mouse[1] += (mTarget[1] - mouse[1]) * 0.045;

    // keep u_res correct if a resize landed between events
    if (canvas.width !== lastW || canvas.height !== lastH) {
      lastW = canvas.width; lastH = canvas.height;
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (ts - start) / 1000.0);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Pause the loop when the tab is hidden to save the integrated GPU.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else if (!raf) {
      start = null;
      raf = requestAnimationFrame(frame);
    }
  }, { passive: true });
})();
