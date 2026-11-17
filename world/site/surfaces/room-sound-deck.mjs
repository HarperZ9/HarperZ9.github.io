// room-sound-deck.mjs: the sound room's controls as markup, and the words each one says about itself. Every control sits
// beside what it changes: the five pieces are the large pads at the top, the tempo and the notes sit along the live view
// they drive, the key strip sits under it, each instrument's level slider runs over its own meter, and the band blend
// sits between the names of the two bands. Native controls throughout (ranges, radios, a number), so the keyboard
// reaches every one and each has a label.
import { PIECES, PIECE_IDS, ALT } from '../../../system/site-music/pieces.js';
import { GROUPS, GROUP_NAMES, LIMITS } from '../../../system/site-music/live.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOTE = ['C', 'D-flat', 'D', 'E-flat', 'E', 'F', 'F-sharp', 'G', 'A-flat', 'A', 'B-flat', 'B'], SHORT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROOT = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const rootOf = (p) => ROOT[/^([A-G][#b]?)/.exec(p.tonic)[1]];
export const keyName = (id, semis) => { const p = PIECES[id]; return `${NOTE[(rootOf(p) + semis + 120) % 12]} ${p.key.split(' ').slice(1).join(' ')}`; };
const keyShort = (id, semis) => SHORT[(rootOf(PIECES[id]) + semis + 120) % 12];
export const bpmRange = (id) => LIMITS.bpm.map((k) => Math.round(k * PIECES[id].bpm));
const pct = (v) => `${Math.round(v * 100)}%`;
export const BARS_CHOICES = [16, 32, 48];

export function deckHtml(st, level) {
  const [lo, hi] = bpmRange(st.piece), semis = [];
  for (let k = LIMITS.semis[0]; k <= LIMITS.semis[1]; k++) semis.push(k);
  return `<ol class="snd-pieces">${PIECE_IDS.map((id) => { const p = PIECES[id]; return `<li data-piece="${id}"><button type="button" class="snd-pad" data-play="${id}" aria-pressed="false"><b>${esc(p.title)}</b> <span>${esc(p.key)}, ${p.bpm} beats a minute</span><em>Play</em></button><details><summary>Why it sounds this way</summary><p>${esc(p.why)}</p></details></li>`; }).join('')}</ol>
<p class="snd-now" aria-live="off">Music is off.</p>
<div class="snd-stage">
<canvas class="snd-view" role="img" aria-label="The notes as they play: keys, bass and lead by pitch, the drums along the bottom, bar lines with their chords. Drag across it to change the tempo and how many notes play."></canvas>
<div class="snd-axes">
<label for="snd-tempo">Tempo <output for="snd-tempo"></output></label><input type="range" id="snd-tempo" min="${lo}" max="${hi}" step="1" value="${st.bpm ?? PIECES[st.piece].bpm}" data-ctl="tempo">
<label for="snd-density">Notes <output for="snd-density"></output></label><input type="range" id="snd-density" min="${LIMITS.density[0]}" max="1" step="0.05" value="${st.density}" data-ctl="density">
</div>
<fieldset class="snd-keys" data-ctl="key"><legend>Key <output class="snd-key-say"></output></legend><div class="snd-strip">${semis.map((k) => `<label><input type="radio" name="snd-key" value="${k}"${k === st.semis ? ' checked' : ''}><span>${keyShort(st.piece, k)}</span></label>`).join('')}</div></fieldset>
<p class="snd-landing" role="status" aria-live="polite"></p>
</div>
<fieldset class="snd-desk"><legend>Instruments</legend><p class="snd-desk-say">Each slider is that instrument's level, over a meter of what it plays now. A change is heard at once.</p>
${GROUPS.map((g) => `<div class="snd-ch" data-group="${g}"><label for="snd-g-${g}">${esc(GROUP_NAMES[g])} <output for="snd-g-${g}">${pct(st.gains[g])}</output></label><span class="snd-track"><i class="snd-lv" aria-hidden="true"></i><input type="range" id="snd-g-${g}" min="0" max="${LIMITS.gain[1]}" step="0.05" value="${st.gains[g]}" data-ctl="gain" data-group="${g}"></span></div>`).join('')}
</fieldset>
<div class="snd-mix">
<div class="snd-bandrow"><label for="snd-band">Band <output for="snd-band"></output></label><span class="snd-ends"><span class="snd-end-a"></span><span class="snd-end-b"></span></span><input type="range" id="snd-band" min="0" max="1" step="0.05" value="${st.band}" data-ctl="band"><p class="snd-band"></p></div>
<div><label for="snd-level">Level <output for="snd-level"></output></label><input type="range" id="snd-level" min="0" max="1" step="0.05" value="${level}" data-ctl="level"></div>
</div>
<fieldset class="snd-set snd-fileset"><legend>The file</legend>
<fieldset class="snd-strip-set" data-ctl="piece"><legend>Piece</legend><div class="snd-strip">${PIECE_IDS.map((id) => `<label><input type="radio" name="snd-piece" value="${id}"${id === st.piece ? ' checked' : ''}><span>${esc(PIECES[id].title)}</span></label>`).join('')}</div></fieldset>
<fieldset class="snd-strip-set" data-ctl="bars"><legend>Length</legend><div class="snd-strip">${BARS_CHOICES.map((b) => `<label><input type="radio" name="snd-bars" value="${b}"${b === st.bars ? ' checked' : ''}><span>${b} bars</span></label>`).join('')}</div></fieldset>
<label for="snd-seed">Seed</label><input type="number" id="snd-seed" min="1" max="99999" step="1" inputmode="numeric" placeholder="new each time" value="${st.seed ?? ''}" data-ctl="seed">
<p class="snd-seed-say" role="status" aria-live="polite">The seed sets the order of the sections, the piano's rhythm, the fills and how the lead develops its theme. Left empty, each listen is a new performance.</p>
<p class="snd-cost"></p>
<button type="button" data-render>Make the file</button>
</fieldset>`;
}

