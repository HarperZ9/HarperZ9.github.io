// lib/living/graph.mjs: every state connects to every other. An edge names the law (transfer.mjs) that carries the
// word from one medium to the next. Specific pairs are listed; any other pair falls back by the states' kinds, so a
// state added later as a plugin is connected without editing this file. A change of text is always a reveal.
import { state, STATES } from './states.mjs';

const PAIRS = new Map([
  ['ink>charcoal', 'bleed'], ['charcoal>plant', 'wet'], ['ink>plant', 'wet'], ['plant>paint', 'bleed'], ['paint>plant', 'wet'],
  ['code>illustration', 'stream'], ['code>engraved', 'stream'], ['print>print-live', 'wake'], ['print-live>print', 'bleed'], ['tiles-code>ink', 'bleed'], ['tiles>ink', 'bleed'],
  ['pixel>ink', 'settle'], ['pixel>engraved', 'settle'], ['pixel>print', 'settle'], ['crt>ink', 'settle'], ['crt>print', 'settle'],
  ['ink>pixel', 'scan'], ['engraved>pixel', 'scan'], ['print>crt', 'scan'], ['ink>crt', 'scan'],
]);
const BY_KIND = { 'digital>analog': 'settle', 'digital>print': 'settle', 'analog>digital': 'scan', 'print>digital': 'scan', 'digital>digital': 'scan', 'analog>analog': 'bleed', 'analog>print': 'bleed', 'print>analog': 'wet', 'print>print': 'bleed' };
const extra = new Map();

/** Add or override one edge (a plugin may bring its own law with registerLaw). */
export function connect(from, to, law) { extra.set(`${from}>${to}`, law); }

/** The law for a step from state `a` to state `b`; `reveal` when the words differ. */
export function edge(a, b, { textChanged = false, via = null } = {}) {
  if (via) return via;
  if (textChanged) return 'pour';
  const k = `${a}>${b}`; if (extra.has(k)) return extra.get(k); if (PAIRS.has(k)) return PAIRS.get(k);
  return BY_KIND[`${state(a).kind}>${state(b).kind}`] ?? 'bleed';
}

/** The whole graph, for documentation and tests: every ordered pair of registered states and its law. */
export function table() { const ids = [...STATES.keys()], out = {}; for (const a of ids) for (const b of ids) if (a !== b) out[`${a}>${b}`] = edge(a, b); return out; }
