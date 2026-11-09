// lib/clock.js: the one place the alive layer takes its clocks from. cadence.js (playbook builds) owns the
// two-clock scheduler and its measured presets; we re-export it instead of keeping a copy.
// When the site adopts the layer, copy cadence.js beside alive.js and change this path once.
export { clock, PRESETS, heldShare, uniqueRate, holdsForShare } from '../../playbook/cadence.js';
