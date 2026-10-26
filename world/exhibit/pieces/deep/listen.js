// Three sounds that lie: the Shepard tone (A5), phantom words (A6) and a picture hidden in a spectrogram (D19).
// The sound comes from the sound engine in sound/sound, imported and never edited. Nothing loads until a button is pressed.
// If the engine is not reachable from this server, each panel says so and draws its picture from the same model in this file instead.
import { depth, el } from './core.js';
import { sound } from '../../media/sound.js';

const ENGINE = new URL('../../media/sound-engine/', import.meta.url);
const DEUTSCH = 'https://deutsch.ucsd.edu/phantom_words/', SHEP = 'https://www.cs.ubc.ca/labs/imager/contributions/flinn/Illusions/ST/st.html', WOW = 'https://en.wikipedia.org/wiki/Wow!_signal';
const cfg = {
  room: 'listen', title: 'Three sounds that lie', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'A tone that never arrives', found: "The Shepard tone seems to climb for ever. It is a stack of tones an octave apart, all gliding up, each fading in at the bottom and out at the top, so the stack never gets anywhere.", how: 'Listen, or draw it.', hint: '' },
    { id: 'l2', name: 'Open the spectrogram', found: "A spectrogram draws sound as frequency against time. It shows the Shepard tone as parallel stripes that fade and restart, and it shows that the static in the third panel is carrying letters.", how: 'Each sound has a picture.', hint: 'Press any Draw button.', open: () => document.getElementById('ls-pic')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The tool that hides is the tool that finds', found: "The picture in the static can only be hidden because spectrograms exist, and it can only be found with one. Musicians have hidden images this way, Aphex Twin's Windowlicker (1999) the best known. The trick and its reveal are one instrument held two ways.", how: 'The trick has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'shep', x: 97, y: 4, layer: 'l1', kind: 'Reference', title: 'Shepard, 1964',
      body: "<p>Roger Shepard published the tones in 1964: octave-spaced components under a fixed bell-shaped loudness envelope, heard as a scale that loops back on itself. Jean-Claude Risset later made the gliding version. Ours is synthesized by our own sound engine.</p>",
      src: [{ t: 'Shepard (1964), Circularity in judgments of relative pitch, J. Acoust. Soc. Am. 36:2346-2353. Citation checked in reference lists; paper not opened.', u: SHEP, s: 'p' }], rooms: [{ room: 'groove', label: 'The skipping groove', why: 'a loop that feels like progress' }] },
    { id: 'deut', x: 97, y: 24, layer: 'l1', kind: 'Reference', title: 'Phantom words',
      body: "<p>Diana Deutsch, a psychologist at UC San Diego, made recordings in which overlapping repeated words lead listeners to hear words and phrases that are not there, often words on their minds. They are on her CD Phantom Words and Other Curiosities (Philomel, 2003). Her audio is not used here. Our syllables are synthesized, and whether they draw the effect is untested.</p>",
      src: [{ t: 'Diana Deutsch, phantom words demonstrations', u: DEUTSCH, s: 'p' }, { t: 'Philomel Records, Phantom Words and Other Curiosities, 2003', u: 'https://www.philomel.com/phantom_words/', s: 'p' }] },
    { id: 'wow', x: 97, y: 44, layer: 'l2', kind: 'Reference', title: 'Why 6EQUJ5',
      body: "<p>6EQUJ5 is the Wow! signal as Big Ear's printout recorded it in 1977: six readings of signal strength, rising to U and falling. It is a loudness trace, not a message. Here it is drawn into the static as a picture you can only see in the spectrogram.</p>",
      src: [{ t: 'Wikipedia, Wow! signal', u: WOW, s: 'p' }], rooms: [{ room: 'static', label: 'Between stations', why: 'the printout read as loudness' }] },
  ],
  wall: {
    paras: [
      "A barber pole doesn't go anywhere either. The stripes climb all day and the pole stays the same height. Shepard did it with sound in 1964, and it still works on everybody, including the people who know how it's done.[1] Film composers use the endless rise to make you feel time running out when the clip is two minutes long.",
      "The second sound is two syllables looping out of two speakers. Deutsch found that people hear words in loops like these, and they hear the words already on their minds.[2] I can't promise mine work. Type what you hear before you read anyone else's guess, because once you've read a guess you will hear it, and that is the whole lesson in one move.",
      "The third sound is static with writing in it. You can't hear the writing. You can only see it, with the same picture that people use to check a recording hasn't been doctored.[3] Hiding and finding are one tool. I'd love to tell you only the good guys own it.",
    ],
    notes: [
      { t: 'Shepard, R. N. (1964), Circularity in judgments of relative pitch, J. Acoust. Soc. Am. 36:2346-2353. Citation from reference lists; paper not opened.', u: SHEP, s: 'p' },
      { t: 'Deutsch, D., phantom words demonstrations; Phantom Words and Other Curiosities, Philomel Records, 2003. Read from her pages; her audio is not used.', u: DEUTSCH, s: 'p' },
      { t: 'Spectrogram images in music: Aphex Twin, Windowlicker (Warp, 1999), the commonly cited case; the use of spectrograms to inspect recordings is general practice. Secondary, not reopened here.', s: 'u' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.ls .panel { border:1px solid var(--line); padding:14px 16px; margin:0 0 16px; max-width:760px } .ls h2 { font-size:20px; margin:0 0 6px; font-weight:800 }
.ls canvas { display:block; width:100%; max-width:640px; height:auto; background:#0c0a11; border:1px solid var(--line); margin:8px 0 } .ls .row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:8px 0 }
.ls input[type=text] { font:inherit; font-size:18px; padding:8px 10px; min-height:44px; background:#161513; color:var(--ink); border:2px solid var(--line); width:min(320px,80vw) } .ls label { font-weight:600 }
`));
const st = document.getElementById('stage'); st.classList.add('ls');
st.innerHTML = `<p>Sound is off until you turn it on with the button at the top. Headphones help with the second panel. Every Draw button works with sound off.</p>
<section class="panel" aria-labelledby="ls-h1"><h2 id="ls-h1">1. The rise that never arrives</h2><div class="row"><button type="button" id="ls-sp">Play the rise, 20 seconds</button><button type="button" id="ls-sd">Draw it</button></div></section>
<section class="panel" aria-labelledby="ls-h2"><h2 id="ls-h2">2. Two syllables, two speakers</h2><div class="row"><button type="button" id="ls-pw">Play both streams, 20 seconds</button><button type="button" id="ls-p1">Play one stream only</button></div>
<div class="row"><label for="ls-in">What did you hear?</label><input type="text" id="ls-in" autocomplete="off" spellcheck="false"><button type="button" id="ls-ok">Keep my answer here</button></div><p id="ls-pwo" aria-live="polite">Your answer stays in this page and is gone when you close it.</p></section>
<section class="panel" aria-labelledby="ls-h3"><h2 id="ls-h3">3. Static with writing in it</h2><div class="row"><button type="button" id="ls-gp">Play the static, 6 seconds</button><button type="button" id="ls-gd">Draw it</button></div></section>
<canvas id="ls-pic" width="640" height="220" role="img" aria-label="Spectrogram. Nothing drawn yet."></canvas><p id="ls-o" aria-live="polite">The spectrogram draws here.</p>`;
const snd = sound({}); snd.mount(document.querySelector('.top'));
const out = document.getElementById('ls-o'), pic = document.getElementById('ls-pic');
let mods = null, live = null;
async function engineMods() { if (mods) return mods; mods = Promise.all(['engine.js', 'reveal.js', 'motifs/index.js'].map(f => import(new URL(f, ENGINE)))).then(([e, r, m]) => ({ Engine: e.Engine, reveal: r, motifs: m.MOTIFS })); try { return await mods; } catch (e) { mods = null; throw e; } }
// Draw a motif with no sound: render it offline with the engine, then draw the buffer. Falls back to a model drawn here.
async function drawOffline(id, opts, fMax, label, fallback, look = {}) {
  out.textContent = 'Drawing.'; try {
    const { Engine, reveal, motifs } = await engineMods(), secs = (opts.duration || 6) + 0.5, E = await Engine.offline(secs, { sampleRate: 22050, channels: 1 });
    motifs[id].play(E, opts); const buf = await E.ctx.startRendering(); reveal.bufferSpectrogram(pic, buf.getChannelData(0), buf.sampleRate, { fMax, ...look });
    out.textContent = label;
  } catch (e) { console.warn('engine not reachable from this server, drawing the model here instead', e.message); fallback(); out.textContent = label + ' Drawn from the same model in this page, because the sound engine is not reachable from this server.'; }
  pic.setAttribute('aria-label', 'Spectrogram. ' + label); D.reveal('l2');
}
function shepModel() { const g = pic.getContext('2d'), W = 640, H = 220; g.fillStyle = '#0c0a11'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) for (let px = 0; px < W; px++) { const t = px / W * 20, pos = ((i + t / 10) % 8 + 8) % 8, a = .5 - .5 * Math.cos(2 * Math.PI * pos / 8), y = H - pos / 8 * H; g.fillStyle = `rgba(255,225,190,${a})`; g.fillRect(px, y - 1, 1, 3); } }
function glyphModel() { const g = pic.getContext('2d'), W = 640, H = 220; g.fillStyle = '#0c0a11'; g.fillRect(0, 0, W, H); for (let k = 0; k < 2600; k++) { g.fillStyle = 'rgba(120,110,140,.35)'; g.fillRect(Math.random() * W, 40 + Math.random() * 140, 2, 2); }
  g.fillStyle = 'rgba(255,225,190,.9)'; g.font = '800 92px "Hanken Grotesk",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('6EQUJ5', W / 2, H / 2); }
async function playLive(id, opts, fMax, label) {
  if (!snd.on) { out.textContent = 'Sound is off. Turn it on with the button at the top, or press Draw.'; return; }
  try { const { reveal } = await engineMods(); const h = await snd.motif(id, opts); if (live) live.stop(); live = reveal.liveSpectrogram(pic, snd.engine(), { fMax }); out.textContent = label; if (h) h.ended.then(() => { if (live) { live.stop(); live = null; } }); D.reveal('l2'); }
  catch (e) { console.warn('sound engine not reachable', e.message); out.textContent = 'The sound engine is not reachable from this server. Serve the mission-control folder and open this page from there, or press Draw.'; }
}
document.getElementById('ls-sp').onclick = () => { playLive('shepard', { duration: 20, level: 0.15 }, 4000, 'The Shepard tone: stripes that climb, fade at the top and come back at the bottom.'); D.reveal('l1'); };
document.getElementById('ls-sd').onclick = () => { drawOffline('shepard', { duration: 20, level: 0.35 }, 4000, 'The Shepard tone, 20 seconds: eight stripes an octave apart, each fading in low and out high.', shepModel); D.reveal('l1'); };
document.getElementById('ls-pw').onclick = () => playLive('phantom-words', { loop: ['ba', 'na'], duration: 20, mode: 'phantom' }, 6000, 'Both streams: the same two syllables, the right channel half a syllable behind the left.');
document.getElementById('ls-p1').onclick = () => playLive('phantom-words', { loop: ['ba', 'na'], duration: 10, mode: 'plain' }, 6000, 'One stream only: ba, na, ba, na. This is all the sound contains.');
document.getElementById('ls-ok').onclick = () => { const v = document.getElementById('ls-in').value.trim(), o = document.getElementById('ls-pwo');
  o.textContent = v ? `You heard "${v}". The streams only ever said ba and na, one in each ear, half a beat apart. Words a loop like this one could make: banana, nab, a band. Those are our guesses, written before anyone listened, not data. Kept nowhere.` : 'Type what you heard first.'; };
document.getElementById('ls-gp').onclick = () => playLive('spectrogram-picture', { text: '6EQUJ5', duration: 6 }, 10000, 'Static, 6 seconds. Watch the spectrogram, not the speaker.');
document.getElementById('ls-gd').onclick = () => drawOffline('spectrogram-picture', { text: '6EQUJ5', duration: 6, static: 0.012 }, 10000, 'The static, drawn: the letters 6EQUJ5 are written in it between 2,500 and 9,500 hertz.', glyphModel, { floor: -95, ceil: -45 });
D.tags.refresh();
