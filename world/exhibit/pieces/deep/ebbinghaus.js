// The same circle: two equal discs, one among large circles and one among small (layer 1), the same trick with numerals (layer 2),
// and the second edge, a ruler and the hand that is fooled less (layer 3).
import { depth, el } from './core.js';

const EB = 'https://en.wikipedia.org/wiki/Ebbinghaus_illusion', AG = 'https://pubmed.ncbi.nlm.nih.gov/7552179/', HS = 'https://www.hstoday.us/subject-matter-areas/law-enforcement-and-public-safety/fbi-releases-2025-crime-data-showing-sharp-drop-in-violent-offenses/';
const cfg = {
  room: 'ebbinghaus', title: 'The same circle', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'Two equal discs', found: "The disc ringed by big circles looks smaller than the disc ringed by small ones. Fade the rings out and they match, because they were drawn with the same radius.", how: 'Compare the two middle discs.', hint: '' },
    { id: 'l2', name: 'A number in company', found: "The same 4.1, set at the same size, looks smaller among big numerals and bigger among small ones. A figure is read against what is printed beside it, which is why the choice of comparison is an editorial act.", how: 'Numbers have surroundings too.', hint: 'Under the discs, press Try it with a number.', open: () => document.getElementById('eb-num')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The ruler is a surround you agree on', found: "A comparison misled you, and a comparison fixes it: a ruler is only a surround everyone has agreed to use. Aglioti, DeSouza and Goodale (1995) reported that people's grip was scaled to the discs' true size even when their eyes were fooled. Later studies dispute how far the hand escapes.", how: 'The trick has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'titch', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'Ebbinghaus, then Titchener',
      body: "<p>Hermann Ebbinghaus, the German psychologist best known for the forgetting curve, is credited with the illusion. Edward Titchener brought it to English readers in a 1901 textbook of experimental psychology, so it is also called Titchener circles. This version is drawn in our own code and measured on the canvas.</p>",
      src: [{ t: 'Wikipedia, Ebbinghaus illusion', u: EB, s: 'p' }] },
    { id: 'rate', x: 97, y: 24, layer: 'l2', kind: 'Reference', title: '4.1 per 100,000',
      body: "<p>The figure in the middle is the 2025 US murder rate on the FBI series, as reported: 4.1 per 100,000, tied with 1955 and 1956. The CDC series gives 5.9 for 2024. Both are real. A headline that sets 4.1 beside 5.9 tells a different story from one that sets it beside 1955, without changing a digit.</p>",
      src: [{ t: 'FBI 2025 data as reported by HSToday; CDC 2024 figure from the case file. Same sources as the mirror room.', u: HS, s: 'p' }], rooms: [{ room: 'mirror', label: 'Weigh it yourself', why: 'two series, one headline that picked' }] },
    { id: 'hand', x: 97, y: 44, layer: 'l3', kind: 'Reference', title: 'The eye and the hand',
      body: "<p>Aglioti, DeSouza and Goodale (1995) had 14 people judge and grasp physical discs set in a Titchener ring. Their judgements followed the illusion; their grip opening mostly followed the true size. Later work, by Franz and others, found the grip is affected too, so the claim is contested.</p>",
      src: [{ t: 'Aglioti, DeSouza and Goodale (1995), Size-contrast illusions deceive the eye but not the hand, Current Biology 5(6):679-685, PMID 7552179. Abstract read.', u: AG, s: 'p' }, { t: 'Wikipedia, Ebbinghaus illusion, on Goodale and on Franz et al. (2005)', u: EB, s: 'p' }] },
  ],
  wall: {
    paras: [
      "Put a coin next to a dinner plate and it shrinks. Put it among buttons and it's a medallion. Ebbinghaus knew this before your grandparents were born and Titchener taught it to English readers in 1901.[1] The two discs on this screen are the same radius, I drew them, and you still lose the argument with your own eyes.",
      "Numbers live in rings too. 4.1 murders per 100,000 sounds like a lot until you put it beside 5.9 from another series, and then it sounds like progress until you put it beside 1955.[2] I didn't change a digit. I changed the company it keeps, which is the whole job of the person who writes the chart title.",
      "The cure is the same disease. A ruler is a surround we all agreed on, and the moment you agree on one the discs stop lying.[3] So when somebody hands you a number, ask what they put next to it, and then ask what they left off the page.",
    ],
    notes: [
      { t: 'Ebbinghaus illusion: attributed to Hermann Ebbinghaus; popularised in English by Titchener in a 1901 textbook. Wikipedia.', u: EB, s: 'p' },
      { t: 'FBI 2025 US murder rate 4.1 per 100,000, tied with 1955 and 1956, as reported by HSToday; CDC series 5.9 for 2024 from the case file, not reopened.', u: HS, s: 'p' },
      { t: 'Aglioti, S., DeSouza, J. F. X. and Goodale, M. A. (1995), Current Biology 5(6):679-685, DOI 10.1016/s0960-9822(95)00133-3. Contested by later studies (for example Franz and colleagues).', u: AG, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.eb canvas { display:block; width:min(100%,640px); height:auto; background:#161513; border:1px solid var(--line); margin:8px 0 } .eb .row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:8px 0 }
.eb label { display:flex; align-items:center; gap:10px; font-weight:600; font-size:16px } .eb input[type=range] { width:min(260px,60vw); min-height:44px; accent-color:var(--hot) }
`));
const st = document.getElementById('stage'); st.classList.add('eb');
st.innerHTML = `<canvas id="eb-c" width="640" height="320" role="img" aria-label="Two middle discs of the same size, the left one ringed by six large circles, the right one by eight small circles"></canvas>
<div class="row"><label>Fade the rings <input type="range" id="eb-r" min="0" max="100" value="0" aria-describedby="eb-o"></label></div>
<div class="row"><button type="button" id="eb-num" aria-pressed="false">Try it with a number</button><button type="button" id="eb-rule" hidden>Lay a ruler across</button></div>
<p id="eb-o" aria-live="polite">Which middle disc is bigger?</p>`;
const cv = document.getElementById('eb-c'), x = cv.getContext('2d', { willReadFrequently: true }), out = document.getElementById('eb-o'), R = 30, L = [170, 160], Rt = [470, 160];
let mode = 'disc', fade = 0, ruler = false;
const ring = (c, n, d, r, k) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; k(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, r); } };
function draw() {
  x.fillStyle = '#161513'; x.fillRect(0, 0, 640, 320); const al = 1 - fade;
  if (mode === 'disc') {
    x.fillStyle = `rgba(163,158,148,${al})`; ring(L, 6, 112, 52, (a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }); ring(Rt, 8, 52, 12, (a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
    x.fillStyle = '#e0177e'; [L, Rt].forEach(c => { x.beginPath(); x.arc(c[0], c[1], R, 0, 7); x.fill(); });
  } else {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = `rgba(163,158,148,${al})`;
    x.font = '800 54px "Hanken Grotesk",sans-serif'; ring(L, 6, 112, 0, (a, b) => x.fillText('5.9', a, b)); x.font = '800 14px "Hanken Grotesk",sans-serif'; ring(Rt, 8, 54, 0, (a, b) => x.fillText('5.9', a, b));
    x.fillStyle = '#e0177e'; x.font = '800 34px "Hanken Grotesk",sans-serif'; [L, Rt].forEach(c => x.fillText('4.1', c[0], c[1]));
  }
  if (ruler) { x.strokeStyle = '#ffe93a'; x.lineWidth = 2; [L, Rt].forEach(c => { x.beginPath(); x.moveTo(c[0] - R, c[1] + 46); x.lineTo(c[0] + R, c[1] + 46); x.stroke(); for (let k = 0; k <= 6; k++) { x.beginPath(); x.moveTo(c[0] - R + k * 10, c[1] + 40); x.lineTo(c[0] - R + k * 10, c[1] + 52); x.stroke(); } }); }
}
// measured from the canvas: the width of the hot disc along its middle row, with the rings faded out of the way
function measure(c) { const d = x.getImageData(c[0] - 60, c[1], 120, 1).data; let n = 0; for (let i = 0; i < 120; i++) if (d[i * 4] > 200 && d[i * 4 + 1] < 60) n++; return n; }
draw();
document.getElementById('eb-r').oninput = e => { fade = +e.target.value / 100; draw();
  if (fade >= .99) { const m = mode === 'disc' ? `Measured on the canvas, along the middle row: left ${measure(L)} pixels, right ${measure(Rt)} pixels.` : 'The two numerals are set in the same type at the same size.'; out.textContent = 'Rings gone. ' + m + ' The same.'; D.reveal('l1'); }
  else out.textContent = mode === 'disc' ? 'Which middle disc is bigger?' : 'Which 4.1 looks bigger?'; };
document.getElementById('eb-num').onclick = e => { const on = mode === 'disc'; mode = on ? 'num' : 'disc'; e.target.setAttribute('aria-pressed', String(on)); e.target.textContent = on ? 'Back to the discs' : 'Try it with a number'; cv.setAttribute('aria-label', on ? 'The figure 4.1 printed twice at the same size, the left one ringed by six large 5.9 numerals, the right one by eight small ones' : 'Two middle discs of the same size, the left one ringed by six large circles, the right one by eight small circles'); draw(); out.textContent = on ? 'Which 4.1 looks bigger? They are set in the same type at the same size. Only the 5.9s around them change size.' : 'Which middle disc is bigger?'; if (on) D.reveal('l2'); };
D.on('l3', () => { const b = document.getElementById('eb-rule'); b.hidden = false; b.onclick = () => { ruler = !ruler; draw(); out.textContent = ruler ? 'A ruler under each, six marks, ten pixels apart. Agree on the marks and the illusion has nothing to argue with.' : 'Ruler away.'; }; });
D.tags.refresh();
