// estuary-lantern.mjs: Saint-Joseph lantern geometry, spectral apertures,
// canvas renderer, opt-in WebAudio harmonic voice, and DOM binder for estuary.html.
import { ESTUARY_PROPERTIES, clamp01, createGenotype, evaluateField, expressPhenotype, normalizeWeights } from './estuary-field.mjs';
import { OBSERVER_MATRICES, detectMetamers, recombineAcrossMediums } from './estuary-recombination.mjs';
import { analyzeLanternHomology } from './estuary-homology.mjs';

export const OBSERVER_LENSES = Object.freeze(Object.keys(OBSERVER_MATRICES));

export const DEFAULT_ELEMENT_A = Object.freeze({
  id: 'lantern-glass', name: 'Lantern glass', x: 0.28, y: 0.5, radius: 0.34, seed: 11,
  weights: Object.freeze({ refraction: 0.85, fluid: 0.30, measure: 0.45, cad: 0.72, sound: 0.25 }),
});

export const DEFAULT_ELEMENT_B = Object.freeze({
  id: 'estuary-tide', name: 'Estuary tide', x: 0.72, y: 0.5, radius: 0.34, seed: 29,
  weights: Object.freeze({ refraction: 0.22, fluid: 0.88, measure: 0.38, cad: 0.18, sound: 0.82 }),
});

export const LANTERN_PRESETS = Object.freeze({
  estuary: Object.freeze({ mix: 0.5, observer: 'visual-luminance', weightsA: DEFAULT_ELEMENT_A.weights, weightsB: DEFAULT_ELEMENT_B.weights }),
  cadenceMetamer: Object.freeze({
    mix: 0.5, observer: 'temporal-cadence',
    weightsA: Object.freeze({ refraction: 0.05, fluid: 0.96, measure: 0.10, cad: 0.12, sound: 0.04 }),
    weightsB: Object.freeze({ refraction: 0.04, fluid: 0.05, measure: 0.12, cad: 0.10, sound: 0.96 }),
  }),
  densityMetamer: Object.freeze({
    mix: 0.5, observer: 'structural-density',
    weightsA: Object.freeze({ refraction: 0.90, fluid: 0.08, measure: 0.12, cad: 0.06, sound: 0.04 }),
    weightsB: Object.freeze({ refraction: 0.06, fluid: 0.10, measure: 0.12, cad: 0.86, sound: 0.04 }),
  }),
});

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

// Compute structural concrete lattice and recessed spectral glass apertures.
export function createLanternLattice({ cols = 10, rows = 6, cadWeight = 0.5 } = {}) {
  const c = Math.max(2, Math.trunc(cols)), r = Math.max(2, Math.trunc(rows)), cad = clamp01(cadWeight);
  const frameMargin = 0.055 + 0.025 * cad, mullionFrac = 0.10 + 0.22 * cad, pierFrac = mullionFrac * 1.45;
  const cellW = (1 - frameMargin * 2) / c, cellH = (1 - frameMargin * 2) / r;
  const apertures = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const gx = cellW * (col % 2 === 0 ? pierFrac : mullionFrac) * 0.5;
      const gy = cellH * (row % 2 === 0 ? pierFrac : mullionFrac) * 0.5;
      apertures.push(Object.freeze({
        col, row, u: (col + 0.5) / c, v: (row + 0.5) / r,
        x: frameMargin + col * cellW + gx, y: frameMargin + row * cellH + gy,
        w: Math.max(0.008, cellW - gx * 2), h: Math.max(0.008, cellH - gy * 2),
        isPrimaryBay: col % 2 === 0 && row % 2 === 0,
      }));
    }
  }
  return Object.freeze({ cols: c, rows: r, frameMargin, mullionFrac, pierFrac, apertures: Object.freeze(apertures) });
}

