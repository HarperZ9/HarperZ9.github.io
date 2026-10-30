// deepzoom.js: a small deep-zoom viewer for the showcase renders. It reads a manifest (tools/showcase/tiles.py),
// shows the level that fits the frame, and fetches only the tiles in view: AVIF where the browser decodes it, JPEG
// otherwise. Drag or arrow keys to pan, wheel, pinch, + and - to zoom, 0 to fit. No dependencies.
const avif = new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.width > 0); i.onerror = () => ok(false);
  i.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAMG1kYXQSAAoIGAAGiAhoNCAyGhlHh4Yhh5555oAAAJBAyRxhSytNj1FFTqSg"; });

export async function mount(el, url) {
  const man = await (await fetch(url)).json(), base = url.replace(/[^/]*$/, "") + man.name + "_files/";
  const ext = (await avif) ? "avif" : "jpg";
  el.classList.add("dz"); el.tabIndex = 0;
  const layer = document.createElement("div"); layer.className = "dz-layer"; el.append(layer);
  let scale = 0, cx = man.width / 2, cy = man.height / 2;   // scale: screen px per image px; centre in image px
  const fit = () => { const r = el.getBoundingClientRect(); return Math.min(r.width / man.width, r.height / man.height); };
  const shown = new Map();
  function draw() {
    const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    scale = Math.max(fit(), Math.min(scale || fit(), 2));
    const want = Math.min(man.maxLevel, Math.max(0, man.maxLevel - Math.floor(Math.log2(1 / (scale * dpr)))));
    const lv = man.levels.find((x) => x.level === want), f = 2 ** (man.maxLevel - want), T = man.tileSize;
    const x0 = cx - r.width / 2 / scale, y0 = cy - r.height / 2 / scale, x1 = cx + r.width / 2 / scale, y1 = cy + r.height / 2 / scale;
    const keep = new Set();
    for (let row = Math.max(0, Math.floor(y0 / f / T)); row <= Math.min(lv.rows - 1, Math.floor(y1 / f / T)); row++)
      for (let col = Math.max(0, Math.floor(x0 / f / T)); col <= Math.min(lv.cols - 1, Math.floor(x1 / f / T)); col++) {
        const k = `${want}/${col}_${row}`; keep.add(k);
        let img = shown.get(k);
        if (!img) { img = new Image(); img.decoding = "async"; img.alt = ""; img.draggable = false; img.src = `${base}${k}.${ext}`; layer.append(img); shown.set(k, img); img.dataset.l = want; }
        const w = Math.min(T, lv.w - col * T), h = Math.min(T, lv.h - row * T);
        Object.assign(img.style, { left: `${(col * T * f - x0) * scale}px`, top: `${(row * T * f - y0) * scale}px`, width: `${w * f * scale + 0.5}px`, height: `${h * f * scale + 0.5}px` });
      }
    // tiles of other levels stay until the new level's tiles have loaded, then go
    for (const [k, img] of shown) if (!keep.has(k)) { if (+img.dataset.l === want || [...keep].every((q) => shown.get(q)?.complete)) { img.remove(); shown.delete(k); } else img.style.zIndex = "0"; }
    el.dataset.level = want;
  }
  const zoom = (k, sx, sy) => { const r = el.getBoundingClientRect(), px = sx ?? r.width / 2, py = sy ?? r.height / 2;
    const ix = cx + (px - r.width / 2) / scale, iy = cy + (py - r.height / 2) / scale;
    scale = Math.max(fit(), Math.min(2, scale * k)); cx = ix - (px - r.width / 2) / scale; cy = iy - (py - r.height / 2) / scale; clamp(); draw(); };
  const clamp = () => { cx = Math.max(0, Math.min(man.width, cx)); cy = Math.max(0, Math.min(man.height, cy)); };
  el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const pts = new Map(); let pinch = 0;
  el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
  el.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(d / pinch); pinch = d; return; }
    cx -= (e.clientX - px) / scale; cy -= (e.clientY - py) / scale; clamp(); draw();
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  el.addEventListener("keydown", (e) => {
    const s = 80 / scale, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    if (m) { cx += m[0]; cy += m[1]; clamp(); draw(); } else if (e.key === "+" || e.key === "=") zoom(1.5); else if (e.key === "-") zoom(1 / 1.5);
    else if (e.key === "0") { scale = fit(); cx = man.width / 2; cy = man.height / 2; draw(); } else return;
    e.preventDefault();
  });
  new ResizeObserver(() => draw()).observe(el);
  draw();
  return { manifest: man, zoom, el };
}
