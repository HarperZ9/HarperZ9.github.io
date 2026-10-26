// Manufactured consensus, deepened: the laugh box (layer 2) and a small version of Asch's line test (layer 3).
import { depth, el, RM } from './core.js';
import { hashAnswer } from './sha.js';

const DOU = 'https://en.wikipedia.org/wiki/Charles_Douglass';
const cfg = {
  room: 'crowd', title: 'Manufactured consensus', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'Eight voices, one pulse', found: 'A crowd of dots pulses as one. Pull it apart and the eight traces were never eight: they line up into a single wave, with strings to one hand.', how: 'Pull the crowd apart.', hint: '' },
    { id: 'l2', name: 'The laugh box', found: 'A drawn cabinet with keys and a pedal: one operator, an audience on demand. The real device was built in the early 1950s and played taped laughter for television.', how: 'There is a machine below the crowd.', hint: 'Under the traces, play a key on the laugh box and set the pedal.', open: () => document.querySelector('.lb')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Six voices and a line', found: 'A small version of the line test from 1951. Six invented voices answer before you. About a third of answers in the original followed the group, and about three in four people went along at least once.', how: 'The crowd has a classic experiment under it.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '1953', note: 'The year one encyclopedia entry gives for the first laugh box built by Charles Douglass; sources on the early history differ.', src: DOU },
  riddle: { q: 'One hand, eight mouths. Pull the crowd apart and look at what runs up from every dot to the hand that works them. A ventriloquist uses a different trick, but a puppeteer uses me. What are they?', hint: 'Seven letters. The plural of a thing that holds a puppet up.', answer: 'strings', plain: 'The strings that rise from the crowd to a single hand in the room are the point: the voices are driven from one place.', hash: hashAnswer('strings') },
  tags: [
    { id: 'nyse', x: 22, y: 60, layer: 'l1', kind: 'Archival object', title: 'A crowd, 29 October 1929',
      body: '<p>The crowd is a photograph of people outside the New York Stock Exchange on the day of the crash, from a US Social Security Administration poster, public domain on Wikimedia Commons. Here every person is a dot that pulses in the same rhythm.</p>',
      src: [{ t: 'Wikimedia Commons, Crowd_outside_nyse.jpg', u: 'https://commons.wikimedia.org/wiki/File:Crowd_outside_nyse.jpg', s: 'v' }], rooms: [{ room: 'powers', label: 'Powers of Ten', why: 'a ticker room and a crowd are levels of one market' }] },
    { id: 'baker', x: 82, y: 32, layer: 'l1', kind: 'Plate', title: 'Al Baker and Dennis, 1944',
      body: '<p>Al Baker and his ventriloquist dummy Dennis, from The Sphinx magazine, April 1944, public domain. A ventriloquist\'s dummy has a moving mouth, and nobody in the theatre thinks the dummy is talking. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/crowd-plate.png', alt: 'A magician in a dark suit with a ventriloquist dummy on his knee', cap: 'The Sphinx, April 1944, via Wikimedia Commons, public domain. Resized.', w: 220 },
      src: [{ t: 'Wikimedia Commons, Al_Baker_and_his_ventriloquist_dummy_Dennis.jpg', u: 'https://commons.wikimedia.org/wiki/File:Al_Baker_and_his_ventriloquist_dummy_Dennis.jpg', s: 'v' }] },
    { id: 'wave', x: 5, y: 96, layer: 'l1', kind: 'Read this first', title: 'The traces are invented',
      body: '<p>The eight accounts, their traces and what they say are drawn for this room. They are not real accounts, and the shared pulse is a property of the drawing. The case file\'s own example of this pattern, a reply that chimes in as a user and credits both sides, is described on the wall.</p>' },
    { id: 'douglass', host: '.lb', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'Charles Douglass and the laff box',
      body: '<p>Charles Douglass (1910 to 2003), a sound engineer, is credited with the laugh track. His "laff box" was padlocked, more than two feet tall, and played like an organ: keys chose the laugh and a foot pedal set how long it lasted. One entry says he built it in 1953 and that it first played on The Hank McCune Show; another says a rival device, the Jayo Laugher, competed for the patent, which went to Douglass.</p>',
      src: [{ t: 'Wikipedia, Charles Douglass', u: DOU, s: 'p' }, { t: 'Arts Journal, The original laugh-track machine', u: 'https://artsjournal.org/?p=148786', s: 'p' }], rooms: [{ room: 'groove', label: 'The skipping groove', why: 'a recorded loop carries on without the room' }] },
    { id: 'asch', host: '.asch', x: 92, y: 10, layer: 'l3', kind: 'Reference', title: 'Asch, 1951',
      body: '<p>Participants judged which of three comparison lines matched a standard line. On 12 of 18 trials the others in the room, who were confederates, all gave the same wrong answer. Across critical trials the real participants went with the group about a third of the time (37% in one summary), and about three in four went along at least once. Sources differ on the exact counts of people and confederates.</p>',
      src: [{ t: 'Wikipedia, Asch conformity experiments, with other summaries', u: 'https://en.wikipedia.org/wiki/Asch_conformity_experiments', s: 'p' }] },
  ],
  wall: {
    paras: [
      'Remember the last time a room full of people agreed with you and you didn\'t check who they were. In the old studio shows the laughter came from a cabinet more than two feet tall that a man played like an organ, keys for the kind of laugh and a foot pedal for how long it lasted.[1] I would call it cheating, but the audience laughed along for decades, and so, I suspect, did you.',
      'One hand, eight mouths. Pull the crowd apart and the traces line up: same pulse, same breath. A ventriloquist\'s dummy has a mouth that moves and nobody in the theatre thinks the dummy is talking, and on a timeline they do.[2] The photograph under the dots is a real crowd on the day of a crash, and it is a better picture of people than the dots, and the dots are a better picture of the count.',
      'People will tell you they are immune. Asch ran a card with a standard line and three to pick from in 1951, a table of actors giving the same wrong answer, and the real participants followed them about a third of the time, with about three in four going along at least once.[3] Try the small version. Nothing about your answer is recorded.',
      'Even the machines picked it up. A reply that chimes in as a user and credits both sides is a laugh box with usernames.[4] The count does the persuading, so the count is the first thing to fake and the last thing anyone checks. Look at the number on a post you are about to share. Then look at who.',
    ],
    notes: [
      { t: 'Charles Douglass (1910 to 2003), the laugh track and the "laff box": padlocked, over two feet tall, played with keys and a foot pedal; an encyclopedia entry gives 1953 and the Hank McCune Show; sources on the early history differ.', u: DOU, s: 'p' },
      { t: 'Photographs: Al Baker and Dennis, The Sphinx, April 1944; Coster Joe, a dummy of Fred Russell, about 1905; the crowd outside the NYSE, 29 October 1929. All Wikimedia Commons, public domain.', u: 'https://commons.wikimedia.org/wiki/File:Al_Baker_and_his_ventriloquist_dummy_Dennis.jpg', s: 'v' },
      { t: 'Asch conformity experiments (1951): 18 trials, 12 critical; about one third of critical responses conformed (37% in one source); about 75% conformed at least once. Sources differ on sample size and the number of confederates.', u: 'https://en.wikipedia.org/wiki/Asch_conformity_experiments', s: 'p' },
      { t: 'Our case file, feed set 17 (second batch): a sock-puppet reply "chiming in as a user" and crediting both sides, in the incident described in the test room. Not reopened here.', s: 'u' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.lb, .asch { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .lb h2, .asch h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .lb p, .asch p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.lb-keys { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 } .lb-keys button { min-width:120px } .lb label { display:flex; gap:10px; align-items:center; font-weight:600; font-size:16px; margin:8px 0 } .lb input[type=range] { width:min(260px,64vw); min-height:44px; accent-color:var(--hot) }
.lb-row { display:flex; gap:8px; margin:10px 0 } .lb-row i { width:22px; height:22px; border-radius:50%; background:#3a3833; display:block; transition:background .2s } .lb-row.on i { background:#ffe93a }
.asch-l { display:grid; gap:10px; margin:12px 0 } .asch-l div { height:10px; background:#eee9df } .asch-b { display:flex; flex-wrap:wrap; gap:10px; margin:8px 0 }
`));
// layer 2: the laugh box, keys and pedal
const lb = el('section', 'lb'); lb.setAttribute('aria-labelledby', 'lb-h');
lb.innerHTML = `<h2 id="lb-h">One operator, an audience</h2><p>A drawn laugh box. The key names are ours. Press a key and set the pedal: eight dots light together for as long as the pedal allows. Sound is off in this room.</p><div class="lb-keys">${['A small laugh', 'A medium laugh', 'A big laugh', 'Applause'].map(k => `<button type="button">${k}</button>`).join('')}</div><label>Pedal, how long <input type="range" id="lb-p" min="5" max="60" value="20"><output id="lb-pv">2.0 s</output></label><div class="lb-row" id="lb-r" aria-hidden="true">${'<i></i>'.repeat(8)}</div><p id="lb-o" aria-live="polite">One hand. No audience yet.</p>`;
document.getElementById('wave').after(lb);
const pv = document.getElementById('lb-pv'), pr = document.getElementById('lb-p'), ro = document.getElementById('lb-r'); let n = 0;
pr.oninput = () => { pv.textContent = (pr.value / 10).toFixed(1) + ' s'; };
lb.querySelectorAll('.lb-keys button').forEach(b => b.onclick = () => { const s = pr.value / 10; ro.classList.add('on'); setTimeout(() => ro.classList.remove('on'), Math.min(s, 3) * 1000); document.getElementById('lb-o').textContent = `${b.textContent}, ${s.toFixed(1)} seconds, from one hand. Eight voices on cue.`; if (++n >= 2) D.reveal('l2'); });
// layer 3: a small line test
const as = el('section', 'asch'); as.hidden = true; as.setAttribute('aria-labelledby', 'as-h');
as.innerHTML = `<h2 id="as-h">Which line matches the top line?</h2><p>The top line is the standard. Six invented voices answered before you: all of them said line A. Nothing you pick is recorded.</p><div class="asch-l" aria-label="Four lines: a standard, then A, B and C"><div style="width:240px"></div><div style="width:200px"></div><div style="width:240px"></div><div style="width:280px"></div></div><div class="asch-b"><button type="button" data-a="A">A (the shortest)</button><button type="button" data-a="B">B (the same)</button><button type="button" data-a="C">C (the longest)</button></div><p id="as-o" aria-live="polite"></p>`;
D.section.before(as); D.on('l3', () => { as.hidden = false; });
as.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { document.getElementById('as-o').textContent = b.dataset.a === 'B' ? 'You said B, the same length as the standard, against six voices. In the original study most people did go along with the group at least once, so either answer is ordinary.' : `You said ${b.dataset.a}. Line B is the same length as the standard. The six voices were invented, as the group was in the original.`; });
D.settle(document.getElementById('stage'));
