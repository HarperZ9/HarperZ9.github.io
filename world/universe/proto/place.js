// A place, opened on its own (a link from the floor, a static page or a search result). The same form as a
// place entered from the map: the page itself fills the stage, its threads sit on the card beside it, the
// survey band in the hand marks where the visitor stands, and the seam from the last place plays on arrival.
import { load, seamFor, trail } from "../lib/data.js";
import { here } from "../lib/here.js";
import { card } from "../lib/card.js";
import { build } from "../lib/room.js";
import { play } from "../lib/seams.js";

const q = new URLSearchParams(location.search);
const go = (url) => { location.href = url; };

async function main() {
  const u = await load(), n = u.byId.get(q.get("n")) || u.byId.get("flywheel"), from = u.byId.get(q.get("from"));
  document.title = `${n.title} | Zain Dana Harper`;
  document.getElementById("place-h").textContent = n.title;
  trail.push(n.id);

  // the room: its own page in the stage, opened, with the seam canvas over it
  const stage = document.getElementById("stage"), room = build(n);
  room.classList.add("open"); room.style.opacity = "1"; room.style.clipPath = "none";
  stage.append(room);

  // the card: the place's threads; a thread opens the next place here, with its seam
  card(u, n, { enter: false, onDrift: (to) => go(`place.html?n=${encodeURIComponent(to)}&from=${encodeURIComponent(n.id)}`) });

  // the band: this place's tile white; a tile travels into the map at that place
  const band = document.querySelector('[data-o="band"]');
  if (band) {
    const b = here(band, u, { owner: "map", onPick: (id) => go(`index.html?n=${encodeURIComponent(id)}`), onWhole: () => go(`index.html?n=${encodeURIComponent(n.id)}`) });
    if (n.featured) b.focus(n.id); else b.focus(null);
  }
  document.getElementById("back")?.addEventListener("click", () => history.length > 1 ? history.back() : go(`index.html?n=${encodeURIComponent(n.id)}`));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input,textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "i") go("floor.html");
    if (e.key === "Escape") go(`index.html?n=${encodeURIComponent(n.id)}`);
  });
  const say = document.getElementById("say"); say.textContent = `${n.title}.${from ? ` From ${from.title}.` : ""}`;

  const cv = room.querySelector(".room-seam"), id = seamFor(from, n, u), hold = q.has("hold") ? Number(q.get("hold")) : null;
  if (from && id !== "fade") { cv.hidden = false; cv.style.opacity = "1"; await play(cv, id, { from, to: n, u, hold }); }
  document.documentElement.classList.add("ready");
}
main().catch((e) => { console.error("place: failed to start", e); });
