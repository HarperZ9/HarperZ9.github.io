// pointer.js: the drawn pointer, a stylus of measured materials (world/ui/shell/pointer/, made by
// scripts/build-pointer.cjs). The shell fetches this file only for a mouse or trackpad outside forced colours.
//
// The pointer itself is a native cursor image chosen by pointer.css, so the operating system moves it with no lag and
// this file never runs on a move to place it. This file only:
//   - sets html.ptr, which pointer.css needs, unless the visitor turned the drawn pointer off (kept in localStorage
//     as ui-pointer, the way Plain view keeps ui-plain). Plain view is honoured by pointer.css itself;
//   - adds the switch "Drawn pointer" to the foot of the Places menu;
//   - marks the Sky setting on the root (data-ptr-sky), so the sky's materials apply while Sky is on;
//   - runs the glow, an optional light under the nib on its own compositor layer. It moves by transform only, in one
//     animation frame per move, and is off under reduced motion, in Plain view, with Motion off, and with the
//     pointer off.
const root = document.documentElement;
const KEY = "ui-pointer";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: the choice lasts this visit */ } },
};
const fine = matchMedia("(pointer: fine)"), forced = matchMedia("(forced-colors: active)"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
const on = () => store.get(KEY) !== "off";

let link = null;
function sheet() {
  if (link) return;
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./pointer/pointer.css", import.meta.url).href;
  document.head.append(link);
}

// the glow: one fixed element; a move stores the place, the next frame writes one transform
let glow = null, x = -99, y = -99, frame = 0;
const glowWanted = () => root.classList.contains("ptr") && !reduced.matches && !root.classList.contains("plain") && !root.classList.contains("alive-still");
const place = () => { frame = 0; if (glow) glow.style.transform = `translate3d(${x}px,${y}px,0)`; };
const move = (e) => { if (e.pointerType !== "mouse") return; x = e.clientX; y = e.clientY; if (glow && !frame) frame = requestAnimationFrame(place); };
const leave = (e) => { if (!e.relatedTarget && glow) { x = y = -99; if (!frame) frame = requestAnimationFrame(place); } };
function syncGlow() {
  const want = glowWanted();
  if (want && !glow) {
    glow = document.createElement("div");
    glow.className = "ptr-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.append(glow);
    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseout", leave, { passive: true });
    place();
  } else if (!want && glow) {
    removeEventListener("pointermove", move);
    document.removeEventListener("mouseout", leave);
    glow.remove(); glow = null;
  }
}

const switches = [];
function apply() {
  const want = on() && fine.matches && !forced.matches;
  if (want) sheet();
  root.classList.toggle("ptr", want);
  for (const b of switches) b.setAttribute("aria-pressed", String(on()));
  syncGlow();
}

// the switch, in the foot of each Places menu
for (const foot of document.querySelectorAll("dialog[data-o='menu'] .o-menu-foot")) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "o-ptr"; b.textContent = "Drawn pointer";
  b.addEventListener("click", () => { store.set(KEY, on() ? "off" : "on"); apply(); });
  foot.insertBefore(b, foot.querySelector(".o-close"));
  switches.push(b);
}

// Sky: its control says whether it is on
const sky = document.querySelector('[data-o="sky"]');
const skySync = () => root.toggleAttribute("data-ptr-sky", sky?.getAttribute("aria-pressed") === "true");
if (sky) new MutationObserver(skySync).observe(sky, { attributes: true, attributeFilter: ["aria-pressed"] });
skySync();

// Plain view and Motion change classes on the root; the glow follows them
new MutationObserver(syncGlow).observe(root, { attributes: true, attributeFilter: ["class"] });
for (const m of [fine, forced]) m.addEventListener("change", apply);
reduced.addEventListener("change", syncGlow);
addEventListener("storage", (e) => { if (e.key === KEY) apply(); });
apply();
