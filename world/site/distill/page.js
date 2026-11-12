// Distill, the page: choose or drop a file, some files or a folder, and read what each is made of.
// Everything runs in this browser tab. No byte leaves it, and nothing in a file is run.
// File names and contents are only ever set as text, never as markup.
import { distill, distillFolder, receipt } from "./core.mjs";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const num = (n) => n.toLocaleString("en-GB");
const size = (n) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
const pct = (s) => (s === 1 ? "100" : (Math.floor(s * 10000) / 100).toFixed(2));
const LIMIT = { files: 2000, bytes: 1024 * 1024 * 1024 };
// each kind of part has a colour and a mark, so the map reads without colour too
export const KINDS = {
  header: ["#5b8def", "solid", "Header or signature"], chunk: ["#c58b2a", "bars", "Named block"], segment: ["#c58b2a", "bars", "Named block"], table: ["#8a63d2", "grid", "Index or table"],
  data: ["#2f9e77", "dots", "Packed or raw data"], file: ["#d0577a", "slash", "File inside"], folder: ["#d0577a", "slash", "File inside"], marker: ["#5b8def", "solid", "Header or signature"],
  section: ["#3aa6b9", "wave", "Section of text"], member: ["#3aa6b9", "wave", "Section of text"], text: ["#3aa6b9", "wave", "Section of text"],
};
const GAP = ["#8a8f98", "cross", "Not accounted for"];

function mark(g, kind, x, y, w, h) {
  const [colour, shape] = KINDS[kind] || GAP; g.fillStyle = colour; g.globalAlpha = shape === "solid" ? 1 : 0.42; g.fillRect(x, y, w, h); g.globalAlpha = 1; g.strokeStyle = colour; g.lineWidth = 2; g.beginPath();
  if (shape === "bars") for (let i = x + 4; i < x + w; i += 8) { g.moveTo(i, y); g.lineTo(i, y + h); }
  if (shape === "grid") { for (let i = x + 5; i < x + w; i += 10) { g.moveTo(i, y); g.lineTo(i, y + h); } g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); }
  if (shape === "slash") for (let i = x - h; i < x + w; i += 9) { g.moveTo(Math.max(i, x), y + h - Math.max(0, x - i)); g.lineTo(Math.min(i + h, x + w), y + h - Math.min(h, x + w - i)); }
  if (shape === "cross") for (let i = x + 5; i < x + w - 3; i += 12) { g.moveTo(i - 3, y + h / 2 - 3); g.lineTo(i + 3, y + h / 2 + 3); g.moveTo(i + 3, y + h / 2 - 3); g.lineTo(i - 3, y + h / 2 + 3); }
  if (shape === "wave") for (let i = x; i < x + w; i += 2) g.lineTo(i, y + h / 2 + Math.sin(i / 4) * h * 0.22);
  g.stroke();
  if (shape === "dots") { g.fillStyle = colour; for (let i = x + 4; i < x + w - 1; i += 7) for (let j = y + 5; j < y + h; j += 7) g.fillRect(i, j, 2.5, 2.5); }
}
// the file as one strip: each part at its place and width, gaps marked; below it, where the bytes are dense
function drawMap(canvas, d) {
  const w = canvas.clientWidth || 720, r = Math.min(devicePixelRatio || 1, 2); canvas.width = w * r; canvas.height = 76 * r;
  const g = canvas.getContext("2d"); g.scale(r, r); g.clearRect(0, 0, w, 76);
  const X = (o) => (d.size ? (o / d.size) * w : 0);
  for (const p of d.coverage.residual) mark(g, "gap", X(p.offset), 0, Math.max(1, X(p.length)), 44);
  for (const p of d.parts) if (p.length) { g.save(); g.beginPath(); g.rect(X(p.offset), 0, Math.max(1, X(p.length)), 44); g.clip(); mark(g, p.kind, X(p.offset), 0, Math.max(1, X(p.length)), 44); g.restore(); if (X(p.length) > 4) g.clearRect(X(p.offset), 0, 1, 44); }
  const n = d.entropyMap.length; d.entropyMap.forEach((e, i) => { g.fillStyle = "#8a8f98"; const h = (e / 8) * 24; g.fillRect((i / n) * w, 76 - h, w / n - 1, h); });
}

