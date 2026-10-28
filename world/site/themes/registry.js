// registry.js: the site's themes. No single look holds the site: it moves between whole worlds, each with its own
// palette, type, motion, sound and content, and each with two characters, light and dark, that are different people
// rather than one design in two colour schemes. The site picks a world by the visitor's own choice first, then a
// link's ?world=, then the hour (night belongs to the night garden), then the visit (each return shows the next
// world). Weather is a signal slot: a provider may set it (signals.weather = "rain"), and nothing here asks the
// visitor's location for it.
//
// A theme's tokens are CSS (themes.css, keyed by data-world and data-character on <html>), so a switch is one
// attribute change and costs a style recalculation, not a frame. Its heavy assets live in slots that load only when
// the theme is shown: slot modules are imported on first use and unmounted on leaving.
//
//   import { THEMES, pickWorld, applyWorld } from "/world/site/themes/registry.js";
//   THEMES[i] = { id, name, characters: { light, dark }, type, motion, sound, slots, when }
//   slots: { arrival: { loop }, ambient: { module }, score: { src } }; a module exports mount(host, ctx) -> unmount

export const THEMES = Object.freeze([
  {
    id: "night-garden", name: "Night garden",
    characters: { light: "Dusk after rain", dark: "Streetlight" },
    type: { display: "Accession Burin", text: "Hanken Grotesk", mono: "Conso" },
    motion: { tempo: 0.8, ease: "ease-film", grain: "rain" },
    sound: { score: null },
    slots: { arrival: { loop: "/media/world/name-art/glass-tubes" }, ambient: { module: null }, score: { src: null } },
    when: { hours: [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5], weather: ["rain", "drizzle", "fog"] },
  },
  {
    id: "newsprint", name: "Newsprint",
    characters: { light: "Morning edition", dark: "Underground press" },
    type: { display: "Accession Super", text: "Accession Text", mono: "Accession Mono" },
    motion: { tempo: 1.4, ease: "ease-spring", grain: "halftone" },
    sound: { score: null },
    slots: { arrival: { loop: "/media/world/name-art/deco-arc" }, ambient: { module: null }, score: { src: null } },
    when: { hours: [], weather: [] },
  },
  {
    id: "instrument", name: "Instrument",
    characters: { light: "Bench", dark: "Scope" },
    type: { display: "Accession Divisumma", text: "Hanken Grotesk", mono: "Accession Mono" },
    motion: { tempo: 1, ease: "ease-standard", grain: "grid" },
    sound: { score: null },
    slots: { arrival: { loop: "/media/world/name-art/monogram-orb" }, ambient: { module: null }, score: { src: null } },
    when: { hours: [], weather: ["clear"] },
  },
]);

export const signals = { weather: null };
const KEY = "world-theme", VISITS = "world-visits";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: the choice lasts this visit */ } },
};
export const byId = (id) => THEMES.find((t) => t.id === id) || null;

// the world for this visit, and why it was chosen
export function pickWorld({ now = new Date(), search = location.search } = {}) {
  const chosen = byId(store.get(KEY));
  if (chosen) return { theme: chosen, by: "choice" };
  const linked = byId(new URLSearchParams(search).get("world"));
  if (linked) return { theme: linked, by: "link" };
  const weather = signals.weather && THEMES.find((t) => t.when.weather.includes(signals.weather));
  if (weather) return { theme: weather, by: "weather" };
  const night = THEMES.find((t) => t.when.hours.includes(now.getHours()));
  if (night) return { theme: night, by: "hour" };
  const n = Number(store.get(VISITS) || 0);
  return { theme: THEMES[n % THEMES.length], by: "visit" };
}

export function countVisit() {
  try { if (sessionStorage.getItem(VISITS)) return; sessionStorage.setItem(VISITS, "1"); } catch (e) { return; }
  store.set(VISITS, String(Number(store.get(VISITS) || 0) + 1));
}

const mounted = new Map();
// show a world: tokens at once, slot modules after; remember it only when the visitor chose it
export async function applyWorld(theme, { remember = false, host = document } = {}) {
  const root = document.documentElement;
  root.dataset.world = theme.id;
  if (remember) store.set(KEY, theme.id);
  for (const [id, off] of mounted) if (id !== theme.id) { try { off?.(); } catch (e) { console.warn("theme: unmount failed", id, e); } mounted.delete(id); }
  document.dispatchEvent(new CustomEvent("world:change", { detail: theme }));
  const mod = theme.slots.ambient?.module;
  if (!mod || mounted.has(theme.id)) return;
  try { const m = await import(mod); mounted.set(theme.id, m.mount?.(host, { theme, signals }) || null); }
  catch (e) { console.error("theme: the ambient slot did not load; the world shows its tokens only", theme.id, e); }
}

export function forget() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } }
