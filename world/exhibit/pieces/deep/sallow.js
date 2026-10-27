// "Sallow says": the room's tactic, run on the reader by a shapeshifter in the room's own colour, then held through three costumes.
// Text comes from rooms/sallow.json. The tool output beside it is the real output of `articulate check`, stored in rooms/sallow-out.json by tools/sallow_run.py.
import { el, esc } from './core.js';

export async function mountSallow(D, cfg) {
  const box = el('section', 'sallow'); box.setAttribute('aria-labelledby', 'sl-h-' + cfg.room);
  try {
    const [S, O] = await Promise.all([fetch(new URL('../../rooms/sallow.json', import.meta.url)).then(r => r.json()), fetch(new URL('../../rooms/sallow-out.json', import.meta.url)).then(r => r.json()).catch(() => ({}))]);
    const d = S[cfg.room]; if (!d) return null; const out = O[cfg.room];
    box.style.setProperty('--sc', d.colour);
    box.innerHTML = `<svg class="sl-fig" viewBox="0 0 80 100" aria-hidden="true"><circle cx="40" cy="26" r="17" fill="currentColor"/><path d="M6 100c0-30 14-46 34-46s34 16 34 46z" fill="currentColor"/></svg>
      <h3 id="sl-h-${esc(cfg.room)}">Sallow says</h3>
      <p class="sl-meta">Randall Sallow is a composite, invented whole: the shadow everyone casts and nobody in particular. He is drawn with no face, only as a shadow, and he is not a real person. This room's tactic is <b>${esc(d.tactic)}</b>. He is in the room's colour. Hold him and see.</p>
      <blockquote class="sl-line"><span class="sl-as">${esc(d.costumes[0].as)} <i>as ${esc(d.costumes[0].alias)}</i></span>${esc(d.costumes[0].text)}</blockquote>
      <button type="button" class="sl-hold" aria-expanded="false">Hold him</button>
      <div class="sl-held" hidden>
        <p class="sl-as2">He changes shape when held. The grip does not change.</p>
        <blockquote class="sl-line"><span class="sl-as">${esc(d.costumes[1].as)} <i>as ${esc(d.costumes[1].alias)}</i></span>${esc(d.costumes[1].text)}</blockquote>
        <blockquote class="sl-line"><span class="sl-as">${esc(d.costumes[2].as)} <i>as ${esc(d.costumes[2].alias)}</i></span>${esc(d.costumes[2].text)}</blockquote>
        <p class="sl-under"><b>Underneath all three:</b> ${d.under}</p>
        <details class="sl-init"><summary>A small puzzle: what repeats in his names?</summary><p>Look at the three aliases above. <button type="button" class="dp-hint" data-act="init">Show me</button></p><p class="sl-initans" aria-live="polite"></p></details>
        <div class="sl-grey" role="group" aria-label="Same grey. Drag the slider to join the two squares."><div class="sl-strip"><i class="sl-a">A</i><i class="sl-b">B</i><i class="sl-bridge"></i></div><label>Join A and B <input type="range" min="0" max="100" value="0" aria-describedby="sl-g-${esc(cfg.room)}"></label><p id="sl-g-${esc(cfg.room)}" aria-live="polite">Two squares on a dark-to-light ground look unlike. They are the same grey.</p></div>
        <p class="sl-grip"><b>The grip:</b> ${d.grip}</p>
        ${out ? `<p class="sl-cmd">${esc(out.cmd)} (articulate ${esc(out.version)})</p><pre class="sl-out">${esc(out.output)}</pre><p class="sl-note">${d.outnote || 'A style checker reads prose devices. It does not read tactics. The real output is above, unedited.'}</p>` : '<p class="sl-note">The tool run for this room is not recorded yet.</p>'}
      </div>`;
    const b = box.querySelector('.sl-hold'), held = box.querySelector('.sl-held');
    b.onclick = () => { const o = held.hidden; held.hidden = !o; b.setAttribute('aria-expanded', String(o)); b.textContent = o ? 'Let him go' : 'Hold him'; if (o) D.say('He changed shape twice. The move underneath is the same.'); };
    box.querySelector('[data-act=init]').onclick = () => { box.querySelector('.sl-initans').textContent = 'The initials: R.S. every time. He goes by Rook Sallow, Russell Shade, Reed Saltis, Ruth Sorel. It is a character device from the persona notes: he has one surname at a time and keeps his initials, as a stage villain keeps a monogram. Nothing more is hidden in it.'; };
    const r = box.querySelector('input'), br = box.querySelector('.sl-bridge'), msg = box.querySelector('[aria-live]');
    r.oninput = () => { br.style.width = r.value + '%'; msg.textContent = r.value >= 99 ? 'Joined. Same grey. His colour was always the ground you put him on.' : 'Two squares on a dark-to-light ground look unlike. They are the same grey.'; };
    return box;
  } catch (e) { console.error('sallow card failed', e); return null; }
}
