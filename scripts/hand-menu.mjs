// hand-menu.mjs: the hand's menu, one list for every generated page. The six landmarks lead in the author's order
// (site-src/world/platforms.mjs), then the rest in a fixed order, so a place never moves between pages or visits
// (DESIGN-RULES.md: landmarks keep their place).
import { MENU } from "../site-src/world/platforms.mjs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function menuItems(here = "") {
  return MENU.map(([href, tech, name]) => `      <li><a href="${href}"${href === here ? ' aria-current="page"' : ""}><span class="o-word" data-display-on-open="${tech}">${esc(name)}</span></a></li>`).join("\n");
}

export function menuDialog({ here = "", foot = '<a href="/elements.html">Elements</a> <a href="/swatches.html">Swatches</a> <a href="/studies/">Studies</a> <a href="/floor.html">Plain index</a>' } = {}) {
  return `<dialog id="o-menu" data-o="menu" data-material="chladni" aria-label="Places">
  <nav aria-label="Places">
    <ul class="o-places">
${menuItems(here)}
    </ul>
  </nav>
  <p class="o-menu-foot">${foot} <button type="button" class="o-close" onclick="this.closest('dialog').close()">Close (Esc)</button></p>
</dialog>`;
}