// the words beside the controls, from the state as it stands
export function sayDeck($, st, s) {
  const p = PIECES[st.piece];
  $('output[for="snd-tempo"]').textContent = `${st.bpm} beats a minute${st.bpm === p.bpm ? ', as written' : ''}`;
  $('output[for="snd-density"]').textContent = st.density >= 1 ? 'every note, as written' : `${Math.round(st.density * 100)}% of the notes`;
  $('.snd-key-say').textContent = `${keyName(st.piece, st.semis)}${st.semis ? `, ${Math.abs(st.semis)} ${Math.abs(st.semis) === 1 ? 'semitone' : 'semitones'} ${st.semis > 0 ? 'up' : 'down'}` : ', as written'}`;
  for (const g of GROUPS) $(`output[for="snd-g-${g}"]`).textContent = pct(st.gains[g]);
  $('output[for="snd-level"]').textContent = pct(s.level);
  $('output[for="snd-band"]').textContent = st.band <= 0 ? 'the first band' : st.band >= 1 ? 'the second band' : `${pct(1 - st.band)} first, ${pct(st.band)} second`;
  $('.snd-end-a').textContent = 'First band'; $('.snd-end-b').textContent = ALT[st.piece].name;
  $('.snd-band').textContent = st.band <= 0 ? `${p.title} played by its first band.` : st.band >= 1 ? `${p.title} played by ${ALT[st.piece].name}.` : `${p.title}: its first band blended with ${ALT[st.piece].name}, the same notes from both.`;
  const tempo = $('#snd-tempo'), [lo, hi] = bpmRange(st.piece); if (+tempo.min !== lo || +tempo.max !== hi) { tempo.min = lo; tempo.max = hi; }
  tempo.value = st.bpm; $('#snd-density').value = st.density; $('#snd-band').value = st.band;
}
// the key strip names follow the piece
export function relabelKeys(host, id) { for (const r of host.querySelectorAll('input[name="snd-key"]')) r.nextElementSibling.textContent = keyShort(id, +r.value); }
