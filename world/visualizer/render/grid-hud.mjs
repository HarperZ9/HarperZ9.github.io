// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// grid-hud.mjs: what the struck grid's HUD says at time t, as plain strings, shared by the offline lettering
// (lib/gridscene.mjs) and the live page's DOM (web/grid.js). Pure; runs in Node and the browser.

export const MAPPING_TEXT = {
  pitch: 'Pitch class runs across, octave runs up.',
  rank: 'Each key of the score has its own cell, low to high in reading order.',
  seeded: 'Cells are chosen by a seeded hash of the note number.',
};

export function clockText(t) {
  const s = Math.max(0, t), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss.toFixed(2).padStart(5, '0')}`;
}

export function gridHud(midi, prep, t, src) {
  let k = 0; while (k + 1 < midi.tempos.length && midi.tempos[k + 1].t <= t) k++;
  let played = 0, lo = 0, hi = prep.notes.length; while (lo < hi) { const m = (lo + hi) >> 1; if (prep.notes[m].t <= t) lo = m + 1; else hi = m; } played = lo;
  return {
    tl: [src.title ?? '', ...(src.credit ?? [])],
    tr: [`${midi.tempos[k].bpm.toFixed(1)} BPM`, `${played} of ${prep.notes.length} notes`, clockText(t)],
    bl: { term: 'Decay', text: 'A struck cell empties from its centre: the ink fades as the ground grows, on one ease-out curve.', source: `${prep.p.fade.toFixed(1)} s, scaled by note length` },
    br: MAPPING_TEXT[prep.p.mapping] ?? '',
  };
}

