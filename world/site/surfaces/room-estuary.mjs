// room-estuary.mjs: registry.mjs adapter connecting estuary-lantern.mjs and operator-table.mjs to bus.mjs.
// Renders a luminous Perret concrete lantern with spectral glass apertures both as a build-time SVG still
// and as a live frame-0 interactive 2D canvas with continuous property weights, metamers, homology, and
// opt-in WebAudio harmonic voice.
import { ESTUARY_PROPERTIES } from './estuary-field.mjs';
import {
  DEFAULT_ELEMENT_A,
  DEFAULT_ELEMENT_B,
  LANTERN_PRESETS,
  OBSERVER_LENSES,
  computeLanternFrame,
  createHarmonicSynth,
  renderLanternCanvas,
} from './estuary-lantern.mjs';
import { OPERATORS, BIO_TRANSDUCERS, operatorById, transducerById } from './operator-table.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function lanternStillSvg(frame) {
  const W = 720, H = 380;
  const { lattice, apertures, recombination, topology } = frame;
  const cad = recombination.weights.cad;
  const mx = Math.round(lattice.frameMargin * W), my = Math.round(lattice.frameMargin * H);
  const hex = (r, g, b) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const rects = apertures.map((ap) => {
    const x = Math.round(ap.x * W), y = Math.round(ap.y * H);
    const w = Math.max(2, Math.round(ap.w * W)), h = Math.max(2, Math.round(ap.h * H));
    const fill = hex(ap.spectrum.r, ap.spectrum.g, ap.spectrum.b);
    const stroke = ap.halocline > 0.42 ? '#f5d48a' : '#c8c4ba';
    const sw = ap.isPrimaryBay ? (1.4 + 1.4 * cad).toFixed(1) : '1';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  }).join('');
  const c = topology.negativeSpace.centroid;
  const mark = c ? `<circle cx="${Math.round(c.x * W)}" cy="${Math.round(c.y * H)}" r="9" fill="none" stroke="#ede9e1" stroke-width="1.3"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="est-still-svg" role="img" aria-label="Estuary Perret concrete lantern with 60 luminous spectral glass apertures"><rect width="${W}" height="${H}" fill="#101318"/><rect x="${Math.round(mx * 0.65)}" y="${Math.round(my * 0.65)}" width="${Math.round(W - mx * 1.3)}" height="${Math.round(H - my * 1.3)}" fill="none" stroke="#c6c2b8" stroke-width="2.4"/>${rects}${mark}</svg>`;
}

