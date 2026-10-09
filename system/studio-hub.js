// studio-hub.js: a tool page's own working parts, run in full inside the Studio (9 October 2026).
// The author, 4 October: "this page is the hub for where all of these modules should exist." The
// pattern #356 used for the Retro Engine, made general: read the tool page once, adopt its control
// panel into the source's inspector and its preview onto the stage, bring its styles scoped to
// those two places, and import the page's own controller, which boots against the adopted markup.
// Nothing in the tool is rewritten.
//
// While the source is on stage its canvas carries the Studio's canvas id, so the readings, the
// deck's exports and the hand-offs read the tool's own frames. Leaving parks it and gives the id
// back.

const SCOPE_ATTR = "data-hub";

// Rewrite every selector in a style sheet so it only reaches inside the adopted markup.
function scopedSheet(text, scope) {
  const sheet = new CSSStyleSheet();
  try { sheet.replaceSync(text); } catch (e) { console.error("[studio-hub] a page style block did not parse:", e); return null; }
  const out = [];
  const walk = (rules, wrap) => {
    for (const r of rules) {
      if (r.selectorText != null && r.style) {
        // A selector reaches inside an adopted part, or names the adopted part itself. Rules for
        // the page's html, body or :root stay on the tool page.
        const sel = r.selectorText.split(",").map((s) => s.trim())
          .filter((s) => s && !/^(html|body|:root)\b/.test(s))
          .flatMap((s) => (s.includes("::") ? [`:is(${scope}) ${s}`] : [`:is(${scope}) ${s}`, `${s}:is(${scope})`]));
        if (sel.length) out.push(wrap(`${sel.join(", ")}{${r.style.cssText}}`));
      } else if (r.media && r.cssRules) {
        walk(r.cssRules, (t) => wrap(`@media ${r.media.mediaText}{${t}}`));
      } else if (r.cssRules && r.conditionText != null) {
        walk(r.cssRules, (t) => wrap(`@supports ${r.conditionText}{${t}}`));
      } else if (r.cssText && /^@(keyframes|font-face)/.test(r.cssText)) {
        out.push(wrap(r.cssText));
      }
    }
  };
  walk(sheet.cssRules, (t) => t);
  const s = new CSSStyleSheet();
  try { s.replaceSync(out.join("\n")); } catch (e) { console.error("[studio-hub] scoped styles did not parse:", e); return null; }
  return s;
}

/**
 * createHub({ id, page, panel, preview, extras, canvas, styleTest, boot, pause, resume })
 *   id        the source id, written on the adopted parts as data-hub="<id>"
 *   page      the tool page to read (with its cache stamp)
 *   panel     selector of the page's control panel, adopted into the inspector mount
 *   preview   selector of the page's stage part, adopted onto the Studio stage
 *   extras    selectors appended to the mount after the panel (status lines, flow notes)
 *   canvas    selector, inside the preview, of the canvas the tool draws into
 *   styleTest a function(text) choosing which of the page's <style> blocks to bring
 *   sheets    stylesheet URLs the page links that the Studio does not, brought in scoped
 *   boot      async function that imports the page's controller once the markup is in place
 *   pause / resume  optional, called on leave and on every entry after the first
 */
export function createHub(opts) {
  let hub = null, loading = null;
  const scope = `[${SCOPE_ATTR}="${opts.id}"]`;

  async function build(mount, stage) {
    const res = await fetch(opts.page, { credentials: "same-origin" });
    if (!res.ok) throw new Error(opts.page + " answered " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const sheets = [];
    for (const st of doc.querySelectorAll("head style")) {
      if (opts.styleTest && !opts.styleTest(st.textContent)) continue;
      const s = scopedSheet(st.textContent, scope);
      if (s) sheets.push(s);
    }
    for (const href of opts.sheets || []) {
      const r = await fetch(href, { credentials: "same-origin" });
      if (!r.ok) { console.error("[studio-hub] " + href + " answered " + r.status); continue; }
      const s = scopedSheet(await r.text(), scope);
      if (s) sheets.push(s);
    }
    if (sheets.length) document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
    const take = (sel) => { const n = doc.querySelector(sel); return n ? document.adoptNode(n) : null; };
    const panel = take(opts.panel), preview = take(opts.preview);
    if (!panel || !preview) throw new Error(opts.page + " has no " + (panel ? opts.preview : opts.panel));
    panel.setAttribute(SCOPE_ATTR, opts.id);
    mount.replaceChildren(panel);
    for (const sel of opts.extras || []) { const n = take(sel); if (n) { n.setAttribute(SCOPE_ATTR, opts.id); mount.append(n); } }
    preview.setAttribute(SCOPE_ATTR, opts.id);
    preview.classList.add("studio-hub-preview");
    preview.hidden = true;
    stage.append(preview);
    const out = preview.querySelector(opts.canvas);
    if (!out) throw new Error(opts.page + " preview has no " + opts.canvas);
    const ownId = out.id;
    // The Studio reads every frame back (the readings, Undo checks, exports). Chrome rasterises a
    // canvas on the GPU until its first read-back and on the CPU after it, and the two differ in
    // their last bits, so the same drawing came back with other pixels once it had been read.
    // Asking for the CPU path from the start keeps one drawing one set of pixels.
    if (opts.readable !== false && out.getContext) { try { out.getContext("2d", { alpha: true, willReadFrequently: true }); } catch (_) {} }
    await opts.boot();
    return { preview, out, ownId, studioCanvas: null, entered: 0 };
  }

  return {
    /** Show the tool. Resolves once its markup is on the page and its controller has booted. */
    async enter({ mount, stage }) {
      if (!hub) {
        if (!loading) loading = build(mount, stage).then((h) => { hub = h; return h; }).finally(() => { loading = null; });
        await loading;
      }
      const studioCanvas = document.getElementById("studio-canvas");
      if (studioCanvas && studioCanvas !== hub.out) {
        hub.studioCanvas = studioCanvas;
        studioCanvas.id = "studio-canvas-parked";
        studioCanvas.hidden = true;
      }
      hub.out.id = "studio-canvas";
      hub.preview.hidden = false;
      if (hub.entered++ && opts.resume) opts.resume();
      return hub;
    },
    /** Park the tool and give the Studio its canvas back. */
    leave() {
      if (!hub) return;
      if (opts.pause) opts.pause();
      hub.preview.hidden = true;
      hub.out.id = hub.ownId;
      if (hub.studioCanvas) { hub.studioCanvas.id = "studio-canvas"; hub.studioCanvas.hidden = false; }
    },
    ready: () => !!hub,
    canvas: () => (hub ? hub.out : null),
  };
}
