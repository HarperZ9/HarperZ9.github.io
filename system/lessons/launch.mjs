// system/lessons/launch.mjs
// The playable lesson and the demos beside the explainer films. Each sits behind a button and
// loads only on a press: nothing plays, loads the engine or makes a sound before the reader asks.
const NAMES = new Set(["night-shift", "passing-check", "rederive", "incentives", "visible-reasoning"]);

function setup(box) {
  const name = box.dataset.lesson, btn = box.querySelector("[data-lesson-open]"), stage = box.querySelector("[data-lesson-stage]"), note = box.querySelector("[data-lesson-note]");
  if (!NAMES.has(name) || !btn || !stage) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    if (note) note.textContent = "Loading the engine and the scene.";
    try {
      const m = await import(new URL(`./${name}-page.mjs`, import.meta.url).href);
      const run = await m.mount(stage);
      btn.remove();
      if (note) note.textContent = run && run.backend === "webgpu" ? "Drawn live by the raw-native engine with WebGPU." : "Drawn live by the raw-native engine on a 2D canvas, because this browser has no WebGPU.";
    } catch (e) {
      console.warn("lesson:", e);
      btn.disabled = false;
      if (note) note.textContent = "It could not start in this browser. The film above covers the same idea.";
    }
  });
}

document.querySelectorAll("[data-lesson]").forEach(setup);
