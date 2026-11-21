// room-estuary.mjs: registry.mjs adapter that connects estuary-lantern.mjs and operator-table.mjs to bus.mjs.
import { DEFAULT_ELEMENT_A, DEFAULT_ELEMENT_B, computeLanternFrame } from './estuary-lantern.mjs';
import { OPERATORS, BIO_TRANSDUCERS, operatorById, transducerById } from './operator-table.mjs';

export function still() {
  const frame = computeLanternFrame({ mix: 0.5, observer: 'visual-luminance', seed: 42, time: 0, reducedMotion: true });
  const cells = frame.apertures.slice(0, 24).map((a, i) => {
    const nx = typeof a.nx === 'number' ? a.nx : ((i % 6) + 0.5) / 6;
    const ny = typeof a.ny === 'number' ? a.ny : (Math.floor(i / 6) + 0.5) / 4;
    const x = Math.round(60 + nx * 520), y = Math.round(30 + ny * 220), r = Math.max(4, Math.round((a.radius ?? 0.8) * 10));
    const op = Number(a.opacity ?? a.alpha ?? 0.85).toFixed(2);
    return `<rect x="${x}" y="${y}" width="${r}" height="${r}" fill="${a.hex || '#e2a46b'}" fill-opacity="${op}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" role="img" aria-label="Estuary Perret-lantern lattice with spectral apertures"><rect width="640" height="280" fill="#101318"/><g stroke="#2a3140" stroke-width="1"><line x1="60" y1="140" x2="580" y2="140"/><line x1="320" y1="20" x2="320" y2="260"/><polygon points="320,40 420,90 420,190 320,240 220,190 220,90" fill="none"/></g>${cells}</svg>`;
  return {
    svg,
    alt: 'Estuary Perret-lantern structural concrete lattice perforated by weighted spectral apertures.',
    caption: `Settled still: mix 0.50, beta0 ${frame.homology.beta0}, beta1 ${frame.homology.beta1}, winding ${frame.homology.winding}.`,
  };
}

export function mount(host, input = {}, ctx = {}) {
  const state = {
    mix: typeof input?.mix === 'number' ? input.mix : 0.5,
    observer: input?.observer || 'visual-luminance',
    seed: input?.seed ?? 42,
    time: 0,
    reducedMotion: Boolean(ctx?.reduced),
    operatorId: input?.operatorId || OPERATORS[0].id,
    transducerId: input?.transducerId || BIO_TRANSDUCERS[0].id,
    weightsA: { ...DEFAULT_ELEMENT_A.weights, ...(input?.weightsA || input?.weights || {}) },
    weightsB: { ...DEFAULT_ELEMENT_B.weights, ...(input?.weightsB || {}) },
  };
  let frame = computeLanternFrame(state);
  const bus = ctx?.bus || null;
  const emit = () => {
    if (!bus) return;
    const refs = Array.isArray(input?.elements) && input.elements.length ? input.elements : [state.operatorId, state.transducerId];
    const recipe = { mix: state.mix, observer: state.observer, seed: state.seed, operatorId: state.operatorId, transducerId: state.transducerId };
    bus.send('estuary', 'field', frame.recombination.visual, { refs, recipe });
    bus.send('estuary', 'score', frame.recombination.acoustic, { refs, recipe });
    bus.send('estuary', 'palette', frame.apertures.slice(0, 6).map((a) => a.hex), { refs, recipe });
  };

  let statusEl = null, svgHost = null;
  const renderDom = () => {
    if (!statusEl || !svgHost) return;
    const op = operatorById(state.operatorId), tr = transducerById(state.transducerId);
    const cells = frame.apertures.slice(0, 32).map((a, i) => {
      const nx = typeof a.nx === 'number' ? a.nx : ((i % 8) + 0.5) / 8;
      const ny = typeof a.ny === 'number' ? a.ny : (Math.floor(i / 8) + 0.5) / 4;
      const x = Math.round(40 + nx * 560), y = Math.round(24 + ny * 232), r = Math.max(5, Math.round((a.radius ?? 0.8) * 11));
      const alpha = Number(a.opacity ?? a.alpha ?? 0.85).toFixed(2);
      return `<rect x="${x}" y="${y}" width="${r}" height="${r}" rx="2" fill="${a.hex || '#e2a46b'}" fill-opacity="${alpha}"/>`;
    }).join('');
    svgHost.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" style="width:100%;height:auto;border-radius:8px;display:block"><rect width="640" height="280" fill="#101318"/><g stroke="#2a3140" stroke-width="1"><line x1="40" y1="140" x2="600" y2="140"/><line x1="320" y1="20" x2="320" y2="260"/></g>${cells}</svg>`;
    statusEl.textContent = `${op?.name || state.operatorId} x ${tr?.taxon || state.transducerId} | mix ${state.mix.toFixed(2)} | beta0 ${frame.homology.beta0} | beta1 ${frame.homology.beta1} | winding ${frame.homology.winding} | metamer ${frame.recombination.metamer?.isMetamer ? 'yes' : 'no'}`;
  };

  if (typeof document !== 'undefined' && host && typeof host.innerHTML === 'string') {
    host.innerHTML = `<div class="sf-estuary" style="display:grid;gap:12px">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <label>Operator <select data-est-op>${OPERATORS.map((o) => `<option value="${o.id}">${o.name}</option>`).join('')}</select></label>
        <label>Bio-transducer <select data-est-tr>${BIO_TRANSDUCERS.map((t) => `<option value="${t.id}">${t.taxon}: ${t.id}</option>`).join('')}</select></label>
        <label>Mix <input type="range" data-est-mix min="0" max="1" step="0.01" value="${state.mix}"></label>
      </div>
      <div data-est-svg></div>
      <p data-est-status role="status" style="margin:0;font-size:0.9rem"></p>
    </div>`;
    svgHost = host.querySelector('[data-est-svg]');
    statusEl = host.querySelector('[data-est-status]');
    const syncFromControls = () => {
      const op = operatorById(state.operatorId), tr = transducerById(state.transducerId);
      if (op) state.weightsA = { ...op.weights };
      if (tr) state.weightsB = { ...tr.weights };
      frame = computeLanternFrame(state);
      renderDom();
      emit();
    };
    host.querySelector('[data-est-op]')?.addEventListener('change', (e) => { state.operatorId = e.target.value; syncFromControls(); });
    host.querySelector('[data-est-tr]')?.addEventListener('change', (e) => { state.transducerId = e.target.value; syncFromControls(); });
    host.querySelector('[data-est-mix]')?.addEventListener('input', (e) => { state.mix = Number(e.target.value); syncFromControls(); });
    renderDom();
  }

  const leave = bus ? bus.join('estuary', (env) => {
    if (env?.medium === 'blend' && typeof env.value?.mix === 'number') state.mix = env.value.mix;
    if (env?.medium === 'numbers' && env.value && typeof env.value === 'object') Object.assign(state.weightsA, env.value);
    frame = computeLanternFrame(state);
    renderDom();
  }) : null;
  emit();
  return {
    update(next = {}) {
      if (typeof next.mix === 'number') state.mix = next.mix;
      if (next.operatorId) { state.operatorId = next.operatorId; const op = operatorById(next.operatorId); if (op) state.weightsA = { ...op.weights }; }
      if (next.transducerId) { state.transducerId = next.transducerId; const tr = transducerById(next.transducerId); if (tr) state.weightsB = { ...tr.weights }; }
      if (next.weights) Object.assign(state.weightsA, next.weights);
      frame = computeLanternFrame(state);
      renderDom();
      emit();
    },
    value: () => frame,
    destroy() { if (leave) leave(); },
  };
}
