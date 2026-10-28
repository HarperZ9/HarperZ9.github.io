// living-hook.js: living type over real headings, after the type engine's controller (typeengine/living/living.mjs)
// and its integration checklist. A heading with data-living="ink charcoal plant" is painted by the engine as the
// visitor walks through its section: s from the visitor's position, t from the shell's clock. The heading's own words
// stay in the DOM over the painting (transparent while painted, so they read aloud, select and search), and are the
// still fallback in Hanken Grotesk.
//   reduced motion   stops only, at t = 0
//   Plain view, weak devices, no WebGL2, a state the engine refuses at this size   the still face, no canvas
//   dark mode        the night ground; a viewer may keep the lit sheet ("Lit sheet" in the hand, remembered as
//                    localStorage["living-sheet"], hidden in light mode)
// At most LIVE headings hold a GL context at once (one on the home: with the water and the stage it makes the
// budget's three live canvases); a heading that leaves the screen hands its context back.
const root = document.documentElement, reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const off = () => root.classList.contains("plain") || root.classList.contains("weak");
const SHEET_KEY = "living-sheet";
const remember = { get: () => { try { return localStorage.getItem(SHEET_KEY); } catch { return null; } }, set: (v) => { try { localStorage.setItem(SHEET_KEY, v); } catch { /* private mode: the choice lasts for this page */ } } };
const isDark = () => { const t = root.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
const schemeNow = () => (isDark() && remember.get() !== "lit" ? "night" : "day");
const LIVE = 1, heads = [...document.querySelectorAll("[data-living]")];
if (heads.length && "OffscreenCanvas" in window && document.createElement("canvas").getContext("webgl2")) boot();

function sheetControl(onChange) {
  const hand = document.querySelector("header.o-hand"); if (!hand) return null;
  const b = document.createElement("button"); b.type = "button"; b.dataset.sheetToggle = ""; b.className = "o-sheet"; b.textContent = "Lit sheet";
  b.setAttribute("aria-pressed", String(remember.get() === "lit"));
  b.addEventListener("click", () => { remember.set(remember.get() === "lit" ? "night" : "lit"); onChange(); });
  hand.insertBefore(b, hand.querySelector('[data-o="peel"]'));
  return b;
}

async function boot() {
  let createLivingGL, progressAt, levelsOf;
  try { ({ createLivingGL } = await import("/world/typeengine/web/living-gl.mjs")); ({ progressAt, levelsOf } = await import("/world/typeengine/lib/living/axes.mjs")); }
  catch (e) { console.info("living type not loaded; headings stay in the still face", e.message); return; }
  const worker = new Worker("/world/typeengine/web/living-worker.mjs", { type: "module" });
  const P = new Map(), pending = new Set(), dpr = Math.min(2, devicePixelRatio || 1);
  let seq = 0;
  worker.onerror = (e) => console.info("living worker did not load; headings stay in the still face", e.message);
  worker.onmessage = (ev) => {
    const m = ev.data, p = [...P.values()].find((x) => x.id === m.id); if (!p) return;
    if (m.op === "error") { console.info("living: a heading stays still:", String(m.message).split("\n")[0]); release(p, true); return; }
    if (m.op === "init") { p.stops = m.stops; p.ready = true; return; }
    if (m.gen !== p.gen || !p.g) return;  // painted for a scheme the heading has left
    pending.delete(`${p.id}/${m.op}/${m.i}`);
    if (m.op === "stop") p.g.stop(m.i, m.part); else { p.g.move(m.i, m.part); p.moves[m.i] = m.part; }
  };
  const init = (p) => worker.postMessage({ id: p.id, op: "init", w: p.w, h: p.h, seed: 3, scheme: schemeNow(),
    stops: p.states.map((s, i) => (i ? { state: s } : { state: s, text: p.text })) });
  function claim(el) {
    if ([...P.values()].filter((x) => x.g).length >= LIVE) return null;
    const r = el.getBoundingClientRect(), w = Math.max(64, Math.min(1400, Math.round(r.width * dpr))), h = Math.max(32, Math.round(r.height * dpr));
    const c = document.createElement("canvas"); c.className = "living-paint"; c.setAttribute("aria-hidden", "true"); c.dataset.art = ""; c.width = w; c.height = h;
    let g; try { g = createLivingGL(c); } catch (e) { console.info("living: no GL here", e.message); return null; }
    el.classList.add("living-host"); el.append(c);
    const p = { id: `h${seq++}`, el, c, g, w, h, stops: null, ready: false, gen: 0, moves: {}, scheme: schemeNow(),
      states: el.dataset.living.split(/\s+/).filter(Boolean), text: el.firstChild?.textContent?.trim() || el.textContent.trim() };
    P.set(el, p); init(p); return p;
  }
  function release(p, refuse = false) {
    p.c.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    p.c.remove(); p.el.classList.remove("living-on", "living-host"); p.g = null; P.delete(p.el);
    for (const k of [...pending]) if (k.startsWith(p.id + "/")) pending.delete(k);
    if (refuse) p.el.removeAttribute("data-living");
  }
  function rescheme() {
    const sch = schemeNow(); if (btn) { btn.hidden = !isDark(); btn.setAttribute("aria-pressed", String(remember.get() === "lit")); }
    for (const p of P.values()) { if (!p.g || p.scheme === sch) continue; p.scheme = sch; p.gen++; p.ready = false; p.moves = {}; p.g.reset?.(); for (const k of [...pending]) if (k.startsWith(p.id + "/")) pending.delete(k); init(p); }
  }
  const btn = sheetControl(rescheme);
  new MutationObserver(rescheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rescheme);
  rescheme();
  const ask = (p, op, i) => { const k = `${p.id}/${op}/${i}`; if (pending.has(k) || p.g.has?.(op, i)) return; pending.add(k); worker.postMessage({ id: p.id, op, i, gen: p.gen }); };
  // a heading claims its context after it has held the middle of the view for a moment, so a fast scroll past
  // thirty headings builds no GL contexts at all; it hands the context back as it leaves the middle
  const DWELL = 350, waits = new Map();
  const io = new IntersectionObserver((es) => { for (const e of es) {
    const el = e.target, p = P.get(el);
    if (e.isIntersecting && !p && el.dataset.living && !off()) waits.set(el, setTimeout(() => { waits.delete(el); if (!P.get(el)) claim(el); }, DWELL));
    else if (!e.isIntersecting) { clearTimeout(waits.get(el)); waits.delete(el); if (p) release(p); }
  } }, { rootMargin: "-20% 0px -20% 0px" });
  for (const h of heads) io.observe(h);
  const t0 = performance.now(), lvl = (p, k, t) => { const a = p.stops[k].animate; return a && !reduced() ? progressAt(a, t) * (levelsOf(a).length - 1) : 0; };
  function frame() {
    if (off()) { for (const p of [...P.values()]) release(p); return; }
    const rm = reduced(), t = rm ? 0 : (performance.now() - t0) / 1000;
    for (const p of P.values()) {
      if (!p.g || !p.ready) continue;
      const sec = p.el.closest("section") || p.el, r = sec.getBoundingClientRect();
      const q = Math.min(1, Math.max(0, (innerHeight * 0.9 - r.top) / Math.max(1, r.height + innerHeight * 0.4)));
      const n = p.stops.length, s = rm ? Math.round(q * (n - 1)) : Math.min(n - 1, q * (n - 0.5)), i = Math.min(n - 1, Math.floor(s)), local = s - i, lead = 0.35;
      ask(p, "stop", i); if (!rm && i + 1 < n) { ask(p, "move", i); ask(p, "stop", i + 1); }
      let drawn;
      if (rm || i === n - 1 || local <= lead) drawn = p.g.draw({ i, mode: "stop", t, level: lvl(p, i, t) });
      else { const mv = p.moves[i] || {}; drawn = p.g.draw({ i, p: (local - lead) / (1 - lead), mode: "move", t, breath: mv.breath, breath2: mv.breath2, levelA: lvl(p, i, t), levelB: lvl(p, i + 1, t) }) || p.g.draw({ i, mode: "stop", t, level: lvl(p, i, t) }); }
      p.el.classList.toggle("living-on", !!drawn);
    }
  }
  const clock = window.UIShell?.clock;
  if (clock) clock.subscribe(frame);
  const fb = () => { if (!clock || clock.running === false) frame(); if (!document.hidden) requestAnimationFrame(fb); else document.addEventListener("visibilitychange", () => requestAnimationFrame(fb), { once: true }); };
  requestAnimationFrame(fb);
}
