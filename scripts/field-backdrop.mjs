// field-backdrop.mjs: the glass-and-water field's rendered plates, behind the home and every reading page.
// One picture: night in the dark scheme, day in the light one, a portrait framing for tall screens; AVIF first, WebP
// after, so a page loads exactly one plate. When the visitor's lamp choice differs from the system scheme, a small
// script points the picture at the chosen plate.
// priority: "high" where the plate is the first screen's main paint (the home), "low" on reading pages.
const M = "/media/world/glass-water";
const set = (name, ext, ws) => ws.map((w) => `${M}/${name}-${w}.${ext} ${w}w`).join(", ");
const SWAP = `<script>(function(){var r=document.documentElement,q=matchMedia("(prefers-color-scheme: dark)");
function s(){var t=r.dataset.theme,d=t?t==="dark":q.matches,p=document.querySelector(".gw-backdrop picture");if(!p)return;
p.querySelectorAll("source[data-s]").forEach(function(x){var on=x.dataset.s===(d?"night":"day");x.media=x.dataset.m+(x.dataset.m?" and ":"")+(on?"all":"not all");});}
new MutationObserver(s).observe(r,{attributes:true,attributeFilter:["data-theme"]});q.addEventListener("change",s);s();})();</script>`;
export function backdrop({ priority = "low", live = false } = {}) {
  const src = (scheme, portrait, ext) => {
    const m = portrait ? "(orientation: portrait)" : "";
    const ws = portrait ? [828, 1242] : [1280, 1920, 2560];
    return `<source data-s="${scheme}" data-m="${m}" media="${m ? m + " and " : ""}(prefers-color-scheme: ${scheme === "night" ? "dark" : "light"})" type="image/${ext}" srcset="${set(`field-${scheme}${portrait ? "-portrait" : ""}`, ext, ws)}" sizes="100vw">`;
  };
  const sources = ["night", "day"].flatMap((s) => [src(s, true, "avif"), src(s, true, "webp"), src(s, false, "avif"), src(s, false, "webp")]).join("\n    ");
  return `<div class="gw-backdrop" aria-hidden="true">
  <picture>
    ${sources}
    <img src="${M}/field-day-1920.webp" width="1920" height="1080" alt="" decoding="async" fetchpriority="${priority}">
  </picture>${live ? '\n  <canvas class="gw-live"></canvas>' : ""}
</div>
${SWAP}`;
}
