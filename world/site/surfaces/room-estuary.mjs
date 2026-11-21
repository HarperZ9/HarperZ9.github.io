// room-estuary.mjs: registry.mjs adapter that connects estuary-lantern.mjs to the shared bus.mjs protocol.
import { DEFAULT_ELEMENT_A, DEFAULT_ELEMENT_B, computeLanternFrame } from './estuary-lantern.mjs';

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
    weightsA: { ...DEFAULT_ELEMENT_A.weights, ...(input?.weightsA || input?.weights || {}) },
    weightsB: { ...DEFAULT_ELEMENT_B.weights, ...(input?.weightsB || {}) },
  };
  let frame = computeLanternFrame(state);
  const bus = ctx?.bus || null;
  const emit = () => {
    if (!bus) return;
    const refs = Array.isArray(input?.elements) && input.elements.length ? input.elements : ['estuary-a', 'estuary-b'];
    const recipe = { mix: state.mix, observer: state.observer, seed: state.seed };
    bus.send('estuary', 'field', frame.recombination.visual, { refs, recipe });
    bus.send('estuary', 'score', frame.recombination.acoustic, { refs, recipe });
    bus.send('estuary', 'palette', frame.apertures.slice(0, 6).map((a) => a.hex), { refs, recipe });
  };
  const leave = bus ? bus.join('estuary', (env) => {
    if (env?.medium === 'blend' && typeof env.value?.mix === 'number') state.mix = env.value.mix;
    if (env?.medium === 'numbers' && env.value && typeof env.value === 'object') Object.assign(state.weightsA, env.value);
    frame = computeLanternFrame(state);
  }) : null;
  emit();
  return {
    update(next = {}) {
      if (typeof next.mix === 'number') state.mix = next.mix;
      if (next.weights) Object.assign(state.weightsA, next.weights);
      frame = computeLanternFrame(state);
      emit();
    },
    value: () => frame,
    destroy() { if (leave) leave(); },
  };
}