// Compute diffused chromatic light for a single glass aperture.
export function computeApertureSpectrum(rawWeights, u = 0.5, v = 0.5, time = 0, reducedMotion = false) {
  const w = normalizeWeights(rawWeights);
  const t = reducedMotion ? 0 : (Number.isFinite(time) ? time : 0);
  const phase = u * 4.2 + v * 3.1 + t * (0.6 + 1.1 * w.fluid);
  const shimmer = reducedMotion ? 0 : Math.sin(phase) * (0.04 + 0.08 * w.fluid + 0.05 * w.sound);
  const r = clampByte(34 + 210 * w.refraction + 92 * w.sound + 44 * w.cad + shimmer * 90);
  const g = clampByte(42 + 165 * w.fluid + 125 * w.refraction + 86 * w.measure + shimmer * 70);
  const b = clampByte(58 + 168 * w.sound + 150 * w.measure + 110 * w.fluid - shimmer * 60);
  const energy = (w.refraction + w.fluid + w.measure + w.cad + w.sound) / 5;
  const alpha = clamp01(0.32 + 0.62 * energy + 0.14 * w.refraction - 0.10 * w.cad);
  const glowRadius = 0.35 + 1.15 * w.refraction + 0.75 * w.fluid + 0.45 * w.sound;
  const causticAngle = (u * 2.4 - v * 1.9 + t * 0.45) * Math.PI;
  const causticMag = w.refraction * w.fluid * (reducedMotion ? 0.18 : 0.45);
  return Object.freeze({
    r, g, b, alpha: Number(alpha.toFixed(4)),
    glowRadius: Number(glowRadius.toFixed(4)),
    causticDx: Number((Math.cos(causticAngle) * causticMag).toFixed(4)),
    causticDy: Number((Math.sin(causticAngle) * causticMag).toFixed(4)),
    harmonicPhase: Number((phase % (Math.PI * 2)).toFixed(4)),
  });
}

// Assemble a complete deterministic lantern frame from UI state.
export function computeLanternFrame(state = {}) {
  const mix = clamp01(state.mix ?? 0.5);
  const observer = OBSERVER_LENSES.includes(state.observer) ? state.observer : 'visual-luminance';
  const seed = (Number.isFinite(state.seed) ? state.seed : 42) >>> 0 || 1;
  const reducedMotion = Boolean(state.reducedMotion);
  const time = reducedMotion ? 0 : (Number.isFinite(state.time) ? state.time : 0);
  const weightsA = normalizeWeights(state.weightsA || DEFAULT_ELEMENT_A.weights);
  const weightsB = normalizeWeights(state.weightsB || DEFAULT_ELEMENT_B.weights);
  const genA = createGenotype({ ...DEFAULT_ELEMENT_A, weights: weightsA });
  const genB = createGenotype({ ...DEFAULT_ELEMENT_B, weights: weightsB });
  const recombination = recombineAcrossMediums(genA, genB, mix, seed);
  const field = evaluateField([genA, genB], { width: 10, height: 6, seed, time, reducedMotion });
  const phenotype = expressPhenotype(field, { reducedMotion, seed, time });
  const metamer = detectMetamers(genA.weights, genB.weights, observer);
  const lattice = createLanternLattice({ cols: 10, rows: 6, cadWeight: recombination.weights.cad });
  const apertures = Object.freeze(lattice.apertures.map((ap, idx) => {
    const cell = field.grid.cells[idx];
    const blendedCell = {};
    for (const p of ESTUARY_PROPERTIES) {
      blendedCell[p] = clamp01(cell.weights[p] * 0.55 + recombination.weights[p] * 0.45);
    }
    const spectrum = computeApertureSpectrum(blendedCell, ap.u, ap.v, time, reducedMotion);
    return Object.freeze({ ...ap, halocline: cell.halocline, weights: Object.freeze(blendedCell), spectrum });
  }));
  const homology = analyzeLanternHomology(apertures, lattice.cols, lattice.rows);
  return Object.freeze({
    mix, observer, seed, reducedMotion, field, phenotype, recombination,
    metamer, topology: recombination.topology, homology, lattice, apertures, receipt: recombination.receipt,
  });
}

