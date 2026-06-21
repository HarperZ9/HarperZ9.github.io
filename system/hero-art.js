/* system/hero-art.js — a living generative-flow layer for the home hero.
   A domain-warped flow field of glowing particle trails in the site palette,
   the new art brought up to the top. Renders over the WebGL hero (#gl), under
   the scrim, so the text stays legible. Zero-dependency, DPR-aware,
   reduced-motion-safe, and it pauses when the hero scrolls out of view.        */
(function () {
  "use strict";
  var canvas = document.getElementById("hero-art");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DPR = Math.min(1.6, window.devicePixelRatio || 1);
  var W = 1, H = 1;
  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize(); window.addEventListener("resize", resize);

  // palette: teal → sage → amber → orange → bone (the site's pens)
  var PAL = [[79, 169, 142], [71, 103, 98], [239, 171, 48], [223, 94, 0], [233, 226, 208]];
  function mix(a, b, t) { return a + (b - a) * t; }
  function col(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var f = t * (PAL.length - 1), i = Math.floor(f), fr = f - i;
    if (i >= PAL.length - 1) { i = PAL.length - 2; fr = 1; }
    var a = PAL[i], b = PAL[i + 1];
    return "rgb(" + ((mix(a[0], b[0], fr)) | 0) + "," + ((mix(a[1], b[1], fr)) | 0) + "," + ((mix(a[2], b[2], fr)) | 0) + ")";
  }

  // value-noise fBm (cheap, dependency-free)
  function h2(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, y) { var s = 0, a = 0.5, f = 1; for (var i = 0; i < 3; i++) { s += a * vn(x * f, y * f); f *= 2; a *= 0.5; } return s; }

  // domain-warped flow angles, on a coarse grid recomputed slowly (cheap; particles sample it)
  var GW = 104, GH = 60, grid = new Float32Array(GW * GH);
  function computeGrid(tt) {
    var sc = 2.0;
    for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) {
      var x = gx / (GW - 1), y = gy / (GH - 1);
      var wx = x + 0.55 * (fbm(x * sc + 3.1, y * sc + 1.7 + tt * 0.03) - 0.5);
      var wy = y + 0.55 * (fbm(x * sc + 8.2 + tt * 0.03, y * sc + 6.4) - 0.5);
      grid[gy * GW + gx] = fbm(wx * sc * 0.9, wy * sc * 0.9) * Math.PI * 3.0 + tt * 0.05;
    }
  }
  function angleAt(x, y) {
    var fx = (x < 0 ? 0 : x > 1 ? 1 : x) * (GW - 1), fy = (y < 0 ? 0 : y > 1 ? 1 : y) * (GH - 1);
    var x0 = fx | 0, y0 = fy | 0, x1 = x0 < GW - 1 ? x0 + 1 : x0, y1 = y0 < GH - 1 ? y0 + 1 : y0, tx = fx - x0, ty = fy - y0;
    var a = grid[y0 * GW + x0], b = grid[y0 * GW + x1], c = grid[y1 * GW + x0], d = grid[y1 * GW + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  var N = 2900, P = new Float32Array(N * 4); // x, y, life, hue
  function spawn(i) { P[i * 4] = Math.random(); P[i * 4 + 1] = Math.random(); P[i * 4 + 2] = 40 + Math.random() * 150; P[i * 4 + 3] = Math.random(); }
  for (var i = 0; i < N; i++) { spawn(i); P[i * 4 + 2] = Math.random() * 150; }

  var t = 0, raf = 0, visible = true;
  function stepDraw() {
    t += 1;
    if (t % 2 === 0) computeGrid(t * 0.016);
    // void fade: builds the dark ground + fades old trails
    ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(11,23,24,0.05)"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    var step = 0.0021 * (W / 900) + 0.0008;
    for (var k = 0; k < N; k++) {
      var x = P[k * 4], y = P[k * 4 + 1], life = P[k * 4 + 2] - 1, hue = P[k * 4 + 3];
      var a = angleAt(x, y);
      var nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      if (life <= 0 || nx < -0.01 || nx > 1.01 || ny < -0.01 || ny > 1.01) { spawn(k); continue; }
      ctx.lineWidth = 0.9 + 1.1 * hue;
      ctx.strokeStyle = col(0.12 + 0.78 * hue);
      ctx.globalAlpha = 0.07 + 0.2 * hue;
      ctx.beginPath(); ctx.moveTo(x * W, y * H); ctx.lineTo(nx * W, ny * H); ctx.stroke();
      P[k * 4] = nx; P[k * 4 + 1] = ny; P[k * 4 + 2] = life;
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  function frame() { if (!visible) { raf = 0; return; } stepDraw(); raf = requestAnimationFrame(frame); }
  window.addEventListener("scroll", function () {
    var on = window.scrollY < window.innerHeight * 1.15;
    if (on && !visible) { visible = true; if (!raf) raf = requestAnimationFrame(frame); }
    else if (!on && visible) { visible = false; }
  }, { passive: true });

  if (reduced) {
    // static, beautiful still — run the field to a settled frame once, no animation
    computeGrid(0);
    ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#0b1718"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineWidth = 1.05;
    for (var s = 0; s < 300; s++) {
      for (var j = 0; j < N; j++) {
        var x = P[j * 4], y = P[j * 4 + 1], hue = P[j * 4 + 3];
        var a = angleAt(x, y), nx = x + Math.cos(a) * 0.0022, ny = y + Math.sin(a) * 0.0022;
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) { spawn(j); continue; }
        ctx.strokeStyle = col(0.08 + 0.8 * hue); ctx.globalAlpha = 0.05 + 0.13 * hue;
        ctx.beginPath(); ctx.moveTo(x * W, y * H); ctx.lineTo(nx * W, ny * H); ctx.stroke();
        P[j * 4] = nx; P[j * 4 + 1] = ny;
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
