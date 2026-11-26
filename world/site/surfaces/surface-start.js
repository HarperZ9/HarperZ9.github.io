// surface-start.js: all a surface loads before a press. One press, or an address that carries ?start, brings the
// modules in (surface-page.mjs). A room has its own press, or opens when the address names it (rooms.mjs).
const mb = document.getElementById("sx-marble-all"), mHost = document.getElementById("mx-host");
if (mb && mHost) {
  const goAll = () => {
    mb.disabled = true; mb.textContent = "Marbling all mediums";
    import("./marbled-field.mjs").then((m) => m.mountMarbledField(mHost)).then(() => {
      mb.textContent = "Unified marbled surface active";
    }).catch((e) => {
      console.error("surface: marbled field failed", e);
      mb.disabled = false; mb.textContent = "Open unified marbled surface";
    });
  };
  mb.hidden = false; mb.addEventListener("click", goAll);
  if (new URLSearchParams(location.search).has("marbled")) goAll();
}
const b = document.getElementById("sx-start"), say = document.getElementById("sx-say");
if (b) {
  const words = b.textContent;
  const go = () => {
    b.disabled = true; b.textContent = "Starting";
    import("./surface-page.mjs").then((m) => m.start()).catch((e) => {
      console.error("surface: the modules did not start", e);
      b.disabled = false; b.textContent = words; say.textContent = "The modules did not load. The reading above stays as built.";
    });
  };
  b.hidden = false; b.addEventListener("click", go);
  if (new URLSearchParams(location.search).has("start")) go();
}
for (const r of document.querySelectorAll("[data-room-open]")) {
  const sec = r.closest("[data-room]"), words = r.textContent;
  // a room that plays sound on its press makes the audio device inside the press, before its code has loaded, because
  // a browser lets sound start only from inside a press; an address that opens the room makes none and plays nothing
  const audio = () => { if (!sec.hasAttribute("data-audio")) return null; try { const AC = window.AudioContext || window.webkitAudioContext, a = new AC({ latencyHint: "interactive" }); a.resume().catch((e) => console.error("surface: the audio device did not resume", e)); return a; } catch (e) { console.error("surface: no audio device", e); return null; } };
  const go = (ev) => {
    const press = ev ? { audio: audio() } : null;
    r.disabled = true; r.textContent = "Opening";
    import("./rooms.mjs").then((m) => m.open(sec.dataset.room, sec, { press })).catch((e) => {
      console.error("surface: the room did not open", e);
      r.disabled = false; r.textContent = words; sec.querySelector(".rm-say").textContent = "The room did not load. The reading above stays as built.";
    });
  };
  r.hidden = false; r.addEventListener("click", go);
  if ((new URLSearchParams(location.search).get("room") || "").split(",").includes(sec.id)) go();
}

// Unified creative engine workbench: load engine-workbench.mjs lazily on first filter input or launch click.
const wb = document.getElementById("workbench");
if (wb) {
  let wbPromise = null;
  const bootWb = () => (wbPromise ||= import("./engine-workbench.mjs").then((m) => { m.initWorkbench(document); return m; }));
  wb.querySelector("#wb-filter")?.addEventListener("focus", () => { bootWb(); }, { once: true });
  wb.querySelector("#wb-filter")?.addEventListener("input", () => { bootWb(); }, { once: true });
  wb.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-wb-action]");
    if (!btn || wb.dataset.wbReady) return;
    ev.preventDefault();
    bootWb().then(() => btn.click());
  });
}

// Superframe 4-layer readout front switcher (#superframe)
const sfBox = document.querySelector("[data-stack]");
if (sfBox) {
  const btns = [...sfBox.querySelectorAll("[data-show]")];
  const layers = Object.fromEntries([...sfBox.querySelectorAll("[data-layer]")].map((el) => [el.dataset.layer, el]));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = "paint";
  const show = (name) => {
    for (const [k, el] of Object.entries(layers)) {
      const at = `${el.dataset.x}% ${el.dataset.y}%`;
      if (k === name) { el.style.transition = still ? "none" : ""; el.style.clipPath = `circle(150% at ${at})`; el.style.zIndex = 3; }
      else { el.style.zIndex = k === current ? 2 : 1; if (k !== current || name === "paint") el.style.clipPath = `circle(0% at ${at})`; }
    }
    if (name === "paint" && layers[current]) layers[current].style.clipPath = `circle(0% at ${layers[current].dataset.x}% ${layers[current].dataset.y}%)`;
    current = name;
    for (const btn of btns) btn.setAttribute("aria-pressed", String(btn.dataset.show === name));
  };
  for (const btn of btns) btn.addEventListener("click", () => show(btn.dataset.show));
}
