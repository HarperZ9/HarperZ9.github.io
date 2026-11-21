// operator-table.mjs: shared cross-domain operator and biological-transducer table.
// Maps invariant structural operators across language (Articulate), biology
// (gymnosperms, bryophytes, fungi, insects), physics, acoustics, and code
// onto continuous Estuary property vectors so any two can blend and form metamers.
import { ESTUARY_PROPERTIES } from './estuary-field.mjs';
import { detectMetamers, recombineAcrossMediums } from './estuary-recombination.mjs';

export const OPERATORS = Object.freeze([
  Object.freeze({
    id: 'chiasmus',
    name: 'Chiasmus / Symplectic Inversion',
    language: 'A -> B -> B\' -> A\' mirror reversal',
    biology: 'Spiral phyllotaxis reversal and bilateral proprioceptive symmetry',
    physics: 'Time-reversal symmetry and determinant-1 shear preservation (Minsky)',
    sound: 'Retrograde melodic inversion and phase-mirrored partials',
    systems: 'Reversible rollback ledger and lossless round-trip serialization',
    weights: Object.freeze({ refraction: 0.72, fluid: 0.25, measure: 0.65, cad: 0.88, sound: 0.60 }),
  }),
  Object.freeze({
    id: 'synecdoche',
    name: 'Synecdoche / Generative Compression',
    language: 'Part standing for and reconstructing the whole',
    biology: 'Seed encoding, genome unfolding, and gymnosperm annual wood-density rings',
    physics: 'Boundary condition determining interior field solution',
    sound: 'Fundamental pitch implying full harmonic overtone series',
    systems: 'Superframe seed, BuildLang kernel, and 16-slot manifold memory capsule',
    weights: Object.freeze({ refraction: 0.45, fluid: 0.40, measure: 0.92, cad: 0.82, sound: 0.55 }),
  }),
  Object.freeze({
    id: 'caesura',
    name: 'Caesura / Structural Negative Space',
    language: 'Enjambment, pause, and deliberate silence between phrases',
    biology: 'Bryophyte reversible desiccation/rehydration dormancy and stomatal apertures',
    physics: 'Band gaps, nodal quiet zones, and thin-wall aperture corridors',
    sound: 'Sidechain ducking, rhythmic rest, and acoustic decay room',
    systems: 'Stress-rest metabolic consolidation and bounded abstention (VENTED)',
    weights: Object.freeze({ refraction: 0.35, fluid: 0.68, measure: 0.50, cad: 0.42, sound: 0.85 }),
  }),
  Object.freeze({
    id: 'counterpoint',
    name: 'Counterpoint / Decentralized Polyphony',
    language: 'Independent voices weaving without collapsing into monologue',
    biology: 'Fungal mycorrhizal routing networks balancing nutrient flow and local repair',
    physics: 'Superposition of coupled wave fields and multi-phase estuary mixing',
    sound: 'Polyphonic voices and independent harmonic lines over shared tempo',
    systems: 'Forum parallel wave orchestration, Plexus mesh, and reallocation commons',
    weights: Object.freeze({ refraction: 0.55, fluid: 0.90, measure: 0.62, cad: 0.48, sound: 0.92 }),
  }),
  Object.freeze({
    id: 'counterfactual',
    name: 'Counterfactual / Negative Control',
    language: 'Irony, steelmanning, and paired as-if-true / as-if-false framing',
    biology: 'Immune self vs non-self discrimination and resin wound-sealing response',
    physics: 'Symmetry breaking, differential measurement, and null interferometry',
    sound: 'Phase cancellation and A/B reference comparison',
    systems: 'Hypothetical loop, Crucible planted faults, and Shared Negative Cache',
    weights: Object.freeze({ refraction: 0.60, fluid: 0.30, measure: 0.96, cad: 0.70, sound: 0.40 }),
  }),
  Object.freeze({
    id: 'refrain',
    name: 'Refrain / Periodic Monodromy',
    language: 'Anaphora and recurring structural cadence',
    biology: 'Insect tympanal oscillation, circadian phase loops, and capillary pulse cycles',
    physics: 'Periodic boundary conditions, circular manifolds, and monodromy winding',
    sound: 'Ostinato, rhythmic loop, and standing Chladni plate modes',
    systems: 'Hash-chained append-only ledger and deterministic frame-loop contract',
    weights: Object.freeze({ refraction: 0.50, fluid: 0.74, measure: 0.78, cad: 0.64, sound: 0.95 }),
  }),
]);

