// Between stations, deepened: tune to the hydrogen line (layer 2) and read the printout as loudness, not as a message (layer 3).
import { depth, el } from './core.js';
import { hashAnswer } from './sha.js';

const WOW = 'https://en.wikipedia.org/wiki/Wow!_signal';
const cfg = {
  room: 'static', title: 'Between stations', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'A dial that never lands', found: 'Turn the dial and the dots gather into almost-pictures that slide away. It never stops on a station.', how: 'Turn the dial.', hint: '' },
    { id: 'l2', name: 'The hydrogen line', found: 'Tuned to about 1420.4 MHz, the frequency neutral hydrogen radiates. It was where radio astronomers expected a deliberate signal, and where the Wow! signal was recorded.', how: 'The dial has a frequency.', hint: 'Under the dial, read the frequency and tune it to the hydrogen line, about 1420.4 MHz.', open: () => { const f = document.getElementById('f'); f.value = 406; f.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.hl')?.scrollIntoView({ block: 'center' }); } },
    { id: 'l3', name: 'Loudness, not a message', found: 'The famous string 6EQUJ5 is how strong the signal was over six samples: it rises to a peak at U and falls away. It looks like a password and is a loudness trace.', how: 'The printout has a plain reading.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '72', note: 'Seconds: the time the Wow! signal was in Big Ear\'s view on 15 August 1977.', src: WOW },
  riddle: { q: 'What do you hear between stations on an analog radio, and see on a screen with no signal? And it is also the opposite of moving. Six letters.', hint: 'Six letters. It is also the name of the dot field you turned.', answer: 'static', plain: 'Static is the noise between stations, and the word also means still. The room is made of it.', hash: hashAnswer('static') },
  tags: [
    { id: 'bigear', x: 10, y: 8, layer: 'l1', kind: 'Reference', title: 'Big Ear, Ohio, 1977',
      body: '<p>On 15 August 1977 Ohio State University\'s Big Ear radio telescope recorded a strong narrowband signal that appeared to come from the direction of Sagittarius. It was in view for 72 seconds as the Earth turned. The astronomer Jerry Ehman found it days later on the printout and wrote "Wow!" beside it. It has never been seen again, and searches at the same patch of sky in later decades found nothing.</p>',
      src: [{ t: 'Wikipedia, Wow! signal', u: WOW, s: 'p' }, { t: 'Mental Floss, 6EQUJ5: The Wow! Signal', u: 'https://www.mentalfloss.com/article/67295/6equj5-wow-signal', s: 'p' }] },
    { id: 'gold', x: 90, y: 12, layer: 'l1', kind: 'Plate', title: 'The Golden Record',
      body: '<p>The record carried on the Voyager probes, which launched in 1977. NASA\'s image PIA14113, public domain. The record\'s own audio has mixed rights and is evoked here, never reused. This copy of the picture is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/static-plate.png', alt: 'The gold-plated Voyager record in its cover with instructions engraved', cap: 'NASA PIA14113, public domain. Resized.', w: 240 },
      src: [{ t: 'NASA image PIA14113, Voyager Special Cargo: The Golden Record', u: 'https://images.nasa.gov/details/PIA14113', s: 'p' }], rooms: [{ room: 'groove', label: 'The skipping groove', why: 'a disc is a groove a needle reads' }] },
    { id: 'noise', x: 50, y: 80, layer: 'l1', kind: 'Read this first', title: 'The static is generated',
      body: '<p>The dots are generated in code. The almost-pictures that gather in them are chosen by us. A pattern in noise is easy to find and easy to sell, and the room is built so you can feel that.</p>' },
    { id: 'hl', host: '.hl', x: 92, y: 10, layer: 'l2', kind: 'Reference', title: 'The hydrogen line',
      body: '<p>Neutral hydrogen radiates at about 1420.4 MHz, and that frequency was proposed as a likely choice for interstellar contact. Sources give the Wow! signal\'s frequency slightly differently, 1420.4556 MHz in one and 1420.4056 MHz in another, so this room says "about 1420.4 MHz".</p>',
      src: [{ t: 'Mental Floss and a second article on the frequency', u: 'https://www.mentalfloss.com/article/67295/6equj5-wow-signal', s: 'p' }] },
  ],
  wall: {
    paras: [
      'Sweep the dial and nothing settles. Static gathers into almost-shapes and slides away, which is how your eyes treat noise, and is also how a good con works. In 1977 a radio telescope in Ohio recorded a strong narrow signal for 72 seconds, an astronomer circled it on a printout and wrote "Wow!", and it has not been heard again.[1]',
      'Of course people read it as a message. 6EQUJ5 looks like a password. It is loudness: one character for each sample, rising to the U and falling back to 5, which is what a source sliding through the telescope\'s view looks like.[2] I am not telling you whether anyone was out there. The popular reading of that string as a code is wrong, and the thing everybody remembers is a pen mark.',
      'Nothing else ever answered. Searches at the same patch of sky through the following decades found nothing.[1] The same year two probes carrying a gold disc and a needle left Earth for anyone who might have one,[3] which is the other half of the story. We listen, and we also leave a groove in the dark.',
      'Go back to the dial. A tune that never lands, a station that never comes in, and one man with a pen who wrote the only reply the signal ever got: a single word and an exclamation mark. That is the part I would keep. The rest is us, supplying the pattern.',
    ],
    notes: [
      { t: 'Big Ear, Ohio State University, 15 August 1977: a strong narrowband signal from the direction of Sagittarius, in view for 72 seconds; found on the printout by Jerry Ehman a few days later (sources say 18 August or "a few days"); never detected again; later searches found nothing.', u: WOW, s: 'p' },
      { t: '6EQUJ5 is the signal\'s intensity over time, not a message: each character is a sample (a 10-second average plus about 2 seconds of processing, so 12 seconds per character, six characters for 72 seconds). The scheme with letters standing for values from 10 up is consistent with a source that says U is about 30 times the noise, but no result stated the mapping outright.', u: 'https://www.mentalfloss.com/article/67295/6equj5-wow-signal', s: 'p' },
      { t: 'The Voyager probes carrying the Golden Record launched in 1977. Not searched for this room beyond the NASA image page; treat the year as from memory.', u: 'https://images.nasa.gov/details/PIA14113', s: 'u' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.hl, .pr { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .hl h2, .pr h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .hl p, .pr p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.hl .mhz { font:800 clamp(28px,5vw,44px)/1.1 "Hanken Grotesk",sans-serif; margin:6px 0 } .pr svg { width:100%; max-width:560px; height:auto; background:#0b0b0b; border:1px solid var(--line) } .pr text { fill:#eee9df; font:16px "Hanken Grotesk",sans-serif }
`));
// ---- layer 2: the dial as a frequency ----
const hl = el('section', 'hl'); hl.setAttribute('aria-labelledby', 'hl-h');
hl.innerHTML = `<h2 id="hl-h">What frequency is the dial on?</h2><p>Our mapping, for this room: the dial runs from 1420.000 to 1421.000 MHz. Neutral hydrogen radiates at about 1420.406 MHz.</p><p class="mhz" id="hl-m">1420.120 MHz</p><button type="button" id="hl-b">Tune to the hydrogen line</button><p id="hl-o" aria-live="polite">Not on the hydrogen line.</p>`;
document.querySelector('.row').after(hl);
const f = document.getElementById('f'), mhz = document.getElementById('hl-m'), out = document.getElementById('hl-o');
const upd = () => { const v = +f.value, m = 1420 + v / 1000; mhz.textContent = m.toFixed(3) + ' MHz'; if (Math.abs(v - 406) <= 3) { out.textContent = 'On the hydrogen line, about 1420.406 MHz. This is where radio astronomers expected a deliberate signal, and about where the Wow! signal was recorded.'; D.reveal('l2'); } else out.textContent = 'Not on the hydrogen line.'; };
f.addEventListener('input', upd); upd();
document.getElementById('hl-b').onclick = () => { f.value = 406; f.dispatchEvent(new Event('input', { bubbles: true })); };
// ---- layer 3: the printout read as loudness ----
const V = { 6: 6, E: 14, Q: 26, U: 30, J: 19, 5: 5 }, CH = '6EQUJ5'.split('');
const pr = el('section', 'pr'); pr.hidden = true; pr.setAttribute('aria-labelledby', 'pr-h');
pr.innerHTML = `<h2 id="pr-h">6EQUJ5, read as loudness</h2><p>Six samples, twelve seconds apart, 72 seconds in all. Each character is how far above the noise that sample was. Letters stand for values from 10 up, which is consistent with U being about 30. The bars rise to a peak and fall, the shape of a source crossing the telescope's view.</p>
<svg viewBox="0 0 560 220" role="img" aria-label="A bar chart of six samples with heights 6, 14, 26, 30, 19 and 5, rising to a peak at the fourth bar and falling">${CH.map((c, i) => { const h = V[c] * 5; return `<rect x="${40 + i * 84}" y="${180 - h}" width="56" height="${h}" fill="${c === 'U' ? '#ffe93a' : '#e0177e'}"/><text x="${68 + i * 84}" y="204" text-anchor="middle">${c}</text><text x="${68 + i * 84}" y="${172 - h}" text-anchor="middle">${V[c]}</text>`; }).join('')}</svg><p>It was never a message. It looks like one because it is short and alphanumeric. Source: Wikipedia and Mental Floss; the letter mapping is not stated outright in what I read.</p>`;
D.section.before(pr); D.on('l3', () => { pr.hidden = false; });
D.settle(document.getElementById('stage'));
