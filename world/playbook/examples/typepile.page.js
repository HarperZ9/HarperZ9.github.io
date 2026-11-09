// The typepile example: the author's sentence about marrying ideas falls out of its own glyph-cell field, piles up,
// packs into the numeral of how many pieces it holds, then sorts itself by word length. Generators combined:
// typepile.js and cadence.js (this folder), substrate grain, and the studio's codecells plate (studio), which draws the
// sentence as a field of cells, one per character. A cell goes dark when its word leaves the field, so the field
// and the pile always hold the same sentence between them.
import { Pile, bodiesFrom, INKS } from '../typepile.js';
import { Cadence } from '../cadence.js';
import { hash01, reducedMotion } from '../lib/util.js';
import { renderImage, toRGBA } from '../../studio/lib/lanes/image.mjs';
import { CODE_MATERIAL } from '../../studio/lib/materials.mjs';
import { context2d, grainTile, applyGrain } from '../../substrate/lib/raster.mjs';

const QUOTE = 'we should really try and make it our own, and marry ideas and IP across many references and sources, in order to join and merge closed IP, and metamorphosize it into beautiful new ideas, techniques, protocols, and design and engineering approaches. the double edged sword can be used for masterful joining and marriage of ideas and even for repurposing siloed material, and ideas';
const TOKENS = QUOTE.match(/[\p{L}\p{N}-]+|[.,]/gu), HOT = TOKENS.indexOf('metamorphosize');
const stage = document.querySelector('.stage'), ground = document.getElementById('ground'), cv = document.getElementById('pile'), layer = document.getElementById('words');
const PILLS = [INKS.ink, INKS.bone, INKS.slate, INKS.ochre];

let pile, spans, cells, W, H, DPR, size, ctx, cad;

// One cell per character of the sentence; words map to their character runs so a released word can go dark.
function field() {
  const n = QUOTE.length, cols = Math.ceil(Math.sqrt((n * W) / H) * 1.02), rows = Math.ceil(n / cols), tone = new Float32Array(cols * rows), kind = new Uint8Array(cols * rows);
  for (let i = 0; i < n; i++) { const ch = QUOTE[i]; tone[i] = ch === ' ' ? 0 : /[.,]/.test(ch) ? 0.9 : 0.42 + 0.3 * hash01(3, i); kind[i] = /[.,]/.test(ch) ? 2 : 0; }
  const runs = []; let at = 0; for (const t of TOKENS) { const k = QUOTE.indexOf(t, at); runs.push([k, k + t.length]); at = k + t.length; }
  const pitch = Math.min(W / cols, H / rows); return { cols, rows, tone, kind, runs, pitch, ox: (W - pitch * cols) / 2, oy: (H - pitch * rows) / 2 };
}

function paintGround() {
  const m = { ...CODE_MATERIAL, palette: { ground: INKS.ground, ink: '#34322d', accent: '#5d584e' } };
  const L = renderImage(m, { w: ground.width, h: ground.height, seed: 4, drive: { cells: cells }, marks: true });
  context2d(ground).putImageData(new ImageData(toRGBA(L, m, { dpr: DPR }), ground.width, ground.height), 0, 0);
  applyGrain(context2d(ground), ground.width, ground.height, grainTile({ size: 256, sd: 1.5, clump: 2, seed: 41 })); // clumped grain over the field (R4)
}

function build() {
  const box = stage.getBoundingClientRect(); W = Math.round(box.width); H = Math.round(box.height); DPR = Math.min(3, devicePixelRatio || 1);
  for (const c of [ground, cv]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  ctx = context2d(cv); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  size = W < 700 ? 13 : 19; cells = field(); paintGround();
  const probe = document.createElement('canvas').getContext('2d'); probe.font = `600 ${size}px "Hanken Grotesk"`;
  pile = new Pile(bodiesFrom(TOKENS, { size, measure: (w) => probe.measureText(w).width, hot: HOT }), { w: W, h: H, seed: 7, gravity: 2600 });
  layer.style.fontSize = size + 'px';
  if (!spans) { spans = TOKENS.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }); spans.forEach((s, i) => { layer.append(s); if (i < spans.length - 1) layer.append(' '); }); }
  // each span is its own body: a capsule of the body's exact length and thickness, so the word sits on a real CSS
  // background (contrast is measurable) and the DOM text is the picture, not a label over it
  spans.forEach((s, i) => {
    const b = pile.b[i], ext = b.len + 2 * b.r;
    s.className = b.hot ? 'hot' : b.kind === 'disc' ? 'dot' : '';
    Object.assign(s.style, { width: ext + 'px', height: 2 * b.r + 'px', lineHeight: 2 * b.r + 'px', borderRadius: (b.kind === 'box' ? 2 : b.r) + 'px', background: b.hot ? INKS.hot : PILLS[Math.floor(hash01(pile.seed, b.i) * PILLS.length)] });
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = INKS.ground; ctx.globalAlpha = 0.9; // cells of released words go dark
  const { pitch, ox, oy, cols, runs } = cells; // released words leave dark cells behind
  pile.b.forEach((b, k) => { if (!b.released) return; for (let i = runs[k][0]; i < runs[k][1]; i++) ctx.fillRect(ox + (i % cols) * pitch, oy + Math.floor(i / cols) * pitch, pitch, pitch); });
  ctx.globalAlpha = 1;
  // text upright within a half turn; a span is touched only when its pose string changes (resting words cost nothing)
  pile.poses().forEach((p, i) => {
    const s = spans[i], a = ((((p.angle + Math.PI / 2 + 0.2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2 - 0.2; // verticals read bottom to top
    const tf = p.visible ? `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${a.toFixed(2)}rad) translate(-50%,-50%)` : '';
    if (s.__tf !== tf) { s.__tf = tf; s.style.transform = tf; s.style.opacity = p.visible ? 1 : 0; }
  });
}

const MODES = ['drop', 'count', 'sort'];
function start() {
  cad = new Cadence({ clocks: { mode: { fps: 10, holds: [80, 70, 60] }, rel: 'twos-24' }, seed: 7 });
  let released = 0;
  cad.subscribe({
    layout: 'mode', texture: 'rel', update: (dt) => pile.step(dt), draw,
    onLayout(st) { const m = MODES[st.index % 3]; if (m === 'drop' && st.index > 0) { build(); released = 0; } pile.setMode(m); },
    onTexture() { if (pile.mode === 'drop' && released < pile.b.length) pile.release(released++); },
  });
  let last = null; const tick = (now) => { cad.advance(last === null ? 0 : (now - last) / 1000); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

async function main() {
  await document.fonts.load(`600 19px "Hanken Grotesk"`); build();
  if (reducedMotion()) { pile.setMode('count'); for (let i = 0; i < 1200; i++) pile.step(1 / 120); draw(); return; }
  start();
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); pile.setMode(MODES[cad.state().mode.index % 3]); if (pile.mode === 'drop') pile.releaseAll(); }, 200); });
}
main().catch((e) => console.error('typepile page:', e));
