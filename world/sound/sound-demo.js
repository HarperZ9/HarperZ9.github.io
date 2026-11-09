import { mountSoundBar } from './sound/soundbar.js';
import { Engine } from './sound/engine.js';
import { Sequencer } from './sound/sequencer.js';
import * as V from './sound/voices.js';
import * as FX from './sound/fx.js';
import { ARCHIVE, loadArchive, chop, playSlice } from './sound/sample.js';
import { MOTIFS } from './sound/motifs/index.js';
import { song as hum } from './sound/songs/hum.js';
import { renderOffline, encodeWav, bufferStats } from './sound/wav.js';
import { liveSpectrogram, bufferSpectrogram } from './sound/reveal.js';
import * as picture from './sound/motifs/spectrogram-picture.js';
import * as shepard from './sound/motifs/shepard.js';

if (location.protocol === 'file:') document.getElementById('serve-note').hidden = false;
const $ = (s) => document.querySelector(s);
let E = null, seq = null; const motifHandles = {};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- voices
const NOTES = [['C#1', 25], ['E1', 28], ['A1', 33], ['B1', 35], ['C#2', 37], ['E2', 40]];
$('#note808').innerHTML = NOTES.map(([n, m], i) => `<option value="${m}" ${i === 2 ? 'selected' : ''}>${n}</option>`).join('');
const voiceDefs = {
  '808': (t) => V.kick808(E.ctx, E.out, t, { note: +$('#note808').value, dur: 0.9, drive: +$('#drive808').value, clip: $('#clip808').checked, glideTo: $('#glide808').checked ? +$('#note808').value + 5 : null }),
  Kick: (t) => V.kick(E.ctx, E.out, t), Snare: (t) => V.snare(E.ctx, E.out, t), Clap: (t) => V.clap(E.ctx, E.out, t),
  'Hat': (t) => V.hat(E.ctx, E.out, t), 'Open hat': (t) => V.hat(E.ctx, E.out, t, { open: true }),
  'Hat roll': (t) => V.hatRoll(E.ctx, E.out, t, { n: 12, span: 0.35, curve: 1.6, from: 0.3, to: 0.9 }),
  Ratchet: (t) => V.ratchet(E.ctx, E.out, t, { span: 0.3, pattern: [1, 1, 0, 1, 2, 1] }),
  Sub: (t) => V.sub(E.ctx, E.out, t, { note: 33, dur: 0.8 }), Pluck: (t) => V.pluck(E.ctx, E.out, t, { note: 64, dur: 0.6 }),
  Bell: (t) => V.bell(E.ctx, E.out, t, { note: 76, dur: 1.4 }), Pad: (t) => V.pad(E.ctx, E.out, t, { dur: 3 }),
  Noise: (t) => V.noise(E.ctx, E.out, t, { dur: 0.8, lp: 6000, hp: 300 }), Voice: (t) => V.voice(E.ctx, E.out, t, { note: 57, dur: 1.4 }),
};
const vbox = $('#voices');
for (const [name, fn] of Object.entries(voiceDefs)) { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.disabled = true; b.dataset.needs = 'engine'; b.onclick = () => fn(E.now + 0.02); vbox.append(b); }

