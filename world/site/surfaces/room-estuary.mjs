// room-estuary.mjs: registry.mjs adapter that connects estuary-lantern.mjs to the shared bus.mjs protocol.
import { DEFAULT_ELEMENT_A, DEFAULT_ELEMENT_B, computeLanternFrame } from './estuary-lantern.mjs';

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
