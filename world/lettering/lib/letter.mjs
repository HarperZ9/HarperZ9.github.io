// lib/letter.mjs: one API for letters built from our own techniques.
//
//   const d = letter('Low Water', 'rope', { seed: 4 });
//   await d.mount(h1);          // h1 keeps its real text (selectable, read aloud, searchable); the art draws beneath it
//   await d.mount(canvas);      // or draw into a canvas you own
//   d.svg()                     // the finished state as SVG (vector where the technique is vector)
//   d.finish(); d.replay();     // jump to the end, or start again
//   d.stats                     // setup ms and per-frame ms (mean, p95, max) measured on this machine
//
// Or declaratively: <h2 data-letter="engraved">Zain Dana Harper</h2> and upgrade(document).
// Rules every technique keeps: the real text node stays; reduced motion shows the finished state; the same seed draws
// the same letters; a frame after setup stays under the 4 ms budget (measured here, reported in stats).
import { glyphFromElement, glyphFromText, ensureFont } from './glyph.mjs';
import { rng, hashString } from './paint.mjs';

export const TECHNIQUES = ['engraved', 'torn', 'rope', 'raked', 'developed', 'light', 'glyphcell', 'swarm', 'chladni', 'nightlights', 'sound', 'data', 'sprayed', 'painted'];
const mods = {};
// Techniques that live outside this folder register a loader here (feed set 30 does, from its own build). The
// loader returns a module with the same { meta, create } shape; letter() and upgrade() then accept the id.
const external = new Map();
export function registerTechnique(id, loader) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || typeof loader !== 'function') throw new Error(`lettering: registerTechnique needs a lower-case id and a loader (got "${id}")`);
  if (!TECHNIQUES.includes(id)) TECHNIQUES.push(id);
  external.set(id, loader); delete mods[id];
}
const load = id => mods[id] || (mods[id] = external.has(id) ? Promise.resolve(external.get(id)()) : import(`./techniques/${id}.mjs`));
export const techniqueMeta = async id => (await load(id)).meta;

const reducedQ = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = () => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 3);

let styled = false;
function injectStyle() {
  if (styled || typeof document === 'undefined') return; styled = true;
  const s = document.createElement('style'); s.dataset.lettering = '';
  s.textContent = `.lt-host{position:relative;isolation:isolate}
.lt-host.lt-on{color:transparent;-webkit-text-fill-color:transparent}
.lt-host.lt-on::selection,.lt-host.lt-on *::selection{color:var(--lt-select,currentColor);-webkit-text-fill-color:var(--lt-select-ink,#000);background:var(--lt-select-bg,rgba(255,214,120,.55))}
canvas.lt-art{position:absolute;z-index:-1;pointer-events:none;display:block}
@media (forced-colors:active){.lt-host.lt-on{color:CanvasText;-webkit-text-fill-color:CanvasText}canvas.lt-art{display:none}}
@media print{.lt-host.lt-on{color:#000;-webkit-text-fill-color:#000}canvas.lt-art{display:none}}
html.plain .lt-host.lt-on{color:inherit;-webkit-text-fill-color:currentColor}html.plain canvas.lt-art{display:none}`;
  document.head.append(s);
}

// One animation loop for every lettering on the page. Only visible, still-moving letterings draw.
const live = new Set(); let raf = 0;
function tick(now) {
  raf = 0; let any = false;
  for (const d of live) { if (d._visible && d._moving) { d._frame(now / 1000); any = true; } }
  if (any) raf = requestAnimationFrame(tick);
}
const wake = () => { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick); };

class Lettering {
  constructor(text, technique, opts = {}) {
    if (!TECHNIQUES.includes(technique)) throw new Error(`lettering: unknown technique "${technique}"`);
    this.text = text; this.technique = technique; this.opts = opts;
    this.seed = opts.seed ?? hashString(technique + ':' + text);
    this.reduced = opts.reduced ?? reducedQ();
    this.stats = { setupMs: 0, glyphMs: 0, frames: 0, ms: [], get meanMs() { return mean(this.ms); }, get p95Ms() { return pct(this.ms, 0.95); }, get maxMs() { return this.ms.length ? Math.max(...this.ms) : 0; } };
    this._visible = true; this._moving = false; this._t0 = null;
  }

