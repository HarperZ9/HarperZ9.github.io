// The eye overrules the ear: an animated mouth and a synthetic syllable (layer 1), the same sound with the mouth hidden (layer 2), and the paper's own story (layer 3).
import { depth, el, RM } from './core.js';

const MG = 'https://en.wikipedia.org/wiki/McGurk_effect';
const cfg = {
  room: 'mcgurk', title: 'The eye overrules the ear', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A mouth that says ga', found: 'A cartoon mouth shapes "ga" while a synthetic "ba" plays. Many people report a third syllable, "da", which neither the sound nor the mouth made.', how: 'Watch the mouth and listen.', hint: '' },
    { id: 'l2', name: 'Hide the mouth', found: 'With the mouth hidden the sound is plainly "ba" again. The sound never changed; the picture was steering what you heard.', how: 'The same sound can be played without the face.', hint: 'Play the mismatch, then play it again with the mouth hidden.', open: () => document.getElementById('mg-hide')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The same wiring helps', found: 'The habit that lets a mouth fool your ear is the one that saves you in a loud room. Sumby and Pollack (1954) showed that watching a speaker\'s face raises how much speech people understand in noise, and the gain matters most when the noise is worst. One edge deceives, the other rescues.', how: 'The trick has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'paper', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'Hearing lips and seeing voices',
      body: '<p>H. McGurk and J. MacDonald, Nature 264:746-748, December 1976. Speech syllables /ba-ba/ spoken over lip movements of /ga-ga/ are often heard as /da-da/. The authors first thought it came from shared visual and phonetic properties of /b/ and /g/.</p>',
      src: [{ t: 'Nature 264:746-748 (1976), DOI 10.1038/264746a0; PubMed record', u: 'https://pubmed.ncbi.nlm.nih.gov/1012311/', s: 'v' }, { t: 'Wikipedia, McGurk effect', u: MG, s: 'p' }], rooms: [{ room: 'powers', label: 'Powers of Ten, for a Lie', why: 'the headline you saw changes the quote you heard' }] },
    { id: 'ours', x: 97, y: 24, layer: 'l1', kind: 'Read this first', title: 'Our stimuli are cruder than the real ones',
      body: '<p>The mouth is a cartoon and the syllable is a simple synthesised sound. The real effect uses a video of a person and recorded speech, and it varies a lot between listeners. If you hear "ba" the whole way through, that is an ordinary result, and Show me explains what the paper found.</p>' },
    { id: 'noise', x: 97, y: 44, layer: 'l3', kind: 'Reference', title: 'Lips in a loud room',
      body: '<p>W. H. Sumby and Irwin Pollack tested how well people understood spoken words in noise, with and without a view of the speaker\'s face. Seeing the face helped, and in absolute terms it helped most at the worst signal-to-noise ratios. It is the classic demonstration that the eye is part of hearing.</p>',
      src: [{ t: 'Sumby and Pollack (1954), Visual contribution to speech intelligibility in noise, J. Acoust. Soc. Am. 26(2):212-215, DOI 10.1121/1.1907309. Abstract and citing papers read; full text not opened.', u: 'https://doi.org/10.1121/1.1907309', s: 'p' }] },
    { id: 'accident', x: 97, y: 64, layer: 'l2', kind: 'Reference', title: 'Found by accident',
      body: '<p>The usual account is that the effect turned up when a technician dubbed a video of one syllable with the sound of another, during work on how infants perceive speech. The account is told in secondary sources; we did not open a first-hand telling of it.</p>',
      src: [{ t: 'Wikipedia, McGurk effect', u: MG, s: 'p' }] },
  ],
  wall: {
    paras: [
      'Don\'t trust your ears. That is a lab result, not a figure of speech: put the lips of one syllable over the sound of another and a lot of people hear a third that nobody said.[1] The usual story is that it turned up by accident, when a technician dubbed the wrong syllable onto a video.[2] My version is crude, a cartoon mouth and a buzz with a vowel in it, so if you heard "ba" the whole way through, congratulations, you are ordinary.',
      'Here is why it sits in a building about quotes. A headline is the lips and the quote underneath is the sound. You read "is over" first, then you hear the interview, and the face you were shown gets the vote. People who cut quotes for a living don\'t need a lab. They have an audience that already believes its eyes.',
      'And here is the part nobody puts on the poster. The same wiring that lets the mouth lie to you is what gets you through a loud bar, because you read lips without knowing it, and you understand more when you can see the face.[3] I can\'t sell you one edge without the other. Close your eyes and play it again. The sound never changed.',
    ],
    notes: [
      { t: 'McGurk, H. and MacDonald, J., "Hearing lips and seeing voices", Nature 264:746-748 (December 1976), DOI 10.1038/264746a0. Read through the PubMed record; the paper itself was not opened.', u: 'https://pubmed.ncbi.nlm.nih.gov/1012311/', s: 'p' },
      { t: 'The discovery story (a technician dubbing a different syllable onto video in a study of infant speech perception) as told by Wikipedia; no first-hand account opened.', u: MG, s: 'p' },
      { t: 'Sumby, W. H. and Pollack, I. (1954), "Visual contribution to speech intelligibility in noise", J. Acoust. Soc. Am. 26(2):212-215. Abstract and citing papers read.', u: 'https://doi.org/10.1121/1.1907309', s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.mg canvas { display:block; width:min(100%,520px); height:auto; background:#161513; border:1px solid var(--line); margin:8px 0 } .mg .row { display:flex; flex-wrap:wrap; gap:10px; margin:10px 0 } .mg p { margin:6px 0 } .mg label { display:flex; align-items:center; gap:8px; font-size:16px; font-weight:600 }
`));
const st = document.getElementById('stage'); st.classList.add('mg');
st.innerHTML = `<canvas id="mg-c" width="520" height="300" role="img" aria-label="A cartoon face, mouth only, that can say ba or ga"></canvas>
<div class="row"><button type="button" id="mg-ok">Mouth ba, sound ba</button><button type="button" id="mg-mis">Mouth ga, sound ba</button><button type="button" id="mg-mut">Mouth ga, no sound</button><label><input type="checkbox" id="mg-hide"> Hide the mouth</label></div>
<p id="mg-q" aria-live="polite">Sound is off until you press a button with sound. Press one of the first two, then say what you heard.</p>
<div class="row" id="mg-a" hidden><span>I heard:</span><button type="button" data-h="ba">ba</button><button type="button" data-h="da">da</button><button type="button" data-h="ga">ga</button></div><p id="mg-o" aria-live="polite"></p>`;
const cv = document.getElementById('mg-c'), x = cv.getContext('2d'); let last = null, hidden = false, ac = null, plays = 0, hiddenMis = false;
function mouth(open, back, lipsShut) { x.clearRect(0, 0, 520, 300); x.fillStyle = '#161513'; x.fillRect(0, 0, 520, 300); if (hidden) { x.fillStyle = '#2b2824'; x.fillRect(110, 60, 300, 180); x.fillStyle = '#a39e94'; x.font = '18px "Hanken Grotesk",sans-serif'; x.textAlign = 'center'; x.fillText('mouth hidden', 260, 155); return; }
  x.fillStyle = '#c98a78'; x.beginPath(); x.ellipse(260, 150, 170, 105, 0, 0, 7); x.fill(); const h = 6 + open * 70, w = 100 + open * 20;
  x.fillStyle = '#4a1a1a'; x.beginPath(); x.ellipse(260, 160, w, lipsShut ? 4 : h, 0, 0, 7); x.fill();
  if (!lipsShut && back > 0) { x.fillStyle = '#7a2a2a'; x.beginPath(); x.ellipse(260 + 40, 165 + h * .35, 38, 14 * back + 4, 0, 0, 7); x.fill(); }
  x.strokeStyle = '#8a4a40'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.ellipse(260, 160, w + 4, lipsShut ? 6 : h + 4, 0, 0, 7); x.stroke(); }
function syllable() { const A = window.AudioContext || window.webkitAudioContext; ac = ac || new A(); const t = ac.currentTime + .02, o = ac.createOscillator(), g = ac.createGain(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), lim = ac.createDynamicsCompressor();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(115, t); o.frequency.linearRampToValueAtTime(100, t + .3); f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7; f1.frequency.setValueAtTime(260, t); f1.frequency.linearRampToValueAtTime(720, t + .07); f2.frequency.setValueAtTime(900, t); f2.frequency.linearRampToValueAtTime(1250, t + .07);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .32); lim.threshold.value = -12; lim.ratio.value = 20; o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(lim); lim.connect(ac.destination); o.start(t); o.stop(t + .34); }
function play(visual, sound) { last = { visual, sound }; plays++; const t0 = performance.now(), dur = 1100; const draw = now => { const p = (now - t0) / dur; if (p >= 1) { mouth(0, 0, false); return; }
    const k = (p * 2) % 1; let open = 0, lips = false, back = 0; if (visual === 'ba') { lips = k < .25; open = k < .25 ? 0 : Math.sin((k - .25) / .75 * Math.PI) * .8; } else { open = Math.sin(k * Math.PI) * .7 + .1; back = 1; }
    mouth(open, back, lips); requestAnimationFrame(draw); };
  if (sound) { syllable(); setTimeout(syllable, 550); } if (RM) { mouth(visual === 'ba' ? 0 : .5, visual === 'ga' ? 1 : 0, visual === 'ba'); setTimeout(() => mouth(0, 0, false), 800); } else requestAnimationFrame(draw);
  document.getElementById('mg-a').hidden = !sound; document.getElementById('mg-o').textContent = ''; if (sound && visual === 'ga' && hidden) { hiddenMis = true; D.reveal('l2'); } }
document.getElementById('mg-ok').onclick = () => { play('ba', true); document.getElementById('mg-q').textContent = 'The mouth and the sound agree. What did you hear?'; };
document.getElementById('mg-mis').onclick = () => { play('ga', true); document.getElementById('mg-q').textContent = 'The mouth said ga and the sound was ba. What did you hear?'; };
document.getElementById('mg-mut').onclick = () => { play('ga', false); document.getElementById('mg-q').textContent = 'Mouth only. Read the lips: what do you see?'; document.getElementById('mg-a').hidden = false; };
document.getElementById('mg-hide').onchange = e => { hidden = e.target.checked; mouth(0, 0, false); };
document.querySelectorAll('#mg-a [data-h]').forEach(b => b.onclick = () => { const h = b.dataset.h; const o = document.getElementById('mg-o');
  if (last && last.sound && last.visual === 'ga') { o.textContent = h === 'da' ? 'You heard da. The sound was ba and the mouth said ga. That is the McGurk effect: a syllable that neither the ear nor the eye supplied.' : h === 'ba' ? 'You heard ba, which is what was played. Many people hear da here; with a cartoon mouth and a synthetic syllable the effect is weaker. Hide the mouth and play it again.' : 'You heard ga, the mouth. The eye won this time. Hide the mouth and play it again.'; if (hidden) D.reveal('l2'); }
  else if (last && last.sound) o.textContent = h === 'ba' ? 'You heard ba. Sound and mouth agree, so nothing is unusual.' : `You heard ${h}. The sound was ba and the mouth said ba.`; else o.textContent = 'In a mouth-only clip, ga is made at the back of the mouth with no lip closure.'; });
mouth(0, 0, false);
D.tags.refresh();
