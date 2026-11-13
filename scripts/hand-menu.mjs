// hand-menu.mjs: the hand's menu, one list for every generated page. The six landmarks lead in the author's order
// (site-src/world/platforms.mjs), then the rest in a fixed order, so a place never moves between pages or visits
// (DESIGN-RULES.md: landmarks keep their place).
import { MENU } from "../site-src/world/platforms.mjs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function menuItems(here = "") {
  // a landmark's second level sits under its word as plain links (CMMNS and Articulate under Flywheel; the native
  // renderer, Superframe, the instruments and Low Water under The Playground, as its parts); the six words keep their order and their place
  const current = (href) => (href === here ? ' aria-current="page"' : "");
  return MENU.map(([href, tech, name, sub = []]) => `      <li><a href="${href}"${current(href)}><span class="o-word" data-display-on-open="${tech}">${esc(name)}</span></a>${sub.length ? `<small class="o-sub">${sub.map(([h, n]) => `<a href="${h}"${current(h)}>${esc(n)}</a>`).join(" ")}</small>` : ""}</li>`).join("\n");
}

export function menuDialog({ here = "", foot = '<a href="/elements.html">Elements</a> <a href="/swatches.html">Swatches</a> <a href="/studies/">Studies</a> <a href="/site-index.html">Site index</a>' } = {}) {
  return `<dialog id="o-menu" data-o="menu" data-material="chladni" aria-label="Places">
  <nav aria-label="Places">
    <ul class="o-places">
${menuItems(here)}
    </ul>
  </nav>
  <p class="o-menu-foot">${foot} <button type="button" class="o-close" onclick="this.closest('dialog').close()">Close (Esc)</button></p>
</dialog>`;
}
