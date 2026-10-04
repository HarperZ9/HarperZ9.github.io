// studio-readings.js: the readings panel folds away while someone is making a piece (the author's
// decision of 4 October 2026: "fold yes"), and opens again on demand or once the making stops.
//
// "Making", exactly: on a source whose contract says making: true, the visitor is making while a
// pointer is down on the stage, and for QUIET_MS after the last making action. A making action is a
// pointer press or a wheel turn on the stage, a change to a control in the source's inspector, or
// the action bar's main action, Undo or Redo. Exporting, pinning and switching source are not
// making. Checking a claim (Showcase) is not making, so its readings never fold.
//
// The panel keeps its column, so the stage never changes size under the pen. Each change of state
// is announced in a polite status region. "Show readings" opens the panel at once and keeps it open
// until the making stops.

export const QUIET_MS = 4000;

// The pure half: one clock per page. isMaking(t) answers for a moment in time.
export function createMakingClock({ quietMs = QUIET_MS } = {}) {
  let down = false;
  let last = -Infinity;
  return {
    pointerDown(t) { down = true; last = t; },
    pointerUp(t) { if (down) { down = false; last = t; } },
    action(t) { last = t; },
    isMaking(t) { return down || t - last < quietMs; },
    endsAt() { return down ? Infinity : last + quietMs; },
    reset() { down = false; last = -Infinity; },
  };
}

export const READINGS_TEXT = Object.freeze({
  folded: "Readings folded while you make.",
  foldedLong: "Readings folded while you make. Show readings opens them.",
  open: "Readings open.",
  show: "Show readings",
});

/**
 * mountReadings({ doc, panel, stage, getSource, isMakingSource }) -> { action(), sync(), state() }.
 * panel is #studio-panel, stage the element that holds the canvas.
 */
export function mountReadings({ doc = globalThis.document, panel, stage, getSource, isMakingSource, now = () => performance.now() }) {
  if (!panel) return { action() {}, sync() {}, state: () => "open" };
  const clock = createMakingClock();
  let folded = false;
  let heldOpen = false;     // "Show readings" during a making session
  let timer = 0;

  const strip = doc.createElement("div");
  strip.className = "readings-folded";
  strip.hidden = true;
  const note = doc.createElement("p");
  note.textContent = READINGS_TEXT.folded;
  const show = doc.createElement("button");
  show.type = "button"; show.className = "btn ghost"; show.id = "readings-show";
  show.textContent = READINGS_TEXT.show;
  show.setAttribute("aria-controls", panel.id || "studio-panel");
  strip.append(note, show);
  const status = doc.createElement("p");
  status.id = "readings-status"; status.className = "visually-hidden readings-status";
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  panel.prepend(strip);
  panel.append(status);

  function setFolded(next) {
    if (next === folded) return;
    folded = next;
    panel.dataset.readings = folded ? "folded" : "open";
    strip.hidden = !folded;
    status.textContent = folded ? READINGS_TEXT.foldedLong : READINGS_TEXT.open;
  }
  function sync() {
    clearTimeout(timer);
    const t = now();
    const making = !!isMakingSource(getSource()) && clock.isMaking(t);
    if (!making) heldOpen = false;
    setFolded(making && !heldOpen);
    if (making) {
      const wait = clock.endsAt() - t;
      if (Number.isFinite(wait)) timer = setTimeout(sync, Math.max(50, wait + 20));
    }
  }
  function action() { clock.action(now()); sync(); }

  show.addEventListener("click", () => { heldOpen = true; setFolded(false); });
  if (stage) {
    stage.addEventListener("pointerdown", (e) => {
      if (!e.target.closest || !e.target.closest("canvas")) return;
      clock.pointerDown(now()); sync();
    });
    stage.addEventListener("wheel", (e) => { if (e.target.closest && e.target.closest("canvas")) action(); }, { passive: true });
  }
  doc.addEventListener("pointerup", () => { clock.pointerUp(now()); sync(); });
  doc.addEventListener("pointercancel", () => { clock.pointerUp(now()); sync(); });
  panel.dataset.readings = "open";
  return {
    action,
    sync,
    sourceChanged() { clock.reset(); heldOpen = false; sync(); },
    state: () => (folded ? "folded" : "open"),
  };
}
