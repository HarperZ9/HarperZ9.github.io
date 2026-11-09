// media/pointer.js: attention for dot fields. Mouse and touch move a point of force over an element; the keyboard has an equivalent.
// Shift+arrow keys move the point, and "." presses it. With opts.plain the bare arrow keys work too (pages where arrows do nothing else).
export function pointer(el, opts = {}) {
  const p = { x: .5, y: .5, f: 0, tf: 0, down: false, key: false, press: false };
  const set = e => { const r = el.getBoundingClientRect(); p.x = (e.clientX - r.left) / r.width; p.y = (e.clientY - r.top) / r.height; };
  el.addEventListener('pointermove', e => { set(e); p.tf = 1; p.key = false; });
  el.addEventListener('pointerdown', e => { set(e); p.down = true; p.tf = 1; });
  addEventListener('pointerup', () => { p.down = false; if (!p.key) p.tf = el.matches(':hover') ? 1 : 0; });
  el.addEventListener('pointerleave', () => { if (!p.key && !p.down) p.tf = 0; });
  (opts.keys || el).addEventListener('keydown', e => {
    const a = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (a && (e.shiftKey || opts.plain)) { const st = e.altKey ? .12 : .04; p.x = Math.max(0, Math.min(1, p.x + a[0] * st)); p.y = Math.max(0, Math.min(1, p.y + a[1] * st)); p.key = true; p.tf = 1; e.preventDefault(); }
    else if (e.key === '.') { p.press = !p.press; p.key = true; p.tf = 1; e.preventDefault(); }
  });
  (opts.keys || el).addEventListener('blur', () => { p.key = false; p.press = false; if (!p.down) p.tf = 0; });
  p.update = dt => { const t = p.tf * (p.down || p.press ? 1.7 : 1); p.f += (t - p.f) * Math.min(1, dt * 7); if (p.f < .003 && !t) p.f = 0; return p; };
  p.arr = () => [p.x, p.y, p.f];
  return p;
}
