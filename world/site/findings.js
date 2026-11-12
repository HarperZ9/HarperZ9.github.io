// findings.js: show one kind of result and one field at a time. The list and the field are static HTML; this only
// hides and dims, and keeps the choice in the address so a filtered view can be shared.
const tierButtons = [...document.querySelectorAll(".fd-filter button[data-tier]")];
const domainButtons = [...document.querySelectorAll(".fd-filter button[data-domain]")];
const items = [...document.querySelectorAll(".fd-item")], marks = [...document.querySelectorAll(".fd-mark")];
const count = document.querySelector(".xp-count");
const state = { tier: "", domain: "" };

function show() {
  let n = 0;
  for (const it of items) {
    const on = (!state.tier || it.dataset.tier === state.tier) && (!state.domain || it.dataset.domains.split(" ").includes(state.domain));
    it.hidden = !on; n += on;
  }
  for (const m of marks) m.classList.toggle("xf-off", (!!state.tier && m.dataset.tier !== state.tier) || (!!state.domain && m.dataset.domains !== state.domain));
  for (const b of tierButtons) b.setAttribute("aria-pressed", String(b.dataset.tier === state.tier));
  for (const b of domainButtons) b.setAttribute("aria-pressed", String(b.dataset.domain === state.domain));
  count.textContent = `${n} ${n === 1 ? "finding" : "findings"} shown.`;
  const u = new URL(location.href);
  for (const k of ["tier", "domain"]) state[k] ? u.searchParams.set(k, state[k]) : u.searchParams.delete(k);
  history.replaceState(null, "", u);
}
for (const b of tierButtons) b.addEventListener("click", () => { state.tier = b.dataset.tier; show(); });
for (const b of domainButtons) b.addEventListener("click", () => { state.domain = b.dataset.domain; show(); });
const q = new URLSearchParams(location.search);
if (tierButtons.some((b) => b.dataset.tier === q.get("tier"))) state.tier = q.get("tier");
if (domainButtons.some((b) => b.dataset.domain === q.get("domain"))) state.domain = q.get("domain");
if (state.tier || state.domain) show();
