// studio-shell-dom.js: the shell's DOM half (studio-shell.js has the pure half). It wires the
// source switch, paints the inspector header and the action bar, keeps each source's work in this
// browser (studio-store.js), and walks the shared undo history. Every bar button runs a control the
// source already had, so no control id or handler changes.
//
// contracts[source] = { primary, exports?, pin?, snapshot(), restore(state), reset?(), keep?(state),
// making? }. primary and each export are { label, target, title? }; pin is a target; a target is
// the id of an existing control. keep(state) filters what is saved (default: the whole snapshot);
// reset() puts the source back to its first state for "Start fresh"; making marks a source whose
// readings fold while the visitor works (studio-readings.js). A source with no snapshot has no
// Undo, Redo or keep line; history: false keeps a snapshot without Undo and Redo (a file's name,
// say, which can be remembered but not undone).

import { SOURCE_GUIDE, createHistory, isTextEntry, chordOf } from "./studio-shell.js?v=20261004-studio-keep";
import { createStore, keepMessage } from "./studio-store.js?v=20261004-studio-keep";

function el(ctx, tag, cls, text, attrs = {}) {
  const n = ctx.doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function button(ctx, label, cls, onClick, attrs = {}) {
  const b = el(ctx, "button", cls, label, { type: "button", ...attrs });
  b.addEventListener("click", onClick);
  return b;
}
const proxy = (ctx, target) => () => { const t = ctx.$(target); if (t && !t.disabled) t.click(); };

// The source switch: one line naming the source; the 24-source menu folds behind it.
function setOpen(ctx, open, focusMenu) {
  if (!ctx.rail || !ctx.sw) return;
  ctx.rail.dataset.sources = open ? "open" : "closed";
  ctx.sw.setAttribute("aria-expanded", String(open));
  if (open && focusMenu && ctx.menu) {
    const sel = ctx.menu.querySelector('[aria-selected="true"]') || ctx.menu.querySelector("button");
    if (sel) sel.focus();
  }
}
function wireSwitch(ctx) {
  if (ctx.sw) ctx.sw.addEventListener("click", () => setOpen(ctx, ctx.rail.dataset.sources !== "open", true));
  if (!ctx.menu) return;
  // A pointer pick, Enter or Space folds the menu and hands focus to the inspector; arrow keys walk
  // the sources with the menu open (the tablist's roving focus is unchanged).
  ctx.menu.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("button[data-source]")) return;
    setOpen(ctx, false);
    const title = ctx.$("inspector-title");
    if (title && e.detail === 0) { try { title.focus({ preventScroll: true }); } catch (_) { title.focus(); } }
  });
  ctx.menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(ctx, false); if (ctx.sw) ctx.sw.focus(); } });
}

function paintHead(ctx, source) {
  const g = SOURCE_GUIDE[source] || { name: source, purpose: "" };
  const tabs = ctx.menu ? [...ctx.menu.querySelectorAll("button[data-source]")] : [];
  const n = String(tabs.findIndex((t) => t.dataset.source === source) + 1).padStart(2, "0");
  if (ctx.sw) {
    const num = ctx.sw.querySelector("[data-switch-num]"); if (num) num.textContent = n;
    const name = ctx.sw.querySelector("[data-switch-name]"); if (name) name.textContent = g.name;
  }
  if (!ctx.head) return;
  const t = ctx.$("inspector-title"); if (t) t.textContent = g.name;
  const p = ctx.$("inspector-purpose"); if (p) p.textContent = g.purpose;
  ctx.head.dataset.source = source;
}

