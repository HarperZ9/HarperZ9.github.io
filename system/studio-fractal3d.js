// studio-fractal3d.js: the 3D Fractal source's controls for the progressive renderer.
//
// read() gathers every 3D control into the options fractal3d-pro.js takes; changes apply live
// through the running handle's setParams() (no re-render, the image just starts converging again);
// apply(state) puts a kept or undone state back into the controls. The legacy WebGL1 renderer
// (fractal3d.js) reads the same options and ignores what it does not know.

const $ = (id) => document.getElementById(id);

// Slider id -> [option key, label id, format]
const SLIDERS = {
  "f3-fold": ["fold", "f3-fold-val", (v) => (+v).toFixed(2)],
  "f3-minr": ["minR", "f3-minr-val", (v) => (+v).toFixed(2)],
  "f3-fixedr": ["fixedR", "f3-fixedr-val", (v) => (+v).toFixed(2)],
  "f3-ksize": ["kSize1", "f3-ksize-val", (v) => (+v).toFixed(3)],
  "f3-kinv": ["kInv", "f3-kinv-val", (v) => (+v).toFixed(2)],
  "f3-mscale": ["mScale", "f3-mscale-val", (v) => (+v).toFixed(2)],
  "f3-trap": ["trapScale", "f3-trap-val", (v) => (+v).toFixed(2)],
  "f3-rough": ["roughness", "f3-rough-val", (v) => (+v).toFixed(2)],
  "f3-metal": ["metalness", "f3-metal-val", (v) => (+v).toFixed(2)],
  "f3-sunaz": ["sunAz", "f3-sunaz-val", (v) => String(Math.round(v))],
  "f3-sunel": ["sunEl", "f3-sunel-val", (v) => String(Math.round(v))],
  "f3-shadow": ["shadowK", "f3-shadow-val", (v) => String(Math.round(v))],
  "f3-ao": ["ao", "f3-ao-val", (v) => (+v).toFixed(2)],
  "f3-fog": ["fog", "f3-fog-val", (v) => (+v).toFixed(3)],
  "f3-glow": ["glow", "f3-glow-val", (v) => (+v).toFixed(2)],
  "f3-aperture": ["aperture", "f3-aperture-val", (v) => (+v).toFixed(2)],
  "f3-exposure": ["exposure", "f3-exposure-val", (v) => (+v).toFixed(2)],
  "f3-samples": ["maxSamples", "f3-samples-val", (v) => String(Math.round(v))],
};

const ROWS = {
  "f3-fold-row": ["mandelbox", "surf", "hybrid"],
  "f3-kleinian-row": ["kleinian"],
  "f3-menger-row": ["menger"],
  "f3-hybrid-row": ["hybrid"],
  "f3-scale-row": ["mandelbox", "surf", "hybrid"],
  "f3-power-row": ["mandelbulb", "hybrid"],
};

export function mountFractal3D({ getType, getHandle, onChange }) {
  let palette = "bone", bg = 0;

  function read() {
    const o = {};
    for (const [id, [key]] of Object.entries(SLIDERS)) {
      const el = $(id); if (!el) continue;
      const v = parseFloat(el.value);
      if (key === "kSize1") o.kSize = [v, v * 0.982, v]; else o[key] = v;
    }
    o.seq = [0, 1, 2, 3].map((i) => ($(`f3-seq-${i}`) || {}).value).filter(Boolean);
    if (!o.seq.length) o.seq = ["box"];
    o.palette = palette; o.bg = bg;
    o.turntable = !!($("f3-turntable") || {}).checked;
    return o;
  }

  function rows() {
    const t = getType();
    for (const [id, types] of Object.entries(ROWS)) { const el = $(id); if (el) el.hidden = !types.includes(t); }
  }

  function live() {
    const h = getHandle();
    if (h && h.setParams) h.setParams({ type: getType(), ...read(), ...onChange.extra() });
  }

  for (const [id, [, out, fmt]] of Object.entries(SLIDERS)) {
    const el = $(id); if (!el) continue;
    const label = () => { const o = $(out); if (o) o.textContent = fmt(el.value); };
    label();
    el.addEventListener("input", () => { label(); live(); });
    el.addEventListener("change", () => onChange.record());
  }
  for (let i = 0; i < 4; i++) { const s = $(`f3-seq-${i}`); if (s) s.addEventListener("change", () => { live(); onChange.record(); }); }
  for (const id of ["f3-scale", "f3-power", "f3-iterations"]) { const el = $(id); if (el) el.addEventListener("input", live); }
  const tt = $("f3-turntable"); if (tt) tt.addEventListener("change", () => { live(); onChange.record(); });
  const chips = (attr, set) => document.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener("click", () => {
    set(b.getAttribute(attr));
    document.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle("active", x === b));
    live(); onChange.record();
  }));
  chips("data-f3pal", (v) => { palette = v; });
  chips("data-f3bg", (v) => { bg = +v; });
  // The type chips' own handler (studio.js) runs first; the rows follow the new type, and a running
  // progressive view switches formula in place.
  document.querySelectorAll("[data-f3type]").forEach((b) => b.addEventListener("click", () => { rows(); live(); }));
  rows();

  // A readout of convergence, refreshed while the source is open.
  setInterval(() => {
    const h = getHandle(), el = $("f3-readout");
    if (!el || !h || !h.stats) return;
    const s = h.stats();
    el.textContent = s.progressive
      ? `${s.samples} of ${s.maxSamples} samples per pixel` + (s.samples >= s.maxSamples ? ", converged." : ", converging.")
      : "One sample per pixel: this device has no float render target.";
  }, 500);

  function apply(state) {
    if (!state) return;
    for (const [id, [key, out, fmt]] of Object.entries(SLIDERS)) {
      const el = $(id); if (!el) continue;
      const v = key === "kSize1" ? (state.kSize && state.kSize[0]) : state[key];
      if (v == null) continue;
      el.value = String(v);
      const o = $(out); if (o) o.textContent = fmt(el.value);
    }
    if (Array.isArray(state.seq)) for (let i = 0; i < 4; i++) { const s = $(`f3-seq-${i}`); if (s) s.value = state.seq[i] || (i === 0 ? "box" : ""); }
    if (state.palette) { palette = state.palette; document.querySelectorAll("[data-f3pal]").forEach((x) => x.classList.toggle("active", x.dataset.f3pal === palette)); }
    if (state.bg != null) { bg = state.bg; document.querySelectorAll("[data-f3bg]").forEach((x) => x.classList.toggle("active", +x.dataset.f3bg === bg)); }
    if (state.turntable != null && $("f3-turntable")) $("f3-turntable").checked = !!state.turntable;
    rows();
  }

  return { read, apply, rows };
}
