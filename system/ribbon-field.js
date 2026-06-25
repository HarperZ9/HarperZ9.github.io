/* ribbon-field.js: the signature white-sculptural hero for Project Telos.

   A single sculptural object rotating in a white void: a vertical stack of thin
   ceramic slats that twist into a helix and slowly flow and reorder, grounded by a
   soft contact shadow. The aircenter.space language (one object, deep negative
   space, type pinned to the edges), made specifically Telos: the slats are planes
   of evidence the system stacks into one verified structure. It assembles from a
   flat collapsed stack on load (perceive), then the twist deepens as you scroll.

   TECHNIQUE: a raymarched signed-distance field in a single fullscreen triangle,
   WebGL1. Chosen over rasterized geometry because soft shadows, ambient occlusion,
   and clean anti-aliased silhouettes come essentially for free, and it reuses the
   proven fail-safe harness from system/liquid-metal.js. The canvas is transparent
   with premultiplied alpha, so the page's white ceramic ground shows through and
   the object plus its soft shadow composite straight onto it.

   THE SDF (cheap and bounded):
     - The object is N thin slats stacked along Y. Because each slat is thin in Y
       and stays in its own height band, a sample point only needs the nearest 2 to
       3 slats: k = round(p.y / spacing), evaluate k-1, k, k+1. Per-step cost is
       constant regardless of N.
     - Each slat's lateral sweep (an S-curve through space) and its twist about Y
       are CLOSED FORM in the slat index and time, so there are no uniform arrays
       (which WebGL1 cannot index dynamically in the fragment stage) and no data
       textures. Slats rotate about Y only, never tilt, so the nearest-band lookup
       stays exact.
     - A vertical bounding cylinder gates the march: most of the frame is empty
       white, so rays that miss the cylinder skip straight to the ground-shadow
       test. That is what keeps it within a 60fps budget on integrated GPUs.

   MATERIAL: high-albedo white ceramic, soft wrap diffuse, a low soft specular, a
   Schlick fresnel that samples a faint cool-to-warm studio environment, SDF ambient
   occlusion in the crevices between slats, and the single permitted accent: a
   thin-film iridescent sheen gated hard to grazing silhouette edges.

   ENGINEERING CONTRACT (carried from liquid-metal.js):
     - WebGL1 only. Constant loop bounds. No dynamic array indexing. Local names are
       prefixed per helper so the program links on strict drivers (prefix table at
       the foot of this header).
     - Fail-safe: if WebGL is missing or the program fails to compile or link, hide
       the canvas and return so the telos.css white fallback shows through.
     - Honors prefers-reduced-motion: draws one settled still frame, no RAF.
     - Adaptive render scale: starts at 0.82, measures the first frames, and drops
       toward 0.5 if the GPU is slow. DPR is capped. Cone-footprint alpha feather
       gives a clean ~1.5px silhouette without supersampling.
     - Resize-aware, passive scroll listener, scroll-driven twist, paused while the
       tab is hidden.

   No em-dashes anywhere in this file, including comments. Commas and colons only.

   Local-prefix table (shader):
     rot2 r2_ / sdRoundBox sb_ / slatCenter sc_ / slatTwist st_ / map mp_ /
     normal nm_ / softShadow ss_ / ao ao_ / env ev_ / cylinder cy_ / main bare. */
