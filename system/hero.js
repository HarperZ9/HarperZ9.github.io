/* system/hero.js — shared hero engine for every page of harperz9.github.io
   Public contract (unchanged):
     - WebGL shader on canvas#gl
     - 2D motes on canvas#motes
     - IntersectionObserver adds .visible to .reveal / .reveal-children
   New in this version:
     - 3-world (ENGRAVING / SPECTRUM / NEGATIVE) melting-grid shader
     - World switcher + HUD injected by JS (no page HTML changes needed)
     - Default world = 2 (NEGATIVE / dark) so existing light-text pages stay readable
     - localStorage ha-world persists the choice across pages
     - prefers-reduced-motion: shader frozen at t=0, all content visible, switcher works
     - DPR capped at 1.5
*/

// =============================================================================
// GLOBAL STATE (top-level vars — shared across all IIFEs below)
// =============================================================================
var HERO_REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// worldTarget  — the integer world the user selected (0/1/2)
// worldCurrent — animated float lerping toward worldTarget (drives u_world uniform)
var worldTarget  = 2.0;
var worldCurrent = 2.0;

// Restore from localStorage; fall back to world-2 (dark / NEGATIVE)
(function () {
  var raw = localStorage.getItem("ha-world");
  if (raw !== null) {
    var saved = parseInt(raw, 10);
    if (saved >= 0 && saved <= 3) {
      worldTarget  = saved;
      worldCurrent = saved; // start fully settled — no flash
    }
  }
  // Apply body class immediately so CSS text adaptation fires on first paint
  heroApplyWorldClass(Math.round(worldCurrent));
}());

function heroApplyWorldClass(idx) {
  document.body.classList.remove("world-0", "world-1", "world-2", "world-3");
  document.body.classList.add("world-" + idx);
}

function heroSyncButtons(idx) {
  var btns = document.querySelectorAll("#world-switcher button");
  for (var si = 0; si < btns.length; si++) {
    btns[si].setAttribute(
      "aria-pressed",
      String(parseInt(btns[si].getAttribute("data-world"), 10) === idx)
    );
  }
}

function heroSwitchWorld(idx) {
  worldTarget = idx;
  localStorage.setItem("ha-world", String(idx));
  heroApplyWorldClass(idx);
  heroSyncButtons(idx);
}

// =============================================================================
// INJECT SWITCHER + HUD INTO <body>
// Runs immediately (not deferred) so elements exist when other IIFEs reference them.
// =============================================================================
(function () {
  // ── Switcher ──────────────────────────────────────────────────────────────
  var sw = document.createElement("div");
  sw.id = "world-switcher";
  sw.setAttribute("role", "group");
  sw.setAttribute("aria-label", "Visual world");

  var worlds = [
    { idx: 0, label: "ENGRAVING" },
    { idx: 1, label: "SPECTRUM"  },
    { idx: 2, label: "NEGATIVE"  },
    { idx: 3, label: "CHROME"    },
  ];
  for (var wi = 0; wi < worlds.length; wi++) {
    var btn = document.createElement("button");
    btn.setAttribute("data-world", String(worlds[wi].idx));
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = worlds[wi].label;
    // Capture idx in closure
    (function (capturedIdx) {
      btn.addEventListener("click", function () { heroSwitchWorld(capturedIdx); });
    }(worlds[wi].idx));
    sw.appendChild(btn);
  }
  document.body.appendChild(sw);
  heroSyncButtons(Math.round(worldCurrent));

  // ── HUD ───────────────────────────────────────────────────────────────────
  var hud = document.createElement("div");
  hud.id = "hud";
  hud.setAttribute("aria-hidden", "true");
  hud.innerHTML =
    '<div id="hud-label">BONE &middot; GRID</div>' +
    '<div id="hud-sha">sha &middot; a3f8c2e1</div>' +
    '<div id="hud-status">VERIFIED</div>';
  document.body.appendChild(hud);

  // ── Oscilloscope canvas ───────────────────────────────────────────────────
  var oscCv = document.createElement("canvas");
  oscCv.id = "osc-canvas";
  oscCv.setAttribute("aria-hidden", "true");
  document.body.appendChild(oscCv);

  // ── Boot overlay ──────────────────────────────────────────────────────────
  var boot = document.createElement("div");
  boot.id = "boot-overlay";
  boot.setAttribute("role", "status");
  boot.setAttribute("aria-label", "Instrument booting");
  boot.setAttribute("aria-live", "polite");
  boot.innerHTML =
    '<div id="boot-iris" aria-hidden="true">' +
      '<div id="boot-corona"></div>' +
      '<svg id="iris-svg" viewBox="-50 -50 100 100" fill="none" aria-hidden="true">' +
        '<circle cx="0" cy="0" r="38" stroke="#1c4442" stroke-width="1.2" opacity="0.9"/>' +
        '<circle cx="0" cy="0" r="26" stroke="#1c4442" stroke-width="0.6" opacity="0.5" stroke-dasharray="4 3"/>' +
        '<g id="iris-blades" opacity="0.92">' +
          '<ellipse id="bl0" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(0)"/>' +
          '<ellipse id="bl1" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(45)"/>' +
          '<ellipse id="bl2" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(90)"/>' +
          '<ellipse id="bl3" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(135)"/>' +
          '<ellipse id="bl4" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(180)"/>' +
          '<ellipse id="bl5" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(225)"/>' +
          '<ellipse id="bl6" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(270)"/>' +
          '<ellipse id="bl7" cx="0" cy="0" rx="0" ry="0" fill="#1c4442" transform="rotate(315)"/>' +
        '</g>' +
        '<circle id="iris-hole" cx="0" cy="0" r="0" fill="#0a0c0b"/>' +
        '<g opacity="0.45" stroke="#1c4442" stroke-width="0.8">' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(0)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(30)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(60)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(90)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(120)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(150)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(180)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(210)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(240)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(270)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(300)"/>' +
          '<line x1="38" y1="0" x2="42" y2="0" transform="rotate(330)"/>' +
        '</g>' +
      '</svg>' +
    '</div>' +
    '<div id="boot-readout">' +
      '<div id="boot-sha">sha256: &hellip;</div>' +
      '<div id="boot-status">SENSING &mdash;</div>' +
    '</div>';
  document.body.appendChild(boot);
}());

// Keyboard 1/2/3 → switch worlds
window.addEventListener("keydown", function (e) {
  if (e.key === "1") heroSwitchWorld(0);
  else if (e.key === "2") heroSwitchWorld(1);
  else if (e.key === "3") heroSwitchWorld(2);
  else if (e.key === "4") heroSwitchWorld(3);
});

// =============================================================================
// KNOBS
// =============================================================================
var HERO_KNOBS = {
  TIME_SCALE:        0.28,
  FLOW_DENSITY:      18.0,
  RD_SCALE:          7.2,
  VORONOI_SCALE:     10.5,
  CONTOUR_FREQ:      34.0,
  LINE_SHARP:        0.20,
  GEO_PHOTO_BALANCE: 0.38,
  GEO_BRIGHT:        2.70,
  HAZE_STRENGTH:     0.60,
  HAZE_MIX:          0.52,
  GODRAY_OPACITY:    0.60,
  EMBER_INTENSITY:   1.20,
  STEEL_BALANCE:     0.52,
  SCANLINE_WEIGHT:   0.55,
  GRAIN_STRENGTH:    0.62,
  VIGNETTE_POWER:    1.90,
  MOUSE_INFLUENCE:   0.42,
  MAX_DPR:           1.5,
  INVERT_STRENGTH:   0.97,
  BONE_WARMTH:       0.050,
  CA_STRENGTH:       0.009,
  CA_STRETCH:        3.0,
  GRID_LENS:         0.20,
  GRID_HARMONIC:     0.13,
  GRID_PERSP:        0.40,
  GRID_OPACITY:      0.55,
};

// =============================================================================
// SHADERS
// =============================================================================
var HERO_VERT = "attribute vec2 a_pos;\nvoid main(){ gl_Position=vec4(a_pos,0.0,1.0); }";

// COMPILE AUDIT (verified before write):
//
// (a) NO variable redeclaration in any single scope.
//     Prefix namespaces: gn_ gnoise, fb_ fbm, f6_ fbm6, vn_ vnoise,
//     v4_ vfbm4, v6_ vfbm6, wf_ warpedFbm, gr_ godRays, ve_ voronoiEdge,
//     me_ miniEye, sp_ spHsv, gd_ grid block, wg_ world-grade block.
//     No prefix is reused across functions.
//
// (b) SWIZZLE SAFETY.
//     .x/.y/.r/.g/.b accessed only on vec2 or vec3 values.
//     wg_w0col, wg_w1col, wg_w2col — vec3. All swizzles valid.
//     sp_h, sp_s, sp_v, sp_hh, sp_i, sp_f, sp_p, sp_q, sp_t, sp_m — float.
//     No swizzle attempted on floats.
//     gd_lensC, gd_lv, gd_uv, gd_fu — vec2. .x/.y valid.
//     All gd_ scalars (gd_ld, gd_lPull, etc.) — float. Never swizzled.
//
// (c) CONSTANT INTEGER LOOP BOUNDS.
//     fb_i<4, f6_i<6, v4_i<4, v6_i<6, gr_gi<18, ve_j<3, ve_i<3,
//     epk loop -2..2 (constant bounds). No new loops added.
//
// (d) WORLD UNIFORM WIRING.
//     heroSwitchWorld() sets worldTarget + heroApplyWorldClass() synchronously.
//     drawFrame() lerps worldCurrent toward worldTarget every frame and calls
//     gl.uniform1f(uHeroWorld, worldCurrent). Verified complete wiring.
//
// (e) CANVAS ID.
//     Shader runs on canvas#gl to match the shared contract every page uses.

