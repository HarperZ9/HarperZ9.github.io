// surface-start.js: all a surface loads before a press. One press, or an address that carries ?start, brings the
// modules in (surface-page.mjs). A room has its own press, or opens when the address names it (rooms.mjs).
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
  const go = () => {
    r.disabled = true; r.textContent = "Opening";
    import("./rooms.mjs").then((m) => m.open(sec.dataset.room, sec)).catch((e) => {
      console.error("surface: the room did not open", e);
      r.disabled = false; r.textContent = words; sec.querySelector(".rm-say").textContent = "The room did not load. The reading above stays as built.";
    });
  };
  r.hidden = false; r.addEventListener("click", go);
  if ((new URLSearchParams(location.search).get("room") || "").split(",").includes(sec.id)) go();
}
