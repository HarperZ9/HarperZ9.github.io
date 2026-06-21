/* endless.js — the live, endless, interactive creativity engine.

   It drives the SAME witnessed algorithms the atelier runs (via window.Atelier
   — nothing is duplicated): left alone it draws itself, organ after organ,
   never the same twice; touched, it hands the viewer the engine's powers as a
   row of little tools, and two capabilities that make the point of the whole
   site — it can WITNESS the live drawing's geometry (SHA-256, re-derivable)
   and hand it back as a pen-plot SVG.

   Determinism is untouched: this is a separate display consumer of the engine;
   the atelier's export + witness are byte-identical to before. */
(function () {
  "use strict";
  var A = window.Atelier;
  var canvas = document.getElementById("endless-canvas");
  if (!A || !canvas) return;

  var ctx = canvas.getContext("2d");
  var reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  // ── the pools: biased to the wild / organic / fractal pieces, on the living world ──
  var ORGANS = [
    { id: "phyllotaxis", label: "Whorl" }, { id: "flow", label: "Current" },
    { id: "venation", label: "Veins" }, { id: "reaction", label: "Bloom" },
    { id: "physarum", label: "Forage" }, { id: "growth", label: "Coral" },
    { id: "penrose", label: "Quasicrystal" }, { id: "dla", label: "Dendrite" },
    { id: "lsystem", label: "Thicket" }, { id: "voronoi", label: "Cells" },
    { id: "clifford", label: "Attractor" }, { id: "maurer", label: "Rose" },
    { id: "lightning", label: "Lichtenberg" }, { id: "gosper", label: "Flowsnake" }
  ];
  var SPECS = ["snail", "mallow", "seedhead", "dandelion"];
  var PALS = ["biolume", "marrow", "chitin", "verdigris", "spectrum", "ember", "cool"];
  var AUTO_POOL = ["phyllotaxis", "flow", "venation", "reaction", "physarum", "penrose", "dla", "lsystem", "clifford", "maurer", "lightning", "growth", "voronoi", "gosper"];

  // ── seedless randomness for the PLAYLIST only (each piece stays deterministic
  //    from its own recipe; only the choice of next recipe is free) ──
  var pick = (function () { var s = (now() % 99991) | 0 || 7; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  function choose(arr) { return arr[(pick() * arr.length) | 0]; }
  function newSeed() { var c = "abcdefghijklmnopqrstuvwxyz0123456789", o = ""; for (var i = 0; i < 6; i++) o += c[(pick() * 36) | 0]; return o; }

  // ── state ──
  var state = { study: "phyllotaxis", specimen: "snail", palette: "biolume", seed: "nautilus", wild: 0.55, auto: !reduced };
  var drawToken = 0, rafId = 0, holdTimer = 0, idleTimer = 0;
  var finalStrokes = [], curField = null, settled = false, W = 0, H = 0;

  function studyById(id) { for (var i = 0; i < A.STUDIES.length; i++) if (A.STUDIES[i].id === id) return A.STUDIES[i]; return A.STUDIES[0]; }
  function specById(id) { for (var i = 0; i < A.SPECIMENS.length; i++) if (A.SPECIMENS[i].id === id) return A.SPECIMENS[i]; return A.SPECIMENS[1]; }
  function organLabel(id) { for (var i = 0; i < ORGANS.length; i++) if (ORGANS[i].id === id) return ORGANS[i].label; return id; }

  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  // wildness drives whatever knob a study exposes: warp (whorl), bloom-mask
  // (reaction), and complexity for everything.
  function paramsFor(study) {
    var p = A.defParams(study), w = state.wild;
    if (study === "phyllotaxis") { p.warp = +(0.62 * w).toFixed(4); p.spread = +(0.4 + 0.09 * w).toFixed(4); }
    if (study === "reaction") { p.mask = +(0.45 + 0.45 * w).toFixed(4); }
    return p;
  }
  function complexityFor() { return clamp(0.5 + 0.34 * state.wild, 0, 1); }

  function onSettled() {
    settled = true;
    setReadout();
    if (state.auto) { clearTimeout(holdTimer); holdTimer = setTimeout(advance, reduced ? 6000 : 4200); }
  }

  function draw(fade) {
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
      try { piece = st.build(rng, P, field); } catch (e) { if (window.console) console.warn("[endless]", state.study, e); return; }
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

  // soft crossfade at the element level — no per-frame compositing cost
  function reveal() { canvas.style.opacity = "1"; }
  function transition(then) {
    if (reduced) { then(); return; }
    canvas.style.opacity = "0.08";
    setTimeout(function () { then(); reveal(); }, 460);
  }

  function advance() {
    state.study = choose(AUTO_POOL); state.specimen = choose(SPECS);
    state.palette = choose(PALS); state.seed = newSeed();
    transition(draw); syncTools();
  }

  // ── the little tools ──────────────────────────────────────────────────────
  var tools = document.getElementById("engine-tools");
  var readoutEl = document.getElementById("engine-readout");
  var witnessEl = document.getElementById("engine-witness");

  function setReadout() {
    if (readoutEl) readoutEl.innerHTML = "<b>" + organLabel(state.study) + "</b> &middot; reading the " + state.specimen + " &middot; seed <span class='es'>" + state.seed + "</span>";
  }
  function pausePlay(p) { state.auto = !p ? false : true; }
  function userTouched() { // the viewer is playing → stop autoplay, resume after a long idle
    state.auto = false; setAutoBtn();
    clearTimeout(idleTimer); clearTimeout(holdTimer);
    idleTimer = setTimeout(function () { state.auto = !reduced; setAutoBtn(); if (state.auto) onSettled(); }, 30000);
  }

  var autoBtn;
  function setAutoBtn() { if (autoBtn) { autoBtn.textContent = state.auto ? "❚❚ playing" : "▶ paused"; autoBtn.setAttribute("aria-pressed", String(state.auto)); } }

  function mkBtn(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "etool-btn"; b.textContent = label; b.title = title;
    b.addEventListener("click", function () { fn(b); });
    return b;
  }

  function buildTools() {
    if (!tools) return;
    tools.innerHTML = "";

    // organ chips
    var organRow = document.createElement("div"); organRow.className = "etool-row etool-organs";
    ORGANS.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "etool-chip"; b.textContent = o.label; b.setAttribute("data-organ", o.id);
      b.addEventListener("click", function () { userTouched(); state.study = o.id; state.seed = newSeed(); transition(draw); syncTools(); });
      organRow.appendChild(b);
    });
    tools.appendChild(organRow);

    // palette swatches + wildness + actions
    var ctrlRow = document.createElement("div"); ctrlRow.className = "etool-row etool-ctrls";

    var palWrap = document.createElement("div"); palWrap.className = "etool-pals";
    PALS.forEach(function (pid) {
      var sw = document.createElement("button");
      sw.type = "button"; sw.className = "etool-sw"; sw.setAttribute("data-pal", pid); sw.title = pid;
      var cols = A.PALETTES[pid] || [];
      sw.style.background = "linear-gradient(135deg," + cols.join(",") + ")";
      sw.addEventListener("click", function () { userTouched(); state.palette = pid; draw(); syncTools(); });
      palWrap.appendChild(sw);
    });
    ctrlRow.appendChild(palWrap);

    var wWrap = document.createElement("label"); wWrap.className = "etool-wild";
    wWrap.innerHTML = "<span>wild</span>";
    var slider = document.createElement("input");
    slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.value = String(Math.round(state.wild * 100));
    slider.className = "etool-range"; slider.setAttribute("aria-label", "Wildness");
    slider.addEventListener("input", function () { userTouched(); state.wild = (+slider.value) / 100; draw(); });
    wWrap.appendChild(slider); ctrlRow.appendChild(wWrap);

    var actions = document.createElement("div"); actions.className = "etool-actions";
    actions.appendChild(mkBtn("↻", "Reseed — a new draw of the same recipe", function () { userTouched(); state.seed = newSeed(); transition(draw); setReadout(); }));
    autoBtn = mkBtn("❚❚ playing", "Play / pause the endless drift", function () { state.auto = !state.auto; setAutoBtn(); if (state.auto) { clearTimeout(idleTimer); onSettled(); } else clearTimeout(holdTimer); });
    autoBtn.classList.add("etool-auto"); actions.appendChild(autoBtn);
    actions.appendChild(mkBtn("◉ witness", "Witness this drawing's geometry (SHA-256) — re-derivable, never trusted", doWitness));
    actions.appendChild(mkBtn("↓ plot", "Download as a re-derivable pen-plot SVG", doDownload));
    ctrlRow.appendChild(actions);

    tools.appendChild(ctrlRow);
    syncTools(); setAutoBtn();
  }

  function syncTools() {
    if (!tools) return;
    tools.querySelectorAll(".etool-chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-organ") === state.study)); });
    tools.querySelectorAll(".etool-sw").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-pal") === state.palette); });
    setReadout();
  }

  // ── the two capabilities: witness + plot (dogfooding the accountability) ──
  function plotOpt() {
    if (!finalStrokes.length) return null;
    var clean = finalStrokes.map(function (s) { return { pts: s.pts, col: s.col, w: s.w }; });
    try { return A.optimizeForPlot(clean, { tol: 0.0007 }); } catch (e) { return null; }
  }
  function doWitness() {
    if (!witnessEl) return;
    var opt = plotOpt();
    if (!opt || !window.Spine) { witnessEl.textContent = "nothing to witness yet"; return; }
    witnessEl.innerHTML = "witnessing…";
    var svg = A.plotSVG(opt, ""), i = svg.indexOf('<g fill="none"'), j = svg.lastIndexOf("</svg>");
    var geom = (i >= 0 && j > i) ? svg.slice(i, j) : svg;
    window.Spine.witness(geom).then(function (h) {
      witnessEl.innerHTML = h
        ? "witness <span class='ew'>" + h.slice(0, 16) + "…</span> &middot; this exact drawing re-derives from <span class='es'>" + state.seed + "</span>"
        : "witness unavailable in this context";
    });
  }
  function doDownload() {
    var opt = plotOpt(); if (!opt) return;
    var meta = "endless engine drawing\nstudy=" + state.study + " specimen=" + state.specimen +
      " palette=" + state.palette + " seed=" + state.seed + " wild=" + Math.round(state.wild * 100) + "\n" +
      "drawn live at harperz9.github.io — the same engine the atelier witnesses. github.com/HarperZ9";
    var svg = A.plotSVG(opt, meta);
    var blob = new Blob([svg], { type: "image/svg+xml" }), url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "endless-" + state.study + "-" + state.seed + ".svg";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // ── pointer life: parallax while hovering, click to move on ──
  var wrap = document.getElementById("engine-live") || canvas;
  if (!reduced) {
    wrap.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      canvas.style.transform = "translate(" + (dx * -16).toFixed(1) + "px," + (dy * -16).toFixed(1) + "px) scale(1.035)";
    });
    wrap.addEventListener("pointerleave", function () { canvas.style.transform = "translate(0,0) scale(1)"; });
  }
  canvas.addEventListener("click", function () { userTouched(); state.seed = newSeed(); transition(draw); setReadout(); });

  // pause the loop when scrolled off-screen (perf + battery)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { if (state.auto && settled) onSettled(); }
        else { clearTimeout(holdTimer); if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
      });
    }, { threshold: 0.12 }).observe(canvas);
  }

  var rtimer = 0;
  window.addEventListener("resize", function () { clearTimeout(rtimer); rtimer = setTimeout(function () { A.paintRich(ctx, size()[0], size()[1], finalStrokes, curField, state.palette); }, 180); });

  // ── boot ──
  function start() { buildTools(); draw(); }
  if (A.STUDIES && A.STUDIES.length) start();
  else { var w = 0, iv = setInterval(function () { if ((window.Atelier && window.Atelier.STUDIES) || w++ > 40) { clearInterval(iv); A = window.Atelier || A; if (A && A.STUDIES) start(); } }, 80); }
})();
