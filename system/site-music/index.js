// The site's music as a small plain interface, so a page or a shared registry can adopt it without knowing how it works:
//   const music = createSiteMusic();
//   await music.start('low-tide')   start a piece; must be called from a click or key press (browsers require it)
//   music.stop()                    fade out and release the audio device
//   music.setLevel(0.6)             0 to 1, remembered for this visitor
//   music.setMood('night-school')   change piece by id, or by any id in the `moods` map (a topic or an element id)
//   music.on((state) => ...)        { playing, mood, title, level, bar, chords, render, bpm, semis, density, gains, band,
//                                   landing } whenever something changes; render is "full", "lite" or "half": how much
//                                   the renderer has stepped down for the device; landing is the bar a change lands on
// What a listener changes while it plays (live.js):
//   music.setGain('drums', 0.5)     one group's level, heard at once (each group plays on its own bus: desk.js)
//   music.setBand(0.4)              0 the first band, 1 the second (pieces.js ALT), blended at equal power in between
//   music.set({ bpm, semis, density })   tempo, key and how many notes play; rendered again from the next bar that can
//                                   be ready in time, so the change lands on a bar line a moment after the press
//   music.levels()                  { bass, mid, treble, level } of what plays, each 0 to 1 (zero when off)
//   music.meters()                  each group's level, 0 to 1
//   music.notes(), music.bars()     the notes and bars scheduled now, with their times on music.now()'s clock
// Nothing plays until start() is called. The music is generated in the visitor's browser by a worker (worker.js); no
// audio file is downloaded. Two bars are rendered at a time and laid end to end about ten seconds ahead of the playhead.
import { Engine } from '../../world/sound/sound/engine.js';
import { PIECES, PIECE_IDS } from './pieces.js';
import { GROUPS, settle } from './live.js';
import { createLane } from './lane.js';

export const DEFAULT_MOODS = { water: 'low-tide', 'ink-and-water': 'low-tide', sea: 'low-tide', learn: 'night-school', school: 'night-school', light: 'glass-hour', glass: 'glass-hour', sky: 'glass-hour', engine: 'deep-current', type: 'clear-line', lettering: 'clear-line' };
// A device the site already treats as weak (world/site/budget.js marks <html class="weak">: under 4 GB of memory, four or
// fewer cores, or Save-Data) starts on the lighter render; the worker steps down further by its own measurement.
const weak = () => { try { const n = navigator; return document.documentElement.classList.contains('weak') || (n.deviceMemory && n.deviceMemory < 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true; } catch { return false; } };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* private mode: the choice lasts for this visit only */ } } };
// the bands a blend needs rendered: the first alone, the second alone, or both in between
export const bandsFor = (t) => (t <= 0 ? ['main'] : t >= 1 ? ['alt'] : ['main', 'alt']);