export const BIO_TRANSDUCERS = Object.freeze([
  Object.freeze({
    id: 'xylem-capillary',
    taxon: 'Gymnosperms and Trees',
    mechanism: 'Negative-pressure capillary transport and annual wood-density archive',
    inputs: Object.freeze(['pressure', 'humidity', 'solar-flux']),
    outputs: Object.freeze(['flow-rate', 'structural-density', 'drought-record']),
    operatorId: 'synecdoche',
    weights: Object.freeze({ refraction: 0.30, fluid: 0.92, measure: 0.84, cad: 0.76, sound: 0.28 }),
  }),
  Object.freeze({
    id: 'bryophyte-phase',
    taxon: 'Bryophytes',
    mechanism: 'Reversible desiccation and rehydration metabolic phase switch',
    inputs: Object.freeze(['humidity', 'temperature']),
    outputs: Object.freeze(['hydration-state', 'metabolic-rate']),
    operatorId: 'caesura',
    weights: Object.freeze({ refraction: 0.42, fluid: 0.88, measure: 0.60, cad: 0.35, sound: 0.45 }),
  }),
  Object.freeze({
    id: 'mycorrhizal-router',
    taxon: 'Fungi',
    mechanism: 'Decentralized hyphal routing balancing nutrient supply, redundancy, and repair',
    inputs: Object.freeze(['chemical-gradient', 'local-damage', 'demand']),
    outputs: Object.freeze(['flux-allocation', 'topology-repair']),
    operatorId: 'counterpoint',
    weights: Object.freeze({ refraction: 0.25, fluid: 0.85, measure: 0.78, cad: 0.62, sound: 0.66 }),
  }),
  Object.freeze({
    id: 'insect-mechano-optic',
    taxon: 'Insects and Animals',
    mechanism: 'Polarized compound-eye optics, tympanal vibration sensing, and proprioception',
    inputs: Object.freeze(['polarized-light', 'vibration', 'joint-strain']),
    outputs: Object.freeze(['heading-phase', 'acoustic-spectrum', 'balance-margin']),
    operatorId: 'refrain',
    weights: Object.freeze({ refraction: 0.94, fluid: 0.32, measure: 0.88, cad: 0.72, sound: 0.90 }),
  }),
]);

export function operatorById(id) {
  return OPERATORS.find((op) => op.id === id) || null;
}

export function transducerById(id) {
  return BIO_TRANSDUCERS.find((t) => t.id === id) || null;
}

/** Blend any operator and/or biological transducer through the Estuary recombination engine. */
export function blendOperatorAndTransducer(operatorId, transducerId, mix = 0.5, seed = 42, observer = 'visual-luminance') {
  const op = operatorById(operatorId);
  const tr = transducerById(transducerId);
  if (!op || !tr) throw new Error(`unknown operator (${operatorId}) or transducer (${transducerId})`);
  const elemA = { id: op.id, label: op.name, weights: op.weights };
  const elemB = { id: tr.id, label: `${tr.taxon}: ${tr.id}`, weights: tr.weights };
  const recombination = recombineAcrossMediums(elemA, elemB, mix, seed, { observer });
  const metamer = detectMetamers(op.weights, tr.weights, observer);
  return {
    operator: op,
    transducer: tr,
    mix,
    metamer,
    recombination,
    properties: ESTUARY_PROPERTIES,
  };
}
