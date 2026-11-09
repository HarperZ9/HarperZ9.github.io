// The last wall: thirteen key words, checked as hashes, decode a Vigenere line one segment at a time.
import { hashAnswer } from './sha.js';

const W = await fetch(new URL('../../rooms/wall.json', import.meta.url)).then(r => r.json());
const ROOMS = { palimpsest: 'trace', balance: 'wedge', powers: 'hedge', mirror: 'true', emet: 'aleph', test: 'simulated', labels: 'libel', crowd: 'strings', scale: 'pivot', munchhausen: 'hair', groove: 'groove', lossy: 'lossy', static: 'static' };
const $ = id => document.getElementById(id), kd = $('keys');
const known = new Array(W.rooms.length).fill(null);
kd.innerHTML = W.rooms.map((r, i) => `<label>${i + 1}. <a href="${r.slug}.html">${r.title}</a> (${r.n} letters)<input type="text" data-i="${i}" autocomplete="off" spellcheck="false" aria-label="Key word from ${r.title}"></label>`).join('');
// the position of each key letter in the key string
const starts = []; let acc = 0; W.rooms.forEach(r => { starts.push(acc); acc += r.n; });
function render() {
  const keyAt = new Array(W.ct.length).fill(null);
  known.forEach((w, i) => { if (!w) return; for (let k = 0; k < W.rooms[i].n; k++) keyAt[starts[i] + k] = w[k].toUpperCase(); });
  let li = 0, html = '';
  for (const m of W.mask) {
    if (m === 'U' || m === 'L') { const key = keyAt[li], c = W.ct[li]; li++; if (key) { const p = String.fromCharCode((c.charCodeAt(0) - key.charCodeAt(0) + 26) % 26 + 65); html += `<span class="k">${m === 'U' ? p : p.toLowerCase()}</span>`; } else html += '<span class="u">.</span>'; }
    else html += m === ' ' ? ' ' : m.replace('&', '&amp;');
  }
  $('line').innerHTML = html; const n = known.filter(Boolean).length; $('prog').textContent = `${n} of 13 words found.${n === 13 ? ' The wall is unlocked.' : ''}`;
}
kd.addEventListener('input', e => { const i = +e.target.dataset.i; if (isNaN(i)) return; const v = e.target.value.trim(), ok = v && hashAnswer(v) === W.rooms[i].hash; e.target.dataset.ok = String(!!ok); known[i] = ok ? v.toLowerCase().replace(/[^a-z]/g, '') : null; render(); });
$('cipher').textContent = W.ct.replace(/(.{5})/g, '$1 ');
$('sent-b').onclick = () => { const v = $('sent').value; $('sent-o').textContent = hashAnswer(v) === W.sentence ? 'Right. Hand on the pan, hand on the rope, we all sing the song. It joins the pan of the scale to the rope of the mast: everyone holds an end, and everyone hears the song.' : 'Not it yet. Read down the first letters of each room\'s wall paragraphs, in room order.'; };
$('all-b').onclick = () => { const ul = $('all'); ul.hidden = false; ul.innerHTML = W.rooms.map(r => `<li>${r.title}: <b>${ROOMS[r.slug].toUpperCase()}</b></li>`).join('') + '<li>Sentence: hand on the pan, hand on the rope, we all sing the song</li>'; W.rooms.forEach((r, i) => { known[i] = ROOMS[r.slug]; const el = kd.querySelector(`[data-i="${i}"]`); el.value = ROOMS[r.slug]; el.dataset.ok = 'true'; }); render(); };
render();
