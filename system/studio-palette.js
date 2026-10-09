// studio-palette.js: find anything in the Studio, and every key in one place (9 October 2026).
// The audit counted about a thousand controls over 27 sources with no way to search them and keys
// spread across the tools. Two things answer it:
//   - The palette (Ctrl+K or Cmd+K, or "/" when no field has focus): one search over every source
//     by name and purpose, every control the Studio has drawn (by its label, in any source), and the
//     active source's bar actions. Enter runs a button or focuses a field, switching source first.
//   - The key sheet ("?"): every keyboard shortcut, from one registry. Tools add theirs with
//     window.__studioKeys.register(source, [[keys, what], ...]).
// Matching is a plain substring and initials score, so it works without a dependency and the same
// words find the same things every time.

const KEYS = new Map();   // source (or "" for the whole Studio) -> [[keys, what]]

export function registerKeys(source, list) {
  const now = KEYS.get(source) || [];
  for (const row of list) if (!now.some((r) => r[0] === row[0])) now.push(row);
  KEYS.set(source, now);
}
// The keys the tools already have, as their own code and pages describe them.
registerKeys("", [
  ["Ctrl+K or /", "Search every source and control"],
  ["?", "This list of keys"],
  ["Ctrl+Z, Cmd+Z", "Undo in the source on stage"],
  ["Ctrl+Shift+Z, Ctrl+Y", "Redo"],
  ["Escape", "Close the source menu, the search or this list"],
  ["Arrow keys", "Walk the source menu while it is open"],
]);
registerKeys("worlds", [["W A S D, Q E", "Fly"], ["Wheel button drag", "Turn the world"], ["Wheel", "Come closer"], ["Shift drag or right drag", "Slide"], ["Double click", "Look at a spot"], ["R", "Start over"]]);
registerKeys("retro", [["F", "Full screen"], ["R", "Randomise the effects"], ["S", "Save PNG"], ["Space", "Animate on or off"], ["[ and ]", "Effect amount down or up"], ["Ctrl+Z", "Undo a stroke while drawing, a change otherwise"]]);
registerKeys("loom", [["Space", "Weave on or off"], ["S", "Save the cloth"], ["F", "Full screen"], ["Arrow keys", "Walk the structures"]]);
registerKeys("gallery", [["Space", "Reroll (when no button has focus)"], ["Enter in the seed field", "Draw"]]);
registerKeys("atelier", [["Enter in the seed field", "Draw this seed"]]);
registerKeys("films", [["Space", "Play or pause the interactive film"], ["Left and right arrows", "Skip 5 seconds"], [", and .", "Step one frame"]]);
registerKeys("showcase", [["S", "A new seed for the system"]]);

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
function score(q, text) {
  const t = norm(text);
  if (!q) return 1;
  const i = t.indexOf(q);
  if (i === 0) return 100 - Math.min(40, t.length / 4);
  if (i > 0) return 60 - Math.min(30, i);
  const initials = t.split(/[^a-z0-9]+/).filter(Boolean).map((w) => w[0]).join("");
  if (initials.startsWith(q)) return 30;
  // every word of the query somewhere in the text
  const words = q.split(" ");
  if (words.length > 1 && words.every((w) => t.includes(w))) return 25;
  return 0;
}

