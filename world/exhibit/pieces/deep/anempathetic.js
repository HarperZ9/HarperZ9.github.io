// Cheerful music, heavy facts (CONTRASTS B9): a 1919 dance record plays under sourced facts about the famine of 1876 to 1878.
// Layer 1 the facts with the music, layer 2 the music off, layer 3 Chion's term and its other edge.
import { depth, el, RM } from './core.js';
import { sound } from '../../media/sound.js';

const FAM = 'https://en.wikipedia.org/wiki/Great_Famine_of_1876%E2%80%931878', REC = 'https://archive.org/details/loc-jukebox-185617-i-might-be-your-once-in-a-while', AN = 'https://en.wikipedia.org/wiki/Anempathetic_sound';
const FACTS = [
  'From 1876 a drought failed the crops on the Deccan Plateau. By 1877 the famine had spread north into the Central Provinces and the North-Western Provinces.',
  'About 670,000 square kilometres were affected, with some 58.5 million people counted in distress.',
  'Estimates of excess deaths run from 5.6 to 9.6 million. One careful modern estimate is 8.2 million.',
  'In January 1877 the relief ration for a man working on relief was set at one pound of grain and one anna a day, less for women and working children.',
  'The Sanitary Commissioner of Madras argued that a pound and a half of grain, with supplements, was the minimum.',
  'In March 1877 the Madras ration was raised to a pound and a quarter of grain and an ounce and a half of daal.',
  'During the famine a record 6.4 million hundredweight of wheat, about 320,000 tons, was exported to England.',
  'In the state of Mysore, the population counted in 1881 was 874,000 lower than in 1871.',
];
const cfg = {
  room: 'anempathetic', title: 'Cheerful music, heavy facts', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A dance band under a famine', found: "A 1919 dance record plays under eight sourced facts about the famine of 1876 to 1878. The music does not change for any of them.", how: 'Read the facts. Sound is optional.', hint: '' },
    { id: 'l2', name: 'The music off', found: "With the record off, the facts are exactly as heavy as they were. The music never lightened them; it made the gap between the tune and the record impossible to ignore.", how: 'The record can be stopped.', hint: 'Press Lift the needle under the facts.', open: () => document.getElementById('an-off')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Indifference as a tool', found: "Michel Chion called sound that ignores a scene's emotion anempathetic. Film uses it to sharpen grief, as when a shower keeps running after a killing in Psycho. The same indifference sells a bad quarter with a ukulele. One device, two uses.", how: 'The device has a name, and a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'record', x: 97, y: 4, layer: 'l1', kind: 'Archival object', title: 'I Might Be Your Once-in-a-While, 1919',
      body: "<p>Joseph C. Smith's Orchestra plays a Victor Herbert tune, Victor matrix B-23297, published 1919. From the Library of Congress National Jukebox through the Internet Archive's 78 collection, public domain under the Music Modernization Act. A love song for dancing. It has nothing to do with India, which is the point.</p>",
      src: [{ t: 'Internet Archive item, rights statement: public domain, first published 1919', u: REC, s: 'v' }] },
    { id: 'engr', x: 97, y: 24, layer: 'l1', kind: 'Archival object', title: 'Waiting for relief, Bangalore',
      body: "<p>An engraving of people waiting for relief in Bangalore, from the Illustrated London News, 1877, public domain. It is an artist's engraving for a London readership, not a photograph. The same picture hangs in the balance room.</p>",
      src: [{ t: 'Wikimedia Commons, Famine in India Natives Waiting for Relief in Bangalore', u: 'https://commons.wikimedia.org/wiki/File:Famine_in_India_Natives_Waiting_for_Relief_in_Bangalore.jpg', s: 'v' }], rooms: [{ room: 'balance', label: 'The False Balance', why: 'the ration as a weighing' }] },
    { id: 'facts', x: 97, y: 44, layer: 'l1', kind: 'Reference', title: 'Where the facts come from',
      body: "<p>All eight facts are from the Wikipedia article on the Great Famine of 1876 to 1878, which cites the demographic and administrative sources. Officials named there are left unnamed here: the facts are about a system of relief, and the room is about how music changes how they land.</p>",
      src: [{ t: 'Wikipedia, Great Famine of 1876-1878', u: FAM, s: 'p' }] },
    { id: 'chion', x: 97, y: 64, layer: 'l3', kind: 'Reference', title: 'Anempathetic sound',
      body: "<p>Michel Chion's term, from Audio-Vision (French 1990; English translation by Claudia Gorbman, Columbia University Press). Music or sound that carries on with conspicuous indifference to what is on screen. The usual example is the shower in Psycho.</p>",
      src: [{ t: 'Wikipedia, Anempathetic sound', u: AN, s: 'p' }, { t: 'Chion, Audio-Vision: Sound on Screen, pp. 8-9 (edition dates vary in citations; book not opened)', s: 'u' }] },
  ],
  wall: {
    paras: [
      "You know the wedding band that keeps playing after somebody falls down. That's this room. A dance record from 1919, a love song, plays under eight facts about a famine that killed somewhere between five and ten million people.[1] The band doesn't know. The band never knows.",
      "I didn't pick a sad song because a sad song lets you off. It tells you what to feel and you feel it and you're done. A cheerful one makes you do the arithmetic yourself: a pound of grain a day, a record year for wheat sent to England, the same twelve months.[1] Lift the needle. The facts weigh the same in the quiet.",
      "Film people call this anempathetic sound and use it on purpose, to make grief colder.[2] Press offices use it too, with a ukulele under the layoffs. Same tool. I am not going to tell you which of us is using it right now.",
    ],
    notes: [
      { t: 'Great Famine of 1876-1878: Deccan drought from 1876; 670,000 sq km and 58.5 million in distress; 5.6 to 9.6 million excess deaths, one estimate 8.2 million; January 1877 ration of 1 lb grain and one anna; argued minimum 1.5 lb; March 1877 Madras ration 1.25 lb grain and 1.5 oz daal; record 6.4 million cwt of wheat exported; Mysore 874,000 fewer than in 1871. Wikipedia.', u: FAM, s: 'p' },
      { t: 'Chion, M., Audio-Vision: Sound on Screen (French 1990; English, Columbia University Press). Term and Psycho example as summarised by Wikipedia; book not opened.', u: AN, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.an { display:grid; gap:14px } .an .wrap { display:grid; gap:16px; grid-template-columns:minmax(0,300px) minmax(0,1fr) } @media (max-width:760px) { .an .wrap { grid-template-columns:1fr } }
.an img { width:100%; height:auto; display:block; filter:grayscale(.3) contrast(1.05); border:1px solid var(--line) } .an ol { margin:0; padding-left:22px } .an li { font-family:"Hanken Grotesk",sans-serif; margin:0 0 10px }
.an li[data-on=false] { color:var(--muted) } .an .deck { font-size:16px; color:var(--muted) } .an .row { display:flex; flex-wrap:wrap; gap:10px }
`));
const st = document.getElementById('stage'); st.classList.add('an');
st.innerHTML = `<p class="deck" id="an-deck">On the turntable: I Might Be Your Once-in-a-While, Joseph C. Smith's Orchestra, 1919. Turn sound on at the top to hear it, or read in silence.</p>
<div class="wrap"><img src="assets/img/famine-bangalore-s.jpg" alt="An engraving of a crowd of people in an open yard, waiting for relief" width="1525" height="1800" loading="lazy">
<ol id="an-facts"></ol></div><div class="row"><button type="button" id="an-next">Next fact</button><button type="button" id="an-off">Lift the needle</button></div><p id="an-o" aria-live="polite"></p>`;
const snd = sound({ rec: { url: 'assets/audio/record78.opus', loop: true, gain: 0.314 } }); snd.mount(document.querySelector('.top')); snd.bed('rec', 1);
const ol = document.getElementById('an-facts'), out = document.getElementById('an-o'); let shown = 0, lifted = false;
FACTS.forEach((f, i) => { const li = el('li', null, f); li.dataset.on = 'false'; li.hidden = i > 0; ol.append(li); });
const show = () => { if (shown >= FACTS.length) return; const li = ol.children[shown]; li.hidden = false; li.dataset.on = 'true'; shown++; out.textContent = shown < FACTS.length ? `Fact ${shown} of ${FACTS.length}.` : 'All eight. The band played through every one.'; if (shown === FACTS.length) D.reveal('l1'); };
show();
document.getElementById('an-next').onclick = show;
document.getElementById('an-off').onclick = () => { lifted = !lifted; snd.bed('rec', lifted ? 0 : 1); const b = document.getElementById('an-off'); b.textContent = lifted ? 'Drop the needle' : 'Lift the needle';
  out.textContent = lifted ? (snd.on ? 'Needle up. The same facts, in the quiet. They weigh what they weighed.' : 'Needle up. You were reading in silence already, so you know: the facts weigh the same either way.') : 'Needle down. The band picks up where it was.'; if (lifted) D.reveal('l2'); };
if (!RM) { const t = setInterval(() => { if (document.hidden) return; if (shown >= FACTS.length) clearInterval(t); else show(); }, 9000); }
D.tags.refresh();
