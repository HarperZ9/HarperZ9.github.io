// The home's five top controls, drawn as one family in the sign wall's ink language (the author, 2026-11-09:
// "header icons can be updated as well."): a flat face, a key line round it, and a hard two-step solid falling down
// and to the left, the way the signs print. Pure functions over explicit data; no icon set is used.
// Each control has two drawings, and the state reads from the shape alone: the Sun turns to a crescent, the
// running arrow to two still bars, the folded page to a ruled one, the signpost to a cross, the ring to a disc.
const f = (x) => +x.toFixed(2);
const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const disc = (cx, cy, r) => `M${f(cx - r)} ${cy}A${r} ${r} 0 1 0 ${f(cx + r)} ${cy}A${r} ${r} 0 1 0 ${f(cx - r)} ${cy}Z`;
const rays = (cx, cy, r0, r1, half, n) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), p = (r, t) => [cx + c * r - s * t, cy + s * r + c * t];
  return poly([p(r0, -half), p(r1, -half), p(r1, half), p(r0, half)]);
}).join("");

// every drawing sits in a 48 box: face (the main ink), mark (the second ink), cut (drawn in the key ink on the face)
export const DRAWINGS = {
  places: {
    off: { face: rect(21.5, 6, 5, 38) + poly([[10, 8], [33, 8], [40, 14.5], [33, 21], [10, 21]]), mark: poly([[38, 24], [15, 24], [8, 30.5], [15, 37], [38, 37]]) },
    on: { face: poly([[9, 14], [14, 9], [24, 19], [34, 9], [39, 14], [29, 24], [39, 34], [34, 39], [24, 29], [14, 39], [9, 34], [19, 24]]) },
  },
  day: {
    on: { face: disc(24, 24, 9), mark: rays(24, 24, 13, 20, 2.3, 8) },
    off: { face: "M30 6A18 18 0 1 0 42 30A14 14 0 0 1 30 6Z" },
  },
  sky: {
    off: { face: disc(24, 17, 9) + disc(24, 17, 4.5), mark: rect(5, 32, 38, 5) },
    on: { face: disc(24, 17, 10), mark: rect(5, 31, 38, 5) + rect(12, 39, 24, 3.5) },
  },
  motion: {
    on: { face: poly([[17, 8], [43, 24], [17, 40]]), mark: rect(5, 13, 8, 4.5) + rect(2, 21.75, 11, 4.5) + rect(5, 30.5, 8, 4.5) },
    off: { face: rect(11, 9, 10, 30) + rect(27, 9, 10, 30) },
  },
  plain: {
    off: { face: poly([[9, 5], [27, 5], [39, 17], [39, 43], [9, 43]]), mark: poly([[27, 5], [39, 17], [27, 17]]) },
    on: { face: rect(9, 5, 30, 38), cut: rect(14, 13, 20, 3.5) + rect(14, 21, 20, 3.5) + rect(14, 29, 13, 3.5) },
  },
};

export const INKS = { face: "#f4efe6", mark: "#fcde3d", band: "#ff6fb1", key: "#05070f", tile: "#14161c" };
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -2 56 56">${body}</svg>`;
const all = (d) => (d.face || "") + (d.mark || "");