function labelOf(el) {
  const own = el.getAttribute("aria-label") || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.title || el.placeholder || "";
  return own.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * mountPalette({ guide, setSource, getSource, bar }) wires the keys and returns { open, keys }.
 * guide is SOURCE_GUIDE; setSource switches; bar is the action bar element.
 */
export function mountPalette({ guide, setSource, getSource, bar, sourceOfBlock }) {
  const dlg = document.createElement("dialog");
  dlg.className = "studio-palette";
  dlg.setAttribute("aria-label", "Search the Studio");
  const input = Object.assign(document.createElement("input"), { type: "search", id: "studio-palette-q", placeholder: "Search sources and controls", autocomplete: "off", spellcheck: false });
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", "studio-palette-list");
  const list = document.createElement("ul");
  list.id = "studio-palette-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Results");
  const foot = document.createElement("p");
  foot.className = "studio-palette-foot";
  foot.textContent = "Enter runs or opens it. Arrows move. Escape closes. ? lists every key.";
  dlg.append(input, list, foot);

  const sheet = document.createElement("dialog");
  sheet.className = "studio-palette studio-keys";
  sheet.setAttribute("aria-label", "Keyboard shortcuts");
  document.body.append(dlg, sheet);

  let rows = [], sel = 0;

  function index() {
    const out = [];
    const tabs = [...document.querySelectorAll("#studio-source button[data-source]")];
    tabs.forEach((t, i) => {
      const g = guide[t.dataset.source] || { name: t.textContent.trim(), purpose: "" };
      out.push({ kind: "Source", text: `${g.name}`, hint: g.purpose, sub: String(i + 1).padStart(2, "0"), run: () => setSource(t.dataset.source), source: t.dataset.source });
    });
    if (bar) {
      for (const b of bar.querySelectorAll("button")) {
        const l = labelOf(b);
        if (l) out.push({ kind: "Action", text: l, hint: (guide[getSource()] || {}).name || "", run: () => b.click(), el: b });
      }
    }
    for (const block of document.querySelectorAll("#studio-rail .src-block")) {
      const src = sourceOfBlock(block.id, getSource());
      const name = src && guide[src] ? guide[src].name : "";
      for (const el of block.querySelectorAll("button, input, select, textarea, summary")) {
        if (el.type === "hidden" || el.type === "file" || el.disabled) continue;
        const l = labelOf(el);
        if (!l || l.length < 2) continue;
        out.push({ kind: el.tagName === "BUTTON" || el.tagName === "SUMMARY" ? "Control" : "Setting", text: l, hint: name, el, source: src });
      }
    }
    return out;
  }

  function render() {
    const q = norm(input.value);
    const all = index();
    rows = all.map((r) => ({ r, s: Math.max(score(q, r.text), score(q, r.hint) * 0.5) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || (a.r.kind === "Source" ? -1 : 1)).slice(0, 40).map((x) => x.r);
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    list.replaceChildren(...rows.map((r, i) => {
      const li = document.createElement("li");
      li.id = "studio-palette-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel));
      const k = document.createElement("span"); k.className = "sp-kind"; k.textContent = r.kind;
      const t = document.createElement("span"); t.className = "sp-text"; t.textContent = r.text;
      const h = document.createElement("span"); h.className = "sp-hint"; h.textContent = r.hint;
      li.append(k, t, h);
      li.addEventListener("click", () => { sel = i; choose(); });
      return li;
    }));
    if (!rows.length) { const li = document.createElement("li"); li.className = "sp-none"; li.textContent = "Nothing by that name yet. A source's own controls appear here once it has been opened."; list.append(li); }
    input.setAttribute("aria-activedescendant", rows.length ? "studio-palette-opt-" + sel : "");
  }

  function choose() {
    const r = rows[sel];
    if (!r) return;
    dlg.close();
    if (r.run) { r.run(); return; }
    const go = () => {
      const el = r.el;
      // Open any closed section that holds it, then bring it into view.
      for (let d = el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
      el.scrollIntoView({ block: "center" });
      if (el.tagName === "BUTTON" || el.tagName === "SUMMARY") el.click();
      else el.focus();
    };
    if (r.source && r.source !== getSource()) { setSource(r.source); setTimeout(go, 400); } else go();
  }

  function open(q = "") {
    if (sheet.open) sheet.close();
    input.value = q;
    sel = 0;
    render();
    dlg.showModal();
    input.focus();
  }

  function showKeys() {
    if (dlg.open) dlg.close();
    const here = getSource();
    const h = document.createElement("h2"); h.textContent = "Keys";
    const groups = [["", "The whole Studio"], [here, (guide[here] || {}).name || here], ...[...KEYS.keys()].filter((k) => k && k !== here).map((k) => [k, (guide[k] || {}).name || k])];
    const body = [h];
    for (const [k, title] of groups) {
      const rowsK = KEYS.get(k);
      if (!rowsK || !rowsK.length) continue;
      const t = document.createElement("h3"); t.textContent = title + (k === here && k ? ", on stage now" : "");
      const dl = document.createElement("dl");
      for (const [keys, what] of rowsK) {
        const dt = document.createElement("dt"); const kbd = document.createElement("kbd"); kbd.textContent = keys; dt.append(kbd);
        const dd = document.createElement("dd"); dd.textContent = what;
        dl.append(dt, dd);
      }
      body.push(t, dl);
    }
    const close = document.createElement("button");
    close.type = "button"; close.className = "btn ghost"; close.textContent = "Close";
    close.addEventListener("click", () => sheet.close());
    body.push(close);
    sheet.replaceChildren(...body);
    sheet.showModal();
    close.focus({ preventScroll: true });
    sheet.scrollTop = 0;
  }

  input.addEventListener("input", () => { sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); render(); list.children[sel] && list.children[sel].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); list.children[sel] && list.children[sel].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); choose(); }
  });
  for (const d of [dlg, sheet]) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });

  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); dlg.open ? dlg.close() : open(); return; }
    if (dlg.open || sheet.open || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); open(); }
    else if (e.key === "?") { e.preventDefault(); showKeys(); }
  });

  window.__studioKeys = { register: registerKeys, list: () => Object.fromEntries(KEYS) };
  return { open, keys: showKeys, index };
}
