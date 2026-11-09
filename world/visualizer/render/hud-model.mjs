// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// hud-model.mjs: what the HUD says at time t, as plain data, shared by the offline lettering (hud.mjs) and the live
// page's DOM (web/app.js). Every string is a measured value or a definition with its source.
import { at } from '../lib/features.mjs';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(hz) {
  if (!(hz > 0)) return '';
  const m = 69 + 12 * Math.log2(hz / 440), r = Math.round(m), c = Math.round((m - r) * 100);
  return `${NOTES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1} ${c >= 0 ? '+' : '−'}${Math.abs(c)} c`;
}
// a number with a true minus sign and a fixed count of decimals
const fx = (v, d = 1) => (v < 0 && +Math.abs(v).toFixed(d) !== 0 ? '−' : '') + Math.abs(v).toFixed(d);

export function hudModel(F, t, geom, S) {
  const v = at(F, t), H = S.hud ?? {}, m = F.meter.beatsPerBar;
  const tl = [{ text: H.title ?? '', role: 'title' }, ...(H.credit ?? []).map(text => ({ text, role: 'credit' }))];
  let tr, br;
  if (F.kind === 'series') {
    const i = Math.max(0, Math.min(F.values.length - 1, Math.round((t - F.beats[0]) / F.tempo.period)));
    const label = F.labels[i], val = F.values[i], d = H.derived ? H.derived(i) : null;
    tr = [{ text: String(label), role: 'value' }, { text: `${fx(val, H.digits ?? 1)}${F.unit ? ' ' + F.unit : ''}`, role: 'line' }, ...(d ? [{ text: d, role: 'line' }] : [])];
    br = { kind: 'series', values: F.values, index: i, frac: Math.max(0, Math.min(F.values.length - 1, (t - F.beats[0]) / F.tempo.period)), range: F.range, caption: H.seriesCaption ?? '' };
  } else {
    const barNo = Math.max(1, geom.bar + 1), beatNo = geom.beat + 1;
    tr = [
      { text: `${F.tempo.bpm.toFixed(1)} BPM`, role: 'value' },
      { text: F.meter.identified ? `${m}/4  bar ${barNo}  beat ${beatNo}` : `bar not identified  beat ${((v.beatIndex % 4) + 4) % 4 + 1}`, role: 'line' },
      { text: `${fx(Math.max(-60, v.lufsS), 1)} LUFS short-term`, role: 'line' },
    ];
    const bands = F.spec.bands, fi = Math.max(0, Math.min(F.n - 1, Math.round(t * F.fps))), row = Array.from(F.spec.data.subarray(fi * bands, fi * bands + bands));
    br = { kind: 'spectrum', row, readout: `${fx(v.peakDb, 1)} dB | ${v.peakHz.toFixed(1)} Hz | ${noteName(v.peakHz)}`, lo: F.spec.lo, hi: F.spec.hi, peakHz: v.peakHz };
  }
  const defs = H.definitions ?? [], every = H.defineEvery ?? 8;
  const di = defs.length ? ((Math.floor(Math.max(0, geom.bar) / every) % defs.length) + defs.length) % defs.length : -1;
  const bl = di >= 0 ? defs[di] : null;
  // figure labels: beat numbers (or the first label of a data group) and the inter-onset time of the current edge
  const figure = [];
  if (F.kind === 'series') {
    const first = Math.round((geom.t0 - F.beats[0]) / F.tempo.period);
    if (first >= 0 && first < F.labels.length) figure.push({ at: geom.verts[0], text: String(F.labels[first]), anchor: 'vertex', i: 0 });
  } else {
    geom.verts.forEach((p, i) => figure.push({ at: p, text: String(i + 1), anchor: 'vertex', i }));
    const B = [...geom.beats, geom.t1], k = geom.beat, ms = Math.round((B[k + 1] - B[k]) * 1000);
    const a = geom.verts[k], b = geom.verts[(k + 1) % m];
    figure.push({ at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], text: `${ms} ms`, anchor: 'edge', i: k });
  }
  return { corners: { tl, tr, bl, br }, figure, accentPhase: v.beatPhase };
}

