// Controls made of media. The markup stays native (buttons, links, details); this file adds the one
// behaviour CSS cannot: receipts as tooltips.
//
//   <a href="..." data-receipt="source: FRED CPIAUCNS|retrieved: 2026-10-23|sha256: cfab9b9b">...</a>
//
// A receipt tip is a real tooltip: role="tooltip", tied by aria-describedby, shown on hover and on
// keyboard focus, hidden on blur, pointer leave and Escape. Lines are split on "|".
let n = 0;

function tipFor(el) {
  const tip = document.createElement("span");
  tip.className = "receipt-tip";
  tip.setAttribute("role", "tooltip");
  tip.id = `receipt-${++n}`;
  tip.hidden = true;
  for (const line of el.dataset.receipt.split("|")) {
    const row = document.createElement("span");
    const [k, ...v] = line.split(":");
    if (v.length) { const key = document.createElement("b"); key.textContent = k.trim(); row.append(key, " " + v.join(":").trim()); }
    else row.textContent = line.trim();
    tip.append(row);
  }
  el.after(tip);
  el.setAttribute("aria-describedby", [el.getAttribute("aria-describedby"), tip.id].filter(Boolean).join(" "));
  return tip;
}

function place(el, tip) {
  const r = el.getBoundingClientRect(), w = Math.min(320, innerWidth - 32);
  tip.style.width = w + "px";
  const left = Math.max(16, Math.min(r.left, innerWidth - w - 16));
  const below = r.bottom + 10 + tip.offsetHeight < innerHeight;
  tip.style.left = left + "px";
  tip.style.top = (below ? r.bottom + 10 : r.top - 10 - tip.offsetHeight) + "px";
}

export function initReceipts() {
  for (const el of document.querySelectorAll("[data-receipt]")) {
    const tip = tipFor(el);
    const show = () => { tip.hidden = false; place(el, tip); };
    const hide = () => { tip.hidden = true; };
    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focus", show);
    el.addEventListener("blur", hide);
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    addEventListener("scroll", () => { if (!tip.hidden) place(el, tip); }, { passive: true });
  }
}
