// studio-library.js: the published archive as studio material.
//
// The session archive publishes 165 works and measures every one of them. Those measurements were
// made so the archive page could show its range; they are just as useful as a way to reach into
// the corpus from the pen surface, which is why the picker filters on the same bands the archive
// page bands by. A work chosen here becomes a tone field like any other material: it can be drawn
// by any of the eight image methods, blended with a generative field, replayed stroke by stroke,
// pinned as a recipe, and exported as plotter-grade SVG or G-code.
//
// Kept as its own module, with no DOM and no fetch, so the catalogue logic is testable in node and
// so studio.js gains a seam rather than another few hundred lines.

// Version-stamped for the reason every manifest fetch on this site is: force-cache with no stamp
// pins a returning visitor to whatever they cached first.
export const LIBRARY_MANIFEST = "art/session-archive/manifest.json?v=20260805-range";

const ID = /^w\d{3}$/;

/**
 * buildLibrary(manifest) → { works, count, byId, bands, source }
 *
 * `works` keeps only what the studio needs to draw and to cite: where the pixels are, what the
 * work measures, and the hash of the PNG it came from. The hash travels with the material so a
 * sheet drawn from the archive can name its origin exactly rather than by title.
 */
export function buildLibrary(manifest) {
  const raw = (manifest && manifest.works) || [];
  const works = [];
  for (const w of raw) {
    if (!w || !ID.test(String(w.id || "")) || !w.full || !w.measure) continue;
    works.push({
      id: w.id,
      title: String(w.title || w.id),
      kind: w.kind === "collage" ? "collage" : "single",
      full: w.full,
      thumb: w.thumb || w.full,
      dimensions: Array.isArray(w.dimensions) ? w.dimensions.slice(0, 2) : null,
      tone: w.measure.tone,
      family: w.measure.family,
      lightness: w.measure.lightness,
      chroma: w.measure.chroma,
      // Provenance, carried so the receipt can cite the source file rather than a title someone
      // could rename. Truncated at the point of use, never here.
      sha: (w.source_asset && w.source_asset.png_sha256) || null,
      alsoPublishedAs: w.also_published_as || null,
    });
  }
  const index = new Map(works.map((w) => [w.id, w]));
  return {
    works,
    count: works.length,
    byId: (id) => index.get(String(id)) || null,
    bands: (manifest && manifest.range) || null,
    source: (manifest && manifest.title) || "Session archive",
  };
}

// The filter set is the archive page's own bands, so the two surfaces group the corpus the same
// way. A filter that would show nothing is not offered.
export const LIBRARY_FILTERS = Object.freeze([
  { key: "all", label: "All", match: () => true },
  { key: "dark", label: "Dark", match: (w) => w.tone === "dark" },
  { key: "mid", label: "Mid", match: (w) => w.tone === "mid" },
  { key: "luminous", label: "Luminous", match: (w) => w.tone === "luminous" },
  { key: "monochrome", label: "Monochrome", match: (w) => w.family === "monochrome" },
  { key: "warm", label: "Warm", match: (w) => w.family === "warm" },
  { key: "cool", label: "Cool", match: (w) => w.family === "cool" },
  { key: "collage", label: "Collages", match: (w) => w.kind === "collage" },
]);

export function filterWorks(works, key) {
  const f = LIBRARY_FILTERS.find((x) => x.key === key) || LIBRARY_FILTERS[0];
  return works.filter(f.match);
}

/** Counts per filter, so a picker can say how many a band holds before it is chosen. */
export function filterCounts(works) {
  const out = {};
  for (const f of LIBRARY_FILTERS) out[f.key] = works.filter(f.match).length;
  return out;
}

/** What the picker shows: position, title, and the two measurements the filters band on. */
export function workLabel(work, position) {
  const n = position == null ? work.id.slice(1) : String(position).padStart(3, "0");
  return `${n} · ${work.title} · ${work.tone}, ${work.family}`;
}

/** What a receipt says the sheet was drawn from. The id is stable; the title is not. */
export function workProvenance(work) {
  return `${work.title} (archive ${work.id}${work.sha ? `, source ${work.sha.slice(0, 12)}` : ""})`;
}

/**
 * The link any other surface uses to open a work on the pen surface. The archive page puts this
 * on every work, which is the whole point of the catalogue: a piece is not only something to look
 * at, it is material the studio can pick up.
 */
export function studioLink(id, opts = {}) {
  if (!ID.test(String(id))) return null;
  const q = new URLSearchParams({ source: "plotmaps", material: "archive", work: String(id) });
  if (opts.method) q.set("method", String(opts.method));
  return `studio.html?${q.toString()}`;
}

/**
 * The other end of that link. Returns null unless the request is a well-formed archive request,
 * so a hand-edited URL cannot push the pen surface into a material with no work behind it.
 */
export function parseStudioLink(search) {
  const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  if (q.get("material") !== "archive") return null;
  const work = q.get("work") || "";
  if (!ID.test(work)) return null;
  const method = q.get("method");
  return { material: "archive", work, method: method || null };
}
