// session-archive.js: the whole session's generated work, published as one archive.
//
// The Current Story sequence is seventeen works chosen out of this body. Publishing only the
// chosen ones makes the choosing invisible, and the choosing is most of the authorship. So this
// page shows all of it: 165 works, singles and generated collages, in the order the archives
// list them.
//
// The page must stay cheap. 165 works at full size is 58MB, so the grid loads 420px thumbnails
// (4.5MB total, lazily) and the full copy is fetched only when a work is opened. Same discipline
// the sequence page uses, same reason.
//
// All 165 stay, and the page shows their range: every work carries a measurement taken off its
// own delivered pixels, the grid can be ordered by those measurements, and the range readout
// draws the whole span as one plot. A count proves how much there is; the range shows how far
// it goes.
//
// They are also material, not only pictures. Every work opens on the studio's pen surface through
// the same catalogue the studio uses, so a piece can be drawn by any of the eight image methods,
// blended with a generative field, replayed, and exported for a plotter.

// One definition of how a work is handed to the studio, shared by the surface that links and the
// boot path that receives, so the two cannot drift apart.
import { studioLink } from "./studio-library.js";

// Stamped for the same reason the sequence manifest is: force-cache plus no stamp means a
// returning visitor never sees a work added to the archive. Bumped when the manifest gained
// per-work measurements, without which the orderings below sort on undefined.
const MANIFEST = "art/session-archive/manifest.json?v=20260805-range";

async function loadManifest() {
  const r = await fetch(MANIFEST, { cache: "force-cache" });
  if (!r.ok) throw new Error(`${MANIFEST}: ${r.status}`);
  return r.json();
}

function buildDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "story-dialog arc-dialog";
  const body = document.createElement("div");
  body.className = "story-dialog-body";
  const img = document.createElement("img");
  img.className = "arc-dialog-img";
  img.alt = "";
  const bar = document.createElement("div");
  bar.className = "story-dialog-bar";
  const position = document.createElement("span");
  position.setAttribute("aria-live", "polite");
  const nav = document.createElement("nav");
  const prev = document.createElement("button");
  prev.type = "button"; prev.textContent = "←"; prev.setAttribute("aria-label", "Previous work");
  const next = document.createElement("button");
  next.type = "button"; next.textContent = "→"; next.setAttribute("aria-label", "Next work");
  // Every work here is material the studio can pick up: this link opens it on the pen surface as
  // a tone field, where it can be drawn by any of the eight methods, blended with a generative
  // field, replayed stroke by stroke, and exported as plotter-grade SVG or G-code.
  const draw = document.createElement("a");
  draw.className = "arc-draw";
  draw.textContent = "draw this";
  draw.setAttribute("aria-label", "Open this work on the studio pen surface");
  const close = document.createElement("button");
  close.type = "button"; close.textContent = "close"; close.setAttribute("aria-label", "Close");
  nav.append(prev, next, draw, close);
  bar.append(position, nav);
  const caption = document.createElement("p");
  caption.className = "story-dialog-alt";
  body.append(img, bar, caption);
  dialog.append(body);
  document.body.append(dialog);
  return { dialog, img, position, caption, prev, next, draw, close };
}

function measureLine(w) {
  const m = w.measure;
  if (!m) return "";
  return ` · ${m.tone}, ${m.family} · L* ${Math.round(m.lightness * 100)}%`;
}

function wireViewer() {
  const ui = buildDialog();
  // The viewer walks whatever order the grid is currently showing. Keeping it on archive order
  // would mean sorting by light and then arrowing into an unrelated work, which quietly
  // contradicts the ordering the visitor just chose.
  let seq = [];
  let at = 0;
  const show = (index) => {
    at = Math.max(0, Math.min(seq.length - 1, index));
    const w = seq[at];
    if (!w) return;
    // The thumbnail is already decoded, so it shows instantly while the full copy arrives.
    ui.img.src = w.thumb;
    const full = new Image();
    full.decoding = "async";
    full.onload = () => { if (seq[at] === w) ui.img.src = w.full; };
    full.src = w.full;
    ui.img.alt = w.title;
    ui.position.textContent = `${String(at + 1).padStart(3, "0")} of ${seq.length}`
      + ` · ${w.dimensions[0]}×${w.dimensions[1]}`
      + (w.kind === "collage" ? " · generated collage" : "")
      + measureLine(w);
    ui.caption.textContent = w.title + (w.also_published_as ? ` · also published as ${w.also_published_as}` : "");
    ui.draw.href = studioLink(w.id);
    ui.prev.disabled = at === 0;
    ui.next.disabled = at === seq.length - 1;
  };
  ui.prev.addEventListener("click", () => show(at - 1));
  ui.next.addEventListener("click", () => show(at + 1));
  ui.close.addEventListener("click", () => ui.dialog.close());
  ui.dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
  });
  ui.dialog.addEventListener("click", (e) => { if (e.target === ui.dialog) ui.dialog.close(); });
  return {
    setSequence(list) { seq = list; },
    open(index) { show(index); ui.dialog.showModal(); },
  };
}

