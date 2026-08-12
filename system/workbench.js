// workbench.js: the workshop's one handoff protocol. A piece that travels
// between surfaces carries its record: where it has been and as what. The
// legacy per-surface keys are still written on every send, so every existing
// receiver keeps working unchanged; the trail rides alongside in its own
// record and each surface shows and extends it. The summary is not the
// record; the piece carries the record.

const PIECE_KEY = "wb.piece.v1";
const TRAIL_CAP = 12;

export const SURFACES = {
  retro: { label: "Retro Engine", href: "retro.html?import=plate", legacyKey: "re.retro.handoff" },
  loom: { label: "The Loom", href: "loom.html?import=render", legacyKey: "re.loom.handoff" },
  studio: { label: "The Studio", href: "studio.html?source=plotmaps&import=retro", legacyKey: "re.studio.handoff" },
  // Display-only: the Gallery originates pieces but is not a send target.
  gallery: { label: "Gallery" },
};

// Pure trail arithmetic, node-testable.
export function extendTrail(trail, entry) {
  const t = Array.isArray(trail) ? trail.slice() : [];
  if (entry && entry.surface) t.push({ surface: String(entry.surface), label: String(entry.label || "").slice(0, 60) });
  return t.slice(-TRAIL_CAP);
}

export function trailLine(trail) {
  if (!Array.isArray(trail) || !trail.length) return "";
  return trail
    .map((e) => {
      const s = SURFACES[e.surface] ? SURFACES[e.surface].label : e.surface;
      return e.label ? s + " (" + e.label + ")" : s;
    })
    .join(" → ");
}

// The trail this page is carrying: seeded on receive, extended on send.
let _trail = [];
export function currentTrail() { return _trail.slice(); }

export function sendPiece(target, dataURL, entry, nav) {
  const t = SURFACES[target];
  if (!t || !t.legacyKey || !dataURL) return false;
  try { sessionStorage.setItem(t.legacyKey, dataURL); } catch (_) { return false; }
  const trail = extendTrail(_trail, entry);
  try { sessionStorage.setItem(PIECE_KEY, JSON.stringify({ trail, to: target, at: Date.now() })); } catch (_) {}
  if (nav !== false) location.href = t.href;
  return true;
}

// Read the piece record on arrival. Does not touch the legacy image key
// (each page's own receiver owns that). A record is one-shot and short-lived:
// whoever reads it next removes it, and only the addressed surface within
// the freshness window gets the trail; anything else is a stale leftover
// from a cancelled or failed handoff and must not stamp a later piece.
const PIECE_TTL_MS = 5 * 60 * 1000;
export function receiveTrail(surface) {
  let raw = null;
  try { raw = sessionStorage.getItem(PIECE_KEY); } catch (_) { return null; }
  if (!raw) return null;
  try { sessionStorage.removeItem(PIECE_KEY); } catch (_) {}
  let rec = null;
  try { rec = JSON.parse(raw); } catch (_) { rec = null; }
  if (!rec || rec.to !== surface || !Array.isArray(rec.trail)) return null;
  if (!rec.at || Date.now() - rec.at > PIECE_TTL_MS) return null;
  _trail = rec.trail.slice(-TRAIL_CAP);
  return { trail: currentTrail(), line: trailLine(_trail) };
}

// The workshop line: one quiet sentence under each instrument naming the
// whole span, with the surface you are on marked. Text only, no chrome.
export function mountFlow(el, current) {
  if (!el) return;
  const steps = [
    ["gallery", "Gallery"], ["retro", "Retro Engine"], ["loom", "The Loom"], ["studio", "The Studio"],
  ];
  const chain = steps
    .map(([k, label]) => (k === current ? "<b>" + label + "</b>" : label))
    .join(" ↔ ");
  el.innerHTML = "One workshop: plate · shader · sound → " + chain +
    " → print · cloth · score. A piece keeps its trail as it travels.";
}