  async _build(el, canvas) {
    const t0 = performance.now(), M = await load(this.technique);
    this.meta = M.meta;
    const scale = this.opts.scale ?? M.meta.workScale ?? 1;
    const gopt = { scale, pad: this.opts.pad, size: this.opts.size, weight: this.opts.weight ?? M.meta.weight, tracking: this.opts.tracking, skeleton: this.opts.skeleton, face: this.opts.face };
    this.glyph = el ? await glyphFromElement(el, gopt) : await glyphFromText(this.text, gopt);
    this.stats.glyphMs = performance.now() - t0;
    const G = this.glyph, dpr = DPR(), k = (dpr / scale) * (this.opts.resolution ?? 1);
    canvas.width = Math.round(G.w * k); canvas.height = Math.round(G.h * k);
    this.canvas = canvas; this.k = k;
    const theme = readTheme(el || canvas, this.opts);
    this.env = { seed: this.seed, rng: rng(this.seed), reduced: this.reduced, theme, k, canvas, opts: this.opts, host: el, base: new URL('./', import.meta.url).href };
    this.ctx = M.meta.renderer === 'webgl' ? null : canvas.getContext('2d');
    this.impl = await M.create(G, this.env);
    if (this.impl.failed) console.error(`lettering: ${this.technique} could not start: ${this.impl.failed}`);
    this.stats.setupMs = performance.now() - t0;
    if (this.reduced || this._finished) this.impl.finish?.();
    this._t0 = null; this._moving = true; live.add(this); wake();
    if (this.reduced || this._finished) this._frame(performance.now() / 1000);
    return this;
  }

