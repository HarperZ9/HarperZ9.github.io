// The menu's dressing, fetched by organic.js on the first opening of the menu: its lettered words and its sand
// ground. The menu is already open and usable as plain words when this arrives; both layers are laid over the
// words and move nothing.
import { still, load, clock, DPR, canvasIn } from "./gen-util.js";

// menu words are lettered once they have a size; the lettering library draws them through the display slots
async function letter(dlg) {
  const words = [...dlg.querySelectorAll("[data-display-on-open]")];
  if (!words.length) return;
  if (!window.UIShell?.drawSlot) await import("../slots.js");
  if (!dlg.open) await new Promise((done) => dlg.addEventListener("toggle", function opened() { if (dlg.open) { dlg.removeEventListener("toggle", opened); done(); } }));
  words.forEach((el) => { el.dataset.display = el.dataset.displayOnOpen; window.UIShell.drawSlot(el); });
  setTimeout(() => dispatchEvent(new Event("o-lettered")), 0);
}

// ---- the menu ground: sand thrown onto a plate settles into its nodal lines when the menu opens.
export async function sandMenu(dlg) {
  const C = await load("feed-22/build/chladni.js");
  const cv = canvasIn(dlg, "o-sand"), g = cv.getContext("2d", { colorSpace: "display-p3" });
  let field = null, sand = null, off = null;
  const draw = () => {
    const w = cv.width, h = cv.height, s = DPR();
    g.clearRect(0, 0, w, h); g.fillStyle = getComputedStyle(dlg).color;
    for (let i = 0; i < sand.n; i++) { const x = (sand.x[i] + 1) / 2 * w, y = (sand.y[i] + 1) / 2 * h; g.globalAlpha = 0.35 + 0.5 * sand.tone[i]; g.fillRect(x, y, s * sand.size[i] * 1.4, s * sand.size[i] * 1.4); }
    g.globalAlpha = 1;
  };
  const settle = () => {
    if (!dlg.open) { off?.(); off = null; return; }
    const r = dlg.getBoundingClientRect(); cv.width = Math.round(r.width * DPR()); cv.height = Math.round(r.height * DPR());
    field = C.membraneAmplitude(3, 5, 40, 96); sand = new C.Sand(2600, { seed: 9 });
    if (still()) { for (let i = 0; i < 260; i++) sand.step(field); draw(); return; }
    let n = 0;
    off = clock(() => { for (let k = 0; k < 3; k++) sand.step(field); draw(); if (++n > 120) { off?.(); off = null; } });
  };
  dlg.addEventListener("toggle", settle);
  if (dlg.open) settle();   // the opening that fetched this file
}

export async function dress(dlg) {
  const res = await Promise.allSettled([letter(dlg), sandMenu(dlg)]);
  res.forEach((r) => r.status === "rejected" && console.warn("organic: part of the menu's dressing did not load; the words stay", r.reason));
}
