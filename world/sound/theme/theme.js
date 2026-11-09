// Theme wiring. Sound stays off until the visitor turns it on. When it is on, the beat plays and the page answers it:
// the 808 sends rings through the dot field, hats set letters heavy, and a tape dropout fades the field.
import { mountSoundBar } from '../sound/soundbar.js';
import { Sequencer } from '../sound/sequencer.js';
import { song as hum, sectionOf } from '../sound/songs/hum.js';
import { MOTIFS } from '../sound/motifs/index.js';
import { MasterPlayer } from '../sound/v2/player.js';
import { Generative } from '../sound/v3/generative.js';
import { startField } from './dotfield.js';
import { PIECES, FAMILIES, titleFor, credit } from './titles.js';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let E = null, seq = null, gen = null;  // seq: the Hum v4 master player (or the v1 sequencer if the master is missing); gen: the wandering arrangement

// ---- static content
$('#hero-credit').textContent = credit({ families: ['scale', 'crowd'], word: 'Hum' });
$('#piecelist').innerHTML = PIECES.map((p) => `<li><h3>${p.word}</h3><p class="credit mono">${credit(p)}</p><p>${p.line}</p>${p.built ? `<a href="${p.href}">Open ${p.word}</a>` : `<span class="soon">Sound exists in the engine. The exhibit is still to make.</span>`}</li>`).join('');
$('#famboxes').innerHTML = Object.entries(FAMILIES).map(([k, v]) => `<label><input type="checkbox" value="${k}" ${k === 'scale' || k === 'crowd' ? 'checked' : ''}> ${v}</label>`).join('');
$('#motifgrid').innerHTML = Object.entries(MOTIFS).map(([id, m]) => `<div class="motif"><span class="fam">${m.meta.family}</span><h3>${m.meta.title}</h3><p>${m.meta.line}</p><div class="row"><button type="button" data-id="${id}" data-needs="engine" disabled>Play</button><button type="button" data-stop="${id}" data-needs="engine" disabled>Stop</button></div></div>`).join('');

// ---- title generator
const taken = new Set(PIECES.map((p) => p.word)); let counter = 0;
$('#namebtn').onclick = () => {
  const fams = [...document.querySelectorAll('#famboxes input:checked')].map((i) => i.value).slice(0, 3);
  if (!fams.length) { $('#named').textContent = 'Pick at least one family first.'; return; }
  const word = titleFor(++counter, fams, taken); taken.add(word);
  $('#named').textContent = credit({ families: fams, word });
  if (E) import('../sound/voices.js').then((V) => V.bell(E.ctx, E.out, E.now + 0.02, { note: 72 + (counter % 5) * 2, dur: 0.8, vel: 0.3 }));
};

// ---- motif buttons
const handles = {};
$('#motifgrid').onclick = (ev) => {
  const b = ev.target.closest('button'); if (!b || !E) return;
  if (b.dataset.id) { handles[b.dataset.id]?.stop(0.05); handles[b.dataset.id] = MOTIFS[b.dataset.id].play(E); }
  else if (b.dataset.stop) { const r = handles[b.dataset.stop]?.stop(); if (r === false) { b.textContent = 'Refused'; setTimeout(() => (b.textContent = 'Stop'), 900); } }
};

// ---- the field and the reactions
const canvas = $('#field');
let field = null;
try { field = startField(canvas, { count: innerWidth < 700 ? 9000 : 22000 }); } catch (e) { console.error('dot field failed, using the static pattern', e); canvas.classList.add('nogl'); }
const letters = [...document.querySelectorAll('.ltr')], lk = letters.map(() => 0);
const R = { pulse: 0, rings: [], fade: 1, fadeBack: 0, hat: 0, last: performance.now(), t0: performance.now() };
const readout = $('#readout'); let lastBar = -1;

