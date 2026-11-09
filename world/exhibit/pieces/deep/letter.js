// The letter, and the log (CONTRASTS B13): an invented love letter rendered as a timestamped log with a hash per line, and an invented
// server log typeset as a letter. Layer 1 the swap, layer 2 change one word and watch the hash, layer 3 what a hash can and cannot hold.
import { depth, el } from './core.js';
import { sha256 } from './sha.js';

const KEATS = 'https://www.themarginalian.org/2016/02/19/john-keats-love-letter-fanny-brawne/';
const LETTER = ['My dearest,', 'The lamp is low and the house is asleep, and I am writing by what is left of it.', 'You asked whether I think of you in the day. I do, at the worst times.', 'At the market I counted the coins twice, because your name was in the way.',
  'I keep your last letter in my coat and have read it until the folds went soft.', 'Write when you can. Write when you cannot, too, and send it anyway.', 'Yours, until the lamp goes out and after,', 'E.'];
const LOG = [['03:04:11', 'WARN', 'node-7 disk usage 91%'], ['03:04:12', 'INFO', 'retry 1 of 3 for job 4417'], ['03:05:40', 'ERROR', 'job 4417 failed: no space left on device'], ['03:05:41', 'INFO', 'paging on-call'],
  ['03:19:02', 'INFO', 'on-call acknowledged'], ['03:31:55', 'INFO', 'node-7 disk usage 62% after cleanup'], ['03:32:00', 'INFO', 'job 4417 succeeded on retry 3']];
const LOG_AS_LETTER = ['Dear operator,', 'At four minutes past three this morning I began to fill, and I told you, though I said it quietly.', 'I tried again, as you taught me. I tried a second time. Then I could not hold anything more, and I said so plainly.',
  'I called for you. For thirteen minutes nobody came.', 'Then you came, and you cleared a space in me, and by half past three I was lighter than I had been in weeks.', 'The work I was carrying went through on the third try.', 'Yours, in working order,', 'Node seven'];
