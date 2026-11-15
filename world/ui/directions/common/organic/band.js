// The survey band, fetched by organic.js only where its host is shown.
import { workspaceRoot } from "./root.js";

// The survey band (the universe agent's "we are here", proto/here.js, reading universe.json): one system with
// the map. The host is a real link to the map; a tile travels into the map at that place. Pages outside the
// universe show no white tile.
async function band(host) {
  const base = workspaceRoot() + "universe/";
  const [{ here }, u] = await Promise.all([import(base + "proto/here.js"), fetch(base + "universe.json").then((r) => { if (!r.ok) throw new Error("universe.json " + r.status); return r.json(); })]);
  const map = host.getAttribute("href");
  const b = here(host, u, { onPick: (id) => { location.href = map + "?n=" + encodeURIComponent(id); }, onWhole: () => { location.href = map; } });
  host.addEventListener("click", (e) => e.preventDefault());
  const at = host.dataset.place; if (at) b.focus(at); else b.at({});
}

export function initBands(hosts) {
  hosts.forEach((h) => band(h).catch((e) => console.warn("organic: survey band not loaded; the map link stays", e)));
}
