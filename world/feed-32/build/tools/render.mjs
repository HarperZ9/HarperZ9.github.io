// tools/render.mjs: every feed-32 output from the libraries in ../. node --max-old-space-size=8192 tools/render.mjs
// Writes to out/ (a junction to E:) and a timing log to out/render.log.json. Scratch only; nothing here is a library.
import { writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sequence, primesBelow } from '../sequences.mjs';
import { decompose, render as strata, tally } from '../strata.mjs';
import { grade } from '../film.mjs';
import { cues, lineMask, solveLegible, compositeLegible, glyphContrast } from '../subtitle.mjs';
import { set } from '../settype.mjs';
import { DEMO, events, audio, formula, draw as lanes } from '../eqseq.mjs';
import { draw as grid, describe } from '../hollowgrid.mjs';
import { writePNG, writeVideo, FFMPEG } from '../../../feed-29/build/lib/io.mjs';
import { encode } from '../../../feed-29/build/lib/field.mjs';
import { paint } from '../../../feed-29/build/painting.mjs';
import { writeWav } from '../../../visualizer/lib/wav.mjs';

const log = {}, only = process.argv[2] ?? 'all', time = (k, f) => { const t = performance.now(), r = f(); log[k] = Math.round(performance.now() - t); return r; };
const want = k => only === 'all' || only === k;

if (want('strata')) {
  const P = time('primes-sieve', () => primesBelow(1e7)), D = time('primes-decompose', () => decompose(P));
  const R = time('primes-render-1600', () => strata({ w: 1600, h: 1600, D, A: 1e7, hot: 'weight3', yaw: -0.9, pitch: 0.42 }));
  await writePNG('out/strata-primes-weight3-1600.png', R, { grainSd: 1.2, seed: 'strata-p' });
  log.primes = tally(D, 'weight3');
  for (const [name, n, hot] of [['naturals', 200000, 'level1'], ['semiprimes', 200000, 'jump2'], ['squares', 50000, 'level1']]) {
    const S = sequence(name, n), E = decompose(S), A = S[S.length - 1];
    await writePNG(`out/strata-${name}-${hot}-1200.png`, strata({ w: 1200, h: 1200, D: E, A, hot, yaw: -0.9, pitch: 0.42 }), { grainSd: 1.2, seed: `strata-${name}` });
    log[name] = tally(E, hot);
  }
}

if (want('film')) {
  const W = 1280, H = 720, src = time('paint-1280', () => paint({ w: W, h: H, seed: 'harbour' }));
  await writePNG('out/film-source-1280.png', src, { seed: 'src' });
  const G = time('grade-1280', () => grade(src, {}, { seed: 'film', frame: 0 }));
  await writePNG('out/film-graded-1280.png', G, { seed: 'g' });
  const lines = ['the river keeps the last of the light'], cue = cues([[0, 3]], lines)[0];
  const mask = time('subtitle-mask', () => lineMask(cue.text, W, H, set())), L = time('subtitle-solve', () => solveLegible(src, mask, { seed: 'film', frame: 45 }));
  log.halo = L.opts; log.solveMin = +L.min.toFixed(2);
  const withSub = t => { const R = { w: W, h: H, px: Float32Array.from(src.px) }; return t >= cue.on && t < cue.off ? compositeLegible(R, mask, L.ink, L.halo) : R; };
  const still = grade(withSub(1.5), {}, { frame: 45 }); log.stillMin = +glyphContrast(still, mask).min.toFixed(2);
  await writePNG('out/film-subtitle-1280.png', still, { seed: 's' });
  const t0 = performance.now(), mins = [];
  await writeVideo('out/film-subtitle-3s-1280.mp4', W, H, 30, 90, async i => {
    const G = grade(withSub(i / 30), {}, { seed: 'film', frame: i });
    if (i / 30 >= cue.on && i / 30 < cue.off) mins.push(glyphContrast(G, mask).min);
    return encode(G, { seed: `v${i}` });
  }, { crf: 14 });
  log.videoMin = +Math.min(...mins).toFixed(2); log.videoFramesWithLine = mins.length;
  if (log.stillMin < 4.5 || log.videoMin < 4.5) throw new Error(`subtitle under 4.5:1 (still ${log.stillMin}, video ${log.videoMin})`);
  log['film-video-90f'] = Math.round(performance.now() - t0); log.cue = cue;
}

if (want('seq')) {
  const p = DEMO, E = events(p), pcm = time('eqseq-audio', () => audio(p, 48000));
  writeFileSync('out/eqseq-demo.wav', writeWav({ rate: 48000, channels: [pcm] }, { bits: 16 }));
  writeFileSync('out/eqseq-formula.txt', formula(p) + '\n');
  await writePNG('out/eqseq-lanes-1600.png', lanes({ w: 1600, h: 900, t: 1.375 }), { grainSd: 0.8, seed: 'lanes' });
  // The hollow grid and the lanes driven by the same events and the same PCM, side by side, sound muxed in.
  const W = 1280, H = 640, fps = 30, n = Math.ceil(E.duration * fps), spb = 60 / p.bpm;
  const t0 = performance.now();
  await writeVideo('out/.seq-silent.mp4', W, H, fps, n, async i => {
    const t = i / fps, L = lanes({ w: W / 2, h: H, t: t / spb }), Gd = grid({ w: W / 2, h: H, score: E, t, cols: 4, rows: 4, map: 'order', fade: 1.2, mask: 'circle' });
    const R = { w: W, h: H, px: new Float32Array(W * H * 3) };
    for (let y = 0; y < H; y++) { R.px.set(Gd.px.subarray(3 * y * (W / 2), 3 * (y + 1) * (W / 2)), 3 * y * W); R.px.set(L.px.subarray(3 * y * (W / 2), 3 * (y + 1) * (W / 2)), 3 * (y * W + W / 2)); }
    return encode(R, { seed: `q${i}`, grainSd: 0.8 });
  }, { crf: 16 });
  const m = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', 'out/.seq-silent.mp4', '-i', 'out/eqseq-demo.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'out/eqseq-grid-lanes-1280.mp4']);
  if (m.status !== 0) throw new Error(`mux failed: ${m.stderr}`);
  unlinkSync('out/.seq-silent.mp4');
  log['seq-video'] = Math.round(performance.now() - t0); log.events = E.events.length; log.describeAt2s = describe(E, 2, { cols: 4, rows: 4, map: 'order', fade: 1.2 });
}

writeFileSync(`out/render.log.${only}.json`, JSON.stringify(log, null, 1)); console.log(log);
