// pair.js: two frames of one scene, one shown at a time; the buttons switch between them. Without scripts both
// frames show, one above the other, with the caption under them.
const fig = document.querySelector('[data-toy="pair"]');
if (fig) {
  const buttons = fig.querySelector(".pair-buttons"), frames = [...fig.querySelectorAll("[data-frame]")];
  const show = (i) => {
    frames.forEach((f) => { f.hidden = f.dataset.frame !== String(i); });
    for (const b of buttons.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.show === String(i)));
  };
  buttons.hidden = false; fig.classList.add("pair-on");
  buttons.addEventListener("click", (e) => { const b = e.target.closest("button[data-show]"); if (b) show(+b.dataset.show); });
  show(0);
}