// ── showing the range ───────────────────────────────────────────────────────
// A flat grid of 165 works in archive order proves the count and hides the span. These orderings
// make the span itself the thing you see: SPECTRUM sorts continuously by measured lightness, so
// the whole corpus reads as one gradient from near-black to luminous in a single screen. The
// grouped orderings band the same measurements into sections that carry their own counts, so a
// heading is a claim the grid underneath can be checked against.
const ORDERS = {
  archived: { label: "As archived", group: null, sort: (a, b) => a.i - b.i },
  spectrum: { label: "By light", group: null,
              sort: (a, b) => a.w.measure.lightness - b.w.measure.lightness },
  tone: { label: "By tone", group: (w) => w.measure.tone, order: ["dark", "mid", "luminous"],
          sort: (a, b) => a.w.measure.lightness - b.w.measure.lightness },
  colour: { label: "By colour", group: (w) => w.measure.family, order: ["monochrome", "warm", "cool"],
            sort: (a, b) => b.w.measure.chroma - a.w.measure.chroma },
  kind: { label: "By kind", group: (w) => w.kind, order: ["single", "collage"],
          sort: (a, b) => a.i - b.i },
};

const HEADINGS = {
  dark: "Dark", mid: "Mid", luminous: "Luminous",
  monochrome: "Monochrome", warm: "Warm", cool: "Cool",
  single: "Single works", collage: "Generated collages",
};

function cellFor(w, position, total, viewer) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "arc-cell" + (w.kind === "collage" ? " is-collage" : "");
  b.setAttribute("aria-label", `Open work ${position + 1} of ${total}: ${w.title}`);
  const im = document.createElement("img");
  im.src = w.thumb;
  im.alt = "";
  im.loading = "lazy";          // 165 thumbnails must not all arrive at once
  im.decoding = "async";
  im.width = w.thumb_dimensions[0];
  im.height = w.thumb_dimensions[1];
  b.append(im);
  b.addEventListener("click", () => viewer.open(position));
  return b;
}

// Returns the works in the order they are now on screen, so the viewer can walk that order.
function layout(target, works, viewer, key) {
  const spec = ORDERS[key] || ORDERS.archived;
  const items = works.map((w, i) => ({ w, i })).sort(spec.sort);
  const frag = document.createDocumentFragment();
  const shown = [];
  const total = items.length;
  const gridOf = (list) => {
    const grid = document.createElement("div");
    grid.className = "arc-grid";
    for (const it of list) {
      grid.append(cellFor(it.w, shown.length, total, viewer));
      shown.push(it.w);
    }
    return grid;
  };
  if (!spec.group) {
    frag.append(gridOf(items));
  } else {
    const buckets = new Map();
    for (const it of items) {
      const k = spec.group(it.w);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(it);
    }
    const keys = (spec.order || []).filter((k) => buckets.has(k))
      .concat([...buckets.keys()].filter((k) => !(spec.order || []).includes(k)));
    for (const k of keys) {
      const h = document.createElement("h3");
      h.className = "arc-band";
      // The count is part of the heading because a band heading is a claim, and the grid under
      // it is the evidence. "Dark · 55" can be counted.
      h.textContent = `${HEADINGS[k] || k} · ${buckets.get(k).length}`;
      frag.append(h, gridOf(buckets.get(k)));
    }
  }
  target.replaceChildren(frag);
  viewer.setSequence(shown);
}

// L* back to an sRGB grey, so a bar is painted the value it reports rather than a value chosen
// to look right. Same inverse the measuring script's forward pass used.
function greyFor(lstar) {
  const L = lstar * 100;
  const y = L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3;
  const s = y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055;
  const v = Math.round(Math.max(0, Math.min(1, s)) * 255);
  return `rgb(${v},${v},${v})`;
}

const SVGNS = "http://www.w3.org/2000/svg";

