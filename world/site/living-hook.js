// living-hook.js: living type over real headings. A heading with data-living="ink charcoal plant" is painted by
// the type engine's living type (typeengine lib/living through web/living-worker.mjs and web/living-gl.mjs): the
// word changes medium as the visitor walks through its section. The heading's own text stays in the DOM under the
// painting (transparent while painted, so it still reads aloud, selects and searches) and is the still fallback in
// Hanken Grotesk under reduced motion, in Plain view, on weak devices, without WebGL2, or when a state refuses to
// draw (the engine refuses a state below the size where it measured as unreadable), and in dark mode for now.
// At most LIVE headings hold a GL context at once; a heading that leaves the screen hands its context back.
const root = document.documentElement;
// dark pages keep the still face for now: living type's paper stays light, and the author is deciding the dark look
const dark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
const off = () => matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("plain") || root.classList.contains("weak") || dark();
const LIVE = 3, heads = [...document.querySelectorAll("[data-living]")];
let booted = false;
const tryBoot = () => { if (!booted && heads.length && !off() && "OffscreenCanvas" in window && document.createElement("canvas").getContext("webgl2")) { booted = true; boot(); } };
tryBoot();
// switching the lamp to light starts living type; switching to dark returns every heading to the still face
new MutationObserver(tryBoot).observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });

async function boot() {
  let createLivingGL;
  try { ({ createLivingGL } = await import("/world/typeengine/web/living-gl.mjs")); }
  catch (e) { console.info("living type not loaded; headings stay in the still face", e.message); return; }
  const worker = new Worker("/world/typeengine/web/living-worker.mjs", { type: "module" });
  const P = new Map(), dpr = Math.min(2, devicePixelRatio || 1);
  let seq = 0;
  worker.onerror = (e) => console.warn("living worker failed; headings stay in the still face", e.message);
  worker.onmessage = (ev) => {
    const m = ev.data, p = [...P.values()].find((x) => x.id === m.id); if (!p) return;
    if (m.op === "error") { console.info("living: a heading stays still:", String(m.message).split("\n")[0]); release(p, true); return; }
    if (m.op === "init") { p.stops = m.stops; p.ready = true; return; }
    p.pending.delete(`${m.op}/${m.i}`);
    if (!p.g) return;
    if (m.op === "stop") p.g.stop(m.i, m.part); else p.g.move(m.i, m.part);
  };
  function claim(el) {
    if ([...P.values()].filter((x) => x.g).length >= LIVE) return null;
    const r = el.getBoundingClientRect(), w = Math.max(64, Math.min(1400, Math.round(r.width * dpr))), h = Math.max(32, Math.round(r.height * dpr));
    const c = document.createElement("canvas"); c.className = "living-paint"; c.setAttribute("aria-hidden", "true"); c.width = w; c.height = h;
    let g; try { g = createLivingGL(c); } catch (e) { console.info("living: no GL here", e.message); return null; }
    el.classList.add("living-host"); el.append(c);
    const states = el.dataset.living.split(/\s+/).filter(Boolean), text = el.firstChild?.textContent?.trim() || el.textContent.trim();
    const p = { id: `h${seq++}`, el, c, g, stops: null, ready: false, pending: new Set() };
    worker.postMessage({ id: p.id, op: "init", w, h, seed: 3, stops: states.map((s, i) => (i ? { state: s } : { state: s, text })) });
    P.set(el, p); return p;
  }
  function release(p, refuse = false) {
    p.c.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    p.c.remove(); p.el.classList.remove("living-on", "living-host"); p.g = null; P.delete(p.el);
    if (refuse) p.el.removeAttribute("data-living");
  }
  const ask = (p, op, i) => { const k = `${op}/${i}`; if (p.pending.has(k) || p.g.has?.(op, i)) return; p.pending.add(k); worker.postMessage({ id: p.id, op, i }); };
  const io = new IntersectionObserver((es) => { for (const e of es) {
    const p = P.get(e.target);
    if (e.isIntersecting && !p && e.target.dataset.living) claim(e.target); else if (!e.isIntersecting && p) release(p);
  } }, { rootMargin: "30% 0px" });
  for (const h of heads) io.observe(h);
  const t0 = performance.now();
  function frame() {
    if (off()) { for (const p of [...P.values()]) release(p); return; }
    const t = (performance.now() - t0) / 1000;
    for (const p of P.values()) {
      if (!p.g || !p.ready) continue;
      const sec = p.el.closest("section") || p.el, r = sec.getBoundingClientRect();
      const q = Math.min(1, Math.max(0, (innerHeight * 0.9 - r.top) / Math.max(1, r.height + innerHeight * 0.4)));
      const n = p.stops.length, s = q * (n - 1), i = Math.min(n - 1, Math.floor(s)), local = s - i, lead = 0.35;
      ask(p, "stop", i); if (i + 1 < n) { ask(p, "move", i); ask(p, "stop", i + 1); }
      const drawn = i < n - 1 && local > lead ? p.g.draw({ i, p: (local - lead) / (1 - lead), mode: "move", t }) || p.g.draw({ i, mode: "stop", t }) : p.g.draw({ i, mode: "stop", t });
      p.el.classList.toggle("living-on", !!drawn);
    }
  }
  const clock = window.UIShell?.clock;
  if (clock) clock.subscribe(frame);
  const fb = () => { if (!clock || clock.running === false) frame(); if (!document.hidden) requestAnimationFrame(fb); else document.addEventListener("visibilitychange", () => requestAnimationFrame(fb), { once: true }); };
  requestAnimationFrame(fb);
}
