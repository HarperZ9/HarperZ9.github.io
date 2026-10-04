// studio-engine.js: the media engine's surfaces as Studio sources.
//
// The Studio is the single entry for every media surface on the site. The Retro Engine, Gallery
// and Loom draw here through their engine plugins into the Studio's own canvas, so the perception
// panel, snapshot and export read them like any other source. BRender Archival and Engine Revival
// re-hash their receipted release media in the browser. The Splat Lab's renderer is the Spatial
// source. RAW renders live through raw-native's WebAssembly build (raw-register.mjs fills its slot);
// the restored rasterizer is still a reserved slot. Every surface keeps its own page as a door: the
// old URLs all still work.

import { usePlugin, knownPlugins } from "./media-engine/page.mjs";
import { stageHandoff, takeHandoff, exportWithReceipt, exportReferenceReceipt } from "./studio-engine-flows.js";
import { REFERENCE_BACKEND } from "./media-engine/core.mjs";
import { markRisk, riskOf, RISK_LABELS } from "./media-engine/colour.mjs";
import { SLOTS, slotReady } from "./media-engine/plugins/slots.mjs";
import "./media-engine/raw-register.mjs";

export const ENGINE_SURFACES = Object.freeze({
  retro: { label: "Retro Engine", page: "retro.html", plugin: "retro-2d", animated: true, acceptsInput: true,
    intro: "The Retro Engine's default shader through pixelate, palette, dither and a CRT tube. The tube runs on your GPU." },
  gallery: { label: "Gallery", page: "gallery.html", plugin: "plate",
    intro: "One plate from the Gallery's print desk, drawn once from its seed. The same seed always draws the same plate." },
  loom: { label: "Loom", page: "loom.html", plugin: "loom", acceptsInput: true,
    intro: "A seeded plate woven into cloth with the Loom's own draft maths. Change the structure to see the same picture as plain weave, twill, satin, overshot or jacquard." },
  type: { label: "Type forge", page: "type-forge.html", plugin: "type",
    intro: "Your text set in Zain Mint, minted in your browser from the pen and proportions below. The face is unfinished; the site's own text stays in its two canon faces." },
  splats: { label: "Splat Lab", page: "gaussian-splats.html", door: "spatial", plugin: "slot-card",
    card: { title: "Splat scenes draw in the Spatial source", note: "receipt-checked packages; the Splat Lab page publishes none yet" },
    intro: "The Splat Lab's acceptance rule waits for a loadable scene with parallax and a disclosure. The working splat renderer is the Spatial source: it checks every package against its SHA-256 receipt before it draws." },
  brender: { label: "BRender Archival", page: "brender-archival.html", plugin: "evidence", surface: "brender", slot: "revival",
    intro: "The BRender restoration's release media, re-hashed in your browser against the published manifest." },
  revival: { label: "Engine Revival", page: "engine-revival.html", plugin: "evidence", surface: "revival", slot: "revival",
    intro: "Engine Revival's release media, re-hashed in your browser against the published manifest." },
  raw: { label: "RAW", page: "raw.html", slot: "raw", plugin: "slot-card",
    card: { title: "Plugin slot: RAW reference renderer", note: "WebAssembly build not published yet" },
    intro: "RAW, the reference renderer, running in this browser: raw-native 0.4.0 draws one scene on your GPU where it can, checks that frame against its CPU path, and lights it twice, with screen-space and ray-traced ambient occlusion, and writes a certificate saying whether the fast one held." },
});

let current = null;   // { id, handle, mount, observer, plugin, params, input }

// Every control goes through here, so the receipt always names the parameters on screen.
function setP(next) {
  if (!current || !current.handle) return;
  current.params = { ...current.params, ...next };
  current.handle.setParams(next);
}

const el = (tag, attrs = {}, text) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

// A status line: words first, colour only on the one hot mark per view (risk.css).
function statusLine(list, label, verdict, detail) {
  const li = el("li", { "data-verdict": verdict });
  li.append(el("span", { class: "me-status-k" }, label + ": "), el("strong", {}, verdict.toLowerCase() + ", " + RISK_LABELS[riskOf(verdict)]));
  if (detail) li.append(el("span", { class: "me-status-d" }, " " + detail));
  list.append(li);
  return li;
}

function measureSoon() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (typeof window.__studioStartMeterLoop === "function") window.__studioStartMeterLoop();
  }));
}

function control(mount, labelText, input) {
  const wrap = el("label", { class: "at-group me-control" });
  wrap.append(el("span", { class: "at-glab" }, labelText), input);
  mount.append(wrap);
  return input;
}

function select(options, value) {
  const s = el("select", { class: "poster-seed" });
  for (const o of options) { const opt = el("option", { value: o }, o); if (o === value) opt.selected = true; s.append(opt); }
  return s;
}

