// controls.js: the showcase rail wiring + the scene keyboard map (spec 3.1). Every control is a
// real focusable element with the studio's visible focus ring; this module only enables them and
// binds the handlers. Scene keys fire ONLY while the showcase source is selected and focus is on
// the stage or its rail, NEVER while typing in a text or number input (arrows there step the
// native value, which is exactly what the map wants). ASCII only; no em or en dashes.
//
// Keyboard map:
//   Arrow keys  step the focused range/number input (native; Shift for the input's coarse step)
//   S           cycle the system chips (sho, pendulum, kepler, oscillator2d)
//   Space       pause / resume the integration (also toggles the rt-playpause toolbar button)
//   R           replay states 1 to 4
//   V           re-verify (re-check the receipt)
//   E           export the world + report JSON
//   M           reserved for sound; NOT shipped in v1 (documented, no-op here)
const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);
const SYSTEMS_ORDER = ["sho", "pendulum", "kepler", "oscillator2d"];

// Controls that carry the scene parameters; enabled on wire, disabled again on unwire so the
// rail reads as inert whenever another source owns the stage.
const CONTROL_IDS = ["show-seed", "show-ecc", "show-dt", "show-n", "show-terms",
  "show-drag", "show-replay", "show-verify", "show-export"];

function setEnabled(on) {
  for (const id of CONTROL_IDS) { const el = $(id); if (el) el.disabled = !on; }
  const sys = $("show-system");
  if (sys) for (const c of sys.querySelectorAll(".chip")) c.disabled = !on;
}

const isTextEntry = (el) => {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const t = (el.getAttribute("type") || "text").toLowerCase();
  return t === "text" || t === "search" || t === "url" || t === "email" || t === "password";
};

// The scene owns the stage + its rail for the key map. A key is "in scope" when the showcase
// source block is visible and the event target sits inside the stage viewport or the rail panel.
function inShowcaseScope(target) {
  const block = $("src-showcase");
  if (!block || block.hidden) return false;
  const stage = $("studio-viewport");
  return (block.contains(target)) || (stage && stage.contains(target)) || target === document.body;
}

// Cycle the active system chip forward. Returns the new system name (callback re-reads params).
function cycleSystem() {
  const host = $("show-system"); if (!host) return null;
  const chips = [...host.querySelectorAll(".chip")];
  if (!chips.length) return null;
  const cur = chips.findIndex((c) => c.classList.contains("active"));
  const active = chips[cur] ? chips[cur].dataset.showSystem : "kepler";
  const order = SYSTEMS_ORDER.filter((s) => chips.some((c) => c.dataset.showSystem === s));
  const idx = order.indexOf(active);
  const next = order[(idx + 1) % order.length] || order[0];
  for (const c of chips) c.classList.toggle("active", c.dataset.showSystem === next);
  return next;
}

// Wire the rail + the key map. `cb` carries the lifecycle callbacks owned by first-integral.js:
//   { rebuild, replay, reverify, export: exportJSON, spaceToggle }
// Returns an unwire() that removes every listener and re-disables the controls.
export function wireShowcaseControls(cb = {}) {
  if (typeof document === "undefined") return () => {};
  setEnabled(true);
  const rebuild = () => { try { cb.rebuild && cb.rebuild(); } catch (_) {} };

  const onSystemClick = (e) => {
    const chip = e.target.closest && e.target.closest(".chip[data-show-system]");
    if (!chip) return;
    const host = $("show-system");
    for (const c of host.querySelectorAll(".chip")) c.classList.toggle("active", c === chip);
    rebuild();
  };
  const onParamChange = () => rebuild();
  const onReplay = () => { try { cb.replay && cb.replay(); } catch (_) {} };
  const onReverify = () => { try { cb.reverify && cb.reverify(); } catch (_) {} };
  const onExport = () => { try { cb.export && cb.export(); } catch (_) {} };

  const sysHost = $("show-system"); if (sysHost) sysHost.addEventListener("click", onSystemClick);
  const changeIds = ["show-seed", "show-ecc", "show-dt", "show-n", "show-terms"];
  for (const id of changeIds) { const el = $(id); if (el) el.addEventListener("change", onParamChange); }
  const rp = $("show-replay"); if (rp) rp.addEventListener("click", onReplay);
  const vf = $("show-verify"); if (vf) vf.addEventListener("click", onReverify);
  const ex = $("show-export"); if (ex) ex.addEventListener("click", onExport);

  const onKey = (e) => {
    if (!inShowcaseScope(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = isTextEntry(e.target);
    const k = e.key;
    // Arrow keys are left to the native range/number inputs (they step the value and fire change).
    if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") return;
    if (typing) return;   // never hijack a letter while the operator is typing a seed or terms
    const key = k.length === 1 ? k.toLowerCase() : k;
    if (key === "s") { e.preventDefault(); if (cycleSystem() != null) rebuild(); }
    else if (key === " " || key === "spacebar") { e.preventDefault(); try { cb.spaceToggle && cb.spaceToggle(); } catch (_) {} }
    else if (key === "r") { e.preventDefault(); onReplay(); }
    else if (key === "v") { e.preventDefault(); onReverify(); }
    else if (key === "e") { e.preventDefault(); onExport(); }
    // "m" is reserved for sound and intentionally does nothing in v1 (spec D6).
  };
  document.addEventListener("keydown", onKey, true);

  return function unwire() {
    if (sysHost) sysHost.removeEventListener("click", onSystemClick);
    for (const id of changeIds) { const el = $(id); if (el) el.removeEventListener("change", onParamChange); }
    if (rp) rp.removeEventListener("click", onReplay);
    if (vf) vf.removeEventListener("click", onReverify);
    if (ex) ex.removeEventListener("click", onExport);
    document.removeEventListener("keydown", onKey, true);
    setEnabled(false);
  };
}

// Serialize the world + report to a JSON blob and download it (E key / Export button). Self
// contained anchor download in the style of endless.js, so the scene owns its own export path.
export function downloadReportJSON(bundle) {
  if (typeof document === "undefined" || !bundle || !bundle.report) return false;
  const payload = {
    schema: bundle.report.schema, report: bundle.report,
    canonical: bundle.canonical || null, report_sha256: bundle.sha256 || null,
    world: bundle.world ? bundle.world.receipt : null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `first-integral-${bundle.report.system}-seed-${bundle.report.seed}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
