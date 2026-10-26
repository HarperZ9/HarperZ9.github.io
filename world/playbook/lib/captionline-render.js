// lib/captionline-render.js: two renderers for captionState.
//   mountCaptions(root, track, opts)   real text in the DOM: one span per word, <mark> for the claim span, <cite> for
//                                       the citation, <ol> for the log. Unshown words stay in the tree at opacity 0,
//                                       so the whole cue is selectable and readable by assistive tech.
//   drawCaptions(target, state, opts)  a raster frame for video export and goldens. target is a CanvasRenderingContext2D
//                                       (real glyphs through fillText) or a lib/raster.js image (node: greeked word bars at
//                                       x-height, the typesetter's proof, since node has no font rasteriser).
import { captionState } from '../captionline.js';
import { rect as rrect } from './raster.js';
import { hexToRgb } from './util.js';

export const INK = Object.freeze({ ink: '#eee9df', ground: '#0f0f0e', hot: '#e0177e', muted: '#a8a296' });
const SANS = '"Hanken Grotesk", system-ui, sans-serif', MONO = '"Conso", ui-monospace, monospace';

// Frame-relative type sizes: kinetic display about 8.5% of height, quote 4.5% (wiqaayat quotes sit at 4 to 5%),
// citation 2% (never under 12 px, QUALITY-SPEC T1), log 2.8% in mono.
export function sizes(h, mode) {
  return { kinetic: Math.max(28, h * 0.085), quote: Math.max(18, h * 0.045), cite: Math.max(12, h * 0.02), log: Math.max(13, h * 0.028) }[mode === 'cite' ? 'cite' : mode];
}

// --- raster
function painter(target) {
  if (target && typeof target.fillText === 'function') {
    const g = target;
    return {
      w: g.canvas.width, h: g.canvas.height,
      measure: (s, size, mono) => { g.font = `${mono ? 500 : 700} ${size}px ${mono ? MONO : SANS}`; return g.measureText(s).width; },
      rect: (x, y, w, h, c, a) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(x, y, w, h); g.globalAlpha = 1; },
      text: (s, x, y, size, c, a, mono) => { g.globalAlpha = a; g.fillStyle = c; g.font = `${mono ? 500 : 700} ${size}px ${mono ? MONO : SANS}`; g.fillText(s, x, y); g.globalAlpha = 1; },
    };
  }
  const im = target, adv = (s, size, mono) => (mono ? 0.56 : 0.54) * size * s.length;
  return {
    w: im.w, h: im.h, measure: adv,
    rect: (x, y, w, h, c, a) => rrect(im, x, y, x + w, y + h, hexToRgb(c), a),
    text: (s, x, y, size, c, a, mono) => { const xh = size * 0.52; rrect(im, x, y - xh, x + adv(s, size, mono) - size * 0.06, y, hexToRgb(c), a * 0.9); },
  };
}

function wrap(p, words, size, maxW, mono) {
  const sp = p.measure(' ', size, mono) || size * 0.27, lines = [[]]; let x = 0;
  for (const w of words) { const ww = p.measure(w.text, size, mono); if (x && x + ww > maxW) { lines.push([]); x = 0; } lines.at(-1).push({ w, x, ww }); x += ww + sp; }
  return lines;
}

