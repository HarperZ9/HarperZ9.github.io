/* liquid-metal.js: a flowing liquid-chrome WebGL1 background for the Telos hero.

   Self-contained vanilla JS, no dependencies, no build step. Mounts to an
   existing <canvas id="metal-canvas"> and animates a full-screen liquid-metal
   field: a domain-warped FBM flow surface shaded as polished steel with a tight
   anisotropic key highlight, a broad fresnel rim, a soft hemispheric
   environment term, and a tasteful thin-film shimmer on the brightest crests.

   Technique mined and elevated from _preview/hero-ultimate.html and
   hero-worlds.html (gradient-noise FBM, domain warping, world-grade tone
   remap, and their local-uniqueness shader convention), re-aimed from a dark
   biomechanical look into a clean cool-chrome material.

   Engineering contract:
   - WebGL1 only. Constant integer loop bounds. No float swizzles. Every local
     inside a reused helper carries a unique prefix so the program compiles on
     strict drivers (see the prefix table below).
   - Fail-safe: if WebGL is missing or the program fails to compile or link,
     hide the canvas and return so the CSS fallback background shows through.
   - Performance: the canvas is heavily glass-blurred on top, so we render below
     native resolution (RENDER_SCALE) with a capped DPR, keep FBM to 4 octaves,
     and reconstruct the normal from a single forward difference (3 field()
     taps per pixel total). Targets a smooth 60fps on integrated GPUs.
   - Honors prefers-reduced-motion: reduce by drawing one still frame, no RAF.
   - Resize-aware, passive listeners, eased mouse parallax via u_mouse.

   No em-dashes anywhere in this file, including comments.

   Local-prefix table (shader): gh2 none / gnoise gn_ / fbm fb_ /
   warp wp_ / field fd_ / sky sk_ / grade gd_ / main bare (unique in scope). */
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

  // ── Precision: prefer highp, fall back to mediump if the fragment stage
  //    cannot do highp (older mobile). The shader is written to tolerate it. ──
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
    //    value-noise hash, which matters for a believable liquid surface.
    //    gh2: no locals beyond the parameter.
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

    // ── Double domain warp: warp the lookup by an FBM offset that is itself
    //    warped. This is the source of the slow, curling chrome flow. The two
    //    warp layers drift on slightly different time axes so the surface
    //    never simply scrolls. Prefix wp_.
    "float warp(vec2 p, float t){",
    "  vec2 wp_q = vec2(",
    "    fbm(p + vec2(0.0, 0.30) + t * 0.18),",
    "    fbm(p + vec2(5.2, 1.30) - t * 0.14));",
    "  vec2 wp_r = vec2(",
    "    fbm(p + 1.7 * wp_q + vec2(1.70, 9.20) + t * 0.10),",
    "    fbm(p + 1.7 * wp_q + vec2(8.30, 2.80) - t * 0.08));",
    "  return fbm(p + 1.7 * wp_r + t * 0.05);",
    "}",

    // ── The liquid height field, normalized to roughly [0,1]. Prefix fd_.
    "float field(vec2 uv, float t){",
    "  float fd_h = warp(uv, t);",
    "  return fd_h * 0.5 + 0.5;",
    "}",

    // ── Soft hemispheric environment. A cool sky above fading to a darker,
    //    slightly warmer floor, sampled by the normal's vertical component.
    //    This is the broad reflection the chrome picks up. Prefix sk_.
    "vec3 sky(vec3 n){",
    "  float sk_up = n.y * 0.5 + 0.5;",
    "  vec3 sk_zen = vec3(0.42, 0.52, 0.68);",   // cool steel-blue sky
    "  vec3 sk_hor = vec3(0.16, 0.20, 0.28);",   // dim horizon band
    "  vec3 sk_flr = vec3(0.05, 0.06, 0.085);",  // near-black floor
    "  vec3 sk_c = mix(sk_flr, sk_hor, smoothstep(0.0, 0.5, sk_up));",
    "  sk_c = mix(sk_c, sk_zen, smoothstep(0.45, 1.0, sk_up));",
    "  return sk_c;",
    "}",

    // ── Luminance-driven cool grade in the spirit of the mined worldGrade:
    //    remap the lit value across a black to steel to silver ramp so the
    //    palette stays controlled regardless of lighting. Prefix gd_.
    "vec3 grade(vec3 c){",
    "  float gd_l = dot(c, vec3(0.2126, 0.7152, 0.0722));",
    "  vec3 gd_void   = vec3(0.027, 0.039, 0.066);",  // near-black base ~#070a11
    "  vec3 gd_steel  = vec3(0.204, 0.251, 0.353);",  // mid steel ~#34405a
    "  vec3 gd_silver = vec3(0.682, 0.741, 0.839);",  // bright silver ~#aebdd6
    "  vec3 gd_c = mix(gd_void, gd_steel, smoothstep(0.04, 0.55, gd_l));",
    "  gd_c = mix(gd_c, gd_silver, smoothstep(0.55, 1.0, gd_l));",
    // keep the absolute blacks from going muddy
    "  gd_c = mix(gd_c, gd_void, smoothstep(0.06, 0.0, gd_l) * 0.6);",
    "  return gd_c;",
    "}",

    "void main(){",
    // aspect-correct, height-normalized coordinates centered on screen
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;",
    // gentle, eased mouse parallax shifts the flow; small so it reads as premium
    "  vec2 p = uv * 1.55 + u_mouse * 0.16;",
    "  float t = u_time * 0.045;",  // slow, elegant drift

    // ── Surface + forward-difference normal. Only 3 field() taps per pixel:
    //    the center plus two neighbors. eps is a FIXED field-space step so the
    //    relief looks identical at any render scale or DPR (it does not couple
    //    to u_res). dz sets bump strength: smaller dz -> sharper, more liquid
    //    relief. We divide the slope by eps so the gradient is a true rate.
    "  const float EPS = 0.0035;",
    "  const float DZ  = 0.85;",   // surface flatness; tuned for coherent glints
    "  float f  = field(p, t);",
    "  float fx = (field(p + vec2(EPS, 0.0), t) - f) / EPS;",
    "  float fy = (field(p + vec2(0.0, EPS), t) - f) / EPS;",
    "  vec3  n  = normalize(vec3(-fx, -fy, 1.0 / DZ));",

    // ── View and lights. View is straight on (orthographic feel). A single
    //    key light from the upper left, plus a cool fill from the lower right.
    "  vec3 V = vec3(0.0, 0.0, 1.0);",
    "  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));",   // key
    "  vec3 H = normalize(L + V);",                       // half vector

    // ── Anisotropic spec: stretch the highlight along the local flow tangent
    //    so crests streak like brushed steel rather than reading as round
    //    blobs. The tangent is the in-plane gradient direction; we bias the
    //    half vector's contribution across vs along it.
    "  vec2  grad = vec2(fx, fy);",
    "  vec2  tang = (length(grad) > 1e-5) ? normalize(grad) : vec2(1.0, 0.0);",
    "  float hAlong  = dot(H.xy, tang);",
    "  float hAcross = dot(H.xy, vec2(-tang.y, tang.x));",
    // compress the along-flow axis -> a streaked, elongated specular lobe
    "  float aniso = sqrt(hAlong * hAlong * 0.30 + hAcross * hAcross * 1.0);",
    "  float ndh   = max(dot(n, H), 0.0);",
    // two-lobe spec: a broad sheen plus a tight hot core for the chrome glint
    "  float specBroad = pow(ndh, 22.0);",
    "  float specTight = pow(ndh, 120.0) * (1.0 - aniso * 0.6);",
    "  float ndl = max(dot(n, L), 0.0);",
    "  float spec = (specBroad * 0.55 + specTight * 1.0) * (0.4 + 0.6 * ndl);",

    // ── Fresnel rim: brightens toward grazing angles. Schlick on N.V with a
    //    low F0 so the body stays dark and only the silhouettes of the relief
    //    catch the cool rim. This is what makes it read as polished metal.
    "  float ndv = max(dot(n, V), 0.0);",
    "  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);",

    // ── Environment reflection: reflect the view about the normal and sample
    //    the cool sky. Fresnel weights how much environment we see.
    "  vec3 R = reflect(-V, n);",
    "  vec3 env = sky(R);",

    // ── Base metal albedo: a dark steel body that lifts toward silver on the
    //    raised crests of the height field. Cool throughout.
    "  vec3 baseLo = vec3(0.045, 0.058, 0.082);",
    "  vec3 baseHi = vec3(0.30, 0.36, 0.47);",
    "  vec3 albedo = mix(baseLo, baseHi, smoothstep(0.30, 0.92, f));",

    // ── Compose the metal: ambient body, fresnel-weighted environment, the
    //    key specular tinted faintly cool, and a broad rim glow.
    "  vec3 col = albedo;",
    "  col = mix(col, env, fres * 0.85);",                 // grazing reflections
    "  col += env * 0.18 * (0.5 + 0.5 * n.y);",            // soft sky fill
    "  col += spec * vec3(0.82, 0.90, 1.0) * 1.35;",       // cool key glint
    "  col += vec3(0.10, 0.16, 0.30) * fres * 0.55;",      // cool fresnel rim

    // ── Thin-film iridescence, gated hard to the very brightest crests and
    //    grazing rims so it reads as a subtle oil-on-chrome shimmer, never a
    //    rainbow. Phase driven by view angle and field height (interference-
    //    like), amplitude tied to fresnel * crest height.
    "  float filmGate = smoothstep(0.78, 1.0, f) * fres;",
    "  float phase = f * 6.0 + ndv * 4.0 + t * 0.6;",
    "  vec3  irid = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.66) + phase));",
    "  col += irid * filmGate * 0.085;",                   // tasteful, low gain

    // ── A faint cyan spark on the absolute hottest specular peaks for that
    //    next-level chrome pop, clamped so it cannot blow out.
    "  float hot = smoothstep(0.55, 1.0, spec);",
    "  col += vec3(0.30, 0.55, 0.70) * hot * 0.20;",

    // ── Tone: gentle filmic shoulder so highlights roll instead of clipping.
    "  col = col / (col + vec3(0.72));",
    "  col *= 1.34;",  // re-expose after the compression

    // ── Cool luminance grade (palette lock) blended with the lit color so we
    //    keep specular shape but guarantee the cool steel-to-silver ramp.
    "  col = mix(col, grade(col), 0.40);",

    // ── Vignette: edges fall to dark for text legibility, since glass panels
    //    and a dark veil sit on top. Radial, slightly stronger vertically.
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
      // Surface the reason in dev tools without breaking the page.
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

  // ── Render scale: the canvas is glass-blurred, so we render well below
  //    native resolution and let CSS stretch it. DPR is capped hard. ──
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
