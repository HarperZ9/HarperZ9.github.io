// save.js: what the person keeps. "Save all as one page" writes a single HTML file holding the pictures, the words,
// the sound and the story's beats, with the same rules as the room: nothing plays by itself, motion only on a press
// and never under reduced motion. It opens in any browser, offline, and can be shared as one file.
const download = (name, href) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); };
const blobUrl = (text, type) => URL.createObjectURL(new Blob([text], { type }));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const stamp = () => new Date().toISOString().slice(0, 10);

export function savePicture(r, frame = 0) { download(`picture-${stamp()}.png`, r.frames ? r.frames[frame] : r.image); }
export function saveSound(r) { download(`sound-${stamp()}.wav`, r.audio); }
export function saveWords(r) { const url = blobUrl(`${r.words ?? ''}\n${r.text && r.text !== r.words ? `\n${r.text}\n` : ''}`, 'text/plain'); download(`words-${stamp()}.txt`, url); setTimeout(() => URL.revokeObjectURL(url), 5000); }

export function saveStory(r) {
  const beats = r.captions?.length ? r.captions : [{ from: 0, to: 0, text: r.words ?? '' }];
  const frames = r.frames ?? (r.image ? [r.image] : []);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc((r.words ?? 'A story').slice(0, 60))}</title>
<style>body{margin:0;background:#f3efe6;color:#15130f;font:1.2rem/1.5 system-ui,sans-serif}main{max-width:960px;margin:0 auto;padding:16px}
img{width:100%;height:auto;border:2px solid #b9b0a0}button{min-height:56px;min-width:56px;padding:10px 18px;font:inherit;font-weight:600;border:2px solid #15130f;border-radius:6px;background:#f3efe6;margin:8px 8px 0 0}
:focus-visible{outline:4px solid #0b57d0;outline-offset:3px}.cap{font-size:1.5em;font-weight:600}@media (prefers-color-scheme:dark){body{background:#121316;color:#ece7dc}button{background:#121316;color:#ece7dc;border-color:#ece7dc}}</style></head>
<body><main><h1>${esc(r.words ?? '')}</h1>
${frames.length ? `<img id="p" src="${frames[0]}" alt="${esc((beats[0]?.text ?? '') + '. ' + (r.alt ?? ''))}"><p class="cap" id="c" aria-live="polite">${esc(beats[0]?.text ?? '')}</p>` : ''}
${beats.length > 1 ? '<button id="b">Previous</button><button id="n">Next</button>' : ''}${frames.length > 1 ? '<button id="m" aria-pressed="false">Play</button>' : ''}
${r.audio ? `<button id="s" aria-pressed="false">Play sound</button><audio id="a" src="${r.audio}" preload="none"></audio>` : ''}
${r.text && r.text !== r.words ? `<p>${esc(r.text)}</p>` : ''}
<p>${beats.map(b => esc(b.text)).join(' ')}</p></main>
<script>
const F=${JSON.stringify(frames)},B=${JSON.stringify(beats)},alt=${JSON.stringify(r.alt ?? '')},fps=${Number(r.fps) || 3};let f=0,t=null;
const $=i=>document.getElementById(i),show=()=>{const b=B.find(x=>f>=x.from&&f<=x.to)||B[0];$('p').src=F[f];$('p').alt=b.text+'. '+alt;$('c').textContent=b.text};
const beat=d=>{const k=B.findIndex(x=>f>=x.from&&f<=x.to);f=B[Math.max(0,Math.min(B.length-1,k+d))].from;show()};
const stop=()=>{clearInterval(t);t=null;if($('m')){$('m').textContent='Play';$('m').setAttribute('aria-pressed','false')}};
if($('b')){$('b').onclick=()=>{stop();beat(-1)};$('n').onclick=()=>{stop();beat(1)}}
const still=matchMedia('(prefers-reduced-motion: reduce)');if($('m')){if(still.matches)$('m').hidden=true;$('m').onclick=()=>{if(t){stop();return}$('m').textContent='Pause';$('m').setAttribute('aria-pressed','true');t=setInterval(()=>{f=(f+1)%F.length;show()},1000/fps)}}
if($('s')){$('s').onclick=()=>{const a=$('a');if(!a.paused){a.pause();$('s').textContent='Play sound';$('s').setAttribute('aria-pressed','false');return}a.play();$('s').textContent='Stop sound';$('s').setAttribute('aria-pressed','true');a.onended=()=>{$('s').textContent='Play sound';$('s').setAttribute('aria-pressed','false')}}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){stop();const a=$('a');if(a)a.pause()}});
<\/script></body></html>`;
  const url = blobUrl(html, 'text/html'); download(`story-${stamp()}.html`, url); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
