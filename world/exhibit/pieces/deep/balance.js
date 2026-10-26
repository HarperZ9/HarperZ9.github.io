// The False Balance, deepened: an assay below the stage (layer 2) and a papyrus of the 42 declarations over the stage (layer 3).
import { depth, el, RM } from './core.js';
import { cfg, FORTY_TWO } from './bal-cfg.js';

const D = depth(cfg), $ = id => document.getElementById(id), stage = $('stage');
document.head.append(el('style', null, `
.assay { margin:22px 0 8px; max-width:720px; position:relative; border:1px solid var(--line); padding:14px 16px 12px } .assay h2 { font-size:18px; margin:0 0 6px; font-weight:800 } .assay p { font-size:16px; line-height:1.5; margin:6px 0; max-width:64ch }
.asy-row { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin:10px 0 } .asy-row label { display:grid; gap:4px; font-weight:600; font-size:16px } .asy-row input[type=range] { width:min(340px,76vw); min-height:44px; accent-color:var(--hot) }
.asy-beam { display:block; width:min(360px,100%); height:120px; background:#0d2c4f; border:1px solid var(--line) } .asy-read { font:600 18px "Hanken Grotesk",sans-serif; margin:6px 0 }
.scroll42 { position:absolute; left:50%; transform:translateX(-50%); bottom:2%; width:min(520px,88%); height:54%; background:rgba(232,217,176,.95); color:#2a2418; border:3px double #7a5f2a; overflow:auto; z-index:25; padding:12px 16px; font-family:"Hanken Grotesk",sans-serif; box-shadow:0 10px 30px rgba(0,0,0,.6) }
.scroll42 h3 { margin:0 0 6px; font-size:16px; font-family:"Hanken Grotesk",sans-serif; letter-spacing:.08em; text-transform:uppercase } .scroll42 ol { margin:0; padding-left:30px; font-size:16px; line-height:1.5 } .scroll42 li { margin:3px 0 } .scroll42 p { font-size:16px; margin:8px 0 0; font-weight:700; color:#8a1030 }
.scroll42:focus-visible { outline:3px solid var(--hot); outline-offset:3px } .scroll42 .x { position:sticky; top:0; float:right; min-height:44px; background:#2a2418; color:#e8d9b0; border:0; padding:4px 10px; font-size:16px; cursor:pointer }
@media (max-width:640px) { .scroll42 { height:62%; width:94%; padding:8px 10px } }
`));

// ---- layer 2: weigh the same block on two scales ----
const ay = el('section', 'assay'); ay.setAttribute('aria-labelledby', 'asy-h');
ay.innerHTML = `<h2 id="asy-h">Check the scale against a standard</h2><p>An invented test. A block stamped 100 units by a standard is set on the left pan of our scale. Put counterweights on the right pan until the beam is level.</p>
<div class="asy-row"><label>Counterweights on our right pan <input type="range" id="asy-r" min="0" max="120" value="40" aria-describedby="asy-o"></label></div>
<svg class="asy-beam" id="asy-b" viewBox="0 0 360 120" role="img" aria-label="A beam balance, tilting as the counterweights change"><g id="asy-g"><rect x="40" y="52" width="280" height="8" fill="#c9a24a"/><rect x="40" y="60" width="64" height="30" fill="#8f8b78"/><text x="72" y="80" text-anchor="middle" font-size="16" fill="#111" font-family="sans-serif">100</text><rect id="asy-w" x="256" y="60" width="64" height="30" fill="#c9a24a"/><text id="asy-t" x="288" y="80" text-anchor="middle" font-size="16" fill="#111" font-family="sans-serif">40</text></g><polygon points="180,60 164,110 196,110" fill="#c9a24a"/></svg>
<p class="asy-read" id="asy-o" aria-live="polite">Not level.</p><button type="button" id="asy-s" hidden>Weigh the same block on a scale you did not build</button><p id="asy-x" aria-live="polite"></p>`;
document.querySelector('.controls').after(ay);
const R = $('asy-r'), TRUE = 92;
function tilt() {
  const v = +R.value, d = Math.max(-1, Math.min(1, (TRUE - v) / 40)) * 9, level = v === TRUE;
  $('asy-g').setAttribute('transform', `rotate(${d} 180 56)`); $('asy-t').textContent = v;
  $('asy-o').textContent = level ? 'Level. Our scale says the block weighs 92. The lamp says TRUE.' : (v < TRUE ? 'Not level: the block side is heavier.' : 'Not level: the counterweights are heavier.'); $('asy-s').hidden = !level;
}
R.oninput = tilt; tilt();
$('asy-s').onclick = () => { $('asy-x').textContent = 'A second scale, held by someone else, reads 100. The block was stamped 100 all along. Ours was 8 units short and said TRUE. Nothing inside our scale could have told us.'; D.reveal('l2'); };

// ---- layer 3: the papyrus ----
const sc = el('div', 'scroll42'); sc.hidden = true; sc.tabIndex = 0; sc.setAttribute('role', 'region'); sc.setAttribute('aria-label', 'The forty-two declarations. Scrollable.');
sc.innerHTML = `<button type="button" class="x">Close</button><h3>The forty-two (abridged)</h3><ol>${FORTY_TWO.map(l => `<li>${l}</li>`).join('')}</ol><p>No. 43: I have not rigged the scale. It is not on the list. Other papyri word it differently, and I have not read them.</p>`;
stage.append(sc); sc.querySelector('.x').onclick = () => { sc.hidden = true; };
D.on('l3', () => { sc.hidden = false; if (!RM) sc.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(20px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 700, easing: 'ease-out' }); D.tags.refresh(); });
D.settle(stage);
