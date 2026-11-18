// shader-keep.mjs: what the Retro Studio kept and made of a session, in the shader room. The whole setup is a patch
// (the source, the shader, the knobs, the layers, the rack, the source settings): saved in this browser, loaded from
// the list, copied as a link (the room's address already carries it). The last twenty changes can be undone, the
// session is picked up where it was left unless a link says otherwise, and Start fresh clears it. Six seconds of the
// moving frame record as WebM; twelve frames around a loop print as a phenakistoscope disc or a zoetrope strip.
export const KEEP_URLS = Object.freeze({ zoetrope: '/system/zoetrope-compose.js?v=20260812-cohesion' });
const PATCH_KEY = 'shd.patches.v1', SESSION_KEY = 'shd.session.v1', MAX = 20;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.error('shader room: this browser would not keep it', e); return false; } };

export function keepHtml() {
  return `<details class="shd-rack" data-rack="keep"><summary>Keep, undo and make</summary><div class="shd-rack-body">
<p class="shd-row"><button type="button" id="shd-undo" disabled>Undo the last change</button> <button type="button" id="shd-fresh">Start fresh</button></p>
<p class="shd-row"><button type="button" id="shd-patch-save">Save this setup</button> <button type="button" id="shd-patch-link">Copy a link to this setup</button></p>
<label for="shd-patches">Your saved setups</label><select id="shd-patches"><option value="">None saved yet</option></select>
<p class="shd-row"><button type="button" id="shd-clip">Record six seconds (.webm)</button> <button type="button" id="shd-spin">A spinning disc to print</button> <button type="button" id="shd-strip">A zoetrope strip to print</button></p>
<p class="shd-keep-say" role="status" aria-live="polite"></p>
</div></details>`;
}

// room: { patch(), apply(patch), draw(t) (draws and returns the shown canvas), shown(), save(name, blob, words), setRunning(on), running(), fresh() }
export function wireKeep(host, room) {
  const $ = (s) => host.querySelector(s), say = (t) => { $('.shd-keep-say').textContent = t; };
  let patches = read(PATCH_KEY, []), history = [], at = -1, restoring = false, timer = 0, clip = null;
  function list() {
    $('#shd-patches').innerHTML = `<option value="">${patches.length ? `Your setups (${patches.length})` : 'None saved yet'}</option>${patches.map((p, i) => `<option value="${i}">${String(p.name).replace(/[&<>"]/g, '')}</option>`).join('')}`;
  }
  // one entry per settled change: a slider's many events make one entry, and an unchanged setup makes none
  function snapshot() {
    if (restoring) return; const json = JSON.stringify(room.patch());
    if (history.length && history[at]?.json === json) return;
    if (at < history.length - 1) history.length = at + 1;
    history.push({ json }); while (history.length > MAX) history.shift(); at = history.length - 1;
    write(SESSION_KEY, JSON.parse(json)); $('#shd-undo').disabled = at <= 0;
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(snapshot, 300); };
  function apply(json, words) { restoring = true; try { room.apply(JSON.parse(json)); say(words); } catch (e) { console.error('shader room: a setup did not load', e); say('That setup could not be read.'); } finally { restoring = false; } }
  function undo() {
    if (at <= 0) { say('Nothing further to undo.'); return; }
    at -= 1; apply(history[at].json, 'One change back.'); write(SESSION_KEY, JSON.parse(history[at].json)); $('#shd-undo').disabled = at <= 0;
  }
  // twelve frames around a loop of 2.4 s, drawn through the whole room as it stands
  function frames(n = 12, loop = 2.4) {
    const out = []; for (let k = 0; k < n; k++) { const f = room.draw((k / n) * loop), c = document.createElement('canvas'); c.width = f.width; c.height = f.height; c.getContext('2d').drawImage(f, 0, 0); out.push(c); }
    room.draw(); return out;
  }
  async function print(kind) {
    say('Catching twelve frames.');
    try {
      const m = await import(KEEP_URLS.zoetrope), c = document.createElement('canvas');
      if (kind === 'disc') m.composeDisc(c, frames(), { diameterPx: 2400, label: 'Zain Dana Harper, the shader room' }); else m.composeStrip(c, frames(), { widthPx: 3300 });
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      room.save(kind === 'disc' ? 'shader-spin-disc.png' : 'shader-zoetrope-strip.png', blob, kind === 'disc' ? 'Saved the disc: print it, cut it, pin it and spin it at a mirror.' : 'Saved the strip: roll it into a drum, tape the tab, spin it.');
    } catch (e) { console.error('shader room: the print did not compose', e); say(`The ${kind} did not compose: ${e.message}`); }
  }
  function record() {
    if (clip) return;
    const f = room.shown();
    if (!('MediaRecorder' in window) || !f.captureStream) { say('This browser cannot record the frame.'); return; }
    let rec; try { const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'; rec = new MediaRecorder(f.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8e6 }); }
    catch (e) { console.error('shader room: the recorder did not start', e); say('This browser cannot record the frame.'); return; }
    const chunks = [], was = room.running(); clip = rec; room.setRunning(true); $('#shd-clip').setAttribute('aria-pressed', 'true');
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = () => { if (clip !== rec) return; clip = null; clearInterval(tick); $('#shd-clip').setAttribute('aria-pressed', 'false'); room.setRunning(was);
      if (chunks.length) room.save('shader-clip.webm', new Blob(chunks, { type: 'video/webm' }), 'Saved six seconds as WebM.'); else say('The clip came back empty.'); };
    rec.onstop = done; rec.onerror = done;
    let left = 6; say('Recording: 6 s.'); const tick = setInterval(() => { left--; if (left <= 0) { try { rec.stop(); } catch { done(); } } else say(`Recording: ${left} s.`); }, 1000);
    try { rec.start(250); } catch (e) { console.error('shader room: the recorder did not start', e); done(); }
  }
  function onClick(ev) {
    const b = ev.target.closest('button'); if (!b) return false;
    if (b.id === 'shd-undo') undo();
    else if (b.id === 'shd-fresh') { try { localStorage.removeItem(SESSION_KEY); } catch (e) { console.error('shader room: the session was not cleared', e); } history = []; at = -1; room.fresh(); }
    else if (b.id === 'shd-patch-save') { const p = room.patch(), name = `Setup ${patches.length + 1}, ${p.post.amount > 0 ? p.post.pal : 'no rack'}`; patches.push({ name, patch: p }); if (write(PATCH_KEY, patches)) { list(); $('#shd-patches').value = String(patches.length - 1); say(`Saved ${name}.`); } else { patches.pop(); say('This browser is full; the setup was not saved.'); } }
    else if (b.id === 'shd-patch-link') navigator.clipboard?.writeText(location.href).then(() => say('A link to this setup is copied.'), () => say(`A link to this setup: ${location.href}`)) ?? say(`A link to this setup: ${location.href}`);
    else if (b.id === 'shd-clip') record();
    else if (b.id === 'shd-spin') print('disc'); else if (b.id === 'shd-strip') print('strip');
    else { later(); return false; }
    return true;
  }
  function onInput(ev) {
    if (ev.target.id === 'shd-patches') { const p = patches[+ev.target.value]; if (p && ev.target.value !== '') { apply(JSON.stringify(p.patch), `Loaded ${p.name}.`); snapshot(); } return true; }
    later(); return false;
  }
  list();
  return { onClick, onInput, snapshot, later, session: () => read(SESSION_KEY, null), destroy() { clearTimeout(timer); try { clip?.stop(); } catch (e) { console.error('shader room: the recorder did not stop', e); } } };
}
