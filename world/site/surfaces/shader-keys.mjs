// shader-keys.mjs: the Retro Studio's keys and its full screen, in the shader room. While the room has focus and
// nothing is being typed: F full screen, R rolls the picture rack, S saves the frame, space pauses and runs, [ and ]
// move the effects' amount; Control and Z steps back a stroke while drawing. Full screen shows the stage alone, with a
// line of these keys and a button to leave; Escape leaves too.
export function studioKey(ev, room) {
  const t = ev.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
  if (typing) return false;
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'z' || ev.key === 'Z') && room.drawing()) { ev.preventDefault(); room.undoStroke(); return true; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey || t.tagName === 'BUTTON') return false;
  const k = ev.key.toLowerCase(), act = { f: room.full, r: room.roll, s: room.save, ' ': room.pause, '[': () => room.amount(-6), ']': () => room.amount(6) }[k];
  if (!act) return false;
  ev.preventDefault(); act(); return true;
}
export function fullScreen(stage, button, said) {
  async function toggle() {
    try { if (document.fullscreenElement === stage) await document.exitFullscreen(); else await stage.requestFullscreen(); }
    catch (e) { console.error('shader room: full screen was refused', e); said('The browser refused full screen.'); }
  }
  const onChange = () => { const on = document.fullscreenElement === stage; button.setAttribute('aria-pressed', String(on)); button.textContent = on ? 'Leave full screen' : 'Full screen'; stage.closest('.shd').dataset.full = String(on); };
  stage.addEventListener('dblclick', toggle); document.addEventListener('fullscreenchange', onChange);
  return { toggle, destroy() { stage.removeEventListener('dblclick', toggle); document.removeEventListener('fullscreenchange', onChange); } };
}
