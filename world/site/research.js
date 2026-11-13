// research.js: a claim's mark opens its trace in place, and a link to a trace, a correction or a reference opens what
// it points at. Everything works without this file: traces are <details>, marks are plain links to them. It adds no
// motion, so reduced motion needs no branch.
const root = document.documentElement;
root.classList.add("rp-js");

function sync(d) {
  const id = d.id.replace(/^t-/, "");
  for (const m of document.querySelectorAll(`.cm[data-claim="${id}"]`)) m.setAttribute("aria-expanded", String(d.open));
  document.getElementById(id)?.classList.toggle("open", d.open);  // the claim's words, .rp-claim
}

for (const m of document.querySelectorAll(".cm[data-claim]")) {
  const t = document.getElementById(`t-${m.dataset.claim}`);
  if (!t) { console.error("research.js: no trace for", m.dataset.claim); continue; }
  m.setAttribute("role", "button");
  m.setAttribute("aria-controls", t.id);
  m.setAttribute("aria-expanded", "false");
  m.addEventListener("click", (e) => {
    e.preventDefault();
    t.open = !t.open;
    if (t.open && m.hasAttribute("data-again")) t.scrollIntoView({ block: "nearest" });
    if (t.open) t.querySelector("summary")?.focus({ preventScroll: true });
  });
  m.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); m.click(); } });
  t.addEventListener("toggle", () => sync(t));
}

function openTarget() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el) return;
  const d = el.matches("details") ? el : el.closest("details");
  if (d) d.open = true;
}
addEventListener("hashchange", openTarget);
openTarget();
