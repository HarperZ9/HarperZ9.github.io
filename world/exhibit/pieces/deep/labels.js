// Four labels, deepened: the same grey, rebuilt in our own code (layer 2) and our own correction log (layer 3).
import { depth, el } from './core.js';
import { hashAnswer } from './sha.js';

const ADELSON = 'https://planetary.org/space-images/the-checkershadow-illusion';
const cfg = {
  room: 'labels', title: 'Four labels', host: '#grid', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'One act, four stamps', found: 'Four abstract silhouettes, one act, four cards. You stamped each with the word you would use before any page showed how outlets chose.', how: 'Stamp the cards.', hint: '' },
    { id: 'l2', name: 'The same grey', found: 'Two squares on a checkerboard look different and are the same grey. Drag the bar between them and the difference goes. The surround decides what you see.', how: 'There is a checkerboard below the cards.', hint: 'Under the cards, drag the bar between square A and square B.', open: () => document.querySelector('.grey')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Our own correction', found: 'A log of our own first search for the attack the room is about: not found at 17:20, found at 17:30. Not found was a fact about the index and we reported it as if it were about the world.', how: 'The room has a record of its own mistake.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '90', note: 'The grey value, on a scale from 0 to 255, of both squares A and B in this room\'s checkerboard, read from the canvas.', src: ADELSON },
  riddle: { q: 'Swap the A in my name for an I and I stop being a tag on a jar and become a false statement that harms a person\'s name. I am on every card in this room. What do I become?', hint: 'Five letters. A false published statement that damages a reputation.', answer: 'libel', plain: 'Label with its A swapped for an I is libel, a false statement that damages a reputation. The room\'s point is that a label does the work of a verdict.', hash: hashAnswer('libel') },
  tags: [
    { id: 'act', x: 50, y: 3, layer: 'l1', kind: 'Read this first', title: 'No real person is drawn',
      body: '<p>The act is described, not shown. The silhouettes are abstract and stand for no real person. The cards and their stamps are the ones that recur in news coverage of attacks. The real attack that prompted the room is named only in the correction log, and no victim or suspect is named anywhere.</p>' },
    { id: 'cartoon', x: 5, y: 97, layer: 'l1', kind: 'Reference', title: 'A cartoon with four shooters',
      body: '<p>A cartoon circulated this week showing four shooters with four labels: Muslim, Black, in uniform, white, and the word each is given. The credit visible on the repost was two accounts. We do not reproduce it, and its licence is unchecked. The room draws its own silhouettes instead.</p>',
      src: [{ t: 'Case file, feed set 17, item B. Credit visible in the repost; licence unchecked.', s: 'u' }] },
    { id: 'plate', x: 95, y: 6, layer: 'l1', kind: 'Plate', title: 'Neratja, 26 October 1918',
      body: '<p>The front page of Neratja, a newspaper, dated 26 October 1918, public domain on Wikimedia Commons. Front pages from 1918 sit behind the cards because every page of that autumn is full of words used as verdicts. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/labels-plate.png', alt: 'A newspaper front page of dense columns of text', cap: 'Neratja front page, 26 Oct 1918. Wikimedia Commons, public domain. Resized.', w: 220 },
      src: [{ t: 'Wikimedia Commons, Neratja front page, October 26, 1918', u: 'https://commons.wikimedia.org/wiki/File:Neratja_front_page,_October_26,_1918.png', s: 'v' }] },
    { id: 'adelson', host: '.grey', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'The checkershadow illusion',
      body: '<p>Edward Adelson, a vision scientist at MIT, published the illusion in 1995. Squares A and B look different in brightness and are the same grey. Covering everything but the two squares shows it. The usual account is local contrast plus the reading of the cast shadow. This one is rebuilt in our own code with a measured value, not copied.</p>',
      src: [{ t: 'The Planetary Society, The checkershadow illusion (published by Adelson in 1995)', u: ADELSON, s: 'p' }], rooms: [{ room: 'mirror', label: 'Weigh it yourself', why: 'the surround steers the reading' }] },
  ],
  wall: {
    paras: [
      'Tell me which square is darker. Go on, A or B. Neither, because they are the same grey, and Adelson showed it in 1995 and it works on every person with working eyes, you included.[1] Your eye isn\'t broken. It compares a thing with what surrounds it, which is exactly what a label is for. I rebuilt it in my own code so you can drag a bar between the squares and watch the difference go away.',
      'Here is the same trick in words. A person kills strangers in a public place, and one act gets four different words depending on who the person was. This week a cartoon went round with four shooters and four labels, and a head of state posted that no pain should be ranked above another.[2] We did it as well: our own first search for the attack came back empty, we wrote that neither label was supported, and ten minutes later the post that settled it appeared.[3] Not found is a fact about the index.',
      'Everybody wants the stamp to be a finding. The stamps in this room are ones that recur in coverage of attacks, and you pressed one before you saw a single page.[4] I won\'t tell you which. I\'ll tell you the grey didn\'t change and the act didn\'t change, and only the ground under them did.',
    ],
    notes: [
      { t: 'Adelson, E. H. (1995), the checkershadow illusion; squares A and B are the same shade of grey and appear to differ. Secondary descriptions checked.', u: ADELSON, s: 'p' },
      { t: 'The four-shooters cartoon (credit visible, licence unchecked) and a post by a head of state calling the attack terrorist and saying "No pain must be ranked above another", translated from French and read in a screenshot; the primary post was not fetched. Case file, feed sets 17 and 18.', s: 'u' },
      { t: 'Our correction log, feed set 17: a standard search at 17:20 found no report; the post in set 18 at about 17:30 named the attack. The cause as logged: the index lagged and "not found" was reported as if it meant "unsupported".', s: 'v' },
      { t: 'The stamp words (terrorist, lone wolf, troubled man, combatant) are set here as a choice you make before you see how any outlet chose.', s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.grey { position:relative; margin:22px 0 8px; max-width:560px; border:1px solid var(--line); padding:14px 16px 12px } .grey h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .grey p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.grey canvas { width:100%; max-width:420px; height:auto; display:block; border:1px solid #3a3833; image-rendering:pixelated } .grey label { display:flex; align-items:center; gap:10px; font-weight:600; font-size:16px; margin:10px 0 } .grey input[type=range] { width:min(280px,70vw); min-height:44px; accent-color:var(--hot) }
.log { margin:20px 0; padding:14px 18px; border:1px solid #3a3833; max-width:760px; font-size:16px; line-height:1.55 } .log h2 { font:800 18px "Hanken Grotesk",sans-serif; margin:0 0 8px } .log dt { font:600 16px ui-monospace,Consolas,monospace; color:#ffe93a; margin-top:8px } .log dd { margin:2px 0 0 0 }
`));
// ---- layer 2: the checkerboard, drawn and measured here ----
const N = 8, C = 52, W = N * C, DARK = 90, M = 90 / 164, LIGHT = 164, A = [1, 2], B = [4, 4];
const g = el('section', 'grey'); g.setAttribute('aria-labelledby', 'gr-h');
g.innerHTML = `<h2 id="gr-h">Which square is darker?</h2><p>Squares A and B. Drag the bar to join them.</p><canvas id="gr-c" width="${W}" height="${W}" role="img" aria-label="A checkerboard with a soft shadow across its middle. Square A is on a light part of the board, square B is inside the shadow. A bar can be drawn from A to B."></canvas><label>Join A and B <input type="range" id="gr-r" min="0" max="100" value="0" aria-describedby="gr-o"></label><p id="gr-o" aria-live="polite">A looks darker than B.</p>`;
document.getElementById('result').after(g);
const cv = document.getElementById('gr-c'), x = cv.getContext('2d', { willReadFrequently: true });
const cx = (B[0] + .5) * C, cy = (B[1] + .5) * C;
function board() { const im = x.createImageData(W, W), d = im.data;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) { const c = Math.floor(px / C), r = Math.floor(py / C), base = (c + r) % 2 === 0 ? LIGHT : DARK, dist = Math.hypot((px - cx) / 1.35, py - cy) / C, t = Math.max(0, Math.min(1, (2.9 - dist) / 1.2)), s = t * t * (3 - 2 * t), f = 1 - (1 - M) * s, v = Math.round(base * f), i = (py * W + px) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  x.putImageData(im, 0, 0); }
function label(p, t) { x.font = '700 20px "Hanken Grotesk",sans-serif'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#000'; x.fillStyle = '#fff'; x.strokeText(t, (p[0] + .5) * C, (p[1] + .5) * C + 7); x.fillText(t, (p[0] + .5) * C, (p[1] + .5) * C + 7); }
function draw(k) { board(); if (k > 0) { const a = [(A[0] + .5) * C, (A[1] + .5) * C], b = [(B[0] + .5) * C, (B[1] + .5) * C]; x.strokeStyle = `rgb(${DARK},${DARK},${DARK})`; x.lineWidth = 24; x.lineCap = 'butt'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); x.stroke(); } label(A, 'A'); label(B, 'B'); }
draw(0); const rr = document.getElementById('gr-r'), o = document.getElementById('gr-o');
rr.oninput = () => { const k = +rr.value / 100; draw(k); if (k >= .99) { board(); const va = x.getImageData((A[0] + .35) * C, (A[1] + .3) * C, 1, 1).data[0], vb = x.getImageData((B[0] + .35) * C, (B[1] + .3) * C, 1, 1).data[0]; draw(k); o.textContent = `Joined. Read from the canvas: A is ${va}, B is ${vb}, on a scale from 0 to 255. The same grey.`; D.reveal('l2'); } else o.textContent = 'A looks darker than B.'; };
const log = el('section', 'log'); log.hidden = true; log.setAttribute('aria-labelledby', 'lg-h');
log.innerHTML = `<h2 id="lg-h">Our correction, as logged</h2><dl><dt>17:20</dt><dd>A standard search found no reporting of the attack. We wrote that neither the "terrorist" label nor the "schizophrenic" label was supported.</dd><dt>17:30</dt><dd>A post by a head of state, read in a screenshot, called it a terrorist attack on Trappes and La Verrière. It contradicted the second label.</dd><dt>Cause</dt><dd>The search index lagged, and we reported "not found" as if it meant "unsupported". Not found is a fact about the index, not about the world.</dd></dl><p style="color:#a39e94">Source: our case file, feed sets 17 and 18. No victim or suspect is named here. The post itself was not fetched.</p>`;
D.section.before(log); D.on('l3', () => { log.hidden = false; });
D.settle(document.getElementById('grid'));
