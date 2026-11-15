// piece.worker.js: a whole piece rendered offline, off the main thread, for a page that saves it as a file.
// { cmd: 'render', piece, seed, bars, sr, arrangement } gives back the mastered stereo mix of renderPiece (piece.js): the same
// render the ear measures, at the house loudness, with a composed ending. The reply carries the two channels, the
// loudness and true peak measured on this render, the shape of the piece and each bar's chords.
import { renderPiece } from './piece.js';

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.cmd !== 'render') return;
  try {
    const t0 = performance.now(), r = renderPiece(m.piece, { seed: m.seed, bars: m.bars, sr: m.sr || 48000, arrangement: m.arrangement || 'main' }), [L, R] = r.channels;
    self.postMessage({ call: m.call, piece: r.id, seed: r.seed, sr: r.sr, seconds: r.seconds, L, R, renderMs: performance.now() - t0,
      master: { lufs: r.master.lufs, truePeakDb: r.master.truePeakDb }, shape: r.shape,
      bars: r.bars.map((b) => ({ index: b.index, section: b.section, role: b.role, chords: b.chords.map((c) => c.sym) })) }, [L.buffer, R.buffer]);
  } catch (err) { self.postMessage({ call: m.call, error: String((err && err.stack) || err) }); }
};
