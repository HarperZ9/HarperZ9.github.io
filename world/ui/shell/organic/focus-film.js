// Focus rings in thin-film light, fetched by organic.js with the first focus ring the keyboard draws. The still
// colours in organic.css are this film at its resting thickness, so nothing changes when the file arrives.
import { root, still, load, clock } from "./gen-util.js";

// ---- focus rings in thin-film light. The film thickness drifts slowly while something has focus.
export async function focusFilm() {
  const { filmRgb8, hex } = await load("substrate/lib/thinfilm.mjs");
  let d = 420, off = null;
  const set = () => {
    root.style.setProperty("--o-film-a", hex(filmRgb8(d)));
    root.style.setProperty("--o-film-b", hex(filmRgb8(d + 140)));
  };
  set();
  const drift = () => { if (off || still()) return; off = clock((t) => { d = 380 + 160 * (0.5 + 0.5 * Math.sin(t * 0.7)); set(); }); };
  document.addEventListener("focusin", drift);
  if (document.activeElement && document.activeElement !== document.body) drift();   // the focus that fetched this file
  document.addEventListener("focusout", () => { setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) { off?.(); off = null; } }, 0); });
}