function facts(d) {
  const dl = el("dl", "ds-facts");
  const row = (k, v) => { dl.append(el("dt", "", k), el("dd", "", String(v))); };
  row("Format", d.formatName); row("Size", `${size(d.size)} (${num(d.size)} bytes)`); row("SHA-256", d.sha256); row("Entropy", `${d.entropy} of 8 bits per byte`);
  for (const [k, v] of Object.entries(d.facts)) row(k.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()).replace(/ By /, " by "), typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "number" ? num(v) : v);
  return dl;
}
function partList(d) {
  const table = el("table", "ds-parts"), head = el("tr"); for (const h of ["Part", "Kind", "Starts at byte", "Length", "Share"]) head.append(el("th", "", h)); table.append(head);
  const rows = d.parts.length > 200 ? [...d.parts].sort((a, b) => b.length - a.length).slice(0, 200) : d.parts;
  for (const p of rows) { const tr = el("tr"), name = el("td", "", p.name), sw = el("span", "ds-sw"); sw.style.background = (KINDS[p.kind] || GAP)[0]; name.prepend(sw);
    tr.append(name, el("td", "", (KINDS[p.kind] || GAP)[2]), el("td", "", num(p.offset)), el("td", "", size(p.length)), el("td", "", d.size ? `${((p.length / d.size) * 100).toFixed(2)}%` : "")); table.append(tr); }
  const wrap = el("div", "ds-scroll"); wrap.append(table);
  if (rows !== d.parts) wrap.prepend(el("p", "ds-note", `Showing the 200 largest of ${num(d.parts.length)} parts. The saved report holds them all.`));
  return wrap;
}
export function sentence(d) {
  if (d.kind === "folder") return `${num(d.files)} files, ${size(d.size)} in all, in ${Object.keys(d.byFormat).length} formats.`;
  const c = d.coverage, gap = d.size - c.covered;
  return `${d.name || "This file"} is ${/^[AEIOU]/i.test(d.formatName) ? "an" : "a"} ${d.formatName}, ${size(d.size)}. ${num(d.parts.length)} ${d.parts.length === 1 ? "part accounts" : "parts account"} for ${pct(c.share)} percent of its bytes${gap ? `; ${num(gap)} bytes are not accounted for` : ""}.`;
}
function fileView(d, open = true) {
  const box = el("details", "ds-file"); box.open = open; const sum = el("summary"); sum.append(el("b", "", d.name || "file"), el("span", "", ` ${d.formatName}, ${size(d.size)}`)); box.append(sum);
  box.append(el("p", "ds-say", sentence(d)));
  const canvas = el("canvas", "ds-map"); canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Map of the file from first byte to last. ${sentence(d)}`); box.append(canvas);
  const paint = () => drawMap(canvas, d); box.addEventListener("toggle", () => box.open && paint()); requestAnimationFrame(paint); addEventListener("resize", paint);
  box.append(facts(d)); for (const n of d.notes) box.append(el("p", "ds-note", n));
  if (d.parts.length) box.append(partList(d));
  if (d.inside) { box.append(el("h3", "", `Inside: ${sentence(d.inside)}`)); box.append(folderView(d.inside, false)); }
  return box;
}
function folderView(f, open) {
  const wrap = el("div", "ds-folder"); wrap.append(el("p", "ds-root", `Root ${f.root}`));
  const mix = el("ul", "ds-mix"); for (const k of Object.values(f.byFormat).sort((a, b) => b.size - a.size)) mix.append(el("li", "", `${k.name}: ${num(k.files)}, ${size(k.size)}`)); wrap.append(mix);
  if (f.duplicates.length) wrap.append(el("p", "ds-note", `${num(f.duplicates.length)} ${f.duplicates.length === 1 ? "file repeats" : "files repeat"} another byte for byte, such as ${f.duplicates[0][1]} and ${f.duplicates[0][0]}.`));
  f.items.slice(0, 300).forEach((d, i) => wrap.append(fileView(d, open && f.items.length === 1 && i === 0)));
  if (f.items.length > 300) wrap.append(el("p", "ds-note", `Showing 300 of ${num(f.items.length)} files. The saved report holds them all.`));
  return wrap;
}

async function walk(entry, out, prefix = "") {
  if (out.length >= LIMIT.files) return;
  if (entry.isFile) { const file = await new Promise((ok, no) => entry.file(ok, no)); out.push({ path: prefix + entry.name, file }); return; }
  const reader = entry.createReader(); for (;;) { const batch = await new Promise((ok, no) => reader.readEntries(ok, no)); if (!batch.length) break; for (const e of batch) await walk(e, out, `${prefix}${entry.name}/`); }
}
async function run(list, root) {
  const out = $(".ds-out", root), say = $(".ds-status", root); out.replaceChildren(); let total = 0; const files = [];
  for (const { path, file } of list.slice(0, LIMIT.files)) { total += file.size; if (total > LIMIT.bytes) break; say.textContent = `Reading ${path}`; files.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) }); }
  if (!files.length) { say.textContent = "Nothing to read. A single file here can be up to 1 GB."; return; }
  say.textContent = "Taking it apart";
  const result = files.length === 1 ? await distill(files[0].bytes, files[0].path) : await distillFolder(files);
  say.textContent = sentence(result) + (files.length < list.length ? ` Read ${num(files.length)} of ${num(list.length)} files; the rest are past this page's limit.` : "");
  out.append(files.length === 1 ? fileView(result) : folderView(result, true));
  const save = el("a", "ds-save", "Save the report"); save.download = `${(files.length === 1 ? files[0].path : "folder").replace(/[^\w.-]+/g, "_")}.distill.json`;
  save.href = URL.createObjectURL(new Blob([receipt(result)], { type: "application/json" })); out.append(save);
  root.dispatchEvent(new CustomEvent("distilled", { detail: result }));
}

export function mount(root = $("[data-distill]")) {
  if (!root) return;
  const pick = (input) => run([...input.files].map((file) => ({ path: file.webkitRelativePath || file.name, file })), root).catch((e) => { $(".ds-status", root).textContent = `That could not be read: ${e.message}`; });
  for (const input of root.querySelectorAll("input[type=file]")) input.addEventListener("change", () => pick(input));
  const drop = $(".ds-drop", root);
  for (const t of ["dragenter", "dragover"]) drop.addEventListener(t, (e) => { e.preventDefault(); drop.dataset.over = "1"; });
  for (const t of ["dragleave", "drop"]) drop.addEventListener(t, () => { delete drop.dataset.over; });
  drop.addEventListener("drop", async (e) => { e.preventDefault(); const list = [], entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    try { if (entries.length) for (const en of entries) await walk(en, list); else for (const file of e.dataTransfer.files) list.push({ path: file.name, file }); await run(list, root); }
    catch (err) { $(".ds-status", root).textContent = `That could not be read: ${err.message}`; } });
  for (const c of root.querySelectorAll("canvas[data-kind]")) { c.width = 68; c.height = 28; const g = c.getContext("2d"); g.scale(2, 2); mark(g, c.dataset.kind, 0, 0, 34, 14); }
  root.dataset.distillLive = "1";
}
if (typeof document !== "undefined") mount();
