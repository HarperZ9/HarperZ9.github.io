// The phase map: where a claim can live. After Tegmark's chart of spacetime
// dimensions (arXiv gr-qc/9702052, Fig. 1): most of the map is uninhabitable,
// and one white cell says "We are here". The x axis is how much a claim says,
// the y axis what it costs to check. The pillars are dots in the white cell,
// and four travellers drift in from the regions around it.

import { dress, ROOMS } from "./exhibit";

type Region = { k: string; name: string; fill: string; q: string; src: string; href: string; ask: string };

const REGIONS: Record<string, Region> = {
  nothing: { k: "nothing", ask: "Did you nod along?", name: "Says nothing", fill: "#e0177e", href: "/articulate.html",
    q: "It is important to note that this release really represents a significant step forward.",
    src: "Articulate blocked it: four findings and no claim to check." },
  trust: { k: "trust", ask: "Would you pass it on without the source?", name: "Trust me", fill: "#c4136e", href: "/flywheel.html#demo",
    q: "tests_passed: 41", src: "Flywheel: UNVERIFIABLE, held. The number is right, and the answer never says where it came from." },
  simple: { k: "simple", ask: "Did it sound bigger than it was?", name: "Too simple", fill: "#e3262b", href: "/explainers.html",
    q: "Every test passes.", src: "True, cheap to check, and it says less than it sounds. From the film A passing check can still be wrong." },
  here: { k: "here", ask: "When did you last check one yourself?", name: "We are here", fill: "#ffffff", href: "/flywheel.html#demo",
    q: "tests_passed: 42, source: the test record. FAIL, held.",
    src: "A real claim, checked in one command against the record that decides it. Every tool on this site lives in this cell." },
  hype: { k: "hype", ask: "Which reference would you search first?", name: "Hype", fill: "#1aa3e0", href: "/explainers.html",
    q: "A literature review with a confident list of references.",
    src: "Searching for each reference is what told the real ones from the invented ones. From the film Claiming got cheap. Checking did not." },
  costly: { k: "costly", ask: "Who do you trust to run it again?", name: "Too costly", fill: "#1f9a4c", href: "/explainers.html",
    q: "A published study.", src: "Only running it again can say no, and few people run it again. From the film Re-derive it." },
  special: { k: "special", ask: "Who reads it for you?", name: "Specialists only", fill: "#ffe93a", href: "/buildlang.html",
    q: "function returns &'b i32 but expected &'a i32", src: "BuildLang's lifetime check. Cheap to check if you read the language." },
  unread: { k: "unread", ask: "Did you scroll this far?", name: "Nobody reads it", fill: "#1590c8", href: "/articulate.html",
    q: "The learner-minus-other gap was -8.0 percentage points.", src: "Articulate's fairness run over 13,467 essays, below the fold where most readers stop." },
};

// Fields in cell units [x0, y0, x1, y1]; they run past 5 so the wavy edge trims them.
const FIELDS: Array<[string, number, number, number, number]> = [
  ["nothing", 0, 0, 1, 5.3], ["trust", 1, 0, 5.3, 1],
  ["simple", 1, 1, 3, 2], ["simple", 1, 2, 2, 3],
  ["here", 3, 1, 4, 2], ["hype", 4, 1, 5.3, 2],
  ["special", 1, 3, 2, 4], ["unread", 1, 4, 2, 5.3],
  ["costly", 2, 2, 5.3, 5.3],
];

const NS = "http://www.w3.org/2000/svg";
const C = 100, X0 = 70, Y0 = 20;
const px = (x: number) => X0 + x * C;
const py = (y: number) => Y0 + (5 - y) * C;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e;
}

function wave(a: number, b: number, fixed: number, horiz: boolean) {
  let d = "";
  for (let i = 1; i <= 10; i++) {
    const t0 = a + ((b - a) * (i - 0.5)) / 10, t1 = a + ((b - a) * i) / 10, o = i % 2 ? 9 : -9;
    d += horiz ? ` Q ${t0} ${fixed + o} ${t1} ${fixed}` : ` Q ${fixed + o} ${t0} ${fixed} ${t1}`;
  }
  return d;
}

