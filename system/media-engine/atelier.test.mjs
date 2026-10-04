// node --test system/media-engine/atelier.test.mjs
// The Atelier's render half as the "atelier" engine plugin. drawStrokes and paintRich moved out of
// atelier.js; this test holds them call-for-call equal to verbatim copies of the old functions
// (as of origin/main 4d406063), and checks that the plugin draws only the frames its host asks for.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { atelier, drawStrokes, paintRich, MARGIN } = await import("./plugins/atelier.mjs");

// ── verbatim copies of the old atelier.js renderer (field ghost left out: it needs a DOM canvas) ──
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
var OLD_MARGIN = 0.055;
function oldDrawStrokes(ctx, W, H, strokes, frac) {
  ctx.clearRect(0, 0, W, H);
  var inner = Math.min(W, H) * (1 - 2 * OLD_MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
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
function oldPaintRichNoField(ctx, W, H, strokes) {
  ctx.clearRect(0, 0, W, H);
  var inner = Math.min(W, H) * (1 - 2 * OLD_MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
  var wScale = inner / 1000;
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
  pass(3.6, 0.16, "lighter");
  pass(1.0, 1.0, "source-over");
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}

// A 2D context that records every call and property write, in order.
function recorder() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { log.push([String(k), ...a]); }),
    set: (t, k, v) => { log.push(["=" + String(k), v]); t[k] = v; return true; },
  });
  return { ctx, log };
}
function canvasOf(rec, w = 300, h = 200) { return { width: w, height: h, getContext: () => rec.ctx }; }

const STROKES = [
  { pts: [[0.1, 0.1], [0.4, 0.2], [0.6, 0.7]], col: "rgb(10,20,30)", w: 2, op: 0.5 },
  { pts: [[0.2, 0.9]], col: "rgb(1,2,3)" },
  { pts: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.3], [0.3, 0.3]], col: "rgb(200,100,0)", w: 0.1, close: true },
  { pts: [[0.9, 0.1], [0.8, 0.2]], col: "rgb(5,5,5)", op: 2 },
];

test("drawStrokes matches the old renderer call for call at every reveal fraction", () => {
  assert.equal(MARGIN, OLD_MARGIN);
  for (const [W, H] of [[300, 200], [480, 480], [120, 360]]) {
    for (const frac of [0, 0.1, 0.33, 0.5, 0.75, 0.99, 1]) {
      const a = recorder(), b = recorder();
      drawStrokes(a.ctx, W, H, STROKES, frac);
      oldDrawStrokes(b.ctx, W, H, STROKES, frac);
      assert.deepEqual(a.log, b.log, `${W}x${H} frac ${frac}`);
    }
  }
});

test("paintRich without a field matches the old renderer call for call", () => {
  for (const [W, H] of [[300, 200], [480, 480]]) {
    const a = recorder(), b = recorder();
    paintRich(a.ctx, W, H, STROKES, null, ["#000000", "#ffffff"]);
    oldPaintRichNoField(b.ctx, W, H, STROKES);
    assert.deepEqual(a.log, b.log, `${W}x${H}`);
  }
});

test("the plugin draws only the frame its host armed, in the same task", () => {
  const rec = recorder();
  const engine = createEngine({ reduced: true }).register(atelier);
  const h = engine.mount(canvasOf(rec), "atelier", {});
  h.drawNow();
  assert.equal(rec.log.length, 0, "nothing armed, nothing drawn");
  h.instance.setParams({ mode: "lines", W: 300, H: 200, strokes: STROKES, frac: 0.5 });
  h.drawNow();
  const ref = recorder(); oldDrawStrokes(ref.ctx, 300, 200, STROKES, 0.5);
  assert.deepEqual(rec.log, ref.log);
  const n = rec.log.length;
  h.drawNow();   // an engine still frame (theme, visibility) after the host's frame draws nothing
  assert.equal(rec.log.length, n);
  h.instance.setParams({ mode: "rich", W: 300, H: 200, strokes: STROKES, field: null, pens: ["#000000"] });
  h.drawNow();
  const rich = recorder(); oldPaintRichNoField(rich.ctx, 300, 200, STROKES);
  assert.deepEqual(rec.log.slice(n), rich.log);
  h.dispose(); engine.dispose();
});
