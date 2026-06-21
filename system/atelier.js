/* system/atelier.js — the algorithmic drawing instrument for harperz9.github.io
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
  var GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad — the golden angle

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

  // ── photo field: luminance + gradient + edge-importance sampling ────────────
  var FIELD_CACHE = {};
  function loadField(src, cb) {
    if (FIELD_CACHE[src]) { cb(FIELD_CACHE[src]); return; }
    var img = new Image();
    img.onload = function () {
      var S = 220;
      var c = document.createElement("canvas"); c.width = S; c.height = S;
      var g = c.getContext("2d", { willReadFrequently: true });
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var sc = Math.max(S / iw, S / ih), dw = iw * sc, dh = ih * sc;
      g.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
      var data;
      try { data = g.getImageData(0, 0, S, S).data; } catch (e) { cb(null); return; }
      var lum = new Float32Array(S * S);
      for (var i = 0; i < S * S; i++) {
        lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
      }
      var cdf = new Float32Array(S * S), acc = 0;
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var xl = x > 0 ? x - 1 : 0, xr = x < S - 1 ? x + 1 : S - 1;
        var yt = y > 0 ? y - 1 : 0, yb = y < S - 1 ? y + 1 : S - 1;
        var gx = lum[y * S + xr] - lum[y * S + xl], gy = lum[yb * S + x] - lum[yt * S + x];
        acc += Math.sqrt(gx * gx + gy * gy) + 0.0025; // +eps: flat regions still draw a few
        cdf[y * S + x] = acc;
      }
      var total = acc;
      function bil(map, x, y) {
        var fx = clamp(x, 0, 0.999999) * (S - 1), fy = clamp(y, 0, 0.999999) * (S - 1);
        var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(S - 1, x0 + 1), y1 = Math.min(S - 1, y0 + 1);
        var tx = fx - x0, ty = fy - y0;
        var a = map[y0 * S + x0], b = map[y0 * S + x1], cc = map[y1 * S + x0], d = map[y1 * S + x1];
        return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
      }
      function sIdx(u) {
        var lo = 0, hi = S * S - 1, target = u * total;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid + 1; else hi = mid; }
        return lo;
      }
      var field = {
        size: S,
        lum: function (x, y) { return bil(lum, x, y); },
        grad: function (x, y) { var e = 1.5 / S; return [bil(lum, x + e, y) - bil(lum, x - e, y), bil(lum, x, y + e) - bil(lum, x, y - e)]; },
        sampleEdge: function (rng) { var idx = sIdx(rng()); return [((idx % S) + rng()) / S, (((idx / S) | 0) + rng()) / S]; }
      };
      FIELD_CACHE[src] = field;
      cb(field);
    };
    img.onerror = function () { cb(null); };
    img.src = src;
  }

  // ============================================================================
  // STUDIES — each build(rng, P, field) returns either
  //   { live:false, strokes:[ {pts:[[x,y]…], col, w, op, close?} … ] }
  // or a live simulation
  //   { live:true, step():bool-done, strokes():[…] }
  // ============================================================================

  // 1 ── PHYLLOTAXIS — Vogel's spiral, Fibonacci parastichy arms (the snail) ────
  function buildPhyllotaxis(rng, P, field) {
    var N = Math.round(lerp(460, 2000, P.complexity));
    var cx = 0.5, cy = 0.5, maxR = 0.46, c = maxR / Math.sqrt(N);
    var pal = P.palette, pts = [];
    for (var i = 0; i < N; i++) {
      var r = c * Math.sqrt(i + 0.5), th = i * GOLDEN + (rng() - 0.5) * 0.012;
      var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
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
    // seed packing — tiny octagon dots, brightness from the photo
    var dotStep = N > 1300 ? 2 : 1;
    for (var d = 0; d < N; d += dotStep) {
      var p = pts[d]; if (p.lum < 0.16) continue;
      var rad = 0.0014 + 0.0046 * p.lum, ring = [];
      for (var a = 0; a <= 8; a++) { var an = a / 8 * TAU; ring.push([p.x + rad * Math.cos(an), p.y + rad * Math.sin(an)]); }
      strokes.push({ pts: ring, col: pal.sample(clamp(p.lum * 0.92 + 0.16, 0, 1)), w: 0.6, op: 0.18 + 0.62 * p.lum, close: true });
    }
    return { live: false, strokes: strokes };
  }

  // 2 ── FLOW FIELD — particles through warped noise, bent to the photo (dandelion)
  function buildFlow(rng, P, field) {
    var noise = makeNoise(rng);
    var M = Math.round(lerp(620, 2500, P.complexity));
    var steps = 132, stepLen = 0.0046;
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

  // 3 ── DIFFERENTIAL GROWTH — a self-repelling closed curve (the seedhead) ─────
  function buildGrowth(rng, P, field) {
    var cx = 0.5, cy = 0.5, n0 = 48, R0 = 0.05;
    var nodes = [];
    for (var i = 0; i < n0; i++) { var a = i / n0 * TAU; nodes.push([cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)]); }
    var maxNodes = Math.round(lerp(820, 2100, P.complexity));
    var stepsTarget = Math.round(lerp(120, 185, P.complexity));
    var repR = 0.027, maxLen = 0.012;
    var repW = 0.018, atW = 0.45, grW = 0.0011, noiseW = 0.0006;
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
        var ml = Math.hypot(dxm, dym); if (ml > 0.005) { dxm *= 0.005 / ml; dym *= 0.005 / ml; } // stability cap — no explosion
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

  // 4 ── VENATION — space colonisation toward auxin sources (the mallow) ────────
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
    var attractD = 0.15, killD = 0.016, seg = 0.0072;
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

  // 5 ── REACTION–DIFFUSION — Gray–Scott Turing patterns, drawn as iso-contours (the katydids)
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
    // seed V — from the photo's edges if present, else scattered drops; the pattern nucleates there
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
    var Du = 0.16, Dv = 0.08, iter = 0, target = Math.round(lerp(1500, 3000, P.complexity)), pal = P.palette;
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
      var levels = [0.22, 0.34, 0.46], inv = 1 / (G - 1), out = [];
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
            out.push({ pts: [p0, p1], col: pal.sample(clamp(lc, 0, 1)), w: 0.6 + li * 0.22, op: 0.28 + 0.55 * (field ? clamp(lc, 0, 1) : 0.7) });
          }
        }
      }
      return out;
    }
    return { live: true, step: step, strokes: strokes, count: function () { return iter; } };
  }

  var STUDIES = [
    { id: "phyllotaxis", label: "Phyllotaxis", build: buildPhyllotaxis,
      blurb: "Vogel&rsquo;s spiral &mdash; a seed every <b>golden angle</b>, radius as &radic;index. The Fibonacci arms you see are emergent, never drawn. <span class='sp'>The snail</span> lights which arms are bright." },
    { id: "flow", label: "Flow field", build: buildFlow,
      blurb: "Thousands of particles traced through warped noise and bent along the photograph&rsquo;s contours, so the specimen surfaces in the current. <span class='sp'>Every seed</span> is a different weather." },
    { id: "growth", label: "Differential growth", build: buildGrowth,
      blurb: "A closed curve that repels itself and lengthens, folding as it goes &mdash; the buckling that curls a drying seedhead. <span class='sp'>Watch it</span> draw in real time." },
    { id: "venation", label: "Venation", build: buildVenation,
      blurb: "Veins grow from the centre toward scattered sources, thickening with their load &mdash; the model botanists use for real leaf-veins. <span class='sp'>The mallow</span> places the sources." },
    { id: "reaction", label: "Reaction&ndash;diffusion", build: buildReaction,
      blurb: "Gray&ndash;Scott: two chemicals feed, react and decay until <b>Turing patterns</b> set &mdash; spots, mazes, coral &mdash; drawn here as contour lines. The photograph&rsquo;s light decides which pattern forms where. <span class='sp'>Watch it</span> react. <span class='sp'>The katydids&rsquo;</span> speckle, as mathematics." }
  ];
  var SPECIMENS = [
    { id: "none", label: "Pure math", src: null },
    { id: "snail", label: "Snail", src: "img/snail.jpg" },
    { id: "mallow", label: "Mallow", src: "img/mallow.jpg" },
    { id: "seedhead", label: "Seedhead", src: "img/spider-seedhead.jpg" },
    { id: "dandelion", label: "Dandelion", src: "img/grasshoppers.jpg" }
  ];
  var PALETTE_CHIPS = [
    { id: "spectrum", label: "Spectrum" }, { id: "ember", label: "Ember" },
    { id: "cool", label: "Cool" }, { id: "mono", label: "Monoline" }
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
  // soup — stitch shared endpoints into continuous strokes, simplify, order to
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
    var canvas = document.getElementById("at-canvas");
    if (!canvas || !canvas.getContext) {
      var nj = document.getElementById("at-nojs"); if (nj) nj.hidden = false; return;
    }
    var ctx = canvas.getContext("2d");
    var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var state = {
      study: "flow", specimen: "snail", palette: "spectrum",
      complexity: 0.58, seed: randomSeed()
    };
    var finalStrokes = [], settled = false, drawToken = 0, rafId = 0; // settled = the geometry is final (gate's observed-state check)

    var statusEl = document.getElementById("at-status");
    var seedtagEl = document.getElementById("at-seedtag");
    var seedInput = document.getElementById("at-seed");
    var blurbEl = document.getElementById("at-blurb");

    function status(t) { if (statusEl) statusEl.textContent = t; }
    var gateEl = document.getElementById("at-gate"); // persistent home for the export gate's decision
    function gateMsg(decision, text) {
      if (!gateEl) return;
      var cls = decision === "allow" ? "g-allow" : (decision === "deny" ? "g-deny" : "g-needs");
      var label = decision === "allow" ? "ALLOW" : (decision === "deny" ? "DENY" : "NEEDS-HUMAN");
      gateEl.innerHTML = '<b class="' + cls + '">gate &middot; ' + label + "</b> &mdash; " + text;
    }
    function studyById(id) { for (var i = 0; i < STUDIES.length; i++) if (STUDIES[i].id === id) return STUDIES[i]; return STUDIES[0]; }
    function specimenById(id) { for (var i = 0; i < SPECIMENS.length; i++) if (SPECIMENS[i].id === id) return SPECIMENS[i]; return SPECIMENS[0]; }

    // build chip groups
    function makeChips(containerId, items, getActive, onPick) {
      var box = document.getElementById(containerId); if (!box) return;
      box.innerHTML = "";
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "at-chip"; b.textContent = it.label;
        b.setAttribute("data-id", it.id);
        b.setAttribute("aria-pressed", String(getActive() === it.id));
        b.addEventListener("click", function () {
          onPick(it.id);
          Array.prototype.forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-id") === it.id)); });
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
      drawToken++; var myToken = drawToken; settled = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      var dims = sizeCanvas(), W = dims[0], H = dims[1];
      var st = studyById(state.study);
      var pal = makePalette(PALETTES[state.palette] || PALETTES.spectrum);
      var P = { complexity: state.complexity, palette: pal, reduced: reduced };
      if (seedtagEl) seedtagEl.innerHTML = "seed &middot; " + state.seed;
      if (blurbEl) blurbEl.innerHTML = st.blurb;
      status("drawing…");

      var spec = specimenById(state.specimen);
      function go(field) {
        if (myToken !== drawToken) return;
        var rng = makeRng(state.seed + "|" + state.study + "|" + state.specimen + "|" + Math.round(state.complexity * 100) + "|" + state.palette);
        var piece;
        try { piece = st.build(rng, P, field); }
        catch (e) { status("error"); if (window.console) console.error("[atelier]", e); return; }

        if (piece.live) {
          if (reduced) {
            var guard = 0; while (!piece.step() && guard++ < 600) { }
            finalStrokes = piece.strokes(); settled = true; drawStrokes(ctx, W, H, finalStrokes, 1);
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
            var verb = state.study === "reaction" ? "reacting" : "growing";
            var unit = state.study === "reaction" ? " steps" : " nodes";
            status(done ? (cur.length + " strokes · settled") : (verb + "… " + (piece.count ? piece.count() + unit : "")));
            if (!done) rafId = requestAnimationFrame(liveTick);
            else { finalStrokes = cur; settled = true; }
          };
          rafId = requestAnimationFrame(liveTick);
        } else {
          finalStrokes = piece.strokes; settled = true;
          if (reduced) { drawStrokes(ctx, W, H, finalStrokes, 1); status(finalStrokes.length + " strokes · drawn"); return; }
          var t0 = (window.performance && performance.now) ? performance.now() : Date.now(), dur = 1050;
          var revealTick = function (now) {
            if (myToken !== drawToken) return;
            var nowMs = now || ((window.performance && performance.now) ? performance.now() : Date.now());
            var p = clamp((nowMs - t0) / dur, 0, 1), e = easeOutCubic(p);
            drawStrokes(ctx, W, H, finalStrokes, e);
            status("drawing… " + Math.round(p * 100) + "%");
            if (p < 1) rafId = requestAnimationFrame(revealTick);
            else status(finalStrokes.length + " strokes · drawn");
          };
          rafId = requestAnimationFrame(revealTick);
        }
      }

      if (spec.src) { status("reading specimen…"); loadField(spec.src, function (field) { if (myToken === drawToken) go(field); }); }
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
        gateMsg(gate.decision, finalStrokes.length ? "the drawing hasn&rsquo;t settled &mdash; let it finish, then export" : "draw something first");
        return; // the act is earned, not assumed
      }
      // gate allowed → act: optimise, then witness (EMET) and write
      var opt = optimizeForPlot(snapToPalette(finalStrokes, state.palette), { tol: 0.0007 });
      var st = opt.stats, cut = st.travelBefore > 0 ? Math.round((1 - st.travelAfter / st.travelBefore) * 100) : 0;
      // EMET's move, via the shared spine: SHA-256 the geometry — the same digest the witness ships
      Spine.witness(geomBody(plotSVG(opt, ""))).then(function (witness) {
        witness = witness || "unavailable";
        var shortW = witness.slice(0, 12);
        var meta = "atelier plot drawing\n" +
          "study=" + state.study + " specimen=" + state.specimen + " seed=" + state.seed +
          " complexity=" + Math.round(state.complexity * 100) + " palette=" + state.palette + "\n" +
          "optimised: " + st.segIn + " segments to " + st.pathsOut + " continuous paths; " +
          st.ptsIn + " to " + st.ptsOut + " points; pen-up travel reduced " + cut + " percent\n" +
          "pens=" + opt.pens.length + " witness=" + witness + " (SHA-256 of geometry, via EMET)\n" +
          "re-derivable: the same seed redraws this exact file. github.com/HarperZ9";
        var svg = plotSVG(opt, meta);
        var blob = new Blob([svg], { type: "image/svg+xml" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "drawing-" + state.study + "-" + state.seed + "-" + shortW + ".svg";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        status(st.pathsOut + " paths · −" + cut + "% pen travel · witness " + shortW + "…");
        gateMsg("allow", "settled, witnessed, and written &mdash; <span class=\"gmono\">" + shortW + "&hellip;</span>");
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
    function gSub(d) { return d === "allow" ? "accept as authentic seeded work" : (d === "deny" ? "reject — provenance failed" : "manual review — nothing to check"); }
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
    function parsePlotMeta(text) {
      var m = /<metadata>([\s\S]*?)<\/metadata>/.exec(text), body = m ? m[1] : text;
      function grab(re) { var x = re.exec(body); return x ? x[1] : null; }
      return {
        study: grab(/study=([A-Za-z]+)/), specimen: grab(/specimen=([A-Za-z]+)/),
        seed: grab(/seed=(\S+)/), complexity: grab(/complexity=(\d+)/),
        palette: grab(/palette=([A-Za-z]+)/), witness: grab(/witness=([0-9a-f]+)/)
      };
    }
    function geomBody(svg) { var i = svg.indexOf('<g fill="none"'), j = svg.lastIndexOf("</svg>"); return (i >= 0 && j > i) ? svg.slice(i, j) : null; }
    function verifyFile(text) {
      var meta = parsePlotMeta(text);
      var noProv = [{ k: "provenance", v: "unknown", msg: "no seed and witness to check against" }];
      if (!meta.study || !meta.seed || !meta.complexity || !meta.palette || !meta.witness) {
        renderVerdict("v-unver", "UNVERIFIABLE", "No re-derivable seed and witness in this file &mdash; not a pass, not a fail. Export a drawing from this page to get one.", noProv, Spine.gate(noProv)); return;
      }
      var st = studyById(meta.study);
      if (st.id !== meta.study) { renderVerdict("v-unver", "UNVERIFIABLE", "This file names an algorithm this build does not have (" + meta.study + ").", noProv, Spine.gate(noProv)); return; }
      var pid = PALETTES[meta.palette] ? meta.palette : "spectrum";
      var sid = specimenById(meta.specimen || "none").id;
      showVerdict("v-unver", "RE-DERIVING…", "Rebuilding <b>" + meta.study + "</b> from seed <b>" + meta.seed + "</b>, re-witnessing, and asking the gate&hellip;");
      function finish(field) {
        var rng = makeRng(meta.seed + "|" + meta.study + "|" + sid + "|" + meta.complexity + "|" + meta.palette);
        var P = { complexity: clamp(parseInt(meta.complexity, 10) / 100, 0, 1), palette: makePalette(PALETTES[pid]), reduced: true };
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
            renderVerdict("v-match", "MATCH", "Re-derived from seed <b>" + meta.seed + "</b>; the SHA-256 of the geometry matches the file. <span class=\"mono\">" + short + "&hellip;</span>", checks, gate);
          } else if (!authentic) {
            renderVerdict("v-drift", "DRIFT", "The seed does not reproduce this drawing &mdash; a different build, or the paths were edited. Re-derives to <span class=\"mono\">" + (reHash || "").slice(0, 12) + "&hellip;</span>, file states <span class=\"mono\">" + short + "&hellip;</span>.", checks, gate);
          } else {
            renderVerdict("v-drift", "DRIFT", "The file&rsquo;s paths no longer hash to its stated witness &mdash; it was altered after export.", checks, gate);
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

    // wire UI
    makeChips("at-studies", STUDIES, function () { return state.study; }, function (id) { state.study = id; render(); });
    makeChips("at-specimens", SPECIMENS, function () { return state.specimen; }, function (id) { state.specimen = id; render(); });
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
        var v = seedInput.value.trim(); if (v) { state.seed = v; render(); }
      });
    }
    var newBtn = document.getElementById("at-newseed");
    if (newBtn) newBtn.addEventListener("click", function () { state.seed = randomSeed(); if (seedInput) seedInput.value = state.seed; render(); });
    var drawBtn = document.getElementById("at-draw");
    if (drawBtn) drawBtn.addEventListener("click", function () { state.seed = randomSeed(); if (seedInput) seedInput.value = state.seed; render(); });
    var exportBtn = document.getElementById("at-export");
    if (exportBtn) exportBtn.addEventListener("click", exportSVG);

    var fileInput = document.getElementById("at-file"), dropZone = document.getElementById("at-drop");
    if (fileInput) fileInput.addEventListener("change", function () { if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]); });
    if (dropZone) {
      dropZone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (fileInput) fileInput.click(); } });
      ["dragenter", "dragover"].forEach(function (ev) { dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add("drag"); }); });
      ["dragleave", "drop"].forEach(function (ev) { dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove("drag"); }); });
      dropZone.addEventListener("drop", function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    }

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { drawStrokes(ctx, sizeCanvas()[0], sizeCanvas()[1], finalStrokes, 1); }, 200);
    });

    render();
  }

  // expose for reuse (e.g. the deck title card) and self-boot
  window.Atelier = { STUDIES: STUDIES, SPECIMENS: SPECIMENS, PALETTES: PALETTES, makeRng: makeRng, makePalette: makePalette, loadField: loadField, drawStrokes: drawStrokes, toSVG: toSVG, optimizeForPlot: optimizeForPlot, plotSVG: plotSVG, hashOpt: hashOpt };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
