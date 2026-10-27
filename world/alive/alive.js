// alive.js: the layer that makes every page alive without making it loud.
//
//   rhythm     one clock for the page. Every period is the bar (6.4 s, one slow breath) times a power of two, so a
//              breathing plate, a wiggle, a loop and the light all land together on the bar line.
//   budget     something is always gently alive (grain boils at 12 Hz, the light drifts once per 4 bars), and at
//              most `maxActive` lives move at once; when more are in view they take turns, one bar each.
//   response   pointer leans the camera, scroll nudges it, a long look (3 s) sends one pass of light over the
//              plate, and sound, when the visitor has turned it on, deepens the breath.
//   governor   only what is on screen runs; a hidden tab stops everything; each life re-renders only when its own
//              clock moves, and the frame budget (ms per frame) drops lives to twos before it drops frames.
//   rest       after 90 s without input the page calms to a quarter of its motion; any input wakes it.
//   access     prefers-reduced-motion and Plain view give one still frame per life; the Motion button pauses and
//              resumes everything and remembers the choice.
// Not here, by design: autoplaying sound, counters, streaks, infinite scroll, anything that rewards time spent.
import { LIVES } from './lives.js';

export const BAR = 6.4;
export const CONFIG = { maxActive: 4, maxActiveSmall: 2, budgetMs: 6, restAfterS: 90, restLevel: 0.25, dwellS: 3 };

const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window: the choice lasts this visit */ } } };

export class Rhythm {
  constructor() { this.t = 0; this.subs = new Set(); this.raf = 0; this.last = null; this.paused = false; this.still = false; }
  phase(period, offset = 0) { return (((this.t + offset) / period) % 1 + 1) % 1; }
  bar() { return Math.floor(this.t / BAR); }
  subscribe(fn) { this.subs.add(fn); this.wake(); return () => this.subs.delete(fn); }
  get running() { return !!this.raf; }
  wake() { if (!this.raf && !this.paused && !this.still && !document.hidden && this.subs.size) { this.last = null; this.schedule(); } }
  schedule() { this.raf = requestAnimationFrame((ms) => this.tick(ms)); }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  tick(ms) {
    this.raf = 0; const dt = this.last === null ? 0 : Math.min(0.1, (ms - this.last) / 1000); this.last = ms; this.t += dt;
    for (const f of this.subs) { try { f(this.t, dt); } catch (e) { console.error('alive: a subscriber failed and was removed', e); this.subs.delete(f); } }
    if (!this.paused && !this.still && !document.hidden && this.subs.size) this.schedule();
  }
}

