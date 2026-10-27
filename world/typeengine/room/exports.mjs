// room/exports.mjs: what leaves the room. PNG is the stage. SVG holds the vector outline of the word with the real
// text in it, plus the drawn material as an image layer. WebM records the stage on its clock for four seconds, with
// the word's sound when the family sounds. Font: the built files when build/emit.py made them (variable plus the
// material cut), otherwise a TrueType written here by the site's own writer. Recipe: the session, which reopens here.
import { instance, faceOf } from '../lib/program.mjs';
import { glyphContext, outlinesPx } from '../lib/setline.mjs';
import { renderWord } from '../lib/render.mjs';
import { faceToTTF } from '../lib/browserfont.mjs';
import { session, toLegacyState } from '../lib/legacy.mjs';

const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const slug = (s) => (s || 'word').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word';
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function svgOf(S, stage) {
  const inst = instance(S.family, S.loc), g = glyphContext(faceOf(inst), S.text, stage.width, stage.height, { fill: 0.82 });
  const d = outlinesPx(g.lay).map((p) => 'M' + p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z').join('');
  const ink = inst.bindings.fill.params?.color ?? '#15130f';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.width} ${stage.height}" role="img"><title>${esc(S.text)}</title>`
    + `<image href="${stage.toDataURL('image/png')}" width="${stage.width}" height="${stage.height}"/>`
    + `<path d="${d}" fill="${ink}" fill-opacity="0" stroke="none" fill-rule="nonzero"><desc>outline of the word, nonzero</desc></path>`
    + `<text x="50%" y="${g.baseline}" text-anchor="middle" font-size="${g.size.toFixed(1)}" fill-opacity="0">${esc(S.text)}</text></svg>`;
}

function pcmOf(S, stage) { return renderWord(S.family, S.text, Math.min(600, stage.width), Math.min(200, stage.height), { loc: S.loc }).pcm; }

async function record(S, stage, draw) {
  const fps = 30, secs = 4, stream = stage.captureStream(fps), pcm = instance(S.family, S.loc).bindings.sound ? pcmOf(S, stage) : null;
  let ac = null;
  if (pcm) {
    ac = new AudioContext(); const buf = ac.createBuffer(1, pcm.channels[0].length, pcm.rate); buf.copyToChannel(pcm.channels[0], 0);
    const src = ac.createBufferSource(), dst = ac.createMediaStreamDestination(); src.buffer = buf; src.connect(dst); src.start();
    for (const t of dst.stream.getAudioTracks()) stream.addTrack(t);
  }
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 }), parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(); const t0 = performance.now();
  await new Promise((res) => { const step = () => { const t = (performance.now() - t0) / 1000; draw(t); if (t < secs) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  rec.stop(); await done; ac?.close();
  return new Blob(parts, { type: 'video/webm' });
}

async function font(S) {
  const id = S.family.id.replace(/-mix$/, ''), rep = await fetch(`../dist/${id}/report.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (rep && S.family.id === id) {
    for (const k of ['variable', 'cut']) { const n = rep.files[k]?.name; if (!n) continue; const b = await fetch(`../dist/${id}/${encodeURIComponent(n)}.woff2`).then((r) => r.blob()); save(b, `${n}.woff2`); }
    return;
  }
  const inst = instance(S.family, S.loc), fc = faceOf(inst), name = (S.family.name || 'Type room').replace(/[^A-Za-z0-9 ]/g, '');
  if (fc.refused) throw new Error(fc.refusals.join(' '));
  save(new Blob([faceToTTF(fc, name)], { type: 'font/ttf' }), `${slug(name)}.ttf`);
}

export function wireExports({ S, stage, draw }) {
  const act = {
    png: () => new Promise((res) => stage.toBlob((b) => { save(b, `${slug(S.text)}.png`); res(); }, 'image/png')),
    svg: () => save(new Blob([svgOf(S, stage)], { type: 'image/svg+xml' }), `${slug(S.text)}.svg`),
    webm: async () => save(await record(S, stage, draw), `${slug(S.text)}.webm`),
    font: () => font(S),
    recipe: () => {
      const legacy = toLegacyState(S.family, S.text, S.loc);
      save(new Blob([JSON.stringify(legacy ? { ...session(S.family, S.text, S.loc), studio: { schema: 'studio.session/1', source: 'type', state: legacy } } : session(S.family, S.text, S.loc), null, 1)], { type: 'application/json' }), `${slug(S.family.name)}.json`);
    },
  };
  for (const b of document.querySelectorAll('[data-export]')) b.addEventListener('click', async () => {
    b.setAttribute('aria-busy', 'true');
    try { await act[b.dataset.export](); } catch (e) { console.error(`[room] export ${b.dataset.export} failed:`, e); document.getElementById('status').textContent = e.message; }
    b.removeAttribute('aria-busy');
  });
  const listen = document.getElementById('listen'); let ac = null;
  listen.addEventListener('click', async () => {
    if (ac) { ac.close(); ac = null; listen.setAttribute('aria-pressed', 'false'); document.documentElement.classList.remove('sound-on'); return; }
    const pcm = pcmOf(S, stage); if (!pcm) return;
    ac = new AudioContext(); const buf = ac.createBuffer(1, pcm.channels[0].length, pcm.rate); buf.copyToChannel(pcm.channels[0], 0);
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start();
    listen.setAttribute('aria-pressed', 'true'); document.documentElement.classList.add('sound-on');
    src.onended = () => { ac?.close(); ac = null; listen.setAttribute('aria-pressed', 'false'); document.documentElement.classList.remove('sound-on'); };
  });
}
