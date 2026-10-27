// Powers of Ten, for a Lie, deepened: a flicker test (layer 2) and the Hebrew original of the cut clause (layer 3).
import { depth, el, RM } from './core.js';

const cfg = {
  room: 'powers', title: 'Powers of Ten, for a Lie', host: '#cvwrap', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'Ten steps out and ten in', found: 'One post, pulled back by factors of ten to a planet of server halls, then dived back in to the clause that was cut.', how: 'Scroll the zoom.', hint: '' },
    { id: 'l2', name: 'The edit you miss', found: 'Two versions of a feed alternate with a blank between them. One clause differs. Most people take far longer to find it than they expect.', how: 'Below the zoom there is a test of your own eyes.', hint: 'Scroll past the zoom to the flicker test, start it, and press "I see it" when you spot the difference.', open: () => document.querySelector('.flick')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The Hebrew original', found: 'The Hebrew clause that was cut is four words. The English is five. A count changed in translation, the same kind of drift as the cut.', how: 'The cut clause has an original language.', hint: 'Stay in the room for a minute and a half, or come back on another visit.' },
  ],
  number: { text: '5', note: 'The words in the clause that was cut: "only a question of time".', src: 'https://www.ynet.co.il/economy/article/ry6wxet3gx' },
  riddle: { q: 'I am five words long in English and four in Hebrew. A forecast wears me, and a plain fact does not. Cut me and the sentence still reads smoothly, which is why I go first. What am I?', hint: 'Five letters. A cautious speaker puts one around a promise.', answer: 'hedge', plain: 'A hedge is the qualifying clause that marks a statement as a forecast or a guess. Here it is "only a question of time", the part that was dropped in the short version.', hash: '' },
  tags: [
    { id: 'eames', x: 50, y: 7, layer: 'l1', kind: 'Reference', title: 'Powers of Ten, after the Eameses',
      body: '<p>Charles and Ray Eames made Powers of Ten in 1968 and reissued it in an updated form in 1977. It follows Kees Boeke\'s 1957 book Cosmic View: The Universe in Forty Jumps, and adds colour and photographs to Boeke\'s drawings. The 1977 version moved the starting point to Chicago and was chosen for the National Film Registry in 1998. Here only the structure is borrowed: ten times each step, out and back in.</p>',
      src: [{ t: 'Wikipedia, Powers of Ten (film series)', u: 'https://en.wikipedia.org/wiki/Powers_of_Ten_(film_series)', s: 'p' }, { t: 'Eames Foundation page on the film (1968 original, 1977 update)', u: 'https://eamesfoundation.org/work/powers-of-ten-and-the-relative-size-of-things-in-the-universe', s: 'p' }], rooms: [{ room: 'scale', label: 'How a scale lies', why: 'a change of scale changes the reading' }] },
    { id: 'ynet', x: 50, y: 48, layer: 'l1', kind: 'Quotation', title: 'The sentence',
      body: '<p>Benjamin Netanyahu on Channel 10 with Roy Katz, 23 October 2026, as reported in Hebrew by Ynet: it is over, only a question of time. The short version circulated as "is over". The tag is placed on the post at the middle of the zoom.</p>',
      quote: { t: '"is over, only a question of time"', by: 'Netanyahu, Channel 10, 23 Oct 2026, English rendering in our case file', u: 'https://www.ynet.co.il/economy/article/ry6wxet3gx' },
      src: [{ t: 'Ynet, Hebrew quotes of the interview. Read through the case file; the page was not reopened for this room.', u: 'https://www.ynet.co.il/economy/article/ry6wxet3gx', s: 'p' }], rooms: [{ room: 'mirror', label: 'Weigh it yourself', why: 'the same pair, as a choice' }] },
    { id: 'ticker', x: 14, y: 80, layer: 'l1', kind: 'Plate', title: 'A ticker room, one level of the zoom',
      body: '<p>The New York Stock Exchange ticker apparatus, central control station, from the Library of Congress through Wikimedia Commons (LCCN 2013647237). This copy is lossless on purpose and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/powers-plate.png', alt: 'The central control station of the automatic ticker apparatus at the New York Stock Exchange, a room of machines and operators', cap: 'Library of Congress, public domain. Resized.', w: 240 },
      src: [{ t: 'Wikimedia Commons, Automatic ticker apparatus, NYSE', u: 'https://commons.wikimedia.org/wiki/File:Automatic_ticker_apparatus,_New_York_Stock_Exchange._Central_control_station_LCCN2013647237.jpg', s: 'v' }] },
    { id: 'marble', x: 88, y: 18, layer: 'l1', kind: 'Archival object', title: 'The planet level',
      body: '<p>NASA\'s Blue Marble image, 2007 west view, from the NASA Image and Video Library, public domain. At that step the post is one thing among several billion.</p>',
      src: [{ t: 'NASA Image and Video Library, GSFC_20171208_Archive_e002131', u: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e002131', s: 'v' }] },
    { id: 'rensink', host: '.flick', x: 92, y: 12, layer: 'l2', kind: 'Reference', title: 'The flicker paradigm',
      body: '<p>Rensink, O\'Regan and Clark (1997) alternated an original and a modified picture with a blank field between them. People often needed many seconds to find large changes, up to about twenty for some scenes, and found them quickly once told where to look. The effect is about attention, not eyesight.</p>',
      src: [{ t: 'Rensink, O\'Regan and Clark, Psychological Science 8:368-373 (1997). Abstract and secondary summaries checked; the full text was not read here.', u: 'https://www2.psych.ubc.ca/~rensink/publications/abs.96.2.html', s: 'p' }], rooms: [{ room: 'labels', label: 'Four labels', why: 'a word that steers what you see' }] },
  ],
  wall: {
    paras: [
      'Take any sentence you like and pull back ten times at a time. The thread, then everybody who reposted it, then the outlet, the market that pays for outrage, a planet of server halls. The Eameses did it with a film and a park in Chicago and ended at the edge of the known universe before diving into the nucleus of an atom, and Kees Boeke did it with drawings twenty years before that.[1] I stole the ten-times structure and nothing else, and I\'d steal it again.',
      'Here is the sentence I pulled back from. A prime minister says US aid "is over, only a question of time." The last five words are the hedge, and half the feed kept the first three.[2] Try the flicker test under the zoom. In the study that gave us the test, some people needed up to twenty seconds to find a change they could name at once when told where to look.[3] You will say you would have caught it. Start the test and time yourself.',
      'Even the count drifts. The cut clause is four words in the Hebrew and five in English, and our own notes said four about the English until somebody counted.[4] The cut and the translation do the same job from two directions. People who trim quotes for a living know your eye works this way, and a fair number of them are not sorry. Ten steps out, ten steps in, and the hedge is still the cheapest thing in the sentence to lose.',
    ],
    notes: [
      { t: 'Powers of Ten: the Eameses\' film, 1968, updated 1977; based on Kees Boeke, Cosmic View (1957). Sources differ on which year to give the film; the 1977 version entered the National Film Registry in 1998.', u: 'https://en.wikipedia.org/wiki/Powers_of_Ten_(film_series)', s: 'p' },
      { t: 'Netanyahu on Channel 10 with Roy Katz, 23 October 2026, reported by Ynet. The reposted version read "is over". The Ynet page was read through our case file and not reopened for this room.', u: 'https://www.ynet.co.il/economy/article/ry6wxet3gx', s: 'p' },
      { t: 'Rensink, O\'Regan and Clark, "To see or not to see: the need for attention to perceive changes in scenes", Psychological Science 8:368-373 (1997). Reaction times up to about 20 seconds for some scenes; verbal cues helped. Abstract and summaries checked.', u: 'https://www2.psych.ubc.ca/~rensink/publications/abs.96.2.html', s: 'p' },
      { t: 'Word counts: "only a question of time" is five words. The Hebrew clause as given in our case file is four words. A Hebrew reader should check the Hebrew before this room is published.', s: 'u' },
    ],
  },
};
cfg.riddle.hash = '97fe21bcd36ae81c1cb0fb7d379f7ab4738b5dfc99b8345b993a3650bfc2090c';
const D = depth(cfg);
document.head.append(el('style', null, `
.flick { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .flick h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .flick p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.fl-view { background:#1a1a1a; border:1px solid var(--line); padding:12px; min-height:300px; transition:none } .fl-view.blank { background:#2a2a2a } .fl-view.blank > * { visibility:hidden }
.fl-item { display:grid; grid-template-columns:90px 1fr; gap:10px; padding:10px 6px; border-bottom:1px solid #333; font-size:16px; line-height:1.4 } .fl-item b { color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.08em }
.fl-ctl { display:flex; flex-wrap:wrap; gap:10px; margin:10px 0 } .fl-out { font-size:16px; min-height:1.5em } .fl-diff { margin:8px 0; font-size:16px; line-height:1.6 } .fl-diff mark { background:#ffe93a; color:#111; padding:0 3px }
.heb { margin:20px 0; padding:14px 18px; border:1px solid #3a3833; max-width:760px } .heb .h { font:600 clamp(28px,5vw,44px)/1.3 "Hanken Grotesk","Times New Roman",serif; direction:rtl; unicode-bidi:isolate; margin:4px 0 } .heb p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
`));
const FILL = ['Oil steadies as traders weigh the week\'s inventory data.', 'Council delays vote on the riverside parking plan until December.', null, 'Survey finds common swifts arriving earlier on the south coast.', 'Late goal lifts the visitors to a second straight win.'], TAG = ['Markets', 'Local', 'World', 'Science', 'Sport'];
const A = 'Netanyahu: US aid is over.', B = 'Netanyahu said US aid "is over, only a question of time." (Channel 10, 23 Oct 2026)';
const fl = el('section', 'flick'); fl.setAttribute('aria-labelledby', 'fl-h');
const feed = v => FILL.map((t, i) => `<div class="fl-item"><b>${TAG[i]}</b><span>${t || (v ? B : A)}</span></div>`).join('');
fl.innerHTML = `<h2 id="fl-h">The edit you miss</h2><p>A change-blindness test. Two versions of a news feed take turns, with a blank between them. One item differs, in a clause. Filler items are invented; the World item is the real pair from the case file. Start it and press I see it when you find the difference.</p>
<div class="fl-view" id="flv" aria-hidden="true">${feed(0)}</div><div class="fl-ctl"><button type="button" id="fl-go">Start the flicker</button><button type="button" id="fl-see" disabled>I see it</button><button type="button" id="fl-show">Show the difference</button></div><p class="fl-out" id="fl-out" aria-live="polite"></p><div class="fl-diff" id="fl-diff" hidden></div>`;
D.section.before(fl);
const v = document.getElementById('flv'), out = document.getElementById('fl-out'); let run = false, t0 = 0, ph = 0, timer = 0;
const seq = [[0, 450], [2, 200], [1, 450], [2, 200]];
function tick() { const [w, ms] = seq[ph % 4]; if (w === 2) { v.classList.add('blank'); } else { v.classList.remove('blank'); v.innerHTML = feed(w); } ph++; timer = setTimeout(tick, ms); }
const go = document.getElementById('fl-go'), see = document.getElementById('fl-see');
go.onclick = () => { if (RM) { ph = (ph + 1) % 2; v.classList.remove('blank'); v.innerHTML = feed(ph); out.textContent = ph ? 'Version B is showing.' : 'Version A is showing.'; go.textContent = 'Switch version'; see.disabled = false; if (!t0) t0 = performance.now(); return; }
  run = !run; go.textContent = run ? 'Pause' : 'Start the flicker'; see.disabled = !run && !t0; if (run) { if (!t0) t0 = performance.now(); tick(); } else { clearTimeout(timer); v.classList.remove('blank'); } };
see.onclick = () => { const s = ((performance.now() - t0) / 1000).toFixed(1); out.textContent = `You pressed it after ${s} seconds. This time is not saved anywhere.`; D.reveal('l2'); };
document.getElementById('fl-show').onclick = () => { const d = document.getElementById('fl-diff'); d.hidden = false; d.innerHTML = `<p><b>Version A:</b> ${A}</p><p><b>Version B:</b> Netanyahu said US aid "is over,<mark> only a question of time</mark>." (Channel 10, 23 Oct 2026)</p><p>The difference is the highlighted clause. Everything else in the feed is identical.</p>`; D.reveal('l2'); };
// layer 3: the Hebrew clause
const he = el('section', 'heb'); he.hidden = true; he.setAttribute('aria-label', 'The Hebrew original of the cut clause');
he.innerHTML = `<h2 style="font-size:18px;margin:0 0 6px">The cut clause, in the original language</h2><div class="h" lang="he" dir="rtl">רק שאלה של זמן</div><p>Four words in Hebrew: only, question, of, time. The English "only a question of time" is five. A count that changes in translation is the same kind of drift as the cut. Care: a Hebrew reader should check this line, taken from our case file's reading of the Ynet report, before it is published.</p>`;
D.section.before(he);
D.on('l3', () => { he.hidden = false; });
D.settle(document.getElementById('cvwrap'));
