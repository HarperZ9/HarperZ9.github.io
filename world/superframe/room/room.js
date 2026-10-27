// room.js: the assistive room. Every change is a step that Undo can take back. Nothing plays by itself: motion and
// sound start only on a press, motion only when the person allowed it in Settings and the system does not ask for
// reduced motion. Input stays on this computer; the local server runs the transformations.
import { saveStory, savePicture, saveSound, saveWords } from './save.js';

const $ = id => document.getElementById(id);
const TILES = ['I', 'you', 'we', 'want', 'like', 'not', 'go', 'stop', 'more', 'help', 'feel', 'see', 'happy', 'calm', 'tired', 'sad', 'music', 'sea', 'home', 'outside', 'play', 'yes', 'no', 'today', '.', '?', '!', 'and', 'the', 'a'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ' ', '.', '-', 'Delete'];
const CHOICES = {
  words: [['story', 'Moving mosaic story'], ['picture', 'Mosaic picture'], ['sound', 'Sound of the sentence']],
  numbers: [['numbers-picture', 'Picture of the numbers'], ['numbers-sound', 'Sound of the numbers']],
  code: [['code-words', 'Code in plain words']],
};
const TABS = ['type', 'tiles', 'numbers', 'code'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

let state = { tab: 'type', words: '', tiles: [], numbers: '', code: '', intensity: 2, result: null };
const history = [structuredClone(state)]; let at = 0, frame = 0, timer = null, audio = null, busy = false;

function commit(patch) {
  state = { ...state, ...patch };
  history.length = at + 1; history.push(structuredClone(state)); at = history.length - 1;
  render();
}
function move(d) {
  const n = at + d; if (n < 0 || n >= history.length) return;
  at = n; state = structuredClone(history[at]); stopAll(); render();
  say(`${d < 0 ? 'Undone' : 'Redone'}.${state.result ? ` Showing what was made from "${clip(state.result.input)}".` : ''}`);
}
const clip = t => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > 60 ? `${s.slice(0, 57)}...` : s; };
const say = t => { $('status').textContent = t; };
const inputFor = s => (s.tab === 'tiles' ? s.tiles.join(' ').replace(/ ([.?!])/g, '$1') : s.tab === 'numbers' ? s.numbers : s.tab === 'code' ? s.code : s.words);
const groupFor = tab => (tab === 'numbers' ? 'numbers' : tab === 'code' ? 'code' : 'words');
const motionAllowed = () => $('opt-motion').checked && !reduced.matches;