(function () {
  "use strict";

  var canvas = document.getElementById("ribbon-canvas");
  if (!canvas) return;

  // Transparent, premultiplied: the compositor lays the canvas over the page's
  // white ground, so we output premultiplied alpha (rgb * a, a) and never blend.
  var glOpts = {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: true,
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

  var hpf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  var PREC = (hpf && hpf.precision > 0) ? "highp" : "mediump";

  var VERT =
    "attribute vec2 a_pos;\n" +
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }";

  // N is a compile-time constant so the band loop bounds stay constant.
  var N_SLATS = 20;

  var FRAG = [
    "precision " + PREC + " float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform float u_intro;",   // 0..1 assembly on load
    "uniform float u_scroll;",  // 0..1 scroll progress through the hero

    "const int   N = " + N_SLATS + ";",
    "const float NF = " + (N_SLATS - 1) + ".0;",
    "const float SP = 0.225;",     // vertical spacing between slats
    "const float HW = 1.22;",      // slat half width (X), a broad blade
    "const float HD = 0.42;",      // slat half depth (Z), deeper tile body
    "const float HT = 0.046;",     // slat half thickness (Y), real ceramic depth
    "const float RAD = 0.034;",    // slat edge rounding
    "const float SWEEP = 0.34;",   // lateral S-curve amplitude, contained
    "const float BASE_TWIST = 0.352;", // helix twist per slat, a full turn over the stack
    "const float PI = 3.14159265;",

    // Y0 is the lowest slat center; the column is centered on the origin.
    "const float Y0 = -0.5 * NF * SP;",

    // ---- 2D rotation about Y, used to bring a world point into a slat frame.
    "void r2_rot(inout vec2 r2_p, float r2_a){",
    "  float r2_s = sin(r2_a);",
    "  float r2_c = cos(r2_a);",
    "  r2_p = vec2(r2_c * r2_p.x + r2_s * r2_p.y, -r2_s * r2_p.x + r2_c * r2_p.y);",
    "}",

    // ---- rounded box SDF (Quilez). Prefix sb_.
    "float sb_box(vec3 sb_p, vec3 sb_b, float sb_r){",
    "  vec3 sb_q = abs(sb_p) - sb_b;",
    "  return length(max(sb_q, 0.0)) + min(max(sb_q.x, max(sb_q.y, sb_q.z)), 0.0) - sb_r;",
    "}",

    // ---- closed-form lateral center of slat idx (no arrays). The sweep grows
    //      with assembly so the stack blooms from a flat column into an S-curve.
    //      Prefix sc_.
    "vec2 sc_center(float sc_idx, float sc_asm){",
    "  float sc_u = sc_idx / NF;",
    "  float sc_x = sin(sc_u * PI * 1.10 + u_scroll * 0.85) * SWEEP;",
    "  float sc_z = cos(sc_u * PI * 0.90 - u_scroll * 0.65) * SWEEP * 0.62;",
    "  return vec2(sc_x, sc_z) * sc_asm;",
    "}",

    // ---- closed-form twist of slat idx. Helix term plus a slow flowing flourish
    //      plus a scroll-driven deepening, all gated by assembly. Prefix st_.
    "float st_twist(float st_idx, float st_asm){",
    // the SPIRAL HELIX is preserved through the whole scroll (no un-twisting). The
    // object still drifts slowly; its verify edge ignites near the floor (in main).
    "  float st_helix = (st_idx - 0.5 * NF) * BASE_TWIST;",
    "  float st_flow  = sin(st_idx * 0.62 + u_scroll * 1.35) * 0.18;",
    "  float st_drift = u_scroll * 0.16;",
    "  return (st_helix + st_flow) * st_asm + st_drift;",
    "}",

    // ---- the scene SDF: union of the nearest three slats to p.y. Prefix mp_.
    "float mp_map(vec3 mp_p){",
    "  float mp_s = mix(0.72, 1.0, u_intro);",   // materialize: the form scales in on load
    "  mp_p /= mp_s;",
    "  float mp_fi = (mp_p.y - Y0) / SP;",
    "  float mp_k  = floor(mp_fi + 0.5);",
    "  float mp_d  = 1e9;",
    "  for(int mp_j = -1; mp_j <= 1; mp_j++){",
    "    float mp_idx = mp_k + float(mp_j);",
    "    if(mp_idx < 0.0 || mp_idx > NF) continue;",
    // staggered assembly: lower slats settle first for a build-up read
    "    float mp_asm = clamp(u_intro * 1.85 - (mp_idx / NF) * 0.85, 0.0, 1.0);",
    "    mp_asm = mp_asm * mp_asm * (3.0 - 2.0 * mp_asm);",  // smoothstep ease
    "    vec2  mp_c = sc_center(mp_idx, mp_asm);",
    "    float mp_th = st_twist(mp_idx, mp_asm);",
    "    vec3  mp_lp = mp_p - vec3(mp_c.x, Y0 + mp_idx * SP, mp_c.y);",
    "    vec2  mp_xz = mp_lp.xz;",
    "    r2_rot(mp_xz, mp_th);",
    "    mp_lp.x = mp_xz.x; mp_lp.z = mp_xz.y;",
    "    float mp_b = sb_box(mp_lp, vec3(HW, HT, HD), RAD);",
    "    mp_d = min(mp_d, mp_b);",
    "  }",
    "  return mp_d * mp_s;",   // rescale the distance to stay metric under the scale-in
    "}",

    // ---- normal by central differences. Prefix nm_.
    "vec3 nm_normal(vec3 nm_p){",
    "  vec2 nm_e = vec2(0.0016, 0.0);",
    "  return normalize(vec3(",
    "    mp_map(nm_p + nm_e.xyy) - mp_map(nm_p - nm_e.xyy),",
    "    mp_map(nm_p + nm_e.yxy) - mp_map(nm_p - nm_e.yxy),",
    "    mp_map(nm_p + nm_e.yyx) - mp_map(nm_p - nm_e.yyx)));",
    "}",

    // ---- penumbra soft shadow toward the light. Prefix ss_.
    "float ss_shadow(vec3 ss_ro, vec3 ss_rd, float ss_k){",
    "  float ss_res = 1.0;",
    "  float ss_t = 0.04;",
    "  for(int ss_i = 0; ss_i < 32; ss_i++){",
    "    vec3 ss_p = ss_ro + ss_rd * ss_t;",
    "    float ss_h = mp_map(ss_p);",
    "    if(ss_h < 0.0008) return 0.0;",
    "    ss_res = min(ss_res, ss_k * ss_h / ss_t);",
    "    ss_t += clamp(ss_h, 0.012, 0.10);",
    "    if(ss_t > 4.0) break;",
    "  }",
    "  return clamp(ss_res, 0.0, 1.0);",
    "}",

    // ---- SDF ambient occlusion. Prefix ao_.
    "float ao_occ(vec3 ao_p, vec3 ao_n){",
    "  float ao_s = 0.0;",
    "  float ao_w = 1.0;",
    "  for(int ao_i = 1; ao_i <= 5; ao_i++){",
    "    float ao_d = 0.014 * float(ao_i) * float(ao_i);",
    "    float ao_m = mp_map(ao_p + ao_n * ao_d);",
    "    ao_s += ao_w * (ao_d - ao_m);",
    "    ao_w *= 0.72;",
    "  }",
    "  return clamp(1.0 - 2.4 * ao_s, 0.0, 1.0);",
    "}",

    // ---- white studio environment sampled by a direction. A bright cool sky, a
    //      warm soft floor bounce. Keeps the ceramic reading as white, never gray.
    //      Prefix ev_.
    "vec3 ev_env(vec3 ev_d){",
    "  float ev_up = ev_d.y * 0.5 + 0.5;",
    "  vec3 ev_sky = vec3(0.97, 0.98, 1.00);",
    "  vec3 ev_hor = vec3(0.90, 0.91, 0.95);",
    "  vec3 ev_flr = vec3(0.93, 0.90, 0.87);",  // faint warm bounce
    "  vec3 ev_c = mix(ev_flr, ev_hor, smoothstep(0.0, 0.5, ev_up));",
    "  ev_c = mix(ev_c, ev_sky, smoothstep(0.45, 1.0, ev_up));",
    "  return ev_c;",
    "}",

    // ---- ray vs vertical bounding cylinder (radius cy_R, y in [cy_lo, cy_hi]).
    //      Returns near and far t in cy_out, or a degenerate range on a miss.
    //      Prefix cy_.
    "vec2 cy_hit(vec3 cy_ro, vec3 cy_rd, float cy_R, float cy_lo, float cy_hi){",
    "  float cy_a = dot(cy_rd.xz, cy_rd.xz);",
    "  float cy_b = dot(cy_ro.xz, cy_rd.xz);",
    "  float cy_c = dot(cy_ro.xz, cy_ro.xz) - cy_R * cy_R;",
    "  float cy_disc = cy_b * cy_b - cy_a * cy_c;",
    "  if(cy_disc < 0.0 || cy_a < 1e-6) return vec2(1.0, -1.0);",
    "  float cy_sq = sqrt(cy_disc);",
    "  float cy_t0 = (-cy_b - cy_sq) / cy_a;",
    "  float cy_t1 = (-cy_b + cy_sq) / cy_a;",
    // clip the infinite cylinder to the cap planes
    "  float cy_y0 = cy_ro.y + cy_rd.y * cy_t0;",
    "  float cy_y1 = cy_ro.y + cy_rd.y * cy_t1;",
    "  if(cy_y0 < cy_lo || cy_y0 > cy_hi){",
    "    float cy_tc = (cy_rd.y > 0.0 ? cy_lo : cy_hi - 0.0);",  // entering cap
    "    cy_tc = ((cy_rd.y > 0.0 ? cy_lo : cy_hi) - cy_ro.y) / cy_rd.y;",
    "    cy_t0 = max(cy_t0, cy_tc);",
    "  }",
    "  if(cy_y1 < cy_lo || cy_y1 > cy_hi){",
    "    float cy_td = ((cy_rd.y > 0.0 ? cy_hi : cy_lo) - cy_ro.y) / cy_rd.y;",
    "    cy_t1 = min(cy_t1, cy_td);",
    "  }",
    "  return vec2(max(cy_t0, 0.0), cy_t1);",
    "}",

    "void main(){",
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;",
    // composition: push the object to the center-right so the hero copy lives left.
    // On narrow screens (portrait) the object recenters.
    "  float aspect = u_res.x / u_res.y;",
    "  float compose = aspect > 1.05 ? 0.34 : 0.0;",
    "  uv.x -= compose;",

    // ---- camera: scroll is the only interaction that moves the helix. ----
    "  float scrollSpin = u_scroll * PI * 2.35;",
    "  float yaw = 0.45 + scrollSpin;",
    "  float pitch = 0.13;",
    "  float camDist = mix(9.7, 7.45, u_intro);",
    "  vec3 ro = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * camDist;",
    "  vec3 ta = vec3(0.0, -1.28, 0.0);",   // aim low so the base, floor, and reflection sit in the lower third
    "  vec3 ww = normalize(ta - ro);",
    "  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));",
    "  vec3 vv = cross(uu, ww);",
    "  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.58 * ww);",  // wide, but close enough for the helix to command the page

    // ---- key light and a fill, warm-cool studio rig. ----
    "  vec3 Lkey = normalize(vec3(-0.55, 0.78, 0.40));",
    "  vec3 Lfill = normalize(vec3(0.65, 0.28, 0.50));",
    "  vec3 albedo = vec3(0.93, 0.945, 0.965);",   // ceramic, a hair off white

    // ---- per-ray cone footprint for cheap silhouette anti-aliasing. ----
    "  float pxAng = 1.6 / u_res.y;",

    // ---- bounding-cylinder gate, then sphere-trace inside it. ----
    "  float cy_R = SWEEP + HW + 0.18;",
    "  float yLo = Y0 - HT - 0.05;",
    "  float yHi = Y0 + NF * SP + HT + 0.05;",
    "  vec2 span = cy_hit(ro, rd, cy_R, yLo, yHi);",

    "  vec4 outc = vec4(0.0);",   // premultiplied rgba accumulator
    "  bool hit = false;",
    "  float tHit = 0.0;",
    "  float dLast = 1.0;",

    "  if(span.y > span.x){",
    "    float t = span.x;",
    "    for(int i = 0; i < 110; i++){",
    "      vec3 p = ro + rd * t;",
    "      float d = mp_map(p);",
    "      dLast = d;",
    "      if(d < 0.0006){ hit = true; tHit = t; break; }",
    "      t += d;",
    "      if(t > span.y) break;",
    "    }",
    "  }",

    "  if(hit){",
    "    vec3 p = ro + rd * tHit;",
    "    vec3 n = nm_normal(p);",
    "    vec3 V = -rd;",

    // diffuse: soft half-Lambert wrap for ceramic
    "    float keyW = dot(n, Lkey) * 0.5 + 0.5;",
    "    float fillW = dot(n, Lfill) * 0.5 + 0.5;",
    "    float ao = ao_occ(p, n);",
    "    float sh = ss_shadow(p + n * 0.004, Lkey, 13.0);",

    // Recover local slat coordinates at the hit point for material detail. This is
    // not part of the SDF hit, only a cheap shading layer that gives each tile a
    // real top, underside, bevel, and ceramic edge without changing the march.
    "    float hitFi = clamp(floor((p.y - Y0) / SP + 0.5), 0.0, NF);",
    "    float hitAsm = clamp(u_intro * 1.85 - (hitFi / NF) * 0.85, 0.0, 1.0);",
    "    hitAsm = hitAsm * hitAsm * (3.0 - 2.0 * hitAsm);",
    "    vec2 hitC = sc_center(hitFi, hitAsm);",
    "    vec3 hitLp = p - vec3(hitC.x, Y0 + hitFi * SP, hitC.y);",
    "    vec2 hitXz = hitLp.xz;",
    "    r2_rot(hitXz, st_twist(hitFi, hitAsm));",
    "    hitLp.x = hitXz.x; hitLp.z = hitXz.y;",
    "    float bevelX = smoothstep(HW * 0.72, HW - RAD * 0.7, abs(hitLp.x));",
    "    float bevelZ = smoothstep(HD * 0.52, HD - RAD * 0.7, abs(hitLp.z));",
    "    float bevel = clamp(max(bevelX, bevelZ), 0.0, 1.0);",
    "    float topFace = smoothstep(0.16, 0.72, n.y);",
    "    float underFace = smoothstep(0.08, 0.65, -n.y);",
    "    float sideFace = 1.0 - max(topFace, underFace);",
    "    float ceramicWave = sin(hitLp.x * 9.0 + hitLp.z * 13.0 + hitFi * 1.7) * 0.5 + 0.5;",
    "    float ceramicTooth = mix(0.975, 1.035, ceramicWave) * mix(1.0, 0.90, bevel);",

    "    vec3 col = vec3(0.0);",
    "    col += albedo * keyW * keyW * 1.46 * mix(0.08, 1.0, sh);",   // key, deeper cast shadow
    "    col += albedo * fillW * 0.22 * vec3(1.0, 0.97, 0.93);",       // warm fill
    "    col += ev_env(n) * 0.25 * ao;",                                // ambient env
    "    col *= ceramicTooth;",
    "    col *= mix(1.0, 0.72, underFace);",
    "    col *= mix(1.0, 0.82, sideFace * bevel);",
    // soft specular sheen
    "    vec3 H = normalize(Lkey + V);",
    "    float spec = pow(max(dot(n, H), 0.0), 48.0) * sh;",
    "    col += vec3(1.0) * spec * mix(0.42, 0.72, topFace) * (1.0 - bevel * 0.35);",
    // fresnel rim picks up the environment at grazing angles
    "    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);",
    "    col = mix(col, ev_env(reflect(-V, n)), fres * 0.5);",
    // the single accent: thin-film iridescence gated to grazing silhouette edges
    "    float edge = smoothstep(0.45, 0.92, fres);",
    "    float phase = fres * 5.0 + p.y * 0.9 + u_scroll * 0.65;",
    "    vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.66) + phase));",
    // VERIFY state: as you reach the floor, the witness ignites the iridescent edge.
    "    float verify = smoothstep(0.62, 0.92, u_scroll);",
    "    col += irid * edge * (0.10 + 0.5 * verify);",
    "    col *= mix(0.30, 1.0, ao);",                                   // deepen crevice AO

    // filmic-ish soft shoulder so the whites roll rather than clip
    "    col = col / (col + vec3(0.10));",
    "    col *= 1.10;",
    "    col = clamp(col, 0.0, 1.0);",

    // cone-footprint coverage for a ~1.5px feathered silhouette
    "    float pix = tHit * pxAng;",
    "    float cov = 1.0 - smoothstep(0.0, pix * 1.6, dLast);",
    "    cov = clamp(cov, 0.0, 1.0);",
    "    outc = vec4(col * cov, cov);",
    "  } else {",
    // ---- the ceramic floor: a soft contact shadow plus a faint mirror of the
    //      sculpture, so the object is grounded rather than floating. Drawn over
    //      the page ceramic, so only the shadow and the reflection are painted. ----
    "    float yG = yLo - 0.035;",
    "    if(rd.y < -0.0001 && ro.y > yG){",
    "      float tG = (yG - ro.y) / rd.y;",
    "      if(tG > 0.0){",
    "        vec3 gp = ro + rd * tG;",
    "        float foot = length(gp.xz);",
    "        float floorVis = smoothstep(0.58, 0.92, u_scroll);",
    "        float halo = smoothstep(cy_R + 1.6, 0.0, foot);",
    "        vec2 slabP = vec2(gp.x * 0.78, gp.z * 1.18);",
    "        float slab = smoothstep(5.2, 0.0, length(slabP));",
    "        float slabCore = smoothstep(2.7, 0.0, length(slabP));",
    "        float floorA = floorVis * slab * (0.045 + 0.12 * slabCore);",
    "        if(max(halo, floorA) > 0.001){",
    // soft contact shadow under the form
    "          float gsh = ss_shadow(gp + vec3(0.0, 0.006, 0.0), Lkey, 10.0);",
    "          float castGate = mix(0.36, 1.0, floorVis);",
    "          float shA = (1.0 - gsh) * halo * (0.34 + 0.28 * floorVis) * castGate;",
    "          vec3 shC = vec3(0.60, 0.61, 0.66);",
    // faint mirror: march the object along the floor-reflected ray
    "          vec3 rrd = vec3(rd.x, -rd.y, rd.z);",
    "          vec2 rsp = cy_hit(gp, rrd, cy_R, yLo, yHi);",
    "          float reflA = 0.0; vec3 reflC = vec3(0.0);",
    "          if(rsp.y > rsp.x){",
    "            float rt = max(rsp.x, 0.0);",
    "            for(int ri = 0; ri < 64; ri++){",
    "              vec3 rp = gp + rrd * rt;",
    "              float rdd = mp_map(rp);",
    "              if(rdd < 0.0012){",
    "                vec3 rn = nm_normal(rp);",
    "                float rk = max(dot(rn, Lkey), 0.0);",
    "                reflC = albedo * (0.42 + 0.64 * rk);",
    "                reflA = 1.0;",
    "                break;",
    "              }",
    "              rt += rdd;",
    "              if(rt > rsp.y) break;",
    "            }",
    "          }",
    // grazing floor fresnel: the mirror is stronger at glancing angles, and it
    // fades with distance out from the base
    "          float rFres = 0.10 + 0.62 * pow(1.0 - abs(rd.y), 4.0);",
    "          float rStr = reflA * halo * rFres * (0.42 + 0.30 * floorVis);",
    "          vec3 floorC = vec3(0.82, 0.83, 0.87) * floorA;",
    "          float a = clamp(floorA + shA + rStr, 0.0, 0.78);",
    "          vec3 c = floorC + shC * shA + reflC * rStr;",
    "          if(a > 0.0008) outc = vec4(c, a);",
    "        }",
    "      }",
    "    }",
    "  }",

    // premultiplied alpha straight out; the compositor lays it over the page white
    "  gl_FragColor = outc;",
    "}"
  ].join("\n");

  // ---- compile and link with full fail-safe ----
  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console && console.warn) {
        console.warn("ribbon-field: shader compile failed\n" + gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var raf = 0;
  function fail() {
    canvas.style.display = "none";
    try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fail(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (window.console && console.warn) {
      console.warn("ribbon-field: link failed\n" + gl.getProgramInfoLog(prog));
    }
    fail();
    return;
  }
  gl.useProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uTime = gl.getUniformLocation(prog, "u_time");
  var uIntro = gl.getUniformLocation(prog, "u_intro");
  var uScroll = gl.getUniformLocation(prog, "u_scroll");

  // premultiplied output: clear to fully transparent, no blending needed since the
  // fullscreen triangle writes every pixel.
  gl.clearColor(0, 0, 0, 0);

  // ---- scroll progress through the hero (0..1 over the first viewport) ----
  var scroll = 0, scrollEased = 0;
  function readScroll() {
    // full-page progress (0 at top, 1 at the foot) so the object evolves through
    // perceive -> build -> verify across the whole journey, not just the hero.
    var doc = document.documentElement;
    var max = Math.max(1, (doc.scrollHeight || 0) - window.innerHeight);
    scroll = Math.min(1, Math.max(0, (window.pageYOffset || 0) / max));
  }
  readScroll();
  window.addEventListener("scroll", readScroll, { passive: true });

  // ---- adaptive render scale: start mid, drop if the GPU is slow ----
  var RENDER_SCALE = 0.95;
  var MIN_SCALE = 0.55;
  var MAX_DPR = 1.75;
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
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  function draw(timeSec, introVal) {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeSec);
    gl.uniform1f(uIntro, introVal);
    gl.uniform1f(uScroll, scrollEased);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // reduced motion: one settled frame, fully assembled, no loop.
  if (reduced) {
    draw(8.0, 1.0);
    return;
  }

  // adaptive sampling: watch the first ~40 frames; if mean frame time is high,
  // drop the render scale a step and resize. Cheap and one-shot.
  var start = null;
  var introStart = null;
  var frameAccum = 0, frameCount = 0, tuned = false;
  var last = 0;

  function frame(ts) {
    if (start === null) { start = ts; last = ts; introStart = ts; }
    var dt = ts - last; last = ts;
    var timeSec = (ts - start) / 1000.0;

    // assembly: ease 0..1 over 3.0s on load, a slow cinematic unfurl
    var introT = Math.min(1, (ts - introStart) / 3000.0);
    var intro = introT * introT * (3.0 - 2.0 * introT);

    // ease the scroll toward target for fluid, momentum-feeling motion, the object
    // glides through perceive/build/verify rather than snapping
    scrollEased += (scroll - scrollEased) * 0.085;

    draw(timeSec, intro);

    // one-shot perf tuning over frames 6..40
    if (!tuned && frameCount < 40) {
      if (frameCount > 5) frameAccum += dt;
      frameCount++;
      if (frameCount === 40) {
        var mean = frameAccum / 34.0;
        if (mean > 22.0 && RENDER_SCALE > MIN_SCALE) {
          RENDER_SCALE = Math.max(MIN_SCALE, RENDER_SCALE - 0.18);
          resize();
        }
        tuned = true;
      }
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else if (!raf) {
      start = null;
      raf = requestAnimationFrame(frame);
    }
  }, { passive: true });
})();
