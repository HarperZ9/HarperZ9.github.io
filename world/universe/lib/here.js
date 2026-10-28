// "We are here", as a survey band (feed-test-25): one tile per featured place, in the measured Bauhaus set,
// a tick under each, and the visitor's tile left white, the one cell that is marked (after Tegmark's chart).
// When a place is in focus, each other tile carries a numeral: how many real threads it shares with that place.
// Clicking the band returns to the whole map.
//
// One band per host, whoever asks first. The shell's hand (organic.js) and the universe map (map.js) both call
// here() on the same element; the second call gets the same band. A caller passing owner: "map" takes over the
// callbacks, so on the map a tile moves the camera instead of reloading the page.
const NS = "http://www.w3.org/2000/svg";
const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.append(e); return e; };
const PRIMARY = ["#c8322b", "#d79e35", "#1d2562", "#151314"];

export function here(host, u, { onWhole, onPick, owner = "page", tiles = null } = {}) {
  let held = host.__here;
  // the road brings its own tiles (one per stop); it replaces a band the shell drew first
  if (held && tiles && owner === "map" && held.kind !== "custom") { held.cb.onPick = held.cb.onWhole = null; host.querySelector("svg.here-band")?.remove(); host.__here = held = null; }
  if (held) {
    if (owner === "map" || held.owner !== "map") { Object.assign(held.cb, { onWhole, onPick }); held.owner = owner; return held.ctrl; }
    return { view() {}, at() {}, trail() {}, focus() {}, progress() {} };  // the map owns this band; others only watch
  }
  const cb = { onWhole, onPick };
  const custom = !!tiles, F = custom ? tiles.map((t) => ({ id: t.id, x: 0, y: 0, featured: true, fill: t.fill, num: t.num ?? "" })) : u.nodes.filter((n) => n.featured), T = 18, G = 3, W = F.length * (T + G) - G, H = 40;  // SVG units are CSS px, so the numerals are real 12 px type
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "here-band", "aria-hidden": "true", focusable: "false" }, host);
  const cells = F.map((n, i) => {
    const x = i * (T + G);
    const fill = n.fill || PRIMARY[i % 4];
    const r = el("rect", { x, y: 0, width: T, height: T, fill, class: "here-tile", "data-i": i }, svg);
    el("rect", { x: x + T / 2 - 0.5, y: T + 1, width: 1, height: i % 2 ? 3 : 5, class: "here-tick" }, svg);
    const num = el("text", { x: x + T / 2, y: H - 1, "text-anchor": "middle", class: "here-num" }, svg);
    return { n, r, num, fill };
  });
  // the progress cue: a rule under the tiles that fills as the visitor travels the tour
  const bar = el("rect", { x: 0, y: T + 7, width: 0, height: 2, class: "here-bar" }, svg);
  // a tile is a place: pressing it travels there; pressing the band's edge returns to the whole map
  host.addEventListener("click", (e) => { const i = e.target.dataset?.i; if (i != null && cb.onPick) { e.preventDefault(); cb.onPick(F[+i].id); } else if (cb.onWhole) { e.preventDefault(); cb.onWhole(); } });
  const mark = (id) => {
    const links = id && !custom ? u.featured_links.filter((l) => l.a === id || l.b === id) : [];
    for (const t of cells) {
      const on = t.n.id === id;
      t.r.setAttribute("fill", on ? "#ffffff" : t.fill); t.r.classList.toggle("on", on);
      const l = links.find((k) => k.a === t.n.id || k.b === t.n.id);
      t.num.textContent = custom ? (on ? "" : String(t.n.num)) : l ? String(l.threads.length + l.edges.length) : "";
    }
  };
  const ctrl = {
    view(x0, y0, x1, y1) {  // the tile nearest the centre of the view is where the visitor stands
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let best = null, bd = Infinity; for (const t of cells) { const d = Math.hypot(t.n.x - cx, t.n.y - cy); if (d < bd) { bd = d; best = t.n.id; } }
      mark(best);
    },
    at(n) { mark(n.featured ? n.id : null); },
    trail() {},
    focus(id) { mark(id); },
    progress(f) { bar.setAttribute("width", String(Math.max(0, Math.min(1, f)) * W)); },
  };
  host.__here = { ctrl, owner, cb, kind: custom ? "custom" : "places" };
  return ctrl;
}