export function still() {
  const frame = computeLanternFrame({ mix: 0.5, observer: 'visual-luminance', seed: 42, time: 0, reducedMotion: true });
  const svg = lanternStillSvg(frame);
  return {
    html: svg,
    svg,
    alt: 'Estuary Perret-lantern structural concrete lattice perforated by 60 weighted spectral glass apertures.',
    caption: `Settled still: mix 0.50, beta0 ${frame.homology.beta0}, beta1 ${frame.homology.beta1}, winding ${frame.homology.winding}, receipt ${frame.receipt.digest}.`,
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
  const sendFn = ctx?.send || (bus ? (medium, value, opts) => bus.send('estuary', medium, value, opts) : null);
  const synth = createHarmonicSynth();
  let rafId = 0, dead = false;

  const apertureHex = (ap) => '#' + [ap.spectrum.r, ap.spectrum.g, ap.spectrum.b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const emit = () => {
    if (!sendFn) return;
    const refs = Array.isArray(input?.elements) && input.elements.length ? input.elements : [state.operatorId, state.transducerId];
    const recipe = { mix: state.mix, observer: state.observer, seed: state.seed, operatorId: state.operatorId, transducerId: state.transducerId };
    try {
      sendFn('field', frame.recombination.visual, { refs, recipe });
      sendFn('score', frame.recombination.acoustic, { refs, recipe });
      sendFn('palette', frame.apertures.slice(0, 6).map(apertureHex), { refs, recipe });
    } catch { /* bus optional in standalone unit tests */ }
  };

  let canvas = null, ctx2d = null, statusEl = null, readouts = null;

  const paintCanvas = () => {
    frame = computeLanternFrame(state);
    if (canvas && ctx2d && !ctx?.plain) {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect?.() || { width: 720, height: 380 };
      const w = Math.max(320, Math.round(rect.width || 720));
      const h = Math.max(220, Math.round(rect.height || 380));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderLanternCanvas(ctx2d, w, h, frame);
    }
    if (statusEl) {
      const op = operatorById(state.operatorId), tr = transducerById(state.transducerId);
      const m = frame.metamer, h = frame.homology, t = frame.topology;
      statusEl.textContent = `${op?.name || state.operatorId} x ${tr?.taxon || state.transducerId} | mix ${state.mix.toFixed(2)} | ${m.isMetamer ? 'METAMER' : 'distinct'} (${m.observer}, score ${m.metamerScore.toFixed(3)}) | beta0 ${h.beta0}, beta1 ${h.beta1}, winding ${h.winding} | seams ${Math.round(t.seams.intensity * 100)}% | ${frame.receipt.digest}`;
    }
    if (readouts) {
      const set = (sel, text) => { const el = readouts.querySelector(sel); if (el) el.textContent = text; };
      const m = frame.metamer, h = frame.homology, r = frame.recombination;
      set('[data-est-metamer]', `${m.isMetamer ? 'METAMER DETECTED' : 'Perceptually distinct'} (domain ${m.domainDistance.toFixed(3)}, perceptual ${m.perceptualDistance.toFixed(3)})`);
      set('[data-est-homology]', `beta0 ${h.beta0} connected, beta1 ${h.beta1} enclosed (chi ${h.eulerCharacteristic}), winding ${h.winding}`);
      set('[data-est-acoustic]', `${r.acoustic.freqsHz.map((f) => `${f.toFixed(0)} Hz`).join(', ')} at ${r.acoustic.tempoBpm.toFixed(0)} BPM`);
      set('[data-est-receipt]', r.receipt.digest);
    }
    if (synth.isPlaying()) synth.update(frame.recombination.acoustic);
  };

  if (typeof document !== 'undefined' && host && typeof host.innerHTML === 'string') {
    const sliders = ESTUARY_PROPERTIES.map((prop) =>
      `<label class="est-slider"><span>${prop} <output data-est-v="${prop}">${state.weightsA[prop].toFixed(2)}</output></span><input type="range" id="ctrl-${prop}" data-est-prop="${prop}" min="0" max="1" step="0.02" value="${state.weightsA[prop]}"></label>`
    ).join('');
    host.innerHTML = `<div class="sf-estuary">
      <div class="est-controls">
        <label>Operator <select data-est-op>${OPERATORS.map((o) => `<option value="${esc(o.id)}"${o.id === state.operatorId ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
        <label>Bio-transducer <select data-est-tr>${BIO_TRANSDUCERS.map((t) => `<option value="${esc(t.id)}"${t.id === state.transducerId ? ' selected' : ''}>${esc(t.taxon)}: ${esc(t.id)}</option>`).join('')}</select></label>
        <label>Observer lens <select id="ctrl-observer" data-est-lens>${OBSERVER_LENSES.map((l) => `<option value="${esc(l)}"${l === state.observer ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label>Halocline mix <output data-est-v="mix">${state.mix.toFixed(2)}</output> <input type="range" id="ctrl-mix" data-est-mix min="0" max="1" step="0.01" value="${state.mix}"></label>
      </div>
      <div class="est-weights">${sliders}</div>
      <div class="est-presets">
        <button type="button" data-est-preset="estuary">Estuary balance</button>
        <button type="button" data-est-preset="cadenceMetamer">Cadence metamer</button>
        <button type="button" data-est-preset="densityMetamer">Density metamer</button>
        <button type="button" id="ctrl-audio" data-est-audio aria-pressed="false">Listen to harmonic metamer</button>
      </div>
      ${ctx?.plain ? '' : '<canvas id="estuary-canvas" class="est-canvas" width="720" height="380" role="img" aria-label="Interactive Perret concrete lantern showing continuous spectral glass apertures and halocline seams"></canvas>'}
      <dl class="est-readouts">
        <dt>Metamer</dt><dd data-est-metamer></dd>
        <dt>Homology</dt><dd data-est-homology></dd>
        <dt>Harmonic voice</dt><dd data-est-acoustic></dd>
        <dt>Receipt</dt><dd><code data-est-receipt></code></dd>
      </dl>
      <p data-est-status class="est-status" role="status" aria-live="polite"></p>
    </div>`;

    canvas = host.querySelector('#estuary-canvas');
    ctx2d = canvas?.getContext?.('2d') || null;
    statusEl = host.querySelector('[data-est-status]');
    readouts = host.querySelector('.est-readouts');
    ctx?.offerPicture?.(() => canvas);

    const syncControlsFromState = () => {
      const setOut = (k, v) => { const el = host.querySelector(`[data-est-v="${k}"]`); if (el) el.textContent = v.toFixed(2); };
      const mixIn = host.querySelector('[data-est-mix]'); if (mixIn) mixIn.value = String(state.mix);
      setOut('mix', state.mix);
      const lensIn = host.querySelector('[data-est-lens]'); if (lensIn) lensIn.value = state.observer;
      for (const prop of ESTUARY_PROPERTIES) {
        const el = host.querySelector(`[data-est-prop="${prop}"]`);
        if (el) el.value = String(state.weightsA[prop]);
        setOut(prop, state.weightsA[prop]);
      }
    };

    host.querySelector('[data-est-op]')?.addEventListener('change', (e) => {
      state.operatorId = e.target.value;
      const op = operatorById(state.operatorId);
      if (op) state.weightsA = { ...op.weights };
      syncControlsFromState(); paintCanvas(); emit();
    });
    host.querySelector('[data-est-tr]')?.addEventListener('change', (e) => {
      state.transducerId = e.target.value;
      const tr = transducerById(state.transducerId);
      if (tr) state.weightsB = { ...tr.weights };
      paintCanvas(); emit();
    });
    host.querySelector('[data-est-lens]')?.addEventListener('change', (e) => {
      state.observer = e.target.value; paintCanvas(); emit();
    });
    host.querySelector('[data-est-mix]')?.addEventListener('input', (e) => {
      state.mix = Number(e.target.value);
      const out = host.querySelector('[data-est-v="mix"]'); if (out) out.textContent = state.mix.toFixed(2);
      paintCanvas(); emit();
    });
    for (const prop of ESTUARY_PROPERTIES) {
      host.querySelector(`[data-est-prop="${prop}"]`)?.addEventListener('input', (e) => {
        state.weightsA[prop] = Number(e.target.value);
        const out = host.querySelector(`[data-est-v="${prop}"]`); if (out) out.textContent = state.weightsA[prop].toFixed(2);
        paintCanvas(); emit();
      });
    }
    for (const btn of host.querySelectorAll('[data-est-preset]')) {
      btn.addEventListener('click', () => {
        const p = LANTERN_PRESETS[btn.dataset.estPreset]; if (!p) return;
        state.mix = p.mix; state.observer = p.observer;
        state.weightsA = { ...p.weightsA }; state.weightsB = { ...p.weightsB };
        syncControlsFromState(); paintCanvas(); emit();
      });
    }
    const audioBtn = host.querySelector('[data-est-audio]');
    audioBtn?.addEventListener('click', () => {
      if (synth.isPlaying()) {
        synth.stop();
        audioBtn.setAttribute('aria-pressed', 'false');
        audioBtn.textContent = 'Listen to harmonic metamer';
      } else if (synth.start(frame.recombination.acoustic)) {
        audioBtn.setAttribute('aria-pressed', 'true');
        audioBtn.textContent = 'Stop harmonic metamer';
      }
    });

    paintCanvas();
    if (!state.reducedMotion && typeof globalThis.requestAnimationFrame === 'function') {
      const tick = (now) => {
        if (dead || state.reducedMotion) { rafId = 0; return; }
        state.time = now * 0.001;
        paintCanvas();
        rafId = globalThis.requestAnimationFrame(tick);
      };
      rafId = globalThis.requestAnimationFrame(tick);
    }
  }

  const leave = bus ? bus.join('estuary', (env) => {
    if (env?.medium === 'blend' && typeof env.value?.mix === 'number') state.mix = env.value.mix;
    if (env?.medium === 'numbers' && env.value && typeof env.value === 'object') Object.assign(state.weightsA, env.value);
    paintCanvas();
  }) : null;
  emit();

  return {
    update(next = {}) {
      if (next.heard) {
        const env = next.heard;
        if (env.medium === 'blend' && typeof env.value?.mix === 'number') state.mix = env.value.mix;
        if (env.medium === 'numbers' && env.value && typeof env.value === 'object') Object.assign(state.weightsA, env.value);
      }
      if (typeof next.mix === 'number') state.mix = next.mix;
      if (next.operatorId) { state.operatorId = next.operatorId; const op = operatorById(next.operatorId); if (op) state.weightsA = { ...op.weights }; }
      if (next.transducerId) { state.transducerId = next.transducerId; const tr = transducerById(next.transducerId); if (tr) state.weightsB = { ...tr.weights }; }
      if (next.weights) Object.assign(state.weightsA, next.weights);
      paintCanvas();
      emit();
    },
    value: () => frame,
    destroy() {
      dead = true;
      if (rafId && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(rafId);
      synth.stop();
      if (leave) leave();
    },
  };
}
