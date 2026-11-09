// experiments.js: show one domain at a time. The stream and the field are static HTML; this only hides and dims.
const buttons = [...document.querySelectorAll(".xp-filter button")];
const cards = [...document.querySelectorAll(".xc")], marks = [...document.querySelectorAll(".xf-mark")];
const count = document.querySelector(".xp-count");
function show(domain) {
  let n = 0;
  for (const c of cards) { const on = !domain || c.dataset.domains.split(" ").includes(domain); c.hidden = !on; n += on; }
  for (const m of marks) m.classList.toggle("xf-off", !!domain && m.dataset.domains !== domain);
  for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.domain === domain));
  count.textContent = `${n} ${n === 1 ? "study" : "studies"} shown.`;
  const u = new URL(location.href); domain ? u.searchParams.set("domain", domain) : u.searchParams.delete("domain"); history.replaceState(null, "", u);
}
for (const b of buttons) b.addEventListener("click", () => show(b.dataset.domain));
// a mark always reaches its card, even when a filter hid it
for (const m of marks) m.addEventListener("click", () => { const c = document.getElementById(m.getAttribute("href").slice(1)); if (c?.hidden) show(""); });
const start = new URLSearchParams(location.search).get("domain");
if (start && buttons.some((b) => b.dataset.domain === start)) show(start);
