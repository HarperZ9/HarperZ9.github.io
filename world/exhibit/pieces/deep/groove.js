// The skipping groove, deepened: the run-out loop that is cut on purpose (layer 2) and how a 78 is really copied (layer 3).
import { depth, el, RM } from './core.js';
import { hashAnswer } from './sha.js';

const G78 = 'https://en.wikipedia.org/wiki/The_Great_78_Project', BB = 'https://www.beatlesbible.com/1967/04/21/recording-mixing-only-a-northern-song-sgt-pepper-run-out-groove/';
const cfg = {
  room: 'groove', title: 'The skipping groove', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'A scratch that repeats', found: 'A 78 turns, the needle catches, and one bar repeats. Lift the needle and the groove pulls it back. Four copies lose detail and keep the injury.', how: 'Play the record.', hint: '' },
    { id: 'l2', name: 'A loop cut on purpose', found: 'Not every loop is damage. A run-out groove can be cut to loop forever, as on a famous 1967 album. People have read secret messages into it; one source says it is random tape edits played backwards.', how: 'A loop can be made deliberately.', hint: 'Under the record, press the button that lets the groove run out and loop.', open: () => document.querySelector('.ro')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'Four styli', found: 'The project that put this disc online reads each side four ways, because grooves have no standard size. What the copy keeps depends on who set the needle.', how: 'There is a note on how the record got here.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '78', note: 'Revolutions per minute: the nominal speed of the discs in the Great 78 Project.', src: G78 },
  riddle: { q: 'Take an O out of me and I am a small wood. Leave the O in and I am where the needle sticks, and where a rut forms in a life. Which word is it, with the O?', hint: 'Six letters. It is the title\'s second word.', answer: 'groove', plain: 'Groove without its first O is grove. The room is about a groove, in a record and in a habit.', hash: hashAnswer('groove') },
  tags: [
    { id: 'label', x: 40, y: 60, layer: 'l1', kind: 'Plate', title: 'A disc label',
      body: '<p>A Standard Talking Machine Co. disc label, from Flickr through Openverse, CC BY. The disc audio in this room is a 1919 78 rpm side from the Library of Congress National Jukebox through the Internet Archive\'s Great 78 Project. The scratch and the repeat are ours. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/groove-plate.png', alt: 'The paper label of a 78 rpm disc with a company name and text', cap: 'Standard Disc Record license label, CC BY via Openverse. Resized.', w: 240 },
      src: [{ t: 'Openverse, Standard Disc Record 78 rpm License Label', s: 'v' }, { t: 'Great 78 Project', u: G78, s: 'p' }] },
    { id: 'needle', x: 78, y: 16, layer: 'l1', kind: 'Read this first', title: 'The scratch is ours',
      body: '<p>The scratch and the repeating bar are made for this room. The record is a real 1919 side, and nothing in it skips on the original. The echo waveforms beside it are drawn from the same audio with simulated copy loss.</p>' },
    { id: 'berl', x: 12, y: 84, layer: 'l1', kind: 'Reference', title: 'The first gramophone disc',
      body: '<p>Emile Berliner\'s gramophone disc of 1897 is the first record format in the room\'s caption. A disc is a groove: a line of information that a needle reads.</p>',
      src: [{ t: 'Room caption; Berliner image from Wikimedia Commons', s: 'p' }] },
    { id: 'ro', host: '.ro', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'The run-out groove on Sgt. Pepper',
      body: '<p>The Beatles ended Sgt. Pepper\'s Lonely Hearts Club Band (UK, 1967) on a run-out groove that loops, recorded on 21 April 1967 at Abbey Road, after a high tone. Commentators have read secret messages in it. One source says it is a few random samples and tape edits played backwards, and that it was left off US pressings.</p>',
      src: [{ t: 'Beatles Bible: Only A Northern Song, Sgt Pepper run-out groove, 21 April 1967', u: BB, s: 'p' }, { t: 'The Paul McCartney Project, Sgt Pepper inner groove', u: 'https://www.the-paulmccartney-project.com/song/sgt-pepper-inner-groove/', s: 'p' }] },
    { id: 'g78', host: '.g78', x: 92, y: 10, layer: 'l3', kind: 'Reference', title: 'The Great 78 Project',
      body: '<p>An Internet Archive project, announced in 2017, with George Blood L.P. doing the audio transfers: discs are handled with care and photographed, metadata is keyed from the label, and each side is recorded with four different styli because there is no standard groove size. A hard drive of 5,000 to 7,000 sides goes to the Archive each month. By 2025 the project said it had digitised 400,000 recordings. Blood had earlier digitised 10,000 singles for the Library of Congress National Jukebox.</p>',
      src: [{ t: 'Wikipedia, The Great 78 Project', u: G78, s: 'p' }, { t: 'Great 78 preservation page', u: 'https://great78.archive.org/preservation/', s: 'p' }] },
  ],
  wall: {
    paras: [
      'Scratch a record and it doesn\'t forget, it repeats. One bar, again and again, until someone lifts the needle, and the groove pulls it back down a few times before it lets go. The audio under the needle is a 1919 78 from the Library of Congress National Jukebox, by way of the Internet Archive.[1] The scratch is ours. The record never skipped.',
      'It gets worse when you copy it. Copy a copy and the quiet parts go first, then the middle, until the level has three steps, and the scratch survives every generation intact. The wound is the best-kept part of the record. That is what the waveforms on the right do. The people who digitise 78s for the Great 78 Project live with it: grooves come in no standard size, so each side is recorded four ways with four styli.[2]',
      'Not every loop is an accident. In 1967 the Beatles ended Sgt. Pepper on a run-out groove cut to loop for ever, a high tone and a few seconds of tape, recorded on 21 April of that year.[3] Commentators have read secret messages into it. One source says it is random samples and tape edits played backwards. Read that twice before you start decoding things, and notice that the page you are on invites you to.',
      'Groove means two things in English and you know both: a cut in a disc and a rut you can\'t get out of. Momentum feels like permission, and the permission was cut into the disc before you arrived. Whose hand set the groove? Go on, lift the needle and watch what it does.',
    ],
    notes: [
      { t: 'The record: a 1919 78 rpm side, "I might be your once-in-a-while", from the Library of Congress National Jukebox via the Internet Archive\'s Great 78 Project, per the room\'s caption. The item page was not reopened for this pass.', u: G78, s: 'p' },
      { t: 'The Great 78 Project: announced 2017; George Blood L.P. does the transfers with four styli; no standard groove size; 5,000 to 7,000 sides a month to the Archive; 400,000 recordings by 2025 per the project; Blood earlier did 10,000 singles for the National Jukebox.', u: G78, s: 'p' },
      { t: 'Sgt. Pepper run-out groove: recorded 21 April 1967 at Abbey Road per Beatles Bible; a 15 kHz tone precedes it on the original LP (sources differ on the frequency); left off US pressings; commentators have read secret messages in it, and one source calls it random samples and tape edits played backwards.', u: BB, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.ro, .g78 { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .ro h2, .g78 h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .ro p, .g78 p, .g78 li { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.ro svg { width:min(300px,100%); height:auto; display:block; background:#17120c; border:1px solid var(--line) }
`));
const ro = el('section', 'ro'); ro.setAttribute('aria-labelledby', 'ro-h');
ro.innerHTML = `<h2 id="ro-h">The groove that is meant to loop</h2><p>The inner end of a record is called the run-out. If it is cut into a closed ring, the needle never leaves it. Press the button and the needle goes round once each time.</p>
<svg viewBox="0 0 300 300" role="img" aria-label="A record seen from above with a closed ring near the label and a small dot, the needle, going round it"><circle cx="150" cy="150" r="140" fill="#1b1b1d" stroke="#3a3833"/><circle cx="150" cy="150" r="60" fill="none" stroke="#c9a24a" stroke-width="2"/><circle cx="150" cy="150" r="34" fill="#8f8b78"/><circle id="ro-n" cx="150" cy="90" r="6" fill="#e0177e"/></svg>
<button type="button" id="ro-b">Let the groove run out</button><p id="ro-o" aria-live="polite">The needle is still on the music.</p>`;
document.querySelector('.wrap').after(ro);
let laps = 0, a = 0, raf = 0; const nd = document.getElementById('ro-n'), out = document.getElementById('ro-o');
const place = () => { nd.setAttribute('cx', 150 + 60 * Math.sin(a)); nd.setAttribute('cy', 150 - 60 * Math.cos(a)); };
document.getElementById('ro-b').onclick = () => { if (raf) return; const t0 = performance.now(); out.textContent = 'The needle has reached the closed ring. It goes round and round.';
  const tick = now => { a = ((now - t0) / 1600) * 6.2832; place(); const l = Math.floor(a / 6.2832); if (l > laps) { laps = l; out.textContent = `Lap ${laps}. The ring has no exit. This one is cut on purpose.`; if (laps >= 2) D.reveal('l2'); } if (!RM && laps < 4) raf = requestAnimationFrame(tick); else { raf = 0; } };
  if (RM) { a = 0; place(); out.textContent = 'The needle sits on a closed ring. It would go round for ever. This one is cut on purpose.'; D.reveal('l2'); } else raf = requestAnimationFrame(tick); };
const g = el('section', 'g78'); g.hidden = true; g.setAttribute('aria-labelledby', 'g78-h');
g.innerHTML = `<h2 id="g78-h">How the disc got here</h2><ol><li>Handled with care and photographed, front and back.</li><li>Label details keyed in by hand.</li><li>Recorded with four different styli, because grooves come in no standard size.</li><li>Sent to the Internet Archive on a hard drive of 5,000 to 7,000 sides a month.</li></ol><p>What a copy keeps depends on which stylus read it. Source: Great 78 Project, as summarised on Wikipedia and its preservation page.</p>`;
D.section.before(g); D.on('l3', () => { g.hidden = false; });
D.settle(document.getElementById('stage'));
