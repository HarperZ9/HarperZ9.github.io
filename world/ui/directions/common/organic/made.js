// organic/made: the components a page may hold (panel, rule, mark, record, switch, and the generator-backed
// grounds in organic-gen.js). organic.js fetches this file only on a page that holds one of them.
import { initGenerators } from "./organic-gen.js";
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reduced.matches || root.classList.contains("plain");
const materialOf = (el) => el.closest("[data-material]")?.dataset.material || "torn-paper";

// Seeded noise, so the same element tears the same way on every load (S3 determinism).
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const seedOf = (el) => [...(el.id || el.textContent || "o")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// A closed outline around a w x h box, edge displaced by the material's character.
function outline(w, h, kind, R) {
  const pts = [], step = kind === "torn" ? 9 : 22, amp = kind === "torn" ? 5 : kind === "blot" ? 9 : 3;
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n, j = kind === "blot" ? Math.sin(t * Math.PI) * amp * (0.6 + R() * 0.8) : (R() - 0.3) * amp;
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  };
  edge(0, 0, w, 0, 0, -1); edge(w, 0, w, h, 1, 0); edge(w, h, 0, h, 0, 1); edge(0, h, 0, 0, -1, 0);
  return pts;
}
const polyCss = (pts, pad) => `polygon(${pts.map(([x, y]) => `${(x + pad).toFixed(1)}px ${(y + pad).toFixed(1)}px`).join(",")})`;

function panel(el) {
  const kind = el.dataset.edge || ({ "torn-paper": "torn", "ink-brush": "blot", chladni: "sand" }[materialOf(el)] || "torn");
  const draw = () => {
    const r = el.getBoundingClientRect(), pad = 12;
    el.style.setProperty("--o-pad", pad + "px");
    if (kind === "sand") { el.dataset.edgeKind = "sand"; return; }
    const pts = outline(r.width - pad * 2, r.height - pad * 2, kind, rng(seedOf(el)));
    el.style.clipPath = polyCss(pts, pad);
    el.dataset.edgeKind = kind;
  };
  draw();
  new ResizeObserver(draw).observe(el);
}

function rule(el) {
  const svgNS = "http://www.w3.org/2000/svg";
  const draw = () => {
    const w = Math.max(40, el.getBoundingClientRect().width), R = rng(seedOf(el)), kind = materialOf(el) === "rope" ? "rope" : "ink";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} 14`); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    let d = "M0 7";
    for (let x = 12; x <= w; x += 12) d += ` Q${x - 6} ${7 + (R() - 0.5) * (kind === "rope" ? 2 : 4)} ${x} ${7 + (R() - 0.5) * 1.5}`;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", kind === "rope" ? "4" : "2.2"); path.setAttribute("stroke-linecap", "round");
    if (kind === "rope") path.setAttribute("stroke-dasharray", "5 2.5");
    svg.append(path);
    el.replaceChildren(svg);
  };
  draw();
  new ResizeObserver(draw).observe(el);
}

// The record: a waveform of what plays. Flat and still when silent; live from an AnalyserNode when
// the shell's sound is on (base.js exposes the context through UIShell.audio).
function record(btn) {
  const cv = btn.querySelector("canvas");
  if (!cv) return;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }) || cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const buf = new Uint8Array(256);
  const paint = () => {
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (W && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H; }
    const w = cv.width, h = cv.height, an = window.UIShell?.audio?.analyser;
    g.clearRect(0, 0, w, h); g.strokeStyle = getComputedStyle(btn).color; g.lineWidth = 1.5 * dpr; g.beginPath();
    if (an && !still()) an.getByteTimeDomainData(buf); else buf.fill(128);
    for (let i = 0; i < buf.length; i++) { const x = (i / (buf.length - 1)) * w, y = h / 2 + ((buf[i] - 128) / 128) * h * 1.6; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  paint();
  window.UIShell?.clock?.subscribe?.(() => { if (root.classList.contains("sound-on")) paint(); });
  btn.addEventListener("click", () => setTimeout(paint, 50));
}

// Living kicker marks: a few grains of the room's material that settle once into a short stroke.
function mark(el) {
  el.setAttribute("aria-hidden", el.hasAttribute("aria-label") ? "false" : "true");
  el.style.setProperty("--o-seed", String(seedOf(el) % 360));
}

export async function initMade() {
  const each = (sel, f) => document.querySelectorAll(sel).forEach((el) => { try { f(el); } catch (e) { console.warn("organic:", sel, e); } });
  each('[data-o="panel"]', panel);
  each('[data-o="rule"]', rule);
  each('[data-o="mark"]', mark);
  each('[data-o="record"]', record);
  each('[data-o="switch"]', (b) => b.addEventListener("click", () => b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true"))));
  await initGenerators();
}
