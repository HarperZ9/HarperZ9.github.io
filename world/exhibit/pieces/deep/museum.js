// Visitor, 21st century (CONTRASTS B15): the museum label turns round and describes the visitor, using only what this tab saw.
// Layer 1 the label, layer 2 what any page can read without asking, layer 3 the same measurement used as a mirror. Nothing is sent.
import { depth, el } from './core.js';

const MDN = 'https://developer.mozilla.org/en-US/docs/Web/API/Navigator';
const cfg = {
  room: 'museum', title: 'Visitor, 21st century', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A label for you', found: "A museum label with you as the object: when you arrived, how long you have stood here, how far you scrolled, how many times you clicked, which rooms you opened this session. All of it from this tab, in this visit.", how: 'Read the label.', hint: '' },
    { id: 'l2', name: 'What any page can read', found: "Without asking, any web page can read your language, time zone, screen size, processor count and colour preference, among other things. This page lists them and sends none of them anywhere. Most pages are not so polite.", how: 'There is a longer label.', hint: 'Press What else this page can see.', open: () => document.getElementById('mu-more')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The same counting, turned into a mirror', found: "Measurement that profiles you is the same measurement that lets you audit a page: open your browser's network panel and you can watch this room send nothing. The label is a mirror held by the thing being described, which is the only kind of mirror worth trusting.", how: 'The label has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'none', x: 97, y: 4, layer: 'l1', kind: 'Read this first', title: 'Nothing leaves this tab',
      body: '<p>The label is computed in your browser from this visit: time on the page, scrolling, clicks and key presses counted here, and the list of rooms this tab opened in this session (the exhibit marks each room in session storage when you open it). Nothing is sent. Like every room, this one keeps its own layer ledger in your browser until you press Forget.</p>' },
    { id: 'nav', x: 97, y: 30, layer: 'l2', kind: 'Reference', title: 'The Navigator interface',
      body: '<p>Browsers expose a standard Navigator object to every page, with the language, the number of logical processors and more; screen size and colour preference come from other standard interfaces. Advertising and fraud systems combine such values into a fingerprint.</p>',
      src: [{ t: 'MDN Web Docs, Navigator', u: MDN, s: 'v' }], rooms: [{ room: 'crowd', label: 'Manufactured consensus', why: 'the count as the product' }] },
  ],
  wall: {
    paras: [
      "Every museum label is a small act of violence with good manners. It names you, dates you, says what you're made of and where you were found, and you can't answer back. So I turned one round.",
      "The label beside you is written from what this tab saw: how long you've stood here, how far you scrolled, how often you clicked, which rooms you opened tonight. It's not much. It's also more than you'd tell a stranger, and every page you've visited this week could have written it, and many sent it somewhere.",
      "Here's the other edge, and it's the one I care about. The same counting is how you catch a page lying about what it does with you. Open the network panel and watch this one send nothing. I don't want your trust. I want you to check.",
    ],
    notes: [
      { t: 'Standard browser interfaces available to any page without a permission prompt: Navigator (language, hardwareConcurrency), Screen, matchMedia for colour scheme and reduced motion, Intl for time zone. MDN Web Docs.', u: MDN, s: 'v' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.mu .card { max-width:560px; background:#f4f1ea; color:#1d1b17; padding:18px 22px; border:1px solid #cfc9bb; font-family:"Hanken Grotesk",sans-serif }
.mu .card h2 { font:800 22px/1.2 "Hanken Grotesk",sans-serif; margin:0 0 2px } .mu .card .sub { font-style:italic; font-family:"Hanken Grotesk",sans-serif; margin:0 0 12px; font-size:18px }
.mu .card dl { display:grid; grid-template-columns:auto 1fr; gap:4px 14px; margin:0; font-size:16px } .mu .card dt { font-weight:600; color:#5a5446 } .mu .card dd { margin:0 }
.mu .note { font-family:"Hanken Grotesk",sans-serif; font-size:17px; line-height:1.55; margin:12px 0 0 } .mu .row { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0 }
`));
const st = document.getElementById('stage'); st.classList.add('mu');
st.innerHTML = `<div class="card" id="mu-card"><h2>Visitor</h2><p class="sub">21st century. Reader of screens.</p><dl id="mu-dl"></dl><p class="note" id="mu-note"></p></div>
<div class="row"><button type="button" id="mu-read">Read my label aloud to a screen reader</button><button type="button" id="mu-more" aria-expanded="false">What else this page can see</button></div>
<div class="card" id="mu-card2" hidden><h2>Also visible to any page</h2><p class="sub">Read here, sent nowhere.</p><dl id="mu-dl2"></dl></div><p class="sr" id="mu-live" aria-live="polite"></p>`;
const t0 = Date.now(), arrived = new Date(); let clicks = 0, keys = 0, maxScroll = 0;
addEventListener('click', () => clicks++, true); addEventListener('keydown', () => keys++, true); addEventListener('scroll', () => { maxScroll = Math.max(maxScroll, scrollY); }, { passive: true });
function roomsThisSession() { const out = []; try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k && k.startsWith('anvil.s.')) out.push(k.slice(8)); } } catch (e) { console.warn('session storage unavailable', e.name); } return out; }
const mins = () => { const s = Math.round((Date.now() - t0) / 1000); return s < 60 ? `${s} seconds` : `${Math.floor(s / 60)} min ${s % 60} s`; };
function label() { const r = roomsThisSession(), screens = (maxScroll / innerHeight).toFixed(1);
  const rows = [['Arrived', arrived.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })], ['Time before this label', mins()], ['Scrolled', `${screens} screens`], ['Clicks', String(clicks)], ['Keys pressed', String(keys)], ['Rooms opened this session', r.length ? `${r.length}: ${r.join(', ')}` : 'this one']];
  document.getElementById('mu-dl').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b.replace(/[<&]/g, '')}</dd>`).join('');
  document.getElementById('mu-note').textContent = r.length > 3 ? 'A patient visitor, or a thorough one. Lingers where the light is low.' : (clicks > 10 ? 'Restless hands. Presses things to see what they do.' : 'Recently arrived. Has not yet decided whether to stay.');
  return rows.map(([a, b]) => `${a}: ${b}.`).join(' '); }
label(); setInterval(() => { if (!document.hidden) label(); }, 4000);
document.getElementById('mu-read').onclick = () => { document.getElementById('mu-live').textContent = 'Visitor, 21st century. ' + label(); D.reveal('l1'); };
document.getElementById('mu-more').onclick = e => { const c = document.getElementById('mu-card2'), on = c.hidden; c.hidden = !on; e.target.setAttribute('aria-expanded', String(on)); if (!on) return;
  const mm = q => matchMedia(q).matches, rows = [['Language', navigator.language || 'not given'], ['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'not given'], ['Screen', `${screen.width} by ${screen.height}`], ['Window', `${innerWidth} by ${innerHeight}`],
    ['Logical processors', String(navigator.hardwareConcurrency || 'not given')], ['Prefers dark', mm('(prefers-color-scheme: dark)') ? 'yes' : 'no'], ['Prefers less motion', mm('(prefers-reduced-motion: reduce)') ? 'yes' : 'no'], ['Touch points', String(navigator.maxTouchPoints || 0)]];
  document.getElementById('mu-dl2').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${String(b).replace(/[<&]/g, '')}</dd>`).join(''); D.reveal('l2'); };
D.tags.refresh();