function render() {
  for (const t of TABS) { const b = $(`tab-${t}`), on = state.tab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $(`pane-${t}`).hidden = !on; }
  if ($('words').value !== state.words) $('words').value = state.words;
  if ($('numbers').value !== state.numbers) $('numbers').value = state.numbers;
  if ($('code').value !== state.code) $('code').value = state.code;
  $('tile-sentence').textContent = inputFor({ ...state, tab: 'tiles' });
  $('intensity').value = state.intensity; $('intensity-value').textContent = state.intensity;
  $('intensity').setAttribute('aria-valuetext', `${state.intensity} of 5, ${['calm', 'calm', 'middle', 'bright', 'vivid'][state.intensity - 1]}`);
  $('choices').replaceChildren(...CHOICES[groupFor(state.tab)].map(([kind, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'big'; b.textContent = label; b.dataset.kind = kind; b.disabled = busy; return b; }));
  $('undo').disabled = at === 0; $('redo').disabled = at >= history.length - 1;
  showResult();
}

function showResult() {
  const r = state.result;
  // the result always names the input that made it, and says so plainly when the input has changed since
  $('made').hidden = !r;
  if (r) {
    const now = inputFor(state), sameGroup = groupFor(state.tab) === r.group, stale = !sameGroup || now.trim() !== r.input.trim();
    $('source').textContent = clip(r.input);
    $('stale').hidden = !stale;
    $('stale').textContent = !sameGroup ? 'This was made from earlier input.' : `This was made from earlier ${r.group === 'numbers' ? 'numbers' : r.group === 'code' ? 'code' : 'words'}. Yours now: "${clip(now) || 'nothing yet'}".`;
    $('remake').hidden = !stale || !sameGroup || !now.trim();
  }
  $('result').hidden = !(r?.image || r?.frames); $('motion-controls').hidden = !r?.frames; $('sound-controls').hidden = !r?.audio;
  $('out-text').hidden = !r?.text; $('save-controls').hidden = !r;
  $('play').hidden = !motionAllowed();
  $('save-picture').hidden = !r?.image; $('save-sound').hidden = !r?.audio;
  if (!r) return;
  if (r.text) $('out-text').textContent = r.text;
  if (r.frames) { frame = Math.min(frame, r.frames.length - 1); drawFrame(); } else if (r.image) { $('picture').src = r.image; $('picture').alt = r.alt ?? ''; $('caption').textContent = r.kind === 'picture' ? r.words : ''; }
}
function beatOf(i) { return (state.result.captions ?? []).find(c => i >= c.from && i <= c.to); }
function drawFrame() {
  const r = state.result, b = beatOf(frame);
  $('picture').src = r.frames[frame];
  $('picture').alt = `${b ? b.text : r.words}. ${r.alt ?? ''}`;
  $('caption').textContent = b ? b.text : '';
}
function stepBeat(d) {
  const caps = state.result?.captions ?? []; if (!caps.length) return;
  const k = caps.findIndex(c => frame >= c.from && frame <= c.to), n = Math.max(0, Math.min(caps.length - 1, k + d));
  frame = caps[n].from; drawFrame();
}
function togglePlay() {
  if (timer) { stopMotion(); return; }
  if (!motionAllowed() || !state.result?.frames) return;
  $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = 'Pause';
  timer = setInterval(() => { frame = (frame + 1) % state.result.frames.length; drawFrame(); }, 1000 / state.result.fps);
}
function stopMotion() { clearInterval(timer); timer = null; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = 'Play'; }
function toggleSound() {
  if (audio && !audio.paused) { stopSound(); return; }
  audio = new Audio(state.result.audio); audio.volume = 1;
  audio.addEventListener('ended', stopSound);
  audio.play().then(() => { $('sound').setAttribute('aria-pressed', 'true'); $('sound').textContent = 'Stop sound'; }).catch(e => { console.error('room: sound would not start', e); say('The sound could not start.'); });
}
function stopSound() { if (audio) audio.pause(); $('sound').setAttribute('aria-pressed', 'false'); $('sound').textContent = 'Play sound'; }
function stopAll() { stopMotion(); stopSound(); }

async function makeIt(kind) {
  const input = inputFor(state);
  if (!input.trim()) { say(groupFor(state.tab) === 'numbers' ? 'Add some numbers first.' : groupFor(state.tab) === 'code' ? 'Add some code first.' : 'Add some words first.'); return; }
  busy = true; stopAll(); render(); say('Making it now.');
  try {
    const res = await fetch('/api/make', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, input, intensity: state.intensity }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error ?? 'could not make it');
    busy = false; frame = 0; commit({ result: { ...out, input, group: groupFor(state.tab) } });
    say(out.frames ? `Made a story in ${out.captions.length} parts. Use Next to read it.` : out.audio ? `Made a sound, ${out.seconds} seconds long.` : out.text ? 'Made plain words.' : 'Made a picture.');
  } catch (e) { busy = false; render(); say(`That did not work: ${e.message}.`); }
}

// roving focus inside a grid of buttons: arrows move, Home and End jump
function rove(container, cols) {
  container.addEventListener('keydown', e => {
    const items = [...container.querySelectorAll('button')], i = items.indexOf(document.activeElement); if (i < 0) return;
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: items.length - 1 - i }[e.key]; if (d === undefined) return;
    e.preventDefault(); const n = Math.max(0, Math.min(items.length - 1, i + d)); items[i].tabIndex = -1; items[n].tabIndex = 0; items[n].focus();
  });
}
function cell(label, onPress, i) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.tabIndex = i === 0 ? 0 : -1; b.addEventListener('click', onPress); return b; }