function stamp(parent: Element, text: string, x: number, y: number, size: number, rot = 0) {
  const t = el("text", { class: "pm-stamp", x, y, "font-size": size, "text-anchor": "middle", "dominant-baseline": "middle" }, parent);
  if (rot) t.setAttribute("transform", `rotate(${rot} ${x} ${y})`);
  t.textContent = text;
}

function drawFields(svg: SVGSVGElement, onPick: (k: string) => void) {
  const world = `M ${px(0)} ${py(0)} L ${px(5)} ${py(0)}` + wave(py(0), py(5), px(5), false) + wave(px(5), px(0), py(5), true) + " Z";
  const clip = el("clipPath", { id: "pm-world" }, el("defs", {}, svg));
  el("path", { d: world }, clip);
  const defs = svg.querySelector("defs")!;
  // The local print treatment: a wobbled ink edge, the way a riso drum lays colour down.
  const print = el("filter", { id: "pm-print", x: "-2%", y: "-2%", width: "104%", height: "104%" }, defs);
  el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.8, numOctaves: 2, seed: 7, result: "n" }, print);
  el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 3.5, xChannelSelector: "R", yChannelSelector: "G" }, print);
  const fields = el("g", { "clip-path": "url(#pm-world)", class: "pm-fields" }, svg);
  const groups: Record<string, SVGGElement> = {};
  for (const [k, x0, y0, x1, y1] of FIELDS) {
    const r = REGIONS[k];
    const g = groups[k] ?? (groups[k] = el("g", { class: "pm-r", "data-k": k, tabindex: 0, role: "button", "aria-label": r.name }, fields));
    el("rect", { x: px(x0), y: py(y1), width: (x1 - x0) * C, height: (y1 - y0) * C, fill: r.fill }, g);
  }
  const grid = el("g", { "clip-path": "url(#pm-world)", "pointer-events": "none" }, svg);
  for (let i = 1; i < 6; i++) {
    el("line", { x1: px(i), y1: py(0), x2: px(i), y2: py(5.3), class: "pm-grid" }, grid);
    el("line", { x1: px(0), y1: py(i), x2: px(5.3), y2: py(i), class: "pm-grid" }, grid);
  }
  el("path", { d: world, fill: "none", class: "pm-edge" }, svg);
  fields.addEventListener("click", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".pm-r");
    if (g?.dataset.k) onPick(g.dataset.k);
  });
  fields.addEventListener("keydown", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".pm-r");
    if (g?.dataset.k && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(g.dataset.k); }
  });
  return groups;
}

function drawLabels(svg: SVGSVGElement) {
  const L = el("g", { "pointer-events": "none", class: "pm-labels" }, svg);
  stamp(L, "SAYS NOTHING", px(0.5), py(2.6), 44, -90);
  stamp(L, "TRUST ME", px(3.1), py(0.5), 52);
  stamp(L, "TOO", px(1.5), py(2.55), 40);
  stamp(L, "SIMPLE", px(1.95), py(1.5), 40);
  stamp(L, "We are here", px(3.5), py(1.82), 15);
  stamp(L, "HYPE", px(4.5), py(1.5), 30);
  stamp(L, "Specialists", px(1.5), py(3.62), 17);
  stamp(L, "only", px(1.5), py(3.36), 17);
  stamp(L, "NOBODY READS IT", px(1.5), py(4.5), 13, -90);
  stamp(L, "TOO COSTLY", px(3.65), py(3.75), 40);
  for (let i = 0; i <= 5; i++) {
    el("text", { class: "pm-axis", x: px(i), y: py(0) + 26, "text-anchor": "middle" }, L).textContent = String(i);
    el("text", { class: "pm-axis", x: px(0) - 16, y: py(i) + 6, "text-anchor": "middle" }, L).textContent = String(i);
  }
  el("text", { class: "pm-axis", x: 345, y: 590, "text-anchor": "middle" }, L).textContent = "How much it claims";
  const yl = el("text", { class: "pm-axis", x: 22, y: 270, "text-anchor": "middle", transform: "rotate(-90 22 270)" }, L);
  yl.textContent = "What it costs to check";
  // A second, misregistered pass of the stamps in the magenta drum.
  const mis = L.cloneNode(true) as SVGGElement;
  mis.setAttribute("class", "pm-misreg");
  mis.setAttribute("aria-hidden", "true");
  svg.insertBefore(mis, L);
}