  // Draw one frame at absolute time `now` (seconds). Measures only the technique's own work.
  _frame(now) {
    if (!this.impl) return;
    if (this._t0 === null) this._t0 = now;
    const t = now - this._t0, a = performance.now();
    if (this.ctx) { this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0); }
    const more = this.impl.draw(this.ctx, this.reduced ? 1e6 : t);
    const ms = performance.now() - a;
    if (this.stats.ms.length >= 900) this.stats.ms.shift();
    this.stats.ms.push(ms); this.stats.frames++;
    this._moving = !!more && !this.reduced;
  }

  async mount(target) {
    injectStyle(); await ensureFont();
    if (target instanceof HTMLCanvasElement) { this.ready = this._build(null, target); return this.ready; }
    const el = target; el.classList.add('lt-host');
    if (!el.hasAttribute('data-letter')) el.dataset.letter = this.technique;
    let cv = el.querySelector(':scope > canvas.lt-art');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'lt-art'; cv.setAttribute('aria-hidden', 'true'); el.prepend(cv); }
    this.host = el;
    await (this.ready = this._build(el, cv));
    this._place();
    el.classList.add('lt-on');
    this._observe();
    return this;
  }

  _place() {
    const G = this.glyph, cv = this.canvas, pad = G.pad ?? 0;
    Object.assign(cv.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${G.cssWidth}px`, height: `${G.cssHeight}px` });
  }

  _observe() {
    const el = this.host;
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(es => { for (const e of es) { this._visible = e.isIntersecting; if (this._visible) wake(); } }, { rootMargin: '120px' });
      this._io.observe(el);
    }
    let last = el.getBoundingClientRect(), timer = 0;
    this._ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect(); if (Math.abs(r.width - last.width) < 2 && Math.abs(r.height - last.height) < 2) return;
      last = r; clearTimeout(timer); timer = setTimeout(() => this.rebuild(), 160);
    });
    this._ro.observe(el);
    const map = e => { const r = el.getBoundingClientRect(), s = this.glyph.scale, p = this.glyph.pad ?? 0; return [(e.clientX - r.left + p) * s, (e.clientY - r.top + p) * s]; };
    if (this.impl.pointer) {
      el.addEventListener('pointermove', e => { const [x, y] = map(e); this.impl.pointer(x, y, true); this._moving = true; wake(); });
      el.addEventListener('pointerleave', () => { this.impl.pointer(0, 0, false); this._moving = true; wake(); });
    }
  }

  // Frame cost without the browser's frame clock: replay the animation at a fixed 60 Hz in synthetic time and time
  // each frame's own work. For WebGL techniques a one-pixel readback waits for the GPU, so GPU time is included.
  // Returns { frames, meanMs, p95Ms, maxMs, gpuSync }. The lettering is left in its finished state.
  bench(seconds = 8, fps = 60) {
    if (!this.impl) throw new Error('lettering: bench before mount');
    const gl = this.ctx ? null : this.canvas.getContext('webgl2'), px = new Uint8Array(4), ms = [];
    this.impl.replay?.();
    for (let f = 0; f <= seconds * fps; f++) {
      const a = performance.now();
      if (this.ctx) this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      const more = this.impl.draw(this.ctx, f / fps);
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      ms.push(performance.now() - a);
      if (!more && f > fps) break;
    }
    this.impl.finish?.(); this._frame(performance.now() / 1000);
    return { frames: ms.length, meanMs: mean(ms), p95Ms: pct(ms, 0.95), maxMs: Math.max(...ms), gpuSync: !!gl };
  }

  // Hold the animation at time t (seconds): replay and step at 60 Hz to t, then stop the clock there. For stills
  // that show a build in progress (the decode front, a rope mid-pull).
  seek(t) {
    if (!this.impl) throw new Error('lettering: seek before mount');
    this.impl.replay?.(); this._finished = false;
    for (let f = 0; f <= Math.round(t * 60); f++) { if (this.ctx) this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0); this.impl.draw(this.ctx, f / 60); }
    this._moving = false;
  }

  async rebuild() { if (!this.host) return; live.delete(this); this.impl?.dispose?.(); await this._build(this.host, this.canvas); this._place(); }
  // Call a technique's own method (sound's play, for one) and keep the frame loop running while it acts.
  async act(name, ...args) { const f = this.impl?.[name]; if (typeof f !== 'function') throw new Error(`lettering: ${this.technique} has no ${name}()`); const r = await f.apply(this.impl, args); this._moving = true; wake(); return r; }
  // Jump to the finished state and draw it now (not on the next frame), so a still or a screenshot shows the end.
  finish() { if (!this.impl) return; this._finished = true; this.impl.finish?.(); this._frame(performance.now() / 1000); this._moving = !this.reduced; wake(); }
  replay() { if (this.reduced) return; this._finished = false; this.impl?.replay ? this.impl.replay() : null; this._t0 = null; this._moving = true; wake(); }
  // SVG of the finished state. Vector techniques return paths; raster ones embed their finished canvas as an image.
  svg() {
    const G = this.glyph, title = esc(this.text);
    if (this.impl?.svg) return this.impl.svg();
    this.impl?.finish?.(); this._frame(performance.now() / 1000);
    const url = this.canvas.toDataURL('image/png');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G.w} ${G.h}" role="img"><title>${title}</title><image href="${url}" width="${G.w}" height="${G.h}"/></svg>`;
  }
  destroy() { live.delete(this); this._io?.disconnect(); this._ro?.disconnect(); this.impl?.dispose?.(); this.canvas?.remove(); this.host?.classList.remove('lt-on'); }
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function pct(a, p) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }

// Colours come from the host's CSS custom properties, so a lettering follows the page's light and dark themes.
function readTheme(el, o) {
  const cs = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  const v = (n, d) => (o[n] ?? (cs && cs.getPropertyValue(`--letter-${n}`).trim())) || d;
  const dark = cs ? luminance(cs.color) > 0.5 : false;
  return { dark, ink: v('ink', cs ? cs.color : '#15130f'), ground: v('ground', dark ? '#0b0a0c' : '#f1ebdd'), paper: v('paper', '#efe8d8'), accent: v('accent', '#e6a03c') };
}
function luminance(c) { const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return 0; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

export function letter(text, technique, opts) { return new Lettering(text, technique, opts); }

// Upgrade every [data-letter] element under root. data-seed and data-* options pass through as opts.
export async function upgrade(root = document, opts = {}) {
  const els = [...root.querySelectorAll('[data-letter]')].filter(el => TECHNIQUES.includes(el.dataset.letter));
  const out = [];
  for (const el of els) { const d = letter(el.textContent.trim(), el.dataset.letter, { ...opts, seed: el.dataset.seed ? Number(el.dataset.seed) : undefined }); out.push(d); try { await d.mount(el); } catch (e) { console.error(`lettering: ${el.dataset.letter} failed`, e); } }
  return out;
}

if (typeof window !== 'undefined') window.__lettering = { live, letter, upgrade };