function exportMenu(ctx, c) {
  const d = el(ctx, "details", "ia-export"); d.dataset.action = "export";
  const s = el(ctx, "summary", "btn ghost", "Export");
  const list = el(ctx, "div", "ia-export-list", null, { role: "group", "aria-label": "Export formats" });
  for (const x of c.exports) list.append(button(ctx, x.label, "btn ghost", () => { d.open = false; proxy(ctx, x.target)(); }, { "data-export": x.target }));
  d.append(s, list);
  return d;
}
function keepLine(ctx) {
  const keep = el(ctx, "p", "inspector-keep", null, { id: "inspector-keep" });
  keep.append(el(ctx, "span", null, null, { id: "inspector-keep-said" }),
    button(ctx, "Start fresh", "btn ghost ia-fresh", () => startFresh(ctx), { "data-action": "fresh",
      title: "Clear the work kept for this source and go back to its first state. Undo brings it back." }));
  return keep;
}
// The action bar, in one order: main action, Undo, Redo, Export, Pin; the keep line sits under it.
function paintBar(ctx, source) {
  const bar = ctx.bar; if (!bar) return;
  const c = ctx.contracts[source];
  bar.replaceChildren();
  const oldKeep = ctx.$("inspector-keep"); if (oldKeep) oldKeep.remove();
  if (ctx.rail) ctx.rail.dataset.inspector = c ? "unified" : "legacy";
  if (!c) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.setAttribute("aria-label", (SOURCE_GUIDE[source] || { name: source }).name + " actions");
  const making = (fn) => () => { ctx.onMaking(); fn(); };
  if (c.primary) bar.append(button(ctx, c.primary.label, "btn ia-primary", making(proxy(ctx, c.primary.target)),
    { "data-action": "primary", "data-target": c.primary.target, ...(c.primary.title ? { title: c.primary.title } : {}) }));
  // A source with its own undo stack (the Retro Engine) keeps it: the bar's Undo runs that
  // source's button, and the keys stay with the source's own handler.
  if (c.ownUndo) bar.append(button(ctx, "Undo", "btn ghost", making(proxy(ctx, c.ownUndo)), { "data-action": "undo", "aria-keyshortcuts": "Control+Z Meta+Z" }));
  if (hasHistory(c)) {
    bar.append(button(ctx, "Undo", "btn ghost", making(() => undo(ctx)), { "data-action": "undo", "aria-keyshortcuts": "Control+Z Meta+Z" }));
    bar.append(button(ctx, "Redo", "btn ghost", making(() => redo(ctx)), { "data-action": "redo", "aria-keyshortcuts": "Control+Shift+Z Meta+Shift+Z Control+Y" }));
  }
  if (c.exports && c.exports.length) bar.append(exportMenu(ctx, c));
  if (c.pin) bar.append(button(ctx, "Pin", "btn ghost", proxy(ctx, c.pin), { "data-action": "pin" }));
  if (c.snapshot) { bar.after(keepLine(ctx)); sayKept(ctx, source); }   // under the bar: one row on a phone
  syncHistoryButtons(ctx, source);
}
const hasHistory = (c) => !!(c && c.snapshot && c.history !== false);
function syncHistoryButtons(ctx, source) {
  if (!ctx.bar || (ctx.contracts[source] && ctx.contracts[source].ownUndo)) return;
  const u = ctx.bar.querySelector('[data-action="undo"]'), r = ctx.bar.querySelector('[data-action="redo"]');
  if (u) u.disabled = !ctx.history.canUndo(source);
  if (r) r.disabled = !ctx.history.canRedo(source);
}
function sayKept(ctx, source) {
  const said = ctx.$("inspector-keep-said"); if (!said) return;
  const r = ctx.kept.get(source) || (ctx.store.available() ? { ok: true } : { ok: false, reason: "blocked" });
  said.textContent = keepMessage(r, (SOURCE_GUIDE[source] || { name: "this work" }).name);
  said.dataset.kept = r.ok ? "yes" : "no";
}