// The range, drawn. Every work is one column, sorted by measured lightness and painted the grey
// it measures, so the strip reads left to right as the corpus's own span from near-black to
// near-white. The line over it is the same values as a curve, which is where the corpus sits
// inside that span: it stays low for two thirds of the width because this body of work is dark.
// The two hairlines are where the dark and luminous bands actually cut.
function ribbon(works, r) {
  const sorted = works.filter((w) => w.measure)
    .slice().sort((a, b) => a.measure.lightness - b.measure.lightness);
  if (!sorted.length) return null;
  const n = sorted.length;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${n} 100`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "arc-ribbon");
  svg.setAttribute("role", "img");
  const pc = (v) => Math.round(v * 100);
  svg.setAttribute("aria-label",
    `${n} works sorted by measured lightness, from ${pc(r.lightness.min)}% to `
    + `${pc(r.lightness.max)}% of white, median ${pc(r.lightness.median)}%.`);
  const points = [];
  for (let i = 0; i < n; i += 1) {
    const l = sorted[i].measure.lightness;
    const col = document.createElementNS(SVGNS, "rect");
    col.setAttribute("x", String(i));
    col.setAttribute("y", "0");
    // Columns overlap by a hundredth so no ground shows through between them at any width.
    col.setAttribute("width", "1.01");
    col.setAttribute("height", "100");
    col.setAttribute("fill", greyFor(l));
    svg.append(col);
    points.push(`${i + 0.5},${(100 - Math.max(1, l * 100)).toFixed(2)}`);
  }
  // The curve crosses greys from near-black to near-white, so no single stroke colour reads the
  // whole way across. A dark halo under a light line does, without tinting the measurement.
  for (const cls of ["arc-ribbon-halo", "arc-ribbon-curve"]) {
    const curve = document.createElementNS(SVGNS, "polyline");
    curve.setAttribute("points", points.join(" "));
    curve.setAttribute("class", cls);
    svg.append(curve);
  }
  // Band cuts, placed where the counts say they are rather than at a drawn-in third.
  let cut = 0;
  for (const key of ["dark", "mid"]) {
    cut += r.tone_counts[key] || 0;
    if (cut <= 0 || cut >= n) continue;
    const line = document.createElementNS(SVGNS, "line");
    line.setAttribute("x1", String(cut)); line.setAttribute("x2", String(cut));
    line.setAttribute("y1", "0"); line.setAttribute("y2", "100");
    line.setAttribute("class", "arc-ribbon-cut");
    svg.append(line);
  }
  return svg;
}

function renderRange(host, m) {
  const r = m.range;
  if (!r) return false;
  const pc = (v) => Math.round(v * 100);
  const frag = document.createDocumentFragment();
  const plot = ribbon(m.works || [], r);
  if (plot) frag.append(plot);

  const scale = document.createElement("p");
  scale.className = "arc-scale";
  for (const [k, v] of [["darkest", `${pc(r.lightness.min)}%`],
                        ["median", `${pc(r.lightness.median)}%`],
                        ["lightest", `${pc(r.lightness.max)}%`]]) {
    const s = document.createElement("span");
    const b = document.createElement("b");
    b.textContent = v;
    s.append(`${k} `, b);
    scale.append(s);
  }
  frag.append(scale);

  const line = document.createElement("p");
  line.className = "arc-figures";
  line.textContent =
    `lightness ${pc(r.lightness.min)}% to ${pc(r.lightness.max)}% of white, median ${pc(r.lightness.median)}%`
    + ` · chroma ${r.chroma.min} to ${r.chroma.max}, median ${r.chroma.median}`
    + ` · ${r.tone_counts.dark} dark, ${r.tone_counts.mid} mid, ${r.tone_counts.luminous} luminous`
    + ` · ${r.family_counts.monochrome} monochrome, ${r.family_counts.warm} warm, ${r.family_counts.cool} cool`;
  frag.append(line);

  if (r.method) {
    const method = document.createElement("p");
    method.className = "arc-method";
    method.textContent = r.method;
    frag.append(method);
  }
  host.replaceChildren(frag);
  return true;
}

async function render(root) {
  // The status line lives in the page frame, above the section root, so it is looked up on
  // the document rather than inside the root that owns the grid.
  const status = document.querySelector("[data-archive-status]");
  const target = root.querySelector("[data-archive-grid]");
  if (!target) return;
  try {
    const m = await loadManifest();
    const works = m.works || [];
    const viewer = wireViewer();

    const controls = document.querySelector("[data-archive-order]");
    let current = "archived";
    if (controls) {
      controls.replaceChildren(...Object.entries(ORDERS).map(([key, spec]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (key === current ? " active" : "");
        b.textContent = spec.label;
        b.setAttribute("aria-pressed", String(key === current));
        b.addEventListener("click", () => {
          current = key;
          for (const other of controls.children) {
            const on = other === b;
            other.classList.toggle("active", on);
            other.setAttribute("aria-pressed", String(on));
          }
          layout(target, works, viewer, key);
        });
        return b;
      }));
      controls.hidden = false;
    }
    layout(target, works, viewer, current);
    target.hidden = false;

    const range = document.querySelector("[data-archive-range]");
    if (range && renderRange(range, m)) range.hidden = false;
    if (status) {
      status.textContent = `${m.counts.works} works · ${m.counts.singles} singles, `
        + `${m.counts.collages} generated collages`
        + (m.counts.excluded ? ` · ${m.counts.excluded} excluded, and said so` : "");
    }
    root.dataset.archiveReady = "true";
  } catch (e) {
    if (status) status.textContent = "The archive could not be loaded. The manifest remains available.";
    console.error(e);
  }
}

for (const root of document.querySelectorAll("[data-session-archive]")) render(root);
