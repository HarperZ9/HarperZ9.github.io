// lib/living/states-cuts.mjs: the house reference cuts as living states, each with its construction rule as a weight
// the stop can set and a move can change (typeface: the forge's REF_CUTS, read-only; the release fonts are
// AccessionBurin[LINE,wght] and AccessionDivisumma[TURN,wght]).
//   burin      intaglio tone by line: { lines: 4..8 }, the LINE axis (hairlines per stroke)
//   divisumma  the Divisumma tile cut: { turn: 0..100 }, the TURN axis (how strongly a bend narrows its tiles)
// A move from { lines: 4 } to { lines: 8 } is engraving in progress: the extra lines arrive where the front has passed.
import { registerState, pigment } from './states.mjs';

const fill = (C) => { const out = new Float32Array(C.w * C.h * 3); for (let i = 0; i < C.w * C.h; i++) out.set(C.paper, i * 3); return out; };
registerState({ id: 'burin', title: 'Burin', kind: 'print', breath: { amp: 0, rate: 0 }, axis: { tag: 'LINE', min: 4, max: 8, param: 'lines' },
  paint: (C, { lines = 8 } = {}) => pigment(fill(C), C.recut('burin', { burinLines: Math.round(Math.min(8, Math.max(4, lines))) }).coverage.data, '#1a1714', 3.4) });
// the tile gaps break every letter for a reader: OCR 100% at 32 and 96 px (2026-10-26); an art cut, not a reading one
registerState({ id: 'divisumma', title: 'Divisumma', kind: 'print', breath: { amp: 0, rate: 0 }, reads: false, measured: 'OCR 100% at 32 and 96 px', axis: { tag: 'TURN', min: 0, max: 100, param: 'turn' },
  paint: (C, { turn = 50 } = {}) => pigment(fill(C), C.recut('tiles', { tileTurn: Math.min(100, Math.max(0, turn)) / 100 }).coverage.data, '#1b2a20', 3.2) });
