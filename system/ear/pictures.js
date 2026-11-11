// pictures.js: three pictures a reviewer can look at, drawn by our own code and written as PNG.
//   spectrogram   time left to right, frequency bottom to top on a logarithmic scale (each octave the same height),
//                 brightness for level in dB
//   chromagram    one column per bar, one row per pitch class; a white tick marks each pitch class the score wrote
//   loudness      momentary (400 ms) and short-term (3 s) loudness in LUFS against the target line
import { mono, powerFrames } from './spectrum.js';
import { Canvas, ramp } from './png.js';
import { NOTE_NAMES } from './pitch.js';

const INK = [200, 205, 215], DIM = [90, 96, 110], GRID = [44, 48, 60];
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function spectrogram(channels, sr, { width = 1400, height = 560, fmin = 30, fmax = 16000, rangeDb = 80, title = 'SPECTROGRAM' } = {}) {
  const x = mono(channels), n = 4096, cv = new Canvas(width, height), X0 = 64, Y0 = 24, W = width - X0 - 12, H = height - Y0 - 30, dur = x.length / sr;
  const hop = Math.max(256, Math.floor((x.length - n) / W)), st = powerFrames(x, sr, { n, hop }), top = Math.min(fmax, sr / 2 * 0.98);
  let peak = 1e-12; for (const f of st.frames) for (let b = 1; b < f.length; b++) if (f[b] > peak) peak = f[b];
  for (let px = 0; px < W; px++) {
    const f = st.frames[Math.min(st.frames.length - 1, Math.floor(px / W * st.frames.length))]; if (!f) break;
    for (let py = 0; py < H; py++) {
      const f0 = fmin * Math.pow(top / fmin, py / H), f1 = fmin * Math.pow(top / fmin, (py + 1) / H), a = f0 / st.binHz, b = Math.max(a + 1e-6, f1 / st.binHz); let p = 0;
      if (b - a < 1) { const i = Math.floor(a), fr = a - i; p = f[i] * (1 - fr) + (f[i + 1] ?? 0) * fr; } else { for (let k = Math.round(a); k < Math.round(b); k++) p = Math.max(p, f[k] ?? 0); }
      cv.px(X0 + px, Y0 + H - 1 - py, ramp(1 + 10 * Math.log10(p / peak + 1e-12) / rangeDb));
    }
  }
  for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { if (hz > top) continue; const y = Y0 + H - 1 - Math.log(hz / fmin) / Math.log(top / fmin) * H; cv.rect(X0 - 5, y, 5, 1, INK); cv.text(4, y - 4, hz >= 1000 ? `${hz / 1000}K` : String(hz), INK); }
  const step = dur > 120 ? 30 : dur > 40 ? 10 : dur > 10 ? 2 : 1; for (let t = 0; t <= dur; t += step) { const xx = X0 + t / dur * W; cv.rect(xx, Y0 + H, 1, 5, INK); cv.text(xx - 8, Y0 + H + 10, mmss(t), INK); }
  cv.text(X0, 6, `${title}  HZ LOG SCALE  ${rangeDb} DB RANGE`, DIM); return cv;
}

// rows: harmony().rows (each with chroma and bar); chords: the written chords with pcs, for the tick marks.
export function chromagram(rows, chords = [], { cell = 14, title = 'CHROMAGRAM' } = {}) {
  const cw = Math.max(4, Math.min(cell, Math.floor(1300 / Math.max(1, rows.length)))), X0 = 40, Y0 = 24, ch = 22, cv = new Canvas(Math.max(760, X0 + rows.length * cw + 12), Y0 + 12 * ch + 30);
  rows.forEach((r, i) => { const mx = Math.max(...r.chroma, 1e-9);
    for (let pc = 0; pc < 12; pc++) cv.rect(X0 + i * cw, Y0 + (11 - pc) * ch, cw - 1, ch - 1, ramp(Math.sqrt(r.chroma[pc] / mx)));
    for (const pc of (chords[i]?.pcs || [])) cv.rect(X0 + i * cw + (cw >> 1) - 1, Y0 + (11 - pc) * ch + ch / 2 - 1, 2, 2, [255, 255, 255]);
    if (r.bar !== undefined && r.bar % 8 === 0 && (i === 0 || rows[i - 1].bar !== r.bar)) cv.text(X0 + i * cw, Y0 + 12 * ch + 8, String(r.bar + 1), INK); });
  NOTE_NAMES.forEach((nm, pc) => cv.text(6, Y0 + (11 - pc) * ch + 6, nm, INK));
  cv.text(X0, 6, `${title}  ONE COLUMN PER CHORD  DOTS: WRITTEN  BAR NUMBERS BELOW`, DIM); return cv;
}

export function loudnessPicture(levels, { target = -14, width = 1400, height = 360, lo = -50, hi = -5, title = 'LOUDNESS' } = {}) {
  const cv = new Canvas(width, height), X0 = 64, Y0 = 24, W = width - X0 - 12, H = height - Y0 - 30, dur = levels.momentary.length ? levels.momentary[levels.momentary.length - 1].t : 1;
  const Y = (l) => Y0 + (hi - Math.max(lo, Math.min(hi, l))) / (hi - lo) * H, X = (t) => X0 + t / dur * W;
  for (let l = hi; l >= lo; l -= 5) { cv.rect(X0, Y(l), W, 1, GRID); cv.text(4, Y(l) - 4, String(l), INK); }
  cv.rect(X0, Y(target), W, 1, [80, 200, 120]);
  const draw = (pts, c) => { for (let i = 1; i < pts.length; i++) if (Number.isFinite(pts[i].lufs) && Number.isFinite(pts[i - 1].lufs)) cv.line(X(pts[i - 1].t), Y(pts[i - 1].lufs), X(pts[i].t), Y(pts[i].lufs), c); };
  draw(levels.momentary, [110, 120, 150]); draw(levels.shortTerm, [255, 190, 60]);
  const step = dur > 120 ? 30 : dur > 40 ? 10 : dur > 10 ? 2 : 1; for (let t = 0; t <= dur; t += step) { cv.rect(X(t), Y0 + H, 1, 5, INK); cv.text(X(t) - 8, Y0 + H + 10, mmss(t), INK); }
  cv.text(X0, 6, `${title} LUFS  GREY: 400 MS  AMBER: 3 S  GREEN: TARGET ${target}  INTEGRATED ${levels.integratedLufs.toFixed(1)}`, DIM); return cv;
}