export function drawCaptions(target, state, { ink = INK, ground = null } = {}) {
  const p = painter(target), { w, h } = p, mod = w / 9;
  if (ground) p.rect(0, 0, w, h, ground, 1);
  if (state.mode === 'kinetic') {
    const s = sizes(h, 'kinetic'), line = state.lines[0]; if (!line) return;
    const rows = wrap(p, line.words, s, w - 2 * mod, false);
    rows.forEach((row, r) => {
      const width = row.at(-1).x + row.at(-1).ww, x0 = (w - width) / 2, y = h * 0.6 + (r - (rows.length - 1) / 2) * s * 1.02;
      for (const { w: wd, x } of row) if (wd.on) {
        const col = wd.hot ? ink.hot : ink.ink, dy = wd.rise * s * 0.42 + wd.dy;
        p.text(wd.text, x0 + x + wd.dx, y + dy, s, col, 1 - 0.85 * wd.rise);
      }
    });
  } else if (state.mode === 'quote') {
    const line = state.lines[0]; if (!line || line.alpha <= 0) return;
    const s = sizes(h, 'quote'), cs = sizes(h, 'cite'), rows = wrap(p, line.words, s, Math.min(w - 2 * mod, s * 26), false), lh = s * 1.24;
    const y0 = h * 0.46 - ((rows.length - 1) * lh) / 2;
    rows.forEach((row, r) => { row.forEach(({ w: wd, x, ww }, k) => {
      const y = y0 + r * lh, next = row[k + 1], run = wd.hot && next && next.w.hot; // a hot run is one continuous inverse-video bar
      if (wd.hot) { const x0 = mod + x - (k && row[k - 1].w.hot ? 0 : s * 0.14), x1 = run ? mod + next.x : mod + x + ww + s * 0.14; p.rect(x0, y - s * 0.84, x1 - x0, s * 1.06, ink.hot, line.alpha); p.text(wd.text, mod + x, y, s, ink.ground, line.alpha); }
      else p.text(wd.text, mod + x, y, s, ink.ink, line.alpha);
    }); });
    if (line.cite) p.text(line.cite, mod, y0 + (rows.length - 1) * lh + s * 0.9 + cs * 1.4, cs, ink.muted, line.alpha, true);
  } else {
    const s = sizes(h, 'log'), lh = s * 1.5, maxW = w - 2 * mod - s * 3;
    const blocks = state.lines.map((l) => ({ l, rows: wrap(p, l.words, s, maxW, true) })), total = blocks.reduce((a, b) => a + b.rows.length, 0);
    let y = h - mod * 0.9 - (total - 1) * lh;
    for (const { l, rows } of blocks) {
      p.text(String(l.n).padStart(2, '0'), mod, y, s, ink.muted, l.alpha, true);
      rows.forEach((row, r) => { for (const { w: wd, x } of row) if (wd.on) p.text(wd.text, mod + s * 2.4 + x, y + r * lh, s, wd.hot ? ink.hot : ink.ink, l.alpha, true); });
      const last = rows.at(-1), lastOn = last.filter((c) => c.w.on).at(-1);
      if (l.cursor && lastOn) p.rect(mod + s * 2.4 + lastOn.x + lastOn.ww + s * 0.3, y + (rows.length - 1) * lh - s * 0.78, s * 0.55, s * 0.95, ink.hot, 1);
      y += rows.length * lh;
    }
  }
}

// --- DOM
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountCaptions(root, track, opts = {}) {
  const box = document.createElement('div'); box.className = `cl cl-${opts.mode || 'kinetic'}`; root.append(box);
  let key = '', spans = new Map(), lines = [];
  function build(st) {
    spans = new Map();
    if (st.mode === 'log') {
      box.innerHTML = `<ol class="cl-log">${st.lines.map((l) => `<li value="${l.n}">${l.words.map((w) => `<span data-i="${w.i}">${esc(w.text)}</span>`).join(' ')}</li>`).join('')}</ol>`;
    } else {
      const l = st.lines[0]; if (!l) { box.innerHTML = ''; return; }
      const words = l.words.map((w) => (w.hot ? `<mark data-i="${w.i}">${esc(w.text)}</mark>` : `<span data-i="${w.i}">${esc(w.text)}</span>`)).join(' ');
      box.innerHTML = st.mode === 'quote' ? `<blockquote><p>${words}</p>${l.cite ? `<cite>${esc(l.cite)}</cite>` : ''}</blockquote>` : `<p>${words}</p>`;
    }
    for (const el of box.querySelectorAll('[data-i]')) spans.set(+el.dataset.i, el);
    lines = [...box.querySelectorAll('li, blockquote')];
  }
  function update(t) {
    const st = captionState(track, t, opts);
    const k = st.mode + ':' + st.lines.map((l) => l.words.map((w) => w.i + (w.hotOn ? 'h' : '')).join(',')).join('|');
    if (k !== key) { key = k; build(st); }
    st.lines.forEach((l, li) => {
      if (lines[li]) lines[li].style.opacity = l.alpha;
      if (l.cursor !== undefined) { const last = l.words.filter((w) => w.on).at(-1); for (const w of l.words) spans.get(w.i)?.classList.toggle('cl-cur', !!l.cursor && w === last); }
      for (const w of l.words) { const el = spans.get(w.i); if (!el) continue;
        el.style.opacity = w.on ? 1 - 0.85 * w.rise : 0;
        el.style.transform = w.rise || w.dx || w.dy ? `translate(${w.dx.toFixed(2)}px, ${(w.rise * 0.42 + 0).toFixed(3)}em) translateY(${w.dy.toFixed(2)}px)` : '';
        if (w.hotOn !== undefined && w.hotOn !== null) el.classList.toggle('on', w.hotOn);
      }
    });
    if (!st.lines.length && box.innerHTML) { box.innerHTML = ''; key = ''; }
    return st;
  }
  return { el: box, update, destroy: () => box.remove() };
}
