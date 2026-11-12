// The site's music as a small plain interface, so a page or a shared registry can adopt it without knowing how it works:
//   const music = createSiteMusic();
//   await music.start('low-tide')   start a piece; must be called from a click or key press (browsers require it)
//   music.stop()                    fade out and release the audio device
//   music.setLevel(0.6)             0 to 1, remembered for this visitor
//   createSiteMusic({ arrangement: 'alt' })   the pieces' second arrangements (pieces.js ALT)
//   music.setMood('night-school')   change piece by id, or by any id in the `moods` map (a topic or an element id)
//   music.on((state) => ...)        { playing, mood, title, level, bar, chords, render } whenever something changes;
//                                   render is "full", "lite" or "half": how much the renderer has stepped down for the device
// Nothing plays until start() is called. The music is generated in the visitor's browser by a worker (worker.js); no
// audio file is downloaded. Two bars are rendered at a time and laid end to end about ten seconds ahead of the playhead.
import { Engine } from '../../world/sound/sound/engine.js';
import { PIECES, PIECE_IDS } from './pieces.js';

export const DEFAULT_MOODS = { water: 'low-tide', 'ink-and-water': 'low-tide', sea: 'low-tide', learn: 'night-school', school: 'night-school', light: 'glass-hour', glass: 'glass-hour', sky: 'glass-hour', engine: 'deep-current', type: 'clear-line', lettering: 'clear-line' };
// A device the site already treats as weak (world/site/budget.js marks <html class="weak">: under 4 GB of memory, four or
// fewer cores, or Save-Data) starts on the lighter render; the worker steps down further by its own measurement.
const weak = () => { try { const n = navigator; return document.documentElement.classList.contains('weak') || (n.deviceMemory && n.deviceMemory < 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true; } catch { return false; } };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* private mode: the choice lasts for this visit only */ } } };

export function createSiteMusic({ moods = {}, ahead = 10, seed = null, level = null, arrangement = 'main', workerUrl = new URL('./worker.js', import.meta.url) } = {}) {
  const map = { ...DEFAULT_MOODS, ...moods }, listeners = new Set(), resolve = (id) => (PIECES[id] ? id : map[id] && PIECES[map[id]] ? map[id] : null);
  const s = { playing: false, mood: resolve(store.get('site-music-mood', 'low-tide')) || 'low-tide', level: Math.min(1, Math.max(0, +store.get('site-music-level', 0.7))), bar: 0, chords: [], render: 'full' };
  let engine = null, ownEngine = false, worker = null, bus = null, next = 0, timer = null, run = 0, calls = 0, pending = false, sources = [];
  const waits = new Map(), state = () => ({ ...s, title: PIECES[s.mood].title }), emit = () => { for (const fn of listeners) fn(state()); };
  const ask = (msg) => new Promise((ok, fail) => { const call = ++calls; waits.set(call, { ok, fail }); worker.postMessage({ ...msg, call }); });

  function place(c, mine) {
    if (mine !== run || !engine) return;
    const ctx = engine.ctx, buf = ctx.createBuffer(2, c.L.length, c.sr); buf.getChannelData(0).set(c.L); buf.getChannelData(1).set(c.R);
    if (next < ctx.currentTime + 0.05) next = ctx.currentTime + 0.12;   // first chunk, or the renderer fell behind: start a moment from now
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(bus); src.start(Math.max(ctx.currentTime, next - c.pre / c.sr));
    sources.push(src); src.onended = () => { sources = sources.filter((x) => x !== src); };
    const at = next; c.bars.forEach((b, i) => setTimeout(() => { if (mine === run) { s.bar = b.index + 1; s.chords = b.chords; s.render = c.level; emit(); } }, Math.max(0, (at + i * c.n / c.bars.length / c.sr - ctx.currentTime) * 1000)));
    next += c.n / c.sr;
  }
  async function fill(mine) {
    if (pending || mine !== run || !engine) return; pending = true;
    try { while (mine === run && engine && next - engine.ctx.currentTime < ahead) place((await ask({ cmd: 'chunk', bars: next === 0 ? 1 : 2 })).chunk, mine); }
    catch (err) { console.error('site music: a chunk failed to render', err); }
    finally { pending = false; }
  }
  function begin() {
    const mine = ++run, ctx = engine.ctx; worker?.terminate();
    worker = new Worker(workerUrl, { type: 'module' }); waits.clear();
    worker.onmessage = (ev) => { const w = waits.get(ev.data.call); if (!w) return; waits.delete(ev.data.call); ev.data.error ? w.fail(new Error(ev.data.error)) : w.ok(ev.data); };
    worker.onerror = (err) => console.error('site music: the render worker failed', err.message);
    bus = ctx.createGain(); bus.gain.value = 1; bus.connect(engine.out); next = 0; pending = false;
    clearInterval(timer); timer = null;
    ask({ cmd: 'start', piece: s.mood, arrangement, seed: seed ?? (Date.now() % 100000) + 1, sr: ctx.sampleRate, level: level ?? (weak() ? 1 : 0) }).then(() => { if (mine !== run) return; fill(mine); timer = setInterval(() => fill(mine), 1000); }).catch((err) => console.error('site music: could not start the piece', err));
  }
  function quiet(fade = 0.6) {
    run++; clearInterval(timer); timer = null; worker?.terminate(); worker = null;
    if (bus && engine) { const t = engine.ctx.currentTime, old = bus, olds = sources; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, fade / 3); sources = [];
      setTimeout(() => { for (const x of olds) { try { x.stop(); } catch { /* already ended */ } } old.disconnect(); }, fade * 1000 + 200); }
    bus = null;
  }
  return {
    moods: PIECE_IDS.map((id) => ({ id, title: PIECES[id].title, topic: PIECES[id].topic, key: PIECES[id].key, bpm: PIECES[id].bpm, why: PIECES[id].why })),
    get playing() { return s.playing; }, get mood() { return s.mood; }, get level() { return s.level; }, state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // engine: pass one that a sound bar already made; without it this makes its own (and closes it on stop)
    async start(mood = null, { engine: given = null } = {}) {
      const id = mood ? resolve(mood) : s.mood; if (!id) throw new Error(`unknown mood ${mood}`);
      if (s.playing) quiet(0.4);
      if (!engine) { engine = given || await Engine.live(); ownEngine = !given; }
      engine.setVolume(s.level); s.mood = id; store.set('site-music-mood', id); s.playing = true; s.bar = 0; s.chords = []; begin(); emit();
    },
    stop() {
      if (!s.playing && !engine) return; quiet(0.5); s.playing = false; s.bar = 0; s.chords = []; emit();
      const e = engine, own = ownEngine; engine = null; if (e && own) setTimeout(() => e.ctx.close().catch((err) => console.warn('site music: closing the audio device failed', err)), 900);
    },
    setLevel(v) { s.level = Math.min(1, Math.max(0, +v || 0)); store.set('site-music-level', s.level); engine?.setVolume(s.level); emit(); },
    setMood(id) { const m = resolve(id); if (!m) return false; if (s.playing) { if (m !== s.mood) { quiet(1.2); s.mood = m; s.bar = 0; s.chords = []; begin(); } } else s.mood = m; store.set('site-music-mood', m); emit(); return true; },
  };
}
