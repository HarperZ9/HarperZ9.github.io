// stage-road.mjs: the road's markup on the one stage (world/site/stage.js). The workshop's road page draws on 140
// canvases (three full-view ones, three sheets and a record per stop); on the site every sheet is a box with an
// offscreen surface behind it, the full-view canvases fold into one stage canvas, and the transfer records are cut.
// Idempotent: a page already on the stage passes through unchanged.
//
//   import { stageSheets, stageRoadPage } from "./stage-road.mjs";
export function stageSheets(html) {
  return html
    .replace(/<canvas class="sheet" (data-sheet="[^"]+") (aria-label="[^"]*") role="img"><\/canvas>/g, '<div class="sheet" $1 $2 role="img"></div>')
    .replace(/\s*<canvas class="record"[^>]*><\/canvas>/g, "");
}

export function stageHand(html) {
  return html
    .replace(/\s*<a data-o="band"[^>]*><\/a>/, "")
    .replace(/<canvas aria-hidden="true"><\/canvas><\/button>/, "</button>");
}

// the road boots once the page has loaded and is idle: the first stop's words show at once, its drawings follow
const IDLE_ROAD = '<script type="module">const go = () => import("/world/site/road.js"); const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300)); document.readyState === "complete" ? idle() : addEventListener("load", idle, { once: true });</script>';

// the standalone road page (world/universe/proto/path.html): the same road the home walks, on the stage
export function stageRoadPage(html) {
  let out = stageHand(stageSheets(html))
    .replace(/<canvas id="(strata|road|carry)" class="[^"]+" data-art aria-hidden="true"><\/canvas>\s*/g, "")
    .replace(/<script type="module" src="[^"]*alive\/alive\.js[^"]*"><\/script>\s*/, "")
    .replace(/<script type="module" src="path\.js[^"]*"><\/script>/, `<script type="module" src="/world/site/budget.js"></script>\n${IDLE_ROAD}`);
  if (!out.includes('href="/world/site/stage.css"')) out = out.replace(/(<link rel="stylesheet" href="path\.css[^"]*">)/, '$1\n<link rel="stylesheet" href="/world/site/stage.css">');
  if (!out.includes('<canvas id="stage"')) out = out.replace(/(<\/dialog>\s*)/, '$1<canvas id="stage" aria-hidden="true"></canvas>\n');
  return out;
}
