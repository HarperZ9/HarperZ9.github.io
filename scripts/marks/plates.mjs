// plates.mjs: the colour studies and the motion study, drawn as SVG from the computed palette (overprint.mjs). They
// sit on the dark ground below the glass-water field, so their words are light.
import { PAL, over, film } from "./overprint.mjs";

const W = 1600, H = 900, GROUND = "#0d1a24", WORD = "#f4efe6", SOFT = "#c9c3b8";
const FONT = "font-family=\"'Hanken Grotesk',system-ui,sans-serif\"";
const t = (x, y, s, size = 22, extra = "") => `<text x="${x}" y="${y}" font-size="${size}"${/ fill=/.test(extra) ? "" : ` fill="${WORD}"`} ${FONT}${/class=/.test(extra) ? "" : ' class="p"'}${extra}>${s}</text>`;
// at phone widths the plate's prose hides (the page's caption carries it) and its labels grow to stay legible
// the race's pair names break onto two lines there (.l2), since five one-line names at that size would touch
const NARROW = "<style>.l2{display:none}@media (max-width:900px){.p{display:none}.l{font-size:40px}.l1{display:none}.l2{display:inline}}</style>";
const wrap = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${NARROW}<rect width="${W}" height="${H}" fill="${GROUND}"/>${body}</svg>`;
const INK_HEX = { red: "#eb4324", cyan: "#04b2dd", yellow: "#fcc603", green: "#07ac3d", black: "#1a1b22" };  // the scan's inks

// 1. The overprint race: each measured overlap from the Olivetti sheet, with the two models' predictions beside it.
// The lens where two discs cross is cut in three: the multiply prediction above, the measured colour in the middle,
// the Clapper-Yule prediction below, so the eye compares each prediction against the print directly.
function race() {
  const R = PAL.race, keys = Object.keys(R.multiply.overlaps), cw = W / keys.length, out = [];
  keys.forEach((k, i) => {
    const [a, b] = k.split("+"), cx = cw * i + cw / 2, cy = 380, r = 108, d = 64, id = `rc${i}`;
    const lens = `<clipPath id="${id}"><circle cx="${cx - d / 2}" cy="${cy}" r="${r}"/></clipPath>`;
    const band = (y0, h, c) => `<g clip-path="url(#${id})"><rect x="${cx + d / 2 - r}" y="${y0}" width="${2 * r}" height="${h}" fill="${c}" clip-path="url(#${id}b)"/></g>`;
    out.push(`<defs>${lens}<clipPath id="${id}b"><circle cx="${cx + d / 2}" cy="${cy}" r="${r}"/></clipPath></defs>`);
    out.push(`<circle cx="${cx - d / 2}" cy="${cy}" r="${r}" fill="${INK_HEX[a]}"/><circle cx="${cx + d / 2}" cy="${cy}" r="${r}" fill="${INK_HEX[b]}"/>`);
    out.push(band(cy - r, r * 0.62, R.multiply.overlaps[k].hex), band(cy - r * 0.38, r * 0.76, MEASURED[k]), band(cy + r * 0.38, r * 0.62, R["clapper-yule"].overlaps[k].hex));
    out.push(t(cx, 560, `${a} over ${b}`, 26, ' font-weight="700" text-anchor="middle" class="l l1"'));
    out.push(t(cx, 560, `<tspan x="${cx}">${a} over</tspan><tspan x="${cx}" dy="1.15em">${b}</tspan>`, 40, ' font-weight="700" text-anchor="middle" class="l2"'));
    out.push(t(cx, 610, `multiply, above: ${R.multiply.overlaps[k].dE00}`, 20, ' text-anchor="middle"'));
    out.push(t(cx, 640, `Clapper-Yule, below: ${R["clapper-yule"].overlaps[k].dE00}`, 20, ' text-anchor="middle"'));
  });
  out.push(t(64, 96, "Where two inks cross: measured on the print, and predicted", 34, ' font-weight="700"'));
  out.push(t(64, 136, "Each lens: per-channel multiply above, the print's own colour in the middle, Clapper-Yule below.", 22));
  out.push(t(64, 760, `Median CIEDE2000 against the print: multiply ${R.multiply.median_dE00}, Beer-Lambert ${R.beer.median_dE00}, Clapper-Yule ${R["clapper-yule"].median_dE00}.`, 24));
  out.push(t(64, 798, "Each number is the miss in CIEDE2000. Five overlaps; every model is fitted on single inks only. Green over red stays the worst.", 22, ` fill-opacity=".86"`));
  return wrap(out.join(""), "Five pairs of overlapping ink discs from an Olivetti print; in each overlap, a band of the measured colour sits between two predicted bands.");
}
const MEASURED = { "cyan+yellow": "#028e3f", "red+yellow": "#c03314", "green+cyan": "#029642", "red+black": "#482a26", "green+red": "#261b28" };

// 2. The colour keyboard woven: the seven keys run as bars across and down, and every crossing takes the colour the
// two films make together, computed per wavelength. The diagonal is a key laid over itself.
function weave() {
  const keys = ["sky", "mist", "sand", "straw", "land", "leaf", "velvet"], role = { sky: "sky", mist: "sky", sand: "sand", straw: "sand", land: "landscape", leaf: "landscape", velvet: "velvet" };
  const x0 = 560, y0 = 160, step = 128, bw = 74, n = keys.length, out = [];
  keys.forEach((k, i) => out.push(`<rect x="${x0 - 30}" y="${y0 + i * step / 1.6}" width="${(n - 1) * step + bw + 60}" height="${bw / 1.6}" rx="${bw / 3.2}" fill="${PAL.ink[k]}"/>`));
  keys.forEach((k, j) => {
    out.push(`<rect x="${x0 + j * step}" y="${y0 - 40}" width="${bw}" height="${(n - 1) * step / 1.6 + bw / 1.6 + 80}" rx="${bw / 2}" fill="${PAL.ink[k]}"/>`);
    keys.forEach((h, i) => out.push(`<rect x="${x0 + j * step}" y="${y0 + i * step / 1.6}" width="${bw}" height="${bw / 1.6}" fill="${over(h, k)}"/>`));
  });
  keys.forEach((k, i) => out.push(t(x0 - 60, y0 + i * step / 1.6 + 32, `${k}`, 22, ' text-anchor="end" class="l"')));
  out.push(t(64, 96, "The colour keyboard, woven", 34, ' font-weight="700"'));
  [
    "Seven keys after Le Corbusier: sky and mist recede, sand and straw hold, land and leaf advance, velvet encloses.",
    "Each key mixes the five inks measured on an Olivetti print. Where two bars cross, the colour is what both films",
    "pass together, computed per wavelength by the Clapper-Yule model. The diagonal is a key printed over itself.",
  ].forEach((s, i) => out.push(t(64, 800 + i * 32, s, 21, i ? ` fill="${SOFT}"` : "")));
  return wrap(out.join(""), "Seven coloured bars across and seven down, woven; each crossing shows the colour of the two inks printed together.");
}

// 3. A motion study: a soap film draining in a vertical frame. Its thickness at depth x is h = sqrt(mu x / (rho g t)),
// so the film thins from the top as time passes and Newton's colours slide down it. Left: seen head-on; right: the
// same film at 45 degrees, where every band shifts toward thinner colours. It plays once, from a quarter hour to
// eight hours of drainage, and holds its last frame; with reduced motion it shows only the last frame.
function drainage() {
  const FR = 12, ST = 40, mu = 1e-3, rho = 1000, g = 9.81, X = 0.0125, T0 = 900, T1 = 6300;
  const ts = Array.from({ length: FR }, (_, i) => T0 * Math.pow(T1 / T0, i / (FR - 1)));
  const us = Array.from({ length: ST }, (_, i) => (i / (ST - 1)) ** 2);
  const h = (u, tt) => 1e9 * Math.sqrt(mu * Math.max(u * X, 1e-6) / (rho * g * tt));
  const css = [], films = [];
  for (const [side, angle, x] of [["a", "head_on", 420], ["b", "at_45", 900]]) {
    const stops = us.map((u, s) => {
      const name = `${side}${s}`;
      css.push(`@keyframes ${name}{${ts.map((tt, f) => `${(f / (FR - 1) * 100).toFixed(1)}%{stop-color:${film(Math.min(h(u, tt), 1200), angle)}}`).join("")}}`);
      return `<stop offset="${u.toFixed(4)}" stop-color="${film(Math.min(h(u, ts[FR - 1]), 1200), angle)}" style="animation:${name} 16s linear .8s 1 both"/>`;
    }).join("");
    films.push(`<linearGradient id="dr${side}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`);
  }
  css.push("@media (prefers-reduced-motion: reduce){stop{animation:none!important}}");
  const loop = (x) => `<path d="M${x} 760V250A160 160 0 0 1 ${x + 320} 250V760Z" fill="url(#dr${x === 420 ? "a" : "b"})"/>`;
  const out = [`<style>${css.join("")}</style><defs>${films.join("")}</defs>`, loop(420), loop(900)];
  out.push(t(580, 820, "head-on", 22, ' text-anchor="middle" class="l"'), t(1060, 820, "at 45 degrees", 22, ' text-anchor="middle" class="l"'));
  out.push(t(64, 96, "A soap film draining", 34, ' font-weight="700"'));
  out.push(t(1290, 300, "Thickness at depth x:", 22), t(1290, 336, "h = sqrt(mu x / (rho g t))", 22, ` fill="${SOFT}"`));
  out.push(t(1290, 400, "Colour: the Airy reflectance", 22), t(1290, 436, "of a film of index 1.38,", 22, ` fill="${SOFT}"`), t(1290, 472, "CIE 1931 under D65.", 22, ` fill="${SOFT}"`));
  out.push(t(1290, 536, "A film 12.5 mm tall,", 22), t(1290, 572, "from 15 min to 1 h 45 min,", 22, ` fill="${SOFT}"`), t(1290, 608, "played once in 16 seconds.", 22, ` fill="${SOFT}"`));
  return wrap(out.join(""), "Two arched soap films draining side by side, one seen head-on and one at 45 degrees; bands of interference colour slide down as each film thins from the top.");
}

export const PLATES = {
  "overprint-race": { svg: race, alt: "Five pairs of overlapping ink discs from an Olivetti print; in each overlap, a band of the measured colour sits between two predicted bands." },
  "colour-keyboard": { svg: weave, alt: "Seven coloured bars across and seven down, woven; each crossing shows the colour of the two inks printed together." },
  "film-drainage": { svg: drainage, alt: "Two arched soap films draining side by side, one seen head-on and one at 45 degrees; bands of interference colour slide down as each film thins from the top." },
};
