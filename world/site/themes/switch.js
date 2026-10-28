// switch.js: the worlds in the hand. One button per world, in the header where the strip of stop squares used to
// be; pressing one shows that world at once and remembers the choice. The light/dark lamp stays its own control: it
// picks the character, not the world. The arrival's loop follows the world (each world's arrival slot).
import { THEMES, byId, pickWorld, applyWorld, countVisit } from "/world/site/themes/registry.js";

function control(hand, current) {
  const group = document.createElement("div");
  group.className = "o-worlds"; group.setAttribute("role", "group"); group.setAttribute("aria-label", "World");
  for (const t of THEMES) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.world = t.id; b.textContent = t.name;
    b.setAttribute("aria-pressed", String(t.id === current));
    b.addEventListener("click", () => show(byId(t.id), true));
    group.append(b);
  }
  const at = hand.querySelector('[data-o="fold"]') || hand.querySelector('[data-o="lamp"]');
  hand.insertBefore(group, at);
  return group;
}

function arrival(theme) {
  const v = document.querySelector(".arrival video[data-loop]"), still = document.querySelector(".arrival-still");
  const src = theme.slots.arrival?.loop; if (!v || !src || v.dataset.src === src) return;
  v.pause(); v.dataset.src = src; delete v.dataset.filled; v.removeAttribute("poster"); v.innerHTML = "";
  if (still) { still.srcset = `${src}-poster-1280.webp 1280w, ${src}-poster-1920.webp 1920w`; still.src = `${src}-poster-1280.webp`; }
  document.dispatchEvent(new CustomEvent("loops:refill", { detail: v }));
}

let group = null;
function show(theme, remember) {
  applyWorld(theme, { remember });
  arrival(theme);
  for (const b of group?.querySelectorAll("button") || []) b.setAttribute("aria-pressed", String(b.dataset.world === theme.id));
}

const hand = document.querySelector("header.o-hand");
const { theme } = pickWorld();
countVisit();
if (hand) group = control(hand, theme.id);
show(theme, false);
