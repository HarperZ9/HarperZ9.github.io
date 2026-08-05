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

const MANIFEST = "art/session-archive/manifest.json";

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
  const close = document.createElement("button");
  close.type = "button"; close.textContent = "close"; close.setAttribute("aria-label", "Close");
  nav.append(prev, next, close);
  bar.append(position, nav);
  const caption = document.createElement("p");
  caption.className = "story-dialog-alt";
  body.append(img, bar, caption);
  dialog.append(body);
  document.body.append(dialog);
  return { dialog, img, position, caption, prev, next, close };
}

function wireViewer(works) {
  const ui = buildDialog();
  let at = 0;
  const show = (index) => {
    at = Math.max(0, Math.min(works.length - 1, index));
    const w = works[at];
    // The thumbnail is already decoded, so it shows instantly while the full copy arrives.
    ui.img.src = w.thumb;
    const full = new Image();
    full.decoding = "async";
    full.onload = () => { if (works[at] === w) ui.img.src = w.full; };
    full.src = w.full;
    ui.img.alt = w.title;
    ui.position.textContent = `${String(at + 1).padStart(3, "0")} of ${works.length}`
      + ` · ${w.dimensions[0]}×${w.dimensions[1]}`
      + (w.kind === "collage" ? " · generated collage" : "");
    ui.caption.textContent = w.title + (w.also_published_as ? ` · also published as ${w.also_published_as}` : "");
    ui.prev.disabled = at === 0;
    ui.next.disabled = at === works.length - 1;
  };
  ui.prev.addEventListener("click", () => show(at - 1));
  ui.next.addEventListener("click", () => show(at + 1));
  ui.close.addEventListener("click", () => ui.dialog.close());
  ui.dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
  });
  ui.dialog.addEventListener("click", (e) => { if (e.target === ui.dialog) ui.dialog.close(); });
  return (i) => { show(i); ui.dialog.showModal(); };
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
    const open = wireViewer(works);
    const frag = document.createDocumentFragment();
    works.forEach((w, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "arc-cell" + (w.kind === "collage" ? " is-collage" : "");
      b.setAttribute("aria-label", `Open work ${i + 1} of ${works.length}: ${w.title}`);
      const im = document.createElement("img");
      im.src = w.thumb;
      im.alt = "";
      im.loading = "lazy";          // 165 thumbnails must not all arrive at once
      im.decoding = "async";
      im.width = w.thumb_dimensions[0];
      im.height = w.thumb_dimensions[1];
      b.append(im);
      b.addEventListener("click", () => open(i));
      frag.append(b);
    });
    target.replaceChildren(frag);
    target.hidden = false;
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
