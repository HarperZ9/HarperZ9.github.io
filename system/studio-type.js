// studio-type.js: the Type forge's whole desk inside the Studio's Type forge source (9 October
// 2026). Before, the source had three controls (text, weight, capitals) against type-forge.html's
// thirteen. Now it adopts the page's own desk: the text field, the pen (weight, contrast), the
// proportion (width, x-height, roundness, aperture), the capitals, the four named weights, the
// proof set in the face just minted, the alphabet, and the mint's status list. forge-page.js, the
// page's controller, re-mints the font on every change exactly as it does on the page. The stage
// keeps drawing the text from the minted outlines (the type plugin), so the readings, PNG frame
// and the hand-offs read it like any other source.

const PAGE = "type-forge.html?v=20261009-type-desk";
const KEYS = ["weight", "contrast", "width", "x_height", "roundness", "aperture"];
let parts = null;      // { proof, form, status, note } adopted once, moved into the mount on each entry
let loading = null;

async function adopt() {
  const res = await fetch(PAGE, { credentials: "same-origin" });
  if (!res.ok) throw new Error("type-forge.html answered " + res.status);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const take = (sel) => { const n = doc.querySelector(sel); return n ? document.adoptNode(n) : null; };
  const proof = take(".tf-proof"), form = take("#tf-controls"), status = take("#tf-status");
  if (!proof || !form || !status) throw new Error("type-forge.html has no forge desk");
  const wrap = document.createElement("div");
  wrap.className = "studio-type-desk type-forge-page";
  wrap.dataset.hub = "type";
  const sheet = await fetch("system/type-forge/forge-page.css?v=20261003-engine", { credentials: "same-origin" });
  if (sheet.ok) {
    // The page's rules are written for its body class; here they apply inside the adopted desk.
    const css = (await sheet.text()).replace(/\.type-forge-page\.tf-refused/g, ".studio-type-desk.tf-refused")
      .replace(/\.type-forge-page /g, ".studio-type-desk ");
    const s = new CSSStyleSheet();
    try { s.replaceSync(css + "\n.studio-type-desk .tf-desk,.studio-type-desk{display:block}"
      + "\n.studio-type-desk .tf-sample{font-size:clamp(1.8rem,4vw,2.6rem)}"
      + "\n.studio-type-desk .tf-alphabet p{font-size:clamp(1.1rem,2.4vw,1.5rem)}"); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }
    catch (e) { console.error("[studio-type] the forge styles did not parse:", e); }
  }
  wrap.append(form, proof, status);
  return { wrap, form };
}

/** The forge's values as the type plugin's parameters. */
export function forgeParams() {
  const $ = (id) => document.getElementById(id);
  const p = { text: ($("tf-text") || {}).value || "" };
  for (const k of KEYS) { const el = $("tf-" + k); if (el) p[k] = +el.value; }
  const st = $("tf-style"); p.style = st ? st.value : "";
  return p;
}

/**
 * Put the desk in the mount and call onChange(params) whenever the visitor changes it. Returns the
 * fields the Studio keeps (each { el, first }) and an apply() that pushes the current values.
 */
export async function mountTypeDesk(mount, onChange) {
  if (!parts) {
    if (!loading) loading = adopt().then((p) => { parts = p; return p; }).finally(() => { loading = null; });
    await loading;
  }
  mount.append(parts.wrap);
  // The page's controller boots once, against the desk now in the document.
  if (!parts.booted) { parts.booted = true; await import("./type-forge/forge-page.js?v=20261003-engine"); }
  if (!parts.wired) {
    parts.wired = true;
    const fire = () => onChange(forgeParams());
    parts.form.addEventListener("input", fire);
    parts.form.addEventListener("change", fire);
    for (const b of parts.form.querySelectorAll("[data-weight]")) b.addEventListener("click", () => setTimeout(fire, 0));
    document.getElementById("tf-text").addEventListener("input", fire);
  }
  parts.onChange = onChange;
  const $ = (id) => document.getElementById(id);
  const fields = { text: { el: $("tf-text"), first: $("tf-text").defaultValue } };
  for (const k of KEYS) fields[k] = { el: $("tf-" + k), first: $("tf-" + k).defaultValue };
  fields.style = { el: $("tf-style"), first: "" };
  // After values are set from outside (Undo, a kept session), the forge re-mints its proof too.
  const apply = () => { parts.form.dispatchEvent(new Event("input", { bubbles: true })); };
  return { fields, apply };
}
