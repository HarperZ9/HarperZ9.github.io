// shader-shelf.mjs: the preset library as a shelf you browse, as the Retro Studio had it: a filter that matches a
// preset's name or its group, previous and next, a jump to a random one, and a contact sheet that draws every preset as a
// still through one shared WebGL runner (254 live contexts would pass the browser's limit long before the sheet ends).
// Also the studio's Copy link: a link that carries only the shader, apart from the room's full address.
import { createShaderRunner } from '../../../system/shader-runner.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function shelfHtml(n) {
  return `<label for="shd-pre-filter">Filter the library</label><input type="text" id="shd-pre-filter" placeholder="eva, psx, ink, audio" spellcheck="false" autocomplete="off">
<p class="shd-row"><button type="button" id="shd-pre-prev" aria-label="The previous preset">Previous</button> <button type="button" id="shd-pre-next" aria-label="The next preset">Next</button> <button type="button" id="shd-pre-lucky">Any one</button> <button type="button" id="shd-sheet-toggle" aria-expanded="false" aria-controls="shd-sheet">Show every preset as a still</button></p>
<p class="shd-pre-count" role="status" aria-live="polite">${n} on the shelf.</p><div class="shd-sheet" id="shd-sheet" hidden></div>`;
}
// The <select>'s groups for a filter, each preset by its name; an empty filter is the whole library.
export function shelfOptions(library, term = '') {
  const q = term.trim().toLowerCase(), groups = new Map();
  for (const p of library) { if (q && !`${p.name} ${p.group}`.toLowerCase().includes(q)) continue; (groups.get(p.group) ?? groups.set(p.group, []).get(p.group)).push(p); }
  const count = [...groups.values()].reduce((s, l) => s + l.length, 0);
  return { count, html: `<option value="">Choose a preset</option>${[...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((p) => `<option>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}` };
}

// room: { library, select() (the preset select), pick(name), say(text), shareLink() }
export function wireShelf(host, room) {
  const $ = (s) => host.querySelector(s);
  let thumb = null, io = null, built = false;
  const names = () => [...room.select().querySelectorAll('option')].map((o) => o.value || o.textContent).filter((v) => v && v !== 'Choose a preset');
  function choose(name, words) { const sel = room.select(); sel.value = name; room.pick(name); $('.shd-pre-count').textContent = words; }
  function step(d) {
    const list = names(); if (!list.length) return;
    const at = list.indexOf(room.select().value), next = list[((at < 0 ? (d > 0 ? -1 : 0) : at) + d + list.length) % list.length];
    choose(next, `${next}.`);
  }
  function paint(cell, p) {
    if (!thumb) { const c = document.createElement('canvas'); c.width = 168; c.height = 168; const r = createShaderRunner(c, p.glsl); thumb = r.ok || r.gl ? r : null; }
    if (!thumb) return; const res = thumb.setSource(p.glsl); if (!res?.ok) { cell.dataset.failed = 'true'; return; }
    thumb.renderFrame(6.5); const g = cell.querySelector('canvas').getContext('2d'); try { g.drawImage(thumb.canvas, 0, 0, 84, 84); } catch (e) { console.error('shader room: a still did not draw', e); }
  }
  function build() {
    if (built) return; built = true; const sheet = $('#shd-sheet');
    sheet.innerHTML = room.library.map((p, i) => `<button type="button" data-sheet="${i}" aria-pressed="false" aria-label="Load the preset ${esc(p.name)}" title="${esc(p.name)}"><canvas width="84" height="84"></canvas><span>${esc(p.name)}</span></button>`).join('');
    const cells = [...sheet.querySelectorAll('[data-sheet]')];
    io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); const c = e.target; requestAnimationFrame(() => paint(c, room.library[+c.dataset.sheet])); } }, { root: sheet, rootMargin: '120px' }) : null;
    for (const c of cells) if (io) io.observe(c); else paint(c, room.library[+c.dataset.sheet]);
  }
  function onInput(ev) {
    if (ev.target.id !== 'shd-pre-filter') return false;
    const { count, html } = shelfOptions(room.library, ev.target.value), sel = room.select(), was = sel.value; sel.innerHTML = html; sel.value = was;
    $('.shd-pre-count').textContent = ev.target.value.trim() ? `${count} of ${room.library.length} match.` : `${room.library.length} on the shelf.`; return true;
  }
  async function onClick(ev) {
    const b = ev.target.closest('button'); if (!b) return false;
    if (b.id === 'shd-pre-prev') step(-1); else if (b.id === 'shd-pre-next') step(1);
    else if (b.id === 'shd-pre-lucky') { const list = names(); if (list.length) { const n = list[Math.floor(Math.random() * list.length)]; choose(n, `Any one: ${n}.`); } }
    else if (b.id === 'shd-sheet-toggle') { const sheet = $('#shd-sheet'), open = sheet.hidden; sheet.hidden = !open; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Hide the stills' : 'Show every preset as a still'; $('.shd-pre-count').textContent = open ? `Every preset as a still: ${room.library.length}. Each draws as it scrolls into view.` : `${room.library.length} on the shelf.`; if (open) build(); }
    else if (b.dataset.sheet !== undefined) { const p = room.library[+b.dataset.sheet]; for (const c of host.querySelectorAll('[data-sheet]')) c.setAttribute('aria-pressed', String(c === b)); choose(p.name, `${p.name}.`); }
    else if (b.id === 'shd-share') {
      const url = await room.shareLink();
      try { await navigator.clipboard.writeText(url); room.say('A link to this shader is copied.'); } catch { room.say(`A link to this shader: ${url}`); }
      host.dataset.shared = url;
    } else return false;
    return true;
  }
  return { onInput, onClick, destroy() { io?.disconnect(); thumb?.destroy?.(); } };
}
