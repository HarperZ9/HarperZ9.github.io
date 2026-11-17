// room-sound.mjs: the site's music as a room of The Playground (registry row 'sound', anchor #sound).
//
// The music itself is system/site-music/: createSiteMusic() plays a piece through a worker that composes and
// synthesizes it in the tab, and renderPiece() (piece.js, run here in piece.worker.js) renders a whole piece offline at
// the house loudness. world/sound/sound/wav.js writes the file. This file is the room around them: the five pieces as
// pads, the live view and the controls that play it (room-sound-view.mjs, room-sound-deck.mjs), the file a visitor
// takes away, the address, and the hand-overs.
//   takes   blend   the blend's parts, by share: the first one with a piece of its own chooses the piece
//           text    a line from the type forge: its letters set the seed, so the same line gives the same performance
//   gives   score   the piece as written (key, tempo, the chord book) and, once a file is made, each bar as performed
//           wav     the piece as a .wav file, rendered in this tab and saved by the visitor
//           levels  bass, mid, treble and level of what plays, read by any room that asks (the shader room's iAudio)
// The press that opens the room plays the piece; a link that opens it plays nothing. Nothing leaves the tab.
import { createSiteMusic, DEFAULT_MOODS } from '../../../system/site-music/index.js';
import { PIECES, PIECE_IDS } from '../../../system/site-music/pieces.js';
import { GROUPS, LIMITS } from '../../../system/site-music/live.js';
import { encodeWav } from '../../../world/sound/sound/wav.js';
import { fnv1a } from './bus-kernel.mjs';
import { deckHtml, sayDeck, relabelKeys, BARS_CHOICES } from './room-sound-deck.mjs';
import { createView } from './room-sound-view.mjs';

export const BARS = BARS_CHOICES, SR = 48000, SEED_MAX = 99999;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const about = (p) => `${p.key}, ${p.bpm} beats a minute. ${p.topic}.`;
// How long the offline render is, in samples: three seconds of sea before the first chord (piece.js LEAD_IN), the bars
// (four beats each, each bar a whole number of samples as render.js barTimes lays them), and twelve seconds for the last
// notes and the room to ring out (render.js TAIL). rooms.test.mjs holds the two constants to their sources.
export const LEAD_IN = 3, TAIL = 12;
export const samples = (id, bars, bpm = PIECES[id].bpm) => Math.round(LEAD_IN * SR) + bars * Math.round(240 / bpm * SR) + Math.round(TAIL * SR);
export const seconds = (id, bars, bpm) => samples(id, bars, bpm) / SR;
export const wavBytes = (id, bars, bpm) => 44 + samples(id, bars, bpm) * 4;
const clock = (s) => { const m = Math.floor(s / 60), r = Math.round(s - m * 60); return m ? `${m} min ${r} s` : `${r} s`; };
const within = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;
const round2 = (v) => Math.round(v * 100) / 100;

// The seed a line of text gives: one FNV-1a pass over its UTF-8 bytes (the bus kernel's hash), folded into 1..99999.
export function seedOf(text) { const b = new TextEncoder().encode(String(text).trim()); return fnv1a(b, b.length, 2166136261) % SEED_MAX + 1; }

