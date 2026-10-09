// system/explainer/motion-film.mjs
// The interactive version of a film that is drawn by raw-native's Motion layer.
// A film with a scene (media/explainers/<slug>/film.scene.mjs) gets a button
// under its video. On a press, and only then, the engine loads and draws the
// same scene live: scrub, pause, step a frame with , and . (comma and full
// stop), captions on or off. It plays the film's own sound track. Playing one
// pauses the other. Without WebGPU the button says so and the video stays.

const el = (tag, attrs = {}, text = "") => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};

function setup(box) {
  const folder = box.dataset.folder, slug = box.dataset.film, engine = box.dataset.engine;
  if (!/^media\/explainers\/[a-z0-9-]+$/.test(folder) || !/^media\/raw-native\/web-[\w-]+$/.test(engine)) return;
  const fig = box.closest("section")?.querySelector("figure.film video");
  const btn = el("button", { type: "button", class: "mf-open" }, "Open the interactive version");
  const note = el("p", { class: "mf-note" });
  box.append(btn, note);
  if (!navigator.gpu) {
    btn.disabled = true;
    note.textContent = "This browser has no WebGPU, so the interactive version cannot run here. The video above is the same film.";
    return;
  }
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    note.textContent = "Loading the engine and the scene.";
    try {
      const base = new URL("./", location.href);
      const { mountPlayer } = await import(new URL(`${engine}/motion/player.mjs`, base).href);
      const audio = new Audio(new URL(`${folder}/${slug}.m4a`, base).href);
      const stage = el("div", { class: "mf-stage" });
      box.append(stage);
      const p = await mountPlayer(stage, {
        sceneUrl: new URL(`${folder}/film.scene.mjs`, base).href,
        shaders: new URL(`${engine}/`, base).href,
        audio, captions: new URL(`${folder}/${slug}.vtt`, base).href,
        label: box.dataset.label || "Interactive film",
      });
      btn.remove();
      note.textContent = p ? "Drawn live by the raw-native engine in this browser. Space plays and pauses; the arrow keys skip 5 seconds; comma and full stop step one frame." : "";
      if (p && fig) {
        audio.addEventListener("play", () => fig.pause());
        fig.addEventListener("play", () => p.pause());
      }
    } catch (e) {
      console.warn("motion film:", e);
      note.textContent = "The interactive version could not start here. The video above is the same film.";
    }
  });
}

document.querySelectorAll("[data-motion-film]").forEach(setup);