// ---- sequencer
const ROWS = [['808', 'k808'], ['Kick', 'kick'], ['Snare', 'snare'], ['Clap', 'clap'], ['Hat', 'hat']];
const pat = { k808: [0, 6, 10], kick: [0, 10], snare: [8], clap: [8], hat: [...Array(16).keys()] };
const grid = $('#grid'), cells = {};
ROWS.forEach(([label, key]) => {
  const b = document.createElement('b'); b.textContent = label; grid.append(b); cells[key] = [];
  for (let s = 0; s < 16; s++) { const c = document.createElement('button'); c.type = 'button'; c.setAttribute('aria-label', `${label} step ${s + 1}`); c.setAttribute('aria-pressed', String(pat[key].includes(s))); if (s % 4 === 0) c.classList.add('beat'); c.onclick = () => { const on = c.getAttribute('aria-pressed') !== 'true'; c.setAttribute('aria-pressed', String(on)); pat[key] = on ? [...pat[key], s] : pat[key].filter((x) => x !== s); }; grid.append(c); cells[key].push(c); }
});
const fxOn = { tape: false, vinyl: false, crush: false, lp: false, pump: false };
document.querySelectorAll('[data-fx]').forEach((b) => b.onclick = () => { fxOn[b.dataset.fx] = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(fxOn[b.dataset.fx])); if (seq && seq.running) restartSeq(); });
const patSong = () => ({
  bpm: +$('#bpm').value, swing: +$('#swing').value / 100, bars: 1,
  setup(e, bus, t0) {
    const c = e.ctx, sc = FX.sidechain(c, { depth: fxOn.pump ? 0.7 : 0 }), nodes = [sc];
    if (fxOn.crush) nodes.push(FX.bitcrush(c, { bits: 6, hold: 3 })); if (fxOn.lp) nodes.push(FX.lowpass(c, 1400, 2));
    let tp = null; if (fxOn.tape) { tp = FX.tape(c, { wow: 1, flutter: 0.6, hiss: 0.02 }); nodes.push(tp); }
    FX.chain(...nodes).output.connect(bus); let v = null; if (fxOn.vinyl) { v = FX.vinyl(c, { dust: 0.6 }); v.output.connect(bus); v.start(t0); }
    return { ctx: c, in: sc.input, sc, stop(t) { tp && tp.stop(t); v && v.stop(t); } };
  },
  events(bar, S) {
    const out = [], d = S.in, k = (name, fn, vel) => (pat[name] || []).forEach((s) => out.push({ step: s, name, vel, run: (t) => fn(t) }));
    k('k808', (t) => { S.sc.trigger(t); V.kick808(S.ctx, d, t, { note: +$('#note808').value, dur: 0.5, drive: +$('#drive808').value, clip: $('#clip808').checked }); }, 1);
    k('kick', (t) => { S.sc.trigger(t); V.kick(S.ctx, d, t, { vel: 0.7 }); }, 0.8);
    k('snare', (t) => V.snare(S.ctx, d, t, { vel: 0.9 }), 0.9); k('clap', (t) => V.clap(S.ctx, d, t, { vel: 0.6 }), 0.6);
    (pat.hat || []).forEach((s) => out.push({ step: s, name: 'hat', vel: 0.4, run: (t) => V.hat(S.ctx, d, t, { vel: s % 4 === 0 ? 0.6 : 0.35 }) }));
    return out;
  },
});
function restartSeq() { if (seq) seq.stop(0.05); seq = new Sequencer(E, patSong()); seq.start(); $('#seqplay').textContent = 'Stop pattern'; }
$('#seqplay').onclick = () => { if (seq && seq.running) { seq.stop(); $('#seqplay').textContent = 'Play pattern'; } else restartSeq(); };
for (const id of ['bpm', 'swing']) $('#' + id).oninput = () => { $('#' + id + 'v').textContent = $('#' + id).value; if (seq && seq.running) { seq.bpm = +$('#bpm').value; seq.swing = +$('#swing').value / 100; } };

// ---- motifs
const mbox = $('#motifs');
for (const [id, m] of Object.entries(MOTIFS)) {
  const card = document.createElement('div'); card.className = 'motif';
  card.innerHTML = `<span class="fam">${m.meta.family}</span><h3>${m.meta.title}</h3><p>${m.meta.line}</p><div class="row"><button type="button" data-id="${id}" disabled data-needs="engine">Play</button><button type="button" data-stop="${id}" disabled data-needs="engine">Stop</button></div>`;
  mbox.append(card);
}
mbox.onclick = (ev) => { const b = ev.target.closest('button'); if (!b || !E) return; if (b.dataset.id) { motifHandles[b.dataset.id]?.stop(0.05); motifHandles[b.dataset.id] = MOTIFS[b.dataset.id].play(E); } else if (b.dataset.stop) { const r = motifHandles[b.dataset.stop]?.stop(); if (r === false) { b.textContent = 'Refused'; setTimeout(() => (b.textContent = 'Stop'), 900); } } };

// ---- archive
const abox = $('#arch');
for (const [key, a] of Object.entries(ARCHIVE)) {
  const card = document.createElement('div'); card.className = 'motif';
  card.innerHTML = `<h3>${a.title}</h3><p class="credit">${a.source}. ${a.licence}. Used for ${a.use}.</p><div class="row"><button type="button" data-a="${key}" disabled data-needs="engine">Play</button><button type="button" data-chop="${key}" disabled data-needs="engine">Chop 8</button></div>`;
  abox.append(card);
}
abox.onclick = async (ev) => {
  const b = ev.target.closest('button'); if (!b || !E) return;
  try {
    const key = b.dataset.a || b.dataset.chop, buf = await loadArchive(E.ctx, key), t = E.now + 0.03;
    if (b.dataset.a) playSlice(E.ctx, E.out, t, buf, { start: 0, dur: Math.min(buf.duration, 8), vel: 0.8 });
    else chop(buf, 8).forEach((s, i) => playSlice(E.ctx, E.out, t + i * 0.28, buf, { ...s, dur: 0.26, rate: i % 3 === 2 ? 0.75 : 1, reverse: i === 5, vel: 0.8 }));
  } catch (e) { console.error('archive play failed', e); b.textContent = 'Failed'; }
};

