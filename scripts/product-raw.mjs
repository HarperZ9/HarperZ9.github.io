// raw.html, the native renderer of The Playground: the live renderer opened on a press (world/site/explore/engine.js
// puts media/raw-native/live/ in a full-window frame; nothing heavy loads before the press), what each pass measured,
// what runs and whose it is, the engine's frames that do not run in a browser yet, and the certificate check with
// its exhibits, downloads and limits, carried from the page as it was. Words: site-src/world/raw.mjs.
import * as RW from "../site-src/world/raw.mjs";

const LIVE_PAGE = "/media/raw-native/live/index.html";

export function rawPage({ page, esc, HEAD, CHECKED, purpose, old }) {
  const L = RW.LIVE, M = RW.MEASURED, W = RW.WHAT_RUNS, E = RW.ENGINE_ONLY;
  const img = (base, w, h, alt, sizes, lazy) => `<img src="${base}-${w}.webp" srcset="${base}-${w / 2}.webp ${w / 2}w, ${base}-${w}.webp ${w}w" sizes="${sizes}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ""} decoding="async" alt="${esc(alt)}">`;
  const mb = (b) => (b ? ` (${(b / 1e6).toFixed(1)} MB)` : "");
  const doors = L.starts.filter((d) => d.alt).map((d, i) => `<li class="lw-door"><figure>${img(`/media/raw-native/live-stills/${d.id === "hall" ? "hall-nave" : d.id}`, 1600, 900, d.alt, i ? "(max-width: 860px) 92vw, 540px" : "(max-width: 860px) 92vw, 1100px", false)}
<figcaption>${esc(d.cap)}</figcaption></figure>
<p class="lw-go" hidden><button type="button" class="toy-btn" data-start="scene=${d.id}" data-bytes="${d.bytes}">${esc(d.go + mb(d.bytes))}</button></p></li>`).join("\n");
  const test = L.starts.find((d) => d.id === "test");
  const rows = M.rows.map(([n, on, off]) => `<tr><th scope="row">${esc(n)}</th><td class="num">${on}</td><td class="num">${off}</td></tr>`).join("");
  const tilt = E.tilt.map((t) => `<li><figure>${img(`/media/raw-native/engine-tiltshift/${t.f}`, 960, 540, t.alt, "(max-width: 860px) 92vw, 460px", true)}<figcaption>${esc(t.cap)}</figcaption></figure></li>`).join("\n");
  const body = `<article class="lp" data-landmark="playground" data-hue="playground">
<header class="lp-head">
<h1><span class="d-3d">${esc(RW.INTRO.title)}</span></h1>
<p class="lp-lede lp-lede-1">${esc(RW.INTRO.lede)}</p>
<p class="lp-purpose" data-canonical-purpose="raw">${esc(purpose)}</p>
<p class="lp-note">${esc(RW.INTRO.note)}</p>
<nav class="lp-ways" aria-label="On this page"><a href="#live">${esc(L.title)}</a><a href="#measured">What each pass does</a><a href="#runs">${esc(W.title)}</a><a href="#engine">${esc(E.title)}</a><a href="#certificate-live">${esc(RW.CERT.title)}</a><a href="#run">Run it now</a></nav>
</header>
<section class="lp-sec" id="live" aria-labelledby="h-live">
<h2 id="h-live"><span class="d-3d">${esc(L.title)}</span></h2>
<p class="lp-lede">${esc(L.lede)}</p>
<div class="lw-walk" data-toy="engine" data-live="${LIVE_PAGE}">
<ul class="lw-doors">${doors}</ul>
<p class="lw-go" hidden><button type="button" class="toy-btn" data-start="scene=test" data-bytes="0">${esc(test.go)}</button> <span class="rn-aside">${esc(test.cap)}</span></p>
<p class="lp-limit lw-walk-state" aria-live="polite">${esc(L.stateIdle)}</p>
<dialog class="lw-walk-frame" aria-label="The native renderer, live"></dialog>
</div>
<p class="lp-limit">${esc(L.keys)}</p>
<p class="lp-source">${esc(L.postersSource)}</p>
</section>
<section class="lp-sec" id="measured" aria-labelledby="h-measured">
<h2 id="h-measured"><span class="d-3d">What each pass does</span></h2>
<p class="lp-lede">${esc(M.setup)}</p>
<ul class="lw-doors"><li class="lw-door"><figure>${img("/media/raw-native/live-stills/hall-split", 1600, 900, L.split.alt, "(max-width: 860px) 92vw, 1100px", true)}<figcaption>${esc(L.split.cap)}</figcaption></figure></li>
<li class="lw-door"><figure>${img("/media/raw-native/live-stills/hall-error", 1600, 900, L.error.alt, "(max-width: 860px) 92vw, 540px", true)}<figcaption>${esc(L.error.cap)}</figcaption></figure></li>
<li class="lw-door"><figure>${img("/media/raw-native/live-stills/hero", 1600, 900, RW.LIVE.starts[1].alt, "(max-width: 860px) 92vw, 540px", true)}<figcaption>The hero, real time.</figcaption></figure></li></ul>
<div class="rn-wrap"><table class="rn-table"><caption>The frame's RMSE against the path-traced reference, in display values from 0 to 1, with each pass on and off. Lower is closer.</caption>
<thead><tr><th scope="col">Pass</th><th scope="col" class="num">On</th><th scope="col" class="num">Off</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="lp-limit">${esc(M.says)}</p>
<p class="lp-limit">${esc(M.passes)}</p>
<p class="lp-limit">${esc(M.cost)}</p>
</section>
<section class="lp-sec" id="runs" aria-labelledby="h-runs">
<h2 id="h-runs"><span class="d-3d">${esc(W.title)}</span></h2>
<h3 class="lp-h3">The engine's</h3>
<ul class="lw-make">${W.engine.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
<h3 class="lp-h3">Written for this page</h3>
<ul class="lw-make">${W.page.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
<p class="lp-limit">${esc(W.pins)}</p>
</section>
<section class="lp-sec" id="engine" aria-labelledby="h-engine">
<h2 id="h-engine"><span class="d-3d">${esc(E.title)}</span></h2>
<p class="lp-lede">${esc(E.lede)}</p>
<ul class="lw-stills">${tilt}</ul>
<p class="lp-source">${esc(E.tiltSource)}</p>
<p class="lp-limit">${esc(E.more)}</p>
</section>
${old}
<p class="lp-ways-end"><a href="/playground/">The Playground</a> <a href="/superframe.html">Superframe, the core</a> <a href="/low-water.html">Low Water</a> <a href="https://github.com/HarperZ9/superframe/tree/main/native">The source</a></p>
<p class="lp-verified"><b>Verified</b> ${esc(CHECKED)}: the measures and frame times read from this page's renderer on an RTX 4090 with the scenes and code it loads; the engine files and scenes by SHA-256 against superframe commit cac34166 and the hashes in its evidence/m3-assets.json; the tilt-shift figures from the engine's evidence/tiltshift-runs.json and gpu-rtx4090.json. The certificate exhibits and downloads are as the 0.2.0 and 0.8.0 releases wrote them.</p>
</article>`;
  return page({ path: "raw.html", title: "The Playground native renderer", description: purpose, body, bodyClass: "reading landmark",
    extraHead: HEAD("engine"), live: true });
}
