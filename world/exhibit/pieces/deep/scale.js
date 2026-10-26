// How a scale lies, deepened: the standard that drifted (layer 2) and the standard that became a number (layer 3).
import { depth, el } from './core.js';
import { hashAnswer } from './sha.js';

const LYN = 'https://lynceans.org/lobners-lynx/page/17/';
const cfg = {
  room: 'scale', title: 'How a scale lies, in 7 steps', host: '#st', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'Seven steps', found: 'Beam, pans, pivot, calibration, a hidden wedge, the reading, and who built it. Each step is true, and together they make a scale that lies.', how: 'Step through the explainer.', hint: '' },
    { id: 'l2', name: 'The standard drifts', found: 'For 130 years the kilogram was an object. Its official copies drifted from it by about 50 micrograms in a century, and nobody could say whether the copies gained or the master lost.', how: 'The last step has a standard underneath it.', hint: 'Under the explainer, drag the year slider across a century.', open: () => document.querySelector('.drift')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The standard became a number', found: 'In 2019 the kilogram stopped being a cylinder and became a number: the Planck constant, fixed. The object is now one more mass measured against it.', how: 'The standard has a later history.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '50', note: 'About 50 micrograms: the average gain of the kilogram\'s official copies against the master over about a century.', src: LYN },
  riddle: { q: 'I am the one fixed point of the scale. If I sit off centre, every reading carries the same error and none of them shows it. I am step three of seven. What am I?', hint: 'Five letters. The beam turns on it.', answer: 'pivot', plain: 'The pivot is step three of the explainer: the single fixed point the beam turns on. An error there repeats in every reading.', hash: hashAnswer('pivot') },
  tags: [
    { id: 'beam', x: 25, y: 50, layer: 'l1', kind: 'Plate', title: 'Justice with a balance',
      body: '<p>An etching of Justice with sword and balance, from the Wellcome Collection (Thomas Jenner, dated "16--"), public domain. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/scale-plate.png', alt: 'An etching of a woman holding a sword and a balance', cap: 'Wellcome Collection, public domain. Resized.', w: 200 },
      src: [{ t: 'Wellcome Collection, work h8kcwwgy', u: 'https://wellcomecollection.org/works/h8kcwwgy', s: 'v' }], rooms: [{ room: 'balance', label: 'The False Balance', why: 'the same parts, in one picture' }] },
    { id: 'steps', x: 92, y: 8, layer: 'l1', kind: 'Reference', title: 'The explainer format',
      body: '<p>A stepped explainer after Maxime Heckel\'s "Lighting That Feels Just Right". The parts are the balance\'s: beam, pans, pivot, standard, wedge. Step 7 says who built it, and the answer is the author.</p>' },
    { id: 'ipk', host: '.drift', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'The International Prototype Kilogram',
      body: '<p>A cylinder of platinum and iridium kept at the International Bureau of Weights and Measures near Paris, which defined the kilogram from 1889 until 2019. Its stability could only be checked by comparing it with copies. NIST, quoted on a secondary site, says most official copies gained about 50 micrograms against it over 100 years, and that the master itself could be losing mass. The cause is not known.</p>',
      src: [{ t: 'NIST statement as quoted on lynceans.org', u: LYN, s: 'p' }, { t: 'Science News, "It\'s official: We\'re redefining the kilogram"', u: 'https://www.sciencenews.org/article/official-redefining-kilogram-units-measurement', s: 'p' }] },
  ],
  wall: {
    paras: [
      'Why does the scale lie? Seven steps and there is no villain, only a wedge, a pivot nobody measured and a standard nobody checked. Fix the beam and the pans and the pivot and it is still the standard that gives way, because a standard is just the last scale in the chain. For 130 years the kilogram was a cylinder of platinum and iridium at the international bureau near Paris, and when they compared it with its official copies the copies drifted from it by about fifty micrograms in a century.[1] Nobody could say whether the copies were gaining or the master was losing.',
      'Eventually they gave up on objects. In 2019 the kilogram stopped being a thing and became a number, the Planck constant fixed at an exact value, and the cylinder became one more mass to measure against it.[2] That is the honest ending of step seven. The way out of who weighs the weigher is to move the standard out of anyone\'s hands, and even then you are trusting whoever built the balance that realises it. I am not telling you that is comforting.',
    ],
    notes: [
      { t: 'NIST, quoted on a secondary site: most official copies gained about 50 micrograms relative to the International Prototype Kilogram over about 100 years, and the master itself could be losing mass; the cause is not known. The IPK defined the kilogram from 1889.', u: LYN, s: 'p' },
      { t: 'The 2018 vote and the 20 May 2019 effective date; the kilogram tied to a fixed value of the Planck constant, 6.62607015 x 10^-34 J s, realised by instruments such as the Kibble balance. Read in press and reference coverage; the BIPM text was not opened.', u: 'https://www.sciencenews.org/article/official-redefining-kilogram-units-measurement', s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.drift, .num { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .drift h2, .num h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .drift p, .num p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.drift svg { width:100%; max-width:520px; height:auto; background:#0d2c4f; border:1px solid var(--line) } .drift label { display:flex; align-items:center; gap:10px; font-weight:600; font-size:16px; margin:8px 0 } .drift input[type=range] { width:min(300px,70vw); min-height:44px; accent-color:var(--hot) }
.num .big { font:800 clamp(22px,4vw,34px)/1.2 "Hanken Grotesk",sans-serif; margin:8px 0; word-break:break-word }
`));
const dr = el('section', 'drift'); dr.setAttribute('aria-labelledby', 'dr-h');
dr.innerHTML = `<h2 id="dr-h">Who weighs the standard?</h2><p>A schematic of the reported drift: the average gain of the official copies against the master, about 50 micrograms over a century. The line is an even slope drawn through that average, not the measured series.</p>
<svg viewBox="0 0 520 200" role="img" aria-label="A chart. The horizontal axis runs from 1889 to 1989. The vertical axis shows micrograms of drift, up to 50. A line rises evenly from zero to fifty."><line x1="40" y1="170" x2="500" y2="170" stroke="#a39e94"/><line x1="40" y1="170" x2="40" y2="20" stroke="#a39e94"/><text x="40" y="190" fill="#a39e94" font-size="16">1889</text><text x="470" y="190" fill="#a39e94" font-size="16">1989</text><text x="46" y="32" fill="#a39e94" font-size="16">50 micrograms</text><polyline id="dr-l" points="40,170 40,170" fill="none" stroke="#e0177e" stroke-width="3"/><circle id="dr-c" cx="40" cy="170" r="6" fill="#ffe93a"/></svg>
<label>Years since 1889 <input type="range" id="dr-r" min="0" max="100" value="0" aria-describedby="dr-o"></label><p id="dr-o" aria-live="polite">Year 0, 1889. The copies agree with the master.</p>`;
document.getElementById('st').after(dr);
const R = document.getElementById('dr-r');
R.oninput = () => { const y = +R.value, x = 40 + y * 4.6, yy = 170 - y * 1.5; document.getElementById('dr-l').setAttribute('points', `40,170 ${x},${yy}`); const c = document.getElementById('dr-c'); c.setAttribute('cx', x); c.setAttribute('cy', yy);
  document.getElementById('dr-o').textContent = `${y} years on, ${1889 + y}. Average drift about ${(y / 2).toFixed(1)} micrograms. Whether the copies gain or the master loses is not known.`; if (y >= 100) D.reveal('l2'); };
const nm = el('section', 'num'); nm.hidden = true; nm.setAttribute('aria-labelledby', 'nm-h');
nm.innerHTML = `<h2 id="nm-h">The standard that is a number</h2><p>From 20 May 2019 the kilogram is defined by fixing the Planck constant:</p><p class="big">h = 6.62607015 x 10<sup>-34</sup> J s</p><p>The cylinder is no longer the definition. A balance that measures electromagnetic force, a Kibble balance, realises the unit. Sources: Science News and reference coverage, read for this room. The BIPM text was not opened.</p>`;
D.section.before(nm); D.on('l3', () => { nm.hidden = false; });
// the stepper builds its own children after this module runs, so draw the tags again once it has
const wt = setInterval(() => { if (document.querySelector('#st > *')) { clearInterval(wt); setTimeout(() => { D.tags.refresh(); D.settle(document.getElementById('st')); }, 400); } }, 200);
