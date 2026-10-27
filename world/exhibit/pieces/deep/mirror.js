// Weigh it yourself, deepened: a Stroop test whose words are this week's labels (layer 2), and everything that was cut, in one run (layer 3).
import { depth, el, RM } from './core.js';
import { CLAIMS } from '../mirror-data.js';
import { hashAnswer } from './sha.js';

const HS = 'https://www.hstoday.us/subject-matter-areas/law-enforcement-and-public-safety/fbi-releases-2025-crime-data-showing-sharp-drop-in-violent-offenses/';
const cfg = {
  room: 'mirror', title: 'Weigh it yourself', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'Six pairs, one scale', found: 'Each claim comes as a careful version and a loud one. You put the one you would share on the pan, and the arm stays level.', how: 'Weigh a claim.', hint: '' },
    { id: 'l2', name: 'The word that steers the eye', found: 'You named ink colours while the words said something else, and then while the words were this week\'s labels. A word is read before you can stop it.', how: 'Under the scale there is a timing game.', hint: 'Scroll below the claim cards to the colour test. Finish the second round.', open: () => document.querySelector('.stroop')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Everything that was cut', found: 'All six dropped clauses in one paragraph, with their sources: the part you did not share.', how: 'The cuts add up to a text of their own.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '4.1', note: 'US murders per 100,000 in 2025 on the FBI series, tied with 1955 and 1956. The CDC series, 5.9 in 2024, is not a record.', src: HS },
  riddle: { q: 'Six claims, two versions each. Whatever you place on the left pan, a lamp on the pillar lights up with one word. The word is on the scale\'s face, and it is also in the line the room ends on. What word?', hint: 'Four letters. The opposite of what the lamp has been checked against.', answer: 'true', plain: 'The lamp reads TRUE whatever is weighed, because it is wired to the beam and not to the facts. The room\'s closing line says the same of the author\'s own scale.', hash: hashAnswer('true') },
  tags: [
    { id: 'fbi', x: 50, y: 6, layer: 'l1', kind: 'Data', title: 'Two series, one headline',
      body: '<p>FBI figures put the 2025 US murder rate at 4.1 per 100,000, tied with 1955 and 1956 for the lowest on its series. The CDC series gives 5.9 for 2024, and that is not a record. The loud version kept only the first.</p>',
      src: [{ t: 'HSToday on the FBI 2025 crime data; the CDC series is cited in the case file and was not reopened', u: HS, s: 'p' }] },
    { id: 'booth', x: 8, y: 30, layer: 'l1', kind: 'Plate', title: 'A wanted poster, 1865',
      body: '<p>A wanted poster for John Wilkes Booth, public domain. A poster is a label with a face on it, issued before a trial. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/mirror-plate.png', alt: 'A wanted poster with a portrait and reward text', cap: 'Wikimedia Commons, public domain. Resized.', w: 220 },
      src: [{ t: 'Wikimedia Commons, John_Wilkes_Booth_wanted_poster_new.jpg', u: 'https://commons.wikimedia.org/wiki/File:John_Wilkes_Booth_wanted_poster_new.jpg', s: 'v' }], rooms: [{ room: 'labels', label: 'Four labels', why: 'a word issued before the facts' }] },
    { id: 'hohen', x: 38, y: 12, layer: 'l1', kind: 'Archival object', title: 'The Hohenzollerns in America',
      body: '<p>A newspaper advertisement titled "The Hohenzollerns in America", public domain on Wikimedia Commons. Press ads and front pages in this collage are period papers, used as a backdrop for the claims.</p>',
      src: [{ t: 'Wikimedia Commons, The_Hohenzollerns_in_America_newspaper_ad.png', u: 'https://commons.wikimedia.org/wiki/File:The_Hohenzollerns_in_America_newspaper_ad.png', s: 'v' }] },
    { id: 'lamp', x: 50, y: 42, layer: 'l1', kind: 'Read this first', title: 'The lamp is ours',
      body: '<p>The scale and its TRUE lamp are an invented device. Nothing about it is a real instrument, shop or agency. The room\'s closing line says the lamp would read TRUE for the author\'s own pick as well.</p>' },
    { id: 'stroop', host: '.stroop', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'Stroop, 1935',
      body: '<p>J. Ridley Stroop showed that naming the ink colour of a colour word is slower when the word names a different colour. Reading is automatic. Here the words are labels from this week\'s case files, and the effect to watch is yours.</p>',
      src: [{ t: 'Stroop, Journal of Experimental Psychology 18:643-662 (1935), full text at Classics in the History of Psychology', u: 'https://psychclassics.yorku.ca/Stroop/', s: 'v' }], rooms: [{ room: 'labels', label: 'Four labels', why: 'the word arrives first' }] },
  ],
  wall: {
    paras: [
      'Pick one. Six claims, two versions each, and you put the one you would share on the pan. The scale never moves, because it is mine and I built it to sit still. What changes is how much you can see about yourself, which is the point of the thing. A fact-check that asks the subject if they did it is a scale that asks the sack how heavy it is, and everybody in this building has been the sack.',
      'And now the word game. Stroop, 1935: name the ink, ignore the word, and your mouth reads the word anyway.[1] Under the scale I printed this week\'s labels over the record. A word loads the reading before you get to it, which is how "is over" travelled and the clause after it stayed home.[2] Time yourself. Nobody keeps your number, including me.',
      'None of that makes you a fool. FBI figures put the 2025 US murder rate at 4.1 per 100,000, tied with 1955 and 1956 for the lowest on its series, while the CDC series gives 5.9 for 2024, which is not a record.[3] Two series, one headline that picked. I would tell you which one I would have shared, but you have already decided what I would say, and you were not wrong.',
    ],
    notes: [
      { t: 'Stroop, J. R., "Studies of interference in serial verbal reactions", Journal of Experimental Psychology 18:643-662 (1935); full text at Classics in the History of Psychology.', u: 'https://psychclassics.yorku.ca/Stroop/', s: 'v' },
      { t: 'The six claim pairs, their sources and what each loud version dropped are in the case files and are listed in the card sources above the page.', s: 'p' },
      { t: 'FBI 2025 data as reported by HSToday: 4.1 per 100,000, tied with 1955 and 1956. The CDC 2024 figure of 5.9 comes from the case file and was not reopened here.', u: HS, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.stroop { position:relative; margin:22px 0 8px; max-width:720px; border:1px solid var(--line); padding:14px 16px 12px } .stroop h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .stroop p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.st-word { font:800 clamp(40px,9vw,72px)/1.1 "Hanken Grotesk",sans-serif; text-align:center; margin:14px 0; min-height:1.2em; letter-spacing:.02em; background:#222; padding:8px } .st-btns { display:flex; flex-wrap:wrap; gap:10px; margin:8px 0 }
.st-btns button { min-width:96px } .st-res { font-size:16px; line-height:1.5 }
.cut { margin:20px 0; padding:14px 18px; border:1px solid #3a3833; max-width:760px; font-family:"Hanken Grotesk",sans-serif; font-size:18px; line-height:1.6 } .cut h2 { font:800 18px "Hanken Grotesk",sans-serif; margin:0 0 8px } .cut li { margin:6px 0 }
`));
const INK = [['RED', '#e3262b'], ['BLUE', '#1aa3e0'], ['YELLOW', '#ffe93a'], ['GREEN', '#3fae49']], LAB = ['IS OVER', 'COUP', 'FAR LEFT', 'RECORD LOW', 'GASSING KURDS', '$100M', 'REALISM', 'WRITTEN BY AI'];
const st = el('section', 'stroop'); st.setAttribute('aria-labelledby', 'st-h');
st.innerHTML = `<h2 id="st-h">Name the ink</h2><p>A timing game. Press the button for the colour the word is printed in, and ignore what it says. Round one uses colour names. Round two uses labels from this week's claims. Your times appear here and are not saved. This test relies on colour; if you cannot tell these inks apart, press Show me in the finds list above and the result is described in words.</p>
<div class="st-word" id="st-w" aria-hidden="true">Ready</div><div class="st-btns" id="st-b">${INK.map(([n]) => `<button type="button" data-c="${n}" disabled>${n}</button>`).join('')}</div><button type="button" id="st-go">Start round one</button><p class="st-res" id="st-r" aria-live="polite"></p>`;
document.querySelector('.panel').after(st);
let round = 0, i = 0, t0 = 0, cur = null, times = [[], []]; const go = document.getElementById('st-go'), w = document.getElementById('st-w'), r = document.getElementById('st-r'), btns = [...document.querySelectorAll('#st-b button')];
const rnd = n => Math.floor(Math.random() * n);
function next() { if (i >= 8) { done(); return; } const ink = INK[rnd(4)]; let text;
  if (round === 0) { const other = INK.filter(x => x[0] !== ink[0])[rnd(3)]; text = (i % 2 ? ink : other)[0]; cur = { ink: ink[0], same: text === ink[0] }; } else { text = LAB[i % LAB.length]; cur = { ink: ink[0], same: false }; }
  w.textContent = text; w.style.color = ink[1]; t0 = performance.now(); i++; }
function done() { btns.forEach(b => b.disabled = true); const m = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
  if (round === 0) { w.textContent = 'Done'; w.style.color = '#eee'; r.textContent = `Round one: ${m(times[0])} ms on average across 8 words. Now round two.`; go.textContent = 'Start round two'; go.hidden = false; round = 1; i = 0; }
  else { w.textContent = 'Done'; w.style.color = '#eee'; const a = m(times[0]), b = m(times[1]); r.textContent = `Round two: ${b} ms on average, against ${a} ms in round one. The words in round two were labels, and a label is read before it can be ignored. Each of them was a verdict that circulated this week. Your times are not saved.`; D.reveal('l2'); go.textContent = 'Play again'; go.hidden = false; round = 0; i = 0; times = [[], []]; } }
go.onclick = () => { go.hidden = true; i = 0; btns.forEach(b => b.disabled = false); times[round] = []; r.textContent = ''; next(); };
btns.forEach(b => b.onclick = () => { const ms = performance.now() - t0; if (b.dataset.c === cur.ink) { times[round].push(ms); } else { times[round].push(ms + 600); } next(); });
// layer 3: everything that was cut
const cut = el('section', 'cut'); cut.hidden = true; cut.setAttribute('aria-labelledby', 'cut-h');
cut.innerHTML = `<h2 id="cut-h">Everything that was cut</h2><ol>${CLAIMS.map(c => `<li><b>${c.short}.</b> ${c.dropped}</li>`).join('')}</ol><p style="font:16px 'Hanken Grotesk',sans-serif;color:#a39e94">The six clauses that the loud versions dropped, from the room's own data. Their sources are listed under the page.</p>`;
D.section.before(cut); D.on('l3', () => { cut.hidden = false; });
D.settle(document.getElementById('stage'));
