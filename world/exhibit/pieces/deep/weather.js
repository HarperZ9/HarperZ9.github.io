// Forecast for a war (CONTRASTS B14): a 1950s-style television weather map whose fronts are the July Crisis, 28 June to 4 August 1914.
// Layer 1 the forecast, layer 2 name the hands (the same steps with their actors), layer 3 what a pressure map is good for.
import { depth, el } from './core.js';

const JC = 'https://en.wikipedia.org/wiki/July_Crisis';
const CITY = { London: [-0.1, 51.5], Paris: [2.35, 48.85], Brussels: [4.35, 50.85], Berlin: [13.4, 52.5], Vienna: [16.37, 48.2], Belgrade: [20.46, 44.8], Sarajevo: [18.4, 43.86], 'St Petersburg': [30.3, 59.9] };
const STEPS = [
  { d: '28 June', low: ['Sarajevo'], fronts: [], fc: 'A small, sharp low has formed over Sarajevo. Most forecasters expect it to blow itself out.', fact: 'Archduke Franz Ferdinand, heir to Austria-Hungary, is assassinated at Sarajevo.' },
  { d: '23 July', low: ['Sarajevo', 'Vienna'], fronts: [['Vienna', 'Belgrade']], fc: 'A cold front pushes south-east from Vienna towards Belgrade, with a 48-hour window before it arrives.', fact: 'Austria-Hungary presents an ultimatum to Serbia, with 48 hours to reply, expiring at 6 pm on 25 July.' },
  { d: '28 July', low: ['Vienna', 'Belgrade'], fronts: [['Vienna', 'Belgrade']], fc: 'The front reaches Belgrade. Heavy weather over the Danube.', fact: 'Austria-Hungary declares war on Serbia.' },
  { d: '30 July', low: ['Vienna', 'Belgrade', 'St Petersburg'], fronts: [['Vienna', 'Belgrade'], ['St Petersburg', 'Vienna']], fc: 'A deep system builds over St Petersburg and begins to move.', fact: 'Russia orders general mobilisation.' },
  { d: '1 August', low: ['Berlin', 'St Petersburg', 'Belgrade'], fronts: [['Vienna', 'Belgrade'], ['Berlin', 'St Petersburg']], fc: 'Pressure falls sharply over Berlin. A front runs north-east to St Petersburg.', fact: 'Germany declares war on Russia.' },
  { d: '3 August', low: ['Berlin', 'Paris', 'St Petersburg'], fronts: [['Berlin', 'St Petersburg'], ['Berlin', 'Paris']], fc: 'The Berlin system extends a second front west, towards Paris.', fact: 'Germany declares war on France.' },
  { d: '4 August', low: ['Berlin', 'Brussels', 'London', 'Paris'], fronts: [['Berlin', 'Paris'], ['Berlin', 'Brussels'], ['London', 'Berlin']], fc: 'The front crosses the Low Countries. By midnight, unsettled conditions everywhere on the map.', fact: 'Germany declares war on Belgium. Britain\'s ultimatum to Germany expires at midnight Berlin time, and Britain is at war with Germany.' },
];
const cfg = {
  room: 'weather', title: 'Forecast for a war', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'Seven forecasts', found: "Five weeks of 1914 as a calm television forecast: lows, fronts, a 48-hour window. Every step is a real date. In weather language nobody decides anything; conditions just arrive.", how: 'Step through the dates.', hint: '' },
    { id: 'l2', name: 'Name the hands', found: "The same seven steps with their subjects put back: who presented the ultimatum, who mobilised, who declared war on whom, and when. The forecast had no verbs that anyone did. The record is all verbs.", how: 'The forecast can be translated.', hint: 'Press Name the hands under the map.', open: () => document.getElementById('wx-hands')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'What a pressure map is for', found: "Weather language removes the people, which is how a war gets described as something that happened. A pressure map is also the clearest picture of a cascade: a low in one place pulls on the next through ties you can draw. The same map that hides the hands shows the alliances.", how: 'The map has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'jc', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'The July Crisis',
      body: '<p>The dates are from the July Crisis as summarised by Wikipedia: 28 June, the assassination; 23 July, the ultimatum with a 48-hour limit; 28 July, Austria-Hungary declares war on Serbia; 30 July, Russian general mobilisation; 1 August, Germany declares war on Russia; 3 August, on France; 4 August, on Belgium, and Britain\'s ultimatum expires at midnight Berlin time.</p>',
      src: [{ t: 'Wikipedia, July Crisis', u: JC, s: 'p' }] },
    { id: 'map', x: 97, y: 30, layer: 'l1', kind: 'Read this first', title: 'The map is schematic',
      body: '<p>Cities are placed by longitude and latitude on a plain grid with no coastlines. Lows mark where a decision was taken that day; fronts join the two capitals it bound. It is a picture of the sequence, not of armies or territory.</p>' },
    { id: 'tv', x: 97, y: 56, layer: 'l1', kind: 'Reference', title: 'The television forecast',
      body: '<p>Early television forecasts drew isobars and fronts on a chart by hand in front of a camera. The look here, a grey glass screen with soft scan lines, is drawn in our code and imitates no particular broadcaster.</p>', rooms: [{ room: 'groove', label: 'The skipping groove', why: 'momentum as permission' }] },
  ],
  wall: {
    paras: [
      "Nobody gets blamed for rain. That's why every war wants to be weather. Read a forecast for July 1914 and it sounds like a calm man with a pointer: a small low over Sarajevo, a cold front from Vienna with a forty-eight hour window, unsettled everywhere by the fourth.[1]",
      "Every one of those lows was a decision with a date on it. A government wrote the ultimatum and picked the deadline, six in the evening on the twenty-fifth. Another government mobilised. Declarations went out on the first, the third and the fourth.[1] Press Name the hands and the verbs come back.",
      "The awful thing is that the map isn't wrong. Pressure in one capital really did pull on the next, through treaties you could draw as lines, and a weather chart shows that better than a paragraph.[1] The same picture that takes the people out of the sentence shows you exactly where they were tied together.",
    ],
    notes: [
      { t: 'July Crisis, dates and the ultimatum deadline (presented 23 July 1914, 48 hours, expiring 6 pm on 25 July); Russian general mobilisation 30 July; German declarations of war on Russia (1 Aug), France (3 Aug) and Belgium (4 Aug); British ultimatum expiring at midnight Berlin time on 4 August. Wikipedia.', u: JC, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.wx .tv { max-width:720px; background:#2a2c2a; padding:clamp(10px,2.4vw,22px); border-radius:28px; border:1px solid var(--line) } .wx canvas { display:block; width:100%; height:auto; border-radius:22px }
.wx .row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:12px 0 } .wx label { display:flex; align-items:center; gap:10px; font-weight:600 } .wx input[type=range] { width:min(320px,70vw); min-height:44px; accent-color:var(--hot) }
.wx .fc { font:400 clamp(18px,2.4vw,21px)/1.55 "Hanken Grotesk",sans-serif; max-width:66ch; min-height:3.2em; margin:6px 0 } .wx .date { font-weight:800; font-size:18px; margin:0 }
`));
const st = document.getElementById('stage'); st.classList.add('wx');
st.innerHTML = `<div class="tv"><canvas id="wx-c" width="720" height="460" role="img" aria-label="A grey television weather chart of Europe"></canvas></div>
<div class="row"><label>Date <input type="range" id="wx-r" min="0" max="${STEPS.length - 1}" value="0" step="1" aria-describedby="wx-f"></label><button type="button" id="wx-hands" aria-pressed="false">Name the hands</button></div>
<p class="date" id="wx-d"></p><p class="fc" id="wx-f" aria-live="polite"></p>`;
const cv = document.getElementById('wx-c'), x = cv.getContext('2d'); let k = 0, hands = false;
const P = ([lo, la]) => [110 + (lo + 2) / 34 * 540, 420 - (la - 42) / 19 * 370];
function draw() { const S = STEPS[k];
  const g = x.createRadialGradient(360, 230, 60, 360, 230, 460); g.addColorStop(0, '#c9cfc8'); g.addColorStop(1, '#7f8781'); x.fillStyle = g; x.fillRect(0, 0, 720, 460);
  x.strokeStyle = 'rgba(40,46,42,.18)'; x.lineWidth = 1; for (let i = 0; i < 720; i += 60) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 460); x.stroke(); } for (let j = 0; j < 460; j += 60) { x.beginPath(); x.moveTo(0, j); x.lineTo(720, j); x.stroke(); }
  S.low.forEach((c, n) => { const [px, py] = P(CITY[c]); x.strokeStyle = 'rgba(30,34,32,.55)'; x.lineWidth = 1.6; for (let r = 1; r <= 3; r++) { x.beginPath(); x.ellipse(px, py, 11 * r, 8 * r, .3, 0, 7); x.stroke(); }
    x.fillStyle = '#1e2220'; x.font = '800 26px "Hanken Grotesk",sans-serif'; x.textAlign = 'center'; x.fillText('L', px + 30, py - 22); });
  S.fronts.forEach(([a, b]) => { const [ax, ay] = P(CITY[a]), [bx, by] = P(CITY[b]), n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 34)), ang = Math.atan2(by - ay, bx - ax);
    x.strokeStyle = '#1d3a8a'; x.lineWidth = 3; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.fillStyle = '#1d3a8a';
    for (let i = 1; i < n; i++) { const t = i / n, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t; x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.lineTo(0, -11); x.closePath(); x.fill(); x.restore(); } });
  Object.entries(CITY).forEach(([n, c]) => { const [px, py] = P(c); x.fillStyle = '#1e2220'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); x.font = '600 20px "Hanken Grotesk",sans-serif'; const LBL = { London: [-8, -10, 'right'], Paris: [-8, 16, 'right'], Brussels: [8, 4, 'left'], Berlin: [8, -10, 'left'], Vienna: [8, -8, 'left'], Belgrade: [8, -4, 'left'], Sarajevo: [-8, 16, 'right'], 'St Petersburg': [-8, -10, 'right'] }[n]; x.textAlign = LBL[2]; x.lineWidth = 4; x.strokeStyle = 'rgba(201,207,200,.9)'; x.strokeText(n, px + LBL[0], py + LBL[1]); x.fillText(n, px + LBL[0], py + LBL[1]); });
  x.fillStyle = 'rgba(0,0,0,.07)'; for (let j = 0; j < 460; j += 3) x.fillRect(0, j, 720, 1);
  x.fillStyle = '#1e2220'; x.font = '800 22px "Hanken Grotesk",sans-serif'; x.textAlign = 'left'; x.fillText(S.d + ' 1914', 24, 40);
  document.getElementById('wx-d').textContent = S.d + ' 1914'; document.getElementById('wx-f').textContent = hands ? S.fact : S.fc;
  cv.setAttribute('aria-label', `Weather chart for ${S.d} 1914. Lows over ${S.low.join(', ')}.${S.fronts.length ? ' Fronts: ' + S.fronts.map(f => f.join(' to ')).join('; ') + '.' : ''}`); }
draw();
document.getElementById('wx-r').oninput = e => { k = +e.target.value; draw(); if (k === STEPS.length - 1) D.reveal('l1'); };
document.getElementById('wx-hands').onclick = e => { hands = !hands; e.target.setAttribute('aria-pressed', String(hands)); draw(); if (hands) D.reveal('l2'); };
if (document.fonts) document.fonts.ready.then(draw).catch(e => console.warn('fonts', e));
D.tags.refresh();
