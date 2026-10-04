// DOM-less contract for the living neural instruments. Guards that each frame is
// deterministic per (seed, time), that the clock actually changes the frame
// (motion is real), that the two instruments differ, and that the driver draws a
// single still frame when there is no animation clock (reduced motion / node).
import test from "node:test";
import assert from "node:assert/strict";
import {
  renderNeuralFrame,
  neuralInstruments,
  startNeural,
  stopNeural,
  neuralIsRunning,
  playNeural,
  pauseNeural,
  redrawNeural,
  neuralTime,
  drawNeuralAt,
} from "./studio-neural.js";

// Fake 2d context that records fill colours and rect calls. In node there is no
// offscreen canvas, so the solid renderer takes its fillRect fallback path.
function makeCtx() {
  const log = [];
  const target = {};
  return {
    ctx: new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop === "symbol") return undefined;
        return (...args) => { log.push([prop, ...args]); };
      },
      set(t, prop, value) { t[prop] = value; log.push([`=${String(prop)}`, value]); return true; },
    }),
    log,
  };
}

function frame(opts) {
  const { ctx, log } = makeCtx();
  renderNeuralFrame(ctx, 240, 160, opts);
  return log;
}

test("neuralInstruments lists the two living instruments", () => {
  assert.deepEqual(neuralInstruments(), ["field", "solid"]);
});

test("a frame is deterministic for a given (seed, instrument, time)", () => {
  for (const instrument of ["field", "solid"]) {
    const a = frame({ seed: "aurora", instrument, time: 1.25 });
    const b = frame({ seed: "aurora", instrument, time: 1.25 });
    assert.deepEqual(a, b, `${instrument} must reproduce the same frame`);
  }
});

test("the clock changes the frame (motion is real)", () => {
  for (const instrument of ["field", "solid"]) {
    const t0 = JSON.stringify(frame({ seed: "aurora", instrument, time: 0 }));
    const t1 = JSON.stringify(frame({ seed: "aurora", instrument, time: 2.0 }));
    assert.notEqual(t0, t1, `${instrument} must change with the clock`);
  }
});

test("different seeds and instruments produce different frames", () => {
  const a = JSON.stringify(frame({ seed: "aurora", instrument: "field", time: 0.5 }));
  const b = JSON.stringify(frame({ seed: "cinder", instrument: "field", time: 0.5 }));
  const c = JSON.stringify(frame({ seed: "aurora", instrument: "solid", time: 0.5 }));
  assert.notEqual(a, b, "distinct seeds must differ");
  assert.notEqual(a, c, "field and solid must differ");
});

test("a frame paints: it fills a background and draws cells", () => {
  const log = frame({ seed: "aurora", instrument: "field", time: 0 });
  const fills = log.filter(([m]) => m === "fillRect").length;
  assert.ok(fills > 10, `expected many fillRect, got ${fills}`);
});

test("without an animation clock, the driver draws one still frame and does not loop", () => {
  // node has no requestAnimationFrame, so startNeural must fall back to a single
  // frame and report itself non-animating, never leaving a loop running.
  const { ctx, log } = makeCtx();
  const canvas = { width: 240, height: 160, getContext: () => ctx };
  const res = startNeural(canvas, { seed: "aurora", instrument: "field" });
  assert.equal(res.animating, false);
  assert.equal(neuralIsRunning(), false);
  assert.ok(log.some(([m]) => m === "fillRect"), "should have painted a still frame");
  stopNeural(); // idempotent, must not throw
  assert.equal(neuralIsRunning(), false);
});

test("the instrument rests on its time-0 frame until play, and play needs an animation clock", () => {
  // Since 3 October 2026 the instrument no longer runs from entry. In node there is no
  // requestAnimationFrame, so play is refused and the frame stays at time 0.
  const { ctx, log } = makeCtx();
  const canvas = { width: 240, height: 160, getContext: () => ctx };
  const frames = [];
  const res = startNeural(canvas, { seed: "aurora", instrument: "field", onFrame: (f) => frames.push(f) });
  assert.equal(res.animating, false);
  assert.deepEqual(frames, [{ time: 0, playing: false }]);
  assert.equal(playNeural(), false);
  assert.equal(neuralIsRunning(), false);
  assert.equal(neuralTime(), 0);
  // The resting frame is the reference frame at time 0.
  assert.deepEqual(log, frame({ seed: "aurora", instrument: "field", time: 0 }));
  // A resize clears a canvas; redrawNeural paints the resting frame again.
  redrawNeural();
  assert.equal(frames.length, 2);
  pauseNeural();
  stopNeural();
  assert.equal(playNeural(), false, "nothing to play after stop");
  redrawNeural();
  assert.equal(frames.length, 2, "no redraw after stop");
});

test("drawNeuralAt without a worker draws the reference frame", async () => {
  const { ctx, log } = makeCtx();
  const canvas = { width: 240, height: 160, getContext: () => ctx };
  assert.equal(await drawNeuralAt(canvas, { seed: "cinder", instrument: "solid", time: 1.5 }), true);
  assert.deepEqual(log, frame({ seed: "cinder", instrument: "solid", time: 1.5 }));
});
