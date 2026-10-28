// depth(): the layer system every room shares. It adds, around the existing piece and never inside it:
// a ledger of layers, reference tags over the art, a wall text behind a toggle, a riddle checked by hash, and a threads strip.
import { mountTags } from './tags.js';
import { settle, mountRiddle } from './widgets.js';
import { mountSallow } from './sallow.js';
const KEY = 'anvil.depth.v1', RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./depth.css', import.meta.url).href; document.head.append(css);
let mem = {};
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return mem; } };
const save = s => { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('progress not saved', e.name); } };
export const store = { load, save, KEY };
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const BADGE = { v: 'checked', p: 'partly checked', u: 'not checked' };
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export { RM };

export function depth(cfg) {
  const q = new URLSearchParams(location.search).get('dp'), all = load(), me = all[cfg.room] = all[cfg.room] || { layers: {}, marks: {}, visits: 0 };
  if (q === 'reset') { me.layers = {}; me.marks = {}; me.visits = 0; }
  let sess = null; try { sess = sessionStorage.getItem('anvil.s.' + cfg.room); sessionStorage.setItem('anvil.s.' + cfg.room, '1'); } catch (e) { sess = null; }
  if (!sess) me.visits = (me.visits || 0) + 1; if (q === 'return') me.visits = Math.max(2, me.visits);
  save(all);
  const D = { cfg, ctx: { visits: me.visits, returning: me.visits >= 2 }, listeners: {} };
  const forced = q === 'all';
  D.forced = forced;
  D.has = id => id === 'l1' || forced || !!me.layers[id];
  D.mark = id => !!me.marks[id];
  const live = el('p', 'sr'); live.setAttribute('aria-live', 'polite');
  D.say = m => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };
  D.reveal = (id, silent) => {
    if (me.layers[id]) return false; me.layers[id] = Date.now(); save(all); D.engage && D.engage();
    const L = cfg.layers.find(l => l.id === id); renderLedger(); D.tags.refresh(); (D.listeners[id] || []).forEach(f => f());
    if (!silent && L) D.say(`Layer found: ${L.name}. ${L.found.replace(/<[^>]+>/g, '')}`); return true;
  };
  D.on = (id, fn) => { (D.listeners[id] = D.listeners[id] || []).push(fn); if (D.has(id)) fn(); };
  D.markFound = (id, msg) => { if (me.marks[id]) return; me.marks[id] = Date.now(); save(all); D.engage && D.engage(); renderLedger(); if (msg) D.say(msg); };
  // visible-time timer: pauses while the tab is hidden
  D.dwell = (sec, fn) => { let t = 0, last = performance.now(), done = false; const id = setInterval(() => { const n = performance.now(); if (!document.hidden) t += n - last; last = n; if (!done && t >= sec * 1000) { done = true; clearInterval(id); fn(); } }, 500); };

  const main = document.querySelector('main') || (() => { const m = document.createElement('main'); m.style.cssText = 'max-width:1100px;margin:0 auto;padding:16px 16px 40px'; document.body.append(m); return m; })(), sec = el('section', 'depth'); sec.setAttribute('aria-labelledby', 'dp-h');
  sec.innerHTML = '<h2 id="dp-h">Depths of this room</h2><p class="dp-lede">There is more in this room than the first look, like a second tour of a museum. Each layer has a real source behind it, and each has a Show me button.</p>';
  const ledger = el('ol', 'dp-layers'), marksP = el('p', 'dp-marks'), bar = el('div', 'dp-bar'), wallBox = el('div', 'dp-wall'); wallBox.hidden = true;
  const wbtn = el('button', null, 'Read the wall'); wbtn.type = 'button'; wbtn.setAttribute('aria-expanded', 'false'); wbtn.setAttribute('aria-controls', 'dp-wall');
  wallBox.id = 'dp-wall';
  const rbtn = el('button', null, 'References on'); rbtn.type = 'button'; rbtn.setAttribute('aria-pressed', 'true');
  const fbtn = el('button', 'dp-quiet', 'Forget what I found'); fbtn.type = 'button';
  const mh = el('details', 'dp-mhint'); mh.innerHTML = '<summary>Hints for the finds</summary><ul><li>Figure: a real figure from the record. Hold still, with no pointer or key input, for 30 seconds, and dots settle into it with its source. <button type="button" class="dp-hint" data-act="num">Show me</button></li><li>Plate: one reference tag opens a lossless picture with a bit reader. The reader prints a line stored in the picture\'s lowest bits. <button type="button" class="dp-hint" data-act="plate">Show me</button></li><li>Puzzle: set in the room, below. The answer is a word this room has used. It has a Show me button.</li></ul>';
  mh.querySelector('[data-act=num]').onclick = () => { if (D.showNumber) D.showNumber(); };
  mh.querySelector('[data-act=plate]').onclick = () => { if (D.showPlate) D.showPlate(); };
  bar.append(wbtn, rbtn, fbtn); if (cfg.noPuzzle) { marksP.hidden = true; mh.hidden = true; }
  sec.append(ledger, marksP, mh, bar, wallBox, live);
  function renderLedger() {
    ledger.innerHTML = '';
    cfg.layers.forEach((L, i) => {
      const li = el('li', 'dp-layer'), got = D.has(L.id); li.dataset.state = got ? 'found' : 'hidden';
      li.innerHTML = `<b>Layer ${i + 1}${got ? ': ' + esc(L.name) : ''}</b> <span>${got ? L.found : 'Not found yet. ' + esc(L.how)}</span>`;
      if (!got) {
        const h = el('button', 'dp-hint', 'Hint'); h.type = 'button'; h.setAttribute('aria-expanded', 'false'); const hp = el('span', 'dp-hinttext', ''); hp.hidden = true;
        h.onclick = () => { hp.hidden = false; hp.textContent = L.hint + ' '; h.setAttribute('aria-expanded', 'true'); };
        const sm = el('button', 'dp-hint', 'Show me'); sm.type = 'button'; sm.onclick = () => { D.reveal(L.id); if (L.open) L.open(); };
        li.append(' ', h, ' ', sm, ' ', hp);
      }
      ledger.append(li);
    });
    const m = cfg.marks || {};
    marksP.innerHTML = 'Finds: ' + Object.keys(m).map(k => { const g = D.mark(k) || forced; return `<span data-got="${g}">${esc(m[k])} ${g ? 'found' : 'not found'}</span>`; }).join('. ') + '.';
    sec.dataset.solved = (D.mark('riddle') || forced) ? 'true' : 'false';
  }
  // ---- the wall: two to four short paragraphs, footnoted ----
  const W = cfg.wall;
  const paras = W.paras.map(p => '<p>' + p.replace(/\[(\d+)\]/g, (_, n) => `<sup><a href="#dp-fn-${cfg.room}-${n}" aria-label="note ${n}">${n}</a></sup>`).replace(/^(\s*)([A-Za-z])/, '$1<span class="dp-ac">$2</span>') + '</p>').join('');
  wallBox.innerHTML = `<h3>${esc(cfg.title)}</h3>${paras}<h4>Notes</h4><ol class="dp-notes">` + W.notes.map((n, i) => `<li id="dp-fn-${cfg.room}-${i + 1}">${n.t}${n.u ? ` <a href="${esc(n.u)}" rel="noopener">${esc(n.u.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : ''} <em class="dp-s dp-s-${n.s}">${BADGE[n.s]}</em></li>`).join('') + '</ol>' + (cfg.noPuzzle ? '' : '<h4>How the puzzle box works</h4><p class="dp-box">This room is a puzzle box, a second tour for people who want one. Nothing in it is secret knowledge. The first letters of the wall paragraphs spell a word, and the thirteen rooms together spell one sentence. One picture in each room is stored losslessly and holds a line of plain text in its lowest colour bits; the bit reader in its reference card prints it. Each room has a puzzle whose answer is a word from the room, and the thirteen words are the key to the last wall, a simple Vigenere cipher. Every hidden thing has a Show me button with a plain answer.</p>');
  wbtn.onclick = () => { const o = wallBox.hidden; wallBox.hidden = !o; wbtn.setAttribute('aria-expanded', String(o)); wbtn.textContent = o ? 'Hide the wall' : 'Read the wall'; };
  rbtn.onclick = () => { const on = rbtn.getAttribute('aria-pressed') !== 'true'; rbtn.setAttribute('aria-pressed', String(on)); rbtn.textContent = on ? 'References on' : 'References off'; document.documentElement.dataset.dpRefs = on ? 'on' : 'off'; };
  fbtn.onclick = () => { if (confirm('Forget the layers, marks and visit count for every room, in this browser?')) { try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch (e) { mem = {}; } location.search = ''; } };
  // ---- threads: a quiet line of doors, shown once the room has been engaged. No labels: the visitor finds out why by going. ----
  const threads = el('nav', 'dp-threads'); threads.setAttribute('aria-label', 'Other rooms'); threads.hidden = true;
  let engaged = false; D.engage = () => { if (engaged) return; engaged = true; threads.hidden = false; };
  fetch(new URL('../../rooms/rooms.json', import.meta.url)).then(r => r.json()).then(J => {
    const mine = J.rooms[cfg.room]; if (!mine) return; const ul = el('ul');
    const list = Object.values(J.rooms).filter(r => r.slug !== cfg.room).map(r => ({ r, n: r.motifs.filter(m => mine.motifs.includes(m)).length })).filter(x => x.n).sort((a, b) => b.n - a.n || a.r.order - b.r.order).slice(0, 3);
    list.forEach(({ r }) => { const li = el('li'); li.innerHTML = `<a href="${esc(r.page || r.slug + '.html')}">${esc(r.title)}</a>`; ul.append(li); });
    if (list.length) threads.append(ul); else threads.remove();
  }).catch(e => { console.error('threads failed', e); threads.remove(); });
  wbtn.addEventListener('click', () => D.engage()); sec.addEventListener('pointerdown', () => { if (Object.keys(me.layers).length || forced) D.engage(); });
  D.tags = mountTags(D, cfg);
  mountSallow(D, cfg).then(b => { if (b) wallBox.after(b); });
  sec.append(mountRiddle(D, cfg), threads); main.append(sec); renderLedger();
  D.settle = host => settle(D, cfg, host); D.section = sec; D.renderLedger = renderLedger;
  if (forced || Object.keys(me.layers).length || Object.keys(me.marks).length) D.engage();
  if (cfg.stay) D.dwell(cfg.stay.sec, () => D.reveal(cfg.stay.id));
  if (cfg.returning && D.ctx.returning) D.reveal(cfg.returning, true);
  return D;
}
