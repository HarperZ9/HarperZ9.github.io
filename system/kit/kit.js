/* site-kit/kit.js: the rail (trail, map, back, lamp, motion, sound, plain view), living type, faders and knobs.
   Dependency-free; inlined into each page by inline.py. Storage keys match the live site's shell.js
   ("ui-theme", "ui-plain") so a viewer's choices carry between the site and these pages.
   Page API:  Kit.still() is true under reduced motion, Motion off or Plain view; loops should draw one
   settled frame and stop. Kit.on(fn) runs on every change of theme, motion, plain or sound.
   Kit.knob(input) upgrades one range input; [data-knob] inputs are upgraded on load. */
(() => {
  const root = document.documentElement, KEY = { theme: "ui-theme", plain: "ui-plain", motion: "ui-motion", sound: "ui-sound" };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: the choice lasts for this page */ } } };
  const mqDark = matchMedia("(prefers-color-scheme: dark)"), mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const subs = new Set();
  const state = { motion: store.get(KEY.motion) !== "0", sound: store.get(KEY.sound) === "1" };
  root.classList.add("js");
  const saved = store.get(KEY.theme); if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  if (store.get(KEY.plain) === "1") root.classList.add("plain");
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : mqDark.matches);
  const still = () => mqReduce.matches || !state.motion || root.classList.contains("plain");
  const emit = () => { root.classList.toggle("still", still()); for (const f of subs) { try { f(Kit); } catch (e) { console.error("kit subscriber failed", e); } } };

  /* ---------- sound: off by default; one short filtered tick for presses and detents ---------- */
  let ac = null;
  function tick(pitch = 1) {
    if (!state.sound) return;
    try {
      ac = ac || new AudioContext();
      const n = Math.floor(ac.sampleRate * 0.012), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
      const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = "bandpass"; bp.frequency.value = 2400 * pitch; bp.Q.value = 6; g.gain.value = 0.35;
      src.buffer = buf; src.connect(bp).connect(g).connect(ac.destination); src.start();
    } catch (e) { console.info("kit: no audio here", e.message); }
  }

  /* ---------- the rail: trail (world / group / page), named tools, the map, the layer jumps ---------- */
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const norm = (u) => { try { return decodeURIComponent(new URL(u, location.href).href).toLowerCase().replace(/[#?].*$/, ""); } catch { return String(u).toLowerCase(); } };
  function mapData() {
    const m = window.KIT_MAP; if (!m || !Array.isArray(m.groups)) return null;
    const here = norm(location.href);
    for (const g of m.groups) for (const p of g.pages) p.here = norm(p.href) === here;
    return m;
  }
  function rail() {
    if (document.querySelector(".k-rail") || document.body.dataset.kRail === "off") return;
    const m = mapData(), group = m && m.groups.find((g) => g.pages.some((p) => p.here));
    const title = document.body.dataset.title || (document.querySelector("h1") || {}).textContent || document.title;
    const home = document.body.dataset.home || "https://harperz9.github.io/";
    const nav = document.createElement("nav"); nav.className = "k-rail"; nav.setAttribute("aria-label", "Where you are");
    const tool = (k, name, tip) => `<button type="button" data-k="${k}" title="${esc(tip)}"><span class="k-glyph" aria-hidden="true"></span>${name}</button>`;
    nav.innerHTML = `<ol class="k-trail"><li><a href="${esc(home)}"><span class="k-mark" aria-hidden="true"><i style="background:#c8322b"></i><i style="background:#d79e35"></i><i style="background:#1d2562"></i></span><span class="k-world">World</span></a></li>`
      + (m ? `<li><button type="button" data-k="map" data-group="${esc(group ? group.id : "")}" aria-haspopup="dialog">${esc(group ? group.name : "Workshop")}</button></li>` : "")
      + `<li><span aria-current="page">${esc(title.trim())}</span></li></ol>`
      + `<div class="k-tools" role="group" aria-label="Page tools">`
      + (m ? tool("map", "Map", "Every page, by what it tells you (M)") : "")
      + tool("back", "Back", "Back to where you came from")
      + tool("lamp", "Lamp", "Lamp on: light page. Lamp off: dark page")
      + tool("motion", "Motion", "Moving type and simulations")
      + tool("sound", "Sound", "A soft tick when you press or turn something. Off unless you turn it on")
      + tool("peel", "Plain", "Plain view: text and controls only, no art layer") + `</div>`;
    const layers = [...document.querySelectorAll("[data-layer]")];
    if (layers.length) {
      const ul = document.createElement("ul"); ul.className = "k-jumps"; ul.setAttribute("aria-label", "On this page");
      layers.forEach((l, i) => { if (!l.id) l.id = `layer-${l.dataset.layer}`; const h = l.querySelector("h2"); ul.insertAdjacentHTML("beforeend", `<li><a href="#${l.id}" data-n="${i + 1}">${esc(h ? h.textContent.trim() : l.dataset.layer)}</a></li>`); });
      nav.append(ul);
      const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) ul.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${e.target.id}`))); }, { rootMargin: "-40% 0px -55% 0px" });
      layers.forEach((l) => io.observe(l));
    }
    const skip = document.querySelector("body > .skip, body > a.skip"); if (skip) skip.after(nav); else document.body.prepend(nav);
    const size = () => root.style.setProperty("--k-rail", `${getComputedStyle(nav).position === "sticky" ? nav.offsetHeight : 0}px`);
    size(); addEventListener("resize", size);
    if (m) mapDialog(m);
  }
  function mapDialog(m) {
    const d = document.createElement("dialog"); d.className = "k-map"; d.setAttribute("aria-labelledby", "k-map-h");
    d.innerHTML = `<header><h2 id="k-map-h">The workshop map</h2><input type="search" aria-label="Find a page" placeholder="Find a page"><button type="button" data-close>Close</button></header>`
      + m.groups.map((g) => `<section data-group="${esc(g.id)}"><h3>${esc(g.name)}</h3><ul>${g.pages.map((p) => `<li><a href="${esc(p.href)}"${p.here ? ' aria-current="page"' : ""}><b>${esc(p.title)}</b><span>${esc(p.message || "")}</span></a></li>`).join("")}</ul></section>`).join("");
    document.body.append(d);
    const find = d.querySelector("input");
    find.addEventListener("input", () => { const q = find.value.trim().toLowerCase();
      for (const li of d.querySelectorAll("li")) li.hidden = q && !li.textContent.toLowerCase().includes(q);
      for (const s of d.querySelectorAll("section")) s.hidden = ![...s.querySelectorAll("li")].some((li) => !li.hidden); });
    d.querySelector("[data-close]").addEventListener("click", () => d.close());
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); d.close(); } });
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    Kit.openMap = (groupId) => { d.showModal(); const s = groupId && d.querySelector(`section[data-group="${CSS.escape(groupId)}"]`); (s ? s.querySelector("a") : find).focus(); };
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() !== "m" || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,textarea,select,[contenteditable]")) return;
      e.preventDefault(); if (d.open) d.close(); else Kit.openMap();
    });
  }
  function bindTools() {
    const sync = () => {
      for (const b of document.querySelectorAll('[data-k="lamp"],[data-theme-toggle]')) b.setAttribute("aria-pressed", String(!isDark()));
      for (const b of document.querySelectorAll('[data-k="motion"]')) b.setAttribute("aria-pressed", String(state.motion && !mqReduce.matches));
      for (const b of document.querySelectorAll('[data-k="sound"]')) b.setAttribute("aria-pressed", String(state.sound));
      for (const b of document.querySelectorAll('[data-k="peel"],[data-plain-toggle]')) b.setAttribute("aria-pressed", String(root.classList.contains("plain")));
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest('[data-k],[data-theme-toggle],[data-plain-toggle]'); if (!b) return;
      const k = b.dataset.k || ("themeToggle" in b.dataset ? "lamp" : "peel");
      if (k === "map") { Kit.openMap && Kit.openMap(b.dataset.group); return; }
      if (k === "back") { if (history.length > 1 && document.referrer) history.back(); else if (Kit.openMap) Kit.openMap(); else location.href = document.body.dataset.home || "https://harperz9.github.io/"; return; }
      if (k === "lamp") { root.dataset.theme = isDark() ? "light" : "dark"; store.set(KEY.theme, root.dataset.theme); }
      else if (k === "motion") { state.motion = !state.motion; store.set(KEY.motion, state.motion ? "1" : "0"); }
      else if (k === "sound") { state.sound = !state.sound; store.set(KEY.sound, state.sound ? "1" : "0"); tick(); }
      else if (k === "peel") { root.classList.toggle("plain"); store.set(KEY.plain, root.classList.contains("plain") ? "1" : "0"); }
      else return;
      sync(); emit();
    });
    mqDark.addEventListener("change", () => { sync(); emit(); }); mqReduce.addEventListener("change", () => { sync(); emit(); });
    sync();
  }

  /* ---------- living type: weight, second ink and medium move with the reader and the clock ---------- */
  const FACES = { display: "Accession Display", burin: "Accession Burin", material: "Accession Material", super: "Accession Super", mono: "Accession Mono",
    slab: "Accession Slab", divisumma: "Accession Divisumma", engraved: "Accession Engraved", text: "Accession Text" };
  const REGION_STOPS = { grid: "display slab", deco: "divisumma display", brut: "super slab", surreal: "display material", print: "material display", glitch: "mono display", archive: "burin engraved" };
  /* period: seconds each medium holds; fade: share of the period spent bleeding into the next medium */
  const LIVING = { wLow: 620, wHigh: 860, breath: 26, breathRate: 0.8, inkRate: 0.35, drift: 0.02, period: 9, fade: 0.22, fitTol: 0.15 };
  function living() {
    const region = document.body.dataset.region || "grid";
    const heads = [...document.querySelectorAll("[data-living]")];
    const h1 = document.querySelector("h1"); if (h1 && !h1.hasAttribute("data-living") && h1.dataset.living !== "off") { h1.dataset.living = REGION_STOPS[region] || "display"; heads.unshift(h1); }
    const items = heads.filter((el) => el.dataset.living !== "off").map((el) => {
      const stops = el.dataset.living.split(/\s+/).map((s) => FACES[s]).filter(Boolean);
      let layer = null;
      if (stops.length > 1) { layer = document.createElement("span"); layer.className = "lv-layer"; layer.setAttribute("aria-hidden", "true"); layer.textContent = el.textContent; el.append(layer); }
      return { el, stops, layer, seen: false };
    });
    if (!items.length) return;

    const io = new IntersectionObserver((es) => { for (const e of es) { const it = items.find((x) => x.el === e.target); if (it) it.seen = e.isIntersecting; } }, { rootMargin: "20% 0px" });
    items.forEach((it) => io.observe(it.el));
    const t0 = performance.now();
    function paint(it, t, rm) {
      const r = it.el.getBoundingClientRect(), q = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
      const n = it.stops.length, ph = rm ? 0 : ((t / LIVING.period + q) % n + n) % n, i = Math.floor(ph), local = ph - i;
      const w = LIVING.wLow + (LIVING.wHigh - LIVING.wLow) * (rm ? 0.6 : q) + (rm ? 0 : LIVING.breath * Math.sin(t * LIVING.breathRate));
      const f = rm ? 0 : 0.5 + 0.5 * Math.sin(t * LIVING.inkRate + q * Math.PI);
      const st = it.el.style;
      st.setProperty("--lv-w", w.toFixed(0)); st.fontFamily = `"${it.stops[i]}", var(--face-head)`;
      st.setProperty("--lv-ink", `color-mix(in oklab, var(--red) ${(100 - f * 100).toFixed(0)}%, var(--s5))`);
      st.setProperty("--lv-dx", `${(0.035 + (rm ? 0 : LIVING.drift * Math.sin(t * 0.5))).toFixed(3)}em`);
      if (it.layer) {
        const o = rm || local < 1 - LIVING.fade ? 0 : (local - (1 - LIVING.fade)) / LIVING.fade;
        /* the next medium's face is requested only once the bleed starts, so a still page loads one face */
        if (o > 0 || local > 1 - LIVING.fade - 0.04) it.layer.style.fontFamily = `"${it.stops[(i + 1) % n]}", var(--face-head)`;
        const o2 = o > 0 && Math.abs(it.layer.offsetHeight - it.el.offsetHeight) > it.el.offsetHeight * LIVING.fitTol ? 0 : o; st.setProperty("--lv-o", o2.toFixed(3)); it.el.classList.toggle("lv-on", o2 > 0);
      }
    }
    function frame() {
      if (root.classList.contains("plain")) { for (const it of items) { it.el.removeAttribute("style"); it.el.classList.remove("lv-on"); } return; }
      const rm = still(), t = rm ? 0 : (performance.now() - t0) / 1000;
      for (const it of items) if (it.seen || rm) paint(it, t, rm);
    }
    let raf = 0;
    const loop = () => { frame(); raf = still() || document.hidden ? 0 : requestAnimationFrame(loop); };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    addEventListener("scroll", () => { if (still()) frame(); else kick(); }, { passive: true });
    document.addEventListener("visibilitychange", kick); subs.add(() => { frame(); kick(); });
    kick();
  }

  /* ---------- faders: Shift moves ten steps; the filled part of the slot follows the value ---------- */
  const COARSE = 10;
  const fill = (r) => { const lo = +r.min || 0, hi = r.max === "" ? 100 : +r.max; r.style.setProperty("--k-fill", `${((+r.value - lo) / ((hi - lo) || 1)) * 100}%`); };
  function stepOf(r) { return r.step === "any" || !r.step ? ((+r.max || 100) - (+r.min || 0)) / 100 : +r.step; }
  function setRange(r, v, fire = "input") {
    const lo = +r.min || 0, hi = r.max === "" ? 100 : +r.max, st = stepOf(r);
    const snapped = Math.min(hi, Math.max(lo, lo + Math.round((v - lo) / st) * st));
    const before = r.value; r.value = String(+snapped.toFixed(6)); fill(r);
    if (r.value !== before) { r.dispatchEvent(new Event(fire, { bubbles: true })); if (fire === "input") r._kitDirty = true; return true; }
    return false;
  }
  function faders() {
    document.addEventListener("keydown", (e) => {
      const r = e.target; if (!(r instanceof HTMLInputElement) || r.type !== "range" || !e.shiftKey) return;
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!dir) return;
      e.preventDefault(); if (setRange(r, +r.value + dir * stepOf(r) * COARSE)) { r.dispatchEvent(new Event("change", { bubbles: true })); tick(1.2); }
    });
    document.addEventListener("input", (e) => { if (e.target.type === "range") fill(e.target); });
    document.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) tick(0.8); });
    document.querySelectorAll('input[type="range"]').forEach(fill);
  }

  /* ---------- knobs: a 270 degree sweep, detents on stepped values, momentum on continuous ones ---------- */
  const KNOB = { sweep: 270, pxPerRange: 180, maxDetents: 24, friction: 0.9, minSpeed: 1e-5, velWindowMs: 80 };
  const NS = "http://www.w3.org/2000/svg";
  function knob(input) {
    if (input._kitKnob) return; input._kitKnob = true;
    const lo = +input.min || 0, hi = input.max === "" ? 100 : +input.max, st = stepOf(input), steps = Math.round((hi - lo) / st);
    const detents = input.step !== "any" && steps <= KNOB.maxDetents;
    let wrap0 = false;
    const lab = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    const name = input.dataset.label || (lab ? lab.textContent.trim() : input.getAttribute("aria-label") || input.name || "");
    if (lab && !input.hasAttribute("data-keep-label")) lab.classList.add("sr-only"); else if (lab) wrap0 = true; else if (!input.getAttribute("aria-label")) input.setAttribute("aria-label", name);
    const wrap = document.createElement("div"); wrap.className = "k-knob";
    wrap.innerHTML = `<span class="k-label" aria-hidden="true"></span><div class="k-dial" aria-hidden="true"><svg viewBox="-32 -32 64 64"></svg></div><span class="k-read" aria-hidden="true"></span>`;
    wrap.querySelector(".k-label").textContent = wrap0 ? "" : name; if (wrap0) wrap.classList.add("k-keep-label");
    input.replaceWith(wrap); wrap.append(input);
    const svg = wrap.querySelector("svg"), dial = wrap.querySelector(".k-dial"), read = wrap.querySelector(".k-read");
    const ang = (v) => -KNOB.sweep / 2 + ((v - lo) / ((hi - lo) || 1)) * KNOB.sweep;
    const pt = (a, rad) => [rad * Math.sin((a * Math.PI) / 180), -rad * Math.cos((a * Math.PI) / 180)];
    const arcPath = (a0, a1, rad) => { const [x0, y0] = pt(a0, rad), [x1, y1] = pt(a1, rad); return `M${x0} ${y0}A${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
    const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.append(e); return e; };
    el("path", { class: "k-arc", d: arcPath(-KNOB.sweep / 2, KNOB.sweep / 2, 30) });
    const on = el("path", { class: "k-arc-on" });
    const nt = detents ? steps : 10;
    for (let i = 0; i <= nt; i++) { const a = -KNOB.sweep / 2 + (i / nt) * KNOB.sweep, [x0, y0] = pt(a, 26), [x1, y1] = pt(a, detents ? 23 : 24); el("line", { class: "k-tick", x1: x0, y1: y0, x2: x1, y2: y1 }); }
    el("circle", { class: "k-skirt", r: 21 });
    const face = el("g", { class: "k-face" });
    el("circle", { class: "k-cap", r: 17 }, face);
    for (let i = 0; i < 24; i++) { const [x0, y0] = pt(i * 15, 17), [x1, y1] = pt(i * 15, 14.5); el("line", { class: "k-grip", x1: x0, y1: y0, x2: x1, y2: y1 }, face); }
    el("line", { class: "k-ptr", x1: 0, y1: -6, x2: 0, y2: -15 }, face);
    const dec = String(st).includes(".") ? Math.min(4, String(st).split(".")[1].length) : 0;
    const names = input.dataset.labels ? input.dataset.labels.split("|") : null;
    const draw = () => {
      const v = +input.value, a = ang(v), txt = names ? (names[Math.round((v - lo) / st)] ?? "") : (+v).toFixed(dec) + (input.dataset.unit || "");
      face.setAttribute("transform", `rotate(${a})`); on.setAttribute("d", a > -KNOB.sweep / 2 + 0.5 ? arcPath(-KNOB.sweep / 2, a, 30) : "");
      read.textContent = txt; input.setAttribute("aria-valuetext", txt);
    };
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(input, "value", { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); draw(); }, configurable: true });
    input.addEventListener("input", draw); input.addEventListener("change", draw);
    let drag = null, coast = 0;
    const commit = (v) => { const d0 = Math.round((+input.value - lo) / st); if (setRange(input, v)) { if (detents && Math.round((+input.value - lo) / st) !== d0) { tick(1 + (+input.value - lo) / (hi - lo || 1) * 0.5); navigator.vibrate?.(4); } } };
    dial.addEventListener("pointerdown", (e) => {
      e.preventDefault(); cancelAnimationFrame(coast); input.focus({ preventScroll: true }); dial.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, v: +input.value, acc: +input.value, hist: [[performance.now(), +input.value]] };
    });
    dial.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const gain = (e.shiftKey ? 4 : 1) * (hi - lo) / KNOB.pxPerRange;
      drag.acc = drag.v + (drag.y - e.clientY) * gain; commit(drag.acc);
      const now = performance.now(); drag.hist.push([now, drag.acc]); while (drag.hist.length > 2 && now - drag.hist[0][0] > KNOB.velWindowMs) drag.hist.shift();
    });
    const end = () => {
      if (!drag) return; const h = drag.hist, a = h[0], b = h[h.length - 1]; let vel = (b[1] - a[1]) / Math.max(1, b[0] - a[0]) * 16; drag = null;
      const done = () => { if (input._kitDirty) { input._kitDirty = false; input.dispatchEvent(new Event("change", { bubbles: true })); } };
      if (detents || still() || Math.abs(vel) < (hi - lo) * 0.002) return done();
      let v = +input.value;
      const glide = () => { vel *= KNOB.friction; v += vel; commit(v); if (Math.abs(vel) > (hi - lo) * KNOB.minSpeed && v > lo && v < hi) coast = requestAnimationFrame(glide); else done(); };
      coast = requestAnimationFrame(glide);
    };
    dial.addEventListener("pointerup", end); dial.addEventListener("pointercancel", end);
    dial.addEventListener("wheel", (e) => { e.preventDefault(); commit(+input.value - Math.sign(e.deltaY) * st * (e.shiftKey ? COARSE : 1)); input.dispatchEvent(new Event("change", { bubbles: true })); }, { passive: false });
    dial.addEventListener("dblclick", () => { if (setRange(input, +input.defaultValue)) input.dispatchEvent(new Event("change", { bubbles: true })); });
    draw();
  }


  /* ---------- registration marks: each frame's slug carries one mark grown from a seed and the region's species.
     After generative borders made from frame size, a seed and a species file. Deterministic per page and frame;
     drawn in the slug below the frame (never beside it, so nothing widens the page); hidden in plain view. ---------- */
  const SPECIES = {
    grid: (r) => `<circle cx="11" cy="11" r="${4 + r() * 2 | 0}"/><path d="M11 1v20M1 11h20"/>`,
    brut: (r) => `<rect x="${6 + r() * 3 | 0}" y="6" width="10" height="10" fill="#000"/><path d="M1 11h20"/>`,
    print: () => `<circle cx="5" cy="11" r="3" fill="#000"/><circle cx="11" cy="11" r="3" fill="#000"/><circle cx="17" cy="11" r="3" fill="#000"/>`,
    glitch: (r) => `<path d="M1 ${8 + r() * 3 | 0}h9M12 ${12 + r() * 3 | 0}h9"/>`,
    archive: () => `<path d="M2 15h18M2 18h18"/><circle cx="11" cy="8" r="3"/>`,
    deco: () => `<path d="M3 19a16 16 0 0 1 16-16M7 19a12 12 0 0 1 12-12M11 19a8 8 0 0 1 8-8"/>`,
    surreal: (r) => `<ellipse cx="11" cy="11" rx="9" ry="${4 + r() * 2 | 0}"/><circle cx="11" cy="11" r="2" fill="#000"/>`,
  };
  function marks() {
    const species = SPECIES[document.body.dataset.region] || SPECIES.grid;
    let h = 2166136261; for (const c of location.pathname + (document.querySelector("h1") || {}).textContent) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    document.querySelectorAll(".k-frame").forEach((f, i) => {
      if (f.querySelector(":scope > .k-reg") || f.closest("[data-k-marks='off']")) return;
      let s = (h ^ Math.imul(i + 1, 2654435761)) >>> 0; const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) % 1000) / 1000;
      const x = 18 + r() * 64, cm = 7 + Math.round(r() * 6);
      f.style.setProperty("--k-cm", `${cm}px`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none" stroke="#000" stroke-width="1.2">${species(r)}</svg>`;
      const mark = document.createElement("i"); mark.className = "k-reg"; mark.setAttribute("aria-hidden", "true");
      mark.style.left = `${x.toFixed(1)}%`; mark.style.setProperty("--k-reg", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      f.append(mark); /* an <i> with a mask, not an <svg>, so a page's own frame.querySelector("svg") still finds its figure */
    });
  }

  /* ---------- every canvas gets a text alternative; the page's own label wins ---------- */
  function canvases() {
    const missing = [];
    for (const c of document.querySelectorAll("canvas")) {
      if (c.getAttribute("aria-hidden") === "true" || c.getAttribute("aria-label") || c.getAttribute("aria-labelledby")) continue;
      const fig = c.closest("figure"), cap = fig && fig.querySelector("figcaption");
      const sec = c.closest("section,article,main"), head = sec && sec.querySelector("h1,h2,h3");
      c.setAttribute("role", "img"); c.setAttribute("aria-label", c.dataset.alt || c.title || (cap ? cap.textContent.trim() : head ? `Figure: ${head.textContent.trim()}` : "Figure"));
      missing.push(c.id || c.className || "canvas");
    }
    if (missing.length) console.info("kit: canvases labelled from context; give them data-alt:", missing.join(", "));
  }

  const Kit = window.Kit = { still, isDark, tick, knob, setRange, on: (f) => { subs.add(f); return () => subs.delete(f); }, get sound() { return state.sound; } };
  function boot() { rail(); bindTools(); faders(); document.querySelectorAll('input[type="range"][data-knob]').forEach(knob); canvases(); marks(); living(); emit(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