var HERO_FRAG = [
"precision highp float;",

"uniform vec2      u_res;",
"uniform float     u_time;",
"uniform sampler2D u_tex0;",
"uniform sampler2D u_tex1;",
"uniform sampler2D u_tex2;",
"uniform vec2      u_texres;",
"uniform vec2      u_mouse;",

"uniform float u_flow_density;",
"uniform float u_rd_scale;",
"uniform float u_voronoi_scale;",
"uniform float u_contour_freq;",
"uniform float u_line_sharp;",
"uniform float u_geo_photo;",
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

"uniform float u_invert_strength;",
"uniform float u_bone_warmth;",
"uniform float u_ca_strength;",
"uniform float u_ca_stretch;",

"uniform float u_grid_lens;",
"uniform float u_grid_harmonic;",
"uniform float u_grid_persp;",
"uniform float u_grid_opacity;",

"uniform float u_world;",

// ── MATH UTILITIES ──────────────────────────────────────────────────────────
"vec2 gh2(vec2 p){",
"  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));",
"  return -1.0+2.0*fract(sin(p)*43758.5453);",
"}",

"float gnoise(vec2 p){",
"  vec2 gn_i=floor(p), gn_f=fract(p);",
"  vec2 gn_u=gn_f*gn_f*(3.0-2.0*gn_f);",
"  return mix(",
"    mix(dot(gh2(gn_i),gn_f), dot(gh2(gn_i+vec2(1.0,0.0)),gn_f-vec2(1.0,0.0)),gn_u.x),",
"    mix(dot(gh2(gn_i+vec2(0.0,1.0)),gn_f-vec2(0.0,1.0)),dot(gh2(gn_i+vec2(1.0,1.0)),gn_f-vec2(1.0,1.0)),gn_u.x),",
"  gn_u.y);",
"}",

"float fbm(vec2 p){",
"  float fb_s=0.0, fb_a=0.55;",
"  mat2 fb_m=mat2(1.6,1.2,-1.2,1.6);",
"  for(int fb_i=0;fb_i<4;fb_i++){fb_s+=fb_a*gnoise(p);p=fb_m*p;fb_a*=0.5;}",
"  return fb_s;",
"}",

"float fbm6(vec2 p){",
"  float f6_s=0.0, f6_a=0.50;",
"  mat2 f6_m=mat2(1.6,1.2,-1.2,1.6);",
"  for(int f6_i=0;f6_i<6;f6_i++){f6_s+=f6_a*gnoise(p);p=f6_m*p;f6_a*=0.50;}",
"  return f6_s;",
"}",

"float vh1(vec2 p){",
"  p=fract(p*vec2(234.7,381.3));",
"  p+=dot(p,p+19.17);",
"  return fract(p.x*p.y)*2.0-1.0;",
"}",

"float vnoise(vec2 p){",
"  vec2 vn_i=floor(p), vn_f=fract(p);",
"  vec2 vn_u=vn_f*vn_f*vn_f*(vn_f*(vn_f*6.0-15.0)+10.0);",
"  return mix(mix(vh1(vn_i),vh1(vn_i+vec2(1.0,0.0)),vn_u.x),",
"             mix(vh1(vn_i+vec2(0.0,1.0)),vh1(vn_i+vec2(1.0,1.0)),vn_u.x),vn_u.y);",
"}",

"mat2 rot2(float a){ float r2_c=cos(a), r2_s=sin(a); return mat2(r2_c,-r2_s,r2_s,r2_c); }",

"float vfbm4(vec2 p){",
"  float v4_v=0.0; float v4_a=0.55;",
"  mat2 v4_rm=rot2(0.6);",
"  for(int v4_i=0;v4_i<4;v4_i++){v4_v+=v4_a*vnoise(p);p=v4_rm*p*1.93;v4_a*=0.48;}",
"  return v4_v;",
"}",

"float vfbm6(vec2 p){",
"  float v6_v=0.0; float v6_a=0.52;",
"  mat2 v6_rm=rot2(0.7);",
"  for(int v6_i=0;v6_i<6;v6_i++){v6_v+=v6_a*vnoise(p);p=v6_rm*p*2.01;v6_a*=0.46;}",
"  return v6_v;",
"}",

"float warpedFbm(vec2 p, float ws){",
"  vec2 wf_qa=vec2(vfbm4(p),vfbm4(p+vec2(4.0,2.2)));",
"  vec2 wf_ra=vec2(vfbm4(p+ws*wf_qa+vec2(1.7,9.2)),vfbm4(p+ws*wf_qa+vec2(8.3,2.8)));",
"  return vfbm4(p+ws*wf_ra);",
"}",

// ── WORLD 3 — LIQUID CHROME (vintage-CGI molten metal; reuses fbm above) ──────
"vec3 lc_env(float y){",
"  float s1=0.5+0.5*sin(y*3.0+0.3);",
"  float s2=0.5+0.5*sin(y*6.7+1.4);",
"  float band=clamp(pow(s1,3.0)+0.42*pow(s2,6.0),0.0,1.25);",   // narrow bright streaks on dark
"  vec3 c=vec3(0.022,0.030,0.044);",
"  c+=band*vec3(0.90,0.93,1.0);",
"  c=mix(c,vec3(0.96,0.55,0.12),smoothstep(0.80,1.18,band)*0.5);",                          // amber in the hot streaks
"  c=mix(c,vec3(0.30,0.64,0.55),smoothstep(0.18,0.34,band)*(1.0-smoothstep(0.34,0.5,band))*0.30);", // teal mids
"  return c;",
"}",
"float lc_surf(vec2 p, float lt){",                              // domain-warped liquid height field
"  vec2 a=vec2(fbm(p+vec2(0.0,lt*0.05)),fbm(p+vec2(5.2,1.3)-lt*0.04));",
"  vec2 b=vec2(fbm(p+2.2*a+vec2(1.7,9.2)),fbm(p+2.2*a+vec2(8.3,2.8)));",
"  return fbm(p+2.6*b);",
"}",
"vec3 liquidChrome(vec2 uv, float lt){",
"  float asp=u_res.x/u_res.y;",
"  vec2 p=vec2(uv.x*asp,uv.y)*1.25;",
"  float e=2.0/u_res.y;",
"  float hX=lc_surf(p+vec2(e,0.0),lt)-lc_surf(p-vec2(e,0.0),lt);",
"  float hY=lc_surf(p+vec2(0.0,e),lt)-lc_surf(p-vec2(0.0,e),lt);",
"  vec3 N=normalize(vec3(-hX,-hY,0.045));",
"  vec3 R=reflect(vec3(0.0,0.0,-1.0),N);",
"  float ry=R.y*1.6+R.x*0.5;",
"  float d=0.05;",
"  vec3 col=vec3(lc_env(ry+d).r,lc_env(ry).g,lc_env(ry-d).b);", // chromatic dispersion = iridescence
"  float fres=pow(1.0-clamp(N.z,0.0,1.0),3.0);",
"  col+=fres*vec3(0.12,0.13,0.18);",
"  float slope=clamp(length(vec2(hX,hY))*55.0,0.0,1.0);",
"  col+=pow(slope,1.3)*vec3(0.85,0.88,0.98)*0.72;",             // bright crests on the folds
"  vec2 vg=uv-0.5; col*=1.0-dot(vg,vg)*0.62;",                  // vignette
"  return clamp(pow(max(col,0.0),vec3(0.92)),0.0,1.0);",
"}",

"float lumA(vec2 uv){ return dot(texture2D(u_tex0,clamp(uv,0.001,0.999)).rgb,vec3(0.30,0.59,0.11)); }",
"float lumB(vec2 uv){ return dot(texture2D(u_tex1,clamp(uv,0.001,0.999)).rgb,vec3(0.30,0.59,0.11)); }",
"float lumC(vec2 uv){ return dot(texture2D(u_tex2,clamp(uv,0.001,0.999)).rgb,vec3(0.30,0.59,0.11)); }",

"float godRays(vec2 uv, vec2 lp, float t){",
"  vec2 gr_delta=(lp-uv)*(1.0/18.0);",
"  float gr_acc=0.0;",
"  vec2 gr_gp=uv;",
"  float gr_decay=1.0;",
"  for(int gr_gi=0;gr_gi<18;gr_gi++){",
"    gr_gp+=gr_delta;",
"    float gr_mask=clamp(vfbm6(gr_gp*2.4+t*0.04)*0.5+0.6,0.0,1.0);",
"    gr_acc+=gr_mask*gr_decay;",
"    gr_decay*=0.88;",
"  }",
"  float gr_distFade=1.0-smoothstep(0.0,1.3,length(uv-lp));",
"  return gr_acc*gr_distFade*(1.0/18.0);",
"}",

"float voronoiEdge(vec2 p){",
"  vec2 ve_ip=floor(p);",
"  vec2 ve_fp=fract(p);",
"  float ve_md=1e9;",
"  float ve_md2=1e9;",
"  for(int ve_j=0;ve_j<3;ve_j++){",
"    for(int ve_i=0;ve_i<3;ve_i++){",
"      vec2 ve_nb=vec2(float(ve_i)-1.0,float(ve_j)-1.0);",
"      vec2 ve_seed=ve_nb+0.5+0.48*sin(ve_ip+ve_nb+vec2(3.71,1.53));",
"      float ve_d=length(ve_fp-ve_seed);",
"      if(ve_d<ve_md){ ve_md2=ve_md; ve_md=ve_d; }",
"      else if(ve_d<ve_md2){ ve_md2=ve_d; }",
"    }",
"  }",
"  return ve_md2-ve_md;",
"}",

"vec3 miniEye(vec3 mc, vec2 mn, vec2 mec, float mR, float mvis, float mt){",
"  float me_s1=fract(sin(dot(mec,vec2(34.7,91.3)))*523.13);",
"  float me_s2=fract(sin(dot(mec,vec2(72.1,11.7)))*317.77);",
"  float me_s3=fract(sin(dot(mec,vec2(19.3,53.9)))*911.31);",
"  float me_s4=fract(sin(dot(mec,vec2(63.7,28.4)))*145.91);",
"  vec2 me_v0=mn-mec;",
"  vec2 me_vn=me_v0/mR;",
"  float me_up=smoothstep(0.0,0.65,me_vn.y);",
"  float me_dcol=fbm(vec2(me_vn.x*mix(3.0,6.0,me_s3)+me_s1*40.0,7.3));",
"  float me_drip=me_up*(0.3+mix(0.6,2.3,me_s4)*me_dcol)*(0.82+0.18*sin(mt*0.6+me_s1*80.0));",
"  me_vn.y-=me_drip; me_vn.x+=me_drip*(me_s2-0.5)*0.5;",
"  vec2 me_ev=me_vn*mR; float me_re=length(me_ev);",
"  float me_disk=smoothstep(mR*1.04,mR*0.9,me_re)*mvis;",
"  if(me_disk<0.002) return mc;",
"  float me_ir=clamp(me_re/mR,0.0,1.0);",
"  vec3 me_minCol=mix(vec3(0.99,0.52,0.22),vec3(0.74,0.13,0.16),smoothstep(0.18,0.4,me_s1));",
"  me_minCol=mix(me_minCol,vec3(0.16,0.45,0.42),smoothstep(0.52,0.7,me_s1));",
"  me_minCol=mix(me_minCol,vec3(0.42,0.16,0.45),smoothstep(0.74,0.88,me_s1));",
"  me_minCol=mix(me_minCol,vec3(0.86,0.74,0.50),smoothstep(0.92,1.0,me_s1));",
"  vec3 me_iris=mix(me_minCol,me_minCol*mix(0.26,0.46,me_s4),smoothstep(0.0,1.0,me_ir));",
"  me_iris*=0.68+0.62*fbm(vec2(atan(me_ev.y,me_ev.x)*mix(9.0,26.0,me_s2),me_re*mix(20.0,42.0,me_s3)));",
"  vec3 me_eye=me_iris;",
"  float me_pR=mR*mix(0.24,0.46,me_s2);",
"  vec2 me_wander=vec2(sin(mt*mix(0.16,0.40,me_s1)+me_s2*6.28)+0.6*sin(mt*mix(0.07,0.20,me_s3)+me_s4*6.28),",
"                      cos(mt*mix(0.14,0.36,me_s4)+me_s1*6.28)+0.6*cos(mt*mix(0.06,0.18,me_s2)+me_s3*6.28))*mR*0.40;",
"  vec2 me_gaze=clamp(me_wander+(u_mouse-mec)*mix(0.07,0.26,me_s3),vec2(-0.5*mR),vec2(0.5*mR));",
"  float me_pm=length((me_ev-me_gaze)*vec2(mix(1.0,2.7,step(0.72,me_s3)),1.0));",
"  me_eye=mix(me_eye,vec3(0.02,0.01,0.02),smoothstep(me_pR,me_pR*0.78,me_pm));",
"  vec2 me_clo=vec2(mix(-0.3,0.12,me_s2),mix(0.18,0.34,me_s1))*mR;",
"  me_eye+=vec3(1.0,0.92,0.8)*exp(-pow(length(me_v0-me_clo)/(mR*mix(0.13,0.26,me_s4)),2.0))*mix(0.45,0.95,me_s3);",
"  float me_period=2.0+2.8*me_s1;",
"  float me_ph=fract(mt/me_period+me_s2);",
"  float me_lidc=smoothstep(0.0,0.04,me_ph)*(1.0-smoothstep(0.05,0.10+0.05*me_s3,me_ph));",
"  float me_lidEdge=mix(mR*1.3,-mR*1.3,me_lidc);",
"  float me_covered=smoothstep(me_lidEdge-0.003,me_lidEdge+0.003,me_v0.y);",
"  vec3 me_lidCol=mix(vec3(0.55,0.13,0.10),me_minCol*0.6,clamp(0.5+0.6*me_v0.y/mR,0.0,1.0));",
"  me_lidCol*=0.82+0.22*fbm(me_v0*44.0);",
"  float me_crease=exp(-pow((me_v0.y-me_lidEdge)/(mR*0.10),2.0));",
"  me_eye=mix(me_eye,me_lidCol,me_covered);",
"  me_eye*=1.0-me_crease*me_covered*0.5;",
"  mc=mix(mc,me_eye,me_disk);",
"  return mc;",
"}",

// ── SPECTRUM HSV→RGB (branchless) ────────────────────────────────────────────
"vec3 spHsv(float sp_h, float sp_s, float sp_v){",
"  float sp_hh = sp_h * 6.0;",
"  float sp_i  = floor(sp_hh);",
"  float sp_f  = sp_hh - sp_i;",
"  float sp_p  = sp_v * (1.0 - sp_s);",
"  float sp_q  = sp_v * (1.0 - sp_s * sp_f);",
"  float sp_t  = sp_v * (1.0 - sp_s * (1.0 - sp_f));",
"  float sp_m  = mod(sp_i, 6.0);",
"  vec3 sp_rgb = vec3(0.0);",
"  if(sp_m < 1.0)       sp_rgb = vec3(sp_v, sp_t, sp_p);",
"  else if(sp_m < 2.0)  sp_rgb = vec3(sp_q, sp_v, sp_p);",
"  else if(sp_m < 3.0)  sp_rgb = vec3(sp_p, sp_v, sp_t);",
"  else if(sp_m < 4.0)  sp_rgb = vec3(sp_p, sp_q, sp_v);",
"  else if(sp_m < 5.0)  sp_rgb = vec3(sp_t, sp_p, sp_v);",
"  else                  sp_rgb = vec3(sp_v, sp_p, sp_q);",
"  return sp_rgb;",
"}",

// ==========================================================================
// MAIN
// ==========================================================================
"void main(){",
"  vec2 frag = gl_FragCoord.xy;",
"  vec2 uvn  = (frag - 0.5*u_res) / u_res.y;",
"  float t   = u_time;",

// ── Datamosh glitch ──
"  float dmGb   = floor(uvn.y * 52.0);",
"  float dmTrig = step(0.972, fract(sin(dmGb*21.7 + floor(t*3.0)*5.3)*731.0));",
"  uvn.x += dmTrig * (fract(sin(dmGb*91.3 + floor(t*3.0))*413.0) - 0.5) * 0.032;",

// ── LAYER 1 — BASE DUSK DREAMSCAPE ──
"  float lhz = -0.20;",
"  float lfog = fbm(vec2(uvn.x*1.4 - t*0.010, uvn.y*2.0 + t*0.006));",
"  vec3 lTop = vec3(0.038, 0.082, 0.088);",
"  vec3 lSky = vec3(0.082, 0.150, 0.158);",
"  vec3 lHor = vec3(0.900, 0.380, 0.022);",
"  vec3 lGnd = vec3(0.022, 0.055, 0.060);",
"  vec3 lSkyCol = mix(lSky, lTop, smoothstep(0.05, 0.8, uvn.y));",
"  lSkyCol = mix(lHor, lSkyCol, smoothstep(lhz, 0.20, uvn.y));",
"  vec3 col = mix(lGnd, lSkyCol, smoothstep(lhz-0.06, lhz+0.06, uvn.y));",
"  vec2 sunPos = vec2(0.30, lhz+0.02);",
"  col += vec3(0.950, 0.560, 0.10) * exp(-pow(length((uvn-sunPos)*vec2(0.6,1.6))/0.38, 2.0)) * 0.55;",
"  col += (lfog - 0.5) * 0.03 * vec3(1.0, 0.82, 0.5);",
"  col  = mix(col, col*1.18+vec3(0.16,0.10,0.02), exp(-pow((uvn.y-lhz)/0.05,2.0))*0.4);",
"  col += vec3(0.97, 0.64, 0.22) * exp(-pow((uvn.y-lhz)/0.006, 2.0)) * 0.55;",

// ── LAYER 2 — BIOMECHANICAL GEOMETRY ──
"  vec2 gsc    = vec2(0.38, 0.04);",
"  float gscale = 0.85;",
"  vec2 tUV0 = (uvn - gsc) / gscale + 0.5;",
"  vec2 tUV1 = (uvn - vec2(0.28, 0.09)) / 0.95 + 0.5;",
"  vec2 tUV2 = (uvn - vec2(0.48, -0.06)) / 0.75 + 0.5;",
"  float pA = lumA(tUV0);",
"  float pB = lumB(tUV1);",
"  float pC = lumC(tUV2);",

// 2a. Flow-field streamlines
"  vec2 ff0 = uvn * u_flow_density + vec2(t*0.07, -t*0.04);",
"  float ffA = fbm(ff0*0.41 + vec2(1.7, 3.1));",
"  float ffB = fbm(ff0*0.41 + vec2(9.2, 6.4));",
"  vec2 ff1 = ff0 + vec2(ffA, ffB) * 2.2;",
"  float ffC = fbm(ff1*0.68 + vec2(t*0.03, 0.5)) * (0.5 + 0.9*pA);",
"  float ffD = fbm(ff1*0.68 + vec2(2.3, t*0.02+1.1)) * (0.5 + 0.9*pA);",
"  vec2 ff2 = ff1 + vec2(ffC, ffD) * 1.5;",
"  float ffE = gnoise(ff2*1.6 + vec2(t*0.06, 4.7)) * 0.55;",
"  float ffF = gnoise(ff2*1.6 + vec2(7.3, t*0.05)) * 0.55;",
"  vec2 ff3 = ff2 + vec2(ffE, ffF) * 0.9;",
"  float ffVal  = fbm6(ff3);",
"  float ffN    = ffVal * 0.5 + 0.5;",
"  float ffBand = fract(ffN * 20.0);",
"  float flowLine = smoothstep(u_line_sharp*0.055, 0.0, ffBand) * 0.5 +",
"                   smoothstep(u_line_sharp*0.055, 0.0, 1.0-ffBand) * 0.5;",
"  float flowDens = smoothstep(0.02, 0.35, pA) * 0.45 + 0.55;",
"  flowLine *= flowDens;",

// 2b. Reaction-diffusion
"  vec2 rdP  = uvn * u_rd_scale + vec2(t*0.014, -t*0.008);",
"  vec2 rdSd = vec2(pB*0.6, (1.0-pB)*0.4);",
"  vec2 rdPS = rdP + rdSd * 2.5;",
"  float rdFine   = fbm6(rdPS*2.1 + vec2(3.0, 1.4));",
"  float rdCoarse = fbm(rdPS*0.9 + vec2(7.2, 0.8));",
"  float rdSig = rdFine - rdCoarse * 0.7;",
"  float rdB0 = smoothstep(-0.02, 0.0, rdSig) - smoothstep(0.0, 0.04, rdSig);",
"  float rdB1 = smoothstep(0.18, 0.20, rdSig) - smoothstep(0.20, 0.24, rdSig);",
"  float rdB2 = smoothstep(0.38, 0.40, rdSig) - smoothstep(0.40, 0.44, rdSig);",
"  float rdLine = (rdB0 + rdB1*0.80 + rdB2*0.60);",
"  rdLine *= smoothstep(0.03, 0.45, pB) * 0.45 + 0.55;",

// 2c. Voronoi chitin walls
"  vec2 vp1 = uvn * u_voronoi_scale + vec2(t*0.018, -t*0.011);",
"  vp1 += vec2(pA*1.1, (1.0-pA)*0.7);",
"  float vE1 = voronoiEdge(vp1);",
"  vec2 vp2 = uvn * u_voronoi_scale * 2.2 + vec2(-t*0.014, t*0.009) + vec2(pA*0.8, pB*0.6);",
"  float vE2 = voronoiEdge(vp2);",
"  float vW1 = smoothstep(0.12*u_line_sharp, 0.0, vE1);",
"  float vW2 = smoothstep(0.08*u_line_sharp, 0.0, vE2) * 0.60;",
"  float vLine = vW1 + vW2;",
"  float vGrow = smoothstep(0.55, 0.88, pC) * smoothstep(0.40, 0.80, vE2);",
"  vLine = vLine + vGrow * 0.45;",

// 2d. Contour topographies
"  vec2 cp  = uvn * 5.8 + vec2(t*0.009, t*0.013);",
"  float cpW = fbm(cp*0.7 + vec2(pA*2.0, 0.9));",
"  cp += vec2(cpW, fbm(cp*0.7 + vec2(4.2, pB*1.8))) * 1.2;",
"  float ctField = fbm6(cp);",
"  float ctFreq  = u_contour_freq * (0.45 + 1.1*pA);",
"  float ctN     = fract((ctField*0.5+0.5) * ctFreq * (1.0/12.0) * 12.0);",
"  float ctLine  = smoothstep(u_line_sharp*0.035, 0.0, ctN) +",
"                  smoothstep(u_line_sharp*0.035, 0.0, 1.0-ctN);",
"  ctLine *= smoothstep(0.03, 0.32, pA + pB*0.5) * 0.50 + 0.50;",

// ── LAYER 2e — WARPED WIREFRAME GRID (MELTED) ──
"  vec2 gd_uv = uvn;",

// STEP 1: PERSPECTIVE RECESSION
"  float gd_vzY   = -0.38;",
"  float gd_relY  = gd_uv.y - gd_vzY;",
"  float gd_pDen  = 1.0 - u_grid_persp * clamp(gd_relY * 0.85, -0.9, 0.9);",
"  float gd_pScale = 1.0 / max(gd_pDen, 0.08);",
"  gd_uv.y = gd_vzY + gd_relY * gd_pScale;",
"  gd_uv.x = gd_uv.x * mix(1.0, gd_pScale, 0.62);",

// STEP 2: GRAVITATIONAL LENS
"  vec2 gd_lensC = gsc + vec2(-0.015, 0.005);",
"  vec2 gd_lv    = gd_lensC - gd_uv;",
"  float gd_ld   = length(gd_lv);",
"  float gd_lPull = u_grid_lens / max(gd_ld + 0.06, 0.06);",
"  gd_lPull = clamp(gd_lPull, 0.0, 0.68);",
"  gd_uv += normalize(gd_lv + vec2(0.0001)) * gd_lPull;",

// STEP 3: HARMONIC / SPIROGRAPH FLOW + TIME-DRIFTING PHASE
"  float gd_phase = t * 0.09;",
"  float gd_hx = sin(gd_uv.y * 5.8 + t * 0.31 + gd_uv.x * 1.7 + gd_phase) * u_grid_harmonic",
"              + sin(gd_uv.y * 3.1 + t * 0.17 + gd_uv.x * 0.9 + gd_phase * 1.61) * u_grid_harmonic * 0.45;",
"  float gd_hy = sin(gd_uv.x * 4.6 + t * 0.23 + gd_uv.y * 1.4 + gd_phase + 1.047) * u_grid_harmonic",
"              + sin(gd_uv.x * 2.4 + t * 0.14 + gd_uv.y * 0.7 + gd_phase * 0.77 + 2.094) * u_grid_harmonic * 0.45;",
"  gd_uv.x += gd_hx;",
"  gd_uv.y += gd_hy;",

// STEP 4: DRAW GRID
"  vec2 gd_fu = fract(gd_uv * 9.0);",
"  float gd_lineU = smoothstep(0.038, 0.0, gd_fu.x) + smoothstep(0.038, 0.0, 1.0 - gd_fu.x);",
"  float gd_lineV = smoothstep(0.038, 0.0, gd_fu.y) + smoothstep(0.038, 0.0, 1.0 - gd_fu.y);",
"  float gd_gridLine = clamp(gd_lineU + gd_lineV, 0.0, 1.0);",
"  float gd_vigFade = clamp(1.0 - dot(uvn, uvn) * 1.1, 0.0, 1.0);",
"  col += vec3(0.68, 0.62, 0.55) * gd_gridLine * u_grid_opacity * gd_vigFade;",

// ── Compose geometry ──
"  vec3 cOrange = vec3(0.900, 0.380, 0.000);",
"  vec3 cAmber  = vec3(0.960, 0.690, 0.200);",
"  vec3 cTeal   = vec3(0.280, 0.680, 0.600);",
"  vec3 cVoid   = vec3(0.038, 0.082, 0.088);",
"  vec3 cOxide  = vec3(0.070, 0.130, 0.140);",
"  vec3 cWhite  = vec3(1.0, 0.95, 0.88);",

"  vec3 geoCol = col;",
"  geoCol += cAmber  * flowLine * u_geo_bright * 0.88;",
"  geoCol += cOrange * flowLine * flowLine * u_geo_bright * 0.66;",
"  geoCol += cWhite  * flowLine * flowLine * flowLine * u_geo_bright * 0.28;",
"  geoCol += cTeal   * rdLine * u_geo_bright * 0.75;",
"  geoCol += cAmber  * rdLine * rdLine * u_geo_bright * 0.38;",
"  geoCol += cOrange * vW1 * u_geo_bright * 0.72;",
"  geoCol += cAmber  * vW1 * vW1 * u_geo_bright * 0.40;",
"  geoCol += cTeal   * vW2 * u_geo_bright * 0.45;",
"  geoCol += cAmber  * vGrow * u_geo_bright * 0.32;",
"  geoCol += cAmber  * ctLine * u_geo_bright * 0.52;",
"  geoCol += cOrange * ctLine * u_geo_bright * 0.28;",

"  float geoAlpha = clamp(flowLine*0.80 + rdLine*0.68 + vLine*0.62 + ctLine*0.48, 0.0, 1.0);",
"  geoAlpha *= (1.0 - u_geo_photo * 0.24);",
"  col = mix(col, geoCol, geoAlpha * 0.95);",

// ── LAYER 3 — GUILLOCHÉ SEAL ──
"  vec2 gsPos = uvn - vec2(0.17, 0.33);",
"  float gsR = length(gsPos);",
"  float gsA = atan(gsPos.y, gsPos.x);",
"  float gsRing = smoothstep(0.155, 0.14, gsR) * smoothstep(0.02, 0.05, gsR);",
"  float gsL1   = abs(sin(gsR*150.0 + 6.0*sin(gsA*6.0) + 2.6*sin(gsA*17.0)));",
"  float gsL2   = abs(sin(gsR*150.0 + 6.0*sin(gsA*6.0+1.5) + 2.6*sin(gsA*17.0+0.8)+1.6));",
"  float gsGuil = (smoothstep(0.88, 1.0, gsL1) + smoothstep(0.88, 1.0, gsL2)) * gsRing;",
"  col += cAmber * gsGuil * 0.22;",

// ── LAYER 4 — INDUSTRIAL HAZE ──
"  vec2 mShift = u_mouse * u_mouse_influence * 0.18;",
"  vec2 hzPos  = uvn * 2.8 - mShift + vec2(t*0.055, t*0.022);",
"  float hzVal = warpedFbm(hzPos, u_haze_strength);",
"  float haze  = hzVal * 0.5 + 0.5;",
"  vec2 hzPos2 = uvn * 4.6 + vec2(-t*0.038, t*0.028) - mShift*0.5;",
"  float hzDet = vfbm4(hzPos2) * 0.5 + 0.5;",
"  vec3 cMetal = vec3(0.215, 0.230, 0.224);",
"  vec3 cRust  = vec3(0.162, 0.072, 0.018);",
"  vec3 hazeCol = cVoid;",
"  hazeCol = mix(hazeCol, cOxide, smoothstep(0.08, 0.42, haze));",
"  hazeCol = mix(hazeCol, cMetal, smoothstep(0.40, 0.70, haze) * u_steel_balance * 0.38);",
"  hazeCol = mix(hazeCol, hazeCol*1.07+vec3(0.008,0.006,0.004), smoothstep(0.55,0.80,hzDet)*0.20);",
"  vec2 heatA = vec2(0.385, 0.056) + vec2(0.03*sin(t*0.11), -0.02*cos(t*0.09));",
"  float hdA  = length(uvn - heatA);",
"  vec2 heatB = vec2(0.54+0.025*cos(t*0.07), 0.24+0.018*sin(t*0.13));",
"  float hdB  = length(uvn - heatB);",
"  float glwA = exp(-hdA*hdA*8.0)  * smoothstep(0.20, 0.65, haze);",
"  float glwB = exp(-hdB*hdB*15.0) * smoothstep(0.30, 0.72, hzDet) * 0.55;",
"  float rstA = exp(-hdA*hdA*2.8)  * smoothstep(0.60, 0.18, haze) * 0.72;",
"  hazeCol += cRust   * rstA   * u_ember_intensity;",
"  hazeCol += cOrange * glwA   * 0.55 * u_ember_intensity;",
"  hazeCol += cAmber  * glwA*glwA * 0.28 * u_ember_intensity;",
"  hazeCol += cOrange * glwB   * 0.28 * u_ember_intensity;",
"  float hzKrnlA = exp(-hdA*hdA*160.0);",
"  hazeCol += cAmber * hzKrnlA * 2.0 * u_ember_intensity;",
"  float hzVertW = smoothstep(0.60, -0.50, uvn.y) * 0.55 + 0.45;",
"  col = mix(col, hazeCol, u_haze_mix * hzVertW);",

// ── LAYER 5 — ORGANISM / MACRO TISSUE ──
"  float tAspect = u_texres.x / u_texres.y;",
"  vec2 tDelta   = uvn - gsc;",
"  vec2 tUV      = vec2(tDelta.x/tAspect, tDelta.y)/gscale + 0.5;",
"  float tSeed   = lumB(tUV1)*0.6 + 0.4;",
"  tUV += 0.010*vec2(fbm(tUV*2.6+t*0.025+tSeed), fbm(tUV*2.6+6.0+tSeed));",
"  float tL = lumA(clamp(tUV, 0.0, 1.0));",
"  vec3 tissue = mix(vec3(0.032,0.066,0.070), vec3(0.280,0.420,0.390), smoothstep(0.10,0.5,tL));",
"  tissue = mix(tissue, vec3(0.950,0.520,0.068), smoothstep(0.58,0.92,tL));",
"  float tTint2 = lumC(tUV2);",
"  tissue = mix(tissue, tissue*vec3(1.05,0.92,0.70)+cAmber*0.05, tTint2*0.22);",
"  vec3 tGPV = vec3(tUV*10.0, tL*5.0+t*0.05);",
"  float tGyr = sin(tGPV.x)*cos(tGPV.y) + sin(tGPV.y)*cos(tGPV.z) + sin(tGPV.z)*cos(tGPV.x);",
"  float tMemb = smoothstep(0.12, 0.0, abs(tGyr));",
"  tissue = mix(tissue, tissue*0.5+vec3(0.950,0.640,0.180), tMemb*0.55);",
"  float tEe = 0.0018;",
"  float tGx = lumA(clamp(tUV+vec2(tEe,0.0),0.0,1.0)) - lumA(clamp(tUV-vec2(tEe,0.0),0.0,1.0));",
"  float tGy = lumA(clamp(tUV+vec2(0.0,tEe),0.0,1.0)) - lumA(clamp(tUV-vec2(0.0,tEe),0.0,1.0));",
"  float tEdge = clamp(length(vec2(tGx,tGy))*10.0, 0.0, 1.0);",
"  float tBnd = smoothstep(0.0,0.06,tUV.x)*smoothstep(1.0,0.94,tUV.x)*smoothstep(0.0,0.06,tUV.y)*smoothstep(1.0,0.94,tUV.y);",
"  float tDD  = length(tDelta * vec2(0.84, 1.0));",
"  float tForm = smoothstep(0.55, 0.16, tDD) * tBnd * smoothstep(0.08, 0.48, tL);",
"  float tOp  = 0.92 * mix(1.0, 0.45, u_geo_photo * 0.55);",
"  col = mix(col, tissue, tForm * tOp);",
"  col += vec3(0.95, 0.58, 0.14) * tEdge * tForm * 0.42;",

// ── LAYER 6 — THE WEEPING EYE ──
"  vec2 eyeC = gsc + vec2(-0.015, 0.005);",
"  vec2 eyeV = uvn - eyeC;",
"  eyeV = floor(eyeV/0.0052)*0.0052 + 0.0026;",
"  float eAW = 0.115, eAH = 0.052;",
"  float eLidU = eyeV.y - eAH*(1.0 - pow(clamp(eyeV.x/eAW,-1.0,1.0),2.0));",
"  float eLidL = -eyeV.y - eAH*0.78*(1.0-pow(clamp(eyeV.x/eAW,-1.0,1.0),2.0));",
"  float eOpen = smoothstep(0.004,-0.004,eLidU)*smoothstep(0.004,-0.004,eLidL);",
"  float eRad  = length(eyeV*vec2(0.82,1.0));",
"  float eRir  = 0.066, eRp = 0.026;",
"  float eIr   = clamp(eRad/eRir, 0.0, 1.0);",
"  float eGA   = 2.39996323; float eC0 = 0.0112;",
"  float ePidx = (eRad/eC0)*(eRad/eC0); float eDseed = 1e9;",
"  for(int epk=-2;epk<=2;epk++){",
"    float ePn=floor(ePidx)+float(epk); if(ePn<1.0) continue;",
"    float ePrr=eC0*sqrt(ePn); float ePth=ePn*eGA;",
"    eDseed=min(eDseed,length(eyeV-ePrr*vec2(cos(ePth),sin(ePth))));",
"  }",
"  float eSeedDot  = smoothstep(eC0*0.48, eC0*0.20, eDseed);",
"  float eSeedWall = smoothstep(eC0*0.50, eC0*0.40, eDseed);",
"  vec3 eIrisBase = mix(vec3(0.52,0.28,0.04), vec3(0.10,0.07,0.02), smoothstep(0.25,1.0,eIr));",
"  vec3 eKernel   = mix(vec3(0.950,0.690,0.200), vec3(0.900,0.38,0.02), eIr);",
"  vec3 eIrisC    = mix(eIrisBase*0.55, eKernel, eSeedDot);",
"  eIrisC *= 0.72 + 0.28*eSeedWall;",
"  eIrisC *= 1.0 - exp(-pow((eRad-eRir)/0.008,2.0))*0.6;",
"  float eIrisDisk = smoothstep(eRir+0.005, eRir-0.005, eRad);",
"  vec3 eSclera = vec3(0.32,0.38,0.35)*(0.84+0.16*fbm(eyeV*24.0));",
"  eSclera *= 0.68+0.32*smoothstep(eAH*0.9,-eAH*0.2,eyeV.y);",
"  col = mix(col, eSclera,  eOpen*(1.0-eIrisDisk)*0.72);",
"  col = mix(col, eIrisC,   eOpen*eIrisDisk*0.97);",
"  col = mix(col, vec3(0.01,0.007,0.01), eOpen*smoothstep(eRp,eRp-0.010,eRad));",
"  col += vec3(0.90,0.64,0.34)*smoothstep(0.004,0.0,abs(eLidL))*eOpen*0.28;",
"  col *= 1.0-(smoothstep(0.010,0.0,abs(eLidU))+smoothstep(0.012,0.0,abs(eLidL)))*0.4;",
"  float eTX  = eyeV.x + 0.012;",
"  float eTrl = smoothstep(0.0075,0.0,abs(eTX))*smoothstep(-0.005,-0.03,eyeV.y)*smoothstep(-0.40,-0.06,eyeV.y);",
"  float eBead = exp(-pow(length(eyeV-vec2(-0.012,-0.355))/0.018,2.0));",
"  float eTear = clamp(eTrl*0.9+eBead,0.0,1.0);",
"  col = mix(col, vec3(0.04,0.075,0.078), eTear*0.7);",
"  col += vec3(0.88,0.65,0.34)*smoothstep(0.003,0.0,abs(eTX-0.004))*eTrl*0.42;",
"  col += vec3(0.92,0.68,0.32)*eBead*0.48;",
"  col += vec3(0.95,0.80,0.48)*exp(-pow(length(eyeV-vec2(-0.02,0.018))/0.009,2.0))*0.65*eOpen;",

// ── LAYER 7 — GOD-RAYS ──
"  float eyeRays = godRays(uvn, eyeC, t);",
"  float sunRays = godRays(uvn, sunPos, t) * 0.60;",
"  col += mix(cOrange, cAmber, 0.45) * eyeRays * (0.45+0.55*eOpen) * u_godray_opacity;",
"  col += mix(cOrange, vec3(0.97,0.57,0.12), 0.3) * sunRays * u_godray_opacity * 0.75;",

// ── LAYER 8 — MINI-EYES ──
"  col = miniEye(col, uvn, vec2(0.28, 0.18), 0.038, 0.55, t);",
"  col = miniEye(col, uvn, vec2(0.55, 0.08), 0.028, 0.42, t);",
"  col = miniEye(col, uvn, vec2(0.19, 0.01), 0.022, 0.34, t);",

// ── LAYER 9 — VINTAGE CRT ──
"  col = mix(col, vec3(dot(col,vec3(0.34,0.42,0.24))), 0.08);",
"  col += vec3(0.05,0.035,0.04)*lfog*0.4;",

// Vignette BEFORE world grade
"  float vigR = length(uvn);",
"  float vig  = pow(1.0-clamp(vigR*0.78,0.0,1.0), u_vignette_power);",
"  col *= mix(0.44, 1.0, vig);",
"  col *= 1.0 - dot(uvn,uvn)*0.03;",

"  float scanFreq = 1.7 + u_scanline_weight*1.8;",
"  float scan = 0.5 + 0.5*sin(frag.y*scanFreq);",
"  col *= 1.0 - u_scanline_weight*0.14*(1.0-scan);",

"  float phpx = mod(frag.x, 3.0);",
"  col *= vec3(phpx<1.0?1.07:0.96, (phpx>=1.0&&phpx<2.0)?1.07:0.96, phpx>=2.0?1.07:0.96);",
"  col  = floor(col*32.0+0.5)/32.0;",
"  float grnSeed = dot(frag,vec2(12.9898,78.2330)) + t;",
"  float grn     = fract(sin(grnSeed)*43758.5453) - 0.5;",
"  col += grn * u_grain_strength * 0.024;",
"  col  = col*0.93 + vec3(0.006,0.008,0.008);",
"  col  = pow(max(col,0.0), vec3(0.95));",

// ── LAYER 10 — WORLD GRADE ──
"  float wg_wt01 = clamp(u_world, 0.0, 1.0);",
"  float wg_wt12 = clamp(u_world - 1.0, 0.0, 1.0);",

// WORLD 0 — ENGRAVING
"  float wg_bLum = dot(col, vec3(0.299,0.587,0.114));",
"  vec3 wg_monoCol = mix(col, vec3(wg_bLum), 0.90);",
"  vec3 wg_inverted = 1.0 - wg_monoCol;",
"  wg_inverted += vec3(u_bone_warmth*1.2, u_bone_warmth*0.8, -u_bone_warmth*0.4);",
"  wg_inverted = clamp(wg_inverted, 0.0, 1.0);",
"  vec3 wg_w0col = mix(wg_monoCol, wg_inverted, u_invert_strength);",
"  float wg_inkLum = dot(wg_w0col, vec3(0.299,0.587,0.114));",
"  wg_w0col = mix(wg_w0col, vec3(wg_inkLum), 0.86);",

// WORLD 1 — SPECTRUM
"  float wg_preLum = dot(col, vec3(0.299, 0.587, 0.114));",
"  float wg_specHue = fract(wg_preLum * 0.50 + pA * 0.30 + uvn.x * 0.12 + uvn.y * 0.08 + t * 0.018);",
"  float wg_specVal = clamp(wg_preLum * 2.4 + 0.15, 0.0, 1.0);",
"  vec3 wg_specRgb = spHsv(wg_specHue, 0.92, wg_specVal);",
"  float wg_gridHue = fract(wg_specHue + gd_gridLine * 0.18 + 0.35);",
"  vec3 wg_gridSpec = spHsv(wg_gridHue, 0.95, clamp(gd_gridLine * 1.6, 0.0, 1.0));",
"  wg_specRgb = mix(wg_specRgb, wg_gridSpec, gd_gridLine * 0.55);",
"  vec3 wg_w1col = mix(col * 0.18, wg_specRgb, 0.88);",
"  wg_w1col = clamp(wg_w1col * 1.22 + 0.04, 0.0, 1.0);",

// WORLD 2 — NEGATIVE
"  float wg_w2Lum = dot(wg_w0col, vec3(0.299, 0.587, 0.114));",
"  vec3 wg_w2inv = 1.0 - wg_w0col;",
"  wg_w2inv = mix(wg_w2inv, wg_w0col, smoothstep(0.55, 0.85, wg_w2Lum));",
"  wg_w2inv += vec3(0.0, 0.06, 0.07) * clamp(1.0 - wg_w2Lum * 3.5, 0.0, 1.0);",
"  wg_w2inv = mix(wg_w2inv, vec3(0.0), smoothstep(0.12, 0.0, 1.0 - wg_w2Lum) * 0.60);",
"  vec3 wg_w2col = clamp(wg_w2inv, 0.0, 1.0);",

// CROSSFADE W0 → W1 → W2
"  vec3 wg_outCol = mix(wg_w0col, wg_w1col, wg_wt01);",
"  wg_outCol = mix(wg_outCol, wg_w2col, wg_wt12);",
"  col = wg_outCol;",

// ── LAYER 11 — ANAMORPHIC CHROMATIC ABERRATION (W0 only) ──
"  float caGate = 1.0 - smoothstep(0.0, 0.8, u_world);",
"  float tAspCA  = u_res.x / u_res.y;",
"  float caRad   = length(uvn * vec2(tAspCA, 1.0));",
"  float caW     = caRad * caRad;",
"  vec2 caDir    = normalize(uvn + vec2(0.0001));",
"  vec2 rOff     = caDir * vec2(u_ca_stretch, 1.0) * u_ca_strength * caW;",
"  vec2 bOff     = -caDir * vec2(u_ca_stretch, 1.0) * u_ca_strength * caW;",
"  vec2 dR       = uvn + rOff - gsc;",
"  vec2 tuvR     = vec2(dR.x/tAspCA, dR.y)/gscale + 0.5;",
"  tuvR         += 0.010*vec2(fbm(tuvR*2.6+t*0.025), fbm(tuvR*2.6+6.0));",
"  float LR      = lumA(clamp(tuvR, 0.0, 1.0));",
"  vec2 dOB      = uvn + bOff - gsc;",
"  vec2 tuvB     = vec2(dOB.x/tAspCA, dOB.y)/gscale + 0.5;",
"  tuvB         += 0.010*vec2(fbm(tuvB*2.6+t*0.025), fbm(tuvB*2.6+6.0));",
"  float LB      = lumA(clamp(tuvB, 0.0, 1.0));",
"  float invR = 1.0 - LR + u_bone_warmth * 1.2;",
"  float invB = 1.0 - LB - u_bone_warmth * 0.4;",
"  col.r = mix(col.r, clamp(invR,0.0,1.0), caW * u_invert_strength * 0.68 * caGate);",
"  col.b = mix(col.b, clamp(invB,0.0,1.0), caW * u_invert_strength * 0.68 * caGate);",
"  float baseLum = dot(col, vec3(0.299, 0.587, 0.114));",
"  col.r += caW * u_ca_strength * 3.5 * (invR - baseLum) * caGate;",
"  col.b -= caW * u_ca_strength * 3.0  * (invB - baseLum) * caGate;",

"  col = clamp(col, 0.0, 1.0);",
// WORLD 3 — blend in liquid chrome at the final stage (gated; worlds 0-2 skip it entirely)
"  if (u_world > 2.001) { col = mix(col, liquidChrome(frag/u_res, t), clamp(u_world-2.0,0.0,1.0)); }",
"  gl_FragColor = vec4(col, 1.0);",
"}"
].join("\n");

