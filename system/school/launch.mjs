// Night School: each film and lab sits behind a button and loads only on a press. Nothing plays,
// loads the engine or makes a sound before the reader asks.
const NOTE = { webgpu: "Drawn live by the raw-native engine with WebGPU.", canvas2d: "Drawn live by the raw-native engine on a 2D canvas, because this browser has no WebGPU." };

function setup(box) {
  const kind = box.dataset.school, btn = box.querySelector("[data-school-open]"), stage = box.querySelector("[data-school-stage]"), note = box.querySelector("[data-school-note]");
  if (!btn || !stage || !["film", "lab"].includes(kind)) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    if (note) note.textContent = "Loading the engine and the scene.";
    try {
      let run;
      if (kind === "film") {
        const { mountFilm } = await import(new URL("./film-player.mjs", import.meta.url).href);
        run = await mountFilm(stage, { scene: new URL(box.dataset.scene, document.baseURI).href });
      } else {
        const m = await import(new URL(`./${box.dataset.lab}-lab-page.mjs`, import.meta.url).href);
        run = await m.mount(stage);
      }
      btn.remove();
      if (note) note.textContent = NOTE[run.backend] || NOTE.canvas2d;
    } catch (e) {
      console.warn("night school:", e);
      btn.disabled = false;
      if (note) note.textContent = "It could not start in this browser.";
    }
  });
}

document.querySelectorAll("[data-school]").forEach(setup);
