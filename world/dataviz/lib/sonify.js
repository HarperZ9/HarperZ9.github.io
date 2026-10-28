// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dataviz-art/sonify: a series as notes on the Anvil engine (sound/sound).
// Pitch carries the value on a printed key; a soft reference bell marks zero; loudness carries nothing.
// Sound starts only from a click. onStep(i) fires as each note reaches the speakers, so the visual
// hot mark moves with the ear.
import { Engine } from "../../sound/sound/engine.js";
import { pluck, bell } from "../../sound/sound/voices.js";

let engine = null;
async function live() {
  if (!engine) engine = await Engine.live();
  else await engine.resume();
  return engine;
}

// The note for a value on a linear key from [lo, hi] to [noteLo, noteHi] (MIDI numbers, rounded to semitones).
export const noteFor = (v, { lo, hi, noteLo = 45, noteHi = 81 }) =>
  Math.round(noteLo + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (noteHi - noteLo));

// events: [{ value, voice: 'pluck'|'bell', at: seconds from start }]; key: { lo, hi, noteLo, noteHi }
export async function play(events, key, { onStep = () => {}, onEnd = () => {}, reference = null } = {}) {
  const e = await live(), t0 = e.now + 0.15, dest = e.master;
  if (reference != null) bell(e.ctx, dest, t0 - 0.1, { note: noteFor(reference, key), dur: 0.6, vel: 0.12 });
  events.forEach((ev, i) => {
    const t = t0 + ev.at, note = noteFor(ev.value, key);
    if (ev.voice === "bell") bell(e.ctx, dest, t, { note, dur: 0.8, vel: 0.28 });
    else pluck(e.ctx, dest, t, { note, dur: 0.22, vel: 0.32, bright: 2600, type: "triangle", detune: 4 });
    e.hit(t, "step", 1, { i });
  });
  const end = t0 + (events.length ? events[events.length - 1].at : 0) + 0.5;
  let raf = 0, alive = true;
  const tick = () => {
    if (!alive) return;
    for (const h of e.due()) if (h.name === "step") onStep(h.i);
    if (e.now < end) raf = requestAnimationFrame(tick); else { alive = false; onEnd(); }
  };
  raf = requestAnimationFrame(tick);
  return {
    stop() {
      alive = false; cancelAnimationFrame(raf); e.hits.length = 0;
      e.suspend().catch((err) => console.warn("sonify: suspend failed", err));
      onEnd();
    },
  };
}
