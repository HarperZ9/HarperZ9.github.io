// What you looked at stays: stare at an inverted recruiting poster, look at a blank field, and the poster comes back in its own colours.
// Layer 1 the afterimage, layer 2 who is saying "Go" (the poster's small print and the white feather), layer 3 the same adaptation keeps vision honest.
import { depth, el } from './core.js';

const AI = 'https://en.wikipedia.org/wiki/Afterimage', WF = 'https://en.wikipedia.org/wiki/Order_of_the_White_Feather';
const POSTER = 'https://commons.wikimedia.org/wiki/File:Women_of_Britain_Say_-_%22Go%22_-_World_War_I_British_poster_by_the_Parliamentary_Recruiting_Committee,_art_by_E_J_Kealey_(Restoration).jpg';
const cfg = {
  room: 'afterimage', title: 'What you looked at stays', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'Stare, then look away', found: "You stared at a poster in the wrong colours for twenty seconds, then at a blank field, and a ghost of it came back in roughly its true colours. The colours were on your retina, not on the screen.", how: 'Stare at the dot.', hint: '' },
    { id: 'l2', name: 'Who is saying Go', found: "The poster puts the order in women's mouths. Its small print says who said it: the Parliamentary Recruiting Committee, poster No. 75, 1915. In the same years men out of uniform were handed white feathers in the street, some of them wounded veterans.", how: 'The poster has small print.', hint: 'After the stare, press Show the poster and read its bottom edge.', open: () => document.getElementById('af-show')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The same tiredness keeps you honest', found: "The ghost comes from adaptation: cells that were driven hard by one colour respond less for a while, so the opposing colour wins. The same adjusting is part of how vision copes with changing light. The edge that let the poster stay on your eyes is the edge that lets you catch it there.", how: 'The trick has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'poster', x: 97, y: 4, layer: 'l1', kind: 'Archival object', title: 'Women of Britain Say Go, 1915',
      body: "<p>A First World War recruiting poster published by Britain's Parliamentary Recruiting Committee, No. 75, 1915, art by E. J. Kealey. The copy used here is Adam Cuerden's restoration of a print held by Te Papa, on Wikimedia Commons, public domain as a UK Government work. The figures are an illustrator's invention, not real people.</p>",
      src: [{ t: 'Wikimedia Commons, Women of Britain Say Go (restoration), with Te Papa accession GH016292', u: POSTER, s: 'v' }] },
    { id: 'how', x: 97, y: 24, layer: 'l1', kind: 'Read this first', title: 'Nothing flashes',
      body: '<p>The poster is shown with its colours inverted, a dot in the middle. After twenty seconds the picture is replaced once by a pale field, with no flicker. If you see nothing, blink a few times while looking at the field. Some people see it faintly or not at all, and that is ordinary.</p>' },
    { id: 'feather', x: 97, y: 44, layer: 'l2', kind: 'Reference', title: 'The white feather',
      body: '<p>From August 1914 a campaign in Britain had women hand white feathers, a traditional mark of cowardice, to men in civilian clothes. Recipients included wounded veterans, a man home on leave and a miner in an exempt job. The poster and the feather are one tactic in two forms: duty enforced by shame, delivered by someone who does not have to go.</p>',
      src: [{ t: 'Wikipedia, Order of the White Feather', u: WF, s: 'p' }], rooms: [{ room: 'labels', label: 'Four labels', why: 'the label that moves' }] },
    { id: 'hering', x: 97, y: 64, layer: 'l3', kind: 'Reference', title: 'Opponent colours',
      body: '<p>Ewald Hering proposed in 1878 that colour vision works in opposing pairs, and later work by Hurvich and Jameson (1957) developed it. That is the usual account of why an afterimage takes the complementary colour: a green-tired channel reads as its opposite. The account is summarised from a secondary source.</p>',
      src: [{ t: 'Wikipedia, Afterimage (cites Hering 1878; Hurvich and Jameson 1957)', u: AI, s: 'p' }] },
  ],
  wall: {
    paras: [
      "Stare at anything long enough and it moves in. That is what an afterimage is: twenty seconds of the wrong colours and your own eye paints the right ones on a blank wall.[1] Nobody needs to believe it for it to work, which is the part propagandists liked about posters.",
      "This one tells you women want you gone. Women of Britain say Go, in letters taller than the soldiers. Read the bottom edge and the women didn't say it at all, a committee of Parliament did.[2] The same autumns had women handing white feathers to men not in uniform, and some of those men had already been, and come back without a hand.[3] Duty by shame works best when the person ashamed of you will never have to go themselves.",
      "I'm not above it. I've stared at plenty of posters that made me feel like a coward for staying home, in whatever form the war took that year. The tiredness that leaves the ghost is the same adjusting that lets you see at all when the light changes.[1] So look away sometimes. It's how you find out what stayed.",
    ],
    notes: [
      { t: 'Negative afterimages, their complementary colours and the opponent-process account (Hering 1878; Hurvich and Jameson 1957), as summarised by Wikipedia. Stare times of about 20 to 30 seconds are typical in the demonstrations it describes.', u: AI, s: 'p' },
      { t: 'Women of Britain Say Go, Parliamentary Recruiting Committee poster No. 75, 1915, art by E. J. Kealey; Wikimedia Commons file page, public domain (UK Government work).', u: POSTER, s: 'v' },
      { t: 'Order of the White Feather, from August 1914 (Admiral Charles Penrose-Fitzgerald); recipients included wounded veterans such as a man who had lost a hand. Wikipedia, which cites period accounts.', u: WF, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.af { display:grid; gap:12px; } .af .frame { position:relative; width:min(100%,360px); aspect-ratio:520/778; background:#d9d6cf; border:1px solid var(--line) }
.af canvas { position:absolute; inset:0; width:100%; height:100%; display:block } .af .dot { position:absolute; left:50%; top:50%; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; background:#000; box-shadow:0 0 0 2px #fff }
.af .row { display:flex; flex-wrap:wrap; gap:10px } .af .small { position:absolute; left:0; right:0; bottom:0; padding:6px 8px; background:rgba(17,17,17,.85); color:var(--ink); font-size:16px; line-height:1.4 }
`));
const st = document.getElementById('stage'); st.classList.add('af');
st.innerHTML = `<div class="frame"><canvas id="af-c" width="520" height="778" role="img" aria-label="A recruiting poster with its colours inverted, a black dot in the centre"></canvas><span class="dot" id="af-dot" aria-hidden="true"></span><p class="small" id="af-small" hidden>Published by the Parliamentary Recruiting Committee, London. Poster No. 75. Printed by Hill, Siffken and Co.</p></div>
<div class="row"><button type="button" id="af-go">Stare for 20 seconds</button><button type="button" id="af-show">Show the poster</button><button type="button" id="af-again">Start again</button></div>
<p id="af-o" aria-live="polite">Press the button, then keep your eyes on the black dot until the picture changes.</p>`;
const cv = document.getElementById('af-c'), x = cv.getContext('2d', { willReadFrequently: true }), out = document.getElementById('af-o'), dot = document.getElementById('af-dot');
const img = new Image(); let inv = null, orig = null, timer = 0;
img.onload = () => { x.drawImage(img, 0, 0, 520, 778); orig = x.getImageData(0, 0, 520, 778); inv = new ImageData(new Uint8ClampedArray(orig.data), 520, 778); const d = inv.data; for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } x.putImageData(inv, 0, 0); };
img.onerror = e => { console.error('poster failed to load', e); out.textContent = 'The poster did not load.'; };
img.src = 'assets/img/dp/after-poster.jpg';
const blank = () => { x.fillStyle = '#e8e5de'; x.fillRect(0, 0, 520, 778); dot.hidden = false; };
document.getElementById('af-go').onclick = () => {
  if (!inv) return; clearInterval(timer); x.putImageData(inv, 0, 0); dot.hidden = false; document.getElementById('af-small').hidden = true; let n = 20; out.textContent = 'Eyes on the dot. 20 seconds.';
  timer = setInterval(() => { n--; if (n > 0) { if (n % 5 === 0) out.textContent = `Eyes on the dot. ${n} seconds.`; return; } clearInterval(timer); blank(); out.textContent = 'Keep looking at the dot. Blink if you need to. The poster you see now is on your eyes, in something like its real colours.'; D.reveal('l1'); }, 1000);
};
document.getElementById('af-show').onclick = () => { if (!orig) return; clearInterval(timer); x.putImageData(orig, 0, 0); dot.hidden = true; document.getElementById('af-small').hidden = false; out.textContent = 'The poster in its own colours. The small print at the bottom says who was speaking.'; D.reveal('l2'); };
document.getElementById('af-again').onclick = () => { clearInterval(timer); if (inv) x.putImageData(inv, 0, 0); dot.hidden = false; document.getElementById('af-small').hidden = true; out.textContent = 'Press Stare, then keep your eyes on the dot.'; };
D.tags.refresh();