function drawApertureGlass(ctx, ap, width, height, visual) {
  const x = ap.x * width, y = ap.y * height, w = ap.w * width, h = ap.h * height;
  const cx = x + w * 0.5, cy = y + h * 0.5, s = ap.spectrum;
  const rad = Math.max(w, h) * (0.65 + 0.1125 * visual.diffusionSigma) * s.glowRadius;
  const grad = ctx.createRadialGradient(cx + s.causticDx * w * 0.4, cy + s.causticDy * h * 0.4, Math.min(w, h) * 0.08, cx, cy, rad);
  grad.addColorStop(0, `rgba(${s.r}, ${s.g}, ${s.b}, ${Math.min(1, s.alpha + 0.16)})`);
  grad.addColorStop(0.65, `rgba(${s.r}, ${s.g}, ${s.b}, ${s.alpha * 0.62})`);
  grad.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0)`);
  ctx.fillStyle = grad; ctx.fillRect(x - w * 0.2, y - h * 0.2, w * 1.4, h * 1.4);
  ctx.fillStyle = `rgba(${s.r}, ${s.g}, ${s.b}, ${Math.min(0.95, s.alpha * 0.88)})`; ctx.fillRect(x, y, w, h);
  if (ap.weights.sound > 0.22) {
    ctx.strokeStyle = `rgba(237, 233, 225, ${(ap.weights.sound * 0.35).toFixed(3)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * (0.2 + 0.22 * ap.weights.sound), 0, Math.PI * 2); ctx.stroke();
  }
  if (ap.weights.measure > 0.25) {
    const tick = Math.min(w, h) * 0.16;
    ctx.strokeStyle = `rgba(16, 19, 24, ${(0.25 + 0.35 * ap.weights.measure).toFixed(3)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - tick, cy); ctx.lineTo(cx + tick, cy); ctx.moveTo(cx, cy - tick); ctx.lineTo(cx, cy + tick); ctx.stroke();
  }
}

// Render the Saint-Joseph concrete lantern and spectral glass field to 2D canvas.
export function renderLanternCanvas(ctx, width, height, frame) {
  ctx.save();
  ctx.fillStyle = '#101318'; ctx.fillRect(0, 0, width, height);
  const { lattice, apertures, recombination, topology } = frame;
  for (const ap of apertures) drawApertureGlass(ctx, ap, width, height, recombination.visual);
  const cad = recombination.weights.cad, mx = lattice.frameMargin * width, my = lattice.frameMargin * height;
  ctx.strokeStyle = `rgba(198, 194, 184, ${(0.32 + 0.52 * cad).toFixed(3)})`; ctx.lineWidth = 1.5 + 3.5 * cad;
  ctx.strokeRect(mx * 0.65, my * 0.65, width - mx * 1.3, height - my * 1.3);
  for (const ap of apertures) {
    ctx.strokeStyle = ap.halocline > 0.42
      ? `rgba(245, 212, 138, ${(0.35 + 0.55 * recombination.visual.seamHighlight).toFixed(3)})`
      : `rgba(216, 212, 202, ${(0.24 + 0.42 * cad).toFixed(3)})`;
    ctx.lineWidth = ap.isPrimaryBay ? (1.4 + 2.0 * cad) : (0.9 + 1.0 * cad);
    ctx.strokeRect(ap.x * width, ap.y * height, ap.w * width, ap.h * height);
  }
  const centroid = topology.negativeSpace.centroid;
  if (centroid) {
    ctx.strokeStyle = 'rgba(237, 233, 225, 0.72)'; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(centroid.x * width, centroid.y * height, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Opt-in WebAudio physical-model harmonic chord (strictly started on user click).
export function createHarmonicSynth() {
  let audioCtx = null, masterGain = null, filter = null, voices = [], playing = false;
  function stop() {
    if (!playing) return;
    playing = false;
    const now = audioCtx ? audioCtx.currentTime : 0;
    if (masterGain && audioCtx) {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(0.0001, now, 0.04);
    }
    const oldVoices = voices;
    voices = [];
    for (const v of oldVoices) {
      try { v.osc.stop(now + 0.14); } catch {}
    }
  }
  function start(acoustic) {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    stop();
    const now = audioCtx.currentTime;
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400 + (1 - acoustic.damping) * 1800, now);
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.16, now + 0.12);
    filter.connect(masterGain); masterGain.connect(audioCtx.destination);
    voices = acoustic.freqsHz.map((hz, i) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, now);
      gain.gain.setValueAtTime((acoustic.amps[i] || 0.2) * 0.28, now);
      osc.connect(gain); gain.connect(filter); osc.start(now);
      return { osc, gain };
    });
    playing = true;
    return true;
  }
  function update(acoustic) {
    if (!playing || !audioCtx || !filter) return;
    const now = audioCtx.currentTime;
    filter.frequency.setTargetAtTime(1400 + (1 - acoustic.damping) * 1800, now, 0.05);
    voices.forEach((v, i) => {
      if (acoustic.freqsHz[i]) v.osc.frequency.setTargetAtTime(acoustic.freqsHz[i], now, 0.05);
      if (acoustic.amps[i] !== undefined) v.gain.gain.setTargetAtTime(acoustic.amps[i] * 0.28, now, 0.05);
    });
  }
  return { start, update, stop, isPlaying: () => playing };
}

function syncReadouts(doc, frame) {
  const set = (id, text) => { const el = doc.getElementById(id); if (el) el.textContent = text; };
  const bar = (id, pct) => { const el = doc.getElementById(id); if (el) el.style.width = `${Math.round(clamp01(pct) * 100)}%`; };
  const { metamer: m, topology: t, homology: h, recombination: r } = frame;
  const badge = doc.getElementById('metamer-badge');
  if (badge) { badge.textContent = m.isMetamer ? 'METAMER DETECTED' : 'PERCEPTUALLY DISTINCT'; badge.dataset.state = m.isMetamer ? 'metamer' : 'distinct'; }
  set('metamer-observer', m.observer); set('metamer-domain', m.domainDistance.toFixed(4));
  set('metamer-perceptual', m.perceptualDistance.toFixed(4)); set('metamer-score', m.metamerScore.toFixed(4));
  set('topo-weight', `${Math.round(t.weight * 100)}%`); bar('bar-weight', t.weight);
  set('topo-transparency', `${Math.round(t.transparency * 100)}%`); bar('bar-transparency', t.transparency);
  set('topo-diffusion', `${Math.round(t.diffusion * 100)}%`); bar('bar-diffusion', t.diffusion);
  set('topo-symmetry', `${Math.round(t.symmetry * 100)}% / ${Math.round(t.asymmetry * 100)}%`); bar('bar-symmetry', t.symmetry);
  set('topo-seams', `${Math.round(t.seams.intensity * 100)}% (${t.seams.ridgeCount} ridges)`); bar('bar-seams', t.seams.intensity);
  set('topo-negspace', `${Math.round(t.negativeSpace.ratio * 100)}% (${t.negativeSpace.betweenPeaks} corridor)`); bar('bar-negspace', t.negativeSpace.ratio);
  set('topo-beta0', `${h.beta0} connected`);
  set('topo-beta1', `${h.beta1} enclosed (chi ${h.eulerCharacteristic})`);
  set('topo-winding', `${h.winding} (${h.hasSingularity ? h.direction : 'none'})`);
  set('acoustic-partials', `${r.acoustic.freqsHz.map((f) => `${f.toFixed(0)} Hz`).join(', ')} at ${r.acoustic.tempoBpm.toFixed(0)} BPM`);
  set('readout-summary', `${r.accessible.summary} ${frame.phenotype.readout.summaryText}`);
  set('readout-receipt', r.receipt.digest);
  set('readout-haptic', `${r.haptic.pulsesMs.join(' / ')} ms (intensity ${(r.haptic.intensity * 100).toFixed(0)}%)`);
}

function bindControls(doc, state, synth, getFrame, drawOnce) {
  const byId = (id) => doc.getElementById(id);
  const mixInput = byId('ctrl-mix'), lensSelect = byId('ctrl-observer'), audioBtn = byId('ctrl-audio');
  const setVal = (id, v) => { const el = byId(id); if (el) el.textContent = v.toFixed(2); };
  mixInput?.addEventListener('input', () => { state.mix = Number(mixInput.value); setVal('val-mix', state.mix); drawOnce(); });
  for (const prop of ESTUARY_PROPERTIES) {
    const input = byId(`ctrl-${prop}`);
    input?.addEventListener('input', () => { state.weightsA[prop] = Number(input.value); setVal(`val-${prop}`, state.weightsA[prop]); drawOnce(); });
  }
  lensSelect?.addEventListener('change', () => { state.observer = lensSelect.value; drawOnce(); });
  for (const btn of doc.querySelectorAll('[data-preset]')) {
    btn.addEventListener('click', () => {
      const p = LANTERN_PRESETS[btn.dataset.preset]; if (!p) return;
      state.mix = p.mix; state.observer = p.observer; state.weightsA = { ...p.weightsA }; state.weightsB = { ...p.weightsB };
      if (mixInput) mixInput.value = String(p.mix); setVal('val-mix', p.mix);
      if (lensSelect) lensSelect.value = p.observer;
      for (const prop of ESTUARY_PROPERTIES) {
        const el = byId(`ctrl-${prop}`); if (el) el.value = String(p.weightsA[prop]); setVal(`val-${prop}`, p.weightsA[prop]);
      }
      drawOnce();
    });
  }
  audioBtn?.addEventListener('click', () => {
    const frame = getFrame();
    if (synth.isPlaying()) { synth.stop(); audioBtn.setAttribute('aria-pressed', 'false'); audioBtn.textContent = 'Listen to harmonic metamer'; }
    else if (frame && synth.start(frame.recombination.acoustic)) { audioBtn.setAttribute('aria-pressed', 'true'); audioBtn.textContent = 'Stop harmonic metamer'; }
  });
}

export function mountEstuaryLantern(doc = document) {
  const canvas = doc.getElementById('estuary-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const motionMq = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const state = {
    mix: 0.5, observer: 'visual-luminance', seed: 42, time: 0,
    reducedMotion: Boolean(motionMq?.matches),
    weightsA: { ...DEFAULT_ELEMENT_A.weights }, weightsB: { ...DEFAULT_ELEMENT_B.weights },
  };
  const synth = createHarmonicSynth();
  let rafId = 0, lastFrame = null;
  const drawOnce = () => {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1), rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || 720)), h = Math.max(220, Math.round(rect.height || 420));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastFrame = computeLanternFrame(state);
    renderLanternCanvas(ctx, w, h, lastFrame);
    syncReadouts(doc, lastFrame);
    if (synth.isPlaying()) synth.update(lastFrame.recombination.acoustic);
  };
  const tick = (now) => {
    if (state.reducedMotion) { rafId = 0; drawOnce(); return; }
    state.time = now * 0.001; drawOnce();
    rafId = globalThis.requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (state.reducedMotion) { if (rafId) globalThis.cancelAnimationFrame(rafId); rafId = 0; state.time = 0; drawOnce(); }
    else if (!rafId) rafId = globalThis.requestAnimationFrame(tick);
  };
  bindControls(doc, state, synth, () => lastFrame, drawOnce);
  motionMq?.addEventListener?.('change', (ev) => { state.reducedMotion = ev.matches; schedule(); });
  globalThis.addEventListener?.('resize', drawOnce);
  drawOnce(); schedule();
  return { state, synth, drawOnce };
}
