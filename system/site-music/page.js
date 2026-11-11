// page.js: the meditations page. The sound bar (world/sound/sound/soundbar.js) is the one place sound is turned on and
// off and the level is set; a piece button chooses what plays. The level and the last piece are remembered for the
// visitor. Nothing here moves on screen, so reduced motion and plain view need no special case.
import { mountSoundBar } from '../../world/sound/sound/soundbar.js';
import { createSiteMusic } from './index.js';

const music = createSiteMusic(), $ = (s) => document.querySelector(s), bar = $('#bar'), readout = $('#readout');
window.SiteMusic = music;   // the plain interface, for a shared registry to adopt

mountSoundBar(bar, { label: 'Music', onEngine(engine, old) {
  if (engine) music.start(null, { engine }).catch((err) => { console.error('site music: could not start', err); readout.textContent = 'The music could not start in this browser.'; });
  else { music.stop(); old?.ctx.close().catch((err) => console.warn('site music: closing the audio device failed', err)); }
} });
const on = bar.querySelector('[data-on]'), vol = bar.querySelector('[data-vol]');
vol.value = String(music.level); vol.addEventListener('input', () => music.setLevel(+vol.value));

for (const b of document.querySelectorAll('[data-play]')) b.addEventListener('click', () => {
  const id = b.dataset.play, s = music.state();
  if (s.playing && s.mood === id) { on.click(); return; }   // the playing piece's button stops it
  music.setMood(id); if (!s.playing) on.click();              // the sound bar makes the audio engine inside this click
});

music.on((s) => {
  for (const li of document.querySelectorAll('[data-piece]')) { const mine = s.playing && li.dataset.piece === s.mood, b = li.querySelector('button'); li.toggleAttribute('data-on', mine); b.setAttribute('aria-pressed', String(mine)); b.textContent = `${mine ? 'Stop' : 'Play'} ${li.querySelector('h2').textContent}`; }
  readout.textContent = !s.playing ? 'Music is off.' : s.bar ? `${s.title}, bar ${s.bar}: ${s.chords.join(', ')}${s.render === 'full' ? '' : ' (lighter render for this device)'}` : `${s.title} is starting. The sea comes in first.`;
});