// The pillars as dots inside the white cell; each one opens its facet.
function drawDwellers(svg: SVGSVGElement, names: string[], open: (i: number) => void) {
  const g = el("g", { class: "pm-dwellers" }, svg);
  names.forEach((name, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = px(3) + 17 + col * 22, y = py(2) + 48 + row * 26;
    const a = el("g", { class: "pm-dot", tabindex: 0, role: "button", "aria-label": `Open ${name}` }, g);
    el("circle", { cx: x, cy: y, r: 7 }, a);
    el("title", {}, a).textContent = name;
    a.addEventListener("click", () => open(i));
    a.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
  });
}

// Four travellers: claims drifting toward the cell where they can be checked.
function travellers(svg: SVGSVGElement, panel: HTMLElement) {
  const routes: Array<[number, number, number, number]> = [
    [3.5, 0.35, 3.3, 1.35], [4.75, 1.6, 3.75, 1.45], [3.2, 3.6, 3.45, 1.75], [1.6, 1.4, 3.15, 1.55],
  ];
  const dots = routes.map(() => el("circle", { r: 5, class: "pm-traveller" }, svg));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const place = (t: number) => routes.forEach(([x0, y0, x1, y1], i) => {
    const f = reduce.matches ? 0.92 : (Math.sin(t * 0.35 + i * 1.7) * 0.5 + 0.5);
    dots[i].setAttribute("cx", String(px(x0 + (x1 - x0) * f) + Math.sin(t + i) * 3));
    dots[i].setAttribute("cy", String(py(y0 + (y1 - y0) * f)));
  });
  let frame = 0, odd = false;
  const tick = (now: number) => {
    if ((odd = !odd)) place(now / 1000); // half rate: they drift, they do not race
    frame = !panel.hidden && !reduce.matches && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  place(0);
  new MutationObserver(() => { if (!panel.hidden && !frame) frame = requestAnimationFrame(tick); })
    .observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  if (!panel.hidden) frame = requestAnimationFrame(tick);
}

export function mountPhaseMap(panel: HTMLElement, pillars: string[], open: (i: number) => void, touch: () => void) {
  const host = panel.querySelector<HTMLElement>("[data-phase-map]");
  const detail = panel.querySelector<HTMLElement>(".pm-detail");
  const list = panel.querySelector<HTMLElement>(".pm-list");
  if (!host || !detail) return;
  const svg = el("svg", { viewBox: "0 0 620 600", role: "group", "aria-label": "Map of claims by how much they claim and what they cost to check" }, host);
  let groups: Record<string, SVGGElement> = {};
  const show = (k: string) => {
    const r = REGIONS[k];
    Object.entries(groups).forEach(([key, g]) => g.classList.toggle("on", key === k));
    detail.replaceChildren();
    const add = (tag: string, cls: string, text: string) => {
      const e = document.createElement(tag); e.className = cls; e.textContent = text; detail.append(e); return e;
    };
    add("p", "pm-k", r.name);
    add("p", "pm-ask", r.ask);
    add("blockquote", "pm-q", r.q);
    const src = add("p", "pm-src", r.src + " ");
    const a = document.createElement("a"); a.href = r.href; a.textContent = "See it"; src.append(a);
    touch();
  };
  groups = drawFields(svg, show);
  drawLabels(svg);
  drawDwellers(svg, pillars, open);
  travellers(svg, panel);
  void dress(host, ROOMS[0]);
  if (list) list.hidden = true;
  host.hidden = false;
  show("here");
}
