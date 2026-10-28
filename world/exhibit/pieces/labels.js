// Four labels: the same act, four stamps. The viewer stamps each silhouette before seeing what the page would have printed.
// Abstract silhouettes and archival newspaper type only. No attack imagery, no victims, no real people.
import { byId, apply, loadImage, mk, pointer } from '../media/index.js';
import { cover, reduced as RM } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '';
const snd = sound({ clink: { url: 'assets/audio/clink.opus', gain: 0.613 }, key: { url: 'assets/audio/key.opus', gain: 0.498 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const PAGES = await Promise.all(['neratja', 'vrije-woord', 'wilnaer', 'preanger'].map(n => loadImage(`assets/img/${n}${sfx}.jpg`)));
// Who did it: four things that were true of the person, none of them a group. The act is the same in every card.
const WHO = [{ id: 'a', t: 'Left a long written statement beforehand', c: '#e0177e' }, { id: 'b', t: 'Had a history of treatment for a mental illness', c: '#1aa3e0' }, { id: 'c', t: 'Wore a uniform and followed an order', c: '#ffe93a' }, { id: 'd', t: 'Had no record and kept to themselves', c: '#1f9a4c' }];
const STAMPS = ['TERRORIST', 'LONE WOLF', 'TROUBLED MAN', 'COMBATANT'];
const grid = $('grid'), res = $('result'), pick = {};
function silhouette(c, col) { const x = c.getContext('2d'), w = c.width, h = c.height; x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(w / 2, h * .55); x.lineTo(w / 2 + Math.cos(i / 14 * 6.2832) * w, h * .55 + Math.sin(i / 14 * 6.2832) * w); x.lineTo(w / 2 + Math.cos((i + .5) / 14 * 6.2832) * w, h * .55 + Math.sin((i + .5) / 14 * 6.2832) * w); x.fill(); }
  x.fillStyle = '#151515'; x.beginPath(); x.arc(w / 2, h * .34, w * .13, 0, 7); x.fill(); x.beginPath(); x.moveTo(w * .26, h); x.quadraticCurveTo(w * .27, h * .52, w / 2, h * .5); x.quadraticCurveTo(w * .73, h * .52, w * .74, h); x.closePath(); x.fill(); }
WHO.forEach((p, i) => {
  const el = document.createElement('fieldset'); el.className = 'card'; el.innerHTML = `<legend class="sr">${p.t}</legend><div class="art"><canvas width="360" height="300" aria-hidden="true"></canvas><div class="mark" aria-hidden="true"></div></div><p class="who">${p.t}</p>
  <div class="opts" role="radiogroup" aria-label="Stamp for: ${p.t}">${STAMPS.map(s => `<button type="button" role="radio" aria-checked="false" data-s="${s}">${s}</button>`).join('')}</div>`; grid.append(el);
  const c = el.querySelector('canvas'); silhouette(c, p.c); const bgc = mk(360, 300), bx = bgc.getContext('2d'); cover(bx, PAGES[i], 0, 0, 360, 300, .5, .2); bx.globalAlpha = .55; bx.fillStyle = '#efe6cf'; bx.fillRect(0, 0, 360, 300); const o = mk(360, 300); apply(bgc, [[byId.newsprint, { gain: .3, age: .6, through: .2 }]], o, { seed: i + 1 }); const x = c.getContext('2d'); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .5; x.drawImage(o, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  el.querySelectorAll('button').forEach(b => b.onclick = () => { pick[p.id] = b.dataset.s; el.querySelectorAll('button').forEach(k => k.setAttribute('aria-checked', k === b)); const m = el.querySelector('.mark'); m.textContent = b.dataset.s; m.style.display = 'block'; m.style.transform = `rotate(${-8 + i * 4}deg)`; snd.once('key'); if (Object.keys(pick).length === 4) reveal(); });
});
function reveal() {
  const counts = {}; Object.values(pick).forEach(s => counts[s] = (counts[s] || 0) + 1); const t = counts['TERRORIST'] || 0, same = new Set(Object.values(pick)).size === 1;
  res.hidden = false; res.querySelector('h2').textContent = 'The act was the same in all four.';
  res.querySelector('#lines').innerHTML = WHO.map(p => `<li><b>${pick[p.id]}</b> for the one who ${p.t.charAt(0).toLowerCase() + p.t.slice(1)}.</li>`).join('');
  res.querySelector('#tally').textContent = same ? `You gave all four the same stamp, ${Object.values(pick)[0]}. Look at the next front page you read and count the stamps on it.` : `You used TERRORIST ${t} time${t === 1 ? '' : 's'} out of four, and ${Object.keys(counts).length} different words in all. Four people, one act. The word changed with the person, and the act did not.`;
  $('live').textContent = res.textContent; snd.once('clink', { rate: .8 }); res.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); res.querySelector('h2').focus({ preventScroll: true });
}
