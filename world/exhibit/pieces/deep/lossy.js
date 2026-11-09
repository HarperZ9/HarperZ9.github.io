// Lossy, deepened: a patch-matching compressor that turns a six into an eight (layer 2) and a hash that changes completely (layer 3).
import { depth, el } from './core.js';
import { hashAnswer, sha256 } from './sha.js';

const NEWS = 'https://www.cnbc.com/amp/id/100945451';
const cfg = {
  room: 'lossy', title: 'Lossy', host: '.trio', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'What was cheap to keep', found: 'A portrait is compressed again and again. The compressor keeps the sky and drops the face, and the hash of the original still proves which picture it was.', how: 'Squeeze the portrait.', hint: '' },
    { id: 'l2', name: 'A six becomes an eight', found: 'A simple patch-matching compressor reuses a shape it thinks is the same. Turn the tolerance up and a six is replaced by an eight. In 2013 a scanner did this to numbers on a building plan.', how: 'Another compressor sits below the portrait.', hint: 'Under the hashes, raise the tolerance slider until the scanned numbers change.', open: () => document.querySelector('.jb')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Change one character', found: 'Change one character of the original and nearly every digit of its hash changes. The hash keeps the identity and none of the content.', how: 'The hash has a second trick.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '14.13', note: 'A room measured 21.11 square metres on a plan; a Xerox scanner in 2013 copied it as 14.13.', src: NEWS },
  riddle: { q: 'Take the last letter off me and I am what a squeezed copy has too much of. Put it back and I describe every copy in this room that keeps what is cheap to keep. What am I?', hint: 'Five letters. A compression that throws information away is called this.', answer: 'lossy', plain: 'Lossy minus its Y is loss. A lossy format, like JPEG, throws away information to make files small. The room is about what it chooses to throw away.', hash: hashAnswer('lossy') },
  tags: [
    { id: 'girl', x: 8, y: 10, layer: 'l1', kind: 'Plate', title: 'A girl, Queensland, 1890s',
      body: '<p>A studio portrait of a young girl from the 1890s, State Library of Queensland, public domain on Wikimedia Commons. We do not know her name from the file. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/lossy-plate.png', alt: 'A studio portrait of a young girl in a long dress, 1890s', cap: 'State Library of Queensland via Wikimedia Commons, public domain. Resized.', w: 220 },
      src: [{ t: 'Wikimedia Commons, StateLibQld_2_49524', u: 'https://commons.wikimedia.org/wiki/File:StateLibQld_2_49524_Studio_portrait_of_a_young_girl,_1890s.jpg', s: 'v' }], rooms: [{ room: 'palimpsest', label: 'Palimpsest', why: 'a sample that keeps what is cheap to keep' }] },
    { id: 'jpeg', x: 50, y: 10, layer: 'l1', kind: 'Reference', title: 'JPEG, 1992',
      body: '<p>ITU-T Recommendation T.81, approved in September 1992, is the JPEG standard: a process for compressing continuous-tone still images. It was built by the Joint Photographic Experts Group, formed in 1986. T.81 defines the compressed data; the .jpg file is usually a JFIF or Exif container around it.</p>',
      src: [{ t: 'ITU-T T.81 record', u: 'https://www.itu.int/ITU-T/recommendations/rec.aspx?rec=2633', s: 'p' }] },
    { id: 'dots', x: 92, y: 10, layer: 'l1', kind: 'Read this first', title: 'The dots are measured',
      body: '<p>The right-hand picture colours each place by how much of its fine detail was lost. Nothing in it is stored or sent: the compression runs in your browser.</p>' },
    { id: 'xerox', host: '.jb', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'The Xerox number bug, 2013',
      body: '<p>David Kriesel found that Xerox WorkCentre 7535 and 7556 machines altered numbers in scans. A room of 21.11 square metres on a plan came out as 14.13, and sixes turned into eights. He attributed it to JBIG2 compression, which reuses patches of the image it takes to be the same, with OCR switched off. Xerox said the bug appeared at its lowest quality and highest compression setting, then that raising the quality did not remove it entirely, and released a patch that disables the highest compression mode.</p>',
      src: [{ t: 'CNBC, Copier conundrum: Xerox machines swap numbers during scans', u: NEWS, s: 'p' }, { t: 'TidBITS, researcher finds some copiers can alter scanned numbers', u: 'https://tidbits.com/2013/08/05/researcher-finds-some-copiers-can-alter-scanned-numbers/', s: 'p' }] },
  ],
  wall: {
    paras: [
      'The compressor keeps what is cheap to keep. Faces go first, then hands, and the sky survives, because nobody asked the compressor what mattered. Squeeze the girl\'s portrait to a stranger\'s quality and the hash of the original still proves which picture it was, while the copy proves nothing about what you can still see.[1]',
      'Here is the one that ought to scare you. In 2013 a German researcher found that a Xerox scanner had copied a room measuring 21.11 square metres as 14.13, and a cost figure had changed as well. The machine was not broken in any way you could see. It reused patches of the picture it judged to be the same, and sometimes it judged a six to be an eight.[2] Nobody received a corrupted file. They received a clean, confident, wrong one.',
      'Everything we keep is a copy of a copy of something nobody can ask any more. I rebuilt the trick in the panel so you can turn the knob and watch a number change its mind. Then the hash: change one character and nearly every digit of it changes. It proves which memory it was and never shows you the face.',
    ],
    notes: [
      { t: 'ITU-T T.81, the JPEG standard, approved September 1992; the JPEG committee formed in 1986. The ITU record and a summary were read; the standard text was not.', u: 'https://www.itu.int/ITU-T/recommendations/rec.aspx?rec=2633', s: 'p' },
      { t: 'David Kriesel, August 2013: Xerox WorkCentre 7535 and 7556 scans changed numbers (21.11 became 14.13 on a plan; sixes became eights); cause attributed to JBIG2 patch reuse; Xerox patched. Read in news coverage (CNBC, TidBITS and others), not in Kriesel\'s own post.', u: NEWS, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.jb, .av { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .jb h2, .av h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .jb p, .av p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.jb canvas { display:block; width:min(100%,420px); height:auto; background:#0b0b0b; border:1px solid var(--line); margin:6px 0; image-rendering:pixelated } .jb label { display:flex; align-items:center; gap:10px; font-weight:600; font-size:16px; margin:10px 0 } .jb input[type=range] { width:min(280px,70vw); min-height:44px; accent-color:var(--hot) }
.av input[type=text] { font:inherit; min-height:44px; padding:6px 10px; background:#0c0c0c; color:var(--ink); border:2px solid var(--ink); width:min(300px,80vw) } .av code { display:block; font:15px/1.5 ui-monospace,Consolas,monospace; word-break:break-all; margin:4px 0 10px } .av code b { color:#ffe93a }
`));
// ---- layer 2: a patch-matching compressor on a 5 by 7 bitmap font ----
const FONT = { '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110', '2': '01110,10001,00001,00010,00100,01000,11111', '3': '11110,00001,00001,01110,00001,00001,11110', '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110', '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000', '8': '01110,10001,10001,01110,10001,10001,01110', '9': '01110,10001,10001,01111,00001,00010,01100', '.': '00000,00000,00000,00000,00000,01100,01100' };
const bits = c => FONT[c].split(',').join('').split('').map(Number), dist = (a, b) => bits(a).reduce((s, v, i) => s + (v !== bits(b)[i]), 0);
const SRC = '86.68';
const jb = el('section', 'jb'); jb.setAttribute('aria-labelledby', 'jb-h');
jb.innerHTML = `<h2 id="jb-h">A compressor that reuses shapes</h2><p>An invented demonstration of the mechanism, not Xerox's code. The scanner reads "${SRC}" as small bitmaps. To save space it keeps a dictionary of shapes and reuses an old shape for any new one that is close enough. Raise the tolerance and see what survives.</p><canvas id="jb-c" width="330" height="130" role="img" aria-label="Two rows of pixel digits, the original and the compressed copy"></canvas><label>Tolerance, in pixels that may differ <input type="range" id="jb-t" min="0" max="12" value="0" aria-describedby="jb-o"></label><p id="jb-o" aria-live="polite"></p>`;
const heat = document.querySelector('.hash:last-of-type') || document.querySelector('.ctl'); (document.querySelectorAll('.hash')[1] || document.querySelector('.ctl')).after(jb);
const cvs = document.getElementById('jb-c'), x = cvs.getContext('2d'), P = 8;
function squeeze(t) { const dict = []; return [...SRC].map(c => { const hit = dict.find(d => dist(c, d) <= t); if (hit) return hit; dict.push(c); return c; }); }
function row(txt, y, col) { [...txt].forEach((c, i) => { bits(c).forEach((b, k) => { if (b) { x.fillStyle = col; x.fillRect(12 + i * 6.4 * P + (k % 5) * P, y + Math.floor(k / 5) * P, P - 1, P - 1); } }); }); }
function paint() { const t = +document.getElementById('jb-t').value, out = squeeze(t).join(''); x.clearRect(0, 0, 330, 130); x.fillStyle = '#a39e94'; x.font = '16px sans-serif'; row(SRC, 8, '#eee9df'); row(out, 70, out === SRC ? '#eee9df' : '#ffe93a');
  document.getElementById('jb-o').textContent = out === SRC ? `Tolerance ${t}: the copy reads ${out}. Nothing lost.` : `Tolerance ${t}: the original reads ${SRC}. The copy reads ${out}. The copy is clean, confident and wrong.`; if (out !== SRC) D.reveal('l2'); }
document.getElementById('jb-t').oninput = paint; paint();
// ---- layer 3: the hash that changes completely ----
const av = el('section', 'av'); av.hidden = true; av.setAttribute('aria-labelledby', 'av-h');
av.innerHTML = `<h2 id="av-h">One character, a different hash</h2><p>Type a line. Below, its SHA-256, and the SHA-256 of the same line with its last character changed by one.</p><label>A line <input type="text" id="av-i" value="21.11 square metres"></label><code id="av-a"></code><code id="av-b"></code><p id="av-o" aria-live="polite"></p>`;
D.section.before(av); D.on('l3', () => { av.hidden = false; upd(); });
function upd() { const v = document.getElementById('av-i').value || ' ', w = v.slice(0, -1) + String.fromCharCode(v.charCodeAt(v.length - 1) ^ 1), a = sha256(v), b = sha256(w); let n = 0, ha = '', hb = ''; for (let i = 0; i < 64; i++) { const same = a[i] === b[i]; if (!same) n++; ha += same ? a[i] : `<b>${a[i]}</b>`; hb += same ? b[i] : `<b>${b[i]}</b>`; }
  document.getElementById('av-a').innerHTML = ha; document.getElementById('av-b').innerHTML = hb; document.getElementById('av-o').textContent = `${n} of 64 digits differ. The hash proves which line it was and says nothing about what the line meant.`; }
document.getElementById('av-i').oninput = upd;
D.settle(document.querySelector('.trio'));
