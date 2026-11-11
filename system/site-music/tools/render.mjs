#!/usr/bin/env node
// Render the meditations offline and let the ear report on each. Nothing is played.
//   node system/site-music/tools/render.mjs --out DIR [--piece ID|all] [--bars N] [--seed N] [--tag NAME]
// Writes, per piece: a 16-bit WAV, the ear's report as JSON and as text, and three pictures (spectrogram, chromagram,
// loudness curve) as PNG.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { renderPiece } from '../piece.js';
import { PIECES, PIECE_IDS } from '../pieces.js';
import { listen, summary, pictures } from '../../ear/index.js';
import { encodeWav } from '../../../world/sound/sound/wav.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
export const wavBytes = (channels, sr) => Buffer.from(encodeWav({ numberOfChannels: channels.length, length: channels[0].length, sampleRate: sr, getChannelData: (c) => channels[c] }));
// bars for a piece of about `seconds` at its tempo
export const barsFor = (id, seconds = 185) => Math.round(seconds / (240 / PIECES[id].bpm) / 4) * 4;
// the report without its long series, for a file a person can read
export const slim = (r) => JSON.parse(JSON.stringify(r, (k, v) => (['momentary', 'shortTerm', 'onsets', 'series', 'driftWindows', 'chroma', 'rows'].includes(k) ? undefined : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)));

export function renderAndListen(id, opts = {}) {
  const t0 = Date.now(), p = renderPiece(id, opts), t1 = Date.now(), report = listen({ channels: p.channels, sr: p.sr }, { score: p.score, stems: p.stems });
  return { piece: p, report, renderMs: t1 - t0, listenMs: Date.now() - t1 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const out = arg('--out', null); if (!out) { console.error('pass --out DIR'); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const which = arg('--piece', 'all'), ids = which === 'all' ? PIECE_IDS : [which], seed = +arg('--seed', 1), tag = arg('--tag', '');
  for (const id of ids) {
    const bars = +arg('--bars', barsFor(id)), { piece, report, renderMs, listenMs } = renderAndListen(id, { seed, bars }), base = path.join(out, `${id}${tag ? '-' + tag : ''}`);
    writeFileSync(`${base}.wav`, wavBytes(piece.channels, piece.sr));
    writeFileSync(`${base}.report.json`, JSON.stringify({ id, title: piece.piece.title, topic: piece.piece.topic, key: piece.piece.key, bpm: piece.piece.bpm, swing: piece.piece.swing, bars, seed, seconds: piece.seconds, master: piece.master, renderMs, report: slim(report), chords: report.harmony.rows.map((r) => ({ bar: r.bar + 1, written: r.written, heard: r.heard, fit: +r.fit.toFixed(3), root: r.rootMatch })) }, null, 1));
    const text = `${piece.piece.title} (${id}), ${piece.piece.key}, ${piece.piece.bpm} BPM, ${bars} bars, seed ${seed}\nrender ${(renderMs / 1000).toFixed(1)} s for ${piece.seconds.toFixed(1)} s of audio (${(piece.seconds * 1000 / renderMs).toFixed(1)}x real time); ear ${(listenMs / 1000).toFixed(1)} s\nmaster gain ${piece.master.gainDb.toFixed(2)} dB, limiter touched ${(piece.master.passes[0].limitedShare * 100).toFixed(3)} % of samples, deepest ${Math.max(...piece.master.passes.map((q) => q.maxReductionDb)).toFixed(2)} dB\n${summary(report)}\n`;
    writeFileSync(`${base}.report.txt`, text); console.log(text);
    const png = { deflate: deflateSync };
    writeFileSync(`${base}.spectrogram.png`, pictures.spectrogram(piece.channels, piece.sr, { title: piece.piece.title.toUpperCase() }).png(png));
    writeFileSync(`${base}.chromagram.png`, pictures.chromagram(report.harmony.rows, piece.score.chords, { title: piece.piece.title.toUpperCase() }).png(png));
    writeFileSync(`${base}.loudness.png`, pictures.loudnessPicture(report.level, { title: piece.piece.title.toUpperCase() }).png(png));
  }
}
