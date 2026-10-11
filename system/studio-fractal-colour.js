// studio-fractal-colour.js: the 2D Fractal source's Colouring group.
//
// The colouring algorithm and its parameters live on the view as view.colouring, and a gradient
// of the visitor's own as view.gradient (2 to 16 sRGB stops). Both travel with the view, so Undo,
// the kept view and project files carry them. Picking one of the named palettes clears the
// gradient. Colour cycling moves the palette offset on its own animation frames and stops when the
// source is left or the box is unticked; it never starts by itself.

import { parseGradient, sampleImage, rgbToHex, MIN_STOPS, MAX_STOPS } from "./fractal-gradient.js";
import { PALETTES } from "./fractal.js";

const $ = (id) => document.getElementById(id);

const TRAP_MODES = new Set(["trap-point", "trap-line", "trap-cross", "trap-image"]);

export function mountFractalColour({ getView, setView, repaint, paintFast, say, isActive }) {
  let cycleRaf = 0, lastTs = 0, trapImage = null;
  const status = (t) => { const s = $("fractal-gradient-status"); if (s) s.textContent = t || ""; };
  const num = (id, d) => { const v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : d; };

  function colouringFrom(v) { return { mode: "smooth", density: 1, offset: 0, trapX: 0, trapY: 0, trapAngle: 30, trapSize: 0.25, ...(v.colouring || {}) }; }

  function update(patch, gradient) {
    const v = getView();
    if (!v) return;
    const next = { ...v, colouring: { ...colouringFrom(v), ...patch } };
    if (gradient !== undefined) next.gradient = gradient || undefined;
    if (next.colouring.mode === "trap-image" && trapImage) next.colouring.image = trapImage;
    else delete next.colouring.image;
    setView(next);
    repaint();
    sync(next);
  }

  document.querySelectorAll("[data-fcolour]").forEach((b) => b.addEventListener("click", () => update({ mode: b.dataset.fcolour })));
  const slider = (id, out, key, fmt) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const o = $(out); if (o) o.textContent = fmt(el.value);
      update({ [key]: parseFloat(el.value) });
    });
  };
  slider("fractal-density", "fractal-density-val", "density", (v) => (+v).toFixed(2));
  slider("fractal-offset", "fractal-offset-val", "offset", (v) => (+v).toFixed(2));
  slider("fractal-trap-angle", "fractal-trap-angle-val", "trapAngle", (v) => String(Math.round(v)));
  slider("fractal-trap-size", "fractal-trap-size-val", "trapSize", (v) => (+v).toFixed(2));
  for (const [id, key] of [["fractal-trap-x", "trapX"], ["fractal-trap-y", "trapY"]]) {
    const el = $(id); if (el) el.addEventListener("change", () => update({ [key]: num(id, 0) }));
  }
  const speedEl = $("fractal-cycle-speed");
  if (speedEl) speedEl.addEventListener("input", () => { const o = $("fractal-cycle-speed-val"); if (o) o.textContent = (+speedEl.value).toFixed(1); });

  // The image trap's picture.
  const imgInput = $("fractal-trap-image");
  if (imgInput) imgInput.addEventListener("change", () => {
    const f = imgInput.files && imgInput.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { trapImage = img; update({ mode: "trap-image" }); say(`The image trap now uses ${f.name}.`); };
    img.onerror = () => say("That file did not open as an image.");
    img.src = URL.createObjectURL(f);
  });

  // Colour cycling: the offset advances by speed stops a second.
  function cycleFrame(ts) {
    cycleRaf = 0;
    const box = $("fractal-cycle");
    const v = getView();
    if (!box || !box.checked || !v || !isActive()) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    const c = colouringFrom(v);
    const n = (v.gradient && v.gradient.length) || 6;
    const offset = (c.offset + dt * num("fractal-cycle-speed", 1)) % n;
    setView({ ...v, colouring: { ...c, offset } });
    paintFast();
    const o = $("fractal-offset"); if (o) o.value = String(offset);
    const ov = $("fractal-offset-val"); if (ov) ov.textContent = offset.toFixed(2);
    cycleRaf = requestAnimationFrame(cycleFrame);
  }
  const cycleBox = $("fractal-cycle");
  if (cycleBox) cycleBox.addEventListener("change", () => {
    if (cycleBox.checked && !cycleRaf) { lastTs = 0; cycleRaf = requestAnimationFrame(cycleFrame); }
    if (!cycleBox.checked) { if (cycleRaf) cancelAnimationFrame(cycleRaf); cycleRaf = 0; repaint(); }
  });

  // The gradient editor: one colour input per stop.
  function stopsOf(v) { return v.gradient ? v.gradient.map((s) => s.slice()) : (PALETTES[v.palette] || PALETTES.ocean).map((s) => s.slice()); }
  function renderStops(v) {
    const host = $("fractal-stops");
    if (!host) return;
    const stops = stopsOf(v);
    host.innerHTML = "";
    stops.forEach((s, i) => {
      const inp = document.createElement("input");
      inp.type = "color";
      inp.value = rgbToHex(s);
      inp.setAttribute("aria-label", `Gradient stop ${i + 1}`);
      inp.dataset.stop = String(i);
      inp.style.width = "2.2rem"; inp.style.height = "2.2rem"; inp.style.padding = "0";
      inp.addEventListener("input", () => {
        const cur = stopsOf(getView());
        const h = inp.value;
        cur[i] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        update({}, cur);
      });
      host.appendChild(inp);
    });
  }
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  on("fractal-stop-add", () => {
    const cur = stopsOf(getView());
    if (cur.length >= MAX_STOPS) { status(`The gradient holds at most ${MAX_STOPS} stops.`); return; }
    const a = cur[cur.length - 1], b = cur[0];
    cur.push(a.map((x, k) => Math.round((x + b[k]) / 2)));
    update({}, cur);
  });
  on("fractal-stop-remove", () => {
    const cur = stopsOf(getView());
    if (cur.length <= MIN_STOPS) { status(`The gradient needs at least ${MIN_STOPS} stops.`); return; }
    cur.pop();
    update({}, cur);
  });
  on("fractal-gradient-copy", async () => {
    const text = stopsOf(getView()).map(rgbToHex).join(" ");
    const box = $("fractal-gradient-text");
    if (box) box.value = text;
    try { await navigator.clipboard.writeText(text); status("Gradient copied."); } catch (_) { status("Gradient in the box; copy it from there."); }
  });
  function importText(text, label) {
    try {
      const { stops, format } = parseGradient(text);
      update({}, stops);
      status(`Imported ${stops.length} stops from ${label || format}.`);
    } catch (e) { status(`Not imported: ${e.message}.`); }
  }
  on("fractal-gradient-import", () => importText(($("fractal-gradient-text") || {}).value));
  const file = $("fractal-gradient-file");
  if (file) file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (/^image\//.test(f.type)) {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.min(1024, img.naturalWidth)); c.height = 1;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, img.naturalHeight / 2, img.naturalWidth, 1, 0, 0, c.width, 1);
        update({}, sampleImage(g.getImageData(0, 0, c.width, 1).data));
        status(`Imported 16 stops from the middle row of ${f.name}.`);
      };
      img.onerror = () => status("That image did not open.");
      img.src = URL.createObjectURL(f);
      return;
    }
    f.text().then((t) => importText(t, f.name)).catch(() => status("That file could not be read."));
  });
  // A named palette replaces the gradient: clear it before the palette chip's own handler draws.
  const pals = $("fractal-palettes");
  if (pals) pals.addEventListener("click", (e) => {
    if (!e.target.closest("[data-fractal-palette]")) return;
    const v = getView();
    if (v && v.gradient) setView({ ...v, gradient: undefined });
    setTimeout(() => { const nv = getView(); if (nv) renderStops(nv); }, 0);
  }, true);

  function sync(view) {
    if (!view) return;
    const c = colouringFrom(view);
    document.querySelectorAll("[data-fcolour]").forEach((b) => b.classList.toggle("active", b.dataset.fcolour === c.mode));
    const set = (id, v, out, fmt) => { const el = $(id); if (el && document.activeElement !== el) el.value = String(v); const o = out && $(out); if (o) o.textContent = fmt(v); };
    set("fractal-density", c.density, "fractal-density-val", (v) => (+v).toFixed(2));
    set("fractal-offset", c.offset, "fractal-offset-val", (v) => (+v).toFixed(2));
    set("fractal-trap-angle", c.trapAngle, "fractal-trap-angle-val", (v) => String(Math.round(v)));
    set("fractal-trap-size", c.trapSize, "fractal-trap-size-val", (v) => (+v).toFixed(2));
    set("fractal-trap-x", c.trapX); set("fractal-trap-y", c.trapY);
    const row = $("fractal-trap-row"); if (row) row.hidden = !TRAP_MODES.has(c.mode);
    renderStops(view);
  }

  function stop() { if (cycleRaf) cancelAnimationFrame(cycleRaf); cycleRaf = 0; const b = $("fractal-cycle"); if (b) b.checked = false; }

  return { sync, stop };
}
