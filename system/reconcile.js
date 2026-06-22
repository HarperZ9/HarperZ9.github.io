/* system/reconcile.js — the grounding the atelier lacked.

   The atelier already WITNESSES provenance (does a plotted file re-derive from its seed,
   via system/spine.js). This adds the other half: JUDGMENT — score a drawing's OUTPUT against
   criteria it did NOT author (balance / coverage / contrast / complexity), plus NOVELTY against
   a living localStorage corpus, combined by COHESION (harmonic mean — one weak axis tanks it).
   Ported from studio-engine's verification spine. Zero dependencies; attaches to window.Reconcile.

   A drawing is no longer just "what its seed says" — it now carries a re-checkable verdict
   against properties it didn't choose. Provenance + judgment = the full reconcile, in the browser. */
(function () {
  "use strict";

  var G = 20;  // feature grid resolution (matches studio-engine)
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ── features: read all stroke points as a point cloud in [0,1]^2 ──────────────
  function features(strokes) {
    var cells = new Float64Array(G * G), n = 0, sx = 0, sy = 0;
    for (var i = 0; i < strokes.length; i++) {
      var pts = strokes[i].pts || [];
      for (var j = 0; j < pts.length; j++) {
        var x = clamp(pts[j][0], 0, 1), y = clamp(pts[j][1], 0, 1);
        sx += x; sy += y; n++;
        var gx = clamp(Math.floor(x * G), 0, G - 1), gy = clamp(Math.floor(y * G), 0, G - 1);
        cells[gy * G + gx]++;
      }
    }
    if (!n) return { coverage: 0, centroid_offset: 1, contrast: 0, entropy: 0 };
    var touched = 0, mean = n / (G * G), varAcc = 0;
    for (var c = 0; c < cells.length; c++) { if (cells[c] > 0) touched++; var d = cells[c] - mean; varAcc += d * d; }
    var coverage = touched / (G * G);
    var centroid_offset = clamp(2 * Math.hypot(sx / n - 0.5, sy / n - 0.5), 0, 1);
    var contrast = clamp((Math.sqrt(varAcc / cells.length) / (mean + 1e-9)) / 3, 0, 1);
    var ent = 0;
    for (var c2 = 0; c2 < cells.length; c2++) { if (cells[c2] > 0) { var p = cells[c2] / n; ent -= p * Math.log(p); } }
    var entropy = clamp(ent / Math.log(cells.length), 0, 1);
    return { coverage: coverage, centroid_offset: centroid_offset, contrast: contrast, entropy: entropy };
  }

  // ── criteria: each scores 0..1, higher = better fit to a property the study didn't author ──
  var CRIT = {
    balance: function (f) { return clamp(1 - f.centroid_offset, 0, 1); },          // centred mass
    coverage: function (f) { return clamp(f.coverage, 0, 1); },                    // even fill
    contrast: function (f) { return clamp(f.contrast, 0, 1); },                    // dynamic range
    complexity: function (f) { return clamp(1 - Math.abs(f.entropy - 0.8) / 0.8, 0, 1); }, // entropy sweet spot
    clean_freq: function (f, p) { var v = (p && p.freq != null) ? p.freq : 6; return clamp(1 - Math.min(0.5, Math.abs(v - Math.round(v))) / 0.5, 0, 1); },
    fivefold: function (f, p) { var w = (p && p.waves != null) ? Math.round(p.waves) : 5; return clamp(1 - Math.abs(w - 5) * 0.2, 0, 1); }
  };

  // axes per study. Point/line studies use the density-contrast axis (it's meaningful when mass
  // varies); dense even contour-fields don't (they're uniform by nature), so field studies are
  // judged on coverage/complexity/balance + their own structural axis instead.
  var AXES = {
    _default: ["balance", "coverage", "contrast", "complexity"],
    gyroid: ["clean_freq", "coverage", "complexity"],
    quasicrystal: ["fivefold", "coverage", "complexity"],
    rings: ["coverage", "complexity", "balance"],
    moire: ["coverage", "complexity", "balance"]
  };
  function axesFor(study) { return AXES[study] || AXES._default; }

  function cohesion(scores) {
    if (!scores.length) return 0;
    var s = 0; for (var i = 0; i < scores.length; i++) s += 1 / clamp(scores[i], 1e-6, 1);
    return scores.length / s;  // harmonic mean
  }
  function tag(s, target, floor) {
    target = target || 0.9; floor = floor || 0.55;
    return s >= target ? "verified" : (s >= floor ? "unverifiable" : "refuted");
  }

  // ── corpus: a living gallery in localStorage; novelty = distance from prior saved work ──
  var KEY = "atelier.corpus.v1", DIAG = 2.0 /* sqrt(4) */, CAP = 240;
  function corpusGet() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function vec(f) { return [f.coverage, f.centroid_offset, f.contrast, f.entropy]; }
  function novelty(f) {
    var c = corpusGet(); if (!c.length) return 1;
    var v = vec(f), dmin = Infinity;
    for (var i = 0; i < c.length; i++) {
      var u = c[i], d = 0; for (var k = 0; k < 4; k++) { var e = v[k] - (u[k] || 0); d += e * e; }
      d = Math.sqrt(d); if (d < dmin) dmin = d;
    }
    return clamp(dmin / DIAG, 0, 1);
  }
  function remember(f) {
    try { var c = corpusGet(); c.push(vec(f)); if (c.length > CAP) c = c.slice(c.length - CAP); localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }

  // ── the reconcile: features -> per-axis margins + novelty -> cohesion -> verdict ──
  function reconcile(study, params, strokes) {
    var f = features(strokes), axes = axesFor(study), margins = {};
    for (var i = 0; i < axes.length; i++) margins[axes[i]] = CRIT[axes[i]](f, params);
    margins.novelty = novelty(f);
    var vals = [], weakest = null, wv = Infinity;
    for (var a in margins) { vals.push(margins[a]); if (margins[a] < wv) { wv = margins[a]; weakest = a; } }
    var coh = cohesion(vals);
    return { features: f, margins: margins, cohesion: coh, weakest: weakest, tag: tag(coh), axes: axes.concat(["novelty"]) };
  }

  // ── optional UI helper: render a verdict into a DOM node ──
  function renderInto(node, verdict) {
    if (!node || !verdict) return;
    var rows = "";
    for (var i = 0; i < verdict.axes.length; i++) {
      var a = verdict.axes[i], v = verdict.margins[a] || 0, weak = (a === verdict.weakest);
      rows += '<div class="rc-axis' + (weak ? ' rc-weak' : '') + '">'
        + '<span class="rc-name">' + a + (weak ? ' ◀' : '') + '</span>'
        + '<span class="rc-bar"><span class="rc-fill" style="width:' + Math.round(v * 100) + '%"></span></span>'
        + '<span class="rc-val">' + v.toFixed(3) + '</span></div>';
    }
    node.innerHTML = '<div class="rc-head">cohesion <b>' + verdict.cohesion.toFixed(3) + '</b> '
      + '<span class="rc-tag rc-' + verdict.tag + '">' + verdict.tag + '</span></div>' + rows;
  }

  window.Reconcile = {
    features: features, reconcile: reconcile, cohesion: cohesion, novelty: novelty,
    remember: remember, corpusGet: corpusGet, renderInto: renderInto, axesFor: axesFor, tag: tag
  };
})();
