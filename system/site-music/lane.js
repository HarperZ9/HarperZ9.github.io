// lane.js: one piece playing. It owns the render worker (worker.js) and a mixing desk (desk.js), asks for the next bars
// about ten seconds ahead of the playhead, lays each chunk's parts end to end on the desk, and tells the page each bar.
// A change of tempo, key, density or band is rendered again from the first bar that can be ready in time: the chunks
// after that bar are dropped, the one it falls in fades out at the bar line, and the new bars start there.
import { GROUPS } from './live.js';
import { createDesk } from './desk.js';

export function createLane({ engine, workerUrl, ahead = 10, piece, seed, level = 0, params = {}, gains = {}, band = 0, bands = ['main'], onBar = () => {}, onLanding = () => {} }) {
  const ctx = engine.ctx, desk = createDesk(ctx, engine.out, { gains, band }), worker = new Worker(workerUrl, { type: 'module' }), waits = new Map();
  let calls = 0, next = 0, timer = null, pending = false, alive = true, epoch = 0, rewriting = false, queued = null, lastRender = 0.6, chunks = [], last = null, debounce = null;
  const ask = (msg) => new Promise((ok, fail) => { const call = ++calls; waits.set(call, { ok, fail }); worker.postMessage({ ...msg, call }); });
  worker.onmessage = (ev) => { const w = waits.get(ev.data.call); if (!w) return; waits.delete(ev.data.call); ev.data.error ? w.fail(new Error(ev.data.error)) : w.ok(ev.data); };
  worker.onerror = (err) => console.error('site music: the render worker failed', err.message);

  function play(part, node, sr, at, srcs) {
    const buf = ctx.createBuffer(2, part.L.length, sr); buf.getChannelData(0).set(part.L); buf.getChannelData(1).set(part.R);
    const src = ctx.createBufferSource(), fade = ctx.createGain(); src.buffer = buf; src.connect(fade); fade.connect(node);
    src.start(Math.max(ctx.currentTime, at)); src.onended = () => { try { fade.disconnect(); } catch { /* already gone */ } };
    srcs.push({ src, fade });
  }
  function place(c) {
    if (next < ctx.currentTime + 0.05) next = ctx.currentTime + 0.12;   // first chunk, or the renderer fell behind: start a moment from now
    const at = next, srcs = [], begin = at - c.pre / c.sr;
    for (const b of Object.keys(c.parts)) for (const g of GROUPS) play(c.parts[b][g], desk.input(b, g), c.sr, begin, srcs);
    play(c.sea, desk.sea, c.sr, begin, srcs); desk.setK(c.k);
    const rec = { start: at, end: at + c.n / c.sr, srcs, bands: c.bands, params: c.params, level: c.level, firstBar: c.firstBar,
      bars: c.bars.map((b, i) => ({ ...b, t0: at + c.barSec[i][0], t1: at + c.barSec[i][1] })), notes: c.notes.map((n) => ({ ...n, t: n.t + at })) };
    rec.timers = rec.bars.map((b) => ({ t0: b.t0, id: setTimeout(() => { if (alive) onBar(b, rec); }, Math.max(0, (b.t0 - ctx.currentTime) * 1000)) }));
    chunks = chunks.filter((r) => r.end + 15 > ctx.currentTime); chunks.push(rec); last = rec;
    next = rec.end; lastRender = c.renderMs / 1000;
  }
  async function fill() {
    if (pending || !alive || rewriting) return; pending = true;
    try {
      while (alive && !rewriting && next - ctx.currentTime < ahead) {
        const ep = epoch, c = (await ask({ cmd: 'chunk', bars: next === 0 ? 1 : 2 })).chunk;
        if (!alive || ep !== epoch || rewriting) break;   // a change came in while this rendered; it renders these bars again
        place(c);
      }
    } catch (err) { if (alive) console.error('site music: a chunk failed to render', err); } finally { pending = false; }
  }
  // drop what was laid from time t on: later chunks are stopped before they start, the one t falls in fades at t
  function cut(t) {
    for (const r of chunks) {
      if (r.end <= t) continue;
      for (const { src, fade } of r.srcs) {
        try { if (r.start >= t) src.stop(); else { fade.gain.setTargetAtTime(0, Math.max(ctx.currentTime, t - 0.02), 0.025); src.stop(t + 0.4); } } catch { /* already stopped */ }
      }
      for (const x of r.timers) if (x.t0 >= t) clearTimeout(x.id);
      r.bars = r.bars.filter((b) => b.t0 < t); r.notes = r.notes.filter((n) => n.t < t); r.end = Math.min(r.end, t);
    }
    chunks = chunks.filter((r) => r.start < t); last = chunks.at(-1) || null; next = t;
  }
  async function rewrite(msg) {
    if (!alive) return;
    if (rewriting) { queued = { ...(queued || {}), ...msg }; return; }
    const ready = ctx.currentTime + Math.max(0.6, lastRender * 1.6 + 0.3), bar = chunks.flatMap((r) => r.bars).find((b) => b.t0 >= ready);
    if (!bar) { onLanding(last ? last.bars.at(-1).index + 1 : null); await ask({ cmd: 'set', ...msg }).catch((err) => console.error('site music: a change was not taken', err)); return; }
    rewriting = true; epoch++; onLanding(bar.index);
    try {
      const r = (await ask({ cmd: 'set', ...msg, from: bar.index })).set;
      const at = r.from === null ? null : chunks.flatMap((x) => x.bars).find((b) => b.index === r.from);
      if (alive && at) cut(at.t0);
    } catch (err) { console.error('site music: a change could not be rendered', err); } finally {
      rewriting = false;
      if (queued) { const q = queued; queued = null; rewrite(q); } else fill();
    }
  }
  ask({ cmd: 'start', piece, seed, sr: ctx.sampleRate, level, parts: true, bands, params }).then(() => { if (!alive) return; fill(); timer = setInterval(fill, 1000); })
    .catch((err) => console.error('site music: could not start the piece', err));

  return {
    desk,
    // tempo, key and density: gathered while a control moves, then rendered again from the next bar that can be ready
    set(p) { clearTimeout(debounce); debounce = setTimeout(() => rewrite({ params: { bpm: p.bpm, semis: p.semis, density: p.density } }), 160); },
    setBand(t, need) {
      desk.setBand(t); const have = last?.bands || bands;
      if (need.every((b) => have.includes(b))) { if (need.length < have.length) ask({ cmd: 'set', bands: need }).catch(() => {}); return; }
      rewrite({ bands: need });
    },
    notes: () => chunks.flatMap((r) => r.notes),
    bars: () => chunks.flatMap((r) => r.bars),
    rendered: () => (last ? { firstBar: last.firstBar, bpm: last.params.bpm, semis: last.params.semis, density: last.params.density, bands: last.bands, chords: last.bars.map((b) => b.chords[0]), notes: last.notes.length, barSec: last.bars.length ? last.bars[0].t1 - last.bars[0].t0 : 0 } : null),
    quiet(fade = 0.6) {
      alive = false; clearInterval(timer); clearTimeout(debounce); worker.terminate();
      const olds = chunks; chunks = []; for (const r of olds) for (const x of r.timers) clearTimeout(x.id);
      desk.fade(fade);
      setTimeout(() => { for (const r of olds) for (const { src } of r.srcs) { try { src.stop(); } catch { /* already ended */ } } desk.close(); }, fade * 1000 + 200);
    },
  };
}