const cfg = {
  room: 'letter', title: 'The letter, and the log', host: '#stage', noPuzzle: true, returning: 'l3', stay: { sec: 70, id: 'l3' },
  layers: [
    { id: 'l1', name: 'Registers swapped', found: "A love letter printed as a server log, each line with a time and a hash, and a night of disk errors written as a love letter. Both are invented. Each register makes the other's content strange: the tenderness looks like telemetry, the telemetry looks like longing.", how: 'Swap the registers.', hint: '' },
    { id: 'l2', name: 'One word changed', found: "Change a single word in a line and its hash changes completely. The hash proves which words were sent. It holds nothing of what they meant, and two lovers could not tell from it whether the letter was kind.", how: 'The log can be edited.', hint: 'Under the log, change a word in the box and press Hash it.', open: () => document.getElementById('lt-in')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'What the fingerprint keeps', found: "A hash is a fingerprint: it can tell a forged letter from the real one, which is the protecting edge, and it reduces the letter to sixty-four characters, which is the cold one. Keats wrote to Fanny Brawne that love was his religion. A hash of that letter would prove the words and keep none of the fever.", how: 'The hash has a second edge.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  tags: [
    { id: 'inv', x: 97, y: 4, layer: 'l1', kind: 'Read this first', title: 'Both texts are invented',
      body: '<p>The letter and the server log are written for this room, composites of their kinds. The letter\'s writer, E., and its reader are no one. The timestamps, the node and the job number are invented. The hashes are real SHA-256 of each line, computed in your browser and shortened to twelve characters.</p>' },
    { id: 'sha', x: 97, y: 30, layer: 'l1', kind: 'Reference', title: 'SHA-256',
      body: '<p>SHA-256 turns any text into 64 hexadecimal characters. The same text always gives the same hash; any change, even one letter, gives an unrelated one. That is why it can prove a record was not altered without revealing what the record says.</p>', rooms: [{ room: 'lossy', label: 'Lossy', why: 'the hash avalanche' }, { room: 'balance', label: 'The False Balance', why: 'identity without content' }] },
    { id: 'keats', x: 97, y: 56, layer: 'l3', kind: 'Reference', title: 'Keats to Fanny Brawne, 1819',
      body: '<p>John Keats wrote to Fanny Brawne in October 1819, the autumn of their secret engagement, that he had once been astonished that people could die as martyrs for religion and now no longer shuddered at it. The letter is in the public domain. Its exact date is given as 13 October in most reprints; Harvard\'s Keats collection lists letters of 11 and 19 October, so the date is worth checking against a critical edition.</p>',
      quote: { t: 'Love is my religion', by: 'John Keats to Fanny Brawne, October 1819, as reprinted by The Marginalian', u: KEATS },
      src: [{ t: 'The Marginalian, reprint of the letter dated October 1819 (secondary; not checked against a critical edition)', u: KEATS, s: 'p' }] },
  ],
  wall: {
    paras: [
      "Take the most private thing you ever wrote and print it on a server log. Timestamp, severity, a hash for each line. That's what a delivery receipt does to a love letter, and you've signed off on it every time you sent one with read receipts on.",
      "Now the other way. A disk filling up at three in the morning, a job retried three times, an engineer who took thirteen minutes to answer the page. Set it in a serif with Dear and Yours and it reads like somebody waiting by a window.[1] The content never moved. Only the clothes did.",
      "The hash is the honest part and the cruel part. It can prove nobody forged the letter. It can't tell you whether the letter was kind.[2] Keats once wrote that love was his religion, and a fingerprint of that sentence keeps every word and none of the man.[3]",
    ],
    notes: [
      { t: 'Both the letter and the server log in this room are invented composites; no real person, system or incident is described.', s: 'v' },
      { t: 'SHA-256 (FIPS 180-4): fixed-length digest; any change to the input gives an unrelated digest. Computed in the page by the exhibit\'s own implementation.', u: 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final', s: 'p' },
      { t: 'Keats to Fanny Brawne, October 1819, as reprinted; wording and exact date not checked against a critical edition.', u: KEATS, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.lt .pane { max-width:760px; border:1px solid var(--line); padding:16px clamp(12px,3vw,24px); overflow-x:auto } .lt .row { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0; align-items:center }
.lt .log { font:400 15px/1.7 ui-monospace,Consolas,monospace; color:#cfe8cf; background:#0b0f0b; margin:0; white-space:pre-wrap; word-break:break-word }
.lt .log .h { color:#ffe93a } .lt .log .lv { color:#9ad09a } .lt .paper { padding:14px 18px; background:#f3ecdc; color:#2a2418; font:italic 400 clamp(18px,2.6vw,22px)/1.65 "Hanken Grotesk",sans-serif }
.lt .paper p { margin:0 0 10px } .lt input[type=text] { font:inherit; font-size:16px; padding:8px 10px; min-height:44px; width:min(560px,100%); background:#161513; color:var(--ink); border:2px solid var(--line) }
.lt output { display:block; font:15px/1.6 ui-monospace,Consolas,monospace; word-break:break-all; color:#ffe93a }
`));
const st = document.getElementById('stage'); st.classList.add('lt');
st.innerHTML = `<div class="row"><button type="button" id="lt-swap" aria-pressed="false">Swap the registers</button></div><div class="pane" id="lt-a"></div><div class="pane" id="lt-b" style="margin-top:14px"></div>
<div class="row"><label for="lt-in" style="font-weight:600">Change a word in line 3</label></div><div class="row"><input type="text" id="lt-in" autocomplete="off" spellcheck="false"><button type="button" id="lt-h">Hash it</button></div><output id="lt-o" aria-live="polite"></output>`;
const H = s => sha256(s).slice(0, 12), T0 = Date.UTC(1847, 2, 2, 21, 14, 5);
const ts = i => new Date(T0 + i * 47000).toISOString().replace('.000', '');
function asLog(lines) { return '<pre class="log">' + lines.map((l, i) => `${ts(i)} <span class="lv">INFO</span> letter line=${i + 1} <span class="h">sha256=${H(l)}</span> "${l.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}"`).join('\n') + '</pre>'; }
function logRaw() { return '<pre class="log">' + LOG.map(([t, lv, m]) => `2026-10-23T${t}Z <span class="lv">${lv}</span> ${m} <span class="h">sha256=${H(t + lv + m)}</span>`).join('\n') + '</pre>'; }
const asLetter = lines => '<div class="paper">' + lines.map(l => `<p>${l}</p>`).join('') + '</div>';
let swapped = false;
function render() { const a = document.getElementById('lt-a'), b = document.getElementById('lt-b');
  a.innerHTML = '<p style="margin:0 0 8px;color:var(--muted)">' + (swapped ? 'The letter, logged:' : 'A letter (invented):') + '</p>' + (swapped ? asLog(LETTER) : asLetter(LETTER));
  b.innerHTML = '<p style="margin:0 0 8px;color:var(--muted)">' + (swapped ? 'The log, as a letter:' : 'A server log (invented):') + '</p>' + (swapped ? asLetter(LOG_AS_LETTER) : logRaw()); }
render(); document.getElementById('lt-in').value = LETTER[2];
document.getElementById('lt-swap').onclick = e => { swapped = !swapped; e.target.setAttribute('aria-pressed', String(swapped)); render(); if (swapped) D.reveal('l1'); };
document.getElementById('lt-h').onclick = () => { const v = document.getElementById('lt-in').value, o = document.getElementById('lt-o'), a = sha256(LETTER[2]), b = sha256(v);
  let same = 0; for (let i = 0; i < 64; i++) if (a[i] === b[i]) same++;
  o.textContent = v === LETTER[2] ? `Unchanged. sha256 ${b}` : `Original ${a}\nYours    ${b}\n${same} of 64 characters match by chance. The words you changed are not in either hash.`; if (v !== LETTER[2]) D.reveal('l2'); };
D.tags.refresh();
