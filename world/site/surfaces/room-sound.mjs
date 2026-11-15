// room-sound.mjs: the site's music as a room of The Playground (registry row 'sound', anchor #sound).
//
// The music itself is system/site-music/: createSiteMusic() plays a piece through a worker that composes and
// synthesizes it in the tab, and renderPiece() (piece.js, run here in piece.worker.js) renders a whole piece offline at
// the house loudness. world/sound/sound/wav.js writes the file. This file is the room around them: the five pieces,
// the level, the seed, the file a visitor takes away, the address, and the hand-overs.
//   takes   blend   the blend's parts, by share: the first one with a piece of its own chooses the piece
//           text    a line from the type forge: its letters set the seed, so the same line gives the same performance
//   gives   score   the piece as written (key, tempo, the chord book) and, once a file is made, each bar as performed
//           wav     the piece as a .wav file, rendered in this tab and saved by the visitor
// Nothing plays without a press, a link included. Nothing leaves the tab.
import { createSiteMusic, DEFAULT_MOODS } from '../../../system/site-music/index.js';
import { PIECES, PIECE_IDS, ALT } from '../../../system/site-music/pieces.js';
import { encodeWav } from '../../../world/sound/sound/wav.js';
import { fnv1a } from './bus-kernel.mjs';

export const BARS = [16, 32, 48], SR = 48000, SEED_MAX = 99999;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const about = (p) => `${p.key}, ${p.bpm} beats a minute. ${p.topic}.`;
// How long the offline render is, in samples: three seconds of sea before the first chord (piece.js LEAD_IN), the bars
// (four beats each, each bar a whole number of samples as render.js barTimes lays them), and twelve seconds for the last
// notes and the room to ring out (render.js TAIL). rooms.test.mjs holds the two constants to their sources.
export const LEAD_IN = 3, TAIL = 12;
export const samples = (id, bars) => Math.round(LEAD_IN * SR) + bars * Math.round(240 / PIECES[id].bpm * SR) + Math.round(TAIL * SR);
export const seconds = (id, bars) => samples(id, bars) / SR;
export const wavBytes = (id, bars) => 44 + samples(id, bars) * 4;
const clock = (s) => { const m = Math.floor(s / 60), r = Math.round(s - m * 60); return m ? `${m} min ${r} s` : `${r} s`; };

// The seed a line of text gives: one FNV-1a pass over its UTF-8 bytes (the bus kernel's hash), folded into 1..99999.
export function seedOf(text) { const b = new TextEncoder().encode(String(text).trim()); return fnv1a(b, b.length, 2166136261) % SEED_MAX + 1; }

