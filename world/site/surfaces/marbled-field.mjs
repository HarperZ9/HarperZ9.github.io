// marbled-field.mjs: unified cross-medium marbling controller for /playground/.
// Dissolves siloed room boundaries into one cohesive liquid surface driven by
// continuous temperature, phase, and property weights broadcast over bus.mjs.
import { page, open as openRoom } from './rooms.mjs';
import { start as startExchange } from './surface-page.mjs';
import { OPERATORS, BIO_TRANSDUCERS, operatorById, transducerById } from './operator-table.mjs';

export function computeMarbledState({ temperatureK = 310, weights = {}, operatorId = 'counterpoint', transducerId = 'mycorrhizal-router' } = {}) {
  const T = Math.max(240, Math.min(1400, Number(temperatureK)));
  const phase = T < 273 ? 'solid-crystalline' : T < 373 ? 'liquid-estuary' : T < 700 ? 'vapor-turbulent' : 'incandescent-plasma';
  const thermalMobility = Number(Math.min(1, Math.max(0, (T - 240) / 760)).toFixed(4));
  const op = operatorById(operatorId) || OPERATORS[0];
  const tr = transducerById(transducerId) || BIO_TRANSDUCERS[0];
  const merged = {};
  for (const k of ['refraction', 'fluid', 'measure', 'cad', 'sound']) {
    const userVal = typeof weights[k] === 'number' ? weights[k] : 0.5 * ((op.weights[k] ?? 0.5) + (tr.weights[k] ?? 0.5));
    // Higher temperature increases fluid/acoustic mobility and softens rigid CAD lock
    const mod = k === 'fluid' || k === 'sound' ? userVal * (0.75 + 0.35 * thermalMobility) : k === 'cad' ? userVal * (1.1 - 0.3 * thermalMobility) : userVal;
    merged[k] = Number(Math.max(0, Math.min(1, mod)).toFixed(4));
  }
  return { temperatureK: T, phase, thermalMobility, operatorId: op.id, transducerId: tr.id, weights: merged };
}

export async function mountMarbledField(host) {
  const article = document.querySelector('article.ds');
  article?.classList.add('sx-marbled-active');

  // Start the blend exchange and open every room on the same shared bus
  const tasks = [];
  if (document.getElementById('sx-start') && !document.getElementById('sx-start').disabled) {
    tasks.push(startExchange().catch((e) => console.error('marbled: exchange start failed', e)));
  }
  for (const sec of document.querySelectorAll('[data-room]')) {
    const id = sec.dataset.room;
    if (id && !sec.hasAttribute('data-room-live')) {
      tasks.push(openRoom(id, sec, { press: null }).catch((e) => console.error(`marbled: room ${id} failed`, e)));
    }
  }
  await Promise.allSettled(tasks);

  const state = {
    temperatureK: 310,
    operatorId: OPERATORS[3].id,
    transducerId: BIO_TRANSDUCERS[2].id,
    weights: { refraction: 0.55, fluid: 0.72, measure: 0.64, cad: 0.52, sound: 0.68 },
  };

  host.hidden = false;
  host.innerHTML = `<div class="mx-bar">
    <div class="mx-row">
      <label>Temperature <strong data-mx-temp-v>310 K</strong> <input type="range" data-mx-temp min="240" max="1400" step="10" value="310"></label>
      <label>Operator <select data-mx-op>${OPERATORS.map((o) => `<option value="${o.id}"${o.id === state.operatorId ? ' selected' : ''}>${o.name}</option>`).join('')}</select></label>
      <label>Bio-transducer <select data-mx-tr>${BIO_TRANSDUCERS.map((t) => `<option value="${t.id}"${t.id === state.transducerId ? ' selected' : ''}>${t.taxon}: ${t.id}</option>`).join('')}</select></label>
    </div>
    <div class="mx-row mx-weights">
      ${['refraction', 'fluid', 'measure', 'cad', 'sound'].map((k) => `<label>${k} <input type="range" data-mx-w="${k}" min="0" max="1" step="0.02" value="${state.weights[k]}"></label>`).join('')}
    </div>
    <p class="mx-status" data-mx-status role="status" aria-live="polite"></p>
  </div>`;

  const statusEl = host.querySelector('[data-mx-status]');
  const tempValEl = host.querySelector('[data-mx-temp-v]');
  const shared = page('playground');

  const broadcast = () => {
    const out = computeMarbledState(state);
    if (tempValEl) tempValEl.textContent = `${out.temperatureK} K (${out.phase})`;
    shared.send('field', 'numbers', out.weights, { refs: [out.operatorId, out.transducerId], recipe: out });
    shared.send('blend', 'blend', { mix: out.thermalMobility, temperatureK: out.temperatureK, phase: out.phase, weights: out.weights }, { refs: [out.operatorId, out.transducerId], recipe: out });
    if (statusEl) {
      statusEl.textContent = `Unified marbled field active: ${out.temperatureK} K (${out.phase}) | ${out.operatorId} x ${out.transducerId} | refraction ${out.weights.refraction} fluid ${out.weights.fluid} cad ${out.weights.cad} sound ${out.weights.sound}`;
    }
  };

  host.querySelector('[data-mx-temp]')?.addEventListener('input', (e) => { state.temperatureK = Number(e.target.value); broadcast(); });
  host.querySelector('[data-mx-op]')?.addEventListener('change', (e) => { state.operatorId = e.target.value; broadcast(); });
  host.querySelector('[data-mx-tr]')?.addEventListener('change', (e) => { state.transducerId = e.target.value; broadcast(); });
  for (const inp of host.querySelectorAll('[data-mx-w]')) {
    inp.addEventListener('input', (e) => { state.weights[inp.dataset.mxW] = Number(e.target.value); broadcast(); });
  }
  broadcast();
}
