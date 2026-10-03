// system/explainer/dom.mjs
// The live explainer's page parts: the stage and its controls, the parameter panel, the
// "How we know" lines, and the move of the video into a details element. live.mjs wires them.
// Every control is a native button, range or select, so the keyboard path needs no extra code.

import { markRisk } from "../media-engine/colour.mjs";

export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v; else if (k === "class") n.className = v; else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
};

export const secs = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// Which pole the page draws this figure on, read from its text colour: light text, dark ground.
export function pole(node) {
  const m = getComputedStyle(node).color.match(/\d+(\.\d+)?/g);
  if (!m) return "light";
  const [r, g, b] = m.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "dark" : "light";
}

let uid = 0;
function paramControl(p, onChange) {
  const id = `xl-param-${p.id}-${++uid}`;
  const out = el("output", { for: id, class: "xl-out" });
  const show = (v) => { out.textContent = p.kind === "choice" ? p.options.find((o) => o.value === v).label : Number(v).toFixed(p.digits || 0); };
  let input;
  if (p.kind === "choice") {
    input = el("select", { id });
    for (const o of p.options) input.append(el("option", { value: String(o.value), text: o.label }));
    input.addEventListener("change", () => { const v = p.options.find((o) => String(o.value) === input.value).value; show(v); onChange(p, v); });
    out.hidden = true; // the select already shows its choice
  } else {
    input = el("input", { id, type: "range", min: p.min, max: p.max, step: p.step });
    input.addEventListener("input", () => { const v = Number(input.value); show(v); onChange(p, v); });
  }
  const set = (v) => { input.value = String(v); show(v); };
  set(p.default);
  return { row: el("div", { class: "xl-param" }, el("label", { for: id, text: p.label }), input, out), set, p };
}

// The stage, the transport bar and the step list.
export function stageParts(spec, end) {
  const parts = {
    canvas: el("canvas", { role: "img", "aria-label": `${spec.title}: live figure. Its caption is read out at each step.` }),
    caption: el("p", { class: "xl-caption", "aria-live": "polite" }),
    play: el("button", { type: "button", class: "xl-btn xl-play" }),
    prev: el("button", { type: "button", class: "xl-btn", text: "Previous step" }),
    next: el("button", { type: "button", class: "xl-btn", text: "Next step" }),
    scrub: el("input", { type: "range", class: "xl-scrub", min: 0, max: end.toFixed(2), step: "0.1", value: 0, "aria-label": "Position in the explainer" }),
    clock: el("span", { class: "xl-clock" }),
    steps: el("ol", { class: "xl-steps", "aria-label": "Steps" }),
  };
  parts.stepButtons = spec.scenes.map(() => { const b = el("button", { type: "button" }); parts.steps.append(el("li", {}, b)); return b; });
  parts.stage = el("div", { class: "xl-stage" }, parts.canvas);
  parts.root = el("div", { class: "xl" }, parts.stage, parts.caption,
    el("div", { class: "xl-bar" }, parts.play, parts.prev, parts.next, parts.scrub, parts.clock), parts.steps);
  return parts;
}

// "Change the figure": one control per spec parameter, a note that the video keeps its values,
// and a reset. Returns null for a spec with no parameters.
export function paramPanel(spec, onChange, onReset) {
  if (!spec.params || !spec.params.length) return null;
  const fs = el("fieldset", { class: "xl-params" }, el("legend", { text: "Change the figure" }));
  const controls = spec.params.map((p) => paramControl(p, onChange));
  for (const c of controls) fs.append(c.row);
  const note = el("p", { class: "xl-changed", hidden: "" }, "You changed a value. The stage and its caption follow it. The narrated video keeps the original values. ");
  const reset = el("button", { type: "button", class: "xl-btn xl-quiet", text: "Use the video's values" });
  reset.addEventListener("click", () => { for (const c of controls) c.set(c.p.default); onReset(); });
  note.append(reset);
  fs.append(note);
  return { root: fs, changed: (on) => { note.hidden = !on; } };
}

// "How we know": the live spec's hash against the video's build receipt, one hot mark.
export function howWeKnow({ receipt, specSha, folder }) {
  const same = receipt && receipt.spec && receipt.spec.sha256 === specSha;
  const word = receipt ? (same ? "MATCH" : "DRIFT") : "UNVERIFIABLE";
  const says = !receipt ? ": no build receipt to compare this figure's spec against (SHA-256 "
    : same ? ": this figure and the video come from the same spec (SHA-256 "
      : ": this figure's spec differs from the one the video was built from (SHA-256 ";
  const save = el("button", { type: "button", class: "xl-btn xl-quiet", text: "Save this frame's receipt" });
  const ul = el("ul", { class: "xl-how", "aria-label": "How we know" },
    el("li", {}, el("b", { "data-verdict": word, text: word }), says, el("code", { text: specSha.slice(0, 16) }), ")."),
    el("li", {}, "The video stays the version to share and cite, with its own ",
      el("a", { class: "inline", href: `${folder}/receipt.json`, text: "build receipt" }), ". ", save));
  markRisk(ul.querySelectorAll("[data-verdict]"));
  return { root: ul, save };
}

// The video, captions and transcript stay; the video moves into a details element under the stage.
export function tuckVideo(fig) {
  const video = fig.querySelector("video");
  if (!video) return;
  const det = el("details", { class: "xl-video" }, el("summary", { text: "Watch the narrated video" }));
  video.replaceWith(det);
  det.append(video);
}

export function dueBanner(count, onReview) {
  const p = el("p", { class: "xl-due" }, `${count} recall question${count === 1 ? " is" : "s are"} due for review from your last visit. `);
  const go = el("button", { type: "button", class: "xl-btn", text: "Review now" });
  go.addEventListener("click", onReview);
  p.append(go);
  return p;
}

export function download(name, data) {
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