// History and keeping.
function record(ctx, source, label) {
  const c = ctx.contracts[source];
  if (!c || !c.snapshot || ctx.restoring || source !== ctx.getSource()) return false;
  let state = null;
  try { state = c.snapshot(); } catch (err) { console.error("[studio-shell] snapshot failed for " + source + ":", err); return false; }
  const changed = ctx.history.record(source, state, label);
  // Nothing is saved before the source has resumed, or a first blank frame would overwrite the
  // work this browser kept.
  if (changed) { syncHistoryButtons(ctx, source); if (ctx.resumed.has(source)) save(ctx, source, state); }
  return changed;
}
function save(ctx, source, state) {
  const c = ctx.contracts[source];
  let keepable = state;
  try { if (c.keep) keepable = c.keep(state); } catch (err) { console.error("[studio-shell] keep filter failed for " + source + ":", err); return; }
  const r = ctx.store.save(source, keepable);
  if (!r.ok && r.reason !== "blocked") console.warn("[studio-shell] " + source + " not kept: " + r.reason);
  ctx.kept.set(source, r);
  if (source === ctx.getSource()) sayKept(ctx, source);
}
function apply(ctx, source, state) {
  if (state == null) return false;
  ctx.restoring = true;
  try { ctx.contracts[source].restore(state); }
  catch (err) { console.error("[studio-shell] restore failed for " + source + ":", err); }
  finally { ctx.restoring = false; }
  syncHistoryButtons(ctx, source);
  return true;
}
// On a source's first ready moment in this page, put back what this browser kept; that session is
// the start of the page's history. Returns true when a kept session was applied.
function resume(ctx, source, { apply: applyKept = true } = {}) {
  if (!ctx.contracts[source] || ctx.resumed.has(source)) return false;
  ctx.resumed.add(source);
  if (!applyKept) { record(ctx, source); return false; }
  const got = ctx.store.load(source);
  if (got.reason) { ctx.kept.set(source, { ok: false, reason: got.reason }); sayKept(ctx, source); }
  if (got.state == null) { record(ctx, source); return false; }
  ctx.history.clear(source);
  apply(ctx, source, got.state);
  record(ctx, source);
  return true;
}
function startFresh(ctx) {
  const s = ctx.getSource(), c = ctx.contracts[s];
  if (!c || !c.reset) return false;
  ctx.store.clear(s);
  ctx.kept.delete(s);
  ctx.restoring = true;
  try { c.reset(); } catch (err) { console.error("[studio-shell] reset failed for " + s + ":", err); }
  finally { ctx.restoring = false; }
  ctx.onMaking();
  record(ctx, s, "start fresh");
  sayKept(ctx, s);
  return true;
}
function undo(ctx) { const s = ctx.getSource(); return hasHistory(ctx.contracts[s]) ? apply(ctx, s, ctx.history.undo(s)) : false; }
function redo(ctx) { const s = ctx.getSource(); return hasHistory(ctx.contracts[s]) ? apply(ctx, s, ctx.history.redo(s)) : false; }

function wireKeys(ctx) {
  ctx.doc.addEventListener("keydown", (e) => {
    const step = chordOf(e);
    if (!step || isTextEntry(e.target) || !hasHistory(ctx.contracts[ctx.getSource()])) return;
    e.preventDefault();
    ctx.onMaking();
    if (step === "undo") undo(ctx); else redo(ctx);
  });
}
// Mark every rail control the bar now carries, so the original stays wired but out of sight.
function markBarTargets(ctx) {
  for (const c of Object.values(ctx.contracts)) {
    for (const t of [c.primary && c.primary.target, c.pin, ...(c.exports || []).map((x) => x.target)]) {
      const n = t && ctx.$(t);
      if (n && ctx.rail && ctx.rail.contains(n)) n.setAttribute("data-in-bar", "");
    }
  }
}

/** mountShell({ doc, rail, getSource, contracts, storage, onMaking }) -> the shell's handle. */
export function mountShell({ doc = globalThis.document, rail, getSource, contracts = {}, storage, onMaking = () => {} }) {
  const $ = (id) => doc.getElementById(id);
  const maxBytes = (typeof window !== "undefined" && window.__studioKeepMaxBytes) || undefined;
  const ctx = { doc, $, rail, getSource, contracts, onMaking,
    sw: $("source-switch"), menu: $("studio-source"), head: $("inspector-head"), bar: $("inspector-actions"),
    history: createHistory(), store: createStore({ storage, maxBytes }), kept: new Map(), resumed: new Set(), restoring: false };
  wireSwitch(ctx);
  wireKeys(ctx);
  markBarTargets(ctx);
  paintHead(ctx, getSource());
  paintBar(ctx, getSource());
  if (rail && !rail.dataset.sources) setOpen(ctx, false);
  const timers = new Map();
  return {
    sourceChanged(next) { paintHead(ctx, next); paintBar(ctx, next); },
    record: (source, label) => record(ctx, source, label),
    recordSoon(source, label, ms = 400) {
      clearTimeout(timers.get(source));
      timers.set(source, setTimeout(() => record(ctx, source, label), ms));
    },
    resume: (source, opts) => resume(ctx, source, opts),
    startFresh: () => startFresh(ctx),
    undo: () => undo(ctx),
    redo: () => redo(ctx),
    setOpen: (open) => setOpen(ctx, open),
    // A source that builds its controls after the shell mounted (the Poster workshop) marks them again.
    markTargets: () => markBarTargets(ctx),
    history: ctx.history,
    store: ctx.store,
  };
}
