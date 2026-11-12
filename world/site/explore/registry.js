// registry.js: press a package in the registry field and its check shows under the field. Every mark is a button,
// so keys and taps reach it; without scripts the first package's check stays shown and the list reads as words.
const host = document.querySelector('[data-toy="registry"]');
if (host) {
  const out = host.querySelector(".rgy-check");
  host.addEventListener("click", (e) => {
    const b = e.target.closest(".rgy-mark"); if (!b) return;
    for (const x of host.querySelectorAll(".rgy-mark")) x.setAttribute("aria-pressed", String(x === b));
    const n = document.createElement("b"); n.className = "ident"; n.textContent = b.querySelector(".ident").textContent;
    out.replaceChildren(n, `, ${b.dataset.origin}: ${b.dataset.check}`);
  });
}