// ---- theme beat
let humSeq = null;
$('#humplay').onclick = () => { if (humSeq && humSeq.running) { humSeq.stop(); $('#humplay').textContent = 'Play Hum'; } else { humSeq = new Sequencer(E, hum); humSeq.start(); $('#humplay').textContent = 'Stop Hum'; } };
$('#humwav').onclick = async () => {
  const b = $('#humwav'); b.disabled = true; $('#humstat').textContent = 'Rendering…';
  const secs = hum.bars * (60 / hum.bpm) * 4 + 5, buf = await renderOffline(Engine, secs, (e) => { new Sequencer(e, hum).renderAll(0.05); }), st = bufferStats(buf);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([encodeWav(buf)], { type: 'audio/wav' })); a.download = 'hum.wav'; a.click();
  $('#humstat').textContent = `Rendered ${st.seconds.toFixed(1)} s, peak ${st.peak.toFixed(2)}, rms ${st.rms.toFixed(3)}. Saved as hum.wav.`; b.disabled = false;
};

// ---- spectrogram view
let live = null; const spec = $('#spec'), note = $('#specnote');
$('#specLive').onclick = () => { if (live) { live.stop(); live = null; $('#specLive').textContent = 'Watch what plays'; return; } live = liveSpectrogram(spec, E); $('#specLive').textContent = 'Stop watching'; };
$('#specPic').onclick = async () => {
  live && $('#specLive').click(); note.textContent = 'Rendering the hidden picture…';
  const buf = await renderOffline(Engine, 7, (e) => { const b = e.ctx.createGain(); b.connect(e.out); picture.render(e.ctx, b, 0.2, { text: '6EQUJ5', duration: 6 }); });
  bufferSpectrogram(spec, buf.getChannelData(0), buf.sampleRate, { fMin: 1500, fMax: 10500, floor: -95, ceil: -35 }); note.textContent = 'The 6EQUJ5 of the Wow! signal (Big Ear, 1977), written into the static. Frequency 1.5 to 10.5 kHz, 7 seconds.';
};
$('#specShep').onclick = () => {
  live && $('#specLive').click(); const g = spec.getContext('2d'), W = spec.width, H = spec.height, css = getComputedStyle(document.documentElement);
  g.fillStyle = css.getPropertyValue('--ground'); g.fillRect(0, 0, W, H); const P = shepard.partials({ duration: 30, period: 10, step: 0.1 }), lo = Math.log2(27.5), hi = Math.log2(27.5 * 256);
  P.forEach((pts) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (b.f < a.f) continue; g.strokeStyle = css.getPropertyValue('--ink'); g.globalAlpha = Math.min(1, b.a * 1.1); g.lineWidth = 2; g.beginPath(); g.moveTo((a.t / 30) * W, H - ((Math.log2(a.f) - lo) / (hi - lo)) * H); g.lineTo((b.t / 30) * W, H - ((Math.log2(b.f) - lo) / (hi - lo)) * H); g.stroke(); } });
  g.globalAlpha = 1; note.textContent = 'Eight partials, an octave apart, all gliding up over ten seconds. Each fades in at the bottom and out at the top, so the stack looks the same at every moment. Log frequency, 27.5 Hz to 7 kHz, 30 seconds.';
};

// ---- scope
const cv = $('#scope'), g = cv.getContext('2d');
function draw() {
  const css = getComputedStyle(document.documentElement); g.clearRect(0, 0, cv.width, cv.height);
  if (E) { const d = E.levels(), w = cv.width / 64; g.fillStyle = css.getPropertyValue('--ink'); for (let i = 0; i < 64; i++) { const h = (d[i * 2] / 255) * cv.height; g.fillRect(i * w + 1, cv.height - h, w - 2, h); } }
  if (!reduce) requestAnimationFrame(draw);
}
draw();

// ---- engine lifecycle
const bar = mountSoundBar($('#bar'), { label: 'Sound', onEngine(e) {
  E = e; document.querySelectorAll('[data-needs="engine"], #seqplay, #humplay').forEach((b) => (b.disabled = !e)); if (!e && live) { live.stop(); live = null; $('#specLive').textContent = 'Watch what plays'; }
  if (!e) { seq && seq.stop(0.02); humSeq && humSeq.stop(0.02); $('#seqplay').textContent = 'Play pattern'; $('#humplay').textContent = 'Play Hum'; Object.values(motifHandles).forEach((h) => h && h.stop(0.02)); }
  if (reduce && e) { const loop = () => { draw(); if (E) setTimeout(loop, 250); }; loop(); }
} });
window.__bar = bar;