async function buildControls(id, surface, handle, mount) {
  if (id === "retro") {
    const { paletteNames } = await import("./retro-palettes.js");
    const pal = control(mount, "Palette", select(paletteNames(), "outrun"));
    const mask = control(mount, "Phosphor mask", select(["grille", "slot", "dot", "none"], "grille"));
    const scan = control(mount, "Scanlines", el("input", { type: "range", min: "0", max: "100", value: "35" }));
    const apply = () => setP({ palette: pal.value, mask: mask.value, scanStrength: +scan.value / 100 });
    for (const n of [pal, mask, scan]) n.addEventListener("input", apply);
  }
  if (id === "type") {
    const text = control(mount, "Text", el("input", { type: "text", class: "poster-seed", value: "Adhesion", maxlength: "60", spellcheck: "false" }));
    const weight = control(mount, "Weight", el("input", { type: "range", min: "0.04", max: "0.2", step: "0.001", value: "0.085" }));
    const style = control(mount, "Capitals", select(["drawn", "runic"], "drawn"));
    const apply = () => {
      setP({ text: text.value, weight: +weight.value, style: style.value === "runic" ? "runic" : "" });
      const f = handle.instance.face;
      const note = mount.querySelector(".me-refusal");
      if (note) note.textContent = f && f.refused ? "Refused: " + f.refusals.join(" ") : "";
      measureSoon();
    };
    mount.append(el("p", { class: "transform-note me-refusal", role: "status", "aria-live": "polite" }));
    for (const n of [text, weight, style]) n.addEventListener("input", apply);
  }
  if (id === "gallery" || id === "loom") {
    const { specimenLayerNames } = await import("./media-engine/plugins/plate.mjs");
    const seed = control(mount, "Seed", el("input", { type: "text", class: "poster-seed", value: "folded-light", maxlength: "40", spellcheck: "false" }));
    const layer = control(mount, "Instrument", select(specimenLayerNames(), "caustic-veils"));
    const inputs = [seed, layer];
    let structure = null;
    if (id === "loom") {
      const { STRUCTURE_IDS } = await import("./media-engine/plugins/loom.mjs");
      structure = control(mount, "Structure", select(STRUCTURE_IDS, "jacquard"));
      inputs.push(structure);
    }
    const apply = () => { setP({ seed: seed.value || "folded-light", layers: [layer.value], ...(structure ? { structure: structure.value } : {}) }); measureSoon(); };
    for (const n of inputs) n.addEventListener("change", apply);
  }
  if (id === "raw" && handle && handle.plugin.id === "raw") {
    const { RAW_VIEWS, RAW_SIZES, RAW_CHANNELS } = await import("./media-engine/plugins/raw.mjs");
    const view = control(mount, "View", select(Object.keys(RAW_VIEWS), "default"));
    const size = control(mount, "Size", select(RAW_SIZES.map(String), "384"));
    const channel = control(mount, "Show", select(RAW_CHANNELS, "frame"));
    const apply = () => setP({ view: view.value, size: +size.value, channel: channel.value });
    for (const n of [view, size, channel]) n.addEventListener("change", apply);
  }
}

async function buildStatus(id, surface, handle, mount) {
  const list = el("ul", { class: "me-status", "aria-label": "How we know" });
  mount.append(el("h3", { class: "me-h" }, "How we know"), list);
  if (surface.plugin && surface.plugin !== "slot-card" && handle) statusLine(list, "Renderer", "OK", handle.backend);
  if (current && current.input) statusLine(list, "Input", "OK", "frame from " + current.input.from + ", sha-256 " + current.input.hash.slice(0, 12));
  if (surface.plugin === "evidence") {
    const inst = handle.instance;
    try {
      await inst.ready;
      const ev = inst.state.manifest.firstPartyEvidence[inst.info.evidence];
      if (ev) {
        const p = el("p", { class: "transform-note" });
        p.append("Release ", el("a", { href: ev.releaseHref, rel: "noopener" }, ev.tag), ", commit ", el("code", {}, ev.commitSha.slice(0, 12)), ", " + ev.license + ".");
        mount.insertBefore(p, list.previousSibling);
      }
      for (const c of inst.state.checks) statusLine(list, c.href.split("/").pop(), c.verdict, c.hash ? "sha-256 " + c.hash.slice(0, 12) : "no digest in this context");
    } catch (e) {
      console.error("[studio-engine] manifest check failed:", e);
      statusLine(list, "Release manifest", "UNVERIFIABLE", "the manifest could not be read");
    }
  }
  if (surface.door === "spatial") statusLine(list, "Published Splat Lab scenes", "PENDING", "none yet; Spatial draws receipted packages today");
  const filled = surface.slot && handle && handle.plugin.id === SLOTS[surface.slot].pluginId;
  if (surface.slot && !filled) {
    const slot = SLOTS[surface.slot];
    statusLine(list, slot.name + " (" + slot.backend + ")", slot.verdict, "plugin slot reserved; waits on " + slot.waitsOn.charAt(0).toLowerCase() + slot.waitsOn.slice(1));
  }
  // A live plugin may report its own status (status() and onResult(), as plugins/raw.mjs does).
  const inst = handle && handle.instance;
  if (inst && typeof inst.status === "function") {
    const live = el("ul", { class: "me-status", "aria-label": "Live render", "aria-live": "polite" });
    mount.append(live);
    const paint = () => {
      live.replaceChildren();
      for (const s of inst.status()) statusLine(live, s.label, s.verdict, s.detail);
      markRisk([...list.querySelectorAll("li"), ...live.querySelectorAll("li")]);
      measureSoon();
    };
    paint();
    if (typeof inst.onResult === "function" && current) current.unsubscribe = inst.onResult(paint);
    return;
  }
  markRisk(list.querySelectorAll("li"));
}

