// Shared wrapper. Every motif module exports meta and render(ctx, dest, t, opts) -> { duration }.
// play(engine, mod, opts) runs render into its own bus on the engine's master and returns a handle.
export function playMotif(engine, mod, opts = {}) {
  const ctx = engine.ctx, bus = ctx.createGain(), t = ctx.currentTime + 0.06;
  bus.connect(engine.out);
  const r = mod.render(ctx, bus, t, opts) || { duration: 1 };
  engine.hit(t, 'motif:' + mod.meta.id, 1);
  let done = false;
  const ended = new Promise((res) => setTimeout(() => { done = true; res(); }, (r.duration + 0.4) * 1000));
  return {
    duration: r.duration, ended, info: r,
    stop(fade = 0.12) { if (done) return; const n = ctx.currentTime; bus.gain.cancelScheduledValues(n); bus.gain.setTargetAtTime(0, n, fade / 3); setTimeout(() => bus.disconnect(), fade * 1000 + 300); },
  };
}
