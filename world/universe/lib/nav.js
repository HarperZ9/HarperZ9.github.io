// Navigation as one system: scrolling, keys, history and announcements all move the same camera along the
// same tour. The tour is a chain of real threads through the seven places (twin, then shared motifs):
// Flywheel, The test that wasn't, The False Balance, Powers of Ten for a Lie, Four labels,
// Manufactured consensus, Palimpsest. Position tau runs from -1 (the whole map) to 6 (the last place).
// The wheel is the page's own scroll and never moves the tour (author, 2026-11-09: "yes" to native scroll). The tour
// moves by its keys (PageDown and PageUp, j and k, Space, Home, End, 1 to 7) and by the place list under the map;
// nothing snaps and nothing traps: back, forward, Escape and the index always work.
const TOUR = ["flywheel", "test", "balance", "powers", "labels", "crowd", "palimpsest"];

export function initNav({ u, cam, S, focus, unfocus, enter, leave, quietFocus, here, WORLD }) {
  const say = document.getElementById("say");
  const tour = TOUR.filter((id) => u.byId.get(id)?.featured);
  const N = tour.length;
  let last = null;
  S.tau = -1;
  const announce = (text) => { say.textContent = ""; requestAnimationFrame(() => { say.textContent = text; }); };
  const where = (id) => { const i = tour.indexOf(id); return `${u.byId.get(id).title}. Place ${i + 1} of ${N}.`; };
  S.announce = announce; S.where = where;

  // the camera at a tour position: between two places it rises a little, so travel shows the space between
  function placeAt(t) {
    const kF = cam.fit * 1.15;
    if (t <= 0) { const f = t + 1, a = u.byId.get(tour[0]); return { x: WORLD.w / 2 + (a.x - WORLD.w / 2) * f, y: WORLD.h / 2 + (a.y - WORLD.h / 2) * f, k: cam.fit + (kF - cam.fit) * f }; }
    const i = Math.min(N - 2, Math.floor(t)), f = t - i, a = u.byId.get(tour[i]), b = u.byId.get(tour[i + 1]);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, k: kF * (1 - 0.28 * Math.sin(Math.PI * f)) };
  }
  S.tourIndex = (id) => tour.indexOf(id);
  const go = (i) => {
    i = Math.max(0, Math.min(N - 1, i)); const from = S.focus, id = tour[i], onMap = document.activeElement?.classList?.contains("node"); last = id;
    // keyboard focus follows the move, so Enter acts on the place the visitor is now at
    if (onMap) document.querySelector(`.node[data-id="${id}"]`)?.focus({ preventScroll: true });
    focus(id, from && from !== id ? { via: true, fromId: from } : {});
  };
  const cur = () => (S.focus ? tour.indexOf(S.focus) : -1);
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input,textarea,select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const inside = !!document.querySelector(".room-layer:not(.standby)");
    if (inside && !["Escape", "Backspace", "i"].includes(e.key)) return;  // inside a place, its own keys and scrolling rule
    const k = e.key;
    // the page's own scroll keys move the tour only while the map has focus; elsewhere they scroll the page
    const onStage = !!e.target.closest?.("#stage");
    if (!onStage && ["PageDown", "PageUp", " ", "Home", "End"].includes(k)) return;
    if (k === "PageDown" || k === "j" || (k === " " && !e.shiftKey && !e.target.closest("button,a"))) { e.preventDefault(); go(cur() + 1); }
    else if (k === "PageUp" || k === "k" || (k === " " && e.shiftKey)) { e.preventDefault(); if (cur() <= 0) { unfocus(); cam.fitAll(); announce(`The whole map. ${N} places.`); } else go(cur() - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(N - 1); }
    else if (/^[1-9]$/.test(k) && +k <= N) { e.preventDefault(); go(+k - 1); }
  });
  // the place list: the tour as words under the map, each one a way to its place (keys and taps reach it too)
  const list = document.createElement("nav");
  list.className = "tour-list"; list.setAttribute("aria-label", "The tour");
  list.innerHTML = `<h2 class="tour-h">The tour</h2><ol>${tour.map((id, i) => `<li><button type="button" data-i="${i}"><span class="tour-n">${i + 1}</span> ${u.byId.get(id).title.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</button></li>`).join("")}</ol><p class="tour-keys">Keys: j and k, or 1 to ${N}; on the map, PageDown and PageUp too.</p>`;
  list.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) { document.getElementById("stage")?.scrollIntoView({ block: "start" }); go(+b.dataset.i); } });
  document.getElementById("main")?.after(list);
  return { tour, go };
}
