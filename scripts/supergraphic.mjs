// The arrival's supergraphic: six upright signs standing in the water at the horizon, one letter size for all,
// each crowned with its platform's drawn sign (world/site/supergraphic.css). Pure functions over explicit data:
// the colour tokens go in, markup comes out. Colour follows the hierarchy colour system
// (world/site/crossover/colour-tokens.json): platform is a hue, package is a lightness inside that hue, and every
// colour comes with a shape. Decoration only: hidden from assistive technology, since the same names are the
// landmarks' headings below.

// [name, platform, package tone 0..3 used as the face]. Engine and Game share The Playground's hue at two tones.
export const SIGNS = [["BUILDLANG", "bldlng", 3], ["FLYWHEEL", "theflywheel", 3], ["ENGINE", "theplygrnd", 2], ["GAME", "theplygrnd", 3], ["CMMNS", "thecmmns", 3], ["ARTICULATE", "artiql8", 3]];

// the four colours of the depth model (depth.css) for one sign, read from the platform's measured ramps
export function ramp(platform, step) {
  const pk = platform.package_tones.map((t) => t.hex);
  return { face: pk[step], lit: platform.tint.hex, side: step < 3 ? platform.study_ramp[0].hex : pk[0], key: platform.dark.tint.hex };
}

const f = (x) => x.toFixed(1);
const R = 46; // the glyph's radius inside a -50..50 box

// the platform's drawn sign, from the colour system sheet: a spiral, three quartered discs, a disc cut in four and
// pulled apart, five typebars meeting at a point, a narrowing stack
export function glyph(id) {
  if (id === "theflywheel") {
    const pts = Array.from({ length: 60 }, (_, i) => { const t = i / 59, a = -Math.PI / 2 + t * 2 * Math.PI * 1.15, r = R * (0.18 + 0.82 * t); return `${f(r * Math.cos(a))},${f(r * Math.sin(a))}`; });
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle r="9" fill="currentColor"/>`;
  }
  if (id === "thecmmns") return [[-0.42, -0.3, 0.56], [0.5, -0.38, 0.44], [0.18, 0.5, 0.4]].map(([gx, gy, gr]) => {
    const x = f(gx * R), y = f(gy * R), r = f(gr * R);
    return `<circle cx="${x}" cy="${y}" r="${f(gr * R - 3)}" fill="none" stroke="currentColor" stroke-width="6"/><path d="M${x} ${y}h${r}a${r} ${r} 0 0 1 -${r} ${r}zM${x} ${y}h-${r}a${r} ${r} 0 0 1 ${r} -${r}z" fill="currentColor"/>`;
  }).join("");
  if (id === "theplygrnd") return [0, 1, 2, 3].map((q) => {
    const a = ((q * 90 + 45) * Math.PI) / 180, a0 = (q * Math.PI) / 2, a1 = a0 + Math.PI / 2, ox = 7 * Math.cos(a), oy = 7 * Math.sin(a), r = 39;
    return `<path d="M${f(ox + 14 * Math.cos(a))} ${f(oy + 14 * Math.sin(a))}L${f(ox + r * Math.cos(a0))} ${f(oy + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${f(ox + r * Math.cos(a1))} ${f(oy + r * Math.sin(a1))}z" fill="currentColor"/>`;
  }).join("");
  if (id === "artiql8") return `<path d="M-24 -44h48" stroke="currentColor" stroke-width="12"/>` + [0, 1, 2, 3, 4].map((i) => {
    const a = Math.PI * (0.15 + (0.7 * i) / 4);
    return `<path d="M0 -44L${f(-R * Math.cos(a))} ${f(R * 0.81 * Math.sin(a) + 5)}" stroke="currentColor" stroke-width="9"/>`;
  }).join("");
  if (id === "bldlng") return [1, 0.68, 0.36].map((w, i) => `<rect x="${f(-R * w)}" y="${f(R - (i + 1) * 30.7 + 5)}" width="${f(2 * R * w)}" height="25.7" fill="currentColor"/>`).join("");
  return "";
}

// one sign: the glyph crown over the upright name. The mirror copy carries no depth: it is the reflection.
export function sign([name, id, step], platforms, mirror = false) {
  const r = ramp(platforms[id], step);
  const st = `--d-face:${r.face};--d-lit:${r.lit};--d-side:${r.side};--d-key:${r.key}`;
  return `<div class="sg-sign"><svg class="sg-glyph" viewBox="-50 -50 100 100" focusable="false" style="${st}">${glyph(id)}</svg><p class="sg-name${mirror ? "" : " d-3d"}" style="${st}">${name}</p></div>`;
}

const RIPPLE = `<svg class="sg-defs" width="0" height="0" focusable="false"><filter id="sg-ripple" x="-8%" y="-4%" width="116%" height="108%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".006 .11" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="18" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;

export function supergraphic(platforms, signs = SIGNS) {
  const wall = (mirror) => signs.map((s) => sign(s, platforms, mirror)).join("");
  return `<div class="sg" aria-hidden="true">
      ${RIPPLE}
      <div class="sg-wall">${wall(false)}</div>
      <div class="sg-wall sg-mirror">${wall(true)}</div>
    </div>`;
}
