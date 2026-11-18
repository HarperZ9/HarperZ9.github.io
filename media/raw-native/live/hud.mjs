// The panel: every control, what the page measured, said in words, and the cost of each pass.
import { PASSES } from "./frame.mjs";

const fmt = (v) => (v < 0.0005 ? v.toFixed(5) : v.toFixed(3));
const ORDER = ["G-buffer", "back layer", "pack", "GTAO (engine)", "sun and sky", "SSR (engine)", "air", "compose", "TAA (engine)", "lens", "reference: AO and mirror", "reference: path", "measure", "present"];

export class Hud {
  constructor(doc) {
    this.d = doc; this.$ = (id) => doc.getElementById(id);
    this.state = { on: PASSES.AO | PASSES.SSR | PASSES.TAA | PASSES.SKY | PASSES.FOG, show: 0, split: 0.5, reference: true, gtao: { slices: 4, steps: 8 },
      azimuth: 200, elevation: 58, ev: 11.5, air: 1, aperture: 0, tilt: 0.4, focus: 10, display: "aces2-sdr/srgb", pixels: 1 };
    this.lastSay = 0;
  }
  note(t) { this.$("note").textContent = t; }
  say(t) { this.$("rl-said").textContent = t; }
  adapter(host) {
    const i = host.info || {};
    this.$("rl-adapter").textContent = `Adapter: ${[i.vendor, i.architecture, i.description].filter(Boolean).join(", ") || "not named by the browser"}.${host.timer ? "" : " This adapter gives no GPU timestamps, so pass times are not shown."}`;
  }
  slider(id, key, unit, set) {
    const el = this.$(id), out = el.parentElement.querySelector("output");
    const show = () => { out.value = unit(+el.value); };
    el.addEventListener("input", () => { this.state[key] = +el.value; show(); set && set(); this.cb.onChange(); });
    this.sliders = this.sliders || {}; this.sliders[key] = (v) => { el.value = v; this.state[key] = +el.value; show(); };
    show();
  }
  bind(cb) {
    this.cb = cb; const $ = this.$, st = this.state;
    $("rl-pick-scene").addEventListener("change", (e) => cb.onScene(e.target.value));
    $("rl-pick-view").addEventListener("change", (e) => cb.onView(e.target.value));
    $("rl-show").addEventListener("change", (e) => { st.show = +e.target.value; this.d.querySelector(".rl-split").hidden = ![1, 4, 5].includes(st.show); cb.onChange(); });
    $("rl-split").addEventListener("input", (e) => { st.split = +e.target.value / 100; cb.onChange(); });
    $("rl-ref").addEventListener("change", (e) => { st.reference = e.target.value === "1"; cb.onChange(); });
    $("rl-gtao").addEventListener("change", (e) => { const [a, b] = e.target.value.split("x").map(Number); st.gtao = { slices: a, steps: b }; cb.onChange(); });
    $("rl-display").addEventListener("change", (e) => { st.display = e.target.value; cb.onChange(); });
    $("rl-pixels").addEventListener("change", (e) => { st.pixels = +e.target.value; cb.onChange(); });
    for (const li of this.d.querySelectorAll("#rl-passes li")) {
      const bit = +li.dataset.bit, box = li.querySelector("input");
      box.addEventListener("change", () => { st.on = box.checked ? st.on | bit : st.on & ~bit; cb.onChange(); });
    }
    const deg = (v) => `${v.toFixed(0)}°`;
    this.slider("rl-az", "azimuth", deg); this.slider("rl-el", "elevation", deg);
    this.slider("rl-ev", "ev", (v) => `EV ${v.toFixed(2)}`);
    this.slider("rl-air", "air", (v) => (v ? `${v.toFixed(2)}x` : "clear"), () => this.availability());
    this.slider("rl-ap", "aperture", (v) => (v ? `${(v * 100).toFixed(0)} cm` : "pinhole"), () => this.availability());
    this.slider("rl-tilt", "tilt", (v) => `${(v * 180 / Math.PI).toFixed(0)}°`);
    this.slider("rl-focus", "focus", (v) => `${v.toFixed(1)} m`);
  }
  sceneLoaded(id, def, scene, tree) {
    const $ = this.$;
    $("rl-pick-scene").value = id;
    $("rl-scene").textContent = def.name.toLowerCase();
    $("rl-pick-view").replaceChildren(...Object.entries(def.views).map(([k, v]) => new Option(v.label, k)));
    const s = this.sliders;
    s.azimuth(def.sun.azimuth); s.elevation(def.sun.elevation); s.ev(def.ev); s.focus(def.lens.focus); s.tilt(def.lens.tilt);
    $("rl-receipt").textContent = `${scene.receipt.join("; ")}. ${scene.triMat.length.toLocaleString("en")} triangles and ${scene.materials.length} materials; the tree has ${(tree.nodes.length / 8).toLocaleString("en")} nodes, built here in ${Math.round(tree.ms)} ms. `
      + "GTAO, SSR and TAA are the engine's own WGSL (post.wgsl), and every ray here crosses triangles with the engine's watertight test and walks its BVH layout (passes.wgsl), all from superframe commit cac34166 and checked by SHA-256 before they compile. "
      + "The display transform is the engine's colour pipeline (colour.wgsl, ACES 2.0 tables from its C++ reference). The sky is the engine's Preetham model. "
      + "Written for this page: the G-buffer draw (the browser's rasterizer), the sun and sky shading, the air, the lens blur and both references.";
    this.availability();
  }
  pickView(k) { this.$("rl-pick-view").value = k; this.cb.onView(k); }
  availability() {
    const st = this.state;
    for (const li of this.d.querySelectorAll("#rl-passes li")) {
      const bit = +li.dataset.bit, off = (bit === PASSES.FOG && !st.air) || (bit === PASSES.TILT && !st.aperture);
      li.setAttribute("aria-disabled", off ? "true" : "false");
      li.querySelector("input").disabled = off;
      const m = li.querySelector(".rl-m");
      if (off) m.textContent = bit === PASSES.FOG ? "The air is clear. Raise Air below to give it light to carry." : "The lens is a pinhole. Open the aperture below to give it something to blur.";
      else if (m.dataset.idle) m.textContent = "";
      m.dataset.idle = off ? "1" : "";
    }
  }
  availablePasses() {
    const st = this.state;
    return [PASSES.AO, PASSES.SSR, PASSES.TAA, PASSES.SKY, ...(st.air ? [PASSES.FOG] : []), ...(st.aperture ? [PASSES.TILT] : [])];
  }
  clearMeasures() {
    for (const m of this.d.querySelectorAll(".rl-m")) if (!m.dataset.idle) m.textContent = "";
    this.$("rl-frame-err").textContent = "The measures start once the camera holds still.";
    this.sweepErr = null;
  }
  m(key) { return this.d.querySelector(`.rl-m[data-m="${key}"]`); }
  measures(r, frame) {
    const v = r.v, st = this.state;
    const frameErr = Math.sqrt(v[6] / Math.max(v[7], 1));
    this.$("rl-frame-err").textContent = `This frame against the path-traced reference, ${r.ref} samples a pixel: RMSE ${fmt(frameErr)} in display values (0 to 1).`;
    if (v[2] > 0 && st.on & PASSES.AO) {
      const a = Math.sqrt(v[0] / v[2]), none = Math.sqrt(v[1] / v[2]);
      this.ao = `GTAO against ray-traced AO, ${r.ref} rays a pixel, RMSE ${fmt(a)}: ${a <= 0.12 ? "within" : "outside"} the engine's 0.12 tolerance. No AO: ${fmt(none)}.`;
    } else this.ao = "";
    if (v[5] > 0 && st.on & PASSES.SSR) this.ssr = `SSR against the traced mirror, over ${Math.round(v[5]).toLocaleString("en")} pixels: RMSE ${fmt(Math.sqrt(v[3] / v[5]))}. The sky probe alone: ${fmt(Math.sqrt(v[4] / v[5]))}.`;
    else this.ssr = st.on & PASSES.SSR ? "No mirror-like surface in view." : "";
    this.render(frame);
    if (performance.now() - this.lastSay > 4000) { this.lastSay = performance.now(); this.say(this.$("rl-frame-err").textContent); }
  }
  sweep(errs, frame) { this.sweepErr = errs; this.render(frame); }
  render(frame) {
    const st = this.state, cur = this.lastFrameErr;
    const keys = { [PASSES.AO]: "ao", [PASSES.SSR]: "ssr", [PASSES.TAA]: "taa", [PASSES.SKY]: "sky", [PASSES.FOG]: "fog", [PASSES.TILT]: "tilt" };
    const fe = this.$("rl-frame-err").textContent.match(/RMSE ([0-9.]+)/);
    for (const [bit, key] of Object.entries(keys)) {
      const el = this.m(key);
      if (el.dataset.idle) continue;
      const lines = [];
      if (key === "ao" && this.ao) lines.push(this.ao);
      if (key === "ssr" && this.ssr) lines.push(this.ssr);
      if (this.sweepErr && this.sweepErr[bit] !== undefined && fe) {
        const here = +fe[1], flipped = this.sweepErr[bit], isOn = (st.on & bit) !== 0;
        lines.push(`Frame against the reference: on ${fmt(isOn ? here : flipped)}, off ${fmt(isOn ? flipped : here)}.`);
      }
      el.textContent = lines.join("\n");
    }
    void cur; void frame;
  }
  tick(frame, gpu) {
    const r = frame.r, ms = frame.timer.ms, names = ORDER.filter((n) => ms[n] !== undefined);
    const total = names.filter((n) => !n.startsWith("reference") && n !== "measure").reduce((a, n) => a + ms[n], 0);
    const now = performance.now();
    if (now - (this.lastTick || 0) < 250) return;
    this.lastTick = now;
    this.$("rl-stat").textContent = `${r.w} x ${r.h}, ${(r.bytes / 1e6).toFixed(0)} MB of buffers\nreal-time passes ${total ? total.toFixed(2) + " ms on the GPU" : "untimed"}${frame.ref ? `, reference ${frame.ref} samples` : ""}`;
    const max = Math.max(1e-3, ...names.map((n) => ms[n]));
    this.$("rl-times").replaceChildren(...names.map((n) => {
      const li = this.d.createElement("li"), bar = this.d.createElement("span"), a = this.d.createElement("span"), b = this.d.createElement("span");
      a.textContent = n; b.textContent = `${ms[n].toFixed(2)} ms`; bar.className = "bar"; bar.style.setProperty("--w", `${(100 * ms[n] / max).toFixed(1)}%`);
      li.append(a, bar, b); return li;
    }));
    void gpu;
  }
}
