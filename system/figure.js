const NAVIGATION_KEYS = new Set(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]);

export function nextPointIndex(current, key, count) {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count;
  return current;
}

export function shouldAnimate(reducedMotionQuery) {
  return !reducedMotionQuery?.matches;
}

export function enhanceRelationshipFilter(root) {
  const input = root.querySelectorAll("[data-relationship-filter]")[0];
  if (!input) return false;

  const rows = Array.from(root.querySelectorAll("[data-relationship-row]"));
  const cards = Array.from(root.querySelectorAll("[data-relation-card]"));
  const count = root.querySelectorAll("[data-relationship-count]")[0];

  const apply = () => {
    const query = input.value.trim().toLocaleLowerCase();
    [...rows, ...cards].forEach((record) => {
      const searchable = (record.getAttribute("data-relationship-search") ?? "").toLocaleLowerCase();
      record.hidden = query.length > 0 && !searchable.includes(query);
    });
    const visible = rows.filter((row) => !row.hidden).length;
    if (count) count.textContent = `${visible} of ${rows.length} relationships`;
  };

  input.addEventListener("input", apply);
  apply();
  return true;
}

export function enhancePrintRecords(
  doc = globalThis.document,
  printQuery = globalThis.matchMedia?.("print"),
) {
  if (!doc?.querySelectorAll) return 0;
  const records = Array.from(doc.querySelectorAll("details.figure-records"));
  if (records.length === 0) return 0;

  const openForPrint = () => {
    records.forEach((record) => {
      if (!("figurePrintWasOpen" in record.dataset)) {
        record.dataset.figurePrintWasOpen = record.open ? "true" : "false";
      }
      record.open = true;
    });
  };
  const restoreAfterPrint = () => {
    records.forEach((record) => {
      if (!("figurePrintWasOpen" in record.dataset)) return;
      record.open = record.dataset.figurePrintWasOpen === "true";
      delete record.dataset.figurePrintWasOpen;
    });
  };

  if (printQuery?.matches) openForPrint();
  printQuery?.addEventListener?.("change", (event) => {
    if (event.matches) openForPrint();
    else restoreAfterPrint();
  });
  globalThis.addEventListener?.("beforeprint", openForPrint);
  globalThis.addEventListener?.("afterprint", restoreAfterPrint);
  return records.length;
}

export function enhanceFigureRoot(root, reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")) {
  const filterEnhanced = enhanceRelationshipFilter(root);
  const points = Array.from(root.querySelectorAll("[data-figure-point]"));
  if (points.length === 0) return filterEnhanced;
  const rows = Array.from(root.querySelectorAll("[data-figure-row]"));
  root.dataset.figureEnhanced = "true";
  root.dataset.figureMotion = shouldAnimate(reducedMotionQuery) ? "allowed" : "reduced";

  const activate = (index, moveFocus = false) => {
    const active = points[index];
    const key = active.getAttribute("data-figure-key");
    root.dataset.figureActive = "true";
    points.forEach((point, pointIndex) => {
      point.setAttribute("tabindex", pointIndex === index ? "0" : "-1");
      point.classList[pointIndex === index ? "add" : "remove"]("is-active");
    });
    rows.forEach((row) => row.classList[row.getAttribute("data-figure-key") === key ? "add" : "remove"]("is-active"));
    if (moveFocus) active.focus();
  };

  points.forEach((point, index) => {
    point.setAttribute("tabindex", index === 0 ? "0" : "-1");
    point.addEventListener("focus", () => activate(index));
    point.addEventListener("keydown", (event) => {
      if (!NAVIGATION_KEYS.has(event.key)) return;
      event.preventDefault();
      activate(nextPointIndex(index, event.key, points.length), true);
    });
  });
  return true;
}

export function enhanceFigures(doc = globalThis.document) {
  if (!doc?.querySelectorAll) return 0;
  const reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  return Array.from(doc.querySelectorAll("[data-evidence-figure]")).filter((root) => enhanceFigureRoot(root, reducedMotionQuery)).length;
}

if (typeof document !== "undefined") {
  const enhanceDocument = () => {
    enhanceFigures(document);
    enhancePrintRecords(document);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhanceDocument, { once: true });
  else enhanceDocument();
}
