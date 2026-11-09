// swatches.js: the design's measured colours as usable parts. mountSwatches(host, data) renders each set as
// real buttons: a press copies the hex, and a live region says what was copied. Overprint sets show each pair
// of inks, the overlap the print measured, and the overlap an ideal multiply predicts, with the gap (CIE76 dE).
// Every swatch shows its hex as text; colour is never the only carrier.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function chip(hex, name, extra = "") {
  return `<button type="button" class="sw" data-hex="${esc(hex)}" aria-label="${esc(name)} ${esc(hex)}, copy">` +
    `<span class="sw-ink" style="--sw:${esc(hex)}"${extra}></span><span class="sw-hex">${esc(hex)}</span><span class="sw-name">${esc(name)}</span></button>`;
}

function setHTML(s) {
  const src = s.source ? `<a class="sw-src" href="${esc(s.source.url)}" rel="noopener external">${esc(s.source.title)}</a>` : "";  // a work and its public source, never a file path
  let body = "";
  if (s.centre) {
    // one centre on four grounds: the Albers move, each ground a button and the shared centre a button
    body = `<div class="sw-row">${s.swatches.map((g) => `<div class="sw-nest" style="--g:${esc(g.hex)};--c:${esc(s.centre)}">${chip(g.hex, g.name + " ground")}<span class="sw-centre" aria-hidden="true"></span></div>`).join("")}</div>` +
      `<div class="sw-row">${chip(s.centre, "the centre")}</div>`;
  } else body = `<div class="sw-row">${s.swatches.map((w) => chip(w.hex, w.name)).join("")}</div>`;
  if (s.overlaps) {
    body += `<ol class="sw-over" style="--paper:${esc(s.swatches[0].hex)}">${s.overlaps.map((o) => `<li><span class="sw-stack" aria-hidden="true" style="--a:${esc(o.a)};--b:${esc(o.b)};--m:${esc(o.measured)}"><i></i><i></i><b></b></span>` +
      `${chip(o.measured, o.pair + " printed")}${chip(o.multiply, o.pair + " multiply")}` +
      `<span class="sw-de">${o.de76 == null ? "" : "&Delta;E " + esc(o.de76)}</span></li>`).join("")}</ol>`;
  }
  return `<section class="sw-set" aria-labelledby="sw-${esc(s.id)}"><h3 id="sw-${esc(s.id)}">${esc(s.title)}</h3>${body}${src}</section>`;
}

export function mountSwatches(host, data) {
  host.classList.add("swatches");
  host.innerHTML = data.sets.map((s) => setHTML(s)).join("") + `<p class="sw-live" role="status" aria-live="polite"></p>`;
  const live = host.querySelector(".sw-live");
  host.addEventListener("click", async (e) => {
    const b = e.target.closest(".sw"); if (!b) return;
    const hex = b.dataset.hex;
    try { await navigator.clipboard.writeText(hex); live.textContent = `Copied ${hex}`; }
    catch (err) { console.info("clipboard unavailable:", err.message); live.textContent = hex; } // the hex stays readable and selectable
    for (const x of host.querySelectorAll(".sw.copied")) x.classList.remove("copied");
    b.classList.add("copied");
  });
}
