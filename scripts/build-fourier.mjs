#!/usr/bin/env node
// Build the Fourier specimen (playground/fourier.html): the lettering library's fourier technique as a room a
// visitor plays. The letters are Fourier series of the font's own outlines (world/lettering/lib/techniques/fourier.mjs,
// copied from superframe lettering/). The page carries a still made here from the same kernel, so a reader with
// scripts off sees the few-to-many build as three stages; scripts add the dial, the circles, the morph, the band
// reveal and the sound.
//
//   node scripts/build-fourier.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { labelFor } from "./demo-labels.mjs";
import { parseTTF } from "../world/lettering/lib/fourier/ttf.mjs";
import { wordSeries } from "../world/lettering/lib/fourier/shape.mjs";
import { trace } from "../world/lettering/lib/fourier/kernel.mjs";
import { meta } from "../world/lettering/lib/techniques/fourier.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ttf = readFileSync(path.join(site, "world/lettering/fonts/hanken-grotesk-bold.ttf"));
const font = parseTTF(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

// The still: one word at three term counts, traced by the kernel the page runs. Points in whole units of a 100-unit em.
const WORD = "Fourier", STAGES = [[3, "3 circles per contour"], [12, "12"], [Infinity, "every circle"]];
function still() {
  const S = wordSeries(font, WORD, { em: 100, x: 0, y: 100 });
  const polys = (H) => S.map((s) => trace(s.c, Math.min(H, s.c.re.length), H < 20 ? 72 : 220));
  const all = STAGES.map(([H]) => polys(H)), xs = [], ys = [];
  for (const P of all) for (const p of P) for (let i = 0; i < p.length; i += 2) { xs.push(p[i]); ys.push(p[i + 1]); }
  const x0 = Math.floor(Math.min(...xs)) - 2, y0 = Math.floor(Math.min(...ys)) - 2, w = Math.ceil(Math.max(...xs)) + 2 - x0, h = Math.ceil(Math.max(...ys)) + 2 - y0;
  const d = (P) => P.map((p) => { let s = `M${Math.round(p[0] - x0)} ${Math.round(p[1] - y0)}`; for (let i = 2; i < p.length; i += 2) s += `L${Math.round(p[i] - x0)} ${Math.round(p[i + 1] - y0)}`; return s + "Z"; }).join("");
  return STAGES.map(([, label], i) => `<figure><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${WORD}, drawn with ${label}"><path d="${d(all[i])}" fill="currentColor" fill-rule="nonzero"/></svg><figcaption>${label}</figcaption></figure>`).join("\n");
}

// The visible lineage line says what the technique's meta.lineage says, with the reference linked.
if (!/Zahn and Roskies 1972/.test(meta.lineage) || !/sine-portfolio by d-sanoj \(MIT\)/.test(meta.lineage)) throw new Error("build-fourier: the technique's lineage changed; carry it to the page");
const LINEAGE = `Lineage: Fourier descriptors of closed curves (Zahn and Roskies 1972; Kuhl and Giardina 1982). Lettering drawn by turning circles, as in <a href="https://github.com/d-sanoj/sine-portfolio">sine-portfolio</a> by d-sanoj (MIT), where every letter is a Fourier series of hand-drawn strokes: the idea is taken, none of its code. Oscilloscope music (Jerobeam Fenderson), cited, not copied.`;

const css = `<style>
.fo{--fo-accent:#d97a2b}
html body main article.fo h1#fo-title,html body main article.fo p.fo-word{text-shadow:none;--letter-accent:var(--fo-accent);font-family:"Hanken Grotesk",system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;line-height:1.05;max-width:none}
html body main article.fo h1#fo-title{font-size:clamp(56px,11vw,150px);margin:0 0 .3em}
main article.fo p.fo-word{margin:0;font-size:clamp(52px,12vw,160px);overflow-wrap:anywhere}
.fo-stage{margin:1.6rem 0 .6rem}
.fo-desk{display:grid;gap:.9rem 1.4rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));align-items:end;margin:1rem 0}
.fo-desk[hidden],.fo-nojs[hidden]{display:none}
.fo-desk label{display:block;font-size:.85rem;margin-bottom:.25rem}
.fo-desk input[type=text]{font:inherit;width:100%;box-sizing:border-box;padding:.35rem .5rem;border:1px solid currentColor;background:transparent;color:inherit;border-radius:3px}
.fo-desk input[type=range]{width:100%;accent-color:var(--fo-accent)}
.fo-desk output{display:block;font-size:.85rem;font-variant-numeric:tabular-nums;min-height:1.3em}
.fo-acts{display:flex;flex-wrap:wrap;gap:.5rem;grid-column:1/-1}
.fo-acts button{font:inherit;padding:.4rem .85rem;border:1px solid currentColor;background:transparent;color:inherit;border-radius:3px;cursor:pointer}
.fo-acts button[aria-pressed="true"]{border-color:var(--fo-accent);box-shadow:inset 0 0 0 2px var(--fo-accent)}
.fo-acts button:disabled{opacity:.45;cursor:default}
.fo-still{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin:1.2rem 0}
.fo-still figure{margin:0}.fo-still svg{width:100%;height:auto;display:block}
.fo-still figcaption,.fo-say,.fo-lineage{font-size:.85rem}
.fo-say{min-height:1.4em}
html.fo-live .fo-still{display:none}
</style>`;

const body = `<article class="fo">
<h1 id="fo-title">Fourier</h1>
<p class="ds-lede">Every letter on this page is a Fourier series: circles turning at whole-number speeds, each one carried on the rim of the one before. The outlines come from the font itself, Hanken Grotesk Bold, read glyph by glyph. A few circles give the gist of a letter, a soft pebble. All the circles that show at this size give the crisp letter.</p>
${labelFor("playground-fourier")}
<div class="fo-stage"><p class="fo-word" id="fo-word" translate="no">Water</p></div>
<div class="fo-still">
${still()}
</div>
<p class="fo-nojs" id="fo-nojs">With scripts off, the word above stays as plain text and the three stills show the build. The dial, the circles, the morph, the band reveal and the sound need scripts.</p>
<div class="fo-desk" id="fo-desk" hidden>
<div><label for="fo-text">Your word</label><input type="text" id="fo-text" value="Water" maxlength="24" spellcheck="false" autocomplete="off"></div>
<div><label for="fo-terms">Circles per contour</label><input type="range" id="fo-terms" min="0" max="1000" step="1" value="1000" aria-describedby="fo-terms-out"><output id="fo-terms-out" for="fo-terms"></output></div>
<div><label for="fo-into">Morph into</label><input type="text" id="fo-into" value="Commons" maxlength="24" spellcheck="false" autocomplete="off"></div>
<div class="fo-acts">
<button type="button" id="fo-again">Build again</button>
<button type="button" id="fo-machine" aria-pressed="false">Show the circles</button>
<button type="button" id="fo-morph" aria-pressed="false">Morph</button>
<button type="button" id="fo-band" aria-pressed="false">Band reveal</button>
<button type="button" id="fo-play">Play the shape</button>
</div>
</div>
<p class="fo-say" id="fo-say" role="status" aria-live="polite"></p>
<h2>Beyond outlines</h2>
<p>An outline is one thing a Fourier series can be. Band reveal takes the whole picture of the word as a two-dimensional series and rebuilds it band by band, broad shape first and edges last. The orange is the ringing of the bands still missing, the Gibbs effect. Play the shape hears the outline's own terms as sound: x in the left ear, y in the right, so an oscilloscope draws the letters back from what you hear. It plays for three seconds, and only when you press it.</p>
<p>Anything that repeats, or can be made to repeat, has a series: a walk cycle, a coastline traced out and back, the light of a day.</p>
<h2>How close the circles come</h2>
<p>Each contour is resampled to 512 points along its length and its terms are found by a discrete Fourier transform. Across 66 glyphs, the worst contour of the median glyph sits within 0.027 em of the font's outline at 17 circles, 0.0073 em at 65 and 0.0020 em at 257. A term is dropped when it would move the outline by less than a quarter of a pixel at the size shown, so a heading keeps a few thousand terms where a paragraph keeps a few hundred. The same series with its phases shuffled misses every glyph by at least 0.0070 em, which is how the check knows it can fail.</p>
<p class="fo-lineage">${LINEAGE}</p>
</article>`;

const runtime = readFileSync(path.join(site, "site-src/world/fourier-room.js"), "utf8");
mkdirSync(path.join(site, "playground"), { recursive: true });
writeFileSync(path.join(site, "playground/fourier.html"), page({
  path: "playground/fourier.html", title: "Fourier lettering",
  description: "Letters drawn as sums of turning circles, read from the font's own outlines. Turn the number of circles, morph one word into another, watch the circles turn, rebuild the picture band by band, and hear the shape.",
  body: body + `\n<script type="module">\n${runtime.trim()}\n</script>`, bodyClass: "reading", extraHead: css,
}));
console.log("playground: fourier.html");