// Which piece a blend chooses: its parts in order of share, and the first that has a piece in the music's own map.
export function pieceFor(elements = [], weights = null) {
  const order = elements.map((id, i) => [id, weights?.[i] ?? 1, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([id]) => id);
  const at = order.findIndex((id) => PIECES[DEFAULT_MOODS[id]]);
  return { order, element: at < 0 ? null : order[at], piece: at < 0 ? null : DEFAULT_MOODS[order[at]], passed: at < 0 ? order : order.slice(0, at) };
}

// What the address asks for: piece= a piece id, seed= 1..99999, bars= 16, 32 or 48; the band as arr=alt (the second) or
// band= a blend between 0 and 1; bpm= a tempo in the piece's range, key= -6..6 semitones, dens= 0.15..1 of the notes,
// mix= five levels (drums, bass, keys, lead, space) from 0 to 1.5. A value out of range is left out.
export function readState(q, fallback = 'low-tide') {
  const piece = PIECES[q.get('piece')] ? q.get('piece') : fallback, P = PIECES[piece], seed = Math.floor(+q.get('seed')), bars = +q.get('bars'), band = q.has('band') ? +q.get('band') : NaN;
  const bpm = Math.round(+q.get('bpm')), semis = q.has('key') ? Math.round(+q.get('key')) : 0, dens = q.has('dens') ? +q.get('dens') : 1, mix = (q.get('mix') || '').split(',').map(Number);
  const b = within(band, [0, 1]) ? band : q.get('arr') === 'alt' ? 1 : 0;
  return { piece, named: !!PIECES[q.get('piece')], arr: b >= 1 ? 'alt' : 'main', band: b, seed: seed >= 1 && seed <= SEED_MAX ? seed : null, bars: BARS.includes(bars) ? bars : BARS[0],
    bpm: within(bpm, LIMITS.bpm.map((k) => Math.round(k * P.bpm))) ? bpm : P.bpm, semis: within(semis, LIMITS.semis) ? semis : 0, density: within(dens, LIMITS.density) ? dens : 1,
    gains: Object.fromEntries(GROUPS.map((g, i) => [g, mix.length === GROUPS.length && within(mix[i], LIMITS.gain) ? mix[i] : 1])) };
}
export const writeState = (s) => ({ piece: s.piece, arr: s.band >= 1 ? 'alt' : null, band: s.band > 0 && s.band < 1 ? round2(s.band) : null, seed: s.seed, bars: s.bars === BARS[0] ? null : s.bars,
  bpm: s.bpm === PIECES[s.piece].bpm ? null : s.bpm, key: s.semis || null, dens: s.density < 1 ? round2(s.density) : null,
  mix: GROUPS.every((g) => s.gains[g] === 1) ? null : GROUPS.map((g) => round2(s.gains[g])).join(',') });

// The still the page is built with, and the reading with scripts off: the five pieces as written, each with the eight
// bars of its first section. "=" in the book holds the chord before it, so it is written out here.
const opening = (p) => p.sections.A.map((b, i, all) => { let k = i; while (all[k] === '=') k--; return all[k]; });
export function still() {
  return { html: `<ol class="snd-book">${PIECE_IDS.map((id) => { const p = PIECES[id]; return `<li><b>${esc(p.title)}</b> <span>${esc(about(p))}</span> <code>${opening(p).map(esc).join(' | ')}</code></li>`; }).join('')}</ol>`,
    caption: 'Sound: the five pieces as written, each with the eight bars that open it. One bar sits between two strokes; two chord symbols share a bar.' };
}

export function mount(host, input, ctx) {
  const q = ctx.query || new URLSearchParams(), asked = readState(q);
  const make = (st) => createSiteMusic({ seed: st.seed, band: st.band, params: { bpm: st.bpm, semis: st.semis, density: st.density }, gains: st.gains });
  let music = make(asked), madeSeed = asked.seed;
  const state = readState(q, music.mood);
  // the address named no piece, so the music's own remembered piece is the one; its tempo is that piece's own
  music.set({ bpm: state.bpm, semis: state.semis, density: state.density }); music.setBand(state.band);
  let off = null, worker = null, url = null, file = null, call = 0, heardBlend = null, heardText = null, sentFor = '', view = null;
  const reduce = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  host.classList.add('snd');
  host.innerHTML = `${deckHtml(state, music.level)}
<p class="snd-mood" role="status" aria-live="polite"></p>
<p class="snd-file" role="status" aria-live="polite"></p>
<p class="snd-take"><a class="snd-wav" download hidden>Save the piece (.wav)</a></p>
<p class="snd-terms">The music is composed and synthesized in this tab while it plays, and the file is rendered here too, with the tempo, key, notes, band and levels you set. No recording is used, no audio is downloaded and nothing is sent anywhere. Each render is measured for loudness and peak before the file is offered. The measurements can say a render is clean and level. Whether it is beautiful is for a listener.</p>`;
  const $ = (s) => host.querySelector(s), now = $('.snd-now'), fileSay = $('.snd-file'), wav = $('.snd-wav'), render = $('[data-render]'), seedSay = $('.snd-seed-say'), moodSay = $('.snd-mood'), landing = $('.snd-landing');

  const score = (performed = null) => { const p = PIECES[state.piece]; return { piece: state.piece, title: p.title, key: p.key, bpm: state.bpm, semis: state.semis, seed: state.seed, arrangement: state.arr, band: state.band, written: p.sections, performed }; };
  // the score goes to the other rooms when the piece, the seed or the band changes, and again when a file is made
  function hand(performed = null) {
    const key = `${state.piece}|${state.seed}|${state.arr}|${state.bpm}|${state.semis}|${performed ? state.bars : ''}`; if (key === sentFor) return; sentFor = key;
    ctx.send?.('score', score(performed), { recipe: { piece: state.piece, seed: state.seed, arrangement: state.arr, bars: performed ? state.bars : null } });
  }
  const address = () => ctx.address?.(writeState(state));
  function paint() {
    const s = music.state();
    for (const li of host.querySelectorAll('[data-piece]')) { const id = li.dataset.piece, mine = s.playing && id === s.mood, b = li.querySelector('button');
      li.toggleAttribute('data-on', mine); b.setAttribute('aria-pressed', String(mine)); b.querySelector('em').textContent = mine ? 'Stop' : 'Play'; b.setAttribute('aria-label', `${mine ? 'Stop' : 'Play'} ${PIECES[id].title}`); }
    now.textContent = !s.playing ? 'Music is off.' : s.bar ? `${s.title}, bar ${s.bar}: ${s.chords.join(', ')}${s.render === 'full' ? '' : ' (lighter render for this device)'}` : `${s.title} is starting. The sea comes in first.`;
    landing.textContent = s.playing && s.landing !== null ? `The change lands on bar ${s.landing + 1}.` : '';
    host.dataset.playing = s.playing ? s.mood : ''; host.dataset.bar = String(s.bar || 0); host.dataset.landing = s.landing === null ? '' : String(s.landing);
    sayDeck($, state, s);
    $('.snd-cost').textContent = `${PIECES[state.piece].title}, ${state.bars} bars at ${state.bpm} beats a minute: ${clock(seconds(state.piece, state.bars, state.bpm))} of sound, a file of ${wavBytes(state.piece, state.bars, state.bpm).toLocaleString('en')} bytes. Rendering takes several seconds and the page stays usable.`;
    for (const r of host.querySelectorAll('input[name="snd-piece"]')) r.checked = r.value === state.piece;
    view?.kick();
  }
  // a new seed is used the next time the music starts from silence; the player in use keeps its own until then
  function player() {
    if (madeSeed !== state.seed && !music.playing) { off?.(); music = make(state); madeSeed = state.seed; off = music.on(paint); }
    return music;
  }
  const later = () => (music.playing && madeSeed !== state.seed ? ' The music playing now keeps its own; stop it and play again to hear the change.' : '');
  function forget() { if (url) URL.revokeObjectURL(url); url = null; file = null; wav.hidden = true; fileSay.textContent = ''; delete host.dataset.file; }
  function choose(id, { sound = true } = {}) {
    if (!PIECES[id]) return; const ratio = state.bpm / PIECES[state.piece].bpm; state.piece = id;
    state.bpm = Math.round(Math.min(LIMITS.bpm[1], Math.max(LIMITS.bpm[0], ratio)) * PIECES[id].bpm);   // the tempo keeps its share of the written one
    relabelKeys(host, id); music.set({ bpm: state.bpm });
    if (sound) music.setMood(id);
    if (file && file.piece !== id) forget();
    address(); paint(); hand();
  }
  function setSeed(n, why) { state.seed = n; $('#snd-seed').value = n ?? ''; forget(); seedSay.textContent = `${why}${later()}`; address(); hand(); }
  const startErr = (e) => { console.error('sound: the music did not start', e); now.textContent = 'The music could not start in this browser.'; };
  function startPiece(id, audio = null) { player().start(id, { audio }).catch(startErr); choose(id, { sound: false }); }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-play]');
    if (b) {
      const id = b.dataset.play, s = music.state();
      if (s.playing && s.mood === id) { music.stop(); return; }
      if (s.playing) { choose(id); return; }
      startPiece(id);   // start() makes the audio device, which a browser allows only inside a press
      return;
    }
    if (ev.target.closest('[data-render]')) { if (worker) stopRender('Rendering stopped. No file was made.'); else makeFile(); }
  };
  // each control in one place: what it sets, and what the music does about it
  const CONTROLS = {
    'snd-level': (v) => music.setLevel(+v),
    'snd-tempo': (v) => { state.bpm = Math.round(+v); music.set({ bpm: state.bpm }); forget(); },
    'snd-density': (v) => { state.density = +v; music.set({ density: state.density }); forget(); },
    'snd-key': (v) => { state.semis = Math.round(+v); music.set({ semis: state.semis }); forget(); hand(); },
    'snd-band': (v) => { state.band = +v; state.arr = state.band >= 1 ? 'alt' : 'main'; music.setBand(state.band); forget(); hand(); },
    'snd-piece': (v) => choose(v),
    'snd-bars': (v) => { state.bars = +v; forget(); },
  };
  const onInput = (ev) => {
    const t = ev.target, name = t.name || t.id;
    if (t.dataset.group) { state.gains[t.dataset.group] = +t.value; music.setGain(t.dataset.group, +t.value); forget(); }
    else if (CONTROLS[name]) CONTROLS[name](t.value);
    else if (t.id === 'snd-seed') {
      const n = Math.floor(+t.value);
      if (t.value === '') setSeed(null, 'No seed: each listen is a new performance, and a file draws its own seed and shows it.');
      else if (n >= 1 && n <= SEED_MAX) setSeed(n, `Seed ${n}: the same seed gives the same performance, here and in the file.`);
      else seedSay.textContent = `A seed is a whole number from 1 to ${SEED_MAX}. The seed in use stays ${state.seed ?? 'empty'}.`;
      return;
    } else return;
    if (name !== 'snd-piece') { address(); paint(); }
  };
  const onSubmit = (ev) => ev.preventDefault();

  function stopRender(words) { worker?.terminate(); worker = null; call++; render.textContent = 'Make the file'; if (words) fileSay.textContent = words; }
  function makeFile() {
    if (state.seed === null) setSeed(Math.floor(Math.random() * SEED_MAX) + 1, 'The file needed a seed, so one was drawn and is shown here. The address carries it, so a link makes the same file.');
    forget();
    const my = ++call, want = { piece: state.piece, seed: state.seed, bars: state.bars, band: state.band, live: { bpm: state.bpm, semis: state.semis, density: state.density, gains: { ...state.gains } } }, title = PIECES[want.piece].title;
    render.textContent = 'Stop rendering'; fileSay.textContent = `Rendering ${want.bars} bars of ${title} with seed ${want.seed}.`;
    worker = new Worker(new URL('../../../system/site-music/piece.worker.js', import.meta.url), { type: 'module' });
    worker.onerror = (e) => { console.error('sound: the render worker failed', e.message); stopRender('The render failed in this browser. No file was made.'); };
    worker.onmessage = (ev) => {
      const m = ev.data; if (m.call !== my) return;
      if (m.error) { console.error('sound: the render failed', m.error); stopRender('The render failed. No file was made.'); return; }
      const ch = [m.L, m.R], bytes = encodeWav({ numberOfChannels: 2, length: m.L.length, sampleRate: m.sr, getChannelData: (c) => ch[c] });
      stopRender('');
      url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      file = { ...want, bytes: bytes.byteLength, seconds: m.seconds, lufs: m.master.lufs, truePeakDb: m.master.truePeakDb, shape: m.shape, renderMs: m.renderMs };
      const band = want.band <= 0 ? '' : want.band >= 1 ? 'second-band-' : `band-${Math.round(want.band * 100)}-`;
      wav.href = url; wav.download = `${want.piece}-${band}seed-${want.seed}-${want.bars}-bars.wav`; wav.hidden = false;
      host.dataset.file = String(file.bytes);
      fileSay.textContent = `${title}, ${want.bars} bars, seed ${want.seed}: ${clock(m.seconds)} of stereo sound at ${m.sr / 1000} kHz, 16 bits, ${file.bytes.toLocaleString('en')} bytes. Measured on this render: loudness ${m.master.lufs.toFixed(1)} LUFS, true peak ${m.master.truePeakDb.toFixed(1)} dBTP. Shape: ${m.shape.map((p) => `${p.role} ${p.bars}`).join(', ')} bars. Rendered in ${(m.renderMs / 1000).toFixed(1)} s.`;
      hand(m.bars);
    };
    worker.postMessage({ cmd: 'render', call: my, piece: want.piece, seed: want.seed, bars: want.bars, sr: SR, band: want.band, live: want.live });
  }

  // A hand-over heard when the room opens only fills what the address left open; after that, every change is followed.
  function onBlend(env) {
    const pick = pieceFor(env.value?.elements, env.value?.weights), first = heardBlend === null, same = heardBlend === (pick.piece || '');
    heardBlend = pick.piece || '';
    if (!pick.piece) { moodSay.textContent = `The blend is ${pick.order.join(', ')}. None of its parts has a piece of its own, so the piece stays ${PIECES[state.piece].title}.`; return; }
    const title = PIECES[pick.piece].title;
    const how = pick.passed.length ? `${pick.passed.join(' and ')} ${pick.passed.length > 1 ? 'have' : 'has'} no piece of its own; ${pick.element}, next by share, has ${title}` : `${pick.element} leads, and its piece is ${title}`;
    if (first && state.named && state.piece !== pick.piece) { moodSay.textContent = `In the blend, ${how}. The address asked for ${PIECES[state.piece].title}, so that stays.`; return; }
    moodSay.textContent = `In the blend, ${how}.`;
    if (first || !same) choose(pick.piece);
  }
  function onText(env) {
    const text = String(env.value?.text ?? '').trim(), first = heardText === null, same = heardText === text; heardText = text;
    if (!text || same) return;
    if (first && state.seed !== null) { seedSay.textContent = `Seed ${state.seed} came with the address, so the forge's line does not change it.`; return; }
    setSeed(seedOf(text), `The forge's line “${text.slice(0, 48)}” sets seed ${seedOf(text)}. The same line always gives the same performance.`);
  }

  // the live view: dragging it moves the tempo and density sliders, which do the rest
  const meters = [...host.querySelectorAll('.snd-ch')].map((el) => [el.dataset.group, el]);
  const nudge = (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  view = createView($('.snd-view'), { music: { state: () => music.state(), now: () => music.now(), bars: () => music.bars(), notes: () => music.notes(), meters: () => { const m = music.meters(); for (const [g, el] of meters) el.style.setProperty('--lv', m[g].toFixed(3)); return m; } },
    reduce, still: () => opening(PIECES[state.piece]),
    onDrag: { start: () => ({ bpm: state.bpm, density: state.density }), move(from, dx, dy) { const t = $('#snd-tempo'), d = $('#snd-density'), span = +t.max - +t.min;
      nudge(t, Math.round(Math.min(+t.max, Math.max(+t.min, from.bpm + dx * span)))); nudge(d, Math.min(1, Math.max(LIMITS.density[0], Math.round((from.density + dy) * 20) / 20))); } } });

  host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('submit', onSubmit);
  off = music.on(paint);
  ctx.offerLevels?.(() => (music.playing ? music.levels() : null));
  if (state.named) music.setMood(state.piece);
  address(); paint(); hand();
  // the press that opened the room plays the piece at once; ctx.press carries the audio device made inside that press
  if (ctx.press) startPiece(state.piece, ctx.press.audio || null);

  return {
    update(next) { const env = next?.heard; if (env?.medium === 'blend') onBlend(env); else if (env?.medium === 'text') onText(env); },
    value: () => ({ ...state, gains: { ...state.gains }, playing: music.playing, bar: music.state().bar, file: file ? { ...file } : null, rendering: !!worker, probe: music.probe(), levels: music.levels(), frames: view.frames }),
    destroy() {
      host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('submit', onSubmit);
      view.destroy(); ctx.offerLevels?.(null); off?.(); music.stop(); stopRender(''); if (url) URL.revokeObjectURL(url);
      host.innerHTML = ''; host.classList.remove('snd'); delete host.dataset.playing; delete host.dataset.bar; delete host.dataset.file; delete host.dataset.landing;
    },
  };
}
