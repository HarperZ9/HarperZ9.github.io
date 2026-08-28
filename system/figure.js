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

export function enhanceFigureRoot(root, reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")) {
  const points = Array.from(root.querySelectorAll("[data-figure-point]"));
  if (points.length === 0) return false;
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhanceFigures(document), { once: true });
  else enhanceFigures(document);
}
