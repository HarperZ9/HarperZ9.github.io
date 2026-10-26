// The sound bar: the only place sound is turned on. Builds the visible mute and volume controls.
// Sound stays off until the visitor presses the first button. Muting and turning off are always one press away.
import { Engine } from './engine.js';

export function mountSoundBar(root, { onEngine, label = 'Sound' } = {}) {
  root.className = 'soundbar'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Sound controls');
  root.innerHTML = `<button type="button" class="hot" data-on>Turn sound on</button>
    <button type="button" data-mute aria-pressed="false" disabled>Mute</button>
    <label>Volume <input type="range" data-vol min="0" max="1" step="0.01" value="0.8" aria-label="Volume" disabled></label>
    <p class="state" data-state role="status"><span class="dot-hot" aria-hidden="true"></span><b>${label} is off.</b> Nothing plays until you turn it on.</p>`;
  const $ = (s) => root.querySelector(s), on = $('[data-on]'), mute = $('[data-mute]'), vol = $('[data-vol]'), st = $('[data-state]');
  const api = { engine: null, ready: null };
  const say = (b, rest) => { st.innerHTML = `<span class="dot-hot" aria-hidden="true"></span><b>${b}</b> ${rest || ''}`; };
  on.addEventListener('click', async () => {
    if (!api.engine) {
      on.disabled = true; say('Starting…', '');
      try { api.engine = await Engine.live(); } catch (e) { console.error('audio start failed', e); say('Sound could not start.', e.message); on.disabled = false; return; }
      api.engine.setVolume(+vol.value); mute.disabled = false; vol.disabled = false; on.disabled = false;
      root.classList.add('live'); on.textContent = 'Turn sound off'; on.classList.remove('hot'); say('Sound is on.', 'Mute is one press away.');
      onEngine && onEngine(api.engine);
    } else {
      await api.engine.suspend(); const e = api.engine; api.engine = null; root.classList.remove('live');
      on.textContent = 'Turn sound on'; on.classList.add('hot'); mute.disabled = true; vol.disabled = true; mute.setAttribute('aria-pressed', 'false'); say(`${label} is off.`, 'Nothing plays until you turn it on.');
      onEngine && onEngine(null, e);
    }
  });
  mute.addEventListener('click', () => { const m = mute.getAttribute('aria-pressed') !== 'true'; mute.setAttribute('aria-pressed', String(m)); api.engine && api.engine.mute(m); say(m ? 'Muted.' : 'Sound is on.', m ? 'Press Mute again to hear it.' : 'Mute is one press away.'); });
  vol.addEventListener('input', () => api.engine && api.engine.setVolume(+vol.value));
  addEventListener('keydown', (ev) => { if (ev.key.toLowerCase() === 'm' && !/input|select|textarea/i.test(ev.target.tagName) && !mute.disabled) mute.click(); });
  return api;
}
