// Emet, Met, deepened: the alphabet that sets truth against falsehood (layer 2) and the oldest golem in the record, which cannot answer (layer 3).
import { depth, el } from './core.js';
import { hashAnswer } from './sha.js';

const cfg = {
  room: 'emet', title: 'Emet, Met', host: '#stage', returning: 'l3', stay: { sec: 70, id: 'l3' },
  marks: { number: 'Figure', plate: 'Plate', riddle: 'Puzzle' },
  layers: [
    { id: 'l1', name: 'One letter', found: 'The word on the brow is emet, truth. Slide the first letter out and met, dead, is what is left, and the clay giant sits down.', how: 'Take the aleph out.', hint: '' },
    { id: 'l2', name: 'Truth spans the alphabet', found: 'The Talmud notes that the letters of emet are the first, middle and last of the alphabet, and the letters of sheker, a lie, sit side by side near the end.', how: 'There is an alphabet below the figure.', hint: 'Under the controls, set the alphabet to show truth, then falsehood, and read the distances.', open: () => document.querySelector('.alef')?.scrollIntoView({ block: 'center' }) },
    { id: 'l3', name: 'The oldest golem answers nothing', found: 'The oldest golem story in the record is in the Talmud, and its creature cannot speak. The Prague legend is much later: the stories of the rabbi start in the 1800s.', how: 'The legend has an earlier text than the one on the brow.', hint: 'Stay a minute and a half, or come back on another visit.' },
  ],
  number: { text: '1609', note: 'The year Rabbi Judah Loew, the Maharal of Prague, died. The golem stories attached to him appear in print more than two centuries later.', src: 'https://jewishmag.com/114mag/golem/golem.htm' },
  riddle: { q: 'Take one letter from the word on the brow and the clay giant is dead. The letter has a name. It is the first of its alphabet, and the word for what it begins is truth. What is the letter?', hint: 'Five letters. It is also where the word "alphabet" starts, in another script.', answer: 'aleph', plain: 'In the folklore the Hebrew word emet (truth) is written on the golem\'s brow, and erasing the first letter, aleph, leaves met (dead). That is the whole mechanism of the legend, and the room shows it.', hash: hashAnswer('aleph') },
  tags: [
    { id: 'ales', x: 8, y: 20, layer: 'l1', kind: 'Archival object', title: 'The Maharal and the Golem, 1899',
      body: '<p>A drawing by Mikolas Ales dated 1899 in Wikimedia Commons, public domain, showing the Maharal of Prague and the golem. The legend was in circulation by then; the drawing is one of its best-known images.</p>',
      src: [{ t: 'Wikimedia Commons, Mikolas Ales, The Maharal of Prague and the Golem', u: 'https://commons.wikimedia.org/wiki/File:Mikol%C3%A1%C5%A1_Ale%C5%A1_-_The_Maharal_of_Prague_and_the_Golem.jpg', s: 'v' }] },
    { id: 'loew', x: 92, y: 16, layer: 'l1', kind: 'Plate', title: 'Golem and Loew',
      body: '<p>A second print of the same scene, Golem and Loew (Commons gives the date 1899 and the artist as Ales). This copy is lossless and holds a line in its lowest colour bits.</p>',
      plate: { src: 'assets/img/dp/emet-plate.png', alt: 'A drawing of a rabbi at the brow of a standing clay giant', cap: 'Wikimedia Commons, public domain. Resized.', w: 220 },
      src: [{ t: 'Wikimedia Commons, Golem_and_Loew.jpg', u: 'https://commons.wikimedia.org/wiki/File:Golem_and_Loew.jpg', s: 'v' }] },
    { id: 'brow', x: 50, y: 22, layer: 'l1', kind: 'Care', title: 'Real letters, drawn with care',
      body: '<p>The three letters are aleph, mem and tav, set in a standard Hebrew typeface. The story is told in its folklore form. A reader of Hebrew should check the letters, their order and the retelling before this room is published.</p>' },
    { id: 'alef', host: '.alef', x: 92, y: 12, layer: 'l2', kind: 'Reference', title: 'Shabbat 104a',
      body: '<p>The Talmud asks why the letters of emet are spread across the alphabet and the letters of sheker sit together, and answers that lies are common and truth is rare. It also says falsehood stands on one foot and truth on a firm base. The Maharal is read as saying that truth spans the alphabet from aleph to tav, while every lie rests on a narrow part of it.</p>',
      src: [{ t: 'Torah in Motion, Shabbat 104a: Alphabetical Order', u: 'https://torahinmotion.org/articles/thoughts-from-the-daf/shabbat-104a-alphabetical-order', s: 'p' }, { t: 'Etzion, on the Maharal\'s reading', u: 'https://etzion.org.il/en/node/49153', s: 'p' }, { t: 'Soncino Talmud text at halakhah.com, Shabbath 104', u: 'https://halakhah.com/shabbath/shabbath_104.html', s: 'p' }] },
  ],
  wall: {
    paras: [
      'Hate the clay all you like, it never said a word. The oldest golem story we can actually check is in the Talmud, where Rava makes a man and sends him to Rabbi Zera, and Zera talks to him and gets nothing back, and tells him to go home to dust.[1] A made thing that cannot answer is the whole problem, and it is your problem, not the clay\'s.',
      'And the Prague one? Nobody who knew the rabbi wrote it down. Judah Loew died in 1609, none of his works or his students\' works mention a golem, and the stories show up in print in the first half of the 1800s and get tied firmly to him in a book from about 1909.[2] Fine. Legends get written on late. I am not here to ruin it. I am here to say the letter on the brow is older than the legend, and the legend is older than your fear of your own tools.',
      'Now the letters. Emet is aleph, mem, tav: the first, the middle and the last of the alphabet. Sheker, a lie, is shin, qof, resh, three neighbours near the end, and the Talmud says the lie stands on one leg while the truth has a base.[3] The Maharal, the rabbi in the story, is read as saying truth spans the whole alphabet and a lie holds only a narrow kernel of it.[4] Take out the aleph and you have met, dead. One letter, and nobody had to prove a thing.',
      'Don\'t take this for a lesson about robots. The point is smaller and meaner. A claim lives while someone can check it and dies when the first letter goes, and the first letter is whatever the whole thing hangs from. These are real letters in a living faith, so someone who reads Hebrew has to check every word here before it goes anywhere, and the page says so.',
    ],
    notes: [
      { t: 'Babylonian Talmud, Sanhedrin 65b: Rava creates a man, Rabbi Zera speaks to him and he does not answer, and Zera tells him to return to his dust. Translations differ on who is blamed for the making. Read in a Cambridge University Press excerpt and in Sefaria sheets; the Talmud text itself was not opened.', u: 'https://www.cambridge.org/core/product/identifier/CBO9780511483196A013/type/BOOK_PART', s: 'p' },
      { t: 'Loew died in 1609. One summary says none of his works, his contemporaries\' works or his disciples\' works mention the golem; the stories begin in the first third of the 1800s, and a 1909 book by Yudl Rosenberg ties the golem to Loew (another source dates that book to 1913). Dates of the earliest printed versions vary; none confirmed against a primary text.', u: 'https://jewishmag.com/114mag/golem/golem.htm', s: 'p' },
      { t: 'Shabbat 104a on the shape and order of the letters of emet and sheker. Read through Torah in Motion, NJOP and the Soncino text at halakhah.com; the Hebrew and Aramaic were not checked here.', u: 'https://torahinmotion.org/articles/thoughts-from-the-daf/shabbat-104a-alphabetical-order', s: 'p' },
      { t: 'The Maharal\'s reading of emet as spanning the alphabet, as summarised by Etzion.', u: 'https://etzion.org.il/en/node/49153', s: 'p' },
    ],
  },
};
const D = depth(cfg);
document.head.append(el('style', null, `
.alef { position:relative; margin:22px 0 8px; max-width:760px; border:1px solid var(--line); padding:14px 16px 12px } .alef h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .alef p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.al-row { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:12px 0; direction:rtl } .al-row div { width:44px; height:64px; display:grid; align-content:center; justify-items:center; border:1px solid #3a3833; font:700 26px "Frank Ruhl Libre","Times New Roman",serif; color:#eee9df; background:#1b1a17 } .al-row small { font:16px "Hanken Grotesk",sans-serif; color:#a39e94; direction:ltr }
.al-row div.t { background:#e0177e; color:#fff; border-color:#e0177e } .al-row div.f { background:#ffe93a; color:#111; border-color:#ffe93a }
.old { margin:20px 0; padding:14px 18px; border:1px solid #3a3833; max-width:760px; font-family:"Hanken Grotesk",sans-serif; font-size:18px; line-height:1.6 } .old h2 { font:800 18px "Hanken Grotesk",sans-serif; margin:0 0 8px } .old blockquote { margin:10px 0; padding-left:12px; border-left:3px solid var(--hot); font-style:italic } .old cite { display:block; font:16px "Hanken Grotesk",sans-serif; font-style:normal; color:#a39e94; margin-top:4px }
`));
const LET = 'אבגדהוזחטיכלמנסעפצקרשת'.split(''), NAMES = ['aleph', 'bet', 'gimel', 'dalet', 'he', 'vav', 'zayin', 'het', 'tet', 'yod', 'kaf', 'lamed', 'mem', 'nun', 'samekh', 'ayin', 'pe', 'tsadi', 'qof', 'resh', 'shin', 'tav'];
const al = el('section', 'alef'); al.setAttribute('aria-labelledby', 'al-h');
al.innerHTML = `<h2 id="al-h">Where the letters sit</h2><p>The 22 Hebrew letters in order, numbered. Choose a word to see where its letters fall.</p><div class="al-row" lang="he" role="img" aria-label="The 22 letters of the Hebrew alphabet in order from aleph to tav">${LET.map((l, i) => `<div data-i="${i + 1}">${l}<small>${i + 1}</small></div>`).join('')}</div>
<div class="fl-ctl" style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" id="al-t" aria-pressed="false">Show emet, truth</button><button type="button" id="al-f" aria-pressed="false">Show sheker, a lie</button></div><p id="al-o" aria-live="polite">Nothing chosen.</p>`;
document.querySelector('.ctl').after(al);
const T = [1, 13, 22], F = [21, 19, 20], row = al.querySelector('.al-row'), out = document.getElementById('al-o');
function mark(t, f) { row.querySelectorAll('div').forEach(d => { const i = +d.dataset.i; d.className = (t && T.includes(i)) ? 't' : (f && F.includes(i)) ? 'f' : ''; }); document.getElementById('al-t').setAttribute('aria-pressed', String(t)); document.getElementById('al-f').setAttribute('aria-pressed', String(f)); }
const seen = new Set(), tick = k => { seen.add(k); if (seen.size === 2) D.reveal('l2'); };
document.getElementById('al-t').onclick = () => { mark(true, false); out.textContent = 'Emet is aleph (1), mem (13), tav (22): the first, the middle and the last. From first to last is 21 steps.'; tick('t'); };
document.getElementById('al-f').onclick = () => { mark(false, true); out.textContent = 'Sheker is shin (21), qof (19), resh (20): three neighbours, all within 2 steps of each other, near the end. The Talmud says a lie stands on one leg.'; tick('f'); };
const old = el('section', 'old'); old.hidden = true; old.setAttribute('aria-labelledby', 'old-h');
old.innerHTML = `<h2 id="old-h">The oldest golem</h2><p>Before the clay giant of Prague there is a creature in the Talmud, made by Rava. It has no word on its brow.</p><blockquote>Rabbi Zera spoke to him and he did not answer.<cite>Babylonian Talmud, Sanhedrin 65b, in the translation printed in a Cambridge University Press excerpt. Wording varies between translations. Partly checked.</cite></blockquote><p>The Prague stories attach to Rabbi Judah Loew, who died in 1609. None of his own works mention a golem, and the legends appear in print in the 1800s. The letters on the brow are older than the legend.</p>`;
D.section.before(old); D.on('l3', () => { old.hidden = false; });
D.settle(document.getElementById('stage'));
