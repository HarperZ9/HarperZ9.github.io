// studio-dnd.js: drag and drop between the Studio's tools, and from the desktop (9 October 2026).
// The audit found the only way to move a picture between tools was the deck's To Retro and To Loom
// buttons. Now:
//   - The stage has a handle, "Drag frame". Dragging it opens the source menu; dropping it on Retro
//     Engine, Loom or Bring your own hands the frame to that tool in this page (the same path as
//     the buttons). Dropped outside the browser, Chrome saves it as a PNG.
//   - A file dropped anywhere that no drop zone took goes to the tool that reads it: a picture, a
//     video, a sound or a 3D model to Bring your own; a .wif draft to the Loom; a .json project file
//     to the shell (studio-shell-dom.js).
// The buttons stay; this adds ways in, it takes none away.

export const FRAME_TYPE = "application/x-studio-frame";
export const FRAME_TARGETS = Object.freeze(["retro", "loom", "byo"]);

/** Which tool opens a dropped file, by its name and type. Pure; tested in studio-dnd.test.mjs. */
export function routeFile(name, type) {
  const n = String(name || "").toLowerCase(), t = String(type || "").toLowerCase();
  if (n.endsWith(".json")) return "project";
  if (n.endsWith(".wif")) return "loom";
  if (/^(image|video|audio)\//.test(t) || /\.(png|jpe?g|gif|webp|avif|bmp|mp4|webm|mov|mp3|wav|ogg|m4a|flac|obj|gltf|glb|stl|ply)$/.test(n)) return "byo";
  return null;
}

/**
 * mountDnd({ stage, menu, setSource, getSource, openMenu, sendFrame, loadIntoByo, openProject, say })
 * sendFrame(target) hands the stage's frame to target; loadIntoByo(file) opens a file there.
 */
export function mountDnd(o) {
  const doc = o.stage.ownerDocument;
  const handle = doc.createElement("button");
  handle.type = "button";
  handle.className = "stage-drag";
  handle.draggable = true;
  handle.textContent = "Drag frame";
  handle.title = "Drag this frame onto Retro Engine, Loom or Bring your own in the source menu, or out of the browser to save it";
  handle.setAttribute("aria-label", "Drag this frame to another tool. The To Retro and To Loom buttons below do the same from the keyboard.");
  o.stage.append(handle);

  let dragging = false;
  handle.addEventListener("dragstart", (e) => {
    const c = doc.getElementById("studio-canvas");
    dragging = true;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(FRAME_TYPE, o.getSource());
    e.dataTransfer.setData("text/plain", "Studio frame from " + o.getSource());
    try { if (c) e.dataTransfer.setData("DownloadURL", `image/png:studio-frame-${o.getSource()}.png:${c.toDataURL("image/png")}`); } catch (_) {}
    try { if (c) e.dataTransfer.setDragImage(c, 24, 24); } catch (_) {}
    o.openMenu(true);
    for (const t of o.menu.querySelectorAll("button[data-source]")) t.classList.toggle("drop-ok", FRAME_TARGETS.includes(t.dataset.source));
  });
  handle.addEventListener("dragend", () => {
    dragging = false;
    for (const t of o.menu.querySelectorAll(".drop-ok, .drop-over")) t.classList.remove("drop-ok", "drop-over");
  });
  const isFrame = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes(FRAME_TYPE);
  o.menu.addEventListener("dragover", (e) => {
    const t = e.target.closest && e.target.closest("button[data-source]");
    if (!t || !isFrame(e) || !FRAME_TARGETS.includes(t.dataset.source)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    for (const x of o.menu.querySelectorAll(".drop-over")) if (x !== t) x.classList.remove("drop-over");
    t.classList.add("drop-over");
  });
  o.menu.addEventListener("drop", (e) => {
    const t = e.target.closest && e.target.closest("button[data-source]");
    if (!t || !isFrame(e) || !FRAME_TARGETS.includes(t.dataset.source)) return;
    e.preventDefault();
    o.openMenu(false);
    o.sendFrame(t.dataset.source);
  });

  // Files from the desktop, wherever no drop zone took them.
  doc.addEventListener("dragover", (e) => {
    const items = e.dataTransfer && [...(e.dataTransfer.items || [])];
    if (items && items.some((i) => i.kind === "file")) e.preventDefault();
  });
  doc.addEventListener("drop", (e) => {
    if (e.defaultPrevented || dragging) return;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const where = routeFile(f.name, f.type);
    if (!where) { o.say("That file is not one the Studio opens: " + f.name); return; }
    e.preventDefault();
    if (where === "project") o.openProject(f);
    else if (where === "byo") o.loadIntoByo(f);
    else if (where === "loom") o.openWif(f);
  });
  return { handle };
}
