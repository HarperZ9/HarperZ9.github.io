// The Fourier room's runtime, inlined into playground/fourier.html by scripts/build-fourier.mjs.
// The heading arrives as a build from gist to crisp; the stage word takes the dial, the circles, the morph, the band
// reveal and the sound. Sound starts only from the Play press. Reduced motion shows settled letters, and the dial
// and the presses still act because a visitor moves them.
import { letter } from '/world/lettering/lib/letter.mjs';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BUILD = 2.6, MAX = 2048, BANDS = 16;
// the technique sets terms H = 1.5 (2048 / 1.5)^e(t / BUILD) with e the smoothstep; the dial is linear in e
const inv = (y) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, y))) / 3);
const termsAt = (b) => 1.5 * Math.pow(MAX / 1.5, b);
const state = { word: 'Water', into: 'Commons', machine: false, morph: false, band: false };
const el = { word: $('fo-word'), dial: $('fo-terms'), out: $('fo-terms-out'), say: $('fo-say'), text: $('fo-text'), intoText: $('fo-into'),
  again: $('fo-again'), machine: $('fo-machine'), morph: $('fo-morph'), band: $('fo-band'), play: $('fo-play') };
let title = null, stage = null, token = 0;

function dialWords() {
  const b = el.dial.value / 1000;
  if (state.band) return `${Math.min(BANDS, 1 + Math.floor(b * (BANDS - 1) + 1e-9))} of ${BANDS} bands`;
  const full = stage?.impl?.info?.termsKept, h = termsAt(b);
  return h >= MAX * 0.999 ? `Every circle that shows at this size${full ? `: ${full.toLocaleString('en')} in all` : ''}` : `Up to ${Math.round(h)} circles per contour`;
}
const tell = (s) => { el.say.textContent = s; };

async function mountStage() {
  const mine = ++token;
  stage?.destroy(); stage = null;
  el.word.textContent = state.word;
  const opts = state.band ? { mode: 'band' } : { machine: state.machine, ...(state.morph ? { words: [state.into] } : {}) };
  const d = letter(state.word, 'fourier', opts);
  await d.mount(el.word);
  if (mine !== token) { d.destroy(); return; }
  stage = d; el.dial.value = 1000; el.out.textContent = dialWords();
  const i = d.impl.info || {};
  if (state.band) tell(`The picture of “${state.word}” as a two-dimensional Fourier series on a ${i.grid} grid, rebuilt in ${i.bands} bands.`);
  else tell(`“${state.word}”: ${i.contours} contours, ${i.termsKept?.toLocaleString('en')} of ${i.termsFull?.toLocaleString('en')} terms kept at this size, outlines from the ${i.source}, drawn by the ${i.renderer === 'gpu' ? 'graphics card' : '2D canvas'}.`
    + (state.morph && reduced ? ' The morph moves, so it stays off while your system asks for reduced motion.' : ''));
  if (reduced && state.machine) hold();
  for (const b of [el.machine, el.morph, el.play]) b.disabled = state.band;
}

// Hold the stage at the dial: draw the technique once at the time whose term count the dial names, and stop the
// shared frame loop for this word (the library's seek() replays from zero, which costs a frame per step).
function hold() {
  if (!stage?.impl) return;
  const t = BUILD * inv(el.dial.value / 1000);
  stage._moving = false; stage.impl.replay?.(); stage.impl.draw(stage.ctx, t);
  el.out.textContent = dialWords();
}

function press(btn, key) {
  state[key] = !state[key]; btn.setAttribute('aria-pressed', String(state[key]));
  if (key === 'band' && state.band) { state.machine = state.morph = false; el.machine.setAttribute('aria-pressed', 'false'); el.morph.setAttribute('aria-pressed', 'false'); }
  mountStage().catch((e) => { console.error('fourier room: the word did not mount', e); tell('The word did not draw. It stays as plain text.'); });
}

const clean = (s, fallback) => (s.trim().replace(/\s+/g, ' ').slice(0, 24) || fallback);
let typing = 0;
function retext() {
  clearTimeout(typing);
  typing = setTimeout(() => { const w = clean(el.text.value, 'Water'), v = clean(el.intoText.value, 'Commons'); if (w === state.word && v === state.into) return; state.word = w; state.into = v; mountStage().catch((e) => console.error('fourier room: the word did not mount', e)); }, 450);
}

async function start() {
  document.documentElement.classList.add('fo-live');
  $('fo-desk').hidden = false; $('fo-nojs').hidden = true;
  let ink = getComputedStyle($('fo-title')).color;   // the ink the words are first built with
  title = letter('Fourier', 'fourier');
  await Promise.all([title.mount($('fo-title')), mountStage()]);
  el.dial.addEventListener('input', hold);
  el.text.addEventListener('input', retext); el.intoText.addEventListener('input', retext);
  el.again.addEventListener('click', () => { el.dial.value = 1000; el.out.textContent = dialWords(); if (reduced) { tell('Your system asks for reduced motion, so the letters stay settled. Move the dial to build them by hand.'); return; } stage?.replay(); });
  el.machine.addEventListener('click', () => press(el.machine, 'machine'));
  el.morph.addEventListener('click', () => press(el.morph, 'morph'));
  el.band.addEventListener('click', () => press(el.band, 'band'));
  el.play.addEventListener('click', async () => {
    if (!stage?.impl?.play) return;
    el.play.disabled = true;
    try { const s = await stage.act('play'); tell(`Playing “${state.word}” for ${s} seconds: x in the left ear, y in the right. The orange trace is the oscilloscope drawing what you hear.`); setTimeout(() => { el.play.disabled = state.band; }, s * 1000 + 200); }
    catch (e) { console.error('fourier room: the sound did not start', e); tell('The sound did not start in this browser.'); el.play.disabled = false; }
  });
  // the shell settles its colours after load and the lamp changes them, so the words are built again when the ink changes
  const recolour = () => {
    const now = getComputedStyle($('fo-title')).color; if (now === ink) return; ink = now;
    title?.rebuild(); mountStage().catch((e) => console.error('fourier room: rebuild after the lamp', e));
  };
  recolour();
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  window.fourierRoom = { get title() { return title; }, get stage() { return stage; }, state, ready: true };
}
start().catch((e) => { console.error('fourier room: did not start', e); tell('The room did not start. The reading above stays as built.'); });
