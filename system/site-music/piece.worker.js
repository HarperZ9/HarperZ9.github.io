// piece.worker.js: a whole piece rendered offline, off the main thread, for a page that saves it as a file.
// { cmd: 'render', piece, seed, bars, sr, arrangement, band, live } gives back the mastered stereo mix of renderPiece
// (piece.js): the same render the ear measures, at the house loudness, with a composed ending. live carries what the
// listener set (tempo, key, density, each group's level). band, from 0 (the first band) to 1 (the second), blends the
// two arrangements of the same bars: each is rendered and mastered, they are mixed at equal power, and the mix is
// mastered again. The reply carries the two channels, the loudness and true peak measured on this render, the shape of
// the piece and each bar's chords.
import { renderPiece, master } from './piece.js';

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.cmd !== 'render') return;
  try {
    const t0 = performance.now(), opts = { seed: m.seed, bars: m.bars, sr: m.sr || 48000, live: m.live || null };
    const band = Number.isFinite(m.band) ? Math.min(1, Math.max(0, m.band)) : m.arrangement === 'alt' ? 1 : 0;
    const r = renderPiece(m.piece, { ...opts, arrangement: band >= 1 ? 'alt' : 'main' }), [L, R] = r.channels;
    let mastered = r.master;
    if (band > 0 && band < 1) {
      const b = renderPiece(m.piece, { ...opts, arrangement: 'alt' }), [BL, BR] = b.channels, ga = Math.cos(band * Math.PI / 2), gb = Math.sin(band * Math.PI / 2);
      for (let i = 0; i < L.length; i++) { L[i] = L[i] * ga + (BL[i] || 0) * gb; R[i] = R[i] * ga + (BR[i] || 0) * gb; }
      mastered = master(L, R, r.sr);
    }
    self.postMessage({ call: m.call, piece: r.id, seed: r.seed, sr: r.sr, seconds: r.seconds, L, R, renderMs: performance.now() - t0, band,
      master: { lufs: mastered.lufs, truePeakDb: mastered.truePeakDb }, shape: r.shape,
      bars: r.bars.map((b) => ({ index: b.index, section: b.section, role: b.role, chords: b.chords.map((c) => c.sym) })) }, [L.buffer, R.buffer]);
  } catch (err) { self.postMessage({ call: m.call, error: String((err && err.stack) || err) }); }
};