// Enter a surface. canvas is the Studio's 2D stage canvas; mount is the rail block for controls.
// isCurrent() lets a slow import bail out if the visitor has already switched away.
export async function enterEngineSurface(id, { canvas, mount, isCurrent = () => true, setSource }) {
  leaveEngineSurface();
  const surface = ENGINE_SURFACES[id];
  if (!surface || !mount) return false;
  mount.replaceChildren(el("p", { class: "transform-note" }, surface.intro));
  let handle = null;
  // A filled slot (registerPlugin in page.mjs) replaces the placeholder card with the real renderer.
  const slotLive = surface.slot && slotReady(surface.slot, knownPlugins()) && surface.plugin === "slot-card";
  const pluginId = slotLive ? SLOTS[surface.slot].pluginId : surface.plugin;
  const input = surface.acceptsInput ? takeHandoff() : null;
  if (pluginId) {
    const engine = await usePlugin(pluginId);
    if (!isCurrent()) return false;
    const params = input ? { source: input.canvas } : surface.surface ? { surface: surface.surface } : slotLive ? {} : (surface.card || {});
    handle = engine.mount(canvas, pluginId, {
      seed: "folded-light",
      params,
      minFrameMs: surface.animated ? 45 : 0,
    });
    // The Studio resizes its canvas on layout changes, which clears it. A still surface draws only
    // on request, so redraw whenever the backing size changes under it.
    let observer = null;
    if (handle.instance.static && typeof MutationObserver === "function") {
      observer = new MutationObserver(() => handle.redraw());
      observer.observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
    }
    current = { id, handle, mount, observer, plugin: pluginId, params, input };
    await buildControls(id, surface, handle, mount);
    measureSoon();
  } else {
    current = { id, handle: null, mount, plugin: null, params: {}, input: null };
  }
  // One action row, one order, on every surface (studio-engine-flows.js).
  const actions = el("div", { class: "at-actions", role: "group", "aria-label": "Surface actions" });
  const drawable = handle && pluginId !== "slot-card";
  if (drawable && typeof setSource === "function") {
    for (const [target, label] of [["retro", "Send to Retro"], ["loom", "Weave in Loom"]]) {
      if (target === id) continue;
      const b = el("button", { type: "button", class: "btn" }, label);
      b.addEventListener("click", async () => { await stageHandoff(canvas, surface.label); setSource(target); });
      actions.append(b);
    }
    const ex = el("button", { type: "button", class: "btn" }, "Export frame and receipt");
    ex.addEventListener("click", () => (handle.backend === REFERENCE_BACKEND
      ? exportReferenceReceipt(handle)
      : exportWithReceipt(canvas, { plugin: pluginId, version: handle.plugin.version, params: current.params,
      seed: current.params.seed || "folded-light", backend: handle.backend, input: current.input })).catch((e) => console.error("[studio-engine] export failed:", e)));
    actions.append(ex);
  }
  if (surface.door && typeof setSource === "function") {
    const b = el("button", { type: "button", class: "btn" }, "Open the receipted scenes in Spatial");
    b.addEventListener("click", () => setSource(surface.door));
    actions.append(b);
  }
  actions.append(el("a", { class: "btn ghost", href: surface.page }, "Open the " + surface.label + " page"));
  mount.append(actions);
  if (isCurrent()) await buildStatus(id, surface, handle, mount);
  return true;
}

export function leaveEngineSurface() {
  if (!current) return;
  if (current.observer) current.observer.disconnect();
  if (current.unsubscribe) current.unsubscribe();
  if (current.handle) current.handle.dispose();
  current = null;
}

// Static once drawn: the perception loop may idle. The Retro surface animates unless reduced motion.
export function engineSurfaceStatic() {
  if (!current || !current.handle) return true;
  return !!current.handle.instance.static || !!(window.__mediaEngine && window.__mediaEngine.reduced);
}

export function currentEngineHandle() { return current ? current.handle : null; }
