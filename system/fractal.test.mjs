import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeTime, smoothMu } from "./fractal.js";

test("a point deep in the main cardioid never escapes", () => {
  const r = escapeTime(-0.5, 0.0, 200);
  assert.equal(r.n, 200);                       // interior: hits maxIter
});
test("a point well outside escapes quickly and smoothing is finite & monotone-ish", () => {
  const a = escapeTime(2.0, 2.0, 200);
  assert.ok(a.n < 5, "far point escapes fast");
  const mu = smoothMu(a.n, a.zr, a.zi);
  assert.ok(Number.isFinite(mu) && mu >= a.n - 1 && mu <= a.n + 1, "mu refines n by <1");
});
test("the period-2 bulb point (-1,0) stays bounded", () => {
  assert.equal(escapeTime(-1.0, 0.0, 100).n, 100);
});

// ── Every preset must show its subject ────────────────────────────────────────
// The 2026-08-04 piecewise sweep found THREE presets rendering solid black: Burning Ship "Hull"
// (a fully non-escaping window — and the type's default, so the whole Burning Ship chip looked
// broken), "Feigenbaum Point" (scale 1e-6 on the boundary: all interior at any budget), and
// "Period-3 Bulb" (framed entirely inside the bulb). A preset is a claim that a view is worth
// looking at; a black frame is that claim failing silently. This runs the real CPU renderer over
// every preset at thumbnail size and refuses both failure directions: near-empty (interior/black)
// and structureless (a flat wash with no visible boundary detail would also be a dead view).

import { PRESETS, renderFractal } from "./fractal.js";

function stubCanvas(w, h) {
  let written = null;
  if (typeof globalThis.ImageData === "undefined") {
    // node has no ImageData; the renderer only constructs and hands it straight back.
    globalThis.ImageData = class ImageData {
      constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
    };
  }
  return {
    width: w, height: h,
    getContext: () => ({ putImageData: (img) => { written = img; } }),
    read: () => written,
  };
}

test("no preset renders a dead frame (every view shows lit, structured content)", () => {
  for (const p of PRESETS) {
    const c = stubCanvas(160, 80);
    renderFractal(c, p);
    const img = c.read();
    assert.ok(img, `${p.name}: renderer produced a frame`);
    const d = img.data;
    let lit = 0;
    const hues = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 24) { lit += 1; hues.add((d[i] >> 5) + "-" + (d[i + 1] >> 5) + "-" + (d[i + 2] >> 5)); }
    }
    const litPct = (100 * lit) / (160 * 80);
    assert.ok(litPct > 3, `${p.type}/${p.name}: only ${litPct.toFixed(1)}% lit — a black view`);
    assert.ok(hues.size >= 5, `${p.type}/${p.name}: ${hues.size} colour bins — a structureless wash`);
  }
});

// The colour gate, added after a desaturation regression got as far as a rendered frame before
// anyone noticed. The failure was not a dead view, so the test above passed it: every preset was
// lit and structured, and every one of them had drifted toward grey. Two numbers close that gap.
//
// Both bounds are measured, not chosen. Rendering all eighteen presets at thumbnail size gives a
// worst-case near-neutral fraction of 5.5% (Burning Ship: Sails, whose bone palette is genuinely
// low-chroma by design) and a corpus mean chroma of 0.415. The build that regressed measured 0.29
// on the same corpus, so the floor at 0.35 separates them with room on both sides.
test("no preset paints a washed-out frame, and the corpus holds its chroma", () => {
  let chromaSum = 0, litTotal = 0;
  for (const p of PRESETS) {
    const c = stubCanvas(160, 80);
    renderFractal(c, p);
    const d = c.read().data;
    let neutral = 0, lit = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx <= 32) continue;             // the dark interior carries no hue to lose
      const sat = (mx - mn) / mx;
      lit += 1; sum += sat;
      if (mx > 160 && sat < 0.15) neutral += 1;   // bright and almost grey: the regression's signature
    }
    const pct = (100 * neutral) / (160 * 80);
    assert.ok(pct < 15, `${p.type}/${p.name}: ${pct.toFixed(1)}% of the frame is bright and near-neutral`);
    chromaSum += sum; litTotal += lit;
  }
  const mean = chromaSum / litTotal;
  assert.ok(mean > 0.35, `mean chroma of lit pixels fell to ${mean.toFixed(3)} (floor 0.35)`);
});