// three ways to print one drawing; "poster" is the one the page uses
export const VARIANTS = {
  // the sign wall's own stack: key solid, band, then the face and second ink with a key line round them
  poster: (d, k = INKS) => svg(`<path transform="translate(-4 4)" fill="${k.key}" stroke="${k.key}" stroke-width="2.4" d="${all(d)}"/><path transform="translate(-2 2)" fill="${k.band}" stroke="${k.key}" stroke-width="1.2" d="${all(d)}"/>`
    + `<g stroke="${k.key}" stroke-width="2.4" paint-order="stroke" fill-rule="evenodd"><path fill="${k.face}" d="${d.face}"/>${d.mark ? `<path fill="${k.mark}" d="${d.mark}"/>` : ""}</g>${d.cut ? `<path fill="${k.key}" d="${d.cut}"/>` : ""}`),
  // a key-line drawing: the outline in the face ink, the second ink flat, one hard step of solid behind
  line: (d, k = INKS) => svg(`<g fill="none" stroke-linejoin="miter" fill-rule="evenodd"><path transform="translate(-2.5 2.5)" stroke="${k.key}" stroke-width="4.6" d="${all(d)}"/><path stroke="${k.face}" stroke-width="3" d="${d.face}"/></g>`
    + `${d.mark ? `<path fill="${k.mark}" stroke="${k.key}" stroke-width="1" d="${d.mark}"/>` : ""}${d.cut ? `<path fill="${k.face}" d="${d.cut}"/>` : ""}`),
  // the drawing in dark ink on a flat tile of the face ink
  tile: (d, k = INKS) => svg(`<path transform="translate(-4 4)" fill="${k.key}" d="${rect(0, 0, 48, 48)}"/><path transform="translate(-2 2)" fill="${k.band}" d="${rect(0, 0, 48, 48)}"/><path fill="${k.face}" stroke="${k.key}" stroke-width="1.6" d="${rect(0, 0, 48, 48)}"/>`
    + `<g transform="translate(24 24) scale(.78) translate(-24 -24)" fill-rule="evenodd"><path fill="${k.tile}" d="${d.face}"/>${d.mark ? `<path fill="#c2264f" d="${d.mark}"/>` : ""}${d.cut ? `<path fill="${k.face}" d="${d.cut}"/>` : ""}</g>`),
};

export const icon = (name, state, variant = "poster") => VARIANTS[variant](DRAWINGS[name][state]);
const uri = (s) => `url("data:image/svg+xml,${s.replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'")}")`;

// [control selector, drawing, the attribute selector that means "on"]
const CONTROLS = [['[data-o="fold"]', "places", '[aria-expanded="true"]'], ['[data-o="lamp"]', "day", '[aria-pressed="true"]'], ['[data-o="sky"]', "sky", '[aria-pressed="true"]'],
  [".o-motion", "motion", '[aria-pressed="true"]'], ['[data-o="peel"]', "plain", '[aria-pressed="true"]']];

// the stylesheet for the home's hand (world/site/hand-icons.css). The controls grow with the viewport; on a phone the
// drawing is smaller inside a 44 px target and the label sits closer, so the row takes less of the first screen.
export function handIconCss(variant = "poster") {
  const H = ".world-home .o-hand", sel = CONTROLS.map(([s]) => `${H} ${s}`), any = `:is(${CONTROLS.map(([s]) => s).join(",")})`;
  const img = CONTROLS.flatMap(([s, name, on]) => [`${H} ${s}{background-image:${uri(icon(name, "off", variant))}}`, `${H} ${s}${on}{background-image:${uri(icon(name, "on", variant))}}`]);
  return `/* generated by scripts/hand-icons.mjs; edit the generator, not this file */
${H}{--o-s:clamp(44px,1.9vw + 17px,96px);--o-k:1;--o-f:clamp(11px,.5vw + 4px,22px);gap:calc(var(--o-s) * .3)}
${H}.o-said{padding-bottom:calc(var(--o-f) * 2)}
${sel.join(",")},${sel.map((s) => `${s}:hover`).join(",")},${sel.map((s) => `${s}:focus-visible`).join(",")}{width:var(--o-s);height:var(--o-s);border-radius:0;clip-path:none;box-shadow:none;opacity:1;background-color:transparent;background-position:center;background-size:calc(var(--o-k) * 100%);background-repeat:no-repeat}
${H} [data-o="fold"] i,${H} .o-motion img,${H} [data-o="sky"]::before,${H} [data-o="sky"]::after{display:none}
${img.join("\n")}
${H} ${any}{transition:translate .12s}
${H} ${any}:active{translate:-2px 2px}
${H}.o-said > :is(a[data-o],button) .o-name,${H}.o-said .o-under{top:calc(50% + var(--o-s) * var(--o-k) / 2 + var(--o-f) * .45);font-size:var(--o-f)}
@media (max-width:860px){${H}{--o-s:44px;--o-k:.72;--o-f:10.5px;gap:0}${H}.o-said{padding-bottom:14px}}
@media (prefers-reduced-motion:reduce){${H} ${any}{transition:none}}
html.plain ${H} ${any}{transition:none}
`;
}
