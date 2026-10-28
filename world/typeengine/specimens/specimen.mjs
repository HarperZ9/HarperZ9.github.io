// specimens/specimen.mjs: one family, two ways. The font room sets real text in the files build/emit.py made
// (the material cut, then the variable font across its axes); the material room draws the live engine.
import { createLive, drawCanvas2D } from '../web/gl.mjs';
import { instance } from '../lib/program.mjs';
import { renderWord } from '../lib/render.mjs';

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get('family') ?? 'pane-1';

async function face(name, url, desc = {}) { const f = new FontFace(name, `url("${url}") format("woff2")`, desc); document.fonts.add(await f.load()); return name; }

function liveDraw(canvas, fam, text) {
  let live = null; try { live = createLive(canvas); } catch (e) { console.error('[specimen] WebGL2 failed:', e); }
  const draw = (t) => (live ? live.draw(fam, text, { t }) : drawCanvas2D(canvas, fam, text, { t }));
  draw(0);
  const b = instance(fam).bindings, moving = !!b.motion || (b.fill.material === 'crt') || !!b.fill.feed;
  if (moving && window.UIShell?.clock && !matchMedia('(prefers-reduced-motion: reduce)').matches && live) { const t0 = performance.now(); window.UIShell.clock.subscribe(() => draw((performance.now() - t0) / 1000)); }
}

async function boot() {
  const fam = await fetch(`../families/${id}.json`).then((r) => r.json());
  document.title = fam.name; $('name').textContent = fam.name;
  const inst = instance(fam);
  liveDraw($('hero'), fam, fam.name);
  liveDraw($('alpha'), fam, 'Rag Quiz 0123');
  const rep = await fetch(`../dist/${id}/report.json`).then((r) => (r.ok ? r.json() : null)).catch((e) => { console.error('[specimen] report:', e); return null; });
  if (rep) {
    const cut = await face(`${id}-cut`, `../dist/${id}/${encodeURIComponent(rep.files.cut.name)}.woff2`), lines = [[96, 'Accession'], [64, 'Hamburgefonstiv'], [40, 'The quick brown fox jumps over the lazy dog'], [26, 'Sphinx of black quartz, judge my vow. 0123456789']];
    const gr = rep.ground ?? fam.ground ?? '#ebe5d8'; $('ladder').style.cssText = `background:${gr};padding:clamp(16px,3vw,40px);color:${lum(gr) < 0.3 ? '#ece5d6' : '#16130f'}`;
    for (const [px, text] of lines) { const p = document.createElement('p'); p.textContent = text; p.contentEditable = 'plaintext-only'; p.spellcheck = false; p.style.fontSize = `${px}px`; p.style.fontFamily = `"${cut}"`; p.style.lineHeight = px > 72 ? '1' : '1.15'; $('ladder').append(p); }
    const vname = await face(`${id}-var`, `../dist/${id}/${encodeURIComponent(rep.files.variable.name)}.woff2`, { weight: '1 1000' });
    for (const a of (fam.axes ?? []).filter((x) => rep.axes.includes(tagOf(x)))) for (const v of [a.min, a.max]) {
      const p = document.createElement('p'); p.textContent = 'Rag'; p.style.fontFamily = `"${vname}"`; p.style.fontVariationSettings = `"${tagOf(a)}" ${v}`; p.setAttribute('aria-label', `Rag, ${a.name} ${v}`); $('axisline').append(p);
    }
  }
  if (inst.bindings.sound) {
    const btn = $('listen'); btn.hidden = false; let ac = null;
    // The button is the word's own sound, drawn as its envelope.
    const pcm0 = renderWord(fam, fam.name, 600, 200).pcm.channels[0], wc = $('wave'), wx = wc.getContext('2d'), n = wc.width, k = Math.floor(pcm0.length / n);
    wx.fillStyle = getComputedStyle(document.body).color;
    for (let x = 0; x < n; x++) { let m = 0; for (let i = x * k; i < (x + 1) * k; i++) m = Math.max(m, Math.abs(pcm0[i])); const h = Math.max(1, m * wc.height * 0.95); wx.fillRect(x, (wc.height - h) / 2, 1, h); }
    btn.addEventListener('click', () => {
      if (ac) { ac.close(); ac = null; btn.setAttribute('aria-pressed', 'false'); return; }
      const pcm = renderWord(fam, fam.name, 600, 200).pcm; ac = new AudioContext();
      const buf = ac.createBuffer(1, pcm.channels[0].length, pcm.rate); buf.copyToChannel(pcm.channels[0], 0);
      const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); s.start(); btn.setAttribute('aria-pressed', 'true');
      s.onended = () => { ac?.close(); ac = null; btn.setAttribute('aria-pressed', 'false'); };
    });
  }
}
const TAGS = { 'skeleton.weight': 'wght', 'skeleton.extra.n': 'SQUR', 'skeleton.extra.wd': 'WIDE', 'skeleton.extra.xh': 'XHGT', 'skeleton.extra.C': 'CNTR' };
const tagOf = (a) => TAGS[a.target] ?? a.tag;
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
boot().catch((e) => console.error('[specimen] boot failed:', e));
