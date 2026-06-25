/* endless.js: the live, endless, interactive creativity engine.

   It drives the SAME witnessed algorithms the atelier runs (via window.Atelier,
   so nothing is duplicated): left alone it draws itself, organ after organ,
   never the same twice; touched, it hands the viewer the engine's powers as a
   row of little tools, and three capabilities that make the point of the whole
   site. It can WITNESS the live drawing's geometry (SHA-256, re-derivable),
   hand it back as a pen-plot SVG, or save the luminous frame as a PNG.

   Once a drawing settles it doesn't freeze: a live particle field streams along
   the drawing's own contours and CURLS around the cursor, so the canvas is
   always alive and answers the mouse.

   Determinism is untouched: this is a separate display consumer of the engine;
   the atelier's export + witness are byte-identical to before. */
(function () {
  "use strict";
  var A = window.Atelier;
  var canvas = document.getElementById("endless-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var MARGIN = 0.055; // matches the atelier's drawing frame
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  // ── the pools ──────────────────────────────────────────────────────────────
  var ORGANS = [
    { id: "phyllotaxis", label: "Whorl" }, { id: "flow", label: "Current" },
    { id: "venation", label: "Veins" }, { id: "reaction", label: "Bloom" },
    { id: "physarum", label: "Forage" }, { id: "growth", label: "Coral" },
    { id: "penrose", label: "Quasicrystal" }, { id: "dla", label: "Dendrite" },
    { id: "lsystem", label: "Thicket" }, { id: "voronoi", label: "Cells" },
    { id: "clifford", label: "Attractor" }, { id: "maurer", label: "Rose" },
    { id: "lightning", label: "Lichtenberg" }, { id: "gosper", label: "Flowsnake" },
    { id: "koch", label: "Snowflake" }, { id: "dragon", label: "Dragon" },
    { id: "hilbert", label: "Hilbert" }, { id: "harmonograph", label: "Harmonograph" },
    { id: "binomial", label: "Gasket" }, { id: "boids", label: "Murmur" }
  ];
  var SPECS = [
    { id: "snail", label: "Snail" }, { id: "mallow", label: "Mallow" },
    { id: "seedhead", label: "Seedhead" }, { id: "dandelion", label: "Dandelion" },
    { id: "none", label: "Pure math" }
  ];
  var PALS = ["biolume", "marrow", "chitin", "verdigris", "spectrum", "ember", "cool", "mono"];
  var AUTO_POOL = ["phyllotaxis", "flow", "venation", "reaction", "physarum", "penrose", "dla", "lsystem", "clifford", "maurer", "lightning", "growth", "voronoi", "gosper", "koch", "harmonograph", "boids"];
  var AUTO_SPEC = ["snail", "mallow", "seedhead", "dandelion"];

  // playlist randomness (each PIECE stays deterministic from its recipe; only the
  // choice of the next recipe is free)
  var pick = (function () { var s = (now() % 99991) | 0 || 7; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  function choose(a) { return a[(pick() * a.length) | 0]; }
  function newSeed() { var c = "abcdefghijklmnopqrstuvwxyz0123456789", o = ""; for (var i = 0; i < 6; i++) o += c[(pick() * 36) | 0]; return o; }

  // ── state ──
  var state = { study: "phyllotaxis", specimen: "snail", palette: "biolume", seed: "nautilus", wild: 0.55, density: 0.62, auto: true };
  var drawToken = 0, rafId = 0, holdTimer = 0, idleTimer = 0, transTimer = 0;
  var finalStrokes = [], curField = null, W = 0, H = 0, dpr = 1, settled = false;

  // particle field
  var BASE = document.createElement("canvas"), bctx = BASE.getContext("2d");
  var parts = [], partRaf = 0;
  var ptr = { fx: 0.5, fy: 0.5, on: false, str: 0 };

  if (!A || !A.STUDIES) { // engine script may still be parsing; wait for it
    var waited = 0, iv = setInterval(function () {
      if (window.Atelier && window.Atelier.STUDIES) { clearInterval(iv); A = window.Atelier; start(); }
      else if (waited++ > 50) clearInterval(iv);
    }, 80);
  }

  function studyById(id) { for (var i = 0; i < A.STUDIES.length; i++) if (A.STUDIES[i].id === id) return A.STUDIES[i]; return A.STUDIES[0]; }
  function specById(id) { for (var i = 0; i < A.SPECIMENS.length; i++) if (A.SPECIMENS[i].id === id) return A.SPECIMENS[i]; return A.SPECIMENS[1]; }
  function organLabel(id) { for (var i = 0; i < ORGANS.length; i++) if (ORGANS[i].id === id) return ORGANS[i].label; return id; }
  function specLabel(id) { for (var i = 0; i < SPECS.length; i++) if (SPECS[i].id === id) return SPECS[i].label.toLowerCase(); return id; }

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  // wildness drives a study's own knob; density drives the count
  function paramsFor(study) {
    var p = A.defParams(study), w = state.wild;
    if (study === "phyllotaxis") { p.warp = +(0.62 * w).toFixed(4); p.spread = +(0.4 + 0.09 * w).toFixed(4); }
    if (study === "reaction") { p.mask = +(0.45 + 0.45 * w).toFixed(4); }
    return p;
  }
  function complexityFor() { return clamp(0.4 + 0.55 * state.density, 0, 1); }

  // ── the draw ──
  function draw() {
    stopParticles();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    var dim = size(); W = dim[0]; H = dim[1];
    var st = studyById(state.study), spec = specById(state.specimen);
    var pal = A.makePalette(A.PALETTES[state.palette] || A.PALETTES.spectrum);
    var P = { complexity: complexityFor(), palette: pal, reduced: reduced, params: paramsFor(state.study) };
    var seedkey = state.seed + "|" + state.study + "|" + state.specimen + "|" + Math.round(P.complexity * 100) + "|" + state.palette;
    var rng = A.makeRng(seedkey);
    var token = ++drawToken; settled = false;

    var go = function (field) {
      if (token !== drawToken) return;
      curField = field;
      var piece;
      try { piece = st.build(rng, P, field); } catch (e) { if (window.console) console.warn("[endless]", state.study, e && e.message); curField = null; advanceSoon(1200); return; }
      if (piece.live) {
        var t0 = now();
        var tick = function () {
          if (token !== drawToken) return;
          var done = false;
          if (now() - t0 > 6500) { var g = 0; while (!piece.step() && g++ < 3000) {} done = true; }
          else { for (var s = 0; s < 4; s++) { if (piece.step()) { done = true; break; } } }
          var cur = piece.strokes(); A.drawStrokes(ctx, W, H, cur, 1);
          if (!done) { rafId = requestAnimationFrame(tick); }
          else { finalStrokes = cur; A.paintRich(ctx, W, H, cur, curField, state.palette); onSettled(); }
        };
        rafId = requestAnimationFrame(tick);
      } else {
        var strokes = piece.strokes; finalStrokes = strokes;
        if (reduced) { A.paintRich(ctx, W, H, strokes, curField, state.palette); onSettled(); return; }
        var t1 = now(), dur = 1150;
        var rev = function () {
          if (token !== drawToken) return;
          var p = clamp((now() - t1) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
          if (p < 1) { A.drawStrokes(ctx, W, H, strokes, e); rafId = requestAnimationFrame(rev); }
          else { A.paintRich(ctx, W, H, strokes, curField, state.palette); onSettled(); }
        };
        rafId = requestAnimationFrame(rev);
      }
    };
    if (spec && spec.src) { A.loadField(spec.src, function (f) { if (token === drawToken) go(f); }); }
    else go(null);
  }

  function onSettled() {
    settled = true; setReadout();
    captureBase(); startParticles();
    if (state.auto) advanceSoon(reduced ? 6500 : 5200);
  }
  function advanceSoon(ms) { clearTimeout(holdTimer); holdTimer = setTimeout(advance, ms); }

  // ── the living particle field ────────────────────────────────────────────
  function captureBase() {
    BASE.width = canvas.width; BASE.height = canvas.height;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { A.paintRich(bctx, W, H, finalStrokes, curField, state.palette); }
    catch (e) { bctx.drawImage(canvas, 0, 0, W, H); }
  }
  function spawn(p) { p.x = pick(); p.y = pick(); p.vx = 0; p.vy = 0; p.life = 30 + (pick() * 150 | 0); }
  function stopParticles() { if (partRaf) { cancelAnimationFrame(partRaf); partRaf = 0; } }
  function startParticles() {
    stopParticles();
    if (reduced) return; // reduced-motion: hold the still frame
    var inner = Math.min(W, H) * (1 - 2 * MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
    var pal = A.makePalette(A.PALETTES[state.palette] || A.PALETTES.spectrum);
    var n = clamp(Math.round(W * H / 950), 160, 820);
    parts = []; for (var i = 0; i < n; i++) { var p = {}; spawn(p); parts.push(p); }
    var sc = inner / 1000;
    var frame = function () {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(BASE, 0, 0, W, H);
      ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var g = curField ? curField.grad(p.x, p.y) : [0, 0];
        var fx = -g[1] * 7.0, fy = g[0] * 7.0;                              // flow along contours
        fx += Math.cos(p.y * 6.2832 + p.x * 3.1) * 0.14;                    // a gentle global swirl so blank fields still breathe
        fy += Math.sin(p.x * 6.2832 + p.y * 3.1) * 0.14;
        if (ptr.on || ptr.str > 0.02) {                                     // the cursor: curl + a touch of pull
          var dx = p.x - ptr.fx, dy = p.y - ptr.fy, d2 = dx * dx + dy * dy + 0.0009, inv = 0.011 / d2;
          fx += (-dy * inv - dx * inv * 0.35) * ptr.str;
          fy += (dx * inv - dy * inv * 0.35) * ptr.str;
        }
        p.vx = p.vx * 0.84 + fx * 0.0016; p.vy = p.vy * 0.84 + fy * 0.0016;
        var px = p.x, py = p.y; p.x += p.vx; p.y += p.vy;
        if (--p.life < 0 || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) { spawn(p); continue; }
        var l = curField ? clamp(curField.lum(p.x, p.y), 0, 1) : (0.35 + 0.4 * p.y);
        ctx.strokeStyle = pal.sample(clamp(l * 1.04, 0, 1));
        ctx.globalAlpha = 0.045 + 0.32 * l;
        ctx.lineWidth = Math.max(0.45, sc * (0.7 + 1.5 * l));
        ctx.beginPath();
        ctx.moveTo(offx + px * inner, offy + py * inner);
        ctx.lineTo(offx + p.x * inner, offy + p.y * inner);
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ptr.str *= 0.95;
      partRaf = requestAnimationFrame(frame);
    };
    partRaf = requestAnimationFrame(frame);
  }

  // ── crossfade + autoplay ──
  function transition(then) {
    if (reduced) { then(); return; }
    canvas.style.opacity = "0.06";
    clearTimeout(transTimer);
    transTimer = setTimeout(function () { then(); canvas.style.opacity = "1"; }, 460);
  }
  function advance() {
    state.study = choose(AUTO_POOL); state.specimen = choose(AUTO_SPEC);
    state.palette = choose(PALS); state.seed = newSeed();
    transition(function () { draw(); syncTools(); });
  }

  // ── the little tools ──────────────────────────────────────────────────────
  var tools = document.getElementById("engine-tools");
  var readoutEl = document.getElementById("engine-readout");
  var witnessEl = document.getElementById("engine-witness");
  var autoBtn;

  function setReadout() {
    if (readoutEl) readoutEl.innerHTML = "<b>" + organLabel(state.study) + "</b> &middot; reading the " + specLabel(state.specimen) + " &middot; seed <span class='es'>" + state.seed + "</span>";
  }
  function setAutoBtn() { if (autoBtn) { autoBtn.textContent = state.auto ? "❚❚ playing" : "▶ paused"; autoBtn.setAttribute("aria-pressed", String(state.auto)); } }
  function userTouched() {
    state.auto = false; setAutoBtn(); clearTimeout(holdTimer); clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { state.auto = true; setAutoBtn(); advanceSoon(400); }, 35000);
  }
  function mkBtn(label, title, fn, cls) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "etool-btn" + (cls ? " " + cls : ""); b.textContent = label; b.title = title;
    b.addEventListener("click", function () { fn(b); });
    return b;
  }
  function chipRow(cls, items, getId, onPick, attr) {
    var row = document.createElement("div"); row.className = "etool-row " + cls;
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "etool-chip"; b.textContent = it.label; b.setAttribute(attr, it.id);
      b.addEventListener("click", function () { onPick(it.id); });
      row.appendChild(b);
    });
    return row;
  }

  function buildTools() {
    if (!tools) return;
    tools.innerHTML = "";
    tools.appendChild(chipRow("etool-organs", ORGANS, "data-organ", function (id) { userTouched(); state.study = id; state.seed = newSeed(); transition(function () { draw(); syncTools(); }); }, "data-organ"));
    tools.appendChild(chipRow("etool-specs", SPECS, "data-spec", function (id) { userTouched(); state.specimen = id; draw(); syncTools(); }, "data-spec"));

    var ctrl = document.createElement("div"); ctrl.className = "etool-row etool-ctrls";

    var palWrap = document.createElement("div"); palWrap.className = "etool-pals";
    PALS.forEach(function (pid) {
      var sw = document.createElement("button");
      sw.type = "button"; sw.className = "etool-sw"; sw.setAttribute("data-pal", pid); sw.title = pid;
      sw.style.background = "linear-gradient(135deg," + (A.PALETTES[pid] || []).join(",") + ")";
      sw.addEventListener("click", function () { userTouched(); state.palette = pid; draw(); syncTools(); });
      palWrap.appendChild(sw);
    });
    ctrl.appendChild(palWrap);

    ctrl.appendChild(slider("wild", state.wild, function (v) { state.wild = v; draw(); }));
    ctrl.appendChild(slider("dense", state.density, function (v) { state.density = v; draw(); }));

    var actions = document.createElement("div"); actions.className = "etool-actions";
    actions.appendChild(mkBtn("↻", "Reseed: a fresh draw of the same recipe", function () { userTouched(); state.seed = newSeed(); transition(function () { draw(); setReadout(); }); }));
    autoBtn = mkBtn("❚❚ playing", "Play / pause the endless drift", function () { state.auto = !state.auto; setAutoBtn(); if (state.auto) { clearTimeout(idleTimer); advanceSoon(400); } else clearTimeout(holdTimer); }, "etool-auto");
    actions.appendChild(autoBtn);
    actions.appendChild(mkBtn("◉ witness", "Witness this drawing's geometry (SHA-256), re-derivable, never trusted", doWitness));
    actions.appendChild(mkBtn("↓ plot", "Download as a re-derivable pen-plot SVG", doSVG));
    actions.appendChild(mkBtn("↓ png", "Save the luminous frame as a PNG", doPNG));
    ctrl.appendChild(actions);

    tools.appendChild(ctrl);
    syncTools(); setAutoBtn();
  }
  function slider(kind, val, fn) {
    var w = document.createElement("label"); w.className = "etool-wild";
    w.innerHTML = "<span>" + kind + "</span>";
    var s = document.createElement("input");
    s.type = "range"; s.min = "0"; s.max = "100"; s.value = String(Math.round(val * 100));
    s.className = "etool-range"; s.setAttribute("aria-label", kind === "wild" ? "Wildness" : "Density");
    s.addEventListener("input", function () { userTouched(); fn((+s.value) / 100); });
    w.appendChild(s); return w;
  }
  function syncTools() {
    if (!tools) return;
    tools.querySelectorAll(".etool-chip[data-organ]").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-organ") === state.study)); });
    tools.querySelectorAll(".etool-chip[data-spec]").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-spec") === state.specimen)); });
    tools.querySelectorAll(".etool-sw").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-pal") === state.palette); });
    setReadout();
  }

  // ── capabilities: witness · plot · png ──
  function plotOpt() {
    if (!finalStrokes.length) return null;
    try { return A.optimizeForPlot(finalStrokes.map(function (s) { return { pts: s.pts, col: s.col, w: s.w }; }), { tol: 0.0007 }); } catch (e) { return null; }
  }
  function doWitness() {
    if (!witnessEl) return;
    var opt = plotOpt();
    if (!opt || !window.Spine) { witnessEl.textContent = "nothing to witness yet"; return; }
    witnessEl.innerHTML = "witnessing…";
    var svg = A.plotSVG(opt, ""), i = svg.indexOf('<g fill="none"'), j = svg.lastIndexOf("</svg>");
    window.Spine.witness((i >= 0 && j > i) ? svg.slice(i, j) : svg).then(function (h) {
      witnessEl.innerHTML = h
        ? "witness <span class='ew'>" + h.slice(0, 16) + "…</span> &middot; this exact drawing re-derives from seed <span class='es'>" + state.seed + "</span>"
        : "witness needs a secure context (https)";
    });
  }
  function doSVG() {
    var opt = plotOpt(); if (!opt) return;
    var meta = "endless engine drawing\nstudy=" + state.study + " specimen=" + state.specimen + " palette=" + state.palette +
      " seed=" + state.seed + " wild=" + Math.round(state.wild * 100) + " density=" + Math.round(state.density * 100) + "\n" +
      "drawn live at harperz9.github.io, the engine the atelier witnesses. github.com/HarperZ9";
    save(new Blob([A.plotSVG(opt, meta)], { type: "image/svg+xml" }), "endless-" + state.study + "-" + state.seed + ".svg");
  }
  function doPNG() {
    try { canvas.toBlob(function (b) { if (b) save(b, "endless-" + state.study + "-" + state.seed + ".png"); }, "image/png"); } catch (e) {}
  }
  function save(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // ── pointer life: feed the particle field ──
  function toField(e) {
    var r = canvas.getBoundingClientRect(), inner = Math.min(r.width, r.height) * (1 - 2 * MARGIN);
    ptr.fx = clamp(((e.clientX - r.left) - (r.width - inner) / 2) / inner, 0, 1);
    ptr.fy = clamp(((e.clientY - r.top) - (r.height - inner) / 2) / inner, 0, 1);
    ptr.on = true; ptr.str = Math.min(1.4, ptr.str + 0.5);
  }
  canvas.addEventListener("pointermove", toField);
  canvas.addEventListener("pointerleave", function () { ptr.on = false; });
  canvas.addEventListener("click", function () { userTouched(); state.seed = newSeed(); transition(function () { draw(); setReadout(); }); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { if (settled) startParticles(); if (state.auto) advanceSoon(800); }
        else { stopParticles(); clearTimeout(holdTimer); clearTimeout(transTimer); if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
      });
    }, { threshold: 0.1 }).observe(canvas);
  }

  var rtimer = 0;
  window.addEventListener("resize", function () { clearTimeout(rtimer); rtimer = setTimeout(function () { if (settled) { size(); captureBase(); startParticles(); } }, 200); });

  function start() { buildTools(); draw(); }
  if (A && A.STUDIES) start();
})();