// =============================================================================
// COMPILE HELPERS
// =============================================================================
function heroCompileShader(gl, type, src) {
  var sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[hero.js] Shader compile error:", gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}
function heroLinkProgram(gl, vsh, fsh) {
  var prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[hero.js] Link error:", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

// =============================================================================
// BOOT SEQUENCE
// =============================================================================
(function () {
  var overlay  = document.getElementById("boot-overlay");
  var blades   = [0,1,2,3,4,5,6,7].map(function (bIdx) { return document.getElementById("bl"+bIdx); });
  var hole     = document.getElementById("iris-hole");
  var corona   = document.getElementById("boot-corona");
  var shaEl    = document.getElementById("boot-sha");
  var statusEl = document.getElementById("boot-status");
  var hudEl    = document.getElementById("hud");
  var oscEl    = document.getElementById("osc-canvas");

  var HEX_CHARS = "0123456789abcdef";
  function randHex(len) {
    var s = "";
    for (var rhi = 0; rhi < len; rhi++) s += HEX_CHARS[Math.floor(Math.random()*16)];
    return s;
  }
  var FINAL_SHA = "a3f8c2e1d4b09752";

  function easeOutExpo(tp) { return tp >= 1 ? 1 : 1 - Math.pow(2, -10 * tp); }

  function bootDone() {
    overlay.classList.add("done");
    if (hudEl) hudEl.classList.add("visible");
    if (oscEl) oscEl.classList.add("visible");
    setTimeout(function () { overlay.style.display = "none"; }, 600);
  }

  if (HERO_REDUCED) {
    for (var rri = 0; rri < blades.length; rri++) {
      blades[rri].setAttribute("rx", "10");
      blades[rri].setAttribute("ry", "22");
      blades[rri].setAttribute("cx", "0");
      blades[rri].setAttribute("cy", "-14");
    }
    hole.setAttribute("r", "18");
    shaEl.textContent = "sha256: " + FINAL_SHA;
    statusEl.textContent = "VERIFIED";
    statusEl.style.color = "#256660";
    bootDone();
    return;
  }

  var bootStart = Date.now();
  var BOOT_DUR  = 1600;
  var shaInterval = setInterval(function () { shaEl.textContent = "sha256: " + randHex(16); }, 40);
  var bootPhases = [
    { tp: 0,    label: "SENSING —",   color: "#3a4840" },
    { tp: 0.55, label: "VERIFYING —", color: "#1c4442" },
    { tp: 0.88, label: "VERIFIED",    color: "#256660" },
  ];
  var bootPhaseIdx = 0;

  function bootFrame() {
    var bNow  = Date.now();
    var bRaw  = (bNow - bootStart) / BOOT_DUR;
    var bProg = Math.min(bRaw, 1.0);
    var bEase = easeOutExpo(bProg);
    var bRx = bEase * 10;
    var bRy = bEase * 22;
    var bCy = -14 * bEase;
    for (var bBi = 0; bBi < blades.length; bBi++) {
      blades[bBi].setAttribute("rx", bRx.toFixed(2));
      blades[bBi].setAttribute("ry", bRy.toFixed(2));
      blades[bBi].setAttribute("cx", "0");
      blades[bBi].setAttribute("cy", bCy.toFixed(2));
    }
    hole.setAttribute("r", (bEase * 18).toFixed(2));
    if (bProg > 0.45 && !corona.classList.contains("pulse")) corona.classList.add("pulse");
    for (var bSi = bootPhases.length - 1; bSi >= 0; bSi--) {
      if (bProg >= bootPhases[bSi].tp && bootPhaseIdx <= bSi) {
        bootPhaseIdx = bSi;
        statusEl.textContent = bootPhases[bSi].label;
        statusEl.style.color = bootPhases[bSi].color;
      }
    }
    if (bProg < 1.0) {
      requestAnimationFrame(bootFrame);
    } else {
      clearInterval(shaInterval);
      shaEl.textContent = "sha256: " + FINAL_SHA;
      statusEl.textContent = "VERIFIED";
      statusEl.style.color = "#256660";
      setTimeout(bootDone, 200);
    }
  }
  requestAnimationFrame(bootFrame);
}());

// =============================================================================
// OSCILLOSCOPE HUD — color adapts per world
// =============================================================================
(function () {
  if (HERO_REDUCED) return;
  var osc = document.getElementById("osc-canvas");
  if (!osc) return;
  var ctx = osc.getContext("2d");
  var oscPhase = 0;

  function oscColor() {
    var w = Math.round(worldCurrent);
    if (w === 2) return "#6cdfd6";
    if (w === 1) return "#cc44ff";
    return "#1c4442";
  }

  var oscAlive = false;
  function oscOnScreen() { return !document.hidden && window.scrollY < window.innerHeight * 1.4; }
  function oscKick() { if (!oscAlive && oscOnScreen()) { oscAlive = true; requestAnimationFrame(oscFrame); } }
  function oscFrame() {
    if (!oscOnScreen()) { oscAlive = false; return; }
    var oscW = osc.offsetWidth  || 120;
    var oscH = osc.offsetHeight || 38;
    osc.width  = oscW;
    osc.height = oscH;
    ctx.clearRect(0, 0, oscW, oscH);
    var gridA = (Math.round(worldCurrent) === 2) ? "rgba(108,223,214,0.12)" : "rgba(58,72,64,0.18)";
    ctx.strokeStyle = gridA;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, oscH * 0.5);
    ctx.lineTo(oscW, oscH * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = oscColor();
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur  = 0;
    for (var ox = 0; ox < oscW; ox++) {
      var ofrac  = ox / oscW;
      var osweep = Math.sin(ofrac * Math.PI * 4 + oscPhase) * 0.28 +
                   Math.sin(ofrac * Math.PI * 9 + oscPhase * 1.3) * 0.10 +
                   Math.sin(ofrac * Math.PI * 21 + oscPhase * 0.7) * 0.04;
      var oy = oscH * (0.5 - osweep * 0.82);
      if (ox === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.stroke();
    oscPhase += 0.055;
    requestAnimationFrame(oscFrame);
  }
  window.addEventListener("scroll", oscKick, { passive: true });
  document.addEventListener("visibilitychange", oscKick);
  oscAlive = true;
  oscFrame();
}());

// =============================================================================
// MAIN GL BOOTSTRAP — canvas#gl (shared contract for every page)
// =============================================================================
(function () {
  var canvas = document.getElementById("gl");
  if (!canvas) return;
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { document.body.style.background = "#0a0c0b"; return; }

  var DPR = Math.min(window.devicePixelRatio || 1, HERO_KNOBS.MAX_DPR);

  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

  var vshObj = heroCompileShader(gl, gl.VERTEX_SHADER, HERO_VERT);
  if (!vshObj) return;
  var fshObj = heroCompileShader(gl, gl.FRAGMENT_SHADER, HERO_FRAG);
  if (!fshObj) return;
  var progMain = heroLinkProgram(gl, vshObj, fshObj);
  if (!progMain) return;

  gl.useProgram(progMain);

  var aPos = gl.getAttribLocation(progMain, "a_pos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // ── Uniform locations ──
  var uRes       = gl.getUniformLocation(progMain, "u_res");
  var uTime      = gl.getUniformLocation(progMain, "u_time");
  var uTex0      = gl.getUniformLocation(progMain, "u_tex0");
  var uTex1      = gl.getUniformLocation(progMain, "u_tex1");
  var uTex2      = gl.getUniformLocation(progMain, "u_tex2");
  var uTexRes    = gl.getUniformLocation(progMain, "u_texres");
  var uMouse     = gl.getUniformLocation(progMain, "u_mouse");
  var uFlowDen   = gl.getUniformLocation(progMain, "u_flow_density");
  var uRdScale   = gl.getUniformLocation(progMain, "u_rd_scale");
  var uVoroS     = gl.getUniformLocation(progMain, "u_voronoi_scale");
  var uContF     = gl.getUniformLocation(progMain, "u_contour_freq");
  var uLineShp   = gl.getUniformLocation(progMain, "u_line_sharp");
  var uGeoPhoto  = gl.getUniformLocation(progMain, "u_geo_photo");
  var uGeoBright = gl.getUniformLocation(progMain, "u_geo_bright");
  var uHazeStr   = gl.getUniformLocation(progMain, "u_haze_strength");
  var uHazeMix   = gl.getUniformLocation(progMain, "u_haze_mix");
  var uRay       = gl.getUniformLocation(progMain, "u_godray_opacity");
  var uEmber     = gl.getUniformLocation(progMain, "u_ember_intensity");
  var uSteel     = gl.getUniformLocation(progMain, "u_steel_balance");
  var uScan      = gl.getUniformLocation(progMain, "u_scanline_weight");
  var uGrain     = gl.getUniformLocation(progMain, "u_grain_strength");
  var uVig       = gl.getUniformLocation(progMain, "u_vignette_power");
  var uMouseInf  = gl.getUniformLocation(progMain, "u_mouse_influence");
  var uInvert    = gl.getUniformLocation(progMain, "u_invert_strength");
  var uBone      = gl.getUniformLocation(progMain, "u_bone_warmth");
  var uCaStr     = gl.getUniformLocation(progMain, "u_ca_strength");
  var uCaStretch = gl.getUniformLocation(progMain, "u_ca_stretch");
  var uGridLens  = gl.getUniformLocation(progMain, "u_grid_lens");
  var uGridHarm  = gl.getUniformLocation(progMain, "u_grid_harmonic");
  var uGridPersp = gl.getUniformLocation(progMain, "u_grid_persp");
  var uGridOp    = gl.getUniformLocation(progMain, "u_grid_opacity");
  var uHeroWorld = gl.getUniformLocation(progMain, "u_world");

  function setKnobs() {
    gl.uniform1f(uFlowDen,   HERO_KNOBS.FLOW_DENSITY);
    gl.uniform1f(uRdScale,   HERO_KNOBS.RD_SCALE);
    gl.uniform1f(uVoroS,     HERO_KNOBS.VORONOI_SCALE);
    gl.uniform1f(uContF,     HERO_KNOBS.CONTOUR_FREQ);
    gl.uniform1f(uLineShp,   HERO_KNOBS.LINE_SHARP);
    gl.uniform1f(uGeoPhoto,  HERO_KNOBS.GEO_PHOTO_BALANCE);
    gl.uniform1f(uGeoBright, HERO_KNOBS.GEO_BRIGHT);
    gl.uniform1f(uHazeStr,   HERO_KNOBS.HAZE_STRENGTH);
    gl.uniform1f(uHazeMix,   HERO_KNOBS.HAZE_MIX);
    gl.uniform1f(uRay,       HERO_KNOBS.GODRAY_OPACITY);
    gl.uniform1f(uEmber,     HERO_KNOBS.EMBER_INTENSITY);
    gl.uniform1f(uSteel,     HERO_KNOBS.STEEL_BALANCE);
    gl.uniform1f(uScan,      HERO_KNOBS.SCANLINE_WEIGHT);
    gl.uniform1f(uGrain,     HERO_KNOBS.GRAIN_STRENGTH);
    gl.uniform1f(uVig,       HERO_KNOBS.VIGNETTE_POWER);
    gl.uniform1f(uMouseInf,  HERO_KNOBS.MOUSE_INFLUENCE);
    gl.uniform1f(uInvert,    HERO_KNOBS.INVERT_STRENGTH);
    gl.uniform1f(uBone,      HERO_KNOBS.BONE_WARMTH);
    gl.uniform1f(uCaStr,     HERO_KNOBS.CA_STRENGTH);
    gl.uniform1f(uCaStretch, HERO_KNOBS.CA_STRETCH);
    gl.uniform1f(uGridLens,  HERO_KNOBS.GRID_LENS);
    gl.uniform1f(uGridHarm,  HERO_KNOBS.GRID_HARMONIC);
    gl.uniform1f(uGridPersp, HERO_KNOBS.GRID_PERSP);
    gl.uniform1f(uGridOp,    HERO_KNOBS.GRID_OPACITY);
  }

  // ── Photo textures (three slots) ──
  var tw = 1800, th = 1250;

  function makeTexture(unit, rgb) {
    var tx = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(rgb));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tx;
  }

  function loadTex(unit, tx, src, onload) {
    var img = new Image();
    img.onload = function () {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (onload) onload(img);
    };
    img.src = src;
  }

  var tex0 = makeTexture(0, [20, 9, 15]);
  var tex1 = makeTexture(1, [12, 20, 19]);
  var tex2 = makeTexture(2, [18, 14, 8]);
  loadTex(0, tex0, "/img/Eq5QQ5s.jpg", function (img) { tw = img.naturalWidth; th = img.naturalHeight; });
  loadTex(1, tex1, "/img/tSlbTec.jpg", null);
  loadTex(2, tex2, "/img/XJJSZrM.jpg", null);

  // ── Resize ──
  var glW = 0, glH = 0;
  function resize() {
    glW = Math.floor(canvas.clientWidth  * DPR);
    glH = Math.floor(canvas.clientHeight * DPR);
    canvas.width  = glW;
    canvas.height = glH;
    gl.viewport(0, 0, glW, glH);
  }
  window.addEventListener("resize", resize);
  resize();

  // ── Mouse / touch ──
  var mx = [0.34, 0.0], mt = [0.34, 0.0];
  window.addEventListener("mousemove", function (e) {
    var rect = canvas.getBoundingClientRect();
    mt[0] = ((e.clientX - rect.left) / rect.width  - 0.5) * (canvas.width / canvas.height);
    mt[1] = (0.5 - (e.clientY - rect.top) / rect.height);
  });
  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    var rect  = canvas.getBoundingClientRect();
    var touch = e.touches[0];
    mt[0] = ((touch.clientX - rect.left) / rect.width  - 0.5) * (canvas.width / canvas.height);
    mt[1] = (0.5 - (touch.clientY - rect.top) / rect.height);
  }, { passive: false });

  var startTime = Date.now();

  function drawFrame(elapsed) {
    gl.useProgram(progMain);
    gl.uniform2f(uRes,    glW, glH);
    gl.uniform1f(uTime,   elapsed);
    gl.uniform2f(uMouse,  mx[0], mx[1]);
    gl.uniform2f(uTexRes, tw, th);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex0); gl.uniform1i(uTex0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex1); gl.uniform1i(uTex1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex2); gl.uniform1i(uTex2, 2);
    setKnobs();
    // Lerp worldCurrent toward worldTarget — ~280ms snappy crossfade
    worldCurrent += (worldTarget - worldCurrent) * 0.06;
    gl.uniform1f(uHeroWorld, worldCurrent);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // pause the shader when the hero is scrolled away or the tab is hidden — the
  // fragment loop shouldn't keep running behind a screenful of content (cf. hero-art.js)
  var heroAlive = false;
  function heroOnScreen() { return !document.hidden && window.scrollY < window.innerHeight * 1.4; }
  function frame() {
    if (HERO_REDUCED || !heroOnScreen()) { heroAlive = false; return; }
    mx[0] += (mt[0] - mx[0]) * 0.025;
    mx[1] += (mt[1] - mx[1]) * 0.025;
    var elapsed = (Date.now() - startTime) / 1000 * HERO_KNOBS.TIME_SCALE;
    drawFrame(elapsed);
    requestAnimationFrame(frame);
  }
  function heroKick() { if (!HERO_REDUCED && !heroAlive && heroOnScreen()) { heroAlive = true; requestAnimationFrame(frame); } }

  if (HERO_REDUCED) {
    worldCurrent = worldTarget;
    drawFrame(0.0);
  } else {
    window.addEventListener("scroll", heroKick, { passive: true });
    document.addEventListener("visibilitychange", heroKick);
    heroAlive = true;
    frame();
  }
}());

// =============================================================================
// MOTES — 2D canvas on #motes, color adapts per world
// =============================================================================
(function () {
  var mc = document.getElementById("motes");
  if (!mc) return;
  var mctx = mc.getContext("2d");
  if (HERO_REDUCED) return;

  var mW, mH, mP = [];
  function mResize() { mW = mc.width = mc.clientWidth; mH = mc.height = mc.clientHeight; }
  window.addEventListener("resize", mResize);
  mResize();

  for (var mi = 0; mi < 40; mi++) {
    var mIsAsh = mi > 27;
    mP.push({
      x:    Math.random() * mW,
      y:    Math.random() * mH,
      r:    mIsAsh ? Math.random()*2.2+0.8 : Math.random()*1.2+0.25,
      vy:   mIsAsh ? -(Math.random()*0.12+0.04) : -(Math.random()*0.30+0.08),
      mph:  Math.random()*6.2832,
      wx:   Math.random()*0.30+0.06,
      o:    mIsAsh ? Math.random()*0.13+0.04 : Math.random()*0.22+0.08,
      heat: Math.random(),
      ash:  mIsAsh,
    });
  }

  var mStart = Date.now();
  function mLerp(ma, mb, mtt) { return ma + (mb - ma) * mtt; }

  var mAlive = false;
  function mOnScreen() { return !document.hidden && window.scrollY < window.innerHeight * 1.4; }
  function mKick() { if (!mAlive && mOnScreen()) { mAlive = true; requestAnimationFrame(mLoop); } }
  function mLoop() {
    if (!mOnScreen()) { mAlive = false; return; }
    mctx.clearRect(0, 0, mW, mH);
    var msec  = (Date.now() - mStart) / 1000;
    var wSnap = Math.round(worldCurrent);

    for (var mj = 0; mj < mP.length; mj++) {
      var mp = mP[mj];
      mp.y -= mp.vy;
      mp.x += Math.sin(mp.y * 0.010 + mp.mph + msec * 0.3) * mp.wx;
      if (mp.y > mH + 8) { mp.y = -8; mp.x = Math.random() * mW; }
      if (mp.x < -10) mp.x = mW + 10;
      if (mp.x > mW + 10) mp.x = -10;

      var mpulse = mp.ash
        ? mp.o * (0.45 + 0.55 * Math.sin(msec * 0.8 + mp.mph))
        : mp.o * (0.50 + 0.50 * Math.sin(msec * 1.2 + mp.mph));

      var mr, mg, mb;
      if (wSnap === 2) {
        mr = Math.round(mLerp(0x20, 0x6c, mp.heat));
        mg = Math.round(mLerp(0x60, 0xdf, mp.heat));
        mb = Math.round(mLerp(0x58, 0xd6, mp.heat));
        mpulse *= 0.55;
      } else if (wSnap === 1) {
        var mHue = (mp.heat + msec * 0.04) % 1.0;
        var mR6  = mHue * 6.0;
        var mSi  = Math.floor(mR6);
        var mSf  = mR6 - mSi;
        var mSv  = 220;
        mr = mg = mb = mSv;
        if (mSi === 0) { mg = Math.round(mSf * mSv); mb = 0; }
        else if (mSi === 1) { mr = Math.round((1-mSf)*mSv); mb = 0; }
        else if (mSi === 2) { mr = 0; mb = Math.round(mSf*mSv); }
        else if (mSi === 3) { mr = 0; mg = Math.round((1-mSf)*mSv); }
        else if (mSi === 4) { mr = Math.round(mSf*mSv); mg = 0; }
        else { mg = 0; mb = Math.round((1-mSf)*mSv); }
      } else {
        mr = Math.round(mLerp(0x3a, 0x50, mp.heat));
        mg = Math.round(mLerp(0x48, 0x5c, mp.heat));
        mb = Math.round(mLerp(0x40, 0x54, mp.heat));
      }

      mctx.beginPath();
      mctx.fillStyle = "rgba("+mr+","+mg+","+mb+","+mpulse.toFixed(3)+")";
      mctx.shadowColor = "transparent";
      mctx.shadowBlur  = 0;
      mctx.arc(mp.x, mp.y, mp.r, 0, 6.2832);
      mctx.fill();
    }
    requestAnimationFrame(mLoop);
  }
  window.addEventListener("scroll", mKick, { passive: true });
  document.addEventListener("visibilitychange", mKick);
  mAlive = true;
  mLoop();
}());

// =============================================================================
// REVEAL — IntersectionObserver adds .visible to .reveal / .reveal-children
// Content is fully visible at rest (opacity:1 in CSS). .visible adds a
// translateY settle for elements that are in the viewport; headless / no-JS
// contexts are unaffected because the CSS resting state is already visible.
// =============================================================================
(function () {
  // prefers-reduced-motion: immediately add .visible so the subtle translateY
  // is suppressed by the CSS @media rule. Content was already opacity:1.
  if (HERO_REDUCED) {
    document.querySelectorAll(".reveal, .reveal-children").forEach(function (el) {
      el.classList.add("visible");
    });
    return;
  }

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.11, rootMargin: "0px 0px -36px 0px" });

  document.querySelectorAll(".reveal, .reveal-children").forEach(function (el) {
    revealIO.observe(el);
  });
}());
