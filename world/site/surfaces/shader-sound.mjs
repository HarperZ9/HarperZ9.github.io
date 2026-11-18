// shader-sound.mjs: the Retro Studio's sound rack in the shader room. Three sources (the studio's instrument, a
// microphone, a file of the visitor's), each started by a press and none before; the picture played as sound (rows are
// pitches, the scan is time); where sound reaches into the picture (the shader's iAudio, the effects, the pixel grid,
// the bloom) and how strongly; a hardware controller mapped to any slider (MIDI learn); and the playing recorded as a
// score, played back and saved as a MIDI file, with the picture itself transcribed as MIDI.
// The engines load on first use, by address: system/retro-audio.js, ans-voice.js and midi-writer.js.
export const SOUND_URLS = Object.freeze({ audio: '/system/retro-audio.js?v=20261003-retro-sound', ans: '/system/ans-voice.js?v=20260812-cohesion', midi: '/system/midi-writer.js?v=20260811-crossings' });
export const REACTS = Object.freeze([['shader', 'Shader'], ['effects', 'Effects'], ['pixel', 'Pixel size'], ['bloom', 'Bloom']]);
const MIDI_KEY = 're.midimap.v1';
const PENTA = [0, 3, 5, 7, 10], KIND = { chip: 0, slider: 1, preset: 2, tab: 3, bell: 4 };
const note = (k, v) => Math.max(24, Math.min(96, 57 + PENTA[(KIND[k] ?? 2) % 5] + Math.round((v || 0) * 12)));

export function soundHtml(P) {
  const chip = (id, label) => `<button type="button" id="${id}" aria-pressed="false">${label}</button>`;
  return `<details class="shd-rack" data-rack="sound"><summary>Sound: sources, reach and score <span class="shd-snd-state"></span></summary><div class="shd-rack-body">
<p class="shd-rack-note">Sound starts only on a press. It is analysed in this tab and sent nowhere.</p>
<p class="shd-row">${chip('shd-snd-instr', 'Instrument')} ${chip('shd-snd-mic', 'Microphone')} ${chip('shd-snd-file', 'Your audio')}</p>
<input type="file" id="shd-snd-audio" accept="audio/*" hidden>
<p class="shd-row">${chip('shd-snd-pic', 'Play the picture')}</p>
<p class="shd-vibes-h">Sound reaches into</p><p class="shd-row">${REACTS.map(([id, label]) => `<button type="button" data-react="${id}" aria-pressed="${P.react.includes(id)}">${label}</button>`).join(' ')}</p>
<label for="shd-react">How strongly sound drives the picture <output for="shd-react">${(P.reactAmt / 100).toFixed(2)}</output></label><input type="range" id="shd-react" min="0" max="100" value="${P.reactAmt}">
<p class="shd-vibes-h">A controller of yours</p><p class="shd-row"><button type="button" id="shd-midi" aria-pressed="false">MIDI learn</button> <button type="button" id="shd-midi-clear">Forget every binding</button> <span class="shd-midi-state"></span></p>
<p class="shd-vibes-h">The playing as a score</p><p class="shd-row">${chip('shd-rec', 'Record')} <button type="button" id="shd-rec-play">Play it back</button> <button type="button" id="shd-rec-midi">Save it as MIDI</button> <button type="button" id="shd-pic-midi">The picture as MIDI</button></p>
<p class="shd-snd-say" role="status" aria-live="polite"></p>
</div></details>`;
}

