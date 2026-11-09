// Navigation as one system: scrolling, keys, history and announcements all move the same camera along the
// same tour. The tour is a chain of real threads through the seven places (twin, then shared motifs):
// Flywheel, The test that wasn't, The False Balance, Powers of Ten for a Lie, Four labels,
// Manufactured consensus, Palimpsest. Position tau runs from -1 (the whole map) to 6 (the last place).
// Scrolling moves tau one to one with the wheel's own pixels, so the platform's speed and momentum carry it;
// nothing snaps and nothing traps: back, forward, Escape and the index always work.
const TOUR = ["flywheel", "test", "balance", "powers", "labels", "crowd", "palimpsest"];
const PX_PER_PLACE = 520;  // wheel pixels between two places: about one long trackpad flick

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
  cam.onScroll = (dy) => {
    if (document.querySelector(".room-layer:not(.standby)")) return;  // inside a place, the page scrolls itself
    const tau = (S.tau = Math.min(N - 1, Math.max(-1, S.tau + dy / PX_PER_PLACE)));
    const p = placeAt(tau); cam.x = p.x; cam.y = p.y; cam.k = p.k; cam.clamp();
    here.progress((tau + 1) / N); S.onCam?.();
    const near = Math.round(tau), d = Math.abs(tau - near);
    const id = near >= 0 && d < 0.22 ? tour[near] : null;
    if (id !== last) {
      last = id;
      if (id) { quietFocus(id); history.replaceState({ n: id }, "", `?n=${encodeURIComponent(id)}`); announce(where(id)); }
      else if (tau < -0.5) { unfocus(); history.replaceState({}, "", location.pathname); announce(`The whole map. ${N} places.`); }
      else unfocus();
    }
    S.dirty = true;
  };

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
    if (k === "PageDown" || k === "j" || (k === " " && !e.shiftKey && !e.target.closest("button,a"))) { e.preventDefault(); go(cur() + 1); }
    else if (k === "PageUp" || k === "k" || (k === " " && e.shiftKey)) { e.preventDefault(); if (cur() <= 0) { unfocus(); cam.fitAll(); announce(`The whole map. ${N} places.`); } else go(cur() - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(N - 1); }
    else if (/^[1-9]$/.test(k) && +k <= N) { e.preventDefault(); go(+k - 1); }
  });
  return { tour, go };
}
