// field-backdrop.mjs: the glass-and-water field's rendered plates, behind the home and every reading page.
// Day in the light scheme, night in the dark one, a portrait framing for tall screens; AVIF first, WebP after.
// priority: "high" where the plate is the first screen's main paint (the home), "low" on reading pages.
const M = "/media/world/glass-water";
const set = (name, ws) => ws.map((w) => `${M}/${name}-${w}.EXT ${w}w`).join(", ");
const src = (name, type, ws) => set(name, ws).replaceAll("EXT", type);
export function backdrop({ priority = "low", live = false } = {}) {
  const pic = (scheme, attrs) => `<picture${scheme === "night" ? ' class="gw-night"' : ""}>
    <source media="(orientation: portrait)" type="image/avif" srcset="${src(`field-${scheme}-portrait`, "avif", [828, 1242])}" sizes="100vw">
    <source media="(orientation: portrait)" type="image/webp" srcset="${src(`field-${scheme}-portrait`, "webp", [828, 1242])}" sizes="100vw">
    <source type="image/avif" srcset="${src(`field-${scheme}`, "avif", [1280, 1920, 2560])}" sizes="100vw">
    <img src="${M}/field-${scheme}-1920.webp" srcset="${src(`field-${scheme}`, "webp", [1280, 1920, 2560])}" sizes="100vw" width="1920" height="1080" alt="" decoding="async" ${attrs}>
  </picture>`;
  return `<div class="gw-backdrop" aria-hidden="true">
  ${pic("day", `fetchpriority="${priority}"`)}
  ${pic("night", 'loading="lazy"')}${live ? '\n  <canvas class="gw-live"></canvas>' : ""}
</div>`;
}
