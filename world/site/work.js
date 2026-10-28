// work.js: the astrolabe. One choice, three ways to make it: the list (keys and screen readers, a tab list),
// the dial (pointer: click a moon, or turn the rete and let go), and the address (/#w-engine).
// The open pillar's moon turns to the index at the top, under the one light; the moving moon leaves a frame-offset
// echo at k = 3, 5 and 8 frames (superframe lib/stack). The engraving is the 1462 astrolabe through a two-ink 4x4
// ordered dither, drawn once on the plate so the cell turns with it. Reduced motion: the rete jumps, no echo, the
// held frame stays still. Without scripts none of this runs and the panels read in order.
const root = document.documentElement;
const reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain");
const work = document.getElementById("work");
const say = (t) => { const s = document.getElementById("say"); if (s) s.textContent = t; };

if (work) {
  const links = [...work.querySelectorAll(".w-list a[data-pillar]")];
  const ids = links.map((a) => a.dataset.pillar);
  const panels = new Map(ids.map((id) => [id, document.getElementById(`w-${id}`)]));
  const N = ids.length - 1;               // moons; ids[0] is the hub
  const STEP = 360 / N, R_MOON = 360, C = 500;
  let current = null, rot = 0, target = 0, trail = [], raf = 0, light = { x: 50, y: 50 }, lightTo = { x: 50, y: 50 };

  // ---- the list becomes a tab list; the panels become its tab panels ----
  const ol = work.querySelector(".w-list ol");
  ol.setAttribute("role", "tablist"); ol.setAttribute("aria-orientation", "vertical");
  for (const li of ol.children) li.setAttribute("role", "presentation");
  links.forEach((a) => {
    const id = a.dataset.pillar;
    a.setAttribute("role", "tab"); a.id = `wt-${id}`; a.setAttribute("aria-controls", `w-${id}`);
    const p = panels.get(id); p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", `wt-${id}`);
  });
  work.classList.add("w-live");

  // ---- choices inside a panel ----
  for (const fig of work.querySelectorAll(".w-demo")) {
    const group = fig.querySelector(".w-choices"); if (!group) continue;
    group.hidden = false;
    const states = [...fig.querySelectorAll(".w-state")];
    const show = (i) => {
      for (const b of group.querySelectorAll("button")) b.setAttribute("aria-pressed", String(+b.dataset.show === i));
      states.forEach((s, j) => s.classList.toggle("on", j === i));
      const held = states[i]?.querySelector("[data-held]"); if (held) live(held);
    };
    group.addEventListener("click", (e) => { const b = e.target.closest("button[data-show]"); if (b) show(+b.dataset.show); });
    show(0);
  }
  // the wipe between the ray-traced reference and the shortcut
  for (const w of work.querySelectorAll(".w-wipe")) {
    const ctl = w.querySelector(".w-wipe-control"), input = ctl?.querySelector("input"), top = w.querySelector(".w-wipe-top");
    if (!input || !top) continue;
    ctl.hidden = false;
    const set = () => top.style.setProperty("--split", `${input.value}%`);
    input.addEventListener("input", set); set();
  }
  // the held frame: grain and rain re-roll on twos for a few seconds, then the still holds
  function live(held) {
    if (still() || held.dataset.running) return;
    held.dataset.running = "1"; let n = 0;
    const t = setInterval(() => {
      held.classList.toggle("b", n % 2 === 0); n++;
      if (n > 72 || !held.offsetParent) { clearInterval(t); held.classList.remove("b"); delete held.dataset.running; }
    }, 1000 / 12);
  }

  // ---- the dial ----
  const dial = work.querySelector("[data-dial]");
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a = {}, parent) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent?.append(e); return e; };
  const face = document.createElement("div"); face.className = "w-face";
  const engraving = document.createElement("canvas"); engraving.className = "w-engraving"; engraving.width = engraving.height = 400;
  const glow = document.createElement("div"); glow.className = "w-light";
  const svg = el("svg", { class: "w-svg", viewBox: "0 0 1000 1000" });
  dial.append(face, engraving, glow, svg);

  // the limb: eight arcs that do not turn, and the index at the top where the open moon comes to rest
  const arc = (r0, r1, a0, a1) => {
    const p = (r, a) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
    const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
  };
  for (let i = 0; i < N; i++) el("path", { class: "limb", d: arc(452, 486, i * STEP + 4 + STEP / 2, (i + 1) * STEP - 4 + STEP / 2) }, svg);
  el("line", { class: "index", x1: C, y1: 18, x2: C, y2: 96 }, svg);
  const rete = el("g", { class: "rete" }, svg);
  for (const r of [140, 250, R_MOON, 404]) el("circle", { class: "orbit", cx: C, cy: C, r }, rete);
  el("circle", { class: "orbit", cx: C, cy: C - 46, r: 300 }, rete);   // the eccentric ecliptic ring
  const echoes = [3, 5, 8].map((k, i) => ({ k, node: el("circle", { class: "echo", r: 22, fill: ["#f0927c", "#6fc6dc", "#a9dc8c"][i], "fill-opacity": 0.55, cx: C, cy: C, visibility: "hidden" }, svg) }));
  const hub = el("circle", { class: "hub", cx: C, cy: C, r: 52 }, svg);
  const hubNum = el("text", { class: "numeral", x: C, y: C }, svg); hubNum.textContent = "00";
  const moons = [], nums = [];
  for (let i = 1; i <= N; i++) {
    moons.push(el("circle", { class: "moon", r: 22, "data-i": i }, svg));
    const t = el("text", { class: "numeral" }, svg); t.textContent = String(i).padStart(2, "0"); nums.push(t);
  }
  const pos = (i, r = R_MOON) => { const a = ((i - 1) * STEP + rot) * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };

  function draw() {
    for (let i = 1; i <= N; i++) {
      const [x, y] = pos(i), [tx, ty] = pos(i, R_MOON - 52);
      moons[i - 1].setAttribute("cx", x); moons[i - 1].setAttribute("cy", y);
      nums[i - 1].setAttribute("x", tx); nums[i - 1].setAttribute("y", ty);
    }
    engraving.style.transform = `rotate(${rot}deg)`;
    const sel = ids.indexOf(current);
    trail.push(rot); if (trail.length > 12) trail.shift();
    for (const e of echoes) {
      const past = trail[trail.length - 1 - e.k];
      if (sel < 1 || past === undefined || Math.abs(past - rot) < 0.5 || still()) { e.node.setAttribute("visibility", "hidden"); continue; }
      const a = ((sel - 1) * STEP + past) * Math.PI / 180;
      e.node.setAttribute("visibility", "visible"); e.node.setAttribute("cx", C + R_MOON * Math.sin(a)); e.node.setAttribute("cy", C - R_MOON * Math.cos(a));
    }
    glow.style.setProperty("--lx", `${light.x}%`); glow.style.setProperty("--ly", `${light.y}%`);
  }
  function animate() {
    cancelAnimationFrame(raf);
    const step = () => {
      const d = target - rot;
      if (still() || Math.abs(d) < 0.05) { rot = target; light = { ...lightTo }; trail = []; draw(); return; }
      rot += d * 0.09; light.x += (lightTo.x - light.x) * 0.12; light.y += (lightTo.y - light.y) * 0.12;
      draw(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const nearest = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180;

  function select(id, { focus = false, announce = true } = {}) {
    if (!panels.has(id)) id = ids[0];
    current = id;
    links.forEach((a) => {
      const on = a.dataset.pillar === id;
      a.setAttribute("aria-selected", String(on)); a.tabIndex = on ? 0 : -1;
      panels.get(a.dataset.pillar).classList.toggle("open", on);
    });
    const i = ids.indexOf(id);
    hub.classList.toggle("on", i === 0); hubNum.classList.toggle("on", i === 0);
    moons.forEach((m, j) => m.classList.toggle("on", j + 1 === i)); nums.forEach((t, j) => t.classList.toggle("on", j + 1 === i));
    if (i > 0) { target = nearest(rot, -(i - 1) * STEP); lightTo = { x: 50, y: 6 }; } else { lightTo = { x: 50, y: 50 }; }
    animate();
    if (focus) links[i].focus();
    if (announce) say(`${links[i].textContent.replace(/^\s*\d+\s*/, "")}, open`);
    const held = panels.get(id).querySelector(".w-state.on [data-held]"); if (held) live(held);
  }
  // the address bar
  const historyApi = window.history;
  function go(id, opts) { select(id, opts); if (opts?.push) historyApi.replaceState(null, "", `#w-${id}`); }

  // the list: click, and arrow keys between tabs (automatic activation)
  links.forEach((a, i) => {
    a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.pillar, { push: true }); });
    a.addEventListener("keydown", (e) => {
      const k = e.key; let j = null;
      if (k === "ArrowDown" || k === "ArrowRight") j = (i + 1) % links.length;
      else if (k === "ArrowUp" || k === "ArrowLeft") j = (i - 1 + links.length) % links.length;
      else if (k === "Home") j = 0; else if (k === "End") j = links.length - 1;
      if (j === null) return;
      e.preventDefault(); go(ids[j], { focus: true, push: true });
    });
  });

  // the dial: a click on a moon or the hub opens it; a drag turns the rete and, on release, opens the moon at the index
  let drag = null;
  const angleAt = (e) => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; };
  dial.addEventListener("pointerdown", (e) => { drag = { a: angleAt(e), rot, moved: 0, x: e.clientX, y: e.clientY }; dial.setPointerCapture(e.pointerId); });
  dial.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    if (drag.moved < 6) return;
    let d = angleAt(e) - drag.a; d = ((d + 540) % 360) - 180;
    rot = drag.rot + d; target = rot; draw();
  });
  dial.addEventListener("pointerup", (e) => {
    if (!drag) return; const moved = drag.moved; drag = null;
    if (moved >= 6) { const k = Math.round(-rot / STEP); go(ids[((k % N) + N) % N + 1], { push: true }); return; }
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t === hub || t === hubNum) go(ids[0], { push: true });
    else if (t?.classList.contains("moon")) go(ids[+t.dataset.i], { push: true });
  });
  dial.addEventListener("pointercancel", () => { drag = null; });

  // the address: /#w-engine opens the engine; the browser's back and forward follow
  const fromHash = () => { const m = location.hash.match(/^#w-([a-z-]+)$/); return m && panels.has(m[1]) ? m[1] : null; };
  addEventListener("hashchange", () => { const id = fromHash(); if (id) go(id); });
  const first = fromHash();
  go(first || ids[0], { announce: false });
  if (first) work.scrollIntoView({ block: "start" });

  // ---- the engraving: the astrolabe scan through a two-ink 4x4 Bayer dither, on the plate ----
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function engrave() {
    const img = new Image(); img.decoding = "async";
    img.onload = () => {
      const S = engraving.width, x = engraving.getContext("2d", { willReadFrequently: true });
      x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(S / 2, S / 2, S * 0.5, 0, Math.PI * 2); x.clip();
      x.drawImage(img, 0, 0, S, S); x.restore();
      const d = x.getImageData(0, 0, S, S), p = d.data;
      for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
        const o = (y * S + X) * 4; if (!p[o + 3]) continue;
        const L = (0.2126 * p[o] + 0.7152 * p[o + 1] + 0.0722 * p[o + 2]) / 255;
        const t = (BAYER[(y & 3) * 4 + (X & 3)] + 0.5) / 16;
        const lit = L * 0.62 > t;                      // the engraving's light lines; the field stays dark
        p[o] = 214; p[o + 1] = 205; p[o + 2] = 188; p[o + 3] = lit ? 92 : 0;
      }
      x.putImageData(d, 0, 0);
    };
    img.onerror = (e) => console.warn("work: the engraving did not load; the dial shows without it", e);
    img.src = "/media/front-door/astrolabe-met-1462-640.webp";
  }
  const later = () => ("requestIdleCallback" in window ? requestIdleCallback(engrave, { timeout: 2500 }) : setTimeout(engrave, 600));
  if (document.readyState === "complete") later(); else addEventListener("load", later, { once: true });
  reducedQ.addEventListener("change", () => { trail = []; draw(); });
}
