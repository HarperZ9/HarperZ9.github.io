// The place card, the find field and the keys. Text here is the place's own words and its threads.
import { threadsOut, other, neighbours, search, trail } from "./data.js";
import { swatch, MATERIAL_NAME } from "./materials.js";


export function card(u, n, { onDrift, onEnter, enter: withEnter = true, box: host = null } = {}) {
  const box = host || document.getElementById("card");
  if (!n) { box.hidden = true; box.replaceChildren(); return; }
  const prev = trail.get().slice(-2, -1)[0];
  const h = document.createElement("h2"); h.className = `r-${n.region}`; h.id = "card-h"; h.textContent = n.title;
  const kids = [h];
  if (n.blurb) { const p = document.createElement("p"); p.className = "blurb"; p.textContent = n.blurb; kids.push(p); }
  const enter = document.createElement("a"); enter.className = "enter"; enter.textContent = "Enter";
  enter.href = `place.html?n=${encodeURIComponent(n.id)}` + (prev ? `&from=${encodeURIComponent(prev)}` : "");
  if (onEnter) enter.addEventListener("click", (e) => { e.preventDefault(); onEnter(); });
  if (withEnter) kids.push(enter);
  const ul = document.createElement("ul"); ul.className = "threads"; ul.setAttribute("aria-label", "Threads");
  // only connections that are sentences (twin, question) keep their words; the material carries the rest
  // a featured place lists only the other featured places it shares a thread with; the rest is on the floor
  const outs = n.featured ? u.featured_links.filter((l) => l.a === n.id || l.b === n.id).map((l) => ({ ...l, id: "f" })) : threadsOut(u, n.id).slice(0, 14);
  for (const e of outs) {
    const to = u.byId.get(other(e, n.id)), li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.append(swatch(e.type, "#16130f"));
    if (e.type === "twin" || e.type === "question") { const v = document.createElement("span"); v.className = "via"; v.textContent = e.label; b.append(v); }
    const t = document.createElement("span"); t.className = `to r-${to.region}`; t.textContent = to.title; b.append(t);
    b.setAttribute("aria-label", `${to.title}, by ${MATERIAL_NAME[e.type]}: ${e.label}`);
    b.addEventListener("click", () => onDrift(to.id, e));
    li.append(b); ul.append(li);
  }
  if (ul.children.length < 4) for (const m of neighbours(u, n.id, 4 - ul.children.length)) {
    const li = document.createElement("li"), b = document.createElement("button"), t = document.createElement("span");
    b.type = "button"; t.className = `to r-${m.region}`; t.textContent = m.title; b.append(t);
    b.addEventListener("click", () => onDrift(m.id, null)); li.append(b); ul.append(li);
  }
  kids.push(ul);
  box.replaceChildren(...kids); box.className = `pcard r-${n.region}`; box.hidden = false;
}

export function initFind(u, { focus, light }) {
  const q = document.getElementById("q"), hits = document.getElementById("hits");
  const show = () => {
    const rs = search(u, q.value);
    hits.replaceChildren(...rs.map((r) => {
      const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
      if (r.kind === "thread") { b.append(swatch(r.t.type, "#16130f")); const s = document.createElement("span"); s.textContent = r.t.label; b.append(s); b.onclick = () => { light(r.t); done(); }; }
      else if (r.kind === "node") { b.textContent = r.n.title; b.className = `r-${r.n.region}`; b.onclick = () => { focus(r.n.id); done(); }; }
      else { b.textContent = r.r.name; b.className = `r-${r.r.id}`; b.onclick = () => { const n = u.nodes.find((m) => m.region === r.r.id); focus(n.id); done(); }; }
      li.append(b); return li;
    }));
    hits.hidden = !rs.length;
  };
  const done = () => { hits.hidden = true; };
  q.addEventListener("input", show);
  q.form.addEventListener("submit", (e) => { e.preventDefault(); hits.querySelector("button")?.click(); });
  q.addEventListener("keydown", (e) => { if (e.key === "Escape") { q.value = ""; done(); } if (e.key === "ArrowDown") { e.preventDefault(); hits.querySelector("button")?.focus(); } });
  hits.hidden = true;
}

export function initKeys(u, cam, { focus, unfocus, leave, btn, S }) {
  const stage = document.getElementById("stage");
  stage.addEventListener("keydown", (e) => {
    const cur = document.activeElement?.closest?.(".node");
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir && cur) {
      e.preventDefault();
      const a = u.byId.get(cur.dataset.id); let best = null, bd = Infinity;
      for (const n of u.nodes) {
        if (n.id === a.id || btn.get(n.id).hidden) continue;
        const dx = n.x - a.x, dy = n.y - a.y, along = dx * dir[0] + dy * dir[1];
        if (along <= 0) continue;
        const d = along + 2.2 * Math.abs(dx * dir[1] - dy * dir[0]);
        if (d < bd) { bd = d; best = n; }
      }
      if (best) { cur.tabIndex = -1; const b = btn.get(best.id); b.tabIndex = 0; b.focus(); S.hover = best.id; if (cam.depth() === 2) cam.go(best.x, best.y, cam.k, 320); }
    }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); const L = cam.levels(), k = L.find((l) => l > cam.k * 1.05) || L[2]; cam.go(cam.x, cam.y, k, 600); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); const L = cam.levels().reverse(), k = L.find((l) => l < cam.k * 0.95) || L[2]; cam.go(cam.x, cam.y, k, 600); }
    if (e.key === "Escape" && !document.querySelector(".room-layer:not(.standby)")) { if (S.focus) unfocus(); else cam.fitAll(600); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "i") location.href = "floor.html";
    if (e.key === "/") { e.preventDefault(); document.getElementById("q").focus(); }
    if (e.key === "Backspace") { e.preventDefault(); document.getElementById("back").click(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.querySelector(".room-layer:not(.standby)")) leave(); });
  document.getElementById("back").addEventListener("click", () => {
    if (document.querySelector(".room-layer:not(.standby)")) { leave(); return; }
    trail.pop(); const prev = trail.pop();
    if (prev) focus(prev); else { unfocus(); cam.fitAll(); }
  });
}