export class Alive {
  constructor(root = document) {
    this.root = root; this.rhythm = new Rhythm(); this.lives = []; this.level = 1; this.sound = 0; this.lastInput = 0;
    this.frameMs = 0; this.turn = 0; this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.html = document.documentElement;
  }
  async start() {
    if (!document.querySelector('link[data-alive-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./alive.css', import.meta.url).href; l.dataset.aliveCss = ''; document.head.appendChild(l); }
    const found = window.UIShell?.livingSlots ? window.UIShell.livingSlots() : [...this.root.querySelectorAll('[data-alive]')];
    if (!this.root.querySelector('[data-alive~="grain"]') && this.html.dataset.aliveGrain !== 'off') {
      const g = await LIVES.grain(document.body, this); if (g) this.lives.push(Object.assign(g, { el: document.body, kind: 'grain', visible: true, ms: 0.2, lastKey: null, dwell: 0, page: true }));
    }
    // A slot is born when it first comes within about a screen of the viewport, so lazy images and heavy setup
    // (depth estimates, sheet slicing, decoding) cost nothing for parts of the page nobody reaches.
    this.io = new IntersectionObserver((es) => { for (const e of es) for (const l of this.lives) if (l.el === e.target) { l.visible = e.isIntersecting; l.area = e.intersectionRect.width * e.intersectionRect.height; } this.rhythm.wake(); }, { rootMargin: '10% 0px' });
    this.births = []; const born = new Set();
    const nursery = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && !born.has(e.target)) { born.add(e.target); nursery.unobserve(e.target); this.births.push(this.birth(e.target)); } }, { rootMargin: '100% 0px' });
    for (const el of found) nursery.observe(el);
    this.observe(); this.listen(); this.controls();
    this.rhythm.paused = store.get('alive.paused') === '1';
    if (window.UIShell?.setClock) window.UIShell.setClock(this.rhythm);
    this.rhythm.subscribe((t, dt) => this.frame(t, dt));
    this.applyStill(); this.lastInput = performance.now();
    return this;
  }
  get stillMode() { return (this.reduced.matches && store.get('alive.override') !== '1') || this.html.classList.contains('plain'); }
  async birth(el) {
    if (el.tagName === 'IMG' || el.querySelector('img[loading="lazy"]')) for (const i of (el.tagName === 'IMG' ? [el] : el.querySelectorAll('img[loading="lazy"]'))) i.loading = 'eager';
    for (const kind of el.dataset.alive.split(/\s+/)) {
      const make = LIVES[kind]; if (!make) { console.warn(`alive: no life called "${kind}"`); continue; }
      try {
        const t0 = performance.now(), life = await make(el, this); if (!life) continue;
        this.lives.push(Object.assign(life, { el, kind, visible: false, ms: 1, lastKey: null, dwell: 0, bornMs: +(performance.now() - t0).toFixed(1) }));
        if (this.stillMode || this.rhythm.paused) life.rest?.();
      } catch (e) { console.error(`alive: ${kind} failed on`, el, e); }
    }
    this.io.observe(el); this.rhythm.wake();
  }
  // Resolves when every slot that has come into range is alive (tests and recordings wait on it).
  async settled() { let n = -1; while (n !== this.births.length) { n = this.births.length; await Promise.all(this.births); } return this; }
  observe() {
    document.addEventListener('visibilitychange', () => (document.hidden ? this.rhythm.stop() : this.rhythm.wake()));
    this.reduced.addEventListener('change', () => this.applyStill());
    new MutationObserver(() => this.applyStill()).observe(this.html, { attributes: true, attributeFilter: ['class'] });
  }
  listen() {
    const input = () => { this.lastInput = performance.now(); };
    addEventListener('pointermove', (e) => { input(); this.pointer = [e.clientX, e.clientY]; }, { passive: true });
    addEventListener('scroll', () => { input(); const y = scrollY; this.scrollV = (y - (this.lastY ?? y)); this.lastY = y; }, { passive: true });
    addEventListener('keydown', input); addEventListener('pointerdown', input);
    document.addEventListener('alive:sound', (e) => { this.sound = Math.max(0, Math.min(1, e.detail?.level ?? 0)); });
  }
  controls() {
    let b = document.querySelector('[data-alive-toggle]');
    if (!b) {
      const host = document.querySelector('.rail .console') || document.querySelector('.rail') || document.body;
      b = document.createElement('button'); b.type = 'button'; b.className = 'stamp-btn alive-btn'; b.dataset.aliveToggle = ''; b.textContent = 'Motion';
      host.appendChild(b);
    }
    const sync = () => b.setAttribute('aria-pressed', String(!this.rhythm.paused && !this.stillMode));
    b.addEventListener('click', () => {
      if (this.stillMode && this.reduced.matches) { const on = store.get('alive.override') !== '1'; store.set('alive.override', on ? '1' : '0'); this.rhythm.paused = !on; }
      else this.rhythm.paused = !this.rhythm.paused;
      store.set('alive.paused', this.rhythm.paused ? '1' : '0'); this.applyStill(); sync();
    });
    this.syncButton = sync; sync();
  }
  applyStill() {
    const still = this.stillMode || this.rhythm.paused;
    this.rhythm.still = this.stillMode;
    this.html.classList.toggle('alive-still', still);
    for (const l of this.lives) { try { (still ? l.rest : l.resume)?.call(l); } catch (e) { console.error('alive: rest failed', l.kind, e); } }
    if (still) this.rhythm.stop(); else this.rhythm.wake();
    this.syncButton?.();
  }
  // One frame: pick the lives that may move, render those whose clock moved, inside the budget.
  frame(t, dt) {
    const idle = (performance.now() - this.lastInput) / 1000;
    const target = idle > CONFIG.restAfterS ? CONFIG.restLevel : 1;
    this.level += (target - this.level) * Math.min(1, dt / (target < this.level ? 6 : 1.5));
    this.scrollV = (this.scrollV || 0) * 0.85;
    const small = innerWidth < 600, max = small ? CONFIG.maxActiveSmall : CONFIG.maxActive;
    const vis = this.lives.filter((l) => l.visible && !l.page).sort((a, b) => (b.priority || 1) * (b.area || 0) - (a.priority || 1) * (a.area || 0));
    const bar = this.rhythm.bar(), active = new Set(vis.length <= max ? vis : [...Array(max)].map((_, i) => vis[(i + bar) % vis.length]));
    const ctx = { t, dt, level: this.level, sound: this.sound, scroll: this.scrollV, pointer: this.pointer, rhythm: this.rhythm, small };
    let spent = 0; const start = performance.now();
    for (const l of [...this.lives.filter((x) => x.page), ...vis]) {
      if (!l.page && !active.has(l)) { if (l.lastKey !== 'held') { l.rest?.(); l.lastKey = 'held'; } continue; }
      this.dwellOf(l, dt);
      const key = l.key ? l.key(t, ctx) : t; if (key === l.lastKey) continue;
      if (spent + l.ms > CONFIG.budgetMs && l.lastKey !== null && !l.page) { continue; } // over budget: this life waits a frame
      const s = performance.now();
      try { l.render(t, ctx); } catch (e) { console.error('alive: render failed, life stopped', l.kind, e); l.visible = false; }
      const took = performance.now() - s; l.ms = l.ms * 0.8 + took * 0.2; spent += took; l.lastKey = key;
    }
    this.frameMs = performance.now() - start;
  }
  dwellOf(l, dt) {
    if (!this.pointer || !l.onDwell) return;
    const r = l.el.getBoundingClientRect(), [x, y] = this.pointer, inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    l.dwell = inside ? l.dwell + dt : 0;
    if (l.dwell >= CONFIG.dwellS && !l.dwelt) { l.dwelt = true; l.onDwell(); } else if (!inside) l.dwelt = false;
  }
  stats() { return { lives: this.lives.map((l) => ({ kind: l.kind, visible: l.visible, ms: +l.ms.toFixed(2), bornMs: l.bornMs })), frameMs: +this.frameMs.toFixed(2), level: +this.level.toFixed(2), t: +this.rhythm.t.toFixed(2) }; }
}

// Auto start when loaded as a module on a page, unless the page opts out with <html data-alive-auto="off">.
if (typeof document !== 'undefined' && document.documentElement.dataset.aliveAuto !== 'off') {
  const go = () => new Alive().start().then((a) => { window.Alive = a; document.dispatchEvent(new CustomEvent('alive:ready', { detail: a })); }).catch((e) => console.error('alive: start failed', e));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
}
