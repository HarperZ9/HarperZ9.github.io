// Palimpsest, deepened. Everything here sits around the existing piece: a wax pad below the controls, an ultraviolet overlay on the sheet,
// two imaged pages of the real codex, reference tags, a wall, a riddle and a threads strip.
import { depth, el, RM } from './core.js';
import { mountPad } from './pad.js';
import { cfg } from './pal-cfg.js';

const D = depth(cfg), $ = id => document.getElementById(id), sheet = $('sheet');
const style = el('style', null, `
.pad { margin:22px 0 8px; max-width:700px } .pad h2 { font-size:18px; margin:0 0 8px; font-weight:800 }
.padwrap { position:relative; border:2px solid #c9a24a; background:#2a2923; padding:0; line-height:0 } .padwrap canvas { width:100%; height:auto; display:block; cursor:crosshair; touch-action:none }
.padctl { display:flex; flex-wrap:wrap; gap:10px 14px; align-items:end; margin:10px 0; line-height:1.4 } .padctl label { display:grid; gap:4px; font-size:16px; font-weight:600 }
.padctl input[type=text] { font:inherit; min-height:44px; padding:6px 10px; background:#0c0c0c; color:var(--ink); border:2px solid var(--ink); width:min(260px,70vw) } .padctl input[type=range] { width:180px; min-height:44px; accent-color:var(--hot) }
#pads { color:var(--muted); font-size:16px; margin:4px 0; max-width:70ch } .padwrap canvas:focus-visible { outline:3px solid var(--hot); outline-offset:3px }
.uvv, .uvt { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1 } .uvt { z-index:1 } #lamp { z-index:3 }
.pages { margin:22px 0; display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:16px; max-width:760px } .pages figure { margin:0 } .pages img { width:100%; height:auto; display:block; border:1px solid var(--line) }
.uvnote { color:var(--ink); font-size:16px; line-height:1.5; max-width:70ch; margin:8px 0; border-left:4px solid #8b5cf6; padding-left:12px }`);
document.head.append(style);

// ---- layer 2: the wax pad ----
const controls = document.querySelector('.controls'); mountPad(D, controls); D.tags.refresh();