function wire() {
  $('tiles').replaceChildren(...TILES.map((w, i) => { const b = cell(w, () => commit({ tiles: [...state.tiles, w] }), i); b.setAttribute('aria-label', w === '.' ? 'full stop' : w === '?' ? 'question mark' : w === '!' ? 'exclamation mark' : w); return b; }));
  $('keypad').replaceChildren(...KEYS.map((k, i) => { const b = cell(k === ' ' ? 'Space' : k, () => commit({ numbers: k === 'Delete' ? state.numbers.slice(0, -1) : state.numbers + k }), i); if (k === '-') b.setAttribute('aria-label', 'minus'); if (k === '.') b.setAttribute('aria-label', 'point'); return b; }));
  rove($('tiles'), 6); rove($('keypad'), 6);
  $('tile-back').addEventListener('click', () => commit({ tiles: state.tiles.slice(0, -1) }));
  $('tile-clear').addEventListener('click', () => state.tiles.length && commit({ tiles: [] }));
  for (const t of TABS) $(`tab-${t}`).addEventListener('click', () => { stopAll(); commit({ tab: t }); });
  document.querySelector('[role=tablist]').addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault();
    const t = TABS[(TABS.indexOf(state.tab) + d + TABS.length) % TABS.length]; stopAll(); commit({ tab: t }); $(`tab-${t}`).focus();
  });
  // typing is one step per pause, so Undo takes back a phrase, not a letter
  for (const [id, key] of [['words', 'words'], ['numbers', 'numbers'], ['code', 'code']]) {
    let pending = null;
    const flush = () => { clearTimeout(pending); pending = null; if ($(id).value !== state[key]) commit({ [key]: $(id).value }); };
    $(id).addEventListener('input', () => { clearTimeout(pending); pending = setTimeout(flush, 700); });
    $(id).addEventListener('blur', flush);
  }
  $('choices').addEventListener('click', e => { const k = e.target.closest('button')?.dataset.kind; if (k) makeIt(k); });
  $('intensity').addEventListener('change', () => commit({ intensity: Number($('intensity').value) }));
  $('undo').addEventListener('click', () => move(-1)); $('redo').addEventListener('click', () => move(1));
  $('prev').addEventListener('click', () => { stopMotion(); stepBeat(-1); }); $('next').addEventListener('click', () => { stopMotion(); stepBeat(1); });
  $('remake').addEventListener('click', () => { if (state.result) makeIt(state.result.kind); });
  $('play').addEventListener('click', togglePlay); $('sound').addEventListener('click', toggleSound);
  $('save-story').addEventListener('click', () => saveStory(state.result));
  $('save-picture').addEventListener('click', () => savePicture(state.result, frame)); $('save-sound').addEventListener('click', () => saveSound(state.result)); $('save-words').addEventListener('click', () => saveWords(state.result));
  $('settings-open').addEventListener('click', () => { const s = $('settings'), open = s.hidden; s.hidden = !open; $('settings-open').setAttribute('aria-expanded', String(open)); });
  $('opt-motion').addEventListener('change', () => { stopMotion(); showResult(); });
  $('opt-large').addEventListener('change', () => document.documentElement.classList.toggle('large', $('opt-large').checked));
  reduced.addEventListener('change', () => { stopMotion(); showResult(); });
  wireVoice();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { stopAll(); return; }
    const inField = /TEXTAREA|INPUT/.test(document.activeElement?.tagName ?? '');
    if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'z') { e.preventDefault(); move(e.shiftKey ? 1 : -1); }
    else if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'y') { e.preventDefault(); move(1); }
  });
}

// Voice is optional and off by default. The browser's speech service may send audio away from this computer, so it
// appears only when the person turns it on in Settings, and only where the browser offers it at all.
function wireVoice() {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const sync = () => { $('voice').hidden = !(SR && $('opt-voice').checked); };
  if (!SR) $('opt-voice').disabled = true;
  $('opt-voice').addEventListener('change', sync); sync();
  $('voice').addEventListener('click', () => {
    const rec = new SR(); rec.lang = document.documentElement.lang || 'en'; rec.interimResults = false;
    rec.onresult = e => commit({ words: `${state.words} ${e.results[0][0].transcript}`.trim() });
    rec.onerror = e => say(`Voice did not work: ${e.error}.`);
    rec.start(); say('Listening.');
  });
}

wire(); render();