// room: { shown(), P, changed(kind), save(name, blob, words), seed(), knobs() }
export function wireSound(host, room) {
  const $ = (s) => host.querySelector(s), say = (t) => { $('.shd-snd-say').textContent = t; host.dataset.soundSaid = String(+(host.dataset.soundSaid || 0) + 1); };
  const P = room.P, REC = { on: false, t0: 0, events: [], bands: [], last: 0, timers: [] };
  let audio = null, mic = false, pic = null, picTimer = 0, midiMap = {}, learn = null, inputs = 0, lastFeed = 0, lastPing = 0;
  try { midiMap = JSON.parse(localStorage.getItem(MIDI_KEY) || '{}'); } catch { midiMap = {}; }
  const press = (id, on) => $(`#${id}`)?.setAttribute('aria-pressed', String(!!on));
  const seed = () => `${room.seed() || 'drone'}-${P.pal}`;
  async function ensure() { if (!audio) { const m = await import(SOUND_URLS.audio); audio = m.createRetroAudio(); } return audio; }
  const refusal = (e) => (/reduced sound/.test(e?.message || '') ? 'Reduced sound is on, so the instrument stays silent.' : `The sound did not start: ${e?.message || 'the browser refused it'}.`);
  const live = () => !!(audio && (audio.isOn() || audio.hasInput() || audio.scanPlaying?.() || audio.loopPlaying?.()));
  function state() { $('.shd-snd-state').textContent = !audio ? '' : audio.isOn() ? 'instrument on' : audio.hasInput() ? 'listening' : ''; host.dataset.sound = live() ? 'on' : 'off'; }
  // The levels for this frame: the studio's own sound while it plays (own: the reach slider scales it, as in the studio),
  // else the sound room's (lv), as that room gives them, else silence.
  function levels(lv) {
    let a = live() ? { ...audio.bands(), own: true } : lv; a = a || { bass: 0, mid: 0, treble: 0, level: 0 };
    if (REC.on && REC.bands.length < 4000 && performance.now() - REC.last > 150) { REC.last = performance.now(); REC.bands.push([REC.last - REC.t0, a.bass, a.mid, a.treble]); }
    return a;
  }
  // The frame sung: a middle row of the picture, in six bands, drives the instrument's harmonics (the studio's sampleAudio).
  function feed() {
    if (!audio?.isOn() || performance.now() - lastFeed < 45) return; lastFeed = performance.now();
    const f = room.shown(), w = f.width, h = f.height; if (!w || !h) return;
    const k = document.createElement('canvas'); k.width = 48; k.height = 1; const g = k.getContext('2d', { willReadFrequently: true }); g.drawImage(f, 0, h >> 1, w, 1, 0, 0, 48, 1);
    const row = g.getImageData(0, 0, 48, 1).data, luma = []; for (let i = 0; i < 48; i++) luma.push((row[i * 4] * 0.299 + row[i * 4 + 1] * 0.587 + row[i * 4 + 2] * 0.114) / 255);
    const bands = []; for (let b = 0; b < 6; b++) { const part = luma.slice(b * 8, b * 8 + 8), m = part.reduce((s, x) => s + x, 0) / 8; bands.push(Math.min(1, (part.reduce((s, x) => s + Math.abs(x - m), 0) / 8) * 3.5 + m * 0.18)); }
    audio.feed(bands);
  }
  // Every edit is a note while the instrument plays, and a timed event while the score records.
  function gesture(ev) {
    const t = ev.target; if (!t || !t.closest('.shd')) return;
    const kind = t.type === 'range' ? 'slider' : t.dataset?.srcTab ? 'tab' : t.tagName === 'SELECT' ? 'preset' : t.tagName === 'BUTTON' ? 'chip' : 'bell';
    const v = t.type === 'range' ? (t.value - t.min) / ((t.max - t.min) || 1) : 0.5, now = performance.now();
    if (kind === 'slider' && now - lastPing < 70) return; lastPing = now;
    if (REC.on && REC.events.length < 4000) REC.events.push([now - REC.t0, kind, v]);
    try { if (audio?.isOn()) audio.ping(kind, v); } catch (e) { console.error('shader room: a note did not play', e); }
  }
  async function instrument() {
    try { await ensure(); } catch (e) { console.error('shader room: the instrument did not load', e); say('The instrument did not load.'); return; }
    if (audio.isOn()) { audio.stop(); press('shd-snd-instr', false); if (pic) { clearTimeout(picTimer); pic = null; press('shd-snd-pic', false); } say('The instrument is off.'); }
    else { try { await audio.start(seed()); press('shd-snd-instr', true); say('The instrument plays the frame; every edit is a note.'); } catch (e) { say(refusal(e)); } }
    state(); room.changed('sound');
  }
  async function microphone() {
    try { await ensure(); } catch (e) { console.error('shader room: the instrument did not load', e); say('Sound did not load.'); return; }
    if (mic) { audio.stopMic(); mic = false; press('shd-snd-mic', false); say('The microphone is off.'); }
    else { try { await audio.startMic(); mic = true; press('shd-snd-mic', true); say('Listening to your room, analysed in this tab only.'); } catch (e) { console.error('shader room: no microphone', e); say('The microphone was refused.'); } }
    state(); room.changed('sound');
  }
  async function file(f) {
    try { await ensure(); const secs = await audio.playFile(f); press('shd-snd-file', true); say(`Playing ${f.name}, a ${secs} s loop.`); } catch (e) { console.error('shader room: the audio file did not play', e); say('That audio file could not be decoded.'); }
    state(); room.changed('sound');
  }
  async function playPicture() {
    if (pic) { clearTimeout(picTimer); pic.stop(); pic = null; press('shd-snd-pic', false); say('The scan stopped.'); return; }
    try { await ensure(); const m = await import(SOUND_URLS.ans), scan = m.scanImage(room.shown(), 40, 96); pic = await audio.playScan(scan, m.rowFrequencies(scan.rows, { mode: 'penta' }), 9, 'shader-picture'); }
    catch (e) { console.error('shader room: the picture did not play', e); say(refusal(e)); return; }
    press('shd-snd-pic', true); say('Playing the picture: rows are pitches, the scan is time, light is loudness.');
    picTimer = setTimeout(() => { pic = null; press('shd-snd-pic', false); }, 9700); state();
  }
  async function writeMidi(events, name, words) { const w = await import(SOUND_URLS.midi), bytes = w.writeMIDI({ ticksPerQuarter: 480, tempoBPM: 96, events }); room.save(name, new Blob([bytes], { type: 'audio/midi' }), words); }
  async function scoreMidi() {
    if (!REC.events.length) { say('Nothing recorded yet: press Record and play the room.'); return; }
    const tick = (ms) => Math.round((ms * 480 * 96) / 60000), ev = [];
    for (const [t, k, v] of REC.events) { const n = note(k, v); ev.push({ tick: tick(t), type: 'on', ch: 0, a: n, b: Math.min(127, 48 + Math.round((v || 0.5) * 70)) }, { tick: tick(t) + 240, type: 'off', ch: 0, a: n, b: 0 }); }
    for (const [t, b, m, tr] of REC.bands) ev.push({ tick: tick(t), type: 'cc', ch: 0, a: 1, b: Math.min(127, Math.round(((b + m + tr) / 3) * 127)) });
    await writeMidi(ev, 'shader-performance.mid', `Saved the performance as MIDI: ${REC.events.length} notes.`);
  }
  async function pictureMidi() {
    const a = await import(SOUND_URLS.ans), scan = a.scanImage(room.shown(), 40, 96), ev = a.scanToMIDI(scan, a.rowFrequencies(scan.rows, { mode: 'penta' }), {});
    if (!ev.length) { say('The picture is too dark to transcribe: brighten it first.'); return; }
    await writeMidi(ev, 'shader-picture.mid', `The picture transcribed: ${ev.filter((e) => e.type === 'on').length} notes.`);
  }
  async function replay() {
    if (!REC.events.length) { say('Nothing recorded yet: press Record and play the room.'); return; }
    try { await ensure(); if (!audio.isOn()) { await audio.start(seed()); press('shd-snd-instr', true); } } catch (e) { say(refusal(e)); return; }
    REC.timers.forEach(clearTimeout); REC.timers = REC.events.map(([t, k, v]) => setTimeout(() => { try { audio.ping(k, v); } catch (e) { console.error('shader room: a recorded note did not play', e); } }, t));
    say(`Playing the performance back: ${REC.events.length} gestures.`); state();
  }
  // MIDI learn: press Learn, move a slider in the room, then turn a knob on the device.
  const midiSay = () => { $('.shd-midi-state').textContent = inputs ? `${inputs} in, ${Object.keys(midiMap).length} mapped` : learn ? 'no device yet' : ''; };
  function onMidi(msg) {
    const d = msg.data; if (!d || (d[0] & 0xf0) !== 0xb0) return;
    const key = `${d[0] & 0x0f}:${d[1]}`;
    if (learn?.stage === 2) { midiMap[key] = learn.target; try { localStorage.setItem(MIDI_KEY, JSON.stringify(midiMap)); } catch (e) { console.error('shader room: the MIDI map was not kept', e); } learn = null; press('shd-midi', false); say(`Mapped CC ${d[1]}: turn it and watch.`); midiSay(); return; }
    const el = midiMap[key] && host.querySelector(`#${CSS.escape(midiMap[key])}`);
    if (el?.type === 'range') { el.value = String(+el.min + (d[2] / 127) * (+el.max - +el.min)); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  async function midiLearn() {
    if (learn) { learn = null; press('shd-midi', false); say('Learn cancelled.'); return; }
    learn = { stage: 1 }; press('shd-midi', true); say('Learn: move a slider in the room first.');
    if (!navigator.requestMIDIAccess) { say('Learn is armed, but this browser has no Web MIDI (Chrome and Edge have it).'); return; }
    try { const acc = await navigator.requestMIDIAccess({ sysex: false }); const wire = () => { inputs = 0; acc.inputs.forEach((i) => { inputs++; i.onmidimessage = onMidi; }); midiSay(); }; acc.onstatechange = wire; wire(); }
    catch (e) { console.error('shader room: MIDI was refused', e); say('Learn is armed; the browser refused MIDI access.'); }
  }
  function learnFrom(ev) {
    if (learn?.stage !== 1 || !ev.isTrusted || ev.target.type !== 'range') return;
    if (!ev.target.id) { say('That dial cannot be mapped; pick a labelled slider.'); return; }
    learn = { stage: 2, target: ev.target.id }; say('Learn: now turn a knob on your device.');
  }
  function onClick(ev) {
    const b = ev.target.closest('button'); if (!b) return false;
    if (b.id === 'shd-snd-instr') instrument(); else if (b.id === 'shd-snd-mic') microphone(); else if (b.id === 'shd-snd-file') { say('Choose an audio file of yours; it plays in this tab only.'); $('#shd-snd-audio').click(); }
    else if (b.id === 'shd-snd-pic') playPicture();
    else if (b.dataset.react) { const i = P.react.indexOf(b.dataset.react); if (i >= 0) P.react.splice(i, 1); else P.react.push(b.dataset.react); b.setAttribute('aria-pressed', String(i < 0)); room.changed('picture'); }
    else if (b.id === 'shd-midi') midiLearn();
    else if (b.id === 'shd-midi-clear') { midiMap = {}; try { localStorage.removeItem(MIDI_KEY); } catch (e) { console.error('shader room: the MIDI map was not cleared', e); } learn = null; press('shd-midi', false); midiSay(); say('Every MIDI binding is forgotten.'); }
    else if (b.id === 'shd-rec') { REC.on = !REC.on; press('shd-rec', REC.on); if (REC.on) { REC.t0 = performance.now(); REC.events = []; REC.bands = []; say('Recording: every edit is a note, sound on or off.'); } else say(`Recorded ${REC.events.length} gestures across ${REC.events.length ? (REC.events.at(-1)[0] / 1000).toFixed(1) : 0} s.`); }
    else if (b.id === 'shd-rec-play') replay();
    else if (b.id === 'shd-rec-midi') scoreMidi().catch((e) => { console.error('shader room: the score did not save', e); say('The score did not save.'); });
    else if (b.id === 'shd-pic-midi') pictureMidi().catch((e) => { console.error('shader room: the picture did not transcribe', e); say('The picture did not transcribe.'); });
    else return false;
    return true;
  }
  function onInput(ev) {
    const t = ev.target;
    if (t.id === 'shd-snd-audio') { const f = t.files?.[0]; if (f) file(f); return true; }
    if (t.id === 'shd-react') { P.reactAmt = +t.value; host.querySelector('output[for="shd-react"]').textContent = (P.reactAmt / 100).toFixed(2); room.changed('picture'); return true; }
    return false;
  }
  return { levels, feed, gesture, learnFrom, onClick, onInput, retune() { if (audio?.isOn()) audio.setSeed(seed()); }, waveform: () => (audio?.waveform ? audio.waveform() : null), audio: ensure,
    stopLoop() { audio?.stopLoop?.(); }, sync() { for (const b of host.querySelectorAll('[data-react]')) b.setAttribute('aria-pressed', String(P.react.includes(b.dataset.react))); const r = $('#shd-react'); if (r) { r.value = String(P.reactAmt); host.querySelector('output[for="shd-react"]').textContent = (P.reactAmt / 100).toFixed(2); } },
    destroy() { REC.timers.forEach(clearTimeout); clearTimeout(picTimer); try { audio?.stop(); audio?.stopMic(); audio?.stopFile(); } catch (e) { console.error('shader room: the sound did not stop', e); } } };
}
