// The universe as data: load universe.json once, index it, answer neighbour and search questions.
// Paths in universe.json are relative to mission-control; ROOT turns them into URLs from this folder.
import { WORLD } from "./camera.js";
export const ROOT = new URL("../../", import.meta.url).href;
export const SITE = "/";

let U = null;
export async function load() {
  if (U) return U;
  const r = await fetch(new URL("../universe.json", import.meta.url));
  if (!r.ok) throw new Error(`universe.json: HTTP ${r.status}`);
  U = await r.json();
  // A tall screen gets the constellation turned on its side, so it fills the phone instead of a strip.
  U.portrait = matchMedia("(orientation: portrait)").matches;
  if (U.portrait) {
    for (const n of U.nodes) [n.x, n.y] = [n.y, n.x];
    for (const r of U.regions) r.anchor = [r.anchor[1], r.anchor[0]];
    WORLD.w = 1000; WORLD.h = 1600;
  }
  U.byId = new Map(U.nodes.map((n) => [n.id, n]));
  U.region = new Map(U.regions.map((r) => [r.id, r]));
  U.adj = new Map(U.nodes.map((n) => [n.id, []]));
  for (const e of U.edges) { U.adj.get(e.a).push(e); U.adj.get(e.b).push(e); }
  U.thread = new Map(U.threads.map((t) => [t.id, t]));
  return U;
}

export const other = (e, id) => (e.a === id ? e.b : e.a);

// Threads out of a node, strongest kinds first, one line per neighbour and kind.
const RANK = { twin: 0, question: 1, motif: 2, symbol: 3, literary: 4, material: 5, "same-source": 6, cites: 7, series: 8 };
export function threadsOut(u, id) {
  const seen = new Set();
  return u.adj.get(id).slice().sort((a, b) => RANK[a.type] - RANK[b.type])
    .filter((e) => { const k = e.type + other(e, id); if (seen.has(k)) return false; seen.add(k); return true; });
}

// Places in the same region, nearest first: every place has a way onward even with no thread yet.
export function neighbours(u, id, k = 4) {
  const n = u.byId.get(id);
  return u.nodes.filter((m) => m.id !== id && m.region === n.region)
    .sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y)).slice(0, k);
}

export function landURL(n) {
  if (n.land) return ROOT + n.land;
  return null;
}
export function liveURL(n) {
  if (!n.href) return null;
  return /^https?:/.test(n.href) ? n.href : SITE + n.href;
}

// Search by title, by thread label (motif, material, symbol, source, literary work) or by region name.
export function search(u, q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const t of u.threads) if (t.label.toLowerCase().includes(q)) out.push({ kind: "thread", t });
  for (const n of u.nodes) if (n.title.toLowerCase().includes(q)) out.push({ kind: "node", n });
  for (const r of u.regions) if (r.name.toLowerCase().includes(q)) out.push({ kind: "region", r });
  return out.slice(0, 24);
}

// Which seam carries a visitor from one place to another: one rule, in seam-cores.mjs.
import { seamFor as rule } from "./seam-cores.mjs";
export function linkBetween(u, a, b) { return (u.featured_links || []).find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || (u.adj?.get(a) || []).find((e) => e.a === b || e.b === b) || null; }
export function seamFor(from, to, u = null) { return rule(from, to, u && from && to ? linkBetween(u, from.id, to.id) : null); }

// The visitor's trail: a per-tab convenience, so Back always has somewhere to go.
const KEY = "universe-trail";
export const trail = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; } },
  push(id) { const t = trail.get(); if (t[t.length - 1] !== id) t.push(id); trail.set(t.slice(-40)); },
  pop() { const t = trail.get(); t.pop(); trail.set(t); return t[t.length - 1] || null; },
  set(t) { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage blocked: the trail lives for this page only */ } },
};
