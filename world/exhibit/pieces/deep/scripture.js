// The terms, illuminated (CONTRASTS B12): one sentence of a real terms of service set as an illuminated page on a palimpsest leaf.
// Layer 1 the page, layer 2 the plain-language summary the terms already carry, layer 3 what is under the page.
import { depth, el } from './core.js';

const TOS = 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service', REPO = 'https://github.com/github/site-policy', WAL = 'https://commons.wikimedia.org/wiki/File:ArPalimTypPage.jpg';
const CLAUSE = 'GitHub provides the Website and the Service “as is” and “as available,” without warranty of any kind.';
const cfg = {
  room: 'scripture', title: 'The terms, illuminated', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A clause in gold and red', found: "The first sentence of section O of a real terms of service, set with a gilt initial, a vine border and the key words in red, the way a scribe set scripture. It reads as holy and says the service comes with no promises.", how: 'Read the page.', hint: '' },
    { id: 'l2', name: 'The short version', found: "These terms already carry a plain-language summary beside each section. For section O it says, in effect: we provide the service as is and promise nothing about it, so read this carefully. The vernacular was there all along, next to the Latin.", how: 'The terms have a translation.', hint: 'Press Show the short version under the page.', open: () => document.getElementById('sc-short')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'What the page is written on', found: "The leaf under the clause is a page of the Archimedes Palimpsest: a prayer book written in the thirteenth century over a copy of Archimedes. Solemn text laid over a proof. And the terms themselves are released under CC0, free for anyone to copy, which a scribe would have called a gift.", how: 'The ground of the page has a history.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'tos', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'GitHub Terms of Service, section O',
      body: '<p>Section O, Disclaimer of Warranties, of the GitHub Terms of Service, effective 27 April 2026. The sentence on the page is quoted exactly from the policy repository. GitHub is a real company and this is its real clause; the room makes no claim about how it is applied. It is here because it is ordinary: most services carry a sentence like it.</p>',
      src: [{ t: 'github/site-policy, Policies/github-terms/github-terms-of-service.md, read 23 Oct 2026 (sha256 b99f6130...874cf)', u: REPO, s: 'v' }, { t: 'Repository licence: CC0-1.0 (no trademark permission)', u: REPO, s: 'v' }] },
    { id: 'leaf', x: 97, y: 30, layer: 'l1', kind: 'Archival object', title: 'A leaf of the Archimedes Palimpsest',
      body: '<p>Walters Art Museum, an unfolded page of the Archimedes Palimpsest, released under CC BY 3.0. The same leaf is in the palimpsest room, where the oldest text comes up under ultraviolet.</p>',
      src: [{ t: 'Wikimedia Commons, ArPalimTypPage.jpg, Walters Art Museum, CC BY 3.0', u: WAL, s: 'v' }], rooms: [{ room: 'palimpsest', label: 'Palimpsest', why: 'writing over, never erasing' }] },
    { id: 'rub', x: 97, y: 56, layer: 'l1', kind: 'Reference', title: 'Rubrics',
      body: '<p>Rubric comes from the Latin for red: scribes wrote headings and instructions in red ink so a reader could find them. Here the red marks the two phrases that do the work of the clause.</p>' },
  ],
  wall: {
    paras: [
      "Gold leaf has always been a way of saying don't argue. Put a sentence in a gilt frame with a red initial and people lower their voices, which is why I put a warranty disclaimer in one.[1] Read it in the gold. Then read what it says: as is, as available, no warranty of any kind.",
      "Nobody reads terms of service, and the trick is not that they're hidden. They're printed, linked, dated and summarised in plain English beside every section.[1] The trick is that agreeing feels like a rite you pass through on the way to the thing you wanted. The solemnity is the anaesthetic.",
      "The leaf under the clause is a prayer book somebody wrote over Archimedes, eight hundred years ago, because vellum was dear and the maths looked useless.[2] Solemn text over a proof. And these particular terms are released free for anyone to copy, which is more than most scripture managed.[1] Both edges, one page.",
    ],
    notes: [
      { t: 'GitHub Terms of Service, effective 27 April 2026, section O, first sentence, and the short-version summaries; github/site-policy repository, licence CC0-1.0. Read from the repository on 23 October 2026.', u: REPO, s: 'v' },
      { t: 'The Archimedes Palimpsest: a thirteenth-century prayer book written over a tenth-century copy of Archimedes, imaged by the Walters project; leaf image CC BY 3.0. Sources as in the palimpsest room.', u: WAL, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.sc .leaf { position:relative; max-width:600px; padding:clamp(22px,5vw,48px); background:#e9dcbc; color:#2a1d10; border:1px solid #b9a77a; overflow:hidden }
.sc .leaf::before { content:""; position:absolute; inset:0; background:url(assets/img/dp/pal-page.jpg) center/cover; opacity:var(--under,.16); mix-blend-mode:multiply; transition:opacity .6s }
.sc .leaf > * { position:relative } .sc canvas.border { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
.sc .txt { font:400 clamp(20px,3.4vw,30px)/1.55 "Hanken Grotesk",sans-serif; margin:0 } .sc .txt .red { color:#a3140e } .sc .ini { float:left; width:clamp(64px,13vw,104px); height:auto; margin:4px 12px 2px 0 }
.sc .sect { font:700 16px "Hanken Grotesk",sans-serif; color:#a3140e; letter-spacing:.14em; margin:0 0 12px } .sc .row { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0 }
.sc .short { max-width:600px; border-left:4px solid var(--hot); padding:4px 16px; font-size:18px; line-height:1.55 }
@media (prefers-reduced-motion: reduce) { .sc .leaf::before { transition:none } }
`));
const st = document.getElementById('stage'); st.classList.add('sc');
const rest = CLAUSE.slice(1).replace('“as is”', '<span class="red">“as is”</span>').replace('“as available,”', '<span class="red">“as available,”</span>').replace('without warranty of any kind', '<span class="red">without warranty of any kind</span>');
st.innerHTML = `<div class="leaf" id="sc-leaf"><canvas class="border" id="sc-b" aria-hidden="true"></canvas><p class="sect">O. OF THE DISCLAIMER OF WARRANTIES</p><p class="txt"><canvas class="ini" id="sc-i" width="208" height="208" role="img" aria-label="An illuminated capital G in gold on a blue and red ground"></canvas>${rest}</p></div>
<div class="row"><button type="button" id="sc-short" aria-pressed="false">Show the short version</button><button type="button" id="sc-under" aria-pressed="false">Raking light on the leaf</button></div>
<div class="short" id="sc-s" hidden><p><b>The short version, as the terms give it, paraphrased:</b> the service is provided as is, with no promises or guarantees, and the reader is told to read the section carefully so they know what to expect.</p><p style="color:var(--muted)">Every section of these terms has a summary like this beside it.</p></div><p id="sc-o" aria-live="polite"></p>`;
function initial() { const c = document.getElementById('sc-i'), x = c.getContext('2d'), S = 208; x.fillStyle = '#1d3a8a'; x.fillRect(0, 0, S, S); x.fillStyle = '#a3140e'; x.fillRect(10, 10, S - 20, S - 20); x.fillStyle = '#1d3a8a'; x.fillRect(20, 20, S - 40, S - 40);
  x.strokeStyle = '#e8c766'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(S / 2, S / 2, 30 + k * 12, k * .9, k * .9 + 2.2); x.stroke(); }
  const g = x.createLinearGradient(0, 40, 0, 170); g.addColorStop(0, '#f7e3a1'); g.addColorStop(.5, '#c99a2e'); g.addColorStop(1, '#f2d27a'); x.fillStyle = g; x.font = '700 150px "Hanken Grotesk",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('G', S / 2, S / 2 + 10); x.lineWidth = 2; x.strokeStyle = '#3a2410'; x.strokeText('G', S / 2, S / 2 + 10); }
function border() { const c = document.getElementById('sc-b'), r = c.getBoundingClientRect(); c.width = Math.round(r.width); c.height = Math.round(r.height); const x = c.getContext('2d'), W = c.width, H = c.height;
  x.strokeStyle = '#a3140e'; x.lineWidth = 2; x.strokeRect(8, 8, W - 16, H - 16); x.strokeStyle = '#2b5a2a'; x.lineWidth = 1.5;
  for (let y = 20; y < H - 20; y += 34) { x.beginPath(); x.moveTo(14, y); x.bezierCurveTo(4, y + 10, 24, y + 20, 14, y + 34); x.stroke(); x.fillStyle = y % 68 ? '#c99a2e' : '#1d3a8a'; x.beginPath(); x.ellipse(20, y + 17, 4, 2, .6, 0, 7); x.fill(); } }
initial(); requestAnimationFrame(border); addEventListener('resize', border);
if (document.fonts) document.fonts.ready.then(() => { initial(); border(); }).catch(e => console.warn('fonts', e));
document.getElementById('sc-short').onclick = e => { const s = document.getElementById('sc-s'), on = s.hidden; s.hidden = !on; e.target.setAttribute('aria-pressed', String(on)); if (on) D.reveal('l2'); };
document.getElementById('sc-under').onclick = e => { const on = e.target.getAttribute('aria-pressed') !== 'true'; e.target.setAttribute('aria-pressed', String(on)); document.getElementById('sc-leaf').style.setProperty('--under', on ? '.55' : '.16');
  document.getElementById('sc-o').textContent = on ? 'Under the clause: a leaf of the Archimedes Palimpsest, a prayer book written over Archimedes.' : ''; if (on) D.reveal('l3'); };
D.tags.refresh();