// ---- layer 3: ultraviolet, with the oldest text turned across the page ----
const uvb = el('button', null, 'Ultraviolet'); uvb.type = 'button'; uvb.id = 'uvbtn'; uvb.setAttribute('aria-pressed', 'false'); controls.append(uvb);
const veil = el('canvas', 'uvv'), txt = el('canvas', 'uvt'); veil.setAttribute('aria-hidden', 'true'); txt.setAttribute('aria-hidden', 'true'); sheet.append(veil, txt);
const off = document.createElement('canvas'); let on = false, auto = false, raf = 0, last = '';
function bake() {
  const w = sheet.clientWidth, h = sheet.clientHeight; if (!w || !h) return; [veil, txt, off].forEach(c => { c.width = w; c.height = h; }); const x = off.getContext('2d'), u = w / 720;
  x.clearRect(0, 0, w, h); x.save(); x.translate(w * .5, h * .5); x.rotate(-Math.PI / 2); // the older text runs across the page: bottom to top
  x.fillStyle = '#d9c8ff'; x.shadowColor = '#8b5cf6'; x.shadowBlur = 10 * u; x.font = `italic 600 ${23 * u}px Georgia, "Hanken Grotesk",sans-serif`; x.textAlign = 'center';
  x.save(); x.globalAlpha = .35; x.lineWidth = 1.2 * u; x.strokeStyle = '#d9c8ff'; for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(-300 * u, i * 36 * u + 8 * u); x.lineTo(300 * u, i * 36 * u + 8 * u); x.stroke(); } x.restore(); // the scribe's ruling
  ['Archimedes to Eratosthenes greeting.', '', 'certain things first became clear to me by a mechanical method,', 'although they had to be demonstrated by geometry afterwards'].forEach((l, i) => x.fillText(l, 0, (i - 1.5) * 36 * u));
  x.restore();
  // a figure: a lever on its fulcrum with a circle and a triangle, lettered in Greek capitals
  x.save(); x.strokeStyle = '#d9c8ff'; x.fillStyle = '#d9c8ff'; x.lineWidth = 2.2 * u; x.shadowColor = '#8b5cf6'; x.shadowBlur = 8 * u; const cx = w * .5, cy = h * .84;
  x.beginPath(); x.moveTo(cx - 250 * u, cy); x.lineTo(cx + 250 * u, cy); x.stroke(); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx - 16 * u, cy + 26 * u); x.lineTo(cx + 16 * u, cy + 26 * u); x.closePath(); x.stroke();
  x.beginPath(); x.arc(cx - 150 * u, cy - 62 * u, 62 * u, 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx + 110 * u, cy); x.lineTo(cx + 230 * u, cy); x.lineTo(cx + 110 * u, cy - 120 * u); x.closePath(); x.stroke();
  x.font = `600 ${22 * u}px Georgia, serif`; [['Α', -262, 6], ['Β', 258, 6], ['Θ', 0, 46], ['Γ', -150, -140], ['Δ', 100, -130]].forEach(([t, dx, dy]) => x.fillText(t, cx + dx * u, cy + dy * u)); x.restore();
}
const lampPos = () => { const l = $('lamp'); return [parseFloat(l.style.left) / 100 || .3, parseFloat(l.style.top) / 100 || .2]; };
function paint() {
  const w = veil.width, h = veil.height; if (!w) return; const [fx, fy] = lampPos(), cx = fx * w, cy = fy * h, R = Math.max(w, h) * (on ? .3 : .22);
  const v = veil.getContext('2d'); v.clearRect(0, 0, w, h);
  if (on) { v.fillStyle = 'rgba(12,4,40,.66)'; v.fillRect(0, 0, w, h); v.globalCompositeOperation = 'destination-out'; const g = v.createRadialGradient(cx, cy, R * .15, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); v.fillStyle = g; v.fillRect(0, 0, w, h); v.globalCompositeOperation = 'source-over'; }
  const t = txt.getContext('2d'); t.clearRect(0, 0, w, h); t.globalAlpha = on ? 1 : .42; t.drawImage(off, 0, 0); t.globalAlpha = 1; t.globalCompositeOperation = 'destination-in';
  const g2 = t.createRadialGradient(cx, cy, R * .1, cx, cy, R * (on ? 1 : 1.25)); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.7, 'rgba(0,0,0,.7)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); t.fillStyle = g2; t.fillRect(0, 0, w, h); t.globalCompositeOperation = 'source-over';
}
function loop() { raf = 0; paint(); if ((on || auto) && !RM && !document.hidden) raf = requestAnimationFrame(loop); }
const wake = () => { if (!(on || auto)) return; if (RM) paint(); else if (!raf) raf = requestAnimationFrame(loop); };
new ResizeObserver(() => { bake(); wake(); }).observe(sheet); bake();
['pointermove', 'keydown', 'pointerdown'].forEach(e => sheet.addEventListener(e, () => { if (RM) setTimeout(paint, 30); }));
if (RM) setInterval(() => { if (on || auto) paint(); }, 200);
const pages = el('section', 'pages'); pages.hidden = true; pages.setAttribute('aria-label', 'Two pages from the real codex');
pages.innerHTML = `<figure><img src="assets/img/dp/pal-page.jpg" alt="A reddish vellum page covered in small brown Greek script, with a roman numeral and number in the top margin" width="560"><figcaption>An unfolded page of the codex as photographed. The Walters Museum, 2008, CC BY 3.0. Resized.</figcaption></figure><figure><img src="assets/img/dp/pal-imaged.jpg" alt="A grey processed page: columns of pale Greek letters, and circles and straight lines drawn across the right-hand side" width="560"><figcaption>A different page after imaging. The circles and lines are geometric figures that belong to the older text. The Walters Museum, 2008, CC BY 3.0. Resized.</figcaption></figure>`;
const note = el('p', 'uvnote', 'Our reading, not the museum\'s: the report on top says there was no evidence, and the page under it says a thing can be known before it counts. The later writing runs across the earlier writing, as the Wikipedia caption for the codex describes.'); note.hidden = true;
$('sheet').closest('figure').querySelector('.controls').after(pages, note);
function setUV(v) { on = v; uvb.setAttribute('aria-pressed', String(v)); uvb.textContent = v ? 'Ultraviolet on' : 'Ultraviolet'; if (v) D.reveal('l3'); paint(); wake(); }
uvb.onclick = () => setUV(!on);
D.on('l3', () => { pages.hidden = false; note.hidden = false; if (!on) { auto = true; wake(); } });
window.addEventListener('keydown', e => { if ((e.key === 'u' || e.key === 'U') && !/input|textarea/i.test(e.target.tagName)) setUV(!on); });
D.settle(document.querySelector('.desk'));
