// Fourier: every contour of every letter is a sum of rotating vectors. The outlines come from the font itself
// (Hanken Grotesk Bold, OFL 1.1, read by lib/fourier/ttf.mjs), counters kept as their own contours; the kernel
// (lib/fourier/kernel.mjs, the twin of the BuildLang kernel in lettering/native/) resamples each by arc length and
// takes its Fourier descriptors. The harmonic count is the living axis: a few terms give the gist, a pebble; all the
// terms that show at this size give the crisp letter. Words morph into words through matched descriptors. The
// machine (the arms that draw each contour) shows on request, and the same descriptors play as an XY stereo sound
// (left x, right y) with an oscilloscope that draws the letters back from what is heard. Sound is off until play.
import { wordSeries, loopSeries, pairUp, mix, morphTerms } from '../fourier/shape.mjs';
import { trace, arms, armOrder, truncate } from '../fourier/kernel.mjs';
import { parseTTF } from '../fourier/ttf.mjs';
import { makeRenderer } from '../fourier/gpu.mjs';
import { xySignal } from '../fourier/xy.mjs';
import { spectrum2d, bandImage, gridOf } from '../fourier/band.mjs';
import { currentFace } from '../glyph.mjs';
import { clamp } from '../paint.mjs';

export const meta = {
  id: 'fourier', title: 'Fourier', renderer: 'webgl', ground: 'page', weight: 700,
  lineage: 'Fourier descriptors of closed curves (Zahn and Roskies 1972; Kuhl and Giardina 1982); epicycle drawing as in sine-portfolio by d-sanoj (MIT), whose every letter is a Fourier series of hand-drawn strokes, an idea taken and none of its code; oscilloscope music (Jerobeam Fenderson), cited, not copied.',
  does: 'The letters are Fourier series of the font\'s own outlines: they sharpen from gist to crisp as terms are added, morph word to word, show the arms that draw them, and play as a sound that draws them on an oscilloscope.',
  params: { mode: "'outline' or 'band' (default outline): band rebuilds the word's picture as a 2D Fourier series, band by band", build: 'seconds from gist to crisp, 0.8 to 6 (default 2.6)', tol: 'pixels a dropped term may move the outline, 0.1 to 1 (default 0.25)', words: 'words to morph through, in order', machine: 'show the arms, true or false (default false)', renderer: "'gpu' or '2d' (default gpu, 2d when WebGL2 is missing)" },
};

let fontP = null;
export function loadFont(url = new URL('../../fonts/hanken-grotesk-bold.ttf', import.meta.url).href) {
  return fontP || (fontP = fetch(url).then((r) => { if (!r.ok) throw new Error(`fourier: font ${r.status}`); return r.arrayBuffer(); }).then(parseTTF).catch((e) => { console.error('lettering: fourier font failed, using the rendered outlines', e); return null; }));
}

const ease = (u) => { const v = clamp(u); return v * v * (3 - 2 * v); };
function rgba(c, a = 1) {
  const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; const s = x.fillStyle;
  if (s[0] === '#') return [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, a];
  const m = s.match(/[\d.]+/g).map(Number); return [m[0] / 255, m[1] / 255, m[2] / 255, (m[3] ?? 1) * a];
}

// Where the browser put each character, so the art sits under the real text: x of every character index.
function placer(g) {
  const probe = document.createElement('canvas').getContext('2d'), xs = [];
  for (const r of g.runs) {
    probe.font = r.font; if ('letterSpacing' in probe) probe.letterSpacing = r.spacing;
    // width(up to and with ch) minus width(ch) keeps the kerning before ch (F to o, for one)
    let prefix = ''; for (const ch of r.text) { prefix += ch; xs.push({ x: r.x + probe.measureText(prefix).width - probe.measureText(ch).width, y: r.y, em: r.em, ch }); }
  }
  return xs;
}

