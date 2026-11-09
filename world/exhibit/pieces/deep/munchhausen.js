// By his own hair, deepened: the regress, one hand holding the last (layer 2), and the real baron (layer 3).
import { depth, el, RM } from './core.js';
import { hashAnswer } from './sha.js';

const TRI = 'https://en.wikipedia.org/wiki/M%C3%BCnchhausen_trilemma', BAR = 'https://en.wikipedia.org/wiki/Baron_Munchausen';
const cfg = {
  room: 'munchhausen', title: 'By his own hair', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'The pull', found: 'The baron pulls his own hair. The circle, the regress and the stop each appear as the pull goes on, and the evidence holding him up stays at zero.', how: 'Pull the hair.', hint: '' },
    { id: 'l2', name: 'A hand to hold the hand', found: 'Each new hand holds the last, and the chain has no end. Nobody pays to walk it.', how: 'There is a way to add more hands.', hint: 'Under the baron, press the button that adds a hand, again and again.', open: () => document.querySelector('.rg')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The real baron', found: 'A real man, Hieronymus von Münchhausen (1720 to 1797), was upset when a fictional version with his name went into print. His record was written by someone else.', how: 'The baron was a person.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '1968', note: 'The year Hans Albert named the Münchhausen trilemma in Traktat über kritische Vernunft.', src: TRI },
  riddle: { q: 'I am what he pulled. Change my A to an E and I am the person who inherits the estate. Before the change, what am I?', hint: 'Four letters. It grows on your head.', answer: 'hair', plain: 'In the tale the baron pulls himself out of a swamp by his own hair. Changing the A to an E gives "heir", a one-letter word turn and nothing more.', hash: hashAnswer('hair') },
  tags: [
    { id: 'hos', x: 50, y: 8, layer: 'l1', kind: 'Plate', title: 'Hosemann\'s baron',
      body: '<p>Theodor Hosemann\'s illustrations to the Baron Munchausen tales, from the 1840s, public domain on Wikimedia Commons. This copy is lossless and carries a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/munchhausen-plate.png', alt: 'An engraving of a baron in a hat hanging by his own pigtail above ground', cap: 'Hosemann, Munchhausen 10, Wikimedia Commons, public domain. Resized.', w: 200 },
      src: [{ t: 'Wikimedia Commons, Hosemann_Münchhausen_10.png', u: 'https://commons.wikimedia.org/wiki/File:Hosemann_M%C3%BCnchhausen_10.png', s: 'v' }] },
    { id: 'tri', x: 10, y: 20, layer: 'l1', kind: 'Reference', title: 'The trilemma',
      body: '<p>Hans Albert named the Münchhausen trilemma in his 1968 book Traktat über kritische Vernunft. Every attempt to justify a claim ends in an infinite regress, a logical circle or a dogmatic stopping point. It restates Agrippa\'s older trilemma, among the five modes of Agrippa recorded by Sextus Empiricus. The name comes from the baron\'s bootstrapping.</p>',
      src: [{ t: 'Wikipedia, Münchhausen trilemma', u: TRI, s: 'p' }], rooms: [{ room: 'balance', label: 'The False Balance', why: 'a standard outside the instrument' }, { room: 'mirror', label: 'Weigh it yourself', why: 'a scale that reads true for its builder' }] },
    { id: 'swamp', x: 50, y: 78, layer: 'l1', kind: 'Read this first', title: 'The swamp is a dot field',
      body: '<p>The swamp is drawn as dots whose heights respond to your pointer. The count of evidence holding the baron up stays at zero because nothing outside him is in the picture.</p>' },
    { id: 'real', host: '.real', x: 92, y: 10, layer: 'l3', kind: 'Reference', title: 'Hieronymus von Münchhausen',
      body: '<p>A German nobleman (1720 to 1797) who fought for the Russian Empire in the Russo-Turkish war of 1735 to 1739 and later became known for tall tales about it. Rudolf Erich Raspe published an English book of the tales anonymously in London in 1785 and Gottfried August Bürger a German version in 1786. Accounts say the real baron was deeply upset at the fictional character. Whether the swamp-and-pigtail episode is in Raspe\'s text or only in later versions is not confirmed here.</p>',
      src: [{ t: 'Wikipedia, Baron Munchausen', u: BAR, s: 'p' }, { t: 'Britannica, Baron Münchhausen', u: 'https://www.britannica.com/EBchecked/topic/397413/Baron-Munchhausen', s: 'p' }] },
  ],
  wall: {
    paras: [
      'A verifier that certifies itself passes every test it wrote. That is the whole joke and the whole room. A baron on a horse in a swamp takes hold of his own hair and hauls himself out, and a philosopher in 1968 named the problem after him: every attempt to justify a claim ends in a circle, an infinite regress or an arbitrary stop.[1] Hans Albert took the old trilemma of Agrippa, which Sextus Empiricus recorded, and gave it a funnier name.[1]',
      'Look at what each horn costs. The circle is free and worthless. The regress is honest and never ends, and nobody pays to walk it. The stop is a nail driven into the sky by a person with a name, a budget and a reason to stop here. I have driven nails of my own into this exhibit, and the lamp on every scale in it reads TRUE for me too.',
      'Last point, and it is a mean one. The real baron, Hieronymus von Münchhausen, 1720 to 1797, told tall tales about the Russian wars and was deeply upset when a fictional version with his name started going round in books.[2] He never got to certify himself. Somebody else wrote his reputation, which is the other way a record goes wrong: written by a person who is not you. Don\'t look at me like that. Mine reads TRUE too.',
    ],
    notes: [
      { t: 'Hans Albert, Traktat über kritische Vernunft (1968), named the Münchhausen trilemma, restating Agrippa\'s trilemma (infinite regress, circle, dogmatic stop) as recorded by Sextus Empiricus. Read through Wikipedia and secondary papers; the book was not opened.', u: TRI, s: 'p' },
      { t: 'Hieronymus Karl Friedrich von Münchhausen (1720 to 1797), service in Russia in the war of 1735 to 1739; Raspe\'s anonymous English book (London, 1785) and Bürger\'s German version (1786); the real baron\'s distress at the character. The swamp-and-pigtail episode\'s textual history is not confirmed.', u: BAR, s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.rg, .real { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .rg h2, .real h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .rg p, .real p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.rg ol { margin:8px 0; padding-left:26px; font-size:16px; line-height:1.5; columns:2; max-width:640px } .rg li { margin:2px 0 } @media (max-width:640px) { .rg ol { columns:1 } }
`));
const rg = el('section', 'rg'); rg.setAttribute('aria-labelledby', 'rg-h');
rg.innerHTML = `<h2 id="rg-h">A hand to hold the hand</h2><p>The baron needs something outside him to hold him up. Add a hand to hold him, then a hand to hold that hand.</p><button type="button" id="rg-b">Add a hand</button><ol id="rg-l"></ol><p id="rg-o" aria-live="polite">No hands yet.</p>`;
document.getElementById('pull').after(rg);
let n = 0; document.getElementById('rg-b').onclick = () => { n++; const li = el('li', null, n === 1 ? 'Hand 1 holds the baron.' : `Hand ${n} holds hand ${n - 1}.`); document.getElementById('rg-l').append(li);
  document.getElementById('rg-o').textContent = n < 8 ? `Who holds hand ${n}?` : `${n} hands, and who holds hand ${n}? The chain has no end. Nobody pays to walk it, so it stops somewhere a person chose.`; if (n >= 8) D.reveal('l2'); };
const re = el('section', 'real'); re.hidden = true; re.setAttribute('aria-labelledby', 're-h');
re.innerHTML = `<h2 id="re-h">The man behind the name</h2><p>Hieronymus Karl Friedrich von Münchhausen lived from 1720 to 1797. He served in Russia and told tall tales about it. An anonymous English book of tales under his name came out in London in 1785, and a German version in 1786. Accounts say he was deeply upset. A record written by someone else is still a record, and still a way for a reading to go wrong.</p>`;
D.section.before(re); D.on('l3', () => { re.hidden = false; });
D.settle(document.getElementById('stage'));
