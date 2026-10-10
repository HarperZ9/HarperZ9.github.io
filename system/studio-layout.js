// studio-layout.js: the stage gets the room (9 October 2026). The audit measured the stage at 29% of
// a 1440 x 900 window: the readings column, three rows of deck buttons and a two-line note under the
// plate took the rest. On a desktop now:
//   - The readings fold to a slim strip by default, with one button to open them, on every source
//     that makes a piece. Sources that check a claim (Physics, Showcase, BRender, Engine Revival,
//     RAW) open with them shown. Whatever the visitor chooses is kept in this browser and wins after.
//   - The deck's second and third rows stay behind "More controls" until the visitor opens it; every
//     export there is also in the Export menu.
// Nothing is removed: the readings, the rows and every control are one press away.

export const CHECKING_SOURCES = Object.freeze(["discovery", "showcase", "brender", "revival", "raw"]);
const KEY = "studio.layout.v1";

/** readingsOpen(source, pref) -> boolean. pref is "open", "closed" or null (no choice yet). */
export function readingsOpen(source, pref) {
  if (pref === "open") return true;
  if (pref === "closed") return false;
  return CHECKING_SOURCES.includes(source);
}

export function mountLayout({ app, panel, deckMore, getSource, storage, onChange = () => {} }) {
  const read = () => { try { const s = storage(); return s ? JSON.parse(s.getItem(KEY) || "{}") : {}; } catch (_) { return {}; } };
  const write = (v) => { try { const s = storage(); if (s) s.setItem(KEY, JSON.stringify({ ...read(), ...v })); } catch (_) {} };
  const desk = () => typeof matchMedia === "function" && matchMedia("(min-width: 900px)").matches;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "readings-toggle";
  toggle.className = "readings-toggle";
  toggle.setAttribute("aria-controls", panel.id);
  panel.prepend(toggle);

  function paint() {
    const open = !desk() || readingsOpen(getSource(), read().readings || null);
    const was = !app.classList.contains("readings-collapsed");
    app.classList.toggle("readings-collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide readings" : "Readings";
    toggle.title = open ? "Fold the readings to give the stage more room" : "Show what the frame measures";
    if (was !== open) onChange();
  }
  toggle.addEventListener("click", () => {
    write({ readings: app.classList.contains("readings-collapsed") ? "open" : "closed" });
    paint();
  });
  if (deckMore) {
    const pref = read().deck;
    deckMore.open = pref === "open";
    deckMore.addEventListener("toggle", () => write({ deck: deckMore.open ? "open" : "closed" }));
  }
  if (typeof matchMedia === "function") { const m = matchMedia("(min-width: 900px)"); if (m.addEventListener) m.addEventListener("change", paint); }
  paint();
  return { sourceChanged: paint };
}
