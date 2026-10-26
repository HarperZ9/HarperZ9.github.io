// Bureaucracy, sung (CONTRASTS B11): forty-nine words of a public hearing transcript set as a recitative, with the transcript's own
// [INAUDIBLE] as a rest. Layer 1 the score, layer 2 the gap in the record, layer 3 the rule that protects the witness.
// The singing uses the sound engine's voice() (imported from sound/sound/voices.js, never edited).
import { depth, el, RM } from './core.js';
import { sound } from '../../media/sound.js';

const NE = 'https://nebraskalegislature.gov/FloorDocs/109/PDF/Transcripts/Health/2026-01-29.pdf', ENGINE = new URL('../../media/sound-engine/', import.meta.url);
const SCORE = [
  { who: 'THE CHAIR', text: 'When you come up to testify, please speak clearly in the mic, tell us your name and spell your first and last name.' },
  { who: 'A VOICE IN THE ROOM', dir: '[INAUDIBLE]' },
  { who: 'THE CHAIR', text: "OK. And we'll hit that here in just a sec. Spell your first and last name so we can make sure we get an accurate record." },
];
const cfg = {
  room: 'recitative', title: 'Bureaucracy, sung', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A recitative for a hearing', found: "Forty-nine words from the opening of a state committee hearing, set the way an opera sets the talking parts: one reciting note, a fall at each full stop, a chord underneath. Sung, the procedure shows that it is a performance.", how: 'Read the score, or play it.', hint: '' },
    { id: 'l2', name: 'The rest marked INAUDIBLE', found: "The chair asks for names to be spelled so the record is accurate, and the record's next entry is a gap. The transcriber wrote down, honestly, that they could not hear. A record that admits what it missed is worth more than one that never does.", how: 'One bar of the score is a rest.', hint: 'Press the bracketed rest in the middle of the score.', open: () => document.querySelector('.rc-rest')?.focus() },
    { id: 'l3', name: 'The ritual that guarantees a turn', found: "The same opening sets the rules: every testifier is guaranteed three minutes, a light on the table goes green, then yellow at one minute left, then red, and questions do not count against the time. Ritual can numb a room. It is also the thing that guarantees a stranger their three minutes.", how: 'The procedure has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'tr', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'The transcript',
      body: "<p>Nebraska Legislature, Health and Human Services Committee, public hearing of 29 January 2026, transcript prepared by the Clerk of the Legislature Transcribers Office, page 2. The words are quoted exactly, once. Speakers are given as roles: the room is about the form of a hearing, not its subject or its people.</p>",
      src: [{ t: 'Nebraska Legislature transcript PDF, 29 January 2026 (sha256 a00841b8...b83e7 as fetched 23 Oct 2026)', u: NE, s: 'v' }] },
    { id: 'rec', x: 97, y: 30, layer: 'l1', kind: 'Reference', title: 'Recitative',
      body: '<p>In opera, recitative carries the plot in speech rhythm over a sparse accompaniment, between the arias that carry the feeling. Here the arias were cut. What is left is all plot: name, spelling, record.</p>' },
    { id: 'lights', x: 97, y: 56, layer: 'l3', kind: 'Reference', title: 'The light system',
      body: '<p>Paraphrased from the same opening: testifiers are guaranteed three minutes; the light on the table is green when testimony begins, yellow with one minute left, red to wrap up; questions from the committee do not count against the time.</p>',
      src: [{ t: 'Same transcript, pages 1 and 2', u: NE, s: 'v' }] },
  ],
  wall: {
    paras: [
      "Every courtroom drama is an opera with the songs cut out. I put one song back. This is the start of a real hearing in a real state capitol, sung on one note the way a priest sings a reading, and it sounds exactly as holy and exactly as dead.[1]",
      "Listen to what the procedure wants. Your name, spelled, so the record is accurate. And the record's very next line is a gap, a voice that didn't reach the microphone, written down as inaudible.[1] I trust that clerk more than most people I've met. They wrote down that they missed it.",
      "Before you sneer at the ritual, read the rules it opens with. Three minutes for anybody who signs in, a light that turns red on everybody who testifies, and questions that don't eat your time.[1] The theatre bores you. It is also the only reason a nobody gets the microphone at all.",
    ],
    notes: [
      { t: 'Nebraska Legislature, Health and Human Services Committee, transcript of the public hearing of 29 January 2026, pages 1 and 2 (the quoted exchange, the [INAUDIBLE] entry, the three-minute guarantee and the light system). Fetched and read 23 October 2026.', u: NE, s: 'v' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.rc .score { max-width:760px; background:#f1ece0; color:#1d1a14; padding:18px clamp(12px,3vw,26px); border:1px solid #cfc6b0 }
.rc .part { margin:0 0 16px } .rc .who { font:600 16px "Hanken Grotesk",sans-serif; letter-spacing:.12em; margin:0 0 6px; color:#5a5140 }
.rc .ln { display:flex; flex-wrap:wrap; gap:30px 4px; padding-top:30px }
.rc .w { position:relative; font:400 19px/1.3 "Hanken Grotesk",sans-serif; padding:0 3px } .rc .w::before { content:""; position:absolute; left:50%; top:calc(-14px - var(--p) * 3px); width:9px; height:7px; margin-left:-4px; border-radius:50%; background:#1d1a14; transform:rotate(-20deg) }
.rc .w::after { content:""; position:absolute; left:-2px; right:-2px; top:-24px; height:17px; background:repeating-linear-gradient(rgba(29,26,20,.55) 0 1px, transparent 1px 4px); z-index:-1 } .rc .w { z-index:0 } .rc .w[data-now=true] { background:#e0177e; color:#fff } .rc .rc-rest { font:italic 400 19px "Hanken Grotesk",sans-serif; background:none; color:#7a2a1a; border:1px dashed #7a2a1a; min-height:44px }
.rc .stage { font:italic 16px/1.5 "Hanken Grotesk",sans-serif; color:#5a5140; margin:0 0 12px } .rc .row { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0 }
`));
const st = document.getElementById('stage'); st.classList.add('rc');
const words = []; let html = '<div class="score"><p class="stage">(A light on the table. Green while you speak; yellow at one minute left; red to wrap up.)</p>';
SCORE.forEach((p, i) => { html += `<div class="part"><p class="who">${p.who}</p><div class="ln">`;
  if (p.dir) html += `<button type="button" class="rc-rest" aria-expanded="false">${p.dir}</button>`;
  else p.text.split(' ').forEach((w, k, a) => { const end = /[.?]$/.test(w), pitch = end ? -2 : (k === a.length - 2 ? 1 : 0); words.push({ w, end, part: i }); html += `<span class="w" style="--p:${pitch}" data-i="${words.length - 1}">${w}</span>`; });
  html += '</div></div>'; });
st.innerHTML = html + `</div><div class="row"><button type="button" id="rc-play">Sing it</button></div><p id="rc-o" aria-live="polite">Sound is off until you turn it on at the top. The score reads without it.</p>`;
const snd = sound({}); snd.mount(document.querySelector('.top')); const out = document.getElementById('rc-o');
document.querySelector('.rc-rest').onclick = e => { e.target.setAttribute('aria-expanded', 'true'); out.textContent = 'A rest where the record could not hear. The transcriber wrote INAUDIBLE rather than guess. The chair had just asked for names to be spelled, for an accurate record.'; D.reveal('l2'); };
const vowel = w => { const m = w.toLowerCase().match(/[aeiou]/); return m ? m[0] : 'a'; };
let playing = false;
document.getElementById('rc-play').onclick = async () => {
  if (playing) return; if (!snd.on) { out.textContent = 'Turn sound on at the top first. The score reads without it.'; return; }
  let V; try { V = await import(new URL('voices.js', ENGINE)); } catch (e) { console.warn('sound engine not reachable', e.message); out.textContent = 'The sound engine is not reachable from this server. Serve the mission-control folder and open this page from there.'; return; }
  const E = snd.engine(); if (!E) return; playing = true; const ctx = E.ctx, bus = ctx.createGain(); bus.gain.value = 2.2; bus.connect(E.out);
  let t = ctx.currentTime + 0.15; const t0 = t, times = [];
  const chord = (at, len, root) => [0, 4, 7].forEach(iv => V.voice(ctx, bus, at, { note: root + iv - 12, dur: len, vel: 0.05, vowel: 'o', vibrato: 0, depth: 0, attack: 0.2, release: 0.5 }));
  let phraseStart = t, part = 0;
  words.forEach((w, i) => { if (w.part !== part) { chord(phraseStart, t - phraseStart, 57); t += 1.6; part = w.part; phraseStart = t; }
    const d = w.end ? 0.55 : 0.24, note = w.end ? 52 : 57; V.voice(ctx, bus, t, { note, dur: d * 0.95, vel: 0.22, vowel: vowel(w.w), vibrato: 4, depth: 6, attack: 0.02, release: 0.08 }); times.push(t); t += d + (w.end ? 0.25 : 0.02); });
  chord(phraseStart, t - phraseStart, 52);
  out.textContent = 'Sung on one reciting note, falling at each full stop. The rest in the middle is the record\'s own gap.';
  const spans = [...document.querySelectorAll('.rc .w')]; let last = -1;
  const tick = () => { const now = ctx.currentTime; let k = -1; for (let i = 0; i < times.length; i++) if (times[i] <= now) k = i; if (k !== last && !RM) { spans.forEach(s => s.dataset.now = 'false'); if (k >= 0) spans[k].dataset.now = 'true'; last = k; }
    if (now < t + 0.3 && snd.on) requestAnimationFrame(tick); else { spans.forEach(s => s.dataset.now = 'false'); playing = false; bus.disconnect(); } };
  requestAnimationFrame(tick); D.reveal('l1');
};
D.tags.refresh();
