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
  poster: { label: "Poster", href: "studio.html?source=poster&import=workbench", legacyKey: "re.poster.handoff" },
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
const TYPE_KEY = "wb.typography.v1";

// Editable typography is separate from image handoffs. Only these public
// typefaces and bounded numeric controls may cross into Poster.
export function validateTypography(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 260) return null;
  if (!["hanken", "conso"].includes(value.family)) return null;
  const bounds = { size: [18, 88], line: [0.9, 1.8], track: [-0.04, 0.12] };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) return null;
  }
  return { text: value.text, family: value.family, size: value.size, line: value.line, track: value.track };
}

export function sendTypography(value, nav = true) {
  const style = validateTypography(value);
  if (!style) return false;
  try { sessionStorage.setItem(TYPE_KEY, JSON.stringify({ version: 1, to: "poster", at: Date.now(), style })); }
  catch (_) { return false; }
  if (nav) location.href = "studio.html?source=poster&import=typography";
  return true;
}

export function receiveTypography() {
  try {
    const raw = sessionStorage.getItem(TYPE_KEY);
    sessionStorage.removeItem(TYPE_KEY);
    if (!raw || raw.length > 4096) return null;
    const record = JSON.parse(raw);
    if (record?.version !== 1 || record.to !== "poster" || !Number.isFinite(record.at)) return null;
    const age = Date.now() - record.at;
    if (age < 0 || age > PIECE_TTL_MS) return null;
    return validateTypography(record.style);
  } catch (_) { return null; }
}

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
    ["gallery", "Gallery"], ["retro", "Shader Room"], ["loom", "Loom"], ["studio", "Studio"],
  ];
  const chain = steps
    .map(([k, label]) => (k === current ? "<b>" + label + "</b>" : label))
    .join(" ↔ ");
  el.innerHTML = chain;
}