export function createSiteMusic({ moods = {}, ahead = 10, seed = null, level = null, arrangement = 'main', band = null, params = {}, gains = {}, workerUrl = new URL('./worker.js', import.meta.url) } = {}) {
  const map = { ...DEFAULT_MOODS, ...moods }, listeners = new Set(), resolve = (id) => (PIECES[id] ? id : map[id] && PIECES[map[id]] ? map[id] : null);
  const s = { playing: false, mood: resolve(store.get('site-music-mood', 'low-tide')) || 'low-tide', level: Math.min(1, Math.max(0, +store.get('site-music-level', 0.7))), bar: 0, chords: [], render: 'full',
    band: band ?? (arrangement === 'alt' ? 1 : 0), params: { ...params }, gains: Object.fromEntries(GROUPS.map((g) => [g, gains[g] ?? 1])), landing: null };
  let engine = null, ownEngine = false, lane = null;
  const settled = () => settle(PIECES[s.mood], s.params);
  const state = () => { const p = settled(); return { ...s, title: PIECES[s.mood].title, bpm: p.bpm, semis: p.semis, density: p.density, gains: { ...s.gains } }; };
  const emit = () => { for (const fn of listeners) fn(state()); };
  function begin() {
    lane?.quiet(1.2);
    lane = createLane({ engine, workerUrl, ahead, piece: s.mood, seed: seed ?? (Date.now() % 100000) + 1, level: level ?? (weak() ? 1 : 0), params: settled(), gains: s.gains, band: s.band, bands: bandsFor(s.band),
      onBar(b, c) { s.bar = b.index + 1; s.chords = b.chords; s.render = c.level; if (s.landing !== null && b.index >= s.landing) s.landing = null; emit(); },
      onLanding(at) { s.landing = at; emit(); } });
  }
  return {
    moods: PIECE_IDS.map((id) => ({ id, title: PIECES[id].title, topic: PIECES[id].topic, key: PIECES[id].key, bpm: PIECES[id].bpm, why: PIECES[id].why })),
    get playing() { return s.playing; }, get mood() { return s.mood; }, get level() { return s.level; }, state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // engine: pass one that a sound bar already made; audio: an AudioContext the page made inside the press itself
    async start(mood = null, { engine: given = null, audio = null } = {}) {
      const id = mood ? resolve(mood) : s.mood; if (!id) throw new Error(`unknown mood ${mood}`);
      if (s.playing) { lane?.quiet(0.4); lane = null; }
      if (!engine) { engine = given || await Engine.live(audio); ownEngine = !given; }
      engine.setVolume(s.level); s.mood = id; store.set('site-music-mood', id); s.playing = true; s.bar = 0; s.chords = []; s.landing = null; begin(); emit();
    },
    stop() {
      if (!s.playing && !engine) return; lane?.quiet(0.5); lane = null; s.playing = false; s.bar = 0; s.chords = []; s.landing = null; emit();
      const e = engine, own = ownEngine; engine = null; if (e && own) setTimeout(() => e.ctx.close().catch((err) => console.warn('site music: closing the audio device failed', err)), 900);
    },
    setLevel(v) { s.level = Math.min(1, Math.max(0, +v || 0)); store.set('site-music-level', s.level); engine?.setVolume(s.level); emit(); },
    setMood(id) { const m = resolve(id); if (!m) return false; const moved = m !== s.mood; s.mood = m; store.set('site-music-mood', m); if (s.playing && moved) { s.bar = 0; s.chords = []; s.landing = null; begin(); } emit(); return true; },
    setGain(g, v) { if (!GROUPS.includes(g)) return; s.gains[g] = Math.min(1.5, Math.max(0, +v || 0)); lane?.desk.setGain(g, s.gains[g]); emit(); },
    setBand(v) { s.band = Math.min(1, Math.max(0, +v || 0)); lane?.setBand(s.band, bandsFor(s.band)); emit(); },
    set(p = {}) { for (const k of ['bpm', 'semis', 'density']) if (k in p) s.params[k] = p[k]; lane?.set(settled()); emit(); },
    levels: () => (lane && s.playing ? lane.desk.levels() : { bass: 0, mid: 0, treble: 0, level: 0 }),
    meters: () => (lane && s.playing ? lane.desk.meters() : Object.fromEntries(GROUPS.map((g) => [g, 0]))),
    notes: () => (lane ? lane.notes() : []),
    bars: () => (lane ? lane.bars() : []),
    now: () => (engine ? engine.ctx.currentTime - (engine.ctx.outputLatency || 0) : 0),
    // what the page reads in a test: the audio device, the desk's gains and what the worker last rendered with
    probe: () => ({ ctx: engine?.ctx.state ?? null, volume: engine ? engine.volume : null, desk: lane ? Object.fromEntries(GROUPS.map((g) => [g, lane.desk.gain(g)])) : null, band: lane?.desk.share() ?? null, rendered: lane?.rendered() ?? null }),
  };
}
