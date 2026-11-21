import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FILM_STOCKS, SCANNER_OPTICS, hdDensity, emulateFilmAndScanner } from '../world/site/surfaces/film-scanner-emulation.mjs';

test('H&D sensitometric curve is strictly monotonic across exposure stops', () => {
  const vals = [0.01, 0.05, 0.15, 0.4, 0.8, 1.0].map((e) => hdDensity(e, 0.7, 0.1, 2.5));
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] > vals[i - 1], `expected monotonic density at step ${i}`);
  }
});

test('all 5 stocks x 4 scanners preserve monochrome/neutral grey balance on B&W stocks', () => {
  assert.equal(Object.keys(FILM_STOCKS).length, 5);
  assert.equal(Object.keys(SCANNER_OPTICS).length, 4);
  for (const scanner of Object.keys(SCANNER_OPTICS)) {
    const bw = emulateFilmAndScanner([0.8, 0.4, 0.1], 'kodak-trix-400', scanner);
    assert.ok(Math.abs(bw.rgb[0] - bw.rgb[1]) < 1e-4);
    assert.ok(Math.abs(bw.rgb[1] - bw.rgb[2]) < 1e-4);
  }
});

test('decoupled scanner optics produce distinct MTF sharpness and color matrices on identical stock', () => {
  const frontier = emulateFilmAndScanner([0.6, 0.4, 0.3], 'kodak-gold-200', 'frontier-sp3000');
  const drum = emulateFilmAndScanner([0.6, 0.4, 0.3], 'kodak-gold-200', 'pmt-drum-scan');
  assert.ok(drum.mtfSharpness > frontier.mtfSharpness);
  assert.notDeepEqual(frontier.rgb, drum.rgb);
});

test('film-scanner-emulation.mjs has zero em dashes and zero local paths', () => {
  const src = readFileSync(new URL('../world/site/surfaces/film-scanner-emulation.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'));
  assert.ok(!/[A-Za-z]:\\/.test(src));
});
