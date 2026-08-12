// loom-studio.js -- the Loom's controller: a source image becomes threading,
// tie-up, and treadling in a real weave structure, woven pick by pick.
// Sources arrive by sessionStorage handoff from the Retro Engine, the Studio,
// and the Gallery, or by local upload; with neither, a seeded generative plate
// keeps the loom warm on arrival. Exports: WIF draft, chart PNG, cloth PNG,
// and the cloth handed back to the Retro Engine's pixel pipeline.
import { STRUCTURES, computeDraft, draftToWIF, weftPaletteFor } from "./weave-engine.js?v=20260811-crossings";
import { renderCloth, renderDraftChart } from "./weave-render.js?v=20260811-crossings";

const $ = (id) => document.getElementById(id);

const WARPS = { bone: "#e8e2d4", ink: "#14131a", indigo: "#2b3a67", rust: "#8c4a2f", gold: "#c9a227" };
const WEFTS = {
  "bone-ink": ["#e8e2d4", "#14131a"],
  "ember": ["#f2b134", "#e0632f", "#8c2f1b", "#3a1410"],
  "indigo-bone": ["#2b3a67", "#5a6f9e", "#e8e2d4"],
};

function boot() {
  const out = $("wv-out");
  if (!out) return;

  const src = document.createElement("canvas"); src.width = 640; src.height = 400;
  let haveSource = false, draft = null, colors = null, woven = 0, raf = 0, lastPick = 0;
  let structureId = "jacquard", audio = null;

  function status(msg, kind) { const el = $("wv-status"); el.textContent = msg || ""; el.className = "re-status" + (kind ? " " + kind : ""); }
  const ping = (k, v) => { try { if (audio && audio.isOn()) audio.ping(k, v); } catch (_) {} };

  // --- sampling: the image grid the draft is computed from ------------------
  function sample() {
    const ends = +$("wv-sett").value;
    const picks = Math.max(24, Math.round(ends * (src.height / src.width)));
    const g = document.createElement("canvas"); g.width = ends; g.height = picks;
    const ctx = g.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, ends, picks);
    const px = ctx.getImageData(0, 0, ends, picks).data;
    let luma = new Float32Array(ends * picks);
    const rowRGB = [];
    for (let p = 0; p < picks; p++) {
      let r = 0, gr = 0, b = 0;
      for (let e = 0; e < ends; e++) {
        const o = (p * ends + e) * 4;
        luma[p * ends + e] = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
        r += px[o]; gr += px[o + 1]; b += px[o + 2];
      }
      rowRGB.push([r / ends, gr / ends, b / ends]);
    }
    // Contrast-stretch to full range before drafting (jacquard practice:
    // the shading input spans true black to true white, or tones bunch up).
    const sorted = Float32Array.from(luma).sort();
    const lo = sorted[(sorted.length * 0.02) | 0], hi = sorted[(sorted.length * 0.98) | 0];
    const span = Math.max(0.05, hi - lo);
    for (let i = 0; i < luma.length; i++) luma[i] = Math.max(0, Math.min(1, (luma[i] - lo) / span));
    return { ends, picks, luma, rowRGB };
  }

  function rebuild(fresh) {
    if (!haveSource) return;
    const { ends, picks, luma, rowRGB } = sample();
    draft = computeDraft(luma, ends, picks, structureId, { toneDrive: (+$("wv-tone").value) / 100 });
    const mode = $("wv-weft").value;
    const pal = mode === "image"
      ? weftPaletteFor(draft, (p) => rowRGB[p], "image")
      : weftPaletteFor(draft, (p) => rowRGB[p], WEFTS[mode] || WEFTS["bone-ink"]);
    colors = { warpHex: WARPS[$("wv-warp").value] || WARPS.ink, weftHexes: pal.hexes, weftHexAt: (p) => pal.hexes[pal.indexAt(p)], weftIndexAt: pal.indexAt };
    const hint = $("wv-structure-hint"), s = STRUCTURES[structureId];
    if (hint && s) hint.textContent = s.perCell ? "per-thread shading, chart + cloth exports" : s.shafts + " shafts, " + s.treadles + " treadles";
    if (fresh) woven = $("wv-weaveit").checked ? 0 : draft.picks;
    draw();
    sync();
  }

  function draw() {
    if (!draft) return;
    renderCloth(out, draft, colors, { upTo: woven, light: 0.65 });
  }

  // --- the weaving animation: the shuttle crosses, the row sounds -----------
  function rowBands(p) {
    const B = 6, per = draft.ends / B, bands = new Array(B);
    for (let b = 0; b < B; b++) {
      let m = 0, c = 0;
      for (let e = (b * per) | 0; e < ((b + 1) * per) | 0; e++) { m += draft.lumaAt ? draft.lumaAt(e, p) : 0; c++; }
      bands[b] = Math.min(1, (m / (c || 1)) * 1.15);
    }
    return bands;
  }
  function loop(now) {
    raf = 0;
    if (!draft || !$("wv-weaveit").checked || woven >= draft.picks) return;
    const speed = +$("wv-speed").value;
    if (!lastPick) lastPick = now;
    const due = Math.min(4, Math.floor((now - lastPick) / (1000 / speed)));
    if (due > 0) {
      lastPick = now;
      for (let i = 0; i < due && woven < draft.picks; i++) {
        woven++;
        const tone = draft.pickTone[woven - 1] || 0;
        if (speed <= 30) ping("row", tone); else if (woven % 4 === 0) ping("slider", tone);
      }
      if (audio && audio.isOn()) { try { audio.feed(rowBands(woven - 1)); } catch (_) {} }
      draw();
      if (woven >= draft.picks) status("cloth complete: " + draft.picks + " picks", "ok");
    }
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    if (raf) cancelAnimationFrame(raf); raf = 0; lastPick = 0;
    if (draft && $("wv-weaveit").checked && woven < draft.picks) raf = requestAnimationFrame(loop);
  }

  // --- sources --------------------------------------------------------------
  function useImage(img, note) {
    const ctx = src.getContext("2d");
    const sc = Math.min(src.width / img.naturalWidth, src.height / img.naturalHeight);
    ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, src.width, src.height);
    ctx.drawImage(img, (src.width - img.naturalWidth * sc) / 2, (src.height - img.naturalHeight * sc) / 2,
      img.naturalWidth * sc, img.naturalHeight * sc);
    haveSource = true;
    status(note, "ok");
    rebuild(true);
  }
  function bootHandoff() {
    let dataURL = null;
    try { dataURL = sessionStorage.getItem("re.loom.handoff"); } catch (_) { return false; }
    if (!dataURL) return false;
    try { sessionStorage.removeItem("re.loom.handoff"); } catch (_) {}
    const img = new Image();
    img.onload = () => useImage(img, "warping up the frame you sent over");
    img.onerror = () => status("could not read the handed-over image", "err");
    img.src = dataURL;
    return true;
  }
  async function bootPlate() {
    try {
      const mod = await import("./generative-field.js");
      const render = mod.renderSpecimen || mod.renderPlate;
      if (render) {
        // The plate renderer may resize its canvas to a banner; cover-fit the
        // result into the loom's 16:10 frame so the default cloth fills it.
        const t = document.createElement("canvas"); t.width = 640; t.height = 400;
        render(t, "folded-light", ["showpiece-veil"]);
        const ctx = src.getContext("2d");
        const sc = Math.max(src.width / t.width, src.height / t.height);
        ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, src.width, src.height);
        ctx.drawImage(t, (src.width - t.width * sc) / 2, (src.height - t.height * sc) / 2, t.width * sc, t.height * sc);
        haveSource = true; rebuild(true); return;
      }
    } catch (_) {}
    status("drop an image in to begin", "");
  }
  $("wv-file").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); useImage(img, "warped up your image"); };
    img.src = URL.createObjectURL(f);
  });

  // --- controls -------------------------------------------------------------
  const host = $("wv-structures");
  Object.keys(STRUCTURES).forEach((id, i) => {
    const b = document.createElement("button");
    b.className = "re-chip"; b.type = "button"; b.setAttribute("role", "radio");
    b.setAttribute("aria-pressed", String(id === structureId));
    b.textContent = STRUCTURES[id].name; b.dataset.id = id;
    b.addEventListener("click", () => {
      structureId = id; ping("chip", i / 4);
      host.querySelectorAll(".re-chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === id)));
      rebuild(true);
    });
    host.appendChild(b);
  });
  [["wv-sett", "wv-sett-v", (v) => v + " ends"], ["wv-tone", "wv-tone-v", (v) => v], ["wv-speed", "wv-speed-v", (v) => v]]
    .forEach(([id, vid, fmt]) => $(id).addEventListener("input", () => {
      $(vid).textContent = fmt($(id).value);
      if (id !== "wv-speed") rebuild(id === "wv-sett");
    }));
  ["wv-warp", "wv-weft"].forEach((id) => $(id).addEventListener("change", () => { ping("preset"); rebuild(false); }));
  $("wv-weaveit").addEventListener("change", () => {
    if ($("wv-weaveit").checked) { if (draft && woven >= draft.picks) woven = 0; }
    else if (draft) { woven = draft.picks; draw(); }
    sync(); ping("chip", 0.6);
  });
  $("wv-sound").addEventListener("change", async () => {
    if ($("wv-sound").checked) {
      try {
        const m = await import("./retro-audio.js?v=20260811-crossings");
        if (!audio) audio = m.createRetroAudio();
        await audio.start("loom-" + structureId);
        status("the rows will sound as they weave", "ok");
      } catch (e) { status("sound needs a click to start", "err"); $("wv-sound").checked = false; }
    } else if (audio && audio.isOn()) { try { audio.stop(); } catch (_) {} }
  });

  // --- exports --------------------------------------------------------------
  function download(name, href) { const a = document.createElement("a"); a.download = name; a.href = href; a.click(); }
  $("wv-wif").addEventListener("click", () => {
    if (!draft) return;
    if (draft.perCell) { status("jacquard is per-thread: no shaft draft exists; export the chart or the cloth, or pick a shaft structure", ""); return; }
    const wif = draftToWIF(draft, { title: "The Loom, " + STRUCTURES[structureId].name, warpHex: colors.warpHex, weftHexes: colors.weftHexes, weftIndexAt: colors.weftIndexAt });
    download("loom-" + structureId + ".wif", URL.createObjectURL(new Blob([wif], { type: "text/plain" })));
    ping("bell"); status("WIF draft saved: open it in any WIF-aware loom tool", "ok");
  });
  $("wv-draft").addEventListener("click", () => {
    if (!draft) return;
    const c = document.createElement("canvas");
    renderDraftChart(c, draft, colors, { width: 1200 });
    download("loom-draft-" + structureId + ".png", c.toDataURL("image/png"));
    ping("bell"); status("draft chart saved", "ok");
  });
  $("wv-save").addEventListener("click", () => { if (draft) { download("loom-cloth.png", out.toDataURL("image/png")); ping("preset"); } });
  $("wv-send-retro").addEventListener("click", () => {
    if (!draft) return;
    try { sessionStorage.setItem("re.retro.handoff", out.toDataURL("image/png")); }
    catch (e) { status("cloth too large to hand off", "err"); return; }
    ping("bell"); status("opening the Retro Engine…", "ok");
    location.href = "retro.html?import=plate";
  });

  // --- palpable controls + keys + fullscreen (the house feel) ---------------
  const canBuzz = "vibrate" in navigator && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panel = $("wv-panel");
  panel.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".re-btn,.re-chip,.re-toggle");
    if (!el) return;
    if (canBuzz) try { navigator.vibrate(10); } catch (_) {}
    el.classList.remove("re-hit"); void el.offsetWidth; el.classList.add("re-hit");
  });
  panel.addEventListener("input", (e) => {
    const el = e.target;
    if (el.type !== "range") return;
    const span = (el.max - el.min) / 14, snap = Math.round((el.value - el.min) / span);
    if (el.__detent !== snap) {
      el.__detent = snap;
      if (canBuzz) try { navigator.vibrate(6); } catch (_) {}
      el.classList.remove("re-tick"); void el.offsetWidth; el.classList.add("re-tick");
    }
  });
  async function fullscreen() {
    const stage = $("wv-stage-preview");
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); } catch (_) {}
  }
  $("wv-fullscreen").addEventListener("click", fullscreen);
  out.addEventListener("dblclick", fullscreen);
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input[type=text],textarea,select")) return;
    if (e.key === " ") { e.preventDefault(); $("wv-weaveit").checked = !$("wv-weaveit").checked; $("wv-weaveit").dispatchEvent(new Event("change")); }
    else if (e.key === "s" || e.key === "S") $("wv-save").click();
    else if (e.key === "f" || e.key === "F") fullscreen();
  });

  // --- boot -----------------------------------------------------------------
  const wantsImport = new URLSearchParams(location.search).get("import") === "render";
  if (!(wantsImport && bootHandoff()) && !bootHandoff()) bootPlate();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
