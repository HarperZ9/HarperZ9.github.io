// studio-form.js: a source's settings read straight from its inspector, for the shell's undo and
// kept session, when the source has no state object of its own to hand over. Two kinds of control
// count: chip groups (buttons that carry one data-* value and mark the chosen one active or
// aria-pressed) and named inputs (an id on a range, number, text field, select or checkbox).
// Putting a snapshot back clicks the chip and sets the input, firing the same events a visitor's
// hand would, so the source's own handlers do the work and nothing is drawn behind their back.

const SKIP = new Set(["data-in-bar"]);

// The one data-* attribute that names a chip's value, or null for a plain button.
export function chipAttr(btn) {
  if (!btn || !btn.attributes) return null;
  for (const a of btn.attributes) if (a.name.startsWith("data-") && !SKIP.has(a.name)) return a.name;
  return null;
}
const chosen = (b) => (b.classList && b.classList.contains("active")) || b.getAttribute("aria-pressed") === "true";

/** formSnapshot(block, { only }) -> { chips: { attr: value }, inputs: { id: value } } */
export function formSnapshot(block, { only = null, skip = [] } = {}) {
  const out = { chips: {}, inputs: {} };
  if (!block) return out;
  for (const b of block.querySelectorAll("button")) {
    const attr = chipAttr(b);
    if (!attr || (only && !only.includes(attr)) || skip.includes(attr)) continue;
    if (chosen(b)) out.chips[attr] = b.getAttribute(attr);
  }
  for (const el of block.querySelectorAll("input[id], select[id], textarea[id]")) {
    if (el.type === "file" || el.type === "hidden" || skip.includes(el.id)) continue;
    if (only && !only.includes(el.id)) continue;
    out.inputs[el.id] = el.type === "checkbox" ? !!el.checked : String(el.value);
  }
  return out;
}

/** formRestore(block, snap) puts each chip and input back by the visitor's own events. */
export function formRestore(block, snap) {
  if (!block || !snap) return;
  // Chips first (a world, a mode), then the inputs that tune it.
  for (const [attr, v] of Object.entries(snap.chips || {})) {
    const btn = block.querySelector(`button[${attr}="${CSS.escape(String(v))}"]`);
    if (btn && !chosen(btn)) btn.click();
  }
  for (const [id, v] of Object.entries(snap.inputs || {})) {
    const el = block.querySelector("#" + CSS.escape(id));
    if (!el) continue;
    if (el.type === "checkbox") { if (el.checked === !!v) continue; el.checked = !!v; }
    else { if (String(el.value) === String(v)) continue; el.value = String(v); }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