// Which piece a blend chooses: its parts in order of share, and the first that has a piece in the music's own map.
export function pieceFor(elements = [], weights = null) {
  const order = elements.map((id, i) => [id, weights?.[i] ?? 1, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([id]) => id);
  const at = order.findIndex((id) => PIECES[DEFAULT_MOODS[id]]);
  return { order, element: at < 0 ? null : order[at], piece: at < 0 ? null : DEFAULT_MOODS[order[at]], passed: at < 0 ? order : order.slice(0, at) };
}

// What the address asks for: piece= a piece id, arr=alt the second arrangement, seed= 1..99999, bars= 16, 32 or 48.
export function readState(q, fallback = 'low-tide') {
  const seed = Math.floor(+q.get('seed')), bars = +q.get('bars');
  return { piece: PIECES[q.get('piece')] ? q.get('piece') : fallback, named: !!PIECES[q.get('piece')], arr: q.get('arr') === 'alt' ? 'alt' : 'main',
    seed: seed >= 1 && seed <= SEED_MAX ? seed : null, bars: BARS.includes(bars) ? bars : BARS[0] };
}
export const writeState = (s) => ({ piece: s.piece, arr: s.arr === 'alt' ? 'alt' : null, seed: s.seed, bars: s.bars === BARS[0] ? null : s.bars });

// The still the page is built with, and the reading with scripts off: the five pieces as written, each with the eight
// bars of its first section. "=" in the book holds the chord before it, so it is written out here.
export function still() {
  const bars = (p) => p.sections.A.map((b, i, all) => { let k = i; while (all[k] === '=') k--; return all[k]; });
  return { html: `<ol class="snd-book">${PIECE_IDS.map((id) => { const p = PIECES[id]; return `<li><b>${esc(p.title)}</b> <span>${esc(about(p))}</span> <code>${bars(p).map(esc).join(' | ')}</code></li>`; }).join('')}</ol>`,
    caption: 'Sound: the five pieces as written, each with the eight bars that open it. One bar sits between two strokes; two chord symbols share a bar.' };
}

export function mount(host, input, ctx) {
  const q = ctx.query || new URLSearchParams(), asked = readState(q);
  let music = createSiteMusic({ seed: asked.seed, arrangement: asked.arr }), made = { seed: asked.seed, arr: asked.arr };
  const state = readState(q, music.mood);
  let off = null, worker = null, url = null, file = null, call = 0, heardBlend = null, heardText = null, sentFor = '';
  host.classList.add('snd');
  host.innerHTML = `<p class="snd-now" aria-live="off">Music is off.</p>
<ol class="snd-pieces">${PIECE_IDS.map((id) => { const p = PIECES[id]; return `<li data-piece="${id}"><button type="button" data-play="${id}" aria-pressed="false">Play ${esc(p.title)}</button><div><p><b>${esc(about(p))}</b></p><details><summary>Why it sounds this way</summary><p>${esc(p.why)}</p></details></div></li>`; }).join('')}</ol>
<form class="snd-set" aria-label="Sound settings">
<fieldset><legend>Listening</legend>
<label for="snd-level">Level <output for="snd-level"></output></label><input type="range" id="snd-level" min="0" max="1" step="0.05" value="${music.level}">
<label for="snd-arr">Band</label><select id="snd-arr"><option value="main">First arrangement</option><option value="alt"${state.arr === 'alt' ? ' selected' : ''}>Second arrangement</option></select>
<p class="snd-band"></p>
<label for="snd-seed">Seed</label><input type="number" id="snd-seed" min="1" max="${SEED_MAX}" step="1" inputmode="numeric" placeholder="new each time" value="${state.seed ?? ''}">
<p class="snd-seed-say" role="status" aria-live="polite">The seed sets the order of the sections, the piano's rhythm, the fills and how the lead develops its theme. Left empty, each listen is a new performance.</p>
</fieldset>
<fieldset><legend>The file</legend>
<label for="snd-piece">Piece</label><select id="snd-piece">${PIECE_IDS.map((id) => `<option value="${id}"${id === state.piece ? ' selected' : ''}>${esc(PIECES[id].title)}</option>`).join('')}</select>
<label for="snd-bars">Length</label><select id="snd-bars">${BARS.map((b) => `<option value="${b}"${b === state.bars ? ' selected' : ''}>${b} bars</option>`).join('')}</select>
<p class="snd-cost"></p>
<button type="button" data-render>Make the file</button>
</fieldset>
</form>
<p class="snd-mood" role="status" aria-live="polite"></p>
<p class="snd-file" role="status" aria-live="polite"></p>
<p class="snd-take"><a class="snd-wav" download hidden>Save the piece (.wav)</a></p>
<p class="snd-terms">The music is composed and synthesized in this tab while it plays, and the file is rendered here too. No recording is used, no audio is downloaded and nothing is sent anywhere. Each render is measured for loudness and peak before the file is offered. The measurements can say a render is clean and level. Whether it is beautiful is for a listener.</p>`;
  const $ = (s) => host.querySelector(s), now = $('.snd-now'), fileSay = $('.snd-file'), wav = $('.snd-wav'), render = $('[data-render]'), seedSay = $('.snd-seed-say'), moodSay = $('.snd-mood');

  const score = (performed = null) => { const p = PIECES[state.piece]; return { piece: state.piece, title: p.title, key: p.key, bpm: p.bpm, seed: state.seed, arrangement: state.arr, written: p.sections, performed }; };
  // the score goes to the other rooms when the piece, the seed or the band changes, and again when a file is made
  function hand(performed = null) {
    const key = `${state.piece}|${state.seed}|${state.arr}|${performed ? state.bars : ''}`; if (key === sentFor) return; sentFor = key;
    ctx.send?.('score', score(performed), { recipe: { piece: state.piece, seed: state.seed, arrangement: state.arr, bars: performed ? state.bars : null } });
  }
  function paint() {
    const s = music.state();
    for (const li of host.querySelectorAll('[data-piece]')) { const id = li.dataset.piece, mine = s.playing && id === s.mood, b = li.querySelector('button');
      li.toggleAttribute('data-on', mine); b.setAttribute('aria-pressed', String(mine)); b.textContent = `${mine ? 'Stop' : 'Play'} ${PIECES[id].title}`; }
    now.textContent = !s.playing ? 'Music is off.' : s.bar ? `${s.title}, bar ${s.bar}: ${s.chords.join(', ')}${s.render === 'full' ? '' : ' (lighter render for this device)'}` : `${s.title} is starting. The sea comes in first.`;
    host.dataset.playing = s.playing ? s.mood : ''; host.dataset.bar = String(s.bar || 0);
    $('output[for="snd-level"]').textContent = `${Math.round(s.level * 100)}%`;
    $('.snd-band').textContent = state.arr === 'alt' ? `${PIECES[state.piece].title} played by ${ALT[state.piece].name}.` : `${PIECES[state.piece].title} played by its first band.`;
    $('.snd-cost').textContent = `${PIECES[state.piece].title}, ${state.bars} bars: ${clock(seconds(state.piece, state.bars))} of sound, a file of ${wavBytes(state.piece, state.bars).toLocaleString('en')} bytes. Rendering takes several seconds and the page stays usable.`;
    $('#snd-piece').value = state.piece;
  }
  const stale = () => made.seed !== state.seed || made.arr !== state.arr;
  // a new seed or band is used the next time the music starts from silence; the player in use keeps its own until then
  function player() {
    if (stale() && !music.playing) { off?.(); music = createSiteMusic({ seed: state.seed, arrangement: state.arr }); made = { seed: state.seed, arr: state.arr }; off = music.on(paint); }
    return music;
  }
  const later = () => (music.playing && stale() ? ' The music playing now keeps its own; stop it and play again to hear the change.' : '');
  function forget() { if (url) URL.revokeObjectURL(url); url = null; file = null; wav.hidden = true; fileSay.textContent = ''; delete host.dataset.file; }
  function choose(id, { sound = true } = {}) {
    if (!PIECES[id]) return; state.piece = id;
    if (sound) music.setMood(id);
    if (file && file.piece !== id) forget();
    ctx.address?.(writeState(state)); paint(); hand();
  }
  function setSeed(n, why) {
    state.seed = n; $('#snd-seed').value = n ?? ''; forget();
    seedSay.textContent = `${why}${later()}`;
    ctx.address?.(writeState(state)); hand();
  }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-play]');
    if (b) {
      const id = b.dataset.play, s = music.state();
      if (s.playing && s.mood === id) { music.stop(); return; }
      if (s.playing) { choose(id); return; }
      // start() makes the audio device, which a browser allows only inside a press
      player().start(id).catch((e) => { console.error('sound: the music did not start', e); now.textContent = 'The music could not start in this browser.'; });
      choose(id, { sound: false });
      return;
    }
    if (ev.target.closest('[data-render]')) { if (worker) stopRender('Rendering stopped. No file was made.'); else makeFile(); }
  };
  const onInput = (ev) => {
    const t = ev.target;
    if (t.id === 'snd-level') { music.setLevel(+t.value); paint(); }
    else if (t.id === 'snd-piece') choose(t.value);
    else if (t.id === 'snd-bars') { state.bars = +t.value; forget(); ctx.address?.(writeState(state)); paint(); }
    else if (t.id === 'snd-arr') { state.arr = t.value === 'alt' ? 'alt' : 'main'; forget(); ctx.address?.(writeState(state)); paint(); seedSay.textContent = `The band changed.${later() || ' It plays from the next Play.'}`; hand(); }
    else if (t.id === 'snd-seed') {
      const n = Math.floor(+t.value);
      if (t.value === '') setSeed(null, 'No seed: each listen is a new performance, and a file draws its own seed and shows it.');
      else if (n >= 1 && n <= SEED_MAX) setSeed(n, `Seed ${n}: the same seed gives the same performance, here and in the file.`);
      else seedSay.textContent = `A seed is a whole number from 1 to ${SEED_MAX}. The seed in use stays ${state.seed ?? 'empty'}.`;
    }
  };
  const onSubmit = (ev) => ev.preventDefault();

  function stopRender(words) { worker?.terminate(); worker = null; call++; render.textContent = 'Make the file'; if (words) fileSay.textContent = words; }
  function makeFile() {
    if (state.seed === null) setSeed(Math.floor(Math.random() * SEED_MAX) + 1, 'The file needed a seed, so one was drawn and is shown here. The address carries it, so a link makes the same file.');
    forget();
    const my = ++call, want = { piece: state.piece, seed: state.seed, bars: state.bars, arr: state.arr }, title = PIECES[want.piece].title;
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
      wav.href = url; wav.download = `${want.piece}-${want.arr === 'alt' ? 'second-band-' : ''}seed-${want.seed}-${want.bars}-bars.wav`; wav.hidden = false;
      host.dataset.file = String(file.bytes);
      fileSay.textContent = `${title}, ${want.bars} bars, seed ${want.seed}: ${clock(m.seconds)} of stereo sound at ${m.sr / 1000} kHz, 16 bits, ${file.bytes.toLocaleString('en')} bytes. Measured on this render: loudness ${m.master.lufs.toFixed(1)} LUFS, true peak ${m.master.truePeakDb.toFixed(1)} dBTP. Shape: ${m.shape.map((p) => `${p.role} ${p.bars}`).join(', ')} bars. Rendered in ${(m.renderMs / 1000).toFixed(1)} s.`;
      hand(m.bars);
    };
    worker.postMessage({ cmd: 'render', call: my, piece: want.piece, seed: want.seed, bars: want.bars, sr: SR, arrangement: want.arr });
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

  host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('submit', onSubmit);
  off = music.on(paint);
  if (state.named) music.setMood(state.piece);
  ctx.address?.(writeState(state)); paint(); hand();

  return {
    update(next) { const env = next?.heard; if (env?.medium === 'blend') onBlend(env); else if (env?.medium === 'text') onText(env); },
    value: () => ({ ...state, playing: music.playing, bar: music.state().bar, file: file ? { ...file } : null, rendering: !!worker }),
    destroy() {
      host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('submit', onSubmit);
      off?.(); music.stop(); stopRender(''); if (url) URL.revokeObjectURL(url);
      host.innerHTML = ''; host.classList.remove('snd'); delete host.dataset.playing; delete host.dataset.bar; delete host.dataset.file;
    },
  };
}