function react(evs) {
  for (const ev of evs) {
    if (ev.name === 'kick808') { R.pulse = Math.min(1, 0.55 + 0.1 * (ev.vel || 1)); R.rings.push({ born: performance.now(), a: 0.35 + 0.65 * Math.min(1, ev.vel || 1) }); }
    else if (ev.name === 'hat' || ev.name === 'ratchet') { lk[R.hat++ % lk.length] = Math.max(lk[(R.hat - 1) % lk.length], 0.5 + 0.5 * (ev.vel || 0.5)); }
    else if (ev.name === 'roll') letters.forEach((_, i) => setTimeout(() => (lk[i] = 1), i * 45));
    else if (ev.name === 'snare' || ev.name === 'clap') R.pulse = Math.max(R.pulse, 0.25);
    else if (ev.name === 'dropout') { R.fade = 0.12; R.fadeBack = performance.now() + 700; }
    if (seq && ev.bar !== undefined && ev.bar !== lastBar && (ev.name === 'bar' || ev.name === 'pad')) { lastBar = ev.bar; readout.textContent = where(ev.bar); }
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - R.last) / 1000); R.last = now;
  if (E) react(E.due());
  R.pulse *= Math.pow(0.003, dt); if (R.pulse < 0.001) R.pulse = 0;
  if (R.fadeBack && now > R.fadeBack && R.fade < 1) R.fade = Math.min(1, R.fade + dt * 1.2);
  lk.forEach((k, i) => { lk[i] = k * Math.pow(0.0008, dt); letters[i].style.setProperty('--w', String(Math.round(430 + 470 * lk[i]))); });
  R.rings = R.rings.filter((r) => (now - r.born) / 1000 < 1.7);
  document.documentElement.style.setProperty('--pulse', R.pulse.toFixed(3));
  field && field.draw({ time: (now - R.t0) / 1000, pulse: R.pulse, fade: R.fade, rings: R.rings.map((r) => { const a = (now - r.born) / 1000; return { r: 0.12 + a * 0.62, a: r.a * Math.exp(-a * 2.1) }; }) });
  requestAnimationFrame(frame);
}
if (field && field.ok) { if (reduce) { field.draw({ time: 3, fade: 1 }); addEventListener('resize', () => { field.resize(); field.draw({ time: 3, fade: 1 }); }); } else { addEventListener('resize', () => field.resize()); requestAnimationFrame(frame); } }
// Reduced motion still gets a text readout of where the beat is, without the animation loop.
let ro = null;
function where(bar) { const v3 = seq instanceof MasterPlayer, bars = v3 ? seq.bars : hum.bars, b = ((bar % bars) + bars) % bars;
  return `${v3 ? HUM4.label : 'Hum'}, bar ${b + 1} of ${bars}, section ${v3 ? seq.sectionOf(b) : sectionOf(b)}, ${v3 ? seq.bpm : hum.bpm} BPM`; }
function startReadout() { if (!reduce) return; clearInterval(ro); ro = setInterval(() => { if (!seq || !seq.running) return; readout.textContent = where(seq.bar - 1); }, 1000); }

// ---- sound
const beatbtn = $('#beatbtn'), wanderbtn = $('#wanderbtn');
// Hum v4, the theme (a seamless 48-bar loop). Reduced-motion visitors get the calm variant: drums out, the same harmony.
const HUM4 = reduce ? { audioUrl: new URL('./assets/hum4-calm.opus', import.meta.url), hitsUrl: new URL('./assets/hum4-calm-hits.json', import.meta.url), label: 'Hum, calm' }
  : { audioUrl: new URL('./assets/hum4-theme.opus', import.meta.url), hitsUrl: new URL('./assets/hum4-theme-hits.json', import.meta.url), label: 'Hum v4' };
async function setBeat(on) {
  if (!E) return;
  if (on) {
    setWander(false); seq = new MasterPlayer(E, HUM4); beatbtn.textContent = 'Pause the beat'; readout.textContent = `${HUM4.label} is starting.`;
    try { await seq.start(); } catch (err) { console.warn('Hum v4 master missing, playing the v1 sequencer', err.message); seq = new Sequencer(E, hum); seq.start(); }
    startReadout();
  } else { seq && seq.stop(); seq = null; beatbtn.textContent = 'Play the beat'; readout.textContent = 'Beat is paused.'; clearInterval(ro); }
}
function setWander(on) {
  if (!E) return;
  if (on) { setBeat(false); gen = gen || new Generative(E, { onmood: (m) => { readout.textContent = `Wandering: ${m}`; } }); gen.start(); wanderbtn.setAttribute('aria-pressed', 'true'); }
  else if (gen) { gen.stop(); wanderbtn.setAttribute('aria-pressed', 'false'); readout.textContent = 'Beat is paused.'; }
}
mountSoundBar($('#bar'), { label: 'Sound', onEngine(e) {
  E = e; document.querySelectorAll('[data-needs="engine"]').forEach((b) => (b.disabled = !e));
  if (e) setBeat(true); else { seq && seq.stop(0.02); seq = null; gen && gen.dispose(); gen = null; wanderbtn.setAttribute('aria-pressed', 'false'); clearInterval(ro); Object.values(handles).forEach((h) => h && h.stop(0.02)); beatbtn.textContent = 'Turn sound on to hear it'; readout.textContent = 'Beat is off.'; }
} });
beatbtn.onclick = () => { if (!E) document.querySelector('[data-on]').click(); else setBeat(!(seq && seq.running)); };
wanderbtn.onclick = () => { if (!E) { document.querySelector('[data-on]').click(); return; } setWander(!(gen && gen.running)); };
