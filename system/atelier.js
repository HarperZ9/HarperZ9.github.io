/* system/atelier.js: the algorithmic drawing instrument for harperz9.github.io
   Zero dependencies. Every line is generated at runtime and deterministic from a
   stated seed: same (algorithm, specimen, complexity, palette, seed) → identical
   drawing. Four studies, each rooted in one of the macro photographs:
       phyllotaxis (snail) · flow field (dandelion) · differential growth
       (seedhead) · venation (mallow).
   A photograph, when chosen, is read as a field of light (luminance + gradient +
   edge-importance) and the algorithm bends to it, so the specimen surfaces in the
   strokes. Output renders to a 2D canvas and exports to plotter-ready SVG.

   Coordinate space is normalised [0,1]×[0,1]; the renderer maps it to canvas
   pixels and the exporter maps it to a 1000-unit SVG viewBox, so a drawing and
   its exported vector are the same geometry. Stroke widths are stated in
   1000-unit space.                                                              */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad, the golden angle

  // ── small math ──────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function mixAngle(a, b, t) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }

  // ── seeded RNG: xmur3 (string→seed) + mulberry32 ────────────────────────────
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) { var s = xmur3(String(seedStr)); return mulberry32(s()); }
  function randomSeed() {
    var hex = "0123456789abcdef", s = "";
    for (var i = 0; i < 6; i++) s += hex[(Math.random() * 16) | 0];
    return s;
  }

  // ── colour ──────────────────────────────────────────────────────────────────
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbCss(c) { return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; }
  function lerpRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function makePalette(arr) {
    var rgbs = arr.map(hexToRgb);
    return {
      mono: rgbs.length === 1,
      sample: function (t) {
        t = clamp(t, 0, 1);
        if (rgbs.length === 1) return rgbCss(rgbs[0]);
        var f = t * (rgbs.length - 1), i = Math.floor(f), fr = f - i;
        if (i >= rgbs.length - 1) return rgbCss(rgbs[rgbs.length - 1]);
        return rgbCss(lerpRgb(rgbs[i], rgbs[i + 1], fr));
      }
    };
  }
  var PALETTES = {
    spectrum: ["#4fa98e", "#3f857a", "#efab30", "#df5e00", "#ecdcc0"],
    ember: ["#7c3100", "#df5e00", "#efab30", "#f6cf8f"],
    cool: ["#2c4a47", "#476762", "#5fae93", "#cfe0d2"],
    chitin: ["#1c1a0f", "#46451d", "#897a2b", "#bb9c3c", "#e6dca0"],   // carapace: umber → olive-gold → chitin
    marrow: ["#22131a", "#5c2622", "#9c4f38", "#c99a78", "#efe3cf"],   // anatomical: iron → oxblood → rust → bone
    verdigris: ["#15190f", "#39401e", "#6e6a2c", "#4f9c72", "#cfe6c2"],// patina: bronze → olive → oxidised copper-green
    biolume: ["#0a0e1a", "#163150", "#1f7e90", "#43d2b2", "#dafff2"],  // deep-sea: indigo → teal → electric cyan glow
    mono: ["#e9e2d0"]
  };

  // ── seeded value noise (for the flow field) ─────────────────────────────────
  function makeNoise(rng) {
    var salt = rng() * 1000 + 7;
    function hash(xi, yi) { var h = Math.sin((xi * 127.1 + yi * 311.7 + salt)) * 43758.5453; return h - Math.floor(h); }
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y) { var s = 0, a = 0.5, f = 1; for (var i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
    return { vnoise: vnoise, fbm: fbm };
  }

  // ── field builder: luminance + gradient + edge-importance sampling ──────────
  // Shared by photo-load, user-upload, and live-camera capture. Any luminance
  // grid becomes the same field interface the algorithms consume.
  function buildField(lum, S) {
    var cdf = new Float32Array(S * S), acc = 0;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var xl = x > 0 ? x - 1 : 0, xr = x < S - 1 ? x + 1 : S - 1;
      var yt = y > 0 ? y - 1 : 0, yb = y < S - 1 ? y + 1 : S - 1;
      var gx = lum[y * S + xr] - lum[y * S + xl], gy = lum[yb * S + x] - lum[yt * S + x];
      acc += Math.sqrt(gx * gx + gy * gy) + 0.0025; cdf[y * S + x] = acc;
    }
    var total = acc;
    function bil(map, x, y) {
      var fx = clamp(x, 0, 0.999999) * (S - 1), fy = clamp(y, 0, 0.999999) * (S - 1);
      var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(S - 1, x0 + 1), y1 = Math.min(S - 1, y0 + 1);
      var tx = fx - x0, ty = fy - y0;
      var a = map[y0 * S + x0], b = map[y0 * S + x1], cc = map[y1 * S + x0], d = map[y1 * S + x1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
    }
    function sIdx(u) { var lo = 0, hi = S * S - 1, target = u * total; while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid + 1; else hi = mid; } return lo; }
    return {
      size: S,
      lum: function (x, y) { return bil(lum, x, y); },
      grad: function (x, y) { var e = 1.5 / S; return [bil(lum, x + e, y) - bil(lum, x - e, y), bil(lum, x, y + e) - bil(lum, x, y - e)]; },
      sampleEdge: function (rng) { var idx = sIdx(rng()); return [((idx % S) + rng()) / S, (((idx / S) | 0) + rng()) / S]; }
    };
  }
  // luminance grid from any drawable source (Image / video / canvas), cover-fit into SxS
  function lumFromSource(src, iw, ih, S) {
    var c = document.createElement("canvas"); c.width = S; c.height = S;
    var g = c.getContext("2d", { willReadFrequently: true });
    var sc = Math.max(S / iw, S / ih), dw = iw * sc, dh = ih * sc;
    g.drawImage(src, (S - dw) / 2, (S - dh) / 2, dw, dh);
    var data;
    try { data = g.getImageData(0, 0, S, S).data; } catch (e) { return null; }
    var lum = new Float32Array(S * S);
    for (var i = 0; i < S * S; i++) lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    return lum;
  }
  var FIELD_CACHE = {};
  function loadField(src, cb) {
    if (FIELD_CACHE[src]) { cb(FIELD_CACHE[src]); return; }
    var img = new Image();
    img.onload = function () {
      var lum = lumFromSource(img, img.naturalWidth, img.naturalHeight, 220);
      if (!lum) { cb(null); return; }
      var field = buildField(lum, 220);
      FIELD_CACHE[src] = field;
      cb(field);
    };
    img.onerror = function () { cb(null); };
    img.src = src;
  }

  // ============================================================================
  // STUDIES: each build(rng, P, field) returns either
  //   { live:false, strokes:[ {pts:[[x,y]…], col, w, op, close?} … ] }
  // or a live simulation
  //   { live:true, step():bool-done, strokes():[…] }
  // ============================================================================

  // ── per-study parameters: the algorithm's own knobs, exposed and WITNESSED ──
  // Each maps to a fixed constant in the build; default = today's value, so a
  // drawing left at defaults is byte-identical to before (old files still verify).
  // Non-default values append to the seed-key, the URL and the SVG metadata.
  var STUDY_PARAMS = {
    phyllotaxis: { params: [
        { k: "spread", label: "Spread", min: 0.28, max: 0.49, step: 0.01, def: 0.46 },
        { k: "dot", label: "Seed size", min: 0.001, max: 0.008, step: 0.0002, def: 0.0046 },
        { k: "warp", label: "Warp", min: 0, max: 0.7, step: 0.02, def: 0 }],
      presets: [{ label: "Tight", p: { spread: 0.32 } }, { label: "Open", p: { spread: 0.49, dot: 0.006 } }, { label: "Wild", p: { warp: 0.46, spread: 0.49 } }] },
    flow: { params: [
        { k: "len", label: "Stroke length", min: 60, max: 198, step: 6, def: 132 },
        { k: "reach", label: "Step reach", min: 0.002, max: 0.008, step: 0.0002, def: 0.0046 }],
      presets: [{ label: "Calm", p: { len: 90 } }, { label: "Storm", p: { len: 186, reach: 0.006 } }] },
    growth: { params: [
        { k: "repel", label: "Repulsion", min: 0.014, max: 0.045, step: 0.001, def: 0.027 },
        { k: "rate", label: "Growth rate", min: 0.0005, max: 0.002, step: 0.0001, def: 0.0011 }],
      presets: [{ label: "Coral", p: { repel: 0.038, rate: 0.0014 } }, { label: "Wiry", p: { repel: 0.018 } }] },
    venation: { params: [
        { k: "reach", label: "Vein reach", min: 0.07, max: 0.24, step: 0.005, def: 0.15 },
        { k: "step", label: "Step", min: 0.004, max: 0.012, step: 0.0002, def: 0.0072 }],
      presets: [{ label: "Fine", p: { step: 0.005, reach: 0.11 } }, { label: "Bold", p: { reach: 0.21 } }] },
    reaction: { params: [
        { k: "diffuse", label: "V diffusion", min: 0.05, max: 0.1, step: 0.002, def: 0.08 },
        { k: "bands", label: "Contour bands", min: 2, max: 5, step: 1, def: 3 },
        { k: "mask", label: "Bloom on specimen", min: 0, max: 1, step: 0.05, def: 0 }],
      presets: [{ label: "Spots", p: { diffuse: 0.062 } }, { label: "Maze", p: { diffuse: 0.088, bands: 4 } }, { label: "Bloom", p: { mask: 0.82, bands: 4 } }] },
    physarum: { params: [
        { k: "sense", label: "Sensor angle", min: 0.2, max: 0.8, step: 0.02, def: 0.4 },
        { k: "decay", label: "Trail decay", min: 0.82, max: 0.95, step: 0.01, def: 0.9 }],
      presets: [{ label: "Tendril", p: { sense: 0.28, decay: 0.93 } }, { label: "Web", p: { sense: 0.6, decay: 0.86 } }] },
    boids: { params: [
        { k: "cohesion", label: "Cohesion", min: 0.2, max: 1.8, step: 0.05, def: 0.9 },
        { k: "separate", label: "Separation", min: 0.6, max: 3.0, step: 0.05, def: 1.6 }],
      presets: [{ label: "Murmuration", p: { cohesion: 1.3, separate: 1.1 } }, { label: "Scatter", p: { cohesion: 0.4, separate: 2.6 } }] },
    orbital: { params: [
        { k: "n", label: "Principal n", min: 1, max: 4, step: 1, def: 3 },
        { k: "l", label: "Azimuthal l", min: 0, max: 3, step: 1, def: 2 }],
      presets: [{ label: "2p", p: { n: 2, l: 1 } }, { label: "3d", p: { n: 3, l: 2 } }, { label: "4f", p: { n: 4, l: 3 } }] },
    hilbert: { params: [
        { k: "order", label: "Order", min: 4, max: 7, step: 1, def: 5 },
        { k: "chamfer", label: "Corner bevel", min: 0, max: 0.45, step: 0.05, def: 0 }],
      presets: [{ label: "Weave", p: { chamfer: 0.3 } }, { label: "Dense", p: { order: 7 } }] },
    binomial: { params: [
        { k: "rows", label: "Rows", min: 16, max: 128, step: 16, def: 64 },
        { k: "mod", label: "Modulus", min: 2, max: 9, step: 1, def: 2 }],
      presets: [{ label: "Gasket", p: { mod: 2 } }, { label: "Mod 3", p: { mod: 3, rows: 96 } }, { label: "Mod 5", p: { mod: 5, rows: 128 } }] },
    harmonograph: { params: [
        { k: "detune", label: "Detune", min: 0.08, max: 0.9, step: 0.02, def: 0.42 },
        { k: "decay", label: "Damping", min: 0.05, max: 0.6, step: 0.01, def: 0.26 }],
      presets: [{ label: "Lissajous", p: { detune: 0.1, decay: 0.07 } }, { label: "Unwound", p: { detune: 0.74, decay: 0.42 } }] },
    gosper: { params: [
        { k: "iters", label: "Iterations", min: 2, max: 5, step: 1, def: 4 },
        { k: "twist", label: "Hex turn", min: 0, max: 5, step: 1, def: 0 }],
      presets: [{ label: "Island", p: { iters: 3 } }, { label: "Coastline", p: { iters: 5 } }] },
    lsystem: { params: [
        { k: "angle", label: "Branch angle", min: 0.18, max: 0.62, step: 0.02, def: 0.42 },
        { k: "depth", label: "Recursion depth", min: 3, max: 6, step: 1, def: 5 }],
      presets: [{ label: "Fern", p: { angle: 0.3, depth: 6 } }, { label: "Bramble", p: { angle: 0.58, depth: 5 } }] },
    voronoi: { params: [
        { k: "sites", label: "Seeds", min: 40, max: 220, step: 20, def: 120 },
        { k: "relax", label: "Lloyd relax", min: 0, max: 3, step: 1, def: 1 }],
      presets: [{ label: "Foam", p: { sites: 80, relax: 2 } }, { label: "Dense", p: { sites: 220, relax: 1 } }] },
    dragon: { params: [
        { k: "iters", label: "Folds", min: 8, max: 14, step: 1, def: 12 },
        { k: "twist", label: "Quarter-turn", min: 0, max: 3, step: 1, def: 0 }],
      presets: [{ label: "Classic", p: { iters: 12 } }, { label: "Dense", p: { iters: 14, twist: 1 } }] },
    koch: { params: [
        { k: "depth", label: "Depth", min: 2, max: 5, step: 1, def: 4 },
        { k: "sides", label: "Sides", min: 3, max: 6, step: 1, def: 3 }],
      presets: [{ label: "Snowflake", p: { depth: 4, sides: 3 } }, { label: "Hexagon", p: { depth: 3, sides: 6 } }] },
    dla: { params: [
        { k: "stick", label: "Stickiness", min: 0.2, max: 1.0, step: 0.1, def: 1.0 },
        { k: "spawn", label: "Spawn slack", min: 2, max: 12, step: 1, def: 5 }],
      presets: [{ label: "Dense", p: { stick: 0.3, spawn: 3 } }, { label: "Open", p: { spawn: 10 } }] },
    penrose: { params: [
        { k: "iters", label: "Deflations", min: 3, max: 6, step: 1, def: 5 },
        { k: "twist", label: "Fifth-turn", min: 0, max: 4, step: 1, def: 0 }],
      presets: [{ label: "Sun", p: { iters: 4 } }, { label: "Quasicrystal", p: { iters: 6, twist: 2 } }] },
    lightning: { params: [
        { k: "branch", label: "Fork chance", min: 0.1, max: 0.7, step: 0.05, def: 0.35 },
        { k: "jitter", label: "Displacement", min: 0.08, max: 0.4, step: 0.02, def: 0.22 }],
      presets: [{ label: "Bolt", p: { branch: 0.15, jitter: 0.16 } }, { label: "Lichtenberg", p: { branch: 0.6, jitter: 0.34 } }] },
    maurer: { params: [
        { k: "n", label: "Petals", min: 2, max: 13, step: 1, def: 6 },
        { k: "d", label: "Walk step", min: 11, max: 359, step: 2, def: 71 }],
      presets: [{ label: "Cobweb", p: { n: 5, d: 97 } }, { label: "Star web", p: { n: 7, d: 131 } }] },
    clifford: { params: [
        { k: "a", label: "Coeff a", min: -2.2, max: 2.2, step: 0.1, def: 1.7 },
        { k: "b", label: "Coeff b", min: -2.2, max: 2.2, step: 0.1, def: -1.8 }],
      presets: [{ label: "Mantle", p: { a: -1.7, b: 1.8 } }, { label: "Wings", p: { a: -1.4, b: 1.6 } }] },
    gyroid: { params: [
        { k: "freq", label: "Frequency", min: 2, max: 12, step: 0.5, def: 7 },
        { k: "z", label: "Z-slice", min: 0, max: 1, step: 0.05, def: 0.3 }],
      presets: [{ label: "Clean", p: { freq: 8 } }, { label: "Detuned", p: { freq: 6.5 } }] },
    quasicrystal: { params: [
        { k: "waves", label: "Plane waves", min: 3, max: 9, step: 1, def: 5 },
        { k: "scale", label: "Scale", min: 4, max: 12, step: 0.5, def: 8 }],
      presets: [{ label: "Five-fold", p: { waves: 5 } }, { label: "Seven", p: { waves: 7 } }] },
    rings: { params: [
        { k: "freq", label: "Frequency", min: 3, max: 16, step: 0.5, def: 8 }],
      presets: [{ label: "Wide", p: { freq: 5 } }, { label: "Fine", p: { freq: 13 } }] },
    moire: { params: [
        { k: "freq", label: "Frequency", min: 6, max: 22, step: 1, def: 12 },
        { k: "angle", label: "Angle", min: 0.1, max: 1.4, step: 0.05, def: 0.4 }],
      presets: [{ label: "Loose", p: { angle: 0.2 } }, { label: "Beat", p: { angle: 0.9 } }] },
    flowfield: { params: [
        { k: "scale", label: "Scale", min: 2, max: 9, step: 0.5, def: 4.5 },
        { k: "warp", label: "Warp", min: 0, max: 3, step: 0.1, def: 1.2 }],
      presets: [{ label: "Calm", p: { warp: 0.4 } }, { label: "Swirl", p: { warp: 2.4 } }] },
    turbulence: { params: [
        { k: "freq", label: "Base freq", min: 1.5, max: 6, step: 0.5, def: 3 },
        { k: "octaves", label: "Octaves", min: 2, max: 6, step: 1, def: 4 },
        { k: "gain", label: "Gain", min: 0.35, max: 0.7, step: 0.05, def: 0.55 }],
      presets: [{ label: "Soft", p: { octaves: 2 } }, { label: "Rough", p: { octaves: 6, gain: 0.65 } }] },
    metaballs: { params: [
        { k: "count", label: "Charges", min: 3, max: 9, step: 1, def: 5 },
        { k: "spread", label: "Radius", min: 0.15, max: 0.5, step: 0.01, def: 0.34 },
        { k: "bands", label: "Bands", min: 3, max: 10, step: 1, def: 7 }],
      presets: [{ label: "Few", p: { count: 3, bands: 5 } }, { label: "Swarm", p: { count: 9, spread: 0.26, bands: 8 } }] }
  };
  function studyParams(id) { return (STUDY_PARAMS[id] && STUDY_PARAMS[id].params) || []; }
  function studyPresets(id) { return (STUDY_PARAMS[id] && STUDY_PARAMS[id].presets) || []; }
  function pget(P, k, def) { var v = P && P.params ? P.params[k] : null; return (v == null || isNaN(v)) ? def : v; }
  function pcanon(v) { return Math.round((+v) * 1e4) / 1e4; }
  function defParams(id) { var sc = studyParams(id), o = {}; for (var i = 0; i < sc.length; i++) o[sc[i].k] = pcanon(sc[i].def); return o; }
  function paramStr(id, params) {
    var sc = studyParams(id), out = [];
    for (var i = 0; i < sc.length; i++) {
      var k = sc[i].k, v = pcanon(params && params[k] != null ? params[k] : sc[i].def);
      if (v !== pcanon(sc[i].def)) out.push(k + ":" + v);
    }
    return out.join(",");
  }
  function pkey(id, params) { var s = paramStr(id, params); return s ? "|" + s : ""; }
  function parseParamStr(id, s) {
    var sc = studyParams(id), valid = {}, o = {}; for (var i = 0; i < sc.length; i++) valid[sc[i].k] = sc[i];
    if (s) s.split(",").forEach(function (pair) { var kv = pair.split(":"), k = kv[0], v = parseFloat(kv[1]); if (valid[k] && !isNaN(v)) o[k] = pcanon(clamp(v, valid[k].min, valid[k].max)); });
    return o;
  }

  // 1 ── PHYLLOTAXIS: Vogel's spiral, Fibonacci parastichy arms (the snail) ────
  function buildPhyllotaxis(rng, P, field) {
    var N = Math.round(lerp(460, 2000, P.complexity));
    var cx = 0.5, cy = 0.5, maxR = pget(P, "spread", 0.46), c = maxR / Math.sqrt(N);
    var pal = P.palette, pts = [];
    // Warp (default 0 → byte-identical to before): a seeded domain-warp that grows
    // OUTWARD, so the core stays a tight Vogel spiral and the arms wander like real
    // growth, then bend along the photograph's own gradient so the specimen surfaces
    // in the distortion instead of sitting under a mechanical lattice.
    var warp = pget(P, "warp", 0), wn = warp > 0 ? makeNoise(rng) : null;
    for (var i = 0; i < N; i++) {
      var r = c * Math.sqrt(i + 0.5), th = i * GOLDEN + (rng() - 0.5) * 0.012;
      var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      if (wn) {
        var amp = warp * r * (0.5 + 0.85 * r / maxR);              // displacement scales with radius → wild tips, calm core
        var nx = wn.fbm(x * 2.15 + 13.1, y * 2.15 + 4.7) - 0.5, ny = wn.fbm(x * 2.15 + 71.3, y * 2.15 + 39.2) - 0.5;
        var gg = field ? field.grad(x, y) : [0, 0];                // bend perpendicular to the gradient → flow ALONG the specimen's edges (bounded so a bright centre can't knot)
        var gx = clamp(gg[1], -0.32, 0.32), gy = clamp(gg[0], -0.32, 0.32);
        x += amp * (1.55 * nx - 0.95 * gx); y += amp * (1.55 * ny + 0.95 * gy);
      }
      var l = field ? field.lum(x, y) : (1 - r / maxR);
      pts.push({ x: x, y: y, r: r, lum: clamp(l, 0, 1) });
    }
    // choose a spread of Fibonacci families so the arms interlock
    var fibs = [5, 8, 13, 21, 34, 55, 89], avail = [];
    for (var fi = 0; fi < fibs.length; fi++) if (fibs[fi] < N / 6) avail.push(fibs[fi]);
    var fam = [];
    if (avail.length) {
      var want = 2 + Math.round(P.complexity * 2); // 2–4 families
      for (var w = 0; w < want && avail.length; w++) {
        var idx = Math.round((avail.length - 1) * (w / Math.max(1, want - 1)));
        if (fam.indexOf(avail[idx]) < 0) fam.push(avail[idx]);
      }
    }
    if (!fam.length) fam = [1];
    var strokes = [], RUN = 5;
    for (var f = 0; f < fam.length; f++) {
      var k = fam[f], wBase = lerp(0.6, 1.4, f / Math.max(1, fam.length - 1));
      for (var o = 0; o < k; o++) {
        var idxs = []; for (var j = o; j < N; j += k) idxs.push(j);
        if (idxs.length < 2) continue;
        // colour each short run by its LOCAL brightness, so the specimen surfaces along the arms
        for (var c0 = 0; c0 < idxs.length - 1; c0 += RUN) {
          var run = [], ll = 0, cnt = 0, end = Math.min(idxs.length - 1, c0 + RUN);
          for (var c1 = c0; c1 <= end; c1++) { var pp = pts[idxs[c1]]; run.push([pp.x, pp.y]); ll += pp.lum; cnt++; }
          if (run.length < 2) continue;
          ll /= cnt; var lc = ll * ll * (3 - 2 * ll);
          strokes.push({ pts: run, col: pal.sample(clamp(ll * 1.08, 0, 1)), w: wBase, op: 0.07 + 0.74 * lc });
        }
      }
    }
    // seed packing: tiny octagon dots, brightness from the photo
    var dotStep = N > 1300 ? 2 : 1;
    for (var d = 0; d < N; d += dotStep) {
      var p = pts[d]; if (p.lum < 0.16) continue;
      var rad = 0.0014 + pget(P, "dot", 0.0046) * p.lum, ring = [];
      for (var a = 0; a <= 8; a++) { var an = a / 8 * TAU; ring.push([p.x + rad * Math.cos(an), p.y + rad * Math.sin(an)]); }
      strokes.push({ pts: ring, col: pal.sample(clamp(p.lum * 0.92 + 0.16, 0, 1)), w: 0.6, op: 0.18 + 0.62 * p.lum, close: true });
    }
    return { live: false, strokes: strokes };
  }

  // 2 ── FLOW FIELD: particles through warped noise, bent to the photo (dandelion)
  function buildFlow(rng, P, field) {
    var noise = makeNoise(rng);
    var M = Math.round(lerp(620, 2500, P.complexity));
    var steps = pget(P, "len", 132) | 0, stepLen = pget(P, "reach", 0.0046);
    var freq = 2.1 + 1.6 * rng(), warp = 0.55 + 0.4 * rng();
    var cx = 0.5, cy = 0.5, radial = field ? 0.18 : 0.34;
    var pal = P.palette, strokes = [];
    function baseAngle(x, y) {
      var wx = x + warp * (noise.fbm(x * freq + 3.1, y * freq + 1.7) - 0.5);
      var wy = y + warp * (noise.fbm(x * freq + 8.2, y * freq + 6.4) - 0.5);
      var ang = noise.fbm(wx * freq, wy * freq) * TAU * 1.6;
      var ra = Math.atan2(y - cy, x - cx);
      return mixAngle(ang, ra, radial);
    }
    for (var m = 0; m < M; m++) {
      var sx, sy;
      if (field) { var sp = field.sampleEdge(rng); sx = sp[0]; sy = sp[1]; }
      else { var rr = 0.46 * Math.sqrt(rng()), aa = rng() * TAU; sx = cx + rr * Math.cos(aa); sy = cy + rr * Math.sin(aa); }
      var x = sx, y = sy, path = [[x, y]];
      var startLum = field ? field.lum(x, y) : (1 - Math.hypot(x - cx, y - cy) / 0.48);
      for (var s = 0; s < steps; s++) {
        var ang = baseAngle(x, y);
        if (field) {
          var g = field.grad(x, y), gm = Math.hypot(g[0], g[1]);
          if (gm > 1e-4) ang = mixAngle(ang, Math.atan2(g[1], g[0]) + Math.PI / 2, clamp(gm * 7, 0, 0.85));
        }
        x += Math.cos(ang) * stepLen; y += Math.sin(ang) * stepLen;
        if (x < 0.02 || x > 0.98 || y < 0.02 || y > 0.98) break;
        path.push([x, y]);
      }
      if (path.length < 4) continue;
      var t = field ? clamp(startLum, 0, 1) : (m / M);
      strokes.push({ pts: path, col: pal.sample(t), w: 0.85, op: 0.1 + 0.3 * (field ? (0.35 + 0.65 * startLum) : 1) });
    }
    return { live: false, strokes: strokes };
  }

  // 3 ── DIFFERENTIAL GROWTH: a self-repelling closed curve (the seedhead) ─────
  function buildGrowth(rng, P, field) {
    var cx = 0.5, cy = 0.5, n0 = 48, R0 = 0.05;
    var nodes = [];
    for (var i = 0; i < n0; i++) { var a = i / n0 * TAU; nodes.push([cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)]); }
    var maxNodes = Math.round(lerp(820, 2100, P.complexity));
    var stepsTarget = Math.round(lerp(120, 185, P.complexity));
    var repR = pget(P, "repel", 0.027), maxLen = 0.012;
    var repW = 0.018, atW = 0.45, grW = pget(P, "rate", 0.0011), noiseW = 0.0006;
    var noise = makeNoise(rng), pal = P.palette, done = 0;

    function repulsion() {
      var cell = repR, grid = {};
      for (var i = 0; i < nodes.length; i++) {
        var gx = Math.floor(nodes[i][0] / cell), gy = Math.floor(nodes[i][1] / cell), key = gx + "," + gy;
        (grid[key] || (grid[key] = [])).push(i);
      }
      var F = new Array(nodes.length);
      for (var i2 = 0; i2 < nodes.length; i2++) {
        var p = nodes[i2], fx = 0, fy = 0;
        var gx2 = Math.floor(p[0] / cell), gy2 = Math.floor(p[1] / cell);
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var b = grid[(gx2 + ox) + "," + (gy2 + oy)]; if (!b) continue;
          for (var bi = 0; bi < b.length; bi++) {
            var j = b[bi]; if (j === i2) continue;
            var dx = p[0] - nodes[j][0], dy = p[1] - nodes[j][1], d2 = dx * dx + dy * dy;
            if (d2 < repR * repR && d2 > 1e-9) { var d = Math.sqrt(d2), s = (repR - d) / repR / d; fx += dx * s; fy += dy * s; }
          }
        }
        F[i2] = [fx, fy];
      }
      return F;
    }
    function growMag(x, y) {
      if (!field) return 1;
      return 0.12 + 0.95 * (1 - smoothstep(0.42, 0.78, field.lum(x, y))); // expands into the dark mass
    }
    function step() {
      var n = nodes.length, F = repulsion(), nn = new Array(n);
      for (var i = 0; i < n; i++) {
        var p = nodes[i], prev = nodes[(i - 1 + n) % n], next = nodes[(i + 1) % n];
        var ax = ((prev[0] + next[0]) / 2 - p[0]) * atW, ay = ((prev[1] + next[1]) / 2 - p[1]) * atW;
        var gm = growMag(p[0], p[1]);
        var ang = noise.fbm(p[0] * 3 + 11, p[1] * 3 + 23) * TAU * 2;
        var ox = p[0] - cx, oy = p[1] - cy, od = Math.hypot(ox, oy) || 1;
        var dxm = ax + F[i][0] * repW + Math.cos(ang) * noiseW * gm + ox / od * grW * gm;
        var dym = ay + F[i][1] * repW + Math.sin(ang) * noiseW * gm + oy / od * grW * gm;
        var ml = Math.hypot(dxm, dym); if (ml > 0.005) { dxm *= 0.005 / ml; dym *= 0.005 / ml; } // stability cap, no explosion
        var nx = p[0] + dxm, ny = p[1] + dym;
        var rdx = nx - cx, rdy = ny - cy, rd = Math.hypot(rdx, rdy); // soft disc containment
        if (rd > 0.47) { var pl = (rd - 0.47) * 0.6; nx -= rdx / rd * pl; ny -= rdy / rd * pl; }
        nn[i] = [clamp(nx, 0.02, 0.98), clamp(ny, 0.02, 0.98)];
      }
      nodes = nn;
      var budget = maxNodes - nodes.length;
      if (budget > 0) {
        var out = [];
        for (var k = 0; k < nodes.length; k++) {
          var a = nodes[k], b2 = nodes[(k + 1) % nodes.length];
          out.push(a);
          if (budget > 0 && Math.hypot(b2[0] - a[0], b2[1] - a[1]) > maxLen) { out.push([(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]); budget--; }
        }
        nodes = out;
      }
      done++;
      return done >= stepsTarget || (nodes.length >= maxNodes && done > stepsTarget * 0.55);
    }
    function strokes() {
      var n = nodes.length; if (n < 2) return [];
      if (pal.mono) return [{ pts: nodes.slice(), col: pal.sample(0.5), w: 0.9, op: 0.85, close: true }];
      var out = [], seg = Math.max(3, Math.floor(n / 48));
      for (var i = 0; i < n; i += seg) {
        var part = [];
        for (var j = i; j <= i + seg && j < n; j++) part.push(nodes[j]);
        if (i + seg >= n) part.push(nodes[0]);
        if (part.length > 1) out.push({ pts: part, col: pal.sample(i / n), w: 0.9, op: 0.82 });
      }
      return out;
    }
    return { live: true, step: step, strokes: strokes, count: function () { return nodes.length; } };
  }

  // 4 ── VENATION: space colonisation toward auxin sources (the mallow) ────────
  function buildVenation(rng, P, field) {
    var cx = 0.5, cy = 0.5;
    var nSrc = Math.round(lerp(520, 2200, P.complexity));
    var sources = [];
    for (var i = 0; i < nSrc; i++) {
      var x, y, tries = 0;
      do {
        if (field && rng() < 0.86) { var sp = field.sampleEdge(rng); x = sp[0]; y = sp[1]; }
        else { var rr = 0.46 * Math.sqrt(rng()), aa = rng() * TAU; x = cx + rr * Math.cos(aa); y = cy + rr * Math.sin(aa); }
        tries++;
      } while (Math.hypot(x - cx, y - cy) > 0.475 && tries < 6);
      sources.push([x, y, true]);
    }
    var attractD = pget(P, "reach", 0.15), killD = 0.016, seg = pget(P, "step", 0.0072);
    var nodes = [[cx, cy]], parent = [-1], depth = [0];
    var maxNodes = Math.round(lerp(1400, 3400, P.complexity)), iter = 0;
    var cell = attractD;
    while (iter++ < 2600 && nodes.length < maxNodes) {
      // node grid for nearest-node queries
      var grid = {};
      for (var ni = 0; ni < nodes.length; ni++) {
        var gx = Math.floor(nodes[ni][0] / cell), gy = Math.floor(nodes[ni][1] / cell);
        (grid[gx + "," + gy] || (grid[gx + "," + gy] = [])).push(ni);
      }
      var pull = {}, any = false;
      for (var si = 0; si < sources.length; si++) {
        if (!sources[si][2]) continue;
        var sx = sources[si][0], sy = sources[si][1];
        var bgx = Math.floor(sx / cell), bgy = Math.floor(sy / cell), best = -1, bd = attractD;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var b = grid[(bgx + ox) + "," + (bgy + oy)]; if (!b) continue;
          for (var k = 0; k < b.length; k++) { var d = Math.hypot(nodes[b[k]][0] - sx, nodes[b[k]][1] - sy); if (d < bd) { bd = d; best = b[k]; } }
        }
        if (best >= 0) { any = true; var dx = sx - nodes[best][0], dy = sy - nodes[best][1], dl = Math.hypot(dx, dy) || 1; var e = pull[best] || (pull[best] = [0, 0]); e[0] += dx / dl; e[1] += dy / dl; }
      }
      if (!any) break;
      for (var key in pull) {
        var pi = +key, ee = pull[key], el = Math.hypot(ee[0], ee[1]) || 1;
        nodes.push([nodes[pi][0] + ee[0] / el * seg, nodes[pi][1] + ee[1] / el * seg]);
        parent.push(pi); depth.push(depth[pi] + 1);
        if (nodes.length >= maxNodes) break;
      }
      // kill reached sources (check the newest nodes)
      var from = Math.max(1, nodes.length - 400);
      for (var si2 = 0; si2 < sources.length; si2++) {
        if (!sources[si2][2]) continue;
        for (var nj = nodes.length - 1; nj >= from; nj--) {
          if (Math.hypot(nodes[nj][0] - sources[si2][0], nodes[nj][1] - sources[si2][1]) < killD) { sources[si2][2] = false; break; }
        }
      }
    }
    // subtree mass → vein width (process in reverse creation order)
    var sub = new Float64Array(nodes.length); for (var s2 = 0; s2 < sub.length; s2++) sub[s2] = 1;
    for (var r = nodes.length - 1; r > 0; r--) sub[parent[r]] += sub[r];
    var maxSub = 1, maxDepth = 1;
    for (var q = 0; q < sub.length; q++) { if (sub[q] > maxSub) maxSub = sub[q]; if (depth[q] > maxDepth) maxDepth = depth[q]; }
    var pal = P.palette, strokes = [];
    for (var v = 1; v < nodes.length; v++) {
      var t = Math.sqrt(sub[v] / maxSub);
      strokes.push({
        pts: [[nodes[parent[v]][0], nodes[parent[v]][1]], [nodes[v][0], nodes[v][1]]],
        col: pal.sample(clamp(1 - depth[v] / maxDepth, 0, 1)), w: 0.5 + 3.8 * t, op: 0.45 + 0.5 * t
      });
    }
    return { live: false, strokes: strokes };
  }

  // 5 ── REACTION–DIFFUSION: Gray–Scott Turing patterns, drawn as iso-contours (the katydids)
  // marching-squares case table: corners a=1,b=2,c=4,d=8; edges 0=top(a-b) 1=right(b-c) 2=bottom(d-c) 3=left(a-d)
  var MS_TABLE = [[], [[0, 3]], [[0, 1]], [[1, 3]], [[1, 2]], [[0, 3], [1, 2]], [[0, 2]], [[2, 3]],
    [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[0, 3]], []];
  function edgePt(e, x, y, a, b, c, d, lev, inv) {
    var t, den;
    if (e === 0) { den = b - a; t = den ? (lev - a) / den : 0.5; return [(x + t) * inv, y * inv]; }
    if (e === 1) { den = c - b; t = den ? (lev - b) / den : 0.5; return [(x + 1) * inv, (y + t) * inv]; }
    if (e === 2) { den = c - d; t = den ? (lev - d) / den : 0.5; return [(x + t) * inv, (y + 1) * inv]; }
    den = d - a; t = den ? (lev - a) / den : 0.5; return [x * inv, (y + t) * inv];
  }
  function buildReaction(rng, P, field) {
    var G = 120, NN = G * G;
    var u = new Float32Array(NN), v = new Float32Array(NN), u2 = new Float32Array(NN), v2 = new Float32Array(NN);
    for (var i = 0; i < NN; i++) { u[i] = 1; }
    // seed V from the photo's edges if present, else scattered drops; the pattern nucleates there
    var seeds = Math.round(lerp(16, 52, P.complexity));
    for (var s = 0; s < seeds; s++) {
      var sx, sy;
      if (field) { var sp = field.sampleEdge(rng); sx = sp[0]; sy = sp[1]; }
      else { sx = rng(); sy = rng(); }
      var cgx = (sx * G) | 0, cgy = (sy * G) | 0, R = 2 + (rng() * 3 | 0);
      for (var dy = -R; dy <= R; dy++) for (var dx = -R; dx <= R; dx++) {
        var px = cgx + dx, py = cgy + dy; if (px < 0 || px >= G || py < 0 || py >= G) continue;
        var si = py * G + px; u[si] = 0.5; v[si] = 0.27;
      }
    }
    // per-cell feed/kill from luminance → different Turing regimes (spots ↔ stripes ↔ coral) surface the photo
    var Fc = new Float32Array(NN), Kc = new Float32Array(NN);
    for (var yy = 0; yy < G; yy++) for (var xx = 0; xx < G; xx++) {
      var l = field ? field.lum((xx + 0.5) / G, (yy + 0.5) / G) : 0.5;
      Fc[yy * G + xx] = lerp(0.024, 0.054, l); Kc[yy * G + xx] = lerp(0.0595, 0.062, l);
    }
    var XM = new Int32Array(G), XP = new Int32Array(G);
    for (var k = 0; k < G; k++) { XM[k] = (k - 1 + G) % G; XP[k] = (k + 1) % G; }
    var Du = 0.16, Dv = pget(P, "diffuse", 0.08), iter = 0, target = Math.round(lerp(1500, 3000, P.complexity)), pal = P.palette;
    function batch(n) {
      for (var it = 0; it < n; it++) {
        for (var y = 0; y < G; y++) {
          var ym = (y - 1 + G) % G, yp = (y + 1) % G, ry = y * G, rym = ym * G, ryp = yp * G;
          for (var x = 0; x < G; x++) {
            var xm = XM[x], xp = XP[x], idx = ry + x, uu = u[idx], vv = v[idx];
            var Lu = (u[ry + xm] + u[ry + xp] + u[rym + x] + u[ryp + x]) * 0.2 + (u[rym + xm] + u[rym + xp] + u[ryp + xm] + u[ryp + xp]) * 0.05 - uu;
            var Lv = (v[ry + xm] + v[ry + xp] + v[rym + x] + v[ryp + x]) * 0.2 + (v[rym + xm] + v[rym + xp] + v[ryp + xm] + v[ryp + xp]) * 0.05 - vv;
            var uvv = uu * vv * vv;
            u2[idx] = uu + (Du * Lu - uvv + Fc[idx] * (1 - uu));
            v2[idx] = vv + (Dv * Lv + uvv - (Fc[idx] + Kc[idx]) * vv);
          }
        }
        var t = u; u = u2; u2 = t; var t2 = v; v = v2; v2 = t2; iter++;
      }
    }
    function step() { batch(10); return iter >= target; }
    function strokes() {
      var mask = pget(P, "mask", 0); // 0 → byte-identical; >0 → bloom only on the specimen, cull the toroidal frame fill
      var nb = pget(P, "bands", 3) | 0, levels;
      if (nb === 3) { levels = [0.22, 0.34, 0.46]; }   // default: exact literals, so a default reaction re-derives byte-identically
      else { levels = []; for (var lb = 0; lb < nb; lb++) levels.push(nb > 1 ? 0.22 + 0.24 * lb / (nb - 1) : 0.34); }
      var inv = 1 / (G - 1), out = [];
      for (var li = 0; li < levels.length; li++) {
        var lev = levels[li];
        for (var y = 0; y < G - 1; y++) for (var x = 0; x < G - 1; x++) {
          var a = v[y * G + x], b = v[y * G + x + 1], c = v[(y + 1) * G + x + 1], d = v[(y + 1) * G + x];
          var code = (a > lev ? 1 : 0) | (b > lev ? 2 : 0) | (c > lev ? 4 : 0) | (d > lev ? 8 : 0);
          if (code === 0 || code === 15) continue;
          var segs = MS_TABLE[code];
          for (var si2 = 0; si2 < segs.length; si2++) {
            var p0 = edgePt(segs[si2][0], x, y, a, b, c, d, lev, inv);
            var p1 = edgePt(segs[si2][1], x, y, a, b, c, d, lev, inv);
            var lc = field ? field.lum((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2) : (li / (levels.length - 1));
            var op = 0.28 + 0.55 * (field ? clamp(lc, 0, 1) : 0.7);
            if (mask > 0 && field) {
              var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
              var dr = Math.sqrt((mx - 0.5) * (mx - 0.5) + (my - 0.5) * (my - 0.5)) * 1.414; // 0 centre → 1 corner
              var keep = clamp((clamp(lc, 0, 1) - (1 - mask) * 0.42) / 0.45, 0, 1) * (1 - smoothstep(0.66, 1.04, dr) * mask);
              if (keep < 0.05) continue;            // de-box: drop the contour where the photo is dark or near the frame
              op *= 0.32 + 0.68 * keep;
            }
            out.push({ pts: [p0, p1], col: pal.sample(clamp(lc, 0, 1)), w: 0.6 + li * 0.22, op: op });
          }
        }
      }
      return out;
    }
    return { live: true, step: step, strokes: strokes, count: function () { return iter; } };
  }

  // 6 ── PHYSARUM: agent-based slime-mould transport network (after Jones 2010) ─
  //  Thousands of agents each lay a pheromone trail and steer toward where the
  //  trail, and the photograph's light, runs strongest; the field diffuses and
  //  decays behind them. Reinforced routes thicken into a transport network the
  //  same way Physarum polycephalum reticulates toward food. The drawn lines are
  //  the agents' own paths; the network is emergent, never authored.
  function buildPhysarum(rng, P, field) {
    var G = 180, NN = G * G;
    var T = new Float32Array(NN), T2 = new Float32Array(NN);
    var N = Math.round(lerp(900, 2500, P.complexity));
    var SA = pget(P, "sense", 0.40), RA = 0.46, SO = 7.5, SS = 1.35;      // sense angle, turn, sensor offset & step (grid px)
    var decay = pget(P, "decay", 0.90), wPhoto = field ? 1.9 : 0;         // photo light as a static attractant atop the trail
    var pal = P.palette;
    var ax = new Float32Array(N), ay = new Float32Array(N), ah = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var sx, sy;
      if (field) { var sp = field.sampleEdge(rng); sx = sp[0] * G; sy = sp[1] * G; }     // start on the specimen's structure
      else { var rr = 0.4 * G * Math.sqrt(rng()), aa = rng() * TAU; sx = G * 0.5 + rr * Math.cos(aa); sy = G * 0.5 + rr * Math.sin(aa); }
      ax[i] = sx; ay[i] = sy; ah[i] = rng() * TAU;
    }
    // a subset leave an inked path; the rest only sculpt the shared trail field
    var inkN = clamp(Math.round(N * 0.30), 90, 540) | 0;
    var iter = 0, target = Math.round(lerp(560, 1180, P.complexity)), cap = target + 6;
    var pbuf = [], pn = new Int32Array(inkN), spawnT = new Float32Array(inkN);
    for (var k = 0; k < inkN; k++) { var fb = new Float32Array(cap * 2); fb[0] = ax[k] / G; fb[1] = ay[k] / G; pbuf.push(fb); pn[k] = 1; spawnT[k] = field ? field.lum(ax[k] / G, ay[k] / G) : 0; }

    function sampleT(x, y) {                              // bilinear trail read, clamped to the grid
      if (x < 0) x = 0; else if (x > G - 1.001) x = G - 1.001;
      if (y < 0) y = 0; else if (y > G - 1.001) y = G - 1.001;
      var x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, r0 = y0 * G;
      var a = T[r0 + x0], b = T[r0 + x0 + 1], c = T[r0 + G + x0], d = T[r0 + G + x0 + 1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
    function sense(x, y, h) {
      var sx = x + Math.cos(h) * SO, sy = y + Math.sin(h) * SO, s = sampleT(sx, sy);
      if (wPhoto) s += wPhoto * field.lum(clamp(sx / G, 0, 1), clamp(sy / G, 0, 1));
      return s;
    }
    function oneStep() {
      for (var i = 0; i < N; i++) {
        var x = ax[i], y = ay[i], h = ah[i];
        var F = sense(x, y, h), L = sense(x, y, h - SA), R = sense(x, y, h + SA);
        if (F >= L && F >= R) { } else if (F < L && F < R) { h += (rng() < 0.5 ? -RA : RA); } else if (L > R) { h -= RA; } else { h += RA; }
        var nx = x + Math.cos(h) * SS, ny = y + Math.sin(h) * SS;
        if (nx < 1) { nx = 1; h = Math.PI - h; } else if (nx > G - 2) { nx = G - 2; h = Math.PI - h; }   // reflect at the frame
        if (ny < 1) { ny = 1; h = -h; } else if (ny > G - 2) { ny = G - 2; h = -h; }
        ax[i] = nx; ay[i] = ny; ah[i] = h;
        T[(ny | 0) * G + (nx | 0)] += 1;
        if (i < inkN) { var c = pn[i]; if (c < cap) { var b = pbuf[i]; b[c * 2] = nx / G; b[c * 2 + 1] = ny / G; pn[i] = c + 1; } }
      }
      for (var y2 = 0; y2 < G; y2++) {                    // diffuse (5-tap) + decay → coalescence into veins
        var r = y2 * G, up = y2 > 0 ? r - G : r, dn = y2 < G - 1 ? r + G : r;
        for (var x2 = 0; x2 < G; x2++) {
          var xl = x2 > 0 ? x2 - 1 : x2, xr = x2 < G - 1 ? x2 + 1 : x2;
          T2[r + x2] = (T[r + x2] * 0.6 + (T[r + xl] + T[r + xr] + T[up + x2] + T[dn + x2]) * 0.1) * decay;
        }
      }
      var tmp = T; T = T2; T2 = tmp; iter++;
    }
    function step() { oneStep(); oneStep(); return iter >= target; }
    // colour by the forager's ORIGIN luminance, so the routes carry where they set out from,
    // so the bright core stays multi-hued instead of collapsing to one band (pure-math: by density)
    function colT(k, dn2) { return field ? clamp(spawnT[k] * 1.06 + 0.02, 0, 1) : clamp(0.16 + dn2 * 0.6, 0, 1); }
    function strokes() {
      var out = [], k;
      if (iter >= target) {
        for (k = 0; k < inkN; k++) {                      // final: each agent's full journey, trunk routes bolder
          var n = pn[k]; if (n < 6) continue; var b = pbuf[k], pts = [];
          for (var j = 0; j < n; j += 3) pts.push([b[j * 2], b[j * 2 + 1]]);
          if (pts.length < 3) continue;
          var hx = b[(n - 1) * 2], hy = b[(n - 1) * 2 + 1];
          var dens = sampleT(hx * G, hy * G), dn2 = clamp(dens / (5 + dens), 0, 1);
          out.push({ pts: pts, col: pal.sample(colT(k, dn2)), w: 0.45 + 1.05 * dn2, op: 0.09 + 0.5 * dn2 });
        }
      } else {
        var TAIL = 40;
        for (k = 0; k < inkN; k++) {                      // live: the active foraging tails
          var n2 = pn[k]; if (n2 < 2) continue; var b2 = pbuf[k];
          var s0 = n2 > TAIL ? n2 - TAIL : 0, tail = [];
          for (var j2 = s0; j2 < n2; j2++) tail.push([b2[j2 * 2], b2[j2 * 2 + 1]]);
          out.push({ pts: tail, col: pal.sample(colT(k, 0.4)), w: 0.7, op: 0.16 });
        }
      }
      return out;
    }
    return { live: true, step: step, strokes: strokes, count: function () { return iter; } };
  }

  // 7 ── BOIDS: distributed flocking; murmuration trails (after Reynolds 1987) ──
  //  N agents, each a position+velocity, steered every iter by three rules summed
  //  over neighbours inside a vision radius: SEPARATION (away from the too-close),
  //  ALIGNMENT (match the local mean heading), COHESION (toward the local centroid).
  //  Neighbours are found in O(N) through a grid hash rebuilt each iter, not O(N^2).
  function buildBoids(rng, P, field) {
    var N = Math.round(lerp(500, 1400, P.complexity));
    var cohW = pget(P, "cohesion", 0.9);   // toward neighbour centroid
    var sepW = pget(P, "separate", 1.6);   // away from too-close
    var aliW = 1.0;                          // match neighbour heading (fixed)
    var vision = 0.045, sepR = 0.018;        // neighbour radius / personal space (normalised)
    var maxSpd = 0.0065, minSpd = 0.0030;    // speed clamp keeps the flock coherent
    var photoW = field ? 0.9 : 0;            // up-gradient pull toward the bright mass
    var pal = P.palette;

    var px = new Float32Array(N), py = new Float32Array(N);
    var vx = new Float32Array(N), vy = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var sx, sy;
      if (field) { var sp = field.sampleEdge(rng); sx = sp[0]; sy = sp[1]; }   // launch off the specimen's structure
      else { var rr = 0.42 * Math.sqrt(rng()), aa = rng() * TAU; sx = 0.5 + rr * Math.cos(aa); sy = 0.5 + rr * Math.sin(aa); }
      px[i] = clamp(sx, 0.02, 0.98); py[i] = clamp(sy, 0.02, 0.98);
      var h0 = rng() * TAU, s0 = lerp(minSpd, maxSpd, rng());
      vx[i] = Math.cos(h0) * s0; vy[i] = Math.sin(h0) * s0;
    }

    var inkN = clamp(Math.round(N * 0.45), 120, 480) | 0;   // a capped subset leave inked trails
    var iter = 0, target = Math.round(lerp(160, 300, P.complexity)), cap = target + 2;
    var tbuf = [], tn = new Int32Array(inkN), tcol = new Float32Array(inkN);
    for (var k = 0; k < inkN; k++) {
      var fb = new Float32Array(cap * 2); fb[0] = px[k]; fb[1] = py[k];
      tbuf.push(fb); tn[k] = 1;
      tcol[k] = field ? clamp(field.lum(px[k], py[k]), 0, 1) : 0;   // origin light carried by the trail
    }

    var cell = vision, GC = Math.ceil(1 / cell) + 2;          // grid hash: O(N) neighbour queries
    var gridHead = new Int32Array(GC * GC), gridNext = new Int32Array(N);
    function rebuildGrid() {
      for (var c = 0; c < gridHead.length; c++) gridHead[c] = -1;
      for (var a = 0; a < N; a++) {
        var cxi = (px[a] / cell) | 0, cyi = (py[a] / cell) | 0;
        if (cxi < 0) cxi = 0; else if (cxi >= GC) cxi = GC - 1;
        if (cyi < 0) cyi = 0; else if (cyi >= GC) cyi = GC - 1;
        var ci = cyi * GC + cxi;
        gridNext[a] = gridHead[ci]; gridHead[ci] = a;
      }
    }

    var vis2 = vision * vision, sep2 = sepR * sepR;
    function oneStep() {
      rebuildGrid();
      for (var a = 0; a < N; a++) {
        var ax = px[a], ay = py[a];
        var cxi = (ax / cell) | 0, cyi = (ay / cell) | 0;
        if (cxi < 0) cxi = 0; else if (cxi >= GC) cxi = GC - 1;
        if (cyi < 0) cyi = 0; else if (cyi >= GC) cyi = GC - 1;
        var sumvx = 0, sumvy = 0, cenx = 0, ceny = 0, sepx = 0, sepy = 0, nn = 0;
        for (var ox = -1; ox <= 1; ox++) {
          var gx = cxi + ox; if (gx < 0 || gx >= GC) continue;
          for (var oy = -1; oy <= 1; oy++) {
            var gy = cyi + oy; if (gy < 0 || gy >= GC) continue;
            for (var b = gridHead[gy * GC + gx]; b !== -1; b = gridNext[b]) {
              if (b === a) continue;
              var dx = px[b] - ax, dy = py[b] - ay, d2 = dx * dx + dy * dy;
              if (d2 > vis2 || d2 < 1e-12) continue;
              nn++;
              sumvx += vx[b]; sumvy += vy[b];
              cenx += px[b]; ceny += py[b];
              if (d2 < sep2) { var inv = 1 / Math.sqrt(d2); sepx -= dx * inv; sepy -= dy * inv; }
            }
          }
        }
        var fxs = 0, fys = 0;
        if (nn > 0) {
          var mvx = sumvx / nn, mvy = sumvy / nn, ml = Math.sqrt(mvx * mvx + mvy * mvy);
          if (ml > 1e-9) { fxs += (mvx / ml) * aliW; fys += (mvy / ml) * aliW; }
          var toc_x = cenx / nn - ax, toc_y = ceny / nn - ay, cl = Math.sqrt(toc_x * toc_x + toc_y * toc_y);
          if (cl > 1e-9) { fxs += (toc_x / cl) * cohW; fys += (toc_y / cl) * cohW; }
          var sl = Math.sqrt(sepx * sepx + sepy * sepy);
          if (sl > 1e-9) { fxs += (sepx / sl) * sepW; fys += (sepy / sl) * sepW; }
        }
        if (photoW) {
          var g = field.grad(ax, ay), gm = Math.sqrt(g[0] * g[0] + g[1] * g[1]);
          if (gm > 1e-4) { fxs += (g[0] / gm) * photoW; fys += (g[1] / gm) * photoW; }
        }
        var marg = 0.06;
        if (ax < marg) fxs += (marg - ax) * 6; else if (ax > 1 - marg) fxs -= (ax - (1 - marg)) * 6;
        if (ay < marg) fys += (marg - ay) * 6; else if (ay > 1 - marg) fys -= (ay - (1 - marg)) * 6;
        var nvx = vx[a] + fxs * 0.00018, nvy = vy[a] + fys * 0.00018;
        var sp2 = nvx * nvx + nvy * nvy, spd = Math.sqrt(sp2);
        if (spd > maxSpd) { nvx = nvx / spd * maxSpd; nvy = nvy / spd * maxSpd; }
        else if (spd < minSpd && spd > 1e-9) { nvx = nvx / spd * minSpd; nvy = nvy / spd * minSpd; }
        else if (spd <= 1e-9) { var hh = rng() * TAU; nvx = Math.cos(hh) * minSpd; nvy = Math.sin(hh) * minSpd; }
        vx[a] = nvx; vy[a] = nvy;
        var nx = ax + nvx, ny = ay + nvy;
        if (nx < 0.012) { nx = 0.012; vx[a] = Math.abs(vx[a]); } else if (nx > 0.988) { nx = 0.988; vx[a] = -Math.abs(vx[a]); }
        if (ny < 0.012) { ny = 0.012; vy[a] = Math.abs(vy[a]); } else if (ny > 0.988) { ny = 0.988; vy[a] = -Math.abs(vy[a]); }
        px[a] = nx; py[a] = ny;
        if (a < inkN) { var c2 = tn[a]; if (c2 < cap) { var tb = tbuf[a]; tb[c2 * 2] = nx; tb[c2 * 2 + 1] = ny; tn[a] = c2 + 1; } }
      }
      iter++;
    }
    function step() { oneStep(); oneStep(); return iter >= target; }
    function headHue(a) { return clamp((Math.atan2(vy[a], vx[a]) + Math.PI) / TAU, 0, 1); }
    function strokes() {
      var out = [], k;
      if (iter >= target) {
        var stepd = cap > 360 ? 3 : 2;
        for (k = 0; k < inkN; k++) {
          var n = tn[k]; if (n < 4) continue;
          var b = tbuf[k], pts = [];
          for (var j = 0; j < n; j += stepd) pts.push([b[j * 2], b[j * 2 + 1]]);
          if ((n - 1) % stepd !== 0) pts.push([b[(n - 1) * 2], b[(n - 1) * 2 + 1]]);
          if (pts.length < 3) continue;
          var t = field ? tcol[k] : headHue(k);
          out.push({ pts: pts, col: pal.sample(t), w: 0.7, op: 0.18 + 0.34 * (field ? (0.4 + 0.6 * tcol[k]) : 0.6) });
        }
      } else {
        var TAIL = 40;
        for (k = 0; k < inkN; k++) {
          var n2 = tn[k]; if (n2 < 2) continue;
          var b2 = tbuf[k], s0 = n2 > TAIL ? n2 - TAIL : 0, tail = [];
          for (var j2 = s0; j2 < n2; j2++) tail.push([b2[j2 * 2], b2[j2 * 2 + 1]]);
          out.push({ pts: tail, col: pal.sample(field ? tcol[k] : headHue(k)), w: 0.7, op: 0.22 });
        }
      }
      return out;
    }
    return { live: true, step: step, strokes: strokes, count: function () { return iter; } };
  }

  // 8 ── HYDROGEN ORBITAL: |psi_{n,l,0}|^2 as iso-probability contours (Schrödinger 1926)
  //  psi = R_nl(r)·Y_l0(theta) on the x-z plane (phi=0); atomic units a0=1. Radials verified
  //  vs ChemLibreTexts closed forms, angular vs the spherical-harmonic table. Node structure
  //  exact: radial nodes = n-l-1, angular = l. Vis. inspiration: Kavan (kevkev-70).
  function buildOrbital(rng, P, field) {
    var n = Math.round(clamp(pget(P, "n", 3), 1, 4));
    var l = Math.round(clamp(pget(P, "l", 2), 0, 3));
    if (l > n - 1) l = n - 1;
    function fact(k) { var f = 1, i; for (i = 2; i <= k; i++) f *= i; return f; }
    function laguerre(k, a, x) {
      if (k <= 0) return 1;
      var Lm2 = 1, Lm1 = (1 + a) - x, Lk = Lm1, i;
      for (i = 2; i <= k; i++) { Lk = (((2 * i - 1 + a - x) * Lm1) - ((i - 1 + a) * Lm2)) / i; Lm2 = Lm1; Lm1 = Lk; }
      return Lk;
    }
    var kdeg = n - l - 1;
    var Cnl = (2 / (n * n)) * Math.sqrt(fact(kdeg) / fact(n + l));
    function Rnl(r) { var rho = 2 * r / n; return Cnl * Math.pow(rho, l) * Math.exp(-r / n) * laguerre(kdeg, 2 * l + 1, rho); }
    var IP = 1 / Math.PI;
    function Yl0(u) {
      if (l === 0) return 0.5 * Math.sqrt(IP);
      if (l === 1) return 0.5 * Math.sqrt(3 * IP) * u;
      if (l === 2) return 0.25 * Math.sqrt(5 * IP) * (3 * u * u - 1);
      return 0.25 * Math.sqrt(7 * IP) * (5 * u * u * u - 3 * u);
    }
    function psi2(x, z) {
      var r = Math.sqrt(x * x + z * z);
      if (r < 1e-9) { if (l !== 0) return 0; var a0 = Rnl(0) * Yl0(1); return a0 * a0; }
      var a = Rnl(r) * Yl0(z / r); return a * a;
    }
    var W = (n * n) * 1.7 + 4, G = 200;
    function coord(i) { return lerp(-W, W, i / (G - 1)); }
    var grid = new Float64Array(G * G), maxv = 0, i, j, v;
    for (j = 0; j < G; j++) { var zz = coord(j); for (i = 0; i < G; i++) { v = psi2(coord(i), zz); grid[j * G + i] = v; if (v > maxv) maxv = v; } }
    if (maxv <= 0) maxv = 1;
    var nLev = 7;   // fixed (NOT reduced-dependent) so render and witness re-derivation agree
    var levels = [];
    for (i = 0; i < nLev; i++) levels.push(Math.pow(0.62, nLev - i) * maxv);
    var inv = 1 / (G - 1), strokes = [], Li, lev, tc, col, w, op, x, y, code, segs, s, p0, p1, a, b, c, d;
    for (Li = 0; Li < levels.length; Li++) {
      lev = levels[Li];
      tc = levels.length > 1 ? Li / (levels.length - 1) : 0.5;
      col = P.palette.sample(tc);
      w = lerp(0.45, 1.5, tc); op = lerp(0.30, 0.92, tc);
      for (y = 0; y < G - 1; y++) for (x = 0; x < G - 1; x++) {
        a = grid[y * G + x]; b = grid[y * G + x + 1]; c = grid[(y + 1) * G + x + 1]; d = grid[(y + 1) * G + x];
        code = (a > lev ? 1 : 0) | (b > lev ? 2 : 0) | (c > lev ? 4 : 0) | (d > lev ? 8 : 0);
        if (code === 0 || code === 15) continue;
        segs = MS_TABLE[code];
        for (s = 0; s < segs.length; s++) {
          p0 = edgePt(segs[s][0], x, y, a, b, c, d, lev, inv);
          p1 = edgePt(segs[s][1], x, y, a, b, c, d, lev, inv);
          strokes.push({ pts: [p0, p1], col: col, w: w, op: op });
        }
      }
    }
    return { live: false, strokes: strokes };
  }

  // 9 ── HILBERT: one continuous stroke that fills the plane (Hilbert 1891) ─────
  //  d2xy bit-rotation mapping in PURE INTEGER arithmetic, no sin/cos/sqrt on the
  //  path, so the drawing re-derives BIT-FOR-BIT on any machine (strongest witness).
  //  The photograph colours it (colour only): the one curve is cut into short runs
  //  that SHARE endpoints (still one pen path), each tinted by the local luminance.
  function buildHilbert(rng, P, field) {
    var pal = P.palette;
    var order = Math.round(pget(P, "order", 5));   // fallback == param default (witness-consistent)
    order = clamp(order | 0, 4, 7);
    var chamfer = clamp(pget(P, "chamfer", 0), 0, 0.45);
    var side = 1 << order, nCells = side * side;
    var margin = 0.06, span = 1 - 2 * margin, cellW = span / side;
    function d2xy(nn, d) {
      var rx, ry, t = d, x = 0, y = 0;
      for (var s = 1; s < nn; s <<= 1) {
        rx = 1 & (t >> 1); ry = 1 & (t ^ rx);
        if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } var tmp = x; x = y; y = tmp; }
        x += s * rx; y += s * ry; t >>= 2;
      }
      return [x, y];
    }
    function centre(gx, gy) { return [margin + (gx + 0.5) * cellW, margin + (gy + 0.5) * cellW]; }
    var full = [], prev = null, cur = centre.apply(null, d2xy(side, 0)); full.push(cur);
    for (var d = 1; d < nCells; d++) {
      var next = centre.apply(null, d2xy(side, d));
      if (chamfer > 0 && prev) {
        full.pop();
        full.push([cur[0] + (prev[0] - cur[0]) * chamfer, cur[1] + (prev[1] - cur[1]) * chamfer]);
        full.push([cur[0] + (next[0] - cur[0]) * chamfer, cur[1] + (next[1] - cur[1]) * chamfer]);
      }
      full.push(next); prev = cur; cur = next;
    }
    var runLen = clamp(4 + order * 2, 6, 32) | 0, strokes = [], L = full.length;
    for (var i = 0; i < L - 1; i += runLen) {
      var end = Math.min(L - 1, i + runLen), run = [];
      for (var jj = i; jj <= end; jj++) run.push(full[jj]);
      if (run.length < 2) continue;
      var t;
      if (field) { var mid = run[(run.length >> 1)]; t = clamp(field.lum(mid[0], mid[1]), 0, 1); }
      else { t = clamp((i + end) / 2 / (L - 1), 0, 1); }
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: run, col: pal.sample(t), w: 0.9, op: field ? (0.16 + 0.74 * lc) : (0.32 + 0.5 * lc) });
    }
    return { live: false, strokes: strokes };
  }

  // 10 ── BINOMIAL: Pascal's triangle mod m; the Sierpiński gasket (binomial thm)
  //  C(i,j) = C(i-1,j-1) + C(i-1,j), computed entirely MOD m (pure integer). The
  //  non-zero cells, marked as small triangles, are a self-similar fractal: mod 2
  //  is the Sierpiński gasket, every modulus its own nesting. No trigonometry on
  //  the geometry, so it re-derives BIT-FOR-BIT on any machine. The photograph
  //  tints the cells (colour only); pure-math colours by value / depth.
  function buildBinomial(rng, P, field) {
    var pal = P.palette;
    var N = Math.round(clamp(pget(P, "rows", 64), 16, 128)) | 0;
    var m = Math.round(clamp(pget(P, "mod", 2), 2, 9)) | 0;
    var margin = 0.07, span = 1 - 2 * margin;
    var dx = span / (N - 1), dy = dx * 0.8660254;          // equilateral row spacing (rational, no trig)
    var triH = (N - 1) * dy, y0 = margin + (span - triH) / 2, s = dx * 0.46;
    var strokes = [], prev = new Int32Array(1); prev[0] = 1 % m;
    for (var i = 0; i < N; i++) {
      var yy = y0 + i * dy;
      for (var j = 0; j <= i; j++) {
        var val = prev[j];
        if (val === 0) continue;                            // mod 2: skip the even cells (the holes)
        var xx = 0.5 + (j - i * 0.5) * dx;
        var t = clamp(field ? field.lum(xx, yy) : (m > 2 ? (val - 1) / (m - 1) : i / (N - 1)), 0, 1);
        strokes.push({ pts: [[xx, yy - dy * 0.5], [xx - s, yy + dy * 0.4], [xx + s, yy + dy * 0.4]], col: pal.sample(t), w: 0.7, op: 0.35 + 0.5 * t, close: true });
      }
      if (i < N - 1) {
        var nxt = new Int32Array(i + 2); nxt[0] = 1 % m; nxt[i + 1] = 1 % m;
        for (var k = 1; k <= i; k++) nxt[k] = (prev[k - 1] + prev[k]) % m;
        prev = nxt;
      }
    }
    return { live: false, strokes: strokes };
  }

  // 11 ── HARMONOGRAPH: two damped pendulums per axis (a real drawing machine) ──
  //  x and y are each driven by a pair of sine pendulums whose amplitude decays;
  //  near-integer frequency ratios make the figure slowly precess into a dense
  //  organic weave. Deterministic from the seed; trig-class (sin/exp share the JS
  //  engine), re-derivable on the same engine, not claimed bit-exact.
  function buildHarmonograph(rng, P, field) {
    var pal = P.palette;
    var detune = pget(P, "detune", 0.42);   // how far each pendulum pair pulls apart in frequency → precession
    var decay = pget(P, "decay", 0.26);      // swing damping
    function pend() {
      var base = 2 + (rng() < 0.5 ? 0 : 1);                       // base ratio 2 or 3
      return { f: base + (rng() - 0.5) * detune, p: rng() * TAU,
        a: 0.5 * (0.7 + 0.3 * rng()), d: decay * 0.01 * (0.5 + rng()) };
    }
    var ax1 = pend(), ax2 = pend(), ay1 = pend(), ay2 = pend();
    var N = Math.round(lerp(3200, 9600, P.complexity)), dt = 0.0125, cx = 0.5, cy = 0.5, sc = 0.3, pts = [];
    for (var i = 0; i < N; i++) {
      var t = i * dt;
      var x = ax1.a * Math.sin(ax1.f * t + ax1.p) * Math.exp(-ax1.d * t) + ax2.a * Math.sin(ax2.f * t + ax2.p) * Math.exp(-ax2.d * t);
      var y = ay1.a * Math.sin(ay1.f * t + ay1.p) * Math.exp(-ay1.d * t) + ay2.a * Math.sin(ay2.f * t + ay2.p) * Math.exp(-ay2.d * t);
      pts.push([cx + x * sc, cy + y * sc]);
    }
    var strokes = [], run = 36, L = pts.length;
    for (var s = 0; s < L - 1; s += run) {
      var end = Math.min(L - 1, s + run), seg = pts.slice(s, end + 1);
      if (seg.length < 2) continue;
      var mid = seg[seg.length >> 1];
      var tt = field ? clamp(field.lum(clamp(mid[0], 0, 1), clamp(mid[1], 0, 1)), 0, 1) : (s / L);
      strokes.push({ pts: seg, col: pal.sample(tt), w: 0.8, op: field ? (0.2 + 0.62 * (0.3 + 0.7 * tt)) : 0.5 });
    }
    return { live: false, strokes: strokes };
  }

  // 12 ── GOSPER: the flowsnake, a space-filling fractal curve (Lindenmayer) ────
  //  One continuous stroke that tiles the plane in hexagons: a fractal coastline
  //  that never crosses itself. Rewrite A→A-B--B+A++AA+B-, B→+A-BB--B-A++A+B at 60°.
  //  The six hex directions use only ±1/2 and ±√3/2 (sqrt is IEEE-754 exact), no
  //  transcendental on the geometry, so it re-derives BIT-FOR-BIT on any machine.
  function buildGosper(rng, P, field) {
    var pal = P.palette;
    var iters = Math.round(clamp(pget(P, "iters", 4), 2, 5)) | 0;
    var twist = Math.round(clamp(pget(P, "twist", 0), 0, 5)) | 0;
    var s = "A";
    for (var k = 0; k < iters; k++) {
      var o = "";
      for (var c = 0; c < s.length; c++) { var ch = s.charAt(c); o += ch === "A" ? "A-B--B+A++AA+B-" : ch === "B" ? "+A-BB--B-A++A+B" : ch; }
      s = o;
    }
    var R3 = Math.sqrt(3) / 2;
    var DIR = [[1, 0], [0.5, -R3], [-0.5, -R3], [-1, 0], [-0.5, R3], [0.5, R3]]; // 0..5 × 60°
    var dir = twist % 6, x = 0, y = 0, raw = [[0, 0]], minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (var i = 0; i < s.length; i++) {
      var g = s.charAt(i);
      if (g === "A" || g === "B") {
        x += DIR[dir][0]; y += DIR[dir][1]; raw.push([x, y]);
        if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      } else if (g === "+") dir = (dir + 1) % 6;
      else if (g === "-") dir = (dir + 5) % 6;
    }
    var margin = 0.07, span = 1 - 2 * margin;
    var w = Math.max(1e-6, maxX - minX), h = Math.max(1e-6, maxY - minY), scl = span / Math.max(w, h);
    var ox = margin + (span - w * scl) / 2, oy = margin + (span - h * scl) / 2;
    function map(p) { return [ox + (p[0] - minX) * scl, oy + (p[1] - minY) * scl]; }
    var strokes = [], rn = 24, L = raw.length;
    for (var a = 0; a < L - 1; a += rn) {
      var end = Math.min(L - 1, a + rn), seg = [];
      for (var j = a; j <= end; j++) seg.push(map(raw[j]));
      if (seg.length < 2) continue;
      var mid = seg[seg.length >> 1], t = field ? clamp(field.lum(clamp(mid[0], 0, 1), clamp(mid[1], 0, 1)), 0, 1) : (a / L);
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: seg, col: pal.sample(t), w: 0.95, op: field ? (0.18 + 0.74 * lc) : (0.34 + 0.5 * lc) });
    }
    return { live: false, strokes: strokes };
  }

  // 13 ── L-SYSTEM PLANT: a stochastic Lindenmayer system, drawn with a turtle ──
  //  Axiom X rewritten depth times by X→F+[[X]-X]-F[-FX]+X and F→FF, the classic
  //  bracketed plant. A turtle walks the string: F draws a branch, +/- rotate by
  //  `angle` (with rng jitter so each seed differs), [ ] push/pop state. Grows up
  //  from the base, then fits to art space. Trig-class (rotation via sin/cos).
  function buildLSystem(rng, P, field) {
    var pal = P.palette;
    var angle = pget(P, "angle", 0.42);
    var depth = Math.round(clamp(pget(P, "depth", 5), 3, 6)) | 0;
    var SEG_CAP = 5200, rulesX = "F+[[X]-X]-F[-FX]+X", rulesF = "FF", s = "X";
    for (var it = 0; it < depth; it++) {
      var o = "";
      for (var c = 0; c < s.length; c++) { var ch = s.charAt(c); o += ch === "X" ? rulesX : ch === "F" ? rulesF : ch; }
      s = o;
    }
    var stepLen = 1.0, px = 0, py = 0, heading = -Math.PI / 2, bd = 0, stack = [], raw = [];
    var minX = 0, maxX = 0, minY = 0, maxY = 0, drawn = 0, maxBD = 1;
    for (var i = 0; i < s.length && drawn < SEG_CAP; i++) {
      var g = s.charAt(i);
      if (g === "F") {
        var wob = (rng() - 0.5) * angle * 0.30, hh = heading + wob, ln = stepLen * (0.86 + 0.28 * rng());
        var nx = px + Math.cos(hh) * ln, ny = py + Math.sin(hh) * ln;
        raw.push([px, py, nx, ny, bd]); if (bd > maxBD) maxBD = bd; drawn++; px = nx; py = ny;
        if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
      } else if (g === "+") heading += angle * (0.82 + 0.36 * rng());
      else if (g === "-") heading -= angle * (0.82 + 0.36 * rng());
      else if (g === "[") { stack.push([px, py, heading, bd]); bd++; }
      else if (g === "]") { var stp = stack.pop(); if (stp) { px = stp[0]; py = stp[1]; heading = stp[2]; bd = stp[3]; } }
    }
    if (raw.length < 1) return { live: false, strokes: [{ pts: [[0.5, 0.92], [0.5, 0.6]], col: pal.sample(0.5), w: 1.0, op: 0.6 }] };
    var lo = 0.06, hi = 0.94, span = hi - lo;
    var w = Math.max(1e-6, maxX - minX), h = Math.max(1e-6, maxY - minY), scl = span / Math.max(w, h);
    var ox = lo + (span - w * scl) / 2 - minX * scl, oyBase = hi - (maxY - minY) * scl;
    function MX(x) { return clamp(ox + x * scl, 0.04, 0.96); }
    function MY(y) { return clamp(oyBase + (y - minY) * scl, 0.04, 0.96); }
    var strokes = [];
    for (var r = 0; r < raw.length; r++) {
      var seg = raw[r], x0 = MX(seg[0]), y0 = MY(seg[1]), x1 = MX(seg[2]), y1 = MY(seg[3]), dpt = seg[4];
      var dt = maxBD > 0 ? clamp(dpt / maxBD, 0, 1) : 0, taper = lerp(1.18, 0.5, dt), tipOp = lerp(0.92, 0.34, dt * dt);
      var t = field ? clamp(field.lum((x0 + x1) * 0.5, (y0 + y1) * 0.5), 0, 1) : clamp(1 - dt, 0, 1);
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: [[x0, y0], [x1, y1]], col: pal.sample(t), w: clamp(taper, 0.5, 1.2),
        op: clamp(field ? (0.2 + 0.72 * lc) * (0.55 + 0.45 * tipOp) : tipOp * (0.45 + 0.5 * lc), 0, 1) });
    }
    return { live: false, strokes: strokes };
  }

  // 14 ── VORONOI: cellular tessellation by exact half-plane clipping ───────────
  //  K seeds; each cell is the points nearest its seed, found by Sutherland–Hodgman
  //  clipping the bounded plane against every neighbour's perpendicular bisector,
  //  only +,-,*,/ on the geometry. Lloyd relaxation evens the cells into a foam.
  //  The photograph places the seeds (sampleEdge) and tints each wall.
  function buildVoronoi(rng, P, field) {
    var pal = P.palette;
    var K = Math.round(clamp(pget(P, "sites", 120), 40, 220)) | 0;
    var relax = Math.round(clamp(pget(P, "relax", 1), 0, 3)) | 0;
    var BX0 = 0.06, BX1 = 0.94, BY0 = 0.06, BY1 = 0.94;
    var sx = new Float64Array(K), sy = new Float64Array(K);
    for (var i = 0; i < K; i++) {
      var x, y;
      if (field) { var sp = field.sampleEdge(rng); x = clamp(sp[0], BX0, BX1); y = clamp(sp[1], BY0, BY1); }
      else { x = BX0 + (BX1 - BX0) * rng(); y = BY0 + (BY1 - BY0) * rng(); }
      sx[i] = x; sy[i] = y;
    }
    function clipBisector(poly, ax, ay, bx, by) {
      var nx = bx - ax, ny = by - ay, mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, off = nx * mx + ny * my, out = [], n = poly.length >> 1;
      for (var k = 0; k < n; k++) {
        var px = poly[k * 2], py = poly[k * 2 + 1], qx = poly[((k + 1) % n) * 2], qy = poly[((k + 1) % n) * 2 + 1];
        var fp = nx * px + ny * py - off, fq = nx * qx + ny * qy - off, pin = fp <= 0, qin = fq <= 0;
        if (pin) out.push(px, py);
        if (pin !== qin) { var d = fp - fq, t = d !== 0 ? fp / d : 0; out.push(px + (qx - px) * t, py + (qy - py) * t); }
      }
      return out;
    }
    function cellOf(idx) {
      var poly = [BX0, BY0, BX1, BY0, BX1, BY1, BX0, BY1], ax = sx[idx], ay = sy[idx];
      for (var j = 0; j < K; j++) { if (j === idx) continue; poly = clipBisector(poly, ax, ay, sx[j], sy[j]); if (poly.length < 6) return null; }
      return poly;
    }
    for (var rel = 0; rel < relax; rel++) {
      var nxv = new Float64Array(K), nyv = new Float64Array(K);
      for (var sI = 0; sI < K; sI++) {
        var poly = cellOf(sI), m = poly ? (poly.length >> 1) : 0;
        if (m < 3) { nxv[sI] = sx[sI]; nyv[sI] = sy[sI]; continue; }
        var A = 0, Cx = 0, Cy = 0;
        for (var k2 = 0; k2 < m; k2++) {
          var x0 = poly[k2 * 2], y0 = poly[k2 * 2 + 1], x1 = poly[((k2 + 1) % m) * 2], y1 = poly[((k2 + 1) % m) * 2 + 1], cross = x0 * y1 - x1 * y0;
          A += cross; Cx += (x0 + x1) * cross; Cy += (y0 + y1) * cross;
        }
        if (Math.abs(A) < 1e-12) { nxv[sI] = sx[sI]; nyv[sI] = sy[sI]; continue; }
        Cx /= (3 * A); Cy /= (3 * A); nxv[sI] = clamp(Cx, BX0, BX1); nyv[sI] = clamp(Cy, BY0, BY1);
      }
      sx = nxv; sy = nyv;
    }
    var strokes = [];
    for (var c = 0; c < K; c++) {
      var cp = cellOf(c), mm = cp ? (cp.length >> 1) : 0; if (mm < 3) continue;
      var pts = []; for (var k3 = 0; k3 < mm; k3++) pts.push([cp[k3 * 2], cp[k3 * 2 + 1]]);
      var t;
      if (field) t = clamp(field.lum(sx[c], sy[c]), 0, 1);
      else { var dx = sx[c] - 0.5, dy = sy[c] - 0.5; t = clamp(Math.sqrt(dx * dx + dy * dy) / 0.62, 0, 1); }
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: pts, col: pal.sample(t), w: 0.5 + 0.5 * lc, op: field ? (0.22 + 0.6 * lc) : (0.34 + 0.46 * lc), close: true });
    }
    return { live: false, strokes: strokes };
  }

  // 15 ── HEIGHWAY DRAGON: a self-similar fractal curve via paper-folding ───────
  //  Fold a strip in half n times, unfold every crease to a right angle, and the
  //  dragon emerges: tiles the plane, never self-crosses. The i-th turn comes from
  //  the paper-folding sequence by a bit trick; the turtle walks INTEGER 90° dirs
  //  (swap/negate, no trigonometry), so it re-derives bit-for-bit on any machine.
  function buildDragon(rng, P, field) {
    var pal = P.palette;
    var iters = Math.round(clamp(pget(P, "iters", 12), 8, 14)) | 0;
    var twist = Math.round(clamp(pget(P, "twist", 0), 0, 3)) | 0;
    var n = 1 << iters, DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]], dir = twist & 3;
    var x = 0, y = 0, raw = new Array(n + 1); raw[0] = [0, 0];
    var minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (var i = 1; i <= n; i++) {
      x += DIR[dir][0]; y += DIR[dir][1]; raw[i] = [x, y];
      if (x < minX) minX = x; else if (x > maxX) maxX = x;
      if (y < minY) minY = y; else if (y > maxY) maxY = y;
      if (i < n) { var left = (((i & -i) << 1) & i) === 0; dir = left ? (dir + 1) & 3 : (dir + 3) & 3; }
    }
    var margin = 0.06, span = 1 - 2 * margin;
    var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY), scl = span / Math.max(w, h);
    var ox = margin + (span - w * scl) / 2, oy = margin + (span - h * scl) / 2;
    function map(p) { return [ox + (p[0] - minX) * scl, oy + (p[1] - minY) * scl]; }
    var strokes = [], rn = 28, L = raw.length;
    for (var a = 0; a < L - 1; a += rn) {
      var end = Math.min(L - 1, a + rn), seg = [];
      for (var j = a; j <= end; j++) seg.push(map(raw[j]));
      if (seg.length < 2) continue;
      var mid = seg[seg.length >> 1], t = field ? clamp(field.lum(clamp(mid[0], 0, 1), clamp(mid[1], 0, 1)), 0, 1) : (a / L), lc = t * t * (3 - 2 * t);
      strokes.push({ pts: seg, col: pal.sample(t), w: 0.9, op: field ? (0.18 + 0.74 * lc) : (0.34 + 0.5 * lc) });
    }
    return { live: false, strokes: strokes };
  }

  // 16 ── KOCH SNOWFLAKE: replace each edge's middle third with an outward bump ─
  //  Von Koch (1904), the first published fractal: finite area, unbounded length.
  //  Its only constants are ½ and √3/2 (no sin/cos calls), so it re-derives
  //  bit-for-bit on any machine. Starts from a regular polygon (sides), recursed
  //  depth times. The photograph tints the rime.
  function buildKoch(rng, P, field) {
    var pal = P.palette;
    var depth = clamp(Math.round(pget(P, "depth", 4)), 2, 5) | 0;
    var sides = clamp(Math.round(pget(P, "sides", 3)), 3, 6) | 0;
    var SIN60 = Math.sqrt(3) / 2, COS60 = 0.5;
    var pts = [];
    for (var i = 0; i < sides; i++) { var ang = -Math.PI / 2 + (TAU * i) / sides; pts.push([Math.cos(ang), Math.sin(ang)]); }
    function rot(vx, vy, cc, ss) { return [vx * cc - vy * ss, vx * ss + vy * cc]; }
    for (var d = 0; d < depth; d++) {
      var next = [], n = pts.length;
      for (var k = 0; k < n; k++) {
        var A = pts[k], B = pts[(k + 1) % n], dx = B[0] - A[0], dy = B[1] - A[1];
        var P1 = [A[0] + dx / 3, A[1] + dy / 3], P2 = [A[0] + 2 * dx / 3, A[1] + 2 * dy / 3];
        var rr = rot(P2[0] - P1[0], P2[1] - P1[1], COS60, -SIN60), Peak = [P1[0] + rr[0], P1[1] + rr[1]];
        next.push(A, P1, Peak, P2);
      }
      pts = next;
    }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var pI = 0; pI < pts.length; pI++) { var pp = pts[pI]; if (pp[0] < minX) minX = pp[0]; if (pp[1] < minY) minY = pp[1]; if (pp[0] > maxX) maxX = pp[0]; if (pp[1] > maxY) maxY = pp[1]; }
    var LO = 0.08, HI = 0.92, span = HI - LO, wd = (maxX - minX) || 1e-9, ht = (maxY - minY) || 1e-9;
    var scale = span / Math.max(wd, ht), ox = LO + (span - wd * scale) / 2, oy = LO + (span - ht * scale) / 2, ring = [];
    for (var rp = 0; rp < pts.length; rp++) ring.push([clamp(ox + (pts[rp][0] - minX) * scale, 0, 1), clamp(oy + (pts[rp][1] - minY) * scale, 0, 1)]);
    var N = ring.length, RUN = 24, strokes = [], idx = 0, baseW = 0.9, baseOp = 0.95; // NOT reduced-dependent: stroke-width is witnessed, so verify (reduced) must match export
    while (idx < N) {
      var end = Math.min(idx + RUN, N), run = [];
      for (var q = idx; q <= end; q++) run.push(ring[q % N]);
      var mid = ring[Math.min(idx + ((end - idx) >> 1), N - 1)], prog = N > 1 ? idx / N : 0;
      var t = field ? clamp(field.lum(mid[0], mid[1]), 0, 1) : prog;
      strokes.push({ pts: run, col: pal.sample(t), w: baseW, op: baseOp, close: false });
      idx += RUN;
    }
    return { live: false, strokes: strokes };
  }

  // 17 ── DLA: diffusion-limited aggregation (coral · frost · mineral dendrite) ─
  //  Witten–Sander: random walkers spawn on a ring outside the cluster and step one
  //  grid cell at a time until they touch an occupied cell, where they STICK. Growth
  //  starves the interior and races the tips. Geometry lives on an integer grid
  //  (occupancy + per-cell owner) so the aggregate re-derives bit-for-bit.
  function buildDLA(rng, P, field) {
    var pal = P.palette;
    var G = Math.round(lerp(170, 260, P.complexity)) | 0;
    if ((G & 1) === 0) G += 1;
    var N = Math.round(lerp(1400, 5200, P.complexity)) | 0;
    var stick = pget(P, "stick", 1.0);
    var spawn = pget(P, "spawn", 5) | 0;
    var occ = new Uint8Array(G * G), owner = new Int32Array(G * G);
    for (var z = 0; z < owner.length; z++) owner[z] = -1;
    var parent = new Int32Array(N), px = new Int32Array(N), py = new Int32Array(N);
    var cx = (G / 2) | 0, cy = (G / 2) | 0;
    occ[cy * G + cx] = 1; owner[cy * G + cx] = 0; px[0] = cx; py[0] = cy; parent[0] = -1;
    var stuck = 1, maxR = 1, Rcap = (G * 0.5 - 3) * 0.92;
    var OX = [1, -1, 0, 0, 1, 1, -1, -1], OY = [0, 0, 1, -1, 1, -1, 1, -1], budget = N * 2600;
    while (stuck < N && maxR < Rcap && budget > 0) {
      var spawnR = maxR + spawn + 2, ringLim = Rcap + spawn + 2;
      if (spawnR > ringLim) spawnR = ringLim;
      var killR = spawnR + spawn + 8, killR2 = killR * killR;
      var a = rng() * TAU, wx = (cx + Math.cos(a) * spawnR) | 0, wy = (cy + Math.sin(a) * spawnR) | 0;
      var maxSteps = killR * 8 + 64, landed = -1, hits = 0, contactParent = -1;
      for (var s = 0; s < maxSteps && budget > 0; s++) {
        budget--;
        hits = 0; contactParent = -1;
        for (var k = 0; k < 8; k++) {
          var nxk = wx + OX[k], nyk = wy + OY[k];
          if (nxk < 0 || nxk >= G || nyk < 0 || nyk >= G) continue;
          if (occ[nyk * G + nxk]) { hits++; if (contactParent < 0) contactParent = nyk * G + nxk; }
        }
        if (hits >= 1 && occ[wy * G + wx] === 0) { if (stick >= 1 || rng() < stick) { landed = 1; break; } }
        var dd = (rng() * 8) | 0; if (dd > 7) dd = 7; wx += OX[dd]; wy += OY[dd];
        var ddx = wx - cx, ddy = wy - cy;
        if (ddx * ddx + ddy * ddy > killR2) { var ra = rng() * TAU; wx = (cx + Math.cos(ra) * spawnR) | 0; wy = (cy + Math.sin(ra) * spawnR) | 0; }
        if (wx < 1) wx = 1; else if (wx > G - 2) wx = G - 2;
        if (wy < 1) wy = 1; else if (wy > G - 2) wy = G - 2;
      }
      if (landed === 1 && contactParent >= 0) {
        var cell = wy * G + wx; occ[cell] = 1; owner[cell] = stuck;
        parent[stuck] = owner[contactParent]; px[stuck] = wx; py[stuck] = wy;
        var rdx = wx - cx, rdy = wy - cy, rr = Math.sqrt(rdx * rdx + rdy * rdy); if (rr > maxR) maxR = rr;
        stuck++;
      }
    }
    // fit the aggregate's bounding box into art space so it fills the frame at any growth
    var bminX = G, bminY = G, bmaxX = 0, bmaxY = 0;
    for (var b = 0; b < stuck; b++) { if (px[b] < bminX) bminX = px[b]; if (px[b] > bmaxX) bmaxX = px[b]; if (py[b] < bminY) bminY = py[b]; if (py[b] > bmaxY) bmaxY = py[b]; }
    var lo = 0.07, span = 0.86, bw = Math.max(1, bmaxX - bminX), bh = Math.max(1, bmaxY - bminY), scl = span / Math.max(bw, bh);
    var oxx = lo + (span - bw * scl) / 2, oyy = lo + (span - bh * scl) / 2;
    function MD(gx, gy) { return [oxx + (gx - bminX) * scl, oyy + (gy - bminY) * scl]; }
    var strokes = [], denomR = maxR > 0 ? maxR : 1;
    for (var i = 1; i < stuck; i++) {
      var pi = parent[i], pa = MD(px[pi], py[pi]), pb = MD(px[i], py[i]), bx = pb[0], by = pb[1];
      var t;
      if (field) t = clamp(field.lum(clamp(bx, 0, 1), clamp(by, 0, 1)), 0, 1);
      else { var cdx = px[i] - cx, cdy = py[i] - cy; t = clamp(1 - Math.sqrt(cdx * cdx + cdy * cdy) / denomR, 0, 1); }
      strokes.push({ pts: [[pa[0], pa[1]], [bx, by]], col: pal.sample(t), w: 0.55 + 0.45 * t, op: 0.35 + 0.55 * t });
    }
    return { live: false, strokes: strokes };
  }

  // 18 ── PENROSE P3: aperiodic rhombus tiling by Robinson-triangle deflation ────
  //  A "sun" of 10 Robinson triangles, deflated `iters` times in the golden ratio φ:
  //  acute and obtuse triangles each split into smaller ones. The drawn edges are
  //  the two equal legs of every final triangle, deduped so shared rhombus edges
  //  aren't doubled. φ and the deflation are exact; the seed circle uses cos/sin
  //  (trig-class), so deterministic but not claimed bit-for-bit.
  function buildPenrose(rng, P, field) {
    var pal = P.palette, phi = (1 + Math.sqrt(5)) / 2;
    var iters = Math.round(clamp(pget(P, "iters", 5), 3, 6)) | 0;
    var twist = Math.round(clamp(pget(P, "twist", 0), 0, 4)) | 0, rot = twist * (Math.PI / 5), tris = [];
    for (var i = 0; i < 10; i++) {
      var a1 = (2 * i - 1) * Math.PI / 5 + rot, a2 = (2 * i + 1) * Math.PI / 5 + rot;
      var bx = Math.cos(a1), by = Math.sin(a1), cx = Math.cos(a2), cy = Math.sin(a2);
      if (i % 2 === 0) { var tx = bx; bx = cx; cx = tx; var ty = by; by = cy; cy = ty; }
      tris.push([0, 0, 0, bx, by, cx, cy]);
    }
    for (var it = 0; it < iters; it++) {
      var next = [];
      for (var t2 = 0; t2 < tris.length; t2++) {
        var T = tris[t2], col = T[0], ax = T[1], ay = T[2], bx2 = T[3], by2 = T[4], cx2 = T[5], cy2 = T[6];
        if (col === 0) {
          var px = ax + (bx2 - ax) / phi, py = ay + (by2 - ay) / phi;
          next.push([0, cx2, cy2, px, py, bx2, by2]); next.push([1, px, py, cx2, cy2, ax, ay]);
        } else {
          var qx = bx2 + (ax - bx2) / phi, qy = by2 + (ay - by2) / phi, rx = bx2 + (cx2 - bx2) / phi, ry = by2 + (cy2 - by2) / phi;
          next.push([1, rx, ry, cx2, cy2, ax, ay]); next.push([1, qx, qy, rx, ry, bx2, by2]); next.push([0, rx, ry, qx, qy, ax, ay]);
        }
      }
      tris = next;
    }
    var edgeMap = {}, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function pkey(x0, y0, x1, y1) {
      var k0 = Math.round(x0 * 1e5) + "," + Math.round(y0 * 1e5), k1 = Math.round(x1 * 1e5) + "," + Math.round(y1 * 1e5);
      return k0 < k1 ? k0 + "|" + k1 : k1 + "|" + k0;
    }
    function emap(x0, y0, x1, y1) {
      var kk = pkey(x0, y0, x1, y1); if (edgeMap[kk]) return;
      edgeMap[kk] = { x0: x0, y0: y0, x1: x1, y1: y1 };
      if (x0 < minX) minX = x0; if (x0 > maxX) maxX = x0; if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1;
      if (y0 < minY) minY = y0; if (y0 > maxY) maxY = y0; if (y1 < minY) minY = y1; if (y1 > maxY) maxY = y1;
    }
    // the full Robinson-triangle tiling: every unique edge of every deflated triangle
    for (var e = 0; e < tris.length; e++) {
      var E = tris[e];
      emap(E[1], E[2], E[3], E[4]); emap(E[3], E[4], E[5], E[6]); emap(E[5], E[6], E[1], E[2]);
    }
    var edges = [];
    for (var ek in edgeMap) edges.push(edgeMap[ek]);
    if (!edges.length) return { live: false, strokes: [{ pts: [[0.5, 0.45], [0.5, 0.55]], col: pal.sample(0.5), w: 0.9, op: 0.6 }] };
    var lo = 0.06, hi = 0.94, span = hi - lo, bw = Math.max(1e-6, maxX - minX), bh = Math.max(1e-6, maxY - minY), scl = span / Math.max(bw, bh);
    var ox = lo + (span - bw * scl) / 2 - minX * scl, oy = lo + (span - bh * scl) / 2 - minY * scl;
    function MX(x) { return clamp(ox + x * scl, 0.04, 0.96); }
    function MY(y) { return clamp(oy + y * scl, 0.04, 0.96); }
    var strokes = [];
    for (var s = 0; s < edges.length; s++) {
      var ed = edges[s], x0 = MX(ed.x0), y0 = MY(ed.y0), x1 = MX(ed.x1), y1 = MY(ed.y1), mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5, t;
      if (field) t = clamp(field.lum(mx, my), 0, 1);
      else { var ddx = mx - 0.5, ddy = my - 0.5; t = clamp(Math.sqrt(ddx * ddx + ddy * ddy) / 0.62, 0, 1); }
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: [[x0, y0], [x1, y1]], col: pal.sample(t), w: 0.6 + 0.3 * lc, op: field ? (0.24 + 0.62 * lc) : (0.34 + 0.46 * lc) });
    }
    return { live: false, strokes: strokes };
  }

  // 19 ── LIGHTNING / LICHTENBERG: recursive midpoint-displacement discharge ─────
  //  A channel seeks ground through a dielectric: each segment splits at its midpoint,
  //  the midpoint kicked along the perpendicular by a seeded amount, each half
  //  recursing; with probability `branch` a fork peels off, dimmer and thinner. The
  //  lone sin/cos is the fork rotation. A global segment cap bounds high branch/depth.
  function buildLightning(rng, P, field) {
    var pal = P.palette, jitter = pget(P, "jitter", 0.22), branch = pget(P, "branch", 0.35);
    var depth0 = Math.round(lerp(7, 10, P.complexity)), SEG_CAP = 9000, segs = [];
    function bolt(ax, ay, bx, by, displace, depth, intensity) {
      if (segs.length >= SEG_CAP) return;
      if (depth <= 0) { segs.push({ a: [ax, ay], b: [bx, by], it: intensity }); return; }
      var midx = (ax + bx) * 0.5, midy = (ay + by) * 0.5, dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      var px = -dy / len, py = dx / len, off = (rng() - 0.5) * displace;
      midx += px * off; midy += py * off;
      bolt(ax, ay, midx, midy, displace * 0.5, depth - 1, intensity);
      if (branch > 0 && depth > 1 && segs.length < SEG_CAP) {
        if (rng() < branch) {
          var ddx = midx - ax, ddy = midy - ay, dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1e-6, ux = ddx / dl, uy = ddy / dl;
          var sign = rng() < 0.5 ? -1 : 1, ang = sign * lerp(0.3, 0.8, rng()), ca = Math.cos(ang), sa = Math.sin(ang);
          var fx = ux * ca - uy * sa, fy = ux * sa + uy * ca, flen = dl * lerp(0.5, 0.8, rng());
          bolt(midx, midy, midx + fx * flen, midy + fy * flen, displace * 0.5, depth - 1, intensity * 0.62);
        }
      }
      bolt(midx, midy, bx, by, displace * 0.5, depth - 1, intensity);
    }
    var startX = 0.5 + (rng() - 0.5) * 0.18, endX = clamp(startX + (rng() - 0.5) * 0.5, 0.12, 0.88);
    bolt(startX, 0.07, endX, 0.92, jitter, depth0, 1.0);
    var extra = 1 + (rng() < 0.5 ? 1 : 0);
    for (var ex = 0; ex < extra && segs.length < SEG_CAP; ex++) {
      var sx = 0.5 + (rng() - 0.5) * 0.22, ex2 = clamp(sx + (rng() - 0.5) * 0.5, 0.12, 0.88);
      bolt(sx, 0.07, ex2, 0.92, jitter * lerp(0.7, 1.0, rng()), depth0 - 1, lerp(0.55, 0.8, rng()));
    }
    var strokes = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], itv = s.it, falloff = clamp(itv, 0, 1);
      var mx = clamp((s.a[0] + s.b[0]) * 0.5, 0, 1), my = clamp((s.a[1] + s.b[1]) * 0.5, 0, 1);
      var tint = field ? clamp(field.lum(mx, my), 0, 1) : clamp(0.25 + 0.75 * itv, 0, 1);
      strokes.push({ pts: [[clamp(s.a[0], 0.04, 0.96), clamp(s.a[1], 0.04, 0.96)], [clamp(s.b[0], 0.04, 0.96), clamp(s.b[1], 0.04, 0.96)]],
        col: pal.sample(tint), w: lerp(0.5, 1.15, itv), op: clamp(0.25 + 0.7 * itv * falloff, 0, 1) });
    }
    return { live: false, strokes: strokes };
  }

  // 20 ── MAURER ROSE: a rhodonea walked at fixed integer-degree strides ─────────
  //  r = sin(n·theta) sampled by a straight-line walk every d degrees: the chords
  //  between the 360 sample points weave the Maurer lattice the smooth petals only
  //  hint at. r stays signed. A faint fine-sampled rose is laid underneath. Trig-class.
  function buildMaurer(rng, P, field) {
    var pal = P.palette, n = clamp(Math.round(pget(P, "n", 6)), 2, 13) | 0, d = clamp(Math.round(pget(P, "d", 71)), 11, 359) | 0;
    var DEG = Math.PI / 180, web = [];
    for (var k = 0; k <= 360; k++) { var th = k * d * DEG, r = Math.sin(n * th); web.push([r * Math.cos(th), r * Math.sin(th)]); }
    var SM = Math.round(lerp(720, 1440, clamp(P.complexity, 0, 1))) | 0, smooth = [];
    for (var sm0 = 0; sm0 <= SM; sm0++) { var ts = (sm0 / SM) * TAU, rs = Math.sin(n * ts); smooth.push([rs * Math.cos(ts), rs * Math.sin(ts)]); }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function bbox(arr) { for (var i = 0; i < arr.length; i++) { var p = arr[i]; if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; } }
    bbox(web); bbox(smooth);
    var lo = 0.07, hi = 0.93, span = hi - lo, bw = Math.max(1e-6, maxX - minX), bh = Math.max(1e-6, maxY - minY), scl = span / Math.max(bw, bh);
    var ox = lo + (span - bw * scl) / 2 - minX * scl, oy = lo + (span - bh * scl) / 2 - minY * scl;
    function MX(x) { return clamp(ox + x * scl, 0.04, 0.96); }
    function MY(y) { return clamp(oy + y * scl, 0.04, 0.96); }
    var strokes = [], RUN = 24, NS = smooth.length, si = 0;
    while (si < NS - 1) {
      var se = Math.min(si + RUN, NS - 1), srun = [];
      for (var q = si; q <= se; q++) srun.push([MX(smooth[q][0]), MY(smooth[q][1])]);
      if (srun.length >= 2) { var smid = srun[srun.length >> 1], sprog = NS > 1 ? si / NS : 0, stt = field ? clamp(field.lum(smid[0], smid[1]), 0, 1) : sprog;
        strokes.push({ pts: srun, col: pal.sample(stt), w: 0.5, op: 0.12 }); }
      si += RUN;
    }
    var NW = web.length, wi = 0;
    while (wi < NW - 1) {
      var we = Math.min(wi + RUN, NW - 1), wrun = [];
      for (var w = wi; w <= we; w++) wrun.push([MX(web[w][0]), MY(web[w][1])]);
      if (wrun.length >= 2) { var wmid = wrun[wrun.length >> 1], wprog = NW > 1 ? wi / NW : 0, t = field ? clamp(field.lum(wmid[0], wmid[1]), 0, 1) : wprog, lc = t * t * (3 - 2 * t);
        strokes.push({ pts: wrun, col: pal.sample(t), w: 0.6 + 0.4 * lc, op: field ? (0.3 + 0.55 * lc) : (0.4 + 0.45 * lc) }); }
      wi += RUN;
    }
    return { live: false, strokes: strokes };
  }

  // 21 ── CLIFFORD ATTRACTOR: deterministic chaos folding a plane ────────────────
  //  Iterate x'=sin(ay)+c·cos(ax), y'=sin(bx)+d·cos(by); the orbit never repeats yet
  //  never escapes. a,b are witnessed knobs; c,d are bent by the seed. Skip the
  //  transient, fit the bbox, draw as low-opacity runs so density builds the web.
  function buildClifford(rng, P, field) {
    var pal = P.palette, a = clamp(pget(P, "a", 1.7), -2.2, 2.2), b = clamp(pget(P, "b", -1.8), -2.2, 2.2);
    var c = lerp(-1.6, 1.6, rng()), d = lerp(-1.6, 1.6, rng()), TRANSIENT = 600, COLLECT = Math.round(lerp(9000, 16000, clamp(P.complexity, 0, 1))) | 0;
    var x = (rng() - 0.5) * 0.01, y = (rng() - 0.5) * 0.01, xs = new Float64Array(COLLECT), ys = new Float64Array(COLLECT);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sumX = 0, sumY = 0, got = 0, total = TRANSIENT + COLLECT;
    for (var i = 0; i < total; i++) {
      var nx = Math.sin(a * y) + c * Math.cos(a * x), ny = Math.sin(b * x) + d * Math.cos(b * y);
      if (!isFinite(nx) || !isFinite(ny)) { x = 0; y = 0; continue; }
      x = nx; y = ny; if (i < TRANSIENT) continue;
      xs[got] = x; ys[got] = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      sumX += x; sumY += y; got++;
    }
    if (got < 2) return { live: false, strokes: [{ pts: [[0.5, 0.45], [0.5, 0.55]], col: pal.sample(0.5), w: 0.9, op: 0.6 }] };
    var lo = 0.06, hi = 0.94, span = hi - lo, bw = Math.max(1e-4, maxX - minX), bh = Math.max(1e-4, maxY - minY), scl = span / Math.max(bw, bh);
    var ox = lo + (span - bw * scl) / 2 - minX * scl, oy = lo + (span - bh * scl) / 2 - minY * scl;
    var cenX = (sumX / got) * scl + ox, cenY = (sumY / got) * scl + oy;
    function MX(v) { return clamp(ox + v * scl, 0.04, 0.96); }
    function MY(v) { return clamp(oy + v * scl, 0.04, 0.96); }
    var RUN = 60, strokes = [];
    for (var s = 0; s < got; s += RUN) {
      var end = Math.min(got, s + RUN), pts = [];
      for (var j = s; j < end; j++) pts.push([MX(xs[j]), MY(ys[j])]);
      if (pts.length < 2) continue;
      var mid = (s + end - 1) >> 1, mxx = MX(xs[mid]), myy = MY(ys[mid]), t;
      if (field) t = clamp(field.lum(mxx, myy), 0, 1);
      else { var ddx = mxx - cenX, ddy = myy - cenY; t = clamp(Math.sqrt(ddx * ddx + ddy * ddy) / 0.62, 0, 1); }
      var lc = t * t * (3 - 2 * t);
      strokes.push({ pts: pts, col: pal.sample(t), w: 0.6 + 0.3 * lc, op: 0.06 + 0.1 * (field ? (0.35 + 0.65 * t) : (0.4 + 0.6 * lc)) });
    }
    if (!strokes.length) return { live: false, strokes: [{ pts: [[MX(xs[0]), MY(ys[0])], [MX(xs[got - 1]), MY(ys[got - 1])]], col: pal.sample(0.5), w: 0.9, op: 0.14 }] };
    return { live: false, strokes: strokes };
  }

  // ── FIELD STUDIES: implicit scalar fields drawn as marching-squares iso-contours ──
  // studio-engine's substrate, native to the plotter: a closed-form field f(u,v) over
  // [-1,1]^2 is sampled + contoured into strokes, so it flows through the same
  // optimise → witness → verify → SVG pipeline as every study, and is reconcile-scored.
  function fieldContours(P, fieldFn, bands) {
    var G = Math.round(lerp(96, 168, P.complexity)), N = bands || 5;
    var vals = new Float32Array(G * G), lo = Infinity, hi = -Infinity;
    for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
      var val = fieldFn((gx / (G - 1)) * 2 - 1, (gy / (G - 1)) * 2 - 1);
      vals[gy * G + gx] = val; if (val < lo) lo = val; if (val > hi) hi = val;
    }
    var span = (hi - lo) || 1e-6, pal = P.palette, inv = 1 / (G - 1), strokes = [];
    for (var li = 0; li < N; li++) {
      var lev = lo + span * (li + 0.5) / N;
      for (var y = 0; y < G - 1; y++) for (var x = 0; x < G - 1; x++) {
        var a = vals[y * G + x], b = vals[y * G + x + 1], c = vals[(y + 1) * G + x + 1], d = vals[(y + 1) * G + x];
        var code = (a > lev ? 1 : 0) | (b > lev ? 2 : 0) | (c > lev ? 4 : 0) | (d > lev ? 8 : 0);
        if (code === 0 || code === 15) continue;
        var segs = MS_TABLE[code];
        for (var si = 0; si < segs.length; si++) {
          strokes.push({
            pts: [edgePt(segs[si][0], x, y, a, b, c, d, lev, inv), edgePt(segs[si][1], x, y, a, b, c, d, lev, inv)],
            col: pal.sample(clamp((a - lo) / span, 0, 1)), w: 0.6 + li * 0.12, op: 0.55
          });
        }
      }
    }
    return { live: false, strokes: strokes };
  }
  function buildGyroid(rng, P) {
    var f = pget(P, "freq", 7) * Math.PI, zz = pget(P, "z", 0.3) * TAU;
    return fieldContours(P, function (u, v) {
      return Math.sin(u * f) * Math.cos(v * f) + Math.sin(v * f) * Math.cos(zz) + Math.sin(zz) * Math.cos(u * f);
    }, 6);
  }
  function buildQuasicrystal(rng, P) {
    var w = Math.round(pget(P, "waves", 5)), s = pget(P, "scale", 8), dirs = [];
    for (var k = 0; k < w; k++) { var ang = TAU * k / w; dirs.push([Math.cos(ang), Math.sin(ang)]); }
    return fieldContours(P, function (u, v) {
      var sum = 0; for (var k = 0; k < dirs.length; k++) sum += Math.cos((dirs[k][0] * u + dirs[k][1] * v) * s); return sum;
    }, 6);
  }
  function buildRings(rng, P) {
    var f = pget(P, "freq", 8) * Math.PI;
    return fieldContours(P, function (u, v) { return Math.sin(Math.sqrt(u * u + v * v) * f); }, 7);
  }
  function buildMoire(rng, P) {
    var f = pget(P, "freq", 12), a = pget(P, "angle", 0.4), ca = Math.cos(a), sa = Math.sin(a);
    return fieldContours(P, function (u, v) { return Math.sin(f * u) * Math.sin(f * (u * ca + v * sa)); }, 6);
  }
  function buildFlowfield(rng, P) {
    var s = pget(P, "scale", 4.5), w = pget(P, "warp", 1.2);
    return fieldContours(P, function (u, v) {
      return Math.sin(s * u + w * Math.sin(s * v)) * Math.cos(s * v + w * Math.cos(s * u));
    }, 6);
  }
  function buildTurbulence(rng, P) {
    var f0 = pget(P, "freq", 3), oct = Math.round(pget(P, "octaves", 4)), g = pget(P, "gain", 0.55);
    return fieldContours(P, function (u, v) {
      var acc = 0, amp = 0;
      for (var o = 0; o < oct; o++) { var fr = f0 * Math.pow(2, o), a = Math.pow(g, o); acc += a * Math.sin(fr * u + Math.sin(fr * v)) * Math.cos(fr * v); amp += a; }
      return amp ? acc / amp : 0;
    }, 6);
  }
  function buildMetaballs(rng, P) {
    var count = Math.round(pget(P, "count", 5)), spread = pget(P, "spread", 0.34), bands = Math.round(pget(P, "bands", 7)), balls = [];
    for (var i = 0; i < count; i++) balls.push([(rng() * 2 - 1) * 0.7, (rng() * 2 - 1) * 0.7, spread * (0.75 + 0.5 * rng())]);
    return fieldContours(P, function (u, v) {
      var t = 0; for (var i = 0; i < balls.length; i++) { var dx = u - balls[i][0], dy = v - balls[i][1], r = balls[i][2]; t += r * r / (dx * dx + dy * dy + 1e-3); }
      return Math.sqrt(t); // compress the peaked potential so contour levels spread into the blob bodies
    }, bands);
  }

  var STUDIES = [
    { id: "phyllotaxis", label: "Phyllotaxis", build: buildPhyllotaxis,
      blurb: "Vogel&rsquo;s spiral: a seed every <b>golden angle</b>, radius as &radic;index. The Fibonacci arms you see are emergent, never drawn. <span class='sp'>The snail</span> lights which arms are bright." },
    { id: "flow", label: "Flow field", build: buildFlow,
      blurb: "Thousands of particles traced through warped noise and bent along the photograph&rsquo;s contours, so the specimen surfaces in the current. <span class='sp'>Every seed</span> is a different weather." },
    { id: "growth", label: "Differential growth", build: buildGrowth,
      blurb: "A closed curve that repels itself and lengthens, folding as it goes, the buckling that curls a drying seedhead. <span class='sp'>Watch it</span> draw in real time." },
    { id: "venation", label: "Venation", build: buildVenation,
      blurb: "Veins grow from the centre toward scattered sources, thickening with their load, the model botanists use for real leaf-veins. <span class='sp'>The mallow</span> places the sources." },
    { id: "reaction", label: "Reaction&ndash;diffusion", build: buildReaction,
      blurb: "Gray&ndash;Scott: two chemicals feed, react and decay until <b>Turing patterns</b> set (spots, mazes, coral), drawn here as contour lines. The photograph&rsquo;s light decides which pattern forms where. <span class='sp'>Watch it</span> react. <span class='sp'>The katydids&rsquo;</span> speckle, as mathematics." },
    { id: "physarum", label: "Slime mould", build: buildPhysarum,
      blurb: "Thousands of agents lay a trail and turn toward where it (and the photograph&rsquo;s light) runs strongest; the trail diffuses and decays behind them. Reinforced paths thicken into a transport network, the way <i>Physarum</i> slime mould finds the shortest route through a maze. The brightest tissue becomes the busiest road. <span class='sp'>Watch it</span> forage." },
    { id: "boids", label: "Boids", build: buildBoids,
      blurb: "Reynolds&rsquo; flock: each agent steers by three local rules (<b>separation</b>, <b>alignment</b>, <b>cohesion</b>) over the neighbours inside its vision, found through a grid hash. No leader, no path; the murmuration is emergent. The photograph&rsquo;s light pulls the flock toward the bright tissue. <span class='sp'>Watch it</span> school. After Reynolds, SIGGRAPH 1987." },
    { id: "orbital", label: "Orbitals", build: buildOrbital, ghost: false,
      blurb: "The hydrogen atom solved exactly: <b>Schr&ouml;dinger&rsquo;s</b> 1926 wave equation, &psi;<sub>n,l</sub> = R<sub>nl</sub>(r)&middot;Y<sub>l0</sub>(&theta;). The squared wavefunction |&psi;|&sup2; is the electron&rsquo;s probability cloud, drawn as iso-probability contours through the nucleus. The dark gaps are real <b>nodes</b> (n&minus;l&minus;1 radial, l angular) where the electron is never found. <span class='sp'>The defaults</span> draw 3d<sub>z&sup2;</sub>, the atom&rsquo;s own geometry. <i>After Kavan (kevkev-70).</i>" },
    { id: "hilbert", label: "Hilbert", build: buildHilbert,
      blurb: "Hilbert&rsquo;s space-filling curve (1891): one continuous pen stroke that visits <b>every cell</b> of the plane exactly once. The whole path is pure integer arithmetic (no trigonometry, no roots) so it re-derives <b>bit-for-bit on any machine</b>: that exactness is the point. The specimen is rendered <i>as</i> the single stroke, runs tinted by the photograph&rsquo;s light." },
    { id: "binomial", label: "Pascal", build: buildBinomial,
      blurb: "The binomial theorem made visible: <b>Pascal&rsquo;s triangle</b>, C(i,j) = C(i&minus;1,j&minus;1) + C(i&minus;1,j), computed entirely <b>mod m</b>. The non-zero cells form a self-similar fractal: mod 2 is the <b>Sierpi&#324;ski gasket</b>, every modulus its own nesting. Pure integer arithmetic, so it re-derives <b>bit-for-bit on any machine</b>. The photograph tints the cells; the structure is the coefficients&rsquo; own." },
    { id: "harmonograph", label: "Harmonograph", build: buildHarmonograph,
      blurb: "Two damped pendulums per axis, a real 19th-century drawing machine. Near-integer frequency ratios make the figure precess into a dense weave as the swing decays; no two seeds wind the same way. <span class='sp'>The specimen</span> colours the curve as it passes." },
    { id: "gosper", label: "Gosper", build: buildGosper,
      blurb: "The flowsnake: one continuous stroke that tiles the plane in hexagons, a fractal coastline that never crosses itself. Rewriting <b>A&rarr;A-B--B+A++AA+B-</b> at 60&deg;, its six directions use only &frac12; and &radic;3/2, so it re-derives <b>bit-for-bit on any machine</b>. <span class='sp'>The specimen</span> tints each run." },
    { id: "lsystem", label: "L&#8209;system", build: buildLSystem,
      blurb: "A Lindenmayer system: one rewrite rule, applied to itself, grows a branching plant, the same recursive self-similarity a real fern or tree builds by. The turtle reads the rewritten string, turning by <b>sin/cos</b> at each fork; each seed jitters the branch angles, so no two plants are alike. <span class='sp'>The specimen</span> lights the canopy." },
    { id: "voronoi", label: "Voronoi", build: buildVoronoi,
      blurb: "A Voronoi tessellation: every point of the plane joins its nearest seed, and the borders are the cell walls, the partition a foam, a leaf&rsquo;s areoles, or a sheet of cells settles into. Built by clipping each cell against its neighbours&rsquo; bisectors, exact arithmetic. <span class='sp'>The specimen</span> places the seeds and tints the cells." },
    { id: "dragon", label: "Dragon", build: buildDragon,
      blurb: "The Heighway dragon: fold a strip in half the same way over and over, unfold to right angles, and a self-similar curve that tiles the plane without crossing emerges. Pure 90&deg; integer turns (no trigonometry) so it re-derives <b>bit-for-bit on any machine</b>. <span class='sp'>The specimen</span> tints the fold." },
    { id: "koch", label: "Koch", build: buildKoch,
      blurb: "Von Koch&rsquo;s snowflake: replace the middle third of every edge with an outward equilateral bump, recursively, into a curve of finite area but unbounded length, the first published fractal (1904). Its only constants are &frac12; and &radic;3/2, so it re-derives <b>bit-for-bit on any machine</b>. <span class='sp'>The specimen</span> tints the rime." },
    { id: "dla", label: "DLA", build: buildDLA,
      blurb: "Witten&ndash;Sander aggregation: random walkers stick where they first touch the cluster, so growth starves the interior and races the tips, the branching of coral, frost, and mineral dendrites. Held on an integer grid, so it re-derives <b>bit-for-bit</b>. <span class='sp'>The specimen</span> tints each branch." },
    { id: "penrose", label: "Penrose", build: buildPenrose,
      blurb: "A Penrose tiling: Robinson triangles deflated in the golden ratio &phi; cover the plane with five-fold symmetry but <em>never</em> repeat, the aperiodic order later found in real quasicrystals. The seed sun uses sin/cos, so it is deterministic, not bit-for-bit. <span class='sp'>The specimen</span> tints the tiling." },
    { id: "lightning", label: "Lightning", build: buildLightning,
      blurb: "Recursive midpoint displacement: a channel forks and jitters at every halving, the way a Lichtenberg figure or a lightning stroke seeks ground through a dielectric. The geometry is perpendicular offset and arithmetic; the only <b>sin/cos</b> is the angle each fork peels off at. <span class='sp'>The specimen</span> tints the discharge." },
    { id: "maurer", label: "Maurer rose", build: buildMaurer,
      blurb: "A Maurer rose: walk the rhodonea r = sin(n&theta;) in fixed-degree strides and the straight chords weave a lattice the smooth petals only hint at, order from a deliberately coarse sampling, on a curve of pure <b>sin/cos</b>. Different <em>n</em> and step give wildly different webs. <span class='sp'>The specimen</span> tints the weave." },
    { id: "clifford", label: "Attractor", build: buildClifford,
      blurb: "A Clifford attractor: iterate x&prime;=sin(ay)+c&middot;cos(ax), y&prime;=sin(bx)+d&middot;cos(by) and the orbit never repeats yet never escapes: deterministic chaos folding a plane into a strange attractor. <b>a</b> and <b>b</b> are yours; each seed bends <em>c,d</em> into a new creature. <span class='sp'>The specimen</span> tints the cloud." },
    { id: "gyroid", label: "Gyroid", build: buildGyroid, ghost: false,
      blurb: "A triply-periodic minimal surface, sliced and drawn as iso-contours: the same field a <b>studio-engine</b> generator emits, here as plottable lines. <b>Clean tiling</b> is judged against integer frequency, a property the field didn&rsquo;t choose. <span class='sp'>Pure math.</span>" },
    { id: "quasicrystal", label: "Quasicrystal", build: buildQuasicrystal, ghost: false,
      blurb: "Plane waves at evenly spaced angles interfere into an aperiodic pattern: <b>five-fold</b> order that never repeats, drawn as contours. The reconcile judges it against the five-fold ideal it didn&rsquo;t author. <span class='sp'>Pure math.</span>" },
    { id: "rings", label: "Rings", build: buildRings, ghost: false,
      blurb: "Concentric interference rings: sin of the radius, the simplest field, contoured. Judged for balance, coverage, contrast and complexity it didn&rsquo;t set. <span class='sp'>Pure math.</span>" },
    { id: "moire", label: "Moir&eacute;", build: buildMoire, ghost: false,
      blurb: "Two rotated gratings multiplied: the beat pattern where they cross, drawn as contours. <span class='sp'>Pure math.</span>" },
    { id: "flowfield", label: "Curl field", build: buildFlowfield, ghost: false,
      blurb: "A domain-warped potential (each axis bent by a sinusoid of the other) drawn as the iso-contours of its flow. The closed-form sibling of the particle Flow field. <span class='sp'>Pure math.</span>" },
    { id: "turbulence", label: "Turbulence", build: buildTurbulence, ghost: false,
      blurb: "Fractal Brownian motion: octaves of a sinusoidal basis summed at doubling frequency and halving amplitude, the self-similar roughness of smoke and cloud, drawn as contours. <span class='sp'>Pure math.</span>" },
    { id: "metaballs", label: "Metaballs", build: buildMetaballs, ghost: false,
      blurb: "Inverse-square charges summed into a smooth potential; the iso-contours are the classic blobby threshold where the fields merge. Each seed re-places the charges. <span class='sp'>Pure math.</span>" },
    { id: "live", label: "Live &middot; camera", build: null,
      blurb: "The camera as a real organ: particles stream along the edges it senses, live." }
  ];
  var SPECIMENS = [
    { id: "none", label: "Pure math", src: null }
  ];
  var PALETTE_CHIPS = [
    { id: "spectrum", label: "Spectrum" }, { id: "ember", label: "Ember" },
    { id: "cool", label: "Cool" }, { id: "chitin", label: "Chitin" },
    { id: "marrow", label: "Marrow" }, { id: "verdigris", label: "Verdigris" },
    { id: "biolume", label: "Biolume" }, { id: "mono", label: "Monoline" }
  ];

  // ── renderer ────────────────────────────────────────────────────────────────
  var MARGIN = 0.055; // shared by canvas and SVG so they match
  function drawStrokes(ctx, W, H, strokes, frac) {
    ctx.clearRect(0, 0, W, H);
    var inner = Math.min(W, H) * (1 - 2 * MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
    var wScale = inner / 1000;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var total = 0, ti; for (ti = 0; ti < strokes.length; ti++) total += strokes[ti].pts.length;
    var budget = frac >= 1 ? total : Math.floor(total * frac), spent = 0;
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i], pts = s.pts, np = pts.length;
      if (spent >= budget) break;
      var take = np;
      if (spent + np > budget) take = budget - spent;
      spent += np;
      if (take < 2) continue;
      ctx.globalAlpha = s.op == null ? 1 : s.op;
      ctx.strokeStyle = s.col;
      ctx.lineWidth = Math.max(0.4, (s.w || 1) * wScale);
      ctx.beginPath();
      ctx.moveTo(offx + pts[0][0] * inner, offy + pts[0][1] * inner);
      for (var j = 1; j < take; j++) ctx.lineTo(offx + pts[j][0] * inner, offy + pts[j][1] * inner);
      if (s.close && take === np) ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── advanced studio render: the same witnessed lines, rendered with depth ─────
  // paintRich draws ONLY to the screen canvas. It never touches finalStrokes,
  // optimizeForPlot, hashOpt or plotSVG, so the exported plot and its SHA-256
  // witness are byte-identical to before. Screen = an inked, luminous reading of
  // the plot; the plot itself stays the clean single-stroke pen file.
  var GHOST_CACHE = {}, GHOST_GID = 0;
  function fieldGhost(field, palId) {
    if (!field || !field.lum) return null;
    if (field._gid == null) field._gid = ++GHOST_GID;
    var key = field._gid + "|" + palId;
    if (GHOST_CACHE[key]) return GHOST_CACHE[key];
    var G = 168, off = document.createElement("canvas"); off.width = G; off.height = G;
    var g = off.getContext("2d"), img = g.createImageData(G, G), d = img.data;
    var pal = PALETTES[palId] || PALETTES.spectrum;
    var lo = hexToRgb(pal[0]), hi = hexToRgb(pal[pal.length - 1]);
    for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
      var l = clamp(field.lum((x + 0.5) / G, (y + 0.5) / G), 0, 1);
      var sh = l * l * (3 - 2 * l); // smoothstep, let highlights carry the form
      var i = (y * G + x) * 4;
      d[i] = lerp(lo[0], hi[0], sh); d[i + 1] = lerp(lo[1], hi[1], sh);
      d[i + 2] = lerp(lo[2], hi[2], sh); d[i + 3] = Math.round(255 * (0.15 + 0.85 * sh));
    }
    g.putImageData(img, 0, 0);
    GHOST_CACHE[key] = off; return off;
  }
  function paintRich(ctx, W, H, strokes, field, palId) {
    ctx.clearRect(0, 0, W, H);
    var inner = Math.min(W, H) * (1 - 2 * MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
    var wScale = inner / 1000;
    // 1. perceived-field ghost: the specimen the algorithm actually read, faint behind the art
    var ghost = fieldGhost(field, palId);
    if (ghost) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.27;
      try { ctx.filter = "blur(2px)"; } catch (e) {}
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ghost, offx, offy, inner, inner);
      ctx.restore();
    }
    // 2. the lines, twice: a wide additive bloom for luminous depth, then crisp ink on top
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    function pass(widthMul, alphaMul, comp) {
      ctx.globalCompositeOperation = comp;
      for (var i = 0; i < strokes.length; i++) {
        var s = strokes[i], pts = s.pts, np = pts.length; if (np < 2) continue;
        ctx.globalAlpha = clamp((s.op == null ? 1 : s.op) * alphaMul, 0, 1);
        ctx.strokeStyle = s.col;
        ctx.lineWidth = Math.max(0.35, (s.w || 1) * wScale * widthMul);
        ctx.beginPath();
        ctx.moveTo(offx + pts[0][0] * inner, offy + pts[0][1] * inner);
        for (var j = 1; j < np; j++) ctx.lineTo(offx + pts[j][0] * inner, offy + pts[j][1] * inner);
        if (s.close) ctx.closePath();
        ctx.stroke();
      }
    }
    pass(3.6, 0.16, "lighter");    // halo: overlaps build warmth, the organic glow
    pass(1.0, 1.0, "source-over"); // crisp pen line
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  // ── SVG export (plotter-ready: single-stroke paths, grouped by pen colour) ───
  function toSVG(strokes, meta) {
    var S = 1000, inner = S * (1 - 2 * MARGIN), off = S * MARGIN;
    function X(x) { return (off + x * inner).toFixed(1); }
    function Y(y) { return (off + y * inner).toFixed(1); }
    var groups = {};
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i]; if (!s.pts || s.pts.length < 2) continue;
      var d = "M" + X(s.pts[0][0]) + " " + Y(s.pts[0][1]);
      for (var j = 1; j < s.pts.length; j++) d += " L" + X(s.pts[j][0]) + " " + Y(s.pts[j][1]);
      if (s.close) d += " Z";
      var key = s.col;
      (groups[key] || (groups[key] = [])).push('<path d="' + d + '" stroke-width="' + (s.w || 1).toFixed(2) + '" stroke-opacity="' + (s.op == null ? 1 : s.op).toFixed(2) + '"/>');
    }
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">',
      '<!-- ' + meta + ' -->',
      '<rect width="1000" height="1000" fill="#0d1b1c"/>',
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'];
    for (var col in groups) { out.push('<g stroke="' + col + '">'); out.push(groups[col].join("\n")); out.push("</g>"); }
    out.push("</g></svg>");
    return out.join("\n");
  }

  // ── plot optimisation: segment soup → clean, ordered, continuous pen paths ───
  // The thesis applied to the tool's own output: don't ship "good enough" line
  // soup. Stitch shared endpoints into continuous strokes, simplify, order to
  // minimise pen-up travel, and account for exactly what changed.
  function ptKey(p) { return (Math.round(p[0] * 1e5)) + "," + (Math.round(p[1] * 1e5)); }
  function stitch(polys) {
    var n = polys.length, used = new Uint8Array(n), ends = {};
    for (var i = 0; i < n; i++) {
      var pp = polys[i], k0 = ptKey(pp[0]), k1 = ptKey(pp[pp.length - 1]);
      (ends[k0] || (ends[k0] = [])).push(i); (ends[k1] || (ends[k1] = [])).push(i);
    }
    function match(key) { var l = ends[key]; if (!l) return -1; for (var k = 0; k < l.length; k++) if (!used[l[k]]) return l[k]; return -1; }
    var chains = [];
    for (var s = 0; s < n; s++) {
      if (used[s]) continue; used[s] = 1;
      var chain = polys[s].slice();
      for (; ;) { // extend tail
        var tk = ptKey(chain[chain.length - 1]), j = match(tk); if (j < 0) break; used[j] = 1;
        var add = polys[j], seq = (ptKey(add[0]) === tk) ? add.slice(1) : add.slice(0, add.length - 1).reverse();
        for (var a = 0; a < seq.length; a++) chain.push(seq[a]);
      }
      for (; ;) { // extend head
        var hk = ptKey(chain[0]), j2 = match(hk); if (j2 < 0) break; used[j2] = 1;
        var ad = polys[j2], pre = (ptKey(ad[ad.length - 1]) === hk) ? ad.slice(0, ad.length - 1) : ad.slice(1).reverse();
        chain = pre.concat(chain);
      }
      chains.push(chain);
    }
    return chains;
  }
  function rdp(pts, eps) { // Douglas–Peucker
    if (pts.length < 3) return pts;
    var keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
    var stack = [[0, pts.length - 1]], e2 = eps * eps;
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1];
      var ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, L = dx * dx + dy * dy;
      var maxD = -1, maxI = -1;
      for (var i = a + 1; i < b; i++) {
        var t = L > 0 ? ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var qx = pts[i][0] - (ax + t * dx), qy = pts[i][1] - (ay + t * dy), d = qx * qx + qy * qy;
        if (d > maxD) { maxD = d; maxI = i; }
      }
      if (maxD > e2 && maxI > 0) { keep[maxI] = 1; stack.push([a, maxI]); stack.push([maxI, b]); }
    }
    var o = []; for (var k = 0; k < pts.length; k++) if (keep[k]) o.push(pts[k]); return o;
  }
  function orderPaths(paths) { // greedy nearest-neighbour, flip as needed → least pen-up travel
    var n = paths.length; if (n < 2) return paths;
    var used = new Uint8Array(n), out = [], cur = [0, 0];
    for (var k = 0; k < n; k++) {
      var best = -1, rev = false, bd = Infinity;
      for (var i = 0; i < n; i++) {
        if (used[i]) continue;
        var h = paths[i][0], t = paths[i][paths[i].length - 1];
        var dh = (h[0] - cur[0]) * (h[0] - cur[0]) + (h[1] - cur[1]) * (h[1] - cur[1]);
        var dt = (t[0] - cur[0]) * (t[0] - cur[0]) + (t[1] - cur[1]) * (t[1] - cur[1]);
        if (dh < bd) { bd = dh; best = i; rev = false; } if (dt < bd) { bd = dt; best = i; rev = true; }
      }
      used[best] = 1; var pth = rev ? paths[best].slice().reverse() : paths[best];
      out.push(pth); cur = pth[pth.length - 1];
    }
    return out;
  }
  function optimizeForPlot(strokes, opts) {
    opts = opts || {}; var tol = opts.tol == null ? 0.0007 : opts.tol;
    var byCol = {}, wByCol = {}, segIn = 0, ptsIn = 0, travelBefore = 0, prev = null;
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i]; if (!s.pts || s.pts.length < 2) continue; segIn++; ptsIn += s.pts.length;
      (byCol[s.col] || (byCol[s.col] = [])).push(s.pts); (wByCol[s.col] || (wByCol[s.col] = [])).push(s.w || 1);
      if (prev) travelBefore += Math.hypot(s.pts[0][0] - prev[0], s.pts[0][1] - prev[1]); prev = s.pts[s.pts.length - 1];
    }
    var pens = [], pathsOut = 0, ptsOut = 0, travelAfter = 0;
    for (var col in byCol) {
      var chains = stitch(byCol[col]);
      for (var c = 0; c < chains.length; c++) chains[c] = rdp(chains[c], tol);
      chains = orderPaths(chains);
      var pe = null;
      for (var c2 = 0; c2 < chains.length; c2++) { var ch = chains[c2]; if (pe) travelAfter += Math.hypot(ch[0][0] - pe[0], ch[0][1] - pe[1]); pe = ch[ch.length - 1]; ptsOut += ch.length; pathsOut++; }
      var ws = wByCol[col], wsum = 0; for (var wi = 0; wi < ws.length; wi++) wsum += ws[wi];
      pens.push({ col: col, width: wsum / ws.length, paths: chains });
    }
    return { pens: pens, stats: { segIn: segIn, pathsOut: pathsOut, ptsIn: ptsIn, ptsOut: ptsOut, travelBefore: travelBefore, travelAfter: travelAfter } };
  }
  function hashOpt(opt) { // FNV-1a over quantised geometry + pens → reproducible witness
    var h = 2166136261;
    for (var p = 0; p < opt.pens.length; p++) {
      var pen = opt.pens[p];
      for (var ci = 0; ci < pen.col.length; ci++) { h ^= pen.col.charCodeAt(ci); h = Math.imul(h, 16777619); }
      for (var i = 0; i < pen.paths.length; i++) {
        var pa = pen.paths[i];
        for (var j = 0; j < pa.length; j++) { h ^= (pa[j][0] * 1000) | 0; h = Math.imul(h, 16777619); h ^= (pa[j][1] * 1000) | 0; h = Math.imul(h, 16777619); }
      }
    }
    return ("0000000" + (h >>> 0).toString(16)).slice(-8);
  }
  function plotSVG(opt, meta) {
    var S = 1000, inner = S * (1 - 2 * MARGIN), off = S * MARGIN;
    function X(x) { return (off + x * inner).toFixed(1); }
    function Y(y) { return (off + y * inner).toFixed(1); }
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">',
      '<metadata>' + meta + '</metadata>',
      '<rect width="1000" height="1000" fill="#0d1b1c"/>',
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'];
    for (var p = 0; p < opt.pens.length; p++) {
      var pen = opt.pens[p];
      out.push('<g stroke="' + pen.col + '" stroke-width="' + (pen.width || 1).toFixed(2) + '" stroke-opacity="0.92">');
      for (var i = 0; i < pen.paths.length; i++) {
        var pa = pen.paths[i]; if (pa.length < 2) continue;
        var d = "M" + X(pa[0][0]) + " " + Y(pa[0][1]);
        for (var j = 1; j < pa.length; j++) d += " L" + X(pa[j][0]) + " " + Y(pa[j][1]);
        if (pa.length > 3 && Math.abs(pa[0][0] - pa[pa.length - 1][0]) < 1e-4 && Math.abs(pa[0][1] - pa[pa.length - 1][1]) < 1e-4) d += " Z";
        out.push('<path d="' + d + '"/>');
      }
      out.push("</g>");
    }
    out.push("</g></svg>");
    return out.join("\n");
  }

  // ============================================================================
  // CONTROLLER
  // ============================================================================
  function boot() {
    var root = document.getElementById("atelier");
    if (!root) return;
    // canvas lookup (option a): prefer the Atelier's own canvas; on the unified Studio
    // page there is no #at-canvas, so fall back to the shared subject canvas #studio-canvas,
    // so the Atelier draws into the one canvas the eye perceives. Minimal, non-destructive.
    var canvas = document.getElementById("at-canvas") || document.getElementById("studio-canvas");
    if (!canvas || !canvas.getContext) {
      var nj = document.getElementById("at-nojs"); if (nj) nj.hidden = false; return;
    }
    var ctx = canvas.getContext("2d");
    var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // ── pointer-reactive play: a live cursor-perturbed particle flow over the art ─
    // Screen-only: never touches finalStrokes or the export. The settled drawing is
    // cached into playBuf; particles advect along curl-noise and are dragged/repelled
    // by the cursor, leaving luminous additive trails over the cached art, then it
    // restores clean. Off under reduced-motion and on coarse (touch) pointers.
    var playBuf = null, playRaf = 0, playDpr = 1, playReady = false, playW = 0, playH = 0;
    var playFine = !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
    var playP = null, NP = 720, playActive = false, playFade = 0, playCur = { x: -999, y: -999, vx: 0, vy: 0 };
    var playNoise = makeNoise(makeRng("atelier-play-flow"));
    function capturePlay() {
      if (reduced || !playFine) { playReady = false; return; }
      if (!playBuf) playBuf = document.createElement("canvas");
      if (playBuf.width !== canvas.width || playBuf.height !== canvas.height) { playBuf.width = canvas.width; playBuf.height = canvas.height; playP = null; }
      var pb = playBuf.getContext("2d");
      pb.setTransform(1, 0, 0, 1, 0, 0); pb.clearRect(0, 0, playBuf.width, playBuf.height); pb.drawImage(canvas, 0, 0);
      var rect = canvas.getBoundingClientRect();
      playDpr = canvas.width / Math.max(1, rect.width); playW = rect.width; playH = rect.height; playReady = true;
    }
    function finalPaint(W, H, strokes, fld) {
      paintRich(ctx, W, H, strokes, fld, state.palette); capturePlay();
      // reconcile: judge the settled drawing against criteria it did not author (+ novelty)
      if (window.Reconcile) {
        try {
          lastVerdict = window.Reconcile.reconcile(state.study, state.params, strokes);
          window.Reconcile.renderInto(scoresEl, lastVerdict);
        } catch (e) { if (window.console) console.warn("[reconcile]", e); }
      }
      // canvas→eye bridge (Task 7): announce the settled, fully-painted canvas so the
      // Studio's eye can perceive it. finalPaint is render()'s true paint chokepoint:
      // every settled path (reduced-motion, the reveal RAF, and live-algorithm settle)
      // funnels through here after the canvas is actually drawn, unlike render()'s text
      // end which returns before the async reveal paints. Wrapped: CustomEvent unsupported
      // or no listener must never break a drawing.
      // The settled reconcile verdict (criteria/cohesion/weakest) rides the detail so the Studio
      // can build a real witnessed certificate from it; null when Reconcile is absent (never faked).
      try { document.dispatchEvent(new CustomEvent("atelier:drawn", { detail: { canvas: canvas, verdict: lastVerdict } })); }
      catch (e) { /* CustomEvent unsupported, non-fatal */ }
    }
    function blitBase() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(playBuf, 0, 0); }
    function playReset() { playActive = false; playFade = 0; playP = null; playReady = false; if (playRaf) { cancelAnimationFrame(playRaf); playRaf = 0; } }
    function playInit() { playP = new Float32Array(NP * 3); for (var i = 0; i < NP; i++) { var b = i * 3; playP[b] = Math.random() * playW; playP[b + 1] = Math.random() * playH; playP[b + 2] = Math.random(); } }
    function playFrame() {
      if (!playBuf || !playReady) { playRaf = 0; return; }
      if (!playActive && playFade <= 0) { playRaf = 0; blitBase(); return; }
      if (!playP) playInit();
      blitBase();
      var amp = playActive ? 1 : playFade;
      var ink = makePalette(PALETTES[state.palette] || PALETTES.spectrum).sample(0.74), m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(ink);
      var R = m ? +m[1] : 240, Gc = m ? +m[2] : 220, Bc = m ? +m[3] : 180;
      playCur.vx *= 0.88; playCur.vy *= 0.88;
      ctx.setTransform(playDpr, 0, 0, playDpr, 0, 0);
      ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineWidth = 1.05;
      var sc = 0.006, spd = 1.5, Rr = 130, Rr2 = Rr * Rr;
      for (var i = 0; i < NP; i++) {
        var b = i * 3, x = playP[b], y = playP[b + 1], life = playP[b + 2];
        var ang = playNoise.fbm(x * sc, y * sc) * TAU * 2.2, vx = Math.cos(ang) * spd, vy = Math.sin(ang) * spd;
        var dx = x - playCur.x, dy = y - playCur.y, d2 = dx * dx + dy * dy;
        if (d2 < Rr2) { var d = Math.sqrt(d2) + 0.01, f = 1 - d / Rr; vx += playCur.vx * f * 0.9 + (dx / d) * f * 2.2; vy += playCur.vy * f * 0.9 + (dy / d) * f * 2.2; }
        var nx = x + vx, ny = y + vy;
        life -= 0.011;
        if (life <= 0 || nx < 0 || nx > playW || ny < 0 || ny > playH) {
          // respawn: jump without drawing the long connecting streak
          if (playActive && Math.random() < 0.5) { nx = playCur.x + (Math.random() - 0.5) * 90; ny = playCur.y + (Math.random() - 0.5) * 90; }
          else { nx = Math.random() * playW; ny = Math.random() * playH; }
          playP[b] = nx; playP[b + 1] = ny; playP[b + 2] = 0.4 + Math.random() * 0.6;
          continue;
        }
        var al = clamp(0.42 * amp * (0.25 + 0.75 * life), 0, 1);
        ctx.strokeStyle = "rgba(" + R + "," + Gc + "," + Bc + "," + al + ")";
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        playP[b] = nx; playP[b + 1] = ny; playP[b + 2] = life;
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!playActive) playFade -= 0.018;
      if (playActive || playFade > 0) playRaf = requestAnimationFrame(playFrame); else { playRaf = 0; blitBase(); }
    }
    if (playFine) {
      canvas.addEventListener("pointermove", function (ev) {
        if (!playReady || ev.pointerType === "touch") return;
        var rect = canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        if (playCur.x > -900) { playCur.vx = 0.6 * playCur.vx + 0.4 * (x - playCur.x); playCur.vy = 0.6 * playCur.vy + 0.4 * (y - playCur.y); }
        playCur.x = x; playCur.y = y; playActive = true; playFade = 1;
        if (!playRaf) playRaf = requestAnimationFrame(playFrame);
      });
      canvas.addEventListener("pointerleave", function () { playActive = false; });
    }

    var state = {
      study: "flow", specimen: "none", palette: "spectrum",
      complexity: 0.58, seed: randomSeed(), params: defParams("flow")
    };
    hydrateFromURL(); // a shared link reproduces the exact drawing
    var finalStrokes = [], settled = false, drawToken = 0, rafId = 0, lastVerdict = null; // settled = the geometry is final (gate's observed-state check)

    var statusEl = document.getElementById("at-status");
    var seedtagEl = document.getElementById("at-seedtag");
    var seedInput = document.getElementById("at-seed");
    var blurbEl = document.getElementById("at-blurb");
    var scoresEl = document.getElementById("at-scores"); // the reconcile readout (criteria → cohesion → novelty → verdict)

    function status(t) { if (statusEl) statusEl.textContent = t; }
    var gateEl = document.getElementById("at-gate"); // persistent home for the export gate's decision
    function gateMsg(decision, text) {
      if (!gateEl) return;
      var cls = decision === "allow" ? "g-allow" : (decision === "deny" ? "g-deny" : "g-needs");
      var label = decision === "allow" ? "ALLOW" : (decision === "deny" ? "DENY" : "NEEDS-HUMAN");
      gateEl.innerHTML = '<b class="' + cls + '">gate &middot; ' + label + "</b>: " + text;
    }
    function studyById(id) { for (var i = 0; i < STUDIES.length; i++) if (STUDIES[i].id === id) return STUDIES[i]; return STUDIES[0]; }
    function specimenById(id) { for (var i = 0; i < SPECIMENS.length; i++) if (SPECIMENS[i].id === id) return SPECIMENS[i]; return SPECIMENS[0]; }

    // build chip groups
    function makeChips(containerId, items, getActive, onPick) {
      var box = document.getElementById(containerId); if (!box) return;
      box.innerHTML = "";
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "at-chip"; b.innerHTML = it.label;
        b.setAttribute("data-id", it.id);
        b.setAttribute("aria-pressed", String(getActive() === it.id));
        b.addEventListener("click", function () {
          onPick(it.id);
          Array.prototype.forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-id") === getActive())); });
        });
        box.appendChild(b);
      });
    }

    function sizeCanvas() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [w, h];
    }

    function render() {
      drawToken++; var myToken = drawToken; settled = false; playReset();
      writeURL(); // keep the address bar equal to the current recipe (shareable)
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (state.study === "live") { startLive(); return; } // the senses organ: live camera, its own loop
      stopLive();
      if (gateEl) gateEl.innerHTML = ""; // the export-gate readout is about the last export, not this fresh drawing
      var dims = sizeCanvas(), W = dims[0], H = dims[1];
      var st = studyById(state.study);
      var pal = makePalette(PALETTES[state.palette] || PALETTES.spectrum);
      var P = { complexity: state.complexity, palette: pal, reduced: reduced, params: state.params };
      if (seedtagEl) seedtagEl.textContent = "seed · " + state.seed;
      if (blurbEl) blurbEl.innerHTML = st.blurb;
      status("drawing…");

      var spec = specimenById(state.specimen);
      function go(field) {
        if (myToken !== drawToken) return;
        var ghostF = (st.ghost === false) ? null : field; // the ghost shows what the organ READ; skip it where the field is unused
        var rng = makeRng(state.seed + "|" + state.study + "|" + state.specimen + "|" + Math.round(state.complexity * 100) + "|" + state.palette + pkey(state.study, state.params));
        var piece;
        try { piece = st.build(rng, P, field); }
        catch (e) { status("error"); if (window.console) console.error("[atelier]", e); return; }

        if (piece.live) {
          if (reduced) {
            var guard = 0; while (!piece.step() && guard++ < 600) { }
            finalStrokes = piece.strokes(); settled = true; finalPaint(W, H, finalStrokes, ghostF);
            status(finalStrokes.length + " strokes · settled");
            return;
          }
          var liveStart = (window.performance && performance.now) ? performance.now() : Date.now();
          var liveTick = function () {
            if (myToken !== drawToken) return;
            var nowt = (window.performance && performance.now) ? performance.now() : Date.now();
            var done = false;
            if (nowt - liveStart > 9000) { var g = 0; while (!piece.step() && g++ < 2000) { } done = true; } // throttle safety: never animate forever
            else { for (var s = 0; s < 5; s++) { if (piece.step()) { done = true; break; } } }
            var cur = piece.strokes(); drawStrokes(ctx, W, H, cur, 1);
            var verb = state.study === "reaction" ? "reacting" : state.study === "physarum" ? "foraging" : "growing";
            var unit = state.study === "reaction" || state.study === "physarum" ? " steps" : " nodes";
            status(done ? (cur.length + " strokes · settled") : (verb + "… " + (piece.count ? piece.count() + unit : "")));
            if (!done) rafId = requestAnimationFrame(liveTick);
            else { finalStrokes = cur; settled = true; finalPaint(W, H, finalStrokes, ghostF); }
          };
          rafId = requestAnimationFrame(liveTick);
        } else {
          finalStrokes = piece.strokes; settled = true;
          if (reduced) { finalPaint(W, H, finalStrokes, ghostF); status(finalStrokes.length + " strokes · drawn"); return; }
          var t0 = (window.performance && performance.now) ? performance.now() : Date.now(), dur = 1050;
          var revealTick = function (now) {
            if (myToken !== drawToken) return;
            var nowMs = now || ((window.performance && performance.now) ? performance.now() : Date.now());
            var p = clamp((nowMs - t0) / dur, 0, 1), e = easeOutCubic(p);
            if (p < 1) { drawStrokes(ctx, W, H, finalStrokes, e); status("drawing… " + Math.round(p * 100) + "%"); rafId = requestAnimationFrame(revealTick); }
            else { finalPaint(W, H, finalStrokes, ghostF); status(finalStrokes.length + " strokes · drawn"); }
          };
          rafId = requestAnimationFrame(revealTick);
        }
      }

      if (dynamicFields[state.specimen]) { go(dynamicFields[state.specimen]); }
      else if (spec.src) { status("reading specimen…"); loadField(spec.src, function (field) { if (myToken === drawToken) go(field); }); }
      else go(null);
    }

    // snap stroke colours to the palette's anchor pens → ≤N pen layers, not hundreds of near-identical colours
    function parseRgb(s) { var m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : [233, 226, 208]; }
    function snapToPalette(strokes, paletteId) {
      var anchors = (PALETTES[paletteId] || PALETTES.spectrum).map(hexToRgb);
      function snap(colStr) {
        var c = parseRgb(colStr), bi = 0, bd = 1e9;
        for (var i = 0; i < anchors.length; i++) {
          var a = anchors[i], d = (a[0] - c[0]) * (a[0] - c[0]) + (a[1] - c[1]) * (a[1] - c[1]) + (a[2] - c[2]) * (a[2] - c[2]);
          if (d < bd) { bd = d; bi = i; }
        }
        return rgbCss(anchors[bi]);
      }
      return strokes.map(function (s) { return { pts: s.pts, col: snap(s.col), w: s.w }; });
    }
    function exportSVG() {
      // proof-surface's gate, on the ACT: the same default-deny that authorises an action elsewhere,
      // here refusing to write an artifact out of incomplete state. perceive → gate → act → witness.
      var gate = Spine.gate([
        { k: "observed-state", v: settled ? "pass" : "needs", msg: settled ? "the drawing has settled" : "the drawing is still being generated" },
        { k: "witnessable", v: finalStrokes.length ? "pass" : "deny", msg: finalStrokes.length ? "geometry present to witness" : "nothing to witness yet" },
        { k: "action-in-scope", v: "pass", msg: "export is an allowed action" }
      ]);
      if (gate.decision !== "allow") {
        gateMsg(gate.decision, finalStrokes.length ? "the drawing hasn&rsquo;t settled, so let it finish, then export" : "draw something first");
        return; // the act is earned, not assumed
      }
      // gate allowed → act: optimise, then witness (EMET) and write
      var opt = optimizeForPlot(snapToPalette(finalStrokes, state.palette), { tol: 0.0007 });
      var st = opt.stats, cut = st.travelBefore > 0 ? Math.round((1 - st.travelAfter / st.travelBefore) * 100) : 0;
      // EMET's move, via the shared spine: SHA-256 the geometry, the same digest the witness ships
      Spine.witness(geomBody(plotSVG(opt, ""))).then(function (witness) {
        witness = witness || "unavailable";
        var shortW = witness.slice(0, 12);
        var psOut = paramStr(state.study, state.params);
        var meta = "atelier plot drawing\n" +
          "study=" + state.study + " specimen=" + state.specimen + " seed=" + state.seed +
          " complexity=" + Math.round(state.complexity * 100) + " palette=" + state.palette + (psOut ? " params=" + psOut : "") + "\n" +
          "optimised: " + st.segIn + " segments to " + st.pathsOut + " continuous paths; " +
          st.ptsIn + " to " + st.ptsOut + " points; pen-up travel reduced " + cut + " percent\n" +
          "pens=" + opt.pens.length + " witness=" + witness + " (SHA-256 of geometry, via EMET)\n" +
          (lastVerdict ? "verdict=" + lastVerdict.tag + " cohesion=" + lastVerdict.cohesion.toFixed(4) +
            " novelty=" + (lastVerdict.margins.novelty || 0).toFixed(4) +
            " (judged against criteria it did not author, via Reconcile)\n" : "") +
          "re-derivable: the same seed redraws this exact file. github.com/HarperZ9";
        var svg = plotSVG(opt, meta);
        var blob = new Blob([svg], { type: "image/svg+xml" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "drawing-" + state.study + "-" + state.seed + "-" + shortW + ".svg";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        status(st.pathsOut + " paths · −" + cut + "% pen travel · witness " + shortW + "…");
        gateMsg("allow", "settled, witnessed, and written: <span class=\"gmono\">" + shortW + "&hellip;</span>");
        if (window.Reconcile && lastVerdict) Reconcile.remember(lastVerdict.features); // the saved work grounds future novelty
      });
    }

    // ── verify: re-derive a drawing from its own seed and witness it ───────────
    // The witnessing move, closed on the art's own artifacts: rebuild from the
    // stated seed, recompute the witness, and report MATCH / DRIFT / UNVERIFIABLE.
    var verdictEl = document.getElementById("at-verdict");
    function showVerdict(cls, label, detail) {
      if (verdictEl) verdictEl.innerHTML = '<span class="verdict-big ' + cls + '">' + label + '</span><div class="vd-detail">' + detail + '</div>';
    }
    // render the witness verdict AND the proof-surface gate composing on its checks
    function gClass(d) { return d === "allow" ? "g-allow" : (d === "deny" ? "g-deny" : "g-needs"); }
    function gLabel(d) { return d === "allow" ? "ALLOW" : (d === "deny" ? "DENY" : "NEEDS-HUMAN"); }
    function gSub(d) { return d === "allow" ? "accept as authentic seeded work" : (d === "deny" ? "reject: provenance failed" : "manual review: nothing to check"); }
    function checkClass(v) { return v === "pass" ? "ok" : (v === "deny" ? "bad" : "lt"); }
    function renderVerdict(cls, label, detail, checks, gate) {
      if (!verdictEl) return;
      var rows = checks.map(function (c) { return c.k + ' <b class="' + checkClass(c.v) + '">' + (c.v === "pass" ? "pass" : (c.v === "deny" ? "deny" : "unknown")) + "</b>"; }).join(" &middot; ");
      verdictEl.innerHTML = '<span class="verdict-big ' + cls + '">' + label + "</span>"
        + '<div class="vd-detail">' + detail + "</div>"
        + '<div class="vd-gate"><div class="vd-checks">' + rows + "</div>"
        + '<div>proof-surface gate &rarr; <b class="' + gClass(gate.decision) + '">' + gLabel(gate.decision) + "</b> <span class=\"vd-gsub\">" + gSub(gate.decision) + "</span></div></div>";
    }
    function syncChipGroup(id, activeId) {
      var box = document.getElementById(id); if (!box) return;
      Array.prototype.forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-id") === activeId)); });
    }
    function syncControls() {
      syncChipGroup("at-studies", state.study); syncChipGroup("at-specimens", state.specimen); syncChipGroup("at-palettes", state.palette);
      if (slider) slider.value = String(Math.round(state.complexity * 100));
      if (seedInput) seedInput.value = state.seed;
    }

    // ── share-by-URL: the witnessed recipe lives in the link ──────────────────
    // The full state (study·specimen·seed·complexity·palette) is the same tuple
    // that keys makeRng, so a shared URL reproduces the exact drawing. Seeds are
    // restricted to a URL/filename/SVG-safe charset, so nothing link- or
    // user-supplied can inject markup downstream.
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function sanitizeSeed(s) { return String(s == null ? "" : s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48); }
    function stateToParams() {
      var ps = paramStr(state.study, state.params);
      return "study=" + encodeURIComponent(state.study) +
        "&specimen=" + encodeURIComponent(state.specimen) +
        "&seed=" + encodeURIComponent(state.seed) +
        "&cx=" + Math.round(state.complexity * 100) +
        "&palette=" + encodeURIComponent(state.palette) +
        (ps ? "&params=" + encodeURIComponent(ps) : "");
    }
    function writeURL() {
      try { window.history.replaceState(null, "", window.location.pathname + "?" + stateToParams()); } catch (e) { }
    }
    function hydrateFromURL() {
      var qs = window.location.search; if (!qs || qs.length < 2 || typeof URLSearchParams === "undefined") return;
      var p; try { p = new URLSearchParams(qs); } catch (e) { return; }
      var st = p.get("study"); if (st && studyById(st).id === st) state.study = st;
      var sp = p.get("specimen"); if (sp && specimenById(sp).id === sp) state.specimen = sp;   // upload/captured don't validate → ignored
      var sd = p.get("seed"); if (sd) { var cs = sanitizeSeed(sd); if (cs) state.seed = cs; }
      var cx = p.get("cx"); if (cx !== null && /^\d{1,3}$/.test(cx)) state.complexity = clamp(parseInt(cx, 10) / 100, 0, 1);
      var pl = p.get("palette"); if (pl && PALETTES[pl]) state.palette = pl;
      state.params = defParams(state.study);
      var pm = p.get("params"); if (pm) { var pp = parseParamStr(state.study, pm); for (var pk in pp) state.params[pk] = pp[pk]; }
    }
    // a curated strip spanning every study, specimen and pen-set: a quick start
    // and an honest showcase of range; each is itself a shareable, witnessed recipe
    var GALLERY = [
      { label: "Whorl", study: "phyllotaxis", specimen: "none", palette: "spectrum", seed: "nautilus", cx: 62 },
      { label: "Current", study: "flow", specimen: "none", palette: "ember", seed: "drift", cx: 70 },
      { label: "Veins", study: "venation", specimen: "none", palette: "cool", seed: "xylem", cx: 66 },
      { label: "Turing", study: "reaction", specimen: "none", palette: "spectrum", seed: "reactor", cx: 60 },
      { label: "Forage", study: "physarum", specimen: "none", palette: "spectrum", seed: "myxo", cx: 64 },
      { label: "Buckle", study: "growth", specimen: "none", palette: "mono", seed: "fold", cx: 56 }
    ];
    function applyPreset(g) {
      state.study = g.study; state.specimen = g.specimen; state.palette = g.palette;
      state.seed = sanitizeSeed(g.seed) || randomSeed(); state.complexity = clamp(g.cx / 100, 0, 1);
      state.params = defParams(g.study);
      syncControls(); renderParams(); render();
    }

    function parsePlotMeta(text) {
      var m = /<metadata>([\s\S]*?)<\/metadata>/.exec(text), body = m ? m[1] : text;
      function grab(re) { var x = re.exec(body); return x ? x[1] : null; }
      return {
        study: grab(/study=([A-Za-z]+)/), specimen: grab(/specimen=([A-Za-z]+)/),
        seed: grab(/seed=(\S+)/), complexity: grab(/complexity=(\d+)/),
        palette: grab(/palette=([A-Za-z]+)/), params: grab(/params=(\S+)/), witness: grab(/witness=([0-9a-f]+)/)
      };
    }
    function geomBody(svg) { var i = svg.indexOf('<g fill="none"'), j = svg.lastIndexOf("</svg>"); return (i >= 0 && j > i) ? svg.slice(i, j) : null; }
    function verifyFile(text) {
      var meta = parsePlotMeta(text);
      var noProv = [{ k: "provenance", v: "unknown", msg: "no seed and witness to check against" }];
      if (!meta.study || !meta.seed || !meta.complexity || !meta.palette || !meta.witness) {
        renderVerdict("v-unver", "UNVERIFIABLE", "No re-derivable seed and witness in this file, so it is not a pass, not a fail. Export a drawing from this page to get one.", noProv, Spine.gate(noProv)); return;
      }
      var st = studyById(meta.study);
      if (st.id !== meta.study) { renderVerdict("v-unver", "UNVERIFIABLE", "This file names an algorithm this build does not have (" + meta.study + ").", noProv, Spine.gate(noProv)); return; }
      var pid = PALETTES[meta.palette] ? meta.palette : "spectrum";
      var sid = specimenById(meta.specimen || "none").id;
      showVerdict("v-unver", "RE-DERIVING…", "Rebuilding <b>" + meta.study + "</b> from seed <b>" + esc(meta.seed) + "</b>, re-witnessing, and asking the gate&hellip;");
      function finish(field) {
        var vparams = parseParamStr(meta.study, meta.params);
        var rng = makeRng(meta.seed + "|" + meta.study + "|" + sid + "|" + meta.complexity + "|" + meta.palette + pkey(meta.study, vparams));
        var P = { complexity: clamp(parseInt(meta.complexity, 10) / 100, 0, 1), palette: makePalette(PALETTES[pid]), reduced: true, params: vparams };
        var piece = st.build(rng, P, field);
        if (piece.live) { var guard = 0; while (!piece.step() && guard++ < 2000) { } }
        var strokes = piece.live ? piece.strokes() : piece.strokes;
        var seedOpt = optimizeForPlot(snapToPalette(strokes, pid), { tol: 0.0007 });
        var fileBody = geomBody(text);
        // EMET witnesses both the re-derivation and the file; proof-surface gates the result
        Promise.all([Spine.witness(geomBody(plotSVG(seedOpt, ""))), fileBody ? Spine.witness(fileBody) : Promise.resolve(null)]).then(function (hs) {
          var reHash = hs[0], fileHash = hs[1];
          var untampered = !!(fileHash && fileHash === meta.witness);
          var authentic = !!(reHash && reHash === meta.witness);
          var checks = [
            { k: "provenance", v: "pass", msg: "seed and witness present" },
            { k: "untampered", v: untampered ? "pass" : "deny", msg: untampered ? "geometry matches its witness" : "geometry no longer hashes to the stated witness" },
            { k: "re-derives", v: authentic ? "pass" : "deny", msg: authentic ? "the seed reproduces the witness" : "the seed does not reproduce the witness" }
          ];
          var gate = Spine.gate(checks), short = (meta.witness || "").slice(0, 12);
          if (untampered && authentic) {
            renderVerdict("v-match", "MATCH", "Re-derived from seed <b>" + esc(meta.seed) + "</b>; the SHA-256 of the geometry matches the file. <span class=\"mono\">" + short + "&hellip;</span>", checks, gate);
          } else if (!authentic) {
            renderVerdict("v-drift", "DRIFT", "The seed does not reproduce this drawing, so it is a different build, or the paths were edited. Re-derives to <span class=\"mono\">" + (reHash || "").slice(0, 12) + "&hellip;</span>, file states <span class=\"mono\">" + short + "&hellip;</span>.", checks, gate);
          } else {
            renderVerdict("v-drift", "DRIFT", "The file&rsquo;s paths no longer hash to its stated witness; it was altered after export.", checks, gate);
          }
        });
        state.study = meta.study; state.specimen = sid; state.seed = meta.seed; state.complexity = P.complexity; state.palette = pid;
        syncControls(); render();
      }
      var src = specimenById(sid).src;
      if (src) loadField(src, function (f) { setTimeout(function () { finish(f); }, 20); });
      else setTimeout(function () { finish(null); }, 20);
    }
    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { verifyFile(String(reader.result)); };
      reader.onerror = function () { showVerdict("v-unver", "UNVERIFIABLE", "Could not read that file."); };
      reader.readAsText(file);
    }

    // ── SENSES: live camera perception, measured ground-truth, no models ──────
    // Each frame is read as luminance + Sobel edges + motion; particles stream
    // ALONG what the camera sees. Live perception is not reproducible (the world
    // isn't), so "Capture" freezes the sensed field into a deterministic,
    // witnessed specimen, bridging real sensing to the accountable pipeline.
    var dynamicFields = {}; // upload / captured fields, drawn like any specimen
    var SW = 144, SH = 108;
    var live = { tok: 0, active: false, stream: null, video: null, dg: null, raf: 0, lum: null, prev: null, edge: null, eang: null, motion: null, parts: null, overlay: false, energy: 0 };
    var senseCv = null, senseCtx = null;

    function stopLive() {
      live.active = false; live.tok++;
      if (live.raf) { cancelAnimationFrame(live.raf); live.raf = 0; }
      if (live.stream) { live.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { } }); live.stream = null; }
      live.video = null;
      if (senseCv) senseCv.style.display = "none";
    }
    function startLive() {
      if (live.active) return; // palette/specimen changes shouldn't restart the camera
      live.active = true; var myTok = ++live.tok;
      var dims = sizeCanvas(), W = dims[0], H = dims[1];
      ctx.clearRect(0, 0, W, H);
      if (seedtagEl) seedtagEl.textContent = "live · camera";
      status("waking the camera…");
      gateMsg("needs-human", "live perception: capture a frame to make it accountable");
      if (blurbEl) blurbEl.innerHTML = "<b>The senses.</b> The camera is a real organ: each frame is read as luminance and Sobel edges, and particles stream <span class='sp'>along</span> what it sees, measured ground-truth, no model, nothing inferred. Move, and the drawing moves. Hit <b>Capture</b> to freeze the sensed field into a deterministic, witnessed specimen.";
      var n = SW * SH;
      live.lum = new Float32Array(n); live.prev = new Float32Array(n); live.edge = new Float32Array(n); live.eang = new Float32Array(n); live.motion = new Float32Array(n);
      var dc = document.createElement("canvas"); dc.width = SW; dc.height = SH;
      live.dg = dc.getContext("2d", { willReadFrequently: true });
      var PN = 1700; live.parts = new Float32Array(PN * 4);
      for (var i = 0; i < PN; i++) { live.parts[i * 4] = Math.random(); live.parts[i * 4 + 1] = Math.random(); live.parts[i * 4 + 2] = Math.random() * 60; live.parts[i * 4 + 3] = Math.random(); }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status("no camera API here"); gateMsg("deny", "this browser has no camera API"); return; }
      var v = document.createElement("video"); v.muted = true; v.setAttribute("playsinline", ""); live.video = v;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false }).then(function (stream) {
        if (myTok !== live.tok) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        live.stream = stream; v.srcObject = stream; var pp = v.play(); if (pp && pp.catch) pp.catch(function () { });
        status("sensing · live");
        function frame() {
          if (myTok !== live.tok) return;
          if (v.videoWidth) { sense(v); advectDraw(W, H); if (live.overlay) drawOverlay(); }
          live.raf = requestAnimationFrame(frame);
        }
        live.raf = requestAnimationFrame(frame);
      }).catch(function (err) {
        status("camera blocked: " + (err && err.name ? err.name : "error"));
        gateMsg("deny", "no camera access; sensing needs permission");
      });
    }
    function sense(v) {
      var dg = live.dg, lum = live.lum, prev = live.prev, edge = live.edge, eang = live.eang, motion = live.motion, n = SW * SH;
      dg.save(); dg.translate(SW, 0); dg.scale(-1, 1); // mirror, selfie-style
      var vr = v.videoWidth / v.videoHeight, gr = SW / SH, dw, dh, dx, dy;
      if (vr > gr) { dh = SH; dw = dh * vr; dx = (SW - dw) / 2; dy = 0; } else { dw = SW; dh = dw / vr; dx = 0; dy = (SH - dh) / 2; }
      dg.drawImage(v, dx, dy, dw, dh); dg.restore();
      var d; try { d = dg.getImageData(0, 0, SW, SH).data; } catch (e) { return; }
      var en = 0;
      for (var i = 0; i < n; i++) { prev[i] = lum[i]; lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; }
      for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
        var i2 = y * SW + x, xm = x > 0 ? x - 1 : x, xp = x < SW - 1 ? x + 1 : x, ym = y > 0 ? y - 1 : y, yp = y < SH - 1 ? y + 1 : y;
        var gx = lum[y * SW + xp] - lum[y * SW + xm], gy = lum[yp * SW + x] - lum[ym * SW + x];
        edge[i2] = Math.min(1, Math.hypot(gx, gy) * 2.2); eang[i2] = Math.atan2(gy, gx);
        var m = Math.abs(lum[i2] - prev[i2]); motion[i2] = Math.min(1, m * 7); en += m;
      }
      live.energy = en / n;
    }
    function sAng(fx, fy) { var gx = clamp(fx, 0, 0.999) * (SW - 1), gy = clamp(fy, 0, 0.999) * (SH - 1); return live.eang[(gy | 0) * SW + (gx | 0)] + Math.PI / 2; }
    function sEdge(fx, fy) { var gx = clamp(fx, 0, 0.999) * (SW - 1), gy = clamp(fy, 0, 0.999) * (SH - 1); return live.edge[(gy | 0) * SW + (gx | 0)]; }
    function advectDraw(W, H) {
      var pal = makePalette(PALETTES[state.palette] || PALETTES.spectrum);
      ctx.globalAlpha = 1; ctx.fillStyle = "rgba(8,18,17,0.15)"; ctx.fillRect(0, 0, W, H); // gentle fade
      var parts = live.parts, PN = parts.length / 4, step = (0.0040 + live.energy * 0.03) * (W / 600);
      ctx.lineCap = "round"; ctx.lineWidth = Math.max(0.6, W / 720);
      for (var i = 0; i < PN; i++) {
        var x = parts[i * 4], y = parts[i * 4 + 1], life = parts[i * 4 + 2] - 1;
        var e = sEdge(x, y), a = sAng(x, y);
        var nx = x + Math.cos(a) * step * (0.35 + e), ny = y + Math.sin(a) * step * (0.35 + e);
        if (life <= 0 || nx < 0 || nx > 1 || ny < 0 || ny > 1) { nx = Math.random(); ny = Math.random(); life = 40 + Math.random() * 55; }
        else {
          ctx.strokeStyle = pal.sample(clamp(e * 1.4, 0, 1)); ctx.globalAlpha = 0.1 + 0.6 * e;
          ctx.beginPath(); ctx.moveTo(x * W, y * H); ctx.lineTo(nx * W, ny * H); ctx.stroke();
        }
        parts[i * 4] = nx; parts[i * 4 + 1] = ny; parts[i * 4 + 2] = life;
      }
      ctx.globalAlpha = 1;
    }
    function drawOverlay() {
      if (!senseCv) return; senseCv.style.display = "block";
      if (senseCv.width !== SW) { senseCv.width = SW; senseCv.height = SH; }
      var img = senseCtx.createImageData(SW, SH), dd = img.data;
      for (var i = 0; i < SW * SH; i++) { var e = live.edge[i], m = live.motion[i]; dd[i * 4] = 255 * e; dd[i * 4 + 1] = 200 * e; dd[i * 4 + 2] = 255 * m; dd[i * 4 + 3] = 235; }
      senseCtx.putImageData(img, 0, 0);
    }
    function captureFrame() {
      if (!live.active || !live.lum) { status("start the camera first"); return; }
      var FS = 132, lum = new Float32Array(FS * FS);
      for (var y = 0; y < FS; y++) for (var x = 0; x < FS; x++) { var sx = (x / (FS - 1)) * (SW - 1), sy = (y / (FS - 1)) * (SH - 1); lum[y * FS + x] = live.lum[(sy | 0) * SW + (sx | 0)]; }
      dynamicFields["captured"] = buildField(lum, FS);
      var h = 2166136261; for (var k = 0; k < lum.length; k++) { h ^= (lum[k] * 255) | 0; h = Math.imul(h, 16777619); }
      var seed = ("0000000" + (h >>> 0).toString(16)).slice(-6);
      stopLive();
      state.study = "flow"; state.specimen = "captured"; state.seed = seed;
      syncControls(); render();
      status("captured · frozen to a witnessed specimen");
    }
    function handleUpload(file) {
      if (!file || !/^image\//.test(file.type)) { status("choose an image file"); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var lum = lumFromSource(img, img.naturalWidth, img.naturalHeight, 220);
        URL.revokeObjectURL(url);
        if (!lum) { status("couldn't read that image"); return; }
        dynamicFields["upload"] = buildField(lum, 220);
        if (state.study === "live") state.study = "flow";
        state.specimen = "upload"; syncControls(); render();
      };
      img.onerror = function () { URL.revokeObjectURL(url); status("couldn't load that image"); };
      img.src = url;
    }

    function renderParams() {
      var box = document.getElementById("at-params"), pbox = document.getElementById("at-presets");
      if (box) {
        box.innerHTML = "";
        var sc = studyParams(state.study);
        sc.forEach(function (pr) {
          var row = document.createElement("label"); row.className = "at-prow";
          var nm = document.createElement("span"); nm.className = "at-pname"; nm.textContent = pr.label;
          var inp = document.createElement("input");
          inp.type = "range"; inp.className = "at-pslider"; inp.min = pr.min; inp.max = pr.max; inp.step = pr.step;
          inp.value = state.params[pr.k] != null ? state.params[pr.k] : pr.def;
          inp.setAttribute("aria-label", pr.label);
          var pTimer = 0;
          inp.addEventListener("input", function () {
            state.params[pr.k] = pcanon(parseFloat(inp.value));
            if (pTimer) clearTimeout(pTimer); pTimer = setTimeout(render, 130);
          });
          row.appendChild(nm); row.appendChild(inp); box.appendChild(row);
        });
      }
      if (pbox) {
        pbox.innerHTML = "";
        studyPresets(state.study).forEach(function (ps) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "at-chip"; b.textContent = ps.label;
          b.addEventListener("click", function () {
            state.params = defParams(state.study);
            for (var pk in ps.p) state.params[pk] = pcanon(ps.p[pk]);
            renderParams(); render();
          });
          pbox.appendChild(b);
        });
      }
    }

    // wire UI
    makeChips("at-studies", STUDIES, function () { return state.study; }, function (id) { state.study = id; state.params = defParams(id); renderParams(); render(); });
    var SPECIMEN_CHIPS = SPECIMENS.concat([{ id: "upload", label: "&uarr; Upload" }, { id: "captured", label: "Captured" }]);
    makeChips("at-specimens", SPECIMEN_CHIPS, function () { return state.specimen; }, function (id) {
      if (id === "upload") { var fi = document.getElementById("at-img"); if (fi) fi.click(); return; }
      if (id === "captured" && !dynamicFields.captured) { status("capture a frame from Live · camera first"); return; }
      state.specimen = id; render();
    });
    makeChips("at-palettes", PALETTE_CHIPS, function () { return state.palette; }, function (id) { state.palette = id; render(); });

    var slider = document.getElementById("at-complexity");
    if (slider) {
      slider.value = String(Math.round(state.complexity * 100));
      var slTimer = 0;
      slider.addEventListener("input", function () {
        state.complexity = clamp(parseInt(slider.value, 10) / 100, 0, 1);
        if (slTimer) clearTimeout(slTimer);
        slTimer = setTimeout(render, 130); // debounce while dragging
      });
    }
    if (seedInput) {
      seedInput.value = state.seed;
      seedInput.addEventListener("change", function () {
        var v = sanitizeSeed(seedInput.value); if (v) { state.seed = v; seedInput.value = v; render(); }
      });
    }
    var newBtn = document.getElementById("at-newseed");
    if (newBtn) newBtn.addEventListener("click", function () { state.seed = randomSeed(); if (seedInput) seedInput.value = state.seed; render(); });
    var drawBtn = document.getElementById("at-draw");
    if (drawBtn) drawBtn.addEventListener("click", function () { state.seed = randomSeed(); if (seedInput) seedInput.value = state.seed; render(); });
    var exportBtn = document.getElementById("at-export");
    if (exportBtn) exportBtn.addEventListener("click", exportSVG);
    var shareBtn = document.getElementById("at-share");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      writeURL();
      var url = window.location.href, label = shareBtn.textContent;
      function done() { shareBtn.textContent = "Link copied ✓"; setTimeout(function () { shareBtn.textContent = label; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); }); }
      else { window.prompt("Copy this link:", url); }
    });
    var galBox = document.getElementById("at-gallery");
    if (galBox) {
      GALLERY.forEach(function (g) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "at-chip"; b.textContent = g.label;
        b.title = g.study + " · " + g.specimen + " · " + g.palette;
        b.addEventListener("click", function () { applyPreset(g); });
        galBox.appendChild(b);
      });
    }

    var fileInput = document.getElementById("at-file"), dropZone = document.getElementById("at-drop");
    if (fileInput) fileInput.addEventListener("change", function () { if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]); });
    if (dropZone) {
      dropZone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (fileInput) fileInput.click(); } });
      ["dragenter", "dragover"].forEach(function (ev) { dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add("drag"); }); });
      ["dragleave", "drop"].forEach(function (ev) { dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove("drag"); }); });
      dropZone.addEventListener("drop", function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    }

    // senses: upload input, capture, perception overlay
    senseCv = document.getElementById("at-sense"); if (senseCv) senseCtx = senseCv.getContext("2d");
    var imgInput = document.getElementById("at-img");
    if (imgInput) imgInput.addEventListener("change", function () { if (imgInput.files && imgInput.files[0]) { handleUpload(imgInput.files[0]); imgInput.value = ""; } });
    var capBtn = document.getElementById("at-capture");
    if (capBtn) capBtn.addEventListener("click", captureFrame);
    var ovBtn = document.getElementById("at-overlay");
    if (ovBtn) ovBtn.addEventListener("click", function () { live.overlay = !live.overlay; ovBtn.setAttribute("aria-pressed", String(live.overlay)); if (!live.overlay && senseCv) senseCv.style.display = "none"; });

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { drawStrokes(ctx, sizeCanvas()[0], sizeCanvas()[1], finalStrokes, 1); }, 200);
    });

    renderParams();
    render();
  }

  // expose for reuse (e.g. the deck title card) and self-boot
  window.Atelier = { STUDIES: STUDIES, SPECIMENS: SPECIMENS, PALETTES: PALETTES, makeRng: makeRng, makePalette: makePalette, loadField: loadField, buildField: buildField, lumFromSource: lumFromSource, drawStrokes: drawStrokes, paintRich: paintRich, defParams: defParams, studyParams: studyParams, parseParamStr: parseParamStr, toSVG: toSVG, optimizeForPlot: optimizeForPlot, plotSVG: plotSVG, hashOpt: hashOpt };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
