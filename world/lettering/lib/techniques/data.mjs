// Data: the weight of each stroke carries a value from a real series, read in the order the word is read. The default
// series is what a 1913 dollar keeps in each later year (cents, from the US CPI-U annual averages, series CPIAUCNS, as
// prepared in dataviz/data/cpi-annual.json with its raw-file hash). The word starts at full weight in
// 1913 and thins to about 3 cents by 2024. Weight maps linearly from value to half-width, and the key is printed beside
// the word on the page, so the number can always be read back from the letter.
import { revealOut } from '../../../techniques/lib/timing.js';
import { ribbon, ribbonD, svgDoc } from '../paint.mjs';

export const meta = {
  id: 'data', title: 'Data', renderer: '2d', ground: 'page', weight: 800,
  lineage: 'Lehmann\'s hachure for slope (1799); weight as a data channel in the dataviz-art framework (section 2b).',
  does: 'Stroke weight along the word follows a real series, here what a 1913 dollar keeps, year by year.',
  params: { min: 'thinnest half-width as a share of the letter\'s, 0.05 to 0.5 (default 0.16)', max: 'heaviest share, 0.6 to 1.4 (default 1.05)' },
};

export const SERIES_URL = new URL('../../../dataviz/data/cpi-annual.json', import.meta.url).href;
export async function loadSeries(url = SERIES_URL) {
  const r = await fetch(url); if (!r.ok) throw new Error(`lettering: series fetch failed ${r.status} ${url}`);
  const d = await r.json();
  return { label: 'Cents left of a 1913 dollar', unit: 'cents', source: `${d.series}, ${d.title}`, sha256: d.raw_sha256, x: d.rows.map(r => r.year), y: d.rows.map(r => r.cents_left) };
}

// Value at word-arc fraction u in [0,1]: the series is laid along the word from its first to last entry.
export function valueAt(series, u) {
  const n = series.y.length, f = Math.max(0, Math.min(1, u)) * (n - 1), i = Math.floor(f), t = f - i;
  return i >= n - 1 ? series.y[n - 1] : series.y[i] * (1 - t) + series.y[i + 1] * t;
}
// And the half-width it draws, plus the inverse, so a test can read the number back from the letter.
export const widthFor = (v, lo, hi, half, a = 0.16, b = 1.05) => half * (a + (b - a) * (v - lo) / (hi - lo || 1));
export const valueFor = (w, lo, hi, half, a = 0.16, b = 1.05) => lo + ((w / half - a) / (b - a)) * (hi - lo);

export async function create(g, env) {
  const series = env.opts.series ?? await loadSeries(), lo = Math.min(...series.y), hi = Math.max(...series.y);
  const a = env.opts.min ?? 0.16, b = env.opts.max ?? 1.05, total = g.total || 1, ink = env.theme.ink;
  const strokes = g.strokes.map(s => {
    const P = s.pts, hw = []; let acc = s.start;
    for (let i = 0; i < P.length; i += 2) { if (i) acc += Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]); hw.push(widthFor(valueAt(series, acc / total), lo, hi, g.half, a, b)); }
    return { P, hw, start: s.start, len: s.len, dot: s.dot };
  });
  const dur = env.opts.duration ?? 2.4; let done = false;
  return {
    series,
    draw(ctx, t) {
      const L = (done ? 1 : revealOut(t, 0.05, dur)) * total;
      ctx.clearRect(0, 0, g.w, g.h); ctx.fillStyle = ink;
      for (const s of strokes) {
        if (s.start > L) break;
        if (s.dot) { ctx.beginPath(); ctx.arc((s.P[0] + s.P[2]) / 2, (s.P[1] + s.P[3]) / 2, s.hw[0] * 1.15, 0, 7); ctx.fill(); continue; }
        let n = s.P.length / 2, acc = s.start; for (let i = 1; i < n; i++) { acc += Math.hypot(s.P[2 * i] - s.P[2 * i - 2], s.P[2 * i + 1] - s.P[2 * i - 1]); if (acc > L) { n = i; break; } }
        ctx.beginPath(); ribbon(ctx, s.P.slice(0, n * 2), s.hw.slice(0, n)); ctx.fill();
        // round the two ends, as a pen would
        for (const k of [0, n - 1]) { ctx.beginPath(); ctx.arc(s.P[2 * k], s.P[2 * k + 1], s.hw[k], 0, 7); ctx.fill(); }
      }
      return !done && t < dur + 0.3;
    },
    finish() { done = true; }, replay() { done = false; },
    svg() { return svgDoc(g, `<g fill="${ink}">${strokes.map(s => `<path d="${ribbonD(s.P, s.hw)}"/>`).join('')}</g>`); },
  };
}