export async function create(g, env) {
  if (env.opts.mode === 'band') return createBand(g, env);
  const o = env.opts, k = env.k, tol = o.tol ?? 0.25, BUILD = o.build ?? 2.6, face = currentFace();
  const font = face?.id === 'hanken' ? await loadFont(o.font) : null;
  const xs = placer(g), text = xs.map((p) => p.ch).join(''), em = xs[0]?.em ?? g.size * g.scale, x0 = xs[0]?.x ?? 0, base = xs[0]?.y ?? g.baseline;
  const usable = font && [...text].every((ch) => !ch.trim() || font.has(ch));
  const layout = (word) => wordSeries(font, word, { em, x: x0, y: base });
  // the page's text first, laid where the browser set it (one run may wrap, so each character keeps its own x and y)
  const series0 = usable ? xs.flatMap((p, i) => (p.ch.trim() ? wordSeries(font, p.ch, { em: p.em, x: p.x, y: p.y }).map((s) => ({ ...s, at: i })) : [])) : loopSeries(g.loops);
  const words = usable && !env.reduced && Array.isArray(o.words) ? o.words.filter((w) => [...w].every((ch) => !ch.trim() || font.has(ch))) : [];
  const ink = rgba(env.theme.ink), accent = rgba(env.theme.accent);
  const R = makeRenderer(env.canvas, k, { prefer: o.renderer === '2d' ? '2d' : 'gpu' });

  const cut = (p) => cutPair(p, k, tol), still = (S) => S.map((s) => cut({ a: s.c, b: s.c }));
  let pairs = still(series0), morph = null, wordIx = -1, done = false, playing = null, scope = null;
  // every step of the word cycle is matched and cut here, at setup, so no frame pays for it
  const laid = words.map(layout), cycle = [series0, ...laid], steps = cycle.map((S, i) => pairUp(S, i + 1 < cycle.length ? cycle[i + 1] : series0).map(cut));
  const full = series0.reduce((n, s) => n + s.c.re.length, 0);
  const info = { renderer: R.kind, contours: series0.length, termsFull: full, termsKept: pairs.reduce((n, p) => n + p.a.re.length, 0), source: usable ? 'font' : 'rendered outline' };

  function polys(t, H) {
    // a settled contour (no morph under way, every term in) is traced once and kept: the machine's arms and the
    // pauses between words then cost nothing for the letters themselves
    return pairs.map((p) => {
      if (t === 0 && H >= p.a.re.length) return p.settled || (p.settled = trace(p.a, p.a.re.length, p.M));
      const c = t > 0 ? mix(p, t, p.mixed) : p.a; c.k = p.a.k; return trace(c, Math.min(H, c.re.length), p.M, p.buf);
    });
  }
  return {
    info, text,
    draw(_ctx, t) {
      R.begin();
      if (done) { R.fill(polys(0, Infinity), ink); return !!playing; }
      const build = ease(t / BUILD), H = 1.5 * Math.pow(2048 / 1.5, build), MACH = o.machine ? BUILD + 3 : BUILD;
      let tm = 0;
      if (t >= MACH && words.length) {
        if (!morph) morph = { t0: t + 1.6 };
        if (t >= morph.t0 && morph.pairs == null) { const next = (wordIx + 1) % (words.length + 1); morph.pairs = steps[wordIx + 1]; morph.next = next; pairs = morph.pairs; }
        if (morph.pairs) { tm = ease((t - morph.t0) / 1.6); if (tm >= 1) { wordIx = morph.next === words.length ? -1 : morph.next; pairs = morph.pairs.map((p) => ({ ...p, a: p.b, settled: null })); morph = { t0: t + 1.8 }; tm = 0; } }
      }
      const P = polys(tm, morph?.pairs ? Math.min(H, morphTerms(tm)) : H);
      if (scope) {
        R.fill(P, [ink[0], ink[1], ink[2], 0.14]);
        scope.L.getFloatTimeDomainData(scope.l); scope.R.getFloatTimeDomainData(scope.r);
        const s = [], m = scope.map; for (let i = 1; i < scope.l.length; i++) s.push(m.cx + scope.l[i - 1] * m.half, m.cy - scope.r[i - 1] * m.half, m.cx + scope.l[i] * m.half, m.cy - scope.r[i] * m.half);
        R.lines(s, accent); return true;
      }
      if (o.machine && t < MACH) {
        const u = (t / 3) % 1, fade = t > BUILD ? clamp((t - BUILD) / 3) : 0;
        R.fill(P, [ink[0], ink[1], ink[2], 0.18 + 0.82 * fade]);
        R.lines(machineSegs(pairs, tm, H, u, k), [accent[0], accent[1], accent[2], 0.55 * (1 - fade)]);
        R.lines(strip(P), [ink[0], ink[1], ink[2], 0.5 * (1 - fade)]);
        return true;
      }
      R.fill(P, ink);
      return t < BUILD || words.length > 0 || !!playing;
    },
    finish() { done = true; }, replay() { done = false; morph = null; wordIx = -1; pairs = still(series0); },
    // The word's XY sound: left x, right y, at 40 frames a second, sharpening over the first second. Call from a click.
    async play({ seconds = 3 } = {}) {
      const r = await playXY(pairs.map((p) => p.a), seconds, () => { playing = null; scope = null; done = true; });
      playing = r.src; scope = r.scope; done = false; return seconds;
    },
    stop() { try { playing?.stop(); } catch (e) { console.warn('lettering: fourier stop', e); } playing = null; scope = null; done = true; },
    // The settled letters as vector paths (nonzero fill), for print and export.
    svg() {
      const d = polys(0, Infinity).map((p) => { let s = `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`; for (let i = 2; i < p.length; i += 2) s += `L${p[i].toFixed(2)} ${p[i + 1].toFixed(2)}`; return s + 'Z'; }).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.w} ${g.h}" role="img"><title>${text.replace(/[&<>"]/g, '')}</title><path d="${d}" fill="${env.theme.ink}" fill-rule="nonzero"/></svg>`;
    },
    dispose() { this.stop(); R.dispose(); },
  };
}

// A drawable is a matched pair cut to the union of the terms that show at either end, with its point count (one
// point per 2.5 device pixels of outline) and the arms' order, all fixed at setup.
function cutPair(p, k, tol) {
  const ka = truncate(p.a, k, tol).keep, kb = truncate(p.b, k, tol).keep, a = { k: [], re: [], im: [] }, b = { k: [], re: [], im: [] };
  for (let j = 0; j < ka.length; j++) if (ka[j] || kb[j]) { a.k.push(p.a.k[j]); a.re.push(p.a.re[j]); a.im.push(p.a.im[j]); b.k.push(p.b.k[j]); b.re.push(p.b.re[j]); b.im.push(p.b.im[j]); }
  const f = (c) => ({ k: Int32Array.from(c.k), re: Float64Array.from(c.re), im: Float64Array.from(c.im) });
  const A = f(a), B = f(b), M = Math.round(clamp(Math.max(perimeter(A), perimeter(B)) * k / 2.5, 48, 768));
  return { a: A, b: B, M, order: armOrder(A), buf: new Float64Array(2 * M), mixed: { re: new Float64Array(A.re.length), im: new Float64Array(A.re.length) } };
}
const perimeter = (c) => { const q = trace(c, c.re.length, 64); let L = 0; for (let i = 0; i < 64; i++) { const j = (i + 1) % 64; L += Math.hypot(q[2 * j] - q[2 * i], q[2 * j + 1] - q[2 * i + 1]); } return L; };

// The machine: each contour's 32 largest arms at phase u, and the circles the 12 largest turn on.
function machineSegs(pairs, t, H, u, k) {
  const segs = [];
  for (const p of pairs) {
    const c = t > 0 ? mix(p, t, p.mixed) : p.a; c.k = p.a.k;
    const J = arms(c, H, u, p.order, 32);
    for (let i = 2; i < J.length; i += 2) {
      segs.push(J[i - 2], J[i - 1], J[i], J[i + 1]);
      const r = Math.hypot(J[i] - J[i - 2], J[i + 1] - J[i - 1]);
      if (i <= 24 && r * k > 3) for (let s = 0; s < 24; s++) { const a0 = (s / 24) * 6.2832, a1 = ((s + 1) / 24) * 6.2832; segs.push(J[i - 2] + r * Math.cos(a0), J[i - 1] + r * Math.sin(a0), J[i - 2] + r * Math.cos(a1), J[i - 1] + r * Math.sin(a1)); }
    }
  }
  return segs;
}
const strip = (P) => { const s = []; for (const p of P) for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; s.push(p[i], p[i + 1], p[j], p[j + 1]); } return s; };

// The word's XY sound (left x, right y) at 40 frames a second, sharpening over its first second, through the sound
// engine's limiter. Two analysers read the source itself (before the engine's DC blocker), and the oscilloscope
// draws from them. Must start from a click.
async function playXY(series, seconds, ended) {
  const { Engine } = await import('../../../sound/sound/engine.js');
  const E = await Engine.live(); E.mute(false); const ac = E.ctx, level = 0.45;
  const sig = xySignal(series, { sr: ac.sampleRate, seconds, H: (f, F) => 2 + Math.pow(2048, clamp(f / (F * 0.35))), gain: 0.7 });
  const n = sig.L.length, fadeN = Math.round(ac.sampleRate * 0.02), buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let i = 0; i < n; i++) { const w = Math.min(1, i / fadeN, (n - 1 - i) / fadeN) * level; sig.L[i] *= w; sig.R[i] *= w; }
  buf.copyToChannel(sig.L, 0); buf.copyToChannel(sig.R, 1);
  const src = ac.createBufferSource(), split = ac.createChannelSplitter(2), aL = ac.createAnalyser(), aR = ac.createAnalyser();
  aL.fftSize = aR.fftSize = 2048; src.buffer = buf; src.connect(E.master); src.connect(split); split.connect(aL, 0); split.connect(aR, 1);
  src.onended = () => { ended(); E.mute(true); };
  src.start();
  return { src, scope: { L: aL, R: aR, l: new Float32Array(2048), r: new Float32Array(2048), map: { ...sig.map, half: sig.map.half / level } } };
}

// Beyond outlines: the word's own picture (its coverage mask) as a 2D Fourier series, rebuilt band by band from the
// broad shape to the edges. Ink where the sum is positive; the overshoot past full ink and below zero (the ringing
// of the missing bands, the Gibbs effect) shows in the accent colour. Sixteen band images are made once at setup.
async function createBand(g, env) {
  // the picture is the word's box with a margin, so the grid's cells go to the letters and not the empty line
  const o = env.opts, BUILD = o.build ?? 2.6, b = g.bbox, m = Math.round(g.half * 2), bx = Math.max(0, b.x0 - m), by = Math.max(0, b.y0 - m), bw = Math.min(g.w, b.x1 + m) - bx, bh = Math.min(g.h, b.y1 + m) - by;
  const crop = new Float32Array(bw * bh); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) crop[y * bw + x] = g.mask[(y + by) * g.w + x + bx];
  const G = gridOf(crop, bw, bh, o.grid ?? 512), S = spectrum2d(G.img, G.W, G.H), STEPS = 16;
  const radii = Array.from({ length: STEPS }, (_, i) => Math.pow(S.maxRadius, (i + 1) / STEPS)), imgs = radii.map((r) => bandImage(S, r));
  const ctx = env.canvas.getContext('2d'), off = document.createElement('canvas'); off.width = G.W; off.height = G.H;
  const ox = off.getContext('2d'), id = ox.createImageData(G.W, G.H), ink = rgba(env.theme.ink), acc = rgba(env.theme.accent);
  let done = false;
  return {
    info: { renderer: '2d', grid: `${G.W} x ${G.H}`, bands: STEPS },
    draw(_c, t) {
      const u = done ? 1 : ease(t / BUILD), f = u * (STEPS - 1), i = Math.floor(f), w = f - i, A = imgs[i], B = imgs[Math.min(STEPS - 1, i + 1)];
      for (let p = 0; p < A.length; p++) {
        const v = A[p] + (B[p] - A[p]) * w, a = clamp(v), over = Math.min(1, Math.abs(v - a) * 3), q = 4 * p;
        id.data[q] = 255 * (ink[0] * (1 - over) + acc[0] * over); id.data[q + 1] = 255 * (ink[1] * (1 - over) + acc[1] * over); id.data[q + 2] = 255 * (ink[2] * (1 - over) + acc[2] * over); id.data[q + 3] = 255 * Math.max(a, over * 0.8);
      }
      ox.putImageData(id, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, env.canvas.width, env.canvas.height);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, bx * env.k, by * env.k, G.W * G.s * env.k, G.H * G.s * env.k);
      return !done && t < BUILD;
    },
    finish() { done = true; }, replay() { done = false; },
  };
}
