// The room layer: a place's own page, revealed through its window as the camera zooms in. The clip circle is
// read from the window every tick, so the window and the page are one shared element. The seam that converts
// the medium plays inside the same circle once the window fills most of the stage.
import { landURL, liveURL } from "./data.js";
import { play } from "./seams.js";

const stage = () => document.getElementById("stage");
let R = null;  // { el, n, ring, state: 'opening'|'open'|'closing', seam, played, frame }

function sheet(n) {
  const s = document.createElement("article"); s.className = `sheet r-${n.region}`;
  const h = document.createElement("h2"); h.className = `r-${n.region}`; h.textContent = n.title; s.append(h);
  if (n.blurb) { const p = document.createElement("p"); p.textContent = n.blurb; s.append(p); }
  if (n.code) { const c = document.createElement("pre"); c.className = "code"; c.textContent = n.code; s.append(c); }
  const live = liveURL(n);
  if (live) { const a = document.createElement("a"); a.className = "enter"; a.href = live; a.textContent = n.kind === "essay" ? "Read" : "Open"; s.append(a); }
  return s;
}

let standby = null;  // { n, el }: the focused place's page, loaded quietly while its card is read
export function prepare(n) {
  if (standby?.n.id === n.id || (R && R.n.id === n.id)) return;
  standby?.el.remove(); standby = null;
  const go = () => { const el = build(n); el.classList.add("standby"); stage().append(el); standby = { n, el }; };
  (window.requestIdleCallback || setTimeout)(go, { timeout: 1500 });
}

export function build(n) {
  const el = document.createElement("div"); el.className = "room-layer"; el.setAttribute("role", "region"); el.setAttribute("aria-label", n.title);
  const land = landURL(n);
  if (land) {
    const f = document.createElement("iframe"); f.src = land; f.title = n.title; f.className = "room-frame"; el.append(f);
    // inside the universe the room is one layer: its own rail and its way back to the exhibit fold away
    f.addEventListener("load", () => { try { const s = f.contentDocument.createElement("style"); s.textContent = "header.rail,.skip,.top .back{display:none!important}"; f.contentDocument.head.append(s); } catch (e) { console.warn("room: could not fold the inner rail", e); } });
  }
  else el.append(sheet(n));
  const c = document.createElement("canvas"); c.className = "room-seam"; c.dataset.art = ""; c.setAttribute("aria-hidden", "true"); c.hidden = true; el.append(c);
  return el;
}

export function enterRoom(n, { ring, seam, from, u }) {
  if (R && R.n.id === n.id && R.state !== "closing") return;
  if (R) R.el.remove();
  let el;
  if (standby?.n.id === n.id) { el = standby.el; el.classList.remove("standby"); standby = null; } else { el = build(n); stage().append(el); }
  R = { el, n, ring, state: "opening", seam, from, u, played: false, canvas: el.querySelector(".room-seam") };
}

export function leaveRoom() { if (R) { R.state = "closing"; R.el.classList.remove("open"); } }
export function roomOpen(fullOnly = false) { return !!R && (!fullOnly || (R.state === "open" && R.full)); }

// Stepped by the map's clock.
export function roomTick() {
  if (!R) return;
  if (R.state === "open") return;
  const st = stage().getBoundingClientRect(), { x, y, r } = R.ring(), cover = Math.hypot(Math.max(x, st.width - x), Math.max(y, st.height - y));
  R.el.style.clipPath = `circle(${Math.max(0, r).toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
  R.el.style.opacity = String(Math.min(1, Math.max(0, (r / cover - 0.12) / 0.3)));
  R.full = r >= cover;
  if (R.state === "opening" && r / cover > 0.08 && !R.played) {  // the seam fills the window as it grows, then gives way to the page
    R.played = true;
    if (R.seam !== "fade" && R.from) { R.canvas.hidden = false; R.canvas.style.opacity = "1"; play(R.canvas, R.seam, { from: R.from, to: R.n, u: R.u }); }
    else R.canvas.hidden = true;
  }
  if (R.state === "opening" && R.full) { R.state = "open"; R.el.classList.add("open"); R.el.style.clipPath = "none"; R.el.querySelector("iframe,a")?.focus({ preventScroll: true }); }
  if (R.state === "open") return;
  if (R.state === "closing" && r / cover < 0.13) { R.el.remove(); R = null; }
}

// If the camera settles a hair short of covering the stage, the room still opens.
export function openNow() { if (R && R.state === "opening") { R.full = true; R.state = "open"; R.el.classList.add("open"); R.el.style.clipPath = "none"; R.el.style.opacity = "1"; } }
