import { MEDIA, apply, backend, loadImage, loadVideo, mk, defaults } from '../media/index.js';
import { assetMeta, credit, cover, reduced, loop } from './common.js';

const OBJ = { riso: 'riso-print', halftone: 'shantytown', cyanotype: 'cyanotype', photocopy: 'redacted-house', cutpaper: 'londons-conduct', letraset: 'letraset-sheet',
  newsprint: 'neratja', dotfield: 'cajal-purkinje', marbling: 'marbled-a', xray: 'xray-roentgen', blueprint: 'blueprint-pigeon', polaroid: 'polaroid-camera', archival: 'redacted-cia' };
const FILM = { filmburn: 'press', vhs: 'switchboard', crt: 'tapemap', scope: 'scope' };
const SUBJECT = 'bread-line-41st', ANIM = new Set(['filmburn', 'vhs', 'crt', 'scope', 'marbling', 'dotfield']);
const cajal = await loadImage(`assets/img/cajal-purkinje${innerWidth < 700 ? '-s' : ''}.jpg`);
const wall = document.getElementById('wall'), small = innerWidth < 700, SW = small ? 360 : 560, SH = Math.round(SW * .75);
const meta = await assetMeta();
const subject = await loadImage(`assets/img/${SUBJECT}${small ? '-s' : ''}.jpg`);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function source(m, vid) {
  const c = mk(SW, SH), x = c.getContext('2d');
  return { c, draw() {
    x.clearRect(0, 0, SW, SH);
    if (vid) cover(x, vid, 0, 0, SW, SH);
    else if (m.id === 'cutpaper') { x.save(); x.translate(SW / 2, SH / 2); x.rotate(-.05); cover(x, subject, -SW * .38, -SH * .36, SW * .76, SH * .72); x.restore(); }
    else if (m.id === 'letraset') { x.fillStyle = '#15130f'; x.font = `800 ${SW * .2}px "Hanken Grotesk",sans-serif`; x.textBaseline = 'middle'; x.fillText('WEIGH', SW * .06, SH * .36); x.fillText('IT.', SW * .06, SH * .68); }
    else if (m.id === 'dotfield') { x.fillStyle = '#fff'; x.fillRect(0, 0, SW, SH); cover(x, cajal, 0, 0, SW, SH, .5, .3); }
    else cover(x, subject, 0, 0, SW, SH);
  } };
}

async function card(m) {
  const key = OBJ[m.id], film = FILM[m.id], a = key && meta[key];
  const el = document.createElement('article'); el.className = 'card'; el.setAttribute('aria-labelledby', 'h-' + m.id);
  const im = key && `assets/img/${key}${small ? '-s' : ''}`;
  const objHTML = film ? `<video muted loop playsinline preload="metadata" aria-label="Archive film loop used as the real object for ${m.name}"><source src="assets/film/${film}-av1.mp4" type='video/mp4; codecs="av01.0.04M.08"'><source src="assets/film/${film}.webm" type='video/webm; codecs="vp9"'><source src="assets/film/${film}.mp4" type="video/mp4"></video>`
    : key ? `<picture style="display:contents"><source type="image/avif" srcset="${im}.avif"><source type="image/webp" srcset="${im}.webp"><img loading="lazy" decoding="async" alt="${esc(a ? a.title : m.name)}" src="${im}.jpg"></picture>` : `<div class="none">No cleared example. The swatch stands alone.</div>`;
  const real = m.id === 'dotfield' ? 'Cajal, Purkinje cells' : film ? 'Prelinger Archives film' : key ? (a ? a.title.replace(/\s+/g, ' ').slice(0, 44) : '') : '';
  const modeSel = m.id === 'dotfield' ? `<dt>mode</dt><dd style="margin:0"><select data-mode aria-label="Dot field mode" style="width:100%;min-height:34px;font:600 16px 'Hanken Grotesk'"><option value="0">Image into dots</option><option value="1">Isometric heightfield</option><option value="2">Interference rings</option><option value="3">Vortex tunnel</option><option value="4">Clusters</option></select></dd>` : '';
  const ps = modeSel + Object.entries(m.params).map(([k, [d, lo, hi]]) => `<dt>${k}</dt><dd style="margin:0"><input type="range" data-k="${k}" min="${lo}" max="${hi}" step="${(hi - lo) / 100}" value="${d}" aria-label="${m.name}, ${k}"></dd>`).join('');
  el.innerHTML = `<div class="pair"><figure>${objHTML}<span class="cap">${real ? 'The real thing' : 'Reference'}</span></figure><figure><canvas width="${SW}" height="${SH}" role="img" aria-label="Live swatch: ${m.name} applied to ${film ? 'a film loop' : m.id === 'letraset' ? 'the words Weigh it' : 'a 1915 bread line photograph'}"></canvas><span class="cap">Live swatch</span></figure></div>
  <div class="label"><h2 id="h-${m.id}">${m.name}</h2><p class="meta">${m.date}. ${m.medium}.</p><p>${m.history}</p><p class="an">${m.analogy}</p><dl>${ps}</dl>
  <p class="src">${a ? 'Real object: ' + esc(credit(meta, key)) + '.' : film ? 'Real object: Prelinger Archives film, public domain.' : ''}</p></div>`;
  wall.append(el);
  const cv = el.querySelector('canvas'), vid = el.querySelector('video'), sv = film ? await loadVideo(([...vid.querySelectorAll('source')].find(s => vid.canPlayType(s.type)) || { src: `assets/film/${film}.mp4` }).src) : null;
  if (cv && m.id === 'letraset') cv.style.background = '#e6dcc4'; if (m.id === 'cutpaper') cv.style.background = '#2a4a6b url(assets/img/hessian-s.jpg)';
  const src = source(m, sv), P = defaults(m); let dirty = true;
  if (m.id === 'dotfield') { Object.assign(P, { mode: 0, invert: 1, thresh: .22, clusters: [[.3, .5, .12, 1], [.55, .45, .15, .8], [.75, .55, .1, .6]] }); const sel = el.querySelector('[data-mode]'); sel.addEventListener('change', () => { P.mode = +sel.value; P.invert = P.mode === 0 || P.mode === 1 ? 1 : 0; P.thresh = P.mode === 0 ? .22 : 0; dirty = true; }); }
  el.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { P[i.dataset.k] = +i.value; dirty = true; kick(); }));
  const render = t => { src.draw(); apply(src.c, [[m, P]], cv, { t, seed: 3 }); };
  if (reduced) { if (sv) sv.currentTime = 2; if (vid) { vid.currentTime = 2; vid.pause(); } sv && sv.addEventListener('seeked', () => render(2), { once: true }); render(2);
    el.querySelectorAll('input').forEach(i => i.addEventListener('input', () => render(2))); return; }
  if (sv) sv.play().catch(() => {}); if (vid) vid.play().catch(() => {});
  const kick = loop(el, t => { if (ANIM.has(m.id) || dirty) { render(t); dirty = false; } }, ANIM.has(m.id) ? 20 : 12);
}
for (const m of MEDIA) await card(m);
document.getElementById('engine').textContent = backend() === 'webgl2' ? 'Rendering with WebGL2.' : 'Rendering with the Canvas 2D fallback.';
