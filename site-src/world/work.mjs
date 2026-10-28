// work.mjs: the astrolabe after the arrival. Its hub is the study that distills one picture; its eight moons are
// the pillars, and each pillar's panel opens in place on a real output: a study plate, a Flywheel verdict, an
// Articulate before and after, three Daylight Commons captures, a BuildLang check, the engine's frames, a film.
// The two videos use root-relative paths without a leading slash (index.html sits at the root), the form
// tools/video_registry.py reads. Every panel is plain HTML first: without scripts they read top to bottom, each under its own heading.
// world/site/work.js turns them into one panel at a time, chosen from the list or the dial, with deep links (/#w-engine).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pic = (base, w, h, alt, cls = "") =>
  `<img${cls ? ` class="${cls}"` : ""} src="${base}-1280.webp" srcset="${base}-640.webp 640w, ${base}-1280.webp 1280w" sizes="(max-width: 860px) 92vw, 520px" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(alt)}">`;

// One state per choice. The first state shows without scripts; the rest follow it in reading order.
function choose(label, states, extra = "") {
  return `<div class="w-choices" role="group" aria-label="${esc(label)}" hidden>${states.map((s, i) =>
    `<button type="button" data-show="${i}" aria-pressed="${i === 0}">${esc(s.button)}</button>`).join("")}</div>
      <div class="w-states">${states.map((s, i) => `<div class="w-state" data-state="${i}">${s.html}</div>`).join("")}</div>${extra}`;
}

// The ten swatches of the bow study: hex, share of the picture (superframe study/bow/study.json, palette criterion).
export const BOW_SWATCHES = [
  ["#737f94", 54.5], ["#7f899e", 25.0], ["#96a0b3", 14.7], ["#829492", 2.1], ["#aebfe9", 1.8],
  ["#bdf995", 0.5], ["#d67d90", 0.4], ["#fadd80", 0.4], ["#a6e6ce", 0.3], ["#ffa389", 0.2],
];
const strip = () => `<ol class="w-strip" aria-label="Ten swatches, by share of the picture">${BOW_SWATCHES.map(([hex, share]) =>
  `<li style="--c:${hex};--s:${share}"><span class="w-chip" aria-hidden="true"></span><code>${hex}</code> <span>${share.toFixed(1)}%</span></li>`).join("")}</ol>`;

export const HUB = {
  id: "distill", title: "Distill",
  html: `<figure class="w-demo">
        ${choose("Picture", [
          { button: "The picture", html: pic("/media/world/work/bow-source", 1651, 929, "A rainbow over a grey ground: the bow render the study takes apart.") },
          { button: "Ten swatches", html: pic("/media/world/work/bow-ten-swatches", 1651, 929, "The same rainbow rebuilt from its ten swatches alone, each pixel painted with its nearest swatch.") },
        ])}
        ${strip()}
        <figcaption>Rebuilt from ten swatches, mean &Delta;E 1.8: the part of the colour the palette does not carry.</figcaption>
      </figure>
      <p class="w-go"><a class="w-try" href="/studies/">Studies</a> <a href="/superframe.html">Superframe</a></p>`,
};

export const PILLARS = [
  {
    id: "flywheel", title: "Flywheel",
    html: `<figure class="w-demo">
        <figcaption>The record says 41 tests passed. Three answers, and what the checker decided about each.</figcaption>
        ${choose("Answers", [
          { button: "Says 42, names the record", html: `<p class="w-io"><span>Answer</span> tests_passed: 42, source: the test record</p><p class="w-verdict" data-verdict="drift">FAIL, held</p><p class="w-io">The value disagrees with the test record.</p>` },
          { button: "Says 41, names the record", html: `<p class="w-io"><span>Answer</span> tests_passed: 41, source: the test record</p><p class="w-verdict" data-verdict="verified">PASS, released</p><p class="w-io">The value agrees with the test record.</p>` },
          { button: "Says 41, names nothing", html: `<p class="w-io"><span>Answer</span> tests_passed: 41, no source</p><p class="w-verdict" data-verdict="unverifiable">UNVERIFIABLE, held</p><p class="w-io">The value agrees, and the answer does not say where it came from.</p>` },
        ])}
        <p class="w-note">Captured checker output. <a href="/flywheel.html#demo">Run the same three checks yourself</a>.</p>
      </figure>
      <p class="w-go"><a class="w-try" href="/flywheel.html">Flywheel</a> <a href="/flywheel-pilot.html">Pilot</a> <a href="https://github.com/HarperZ9/flywheel">Source</a></p>`,
  },
  {
    id: "articulate", title: "Articulate",
    html: `<figure class="w-demo">
        <figcaption>One sentence, before and after.</figcaption>
        ${choose("Version", [
          { button: "Draft", html: `<p class="w-prose"><mark>It is important to note that</mark> this release <mark>really</mark> represents a significant step forward. <mark>Arguably</mark>, the new cache <mark>could potentially</mark> make builds faster in many cases.</p><p class="w-verdict" data-verdict="drift">Blocked: 1 high, 3 medium</p><pre class="w-out">L1 HIGH   filler-intensifier\nL1 MEDIUM throat-clearing opener\nL1 MEDIUM stacked hedge\nL1 MEDIUM worth-noting preamble</pre>` },
          { button: "Rewrite", html: `<p class="w-prose">This release adds a build cache. On our test project, a clean build took 41 seconds and a cached build took 9.</p><p class="w-verdict" data-verdict="verified">Passes the gate</p><pre class="w-out">exit 0</pre>` },
        ])}
        <p class="w-note">Output from <code>articulate check</code>, Articulate 0.4.1.</p>
      </figure>
      <p class="w-go"><a class="w-try" href="/articulate.html">Articulate</a> <a href="https://pypi.org/project/articulate-writing/">pip install <span class="ident" translate="no">articulate-writing</span></a></p>`,
  },
  {
    id: "daylight", title: "Daylight Commons",
    html: `<figure class="w-demo">
        <figcaption>Three findings on a demonstration thread. Every account in it is invented.</figcaption>
        ${choose("Finding", [
          { button: "Sources", html: `<img src="/media/daylight-commons/front-sources.webp" width="600" height="800" loading="lazy" decoding="async" alt="The Daylight Commons panel open on a reply that links to rt.com. Under Sources it reads: state-owned, Russia, with the Wikidata entry it came from.">` },
          { button: "Coordination", html: `<img src="/media/daylight-commons/front-coordination.webp" width="600" height="800" loading="lazy" decoding="async" alt="The panel under Coordination: same text as two other replies in the thread, and how often that happens in ordinary threads.">` },
          { button: "Fact-check", html: `<img src="/media/daylight-commons/front-fact-check.webp" width="600" height="800" loading="lazy" decoding="async" alt="The panel showing that a fact-checker, Logically Facts, rated a matching claim False on 4 December 2024, with a link to the review.">` },
        ])}
      </figure>
      <p class="w-go"><a class="w-try" href="/daylight.html">Daylight Commons</a> <a href="https://github.com/HarperZ9/daylight-commons">Source</a></p>`,
  },
  {
    id: "buildlang", title: "BuildLang",
    html: `<figure class="w-demo">
        <figcaption>The same function, with and without its effect declared.</figcaption>
        ${choose("Version", [
          { button: "Undeclared", html: `<pre class="w-code">fn load_config() {\n    read_file("ops.toml");\n}</pre><p class="w-verdict" data-verdict="drift">Does not build</p><pre class="w-out">function \`load_config\` performs effect \`FileSystem\`\nbut does not declare it\n  help: add ~ FileSystem to the signature</pre>` },
          { button: "Declared", html: `<pre class="w-code">fn load_config() ~ FileSystem {\n    read_file("ops.toml");\n}</pre><p class="w-verdict" data-verdict="verified">Type checking OK</p><pre class="w-out">"declared_effects": { "load_config": ["FileSystem"] }</pre>` },
        ])}
        <p class="w-note">Output from <code>buildc check</code>.</p>
      </figure>
      <p class="w-go"><a class="w-try" href="/buildlang.html">BuildLang</a> <a href="https://github.com/HarperZ9/buildlang">Source</a></p>`,
  },
  {
    id: "engine", title: "The engine",
    html: `<figure class="w-demo">
        ${choose("Frame", [
          { button: "Reference and shortcut", html: `<div class="w-wipe"><div class="w-wipe-frame">
            <img src="/media/raw-native/default-ao_rt.png" width="512" height="512" loading="lazy" decoding="async" alt="Ray-traced ambient occlusion: a soft dark halo on the ground around a box.">
            <img class="w-wipe-top" src="/media/raw-native/default-ao_ss.png" width="512" height="512" loading="lazy" decoding="async" alt="Screen-space ambient occlusion: almost all white, with a thin dark line along the box's bottom edges.">
          </div><label class="w-wipe-control" hidden>Split <input type="range" min="0" max="100" value="50" aria-label="Split between the ray-traced reference and the shortcut"></label>
          <p class="w-verdict" data-verdict="drift">Refuted: error 0.135 against a tolerance of 0.12</p></div>` },
          { button: "One light", html: `<div class="w-pair">${pic("/media/world/work/dark-field-one-light", 1651, 1032, "Four spheres on grey stone in a near-black field, lit by one small warm lantern; 68.5% of the pixels fall below L* 25.")}${pic("/media/world/work/dark-field-control", 1651, 1032, "The control: the same spheres under an even surround of the same mean light, with no shadow and no dark field.")}</div>
          <p class="w-io">One lantern: 68.5% of pixels below L* 25, and every pixel above 0.95 is a highlight. Even light: 0.0%.</p>` },
          { button: "Era quantizer", html: `<ul class="w-tiles">
            <li><img src="/media/world/work/era-rings-source.webp" width="594" height="334" loading="lazy" decoding="async" alt="Newton's rings rendered in 24-bit colour."><span>Source</span></li>
            <li><img src="/media/world/work/era-rings-handheld-greens.webp" width="594" height="334" loading="lazy" decoding="async" alt="The rings in four greens through an ordered Bayer dither, like a handheld screen."><span>Four greens, Bayer</span></li>
            <li><img src="/media/world/work/era-rings-one-bit-atkinson.webp" width="594" height="334" loading="lazy" decoding="async" alt="The rings in one bit, black and white, with Atkinson error diffusion."><span>One bit, Atkinson</span></li>
            <li><img src="/media/world/work/era-rings-two-ink-overprint.webp" width="594" height="334" loading="lazy" decoding="async" alt="The rings printed in two inks that overprint, red and blue, in a halftone."><span>Two inks, overprint</span></li>
          </ul>` },
          { button: "Held frame", html: `<div class="w-held" data-held>${pic("/media/world/work/living-still-frame0", 1649, 928, "A gabled house at night with two lit windows between bare trees, in fine grain and rain.")}<img class="w-held-b" src="/media/world/work/living-still-frame2-1280.webp" width="1649" height="928" loading="lazy" decoding="async" alt=""></div>
          <p class="w-io">The house holds; the grain and the rain re-roll on twos.</p>` },
        ])}
      </figure>
      <p class="w-go"><a class="w-try" href="/raw.html">raw-native</a> <a href="/superframe.html">Superframe</a> <a href="https://github.com/HarperZ9/raw-native">Source</a></p>`,
  },
  {
    id: "low-water", title: "Low Water",
    html: `<figure class="w-demo">
        <video class="w-loop" muted loop playsinline controls preload="none" width="480" height="360" poster="media/front-door/heavenly-boat-poster.jpg"><source src="media/front-door/heavenly-boat-480.mp4" type="video/mp4"></video>
        <figcaption>Low tide, from the film Heavenly Bodies (1920). Public domain, Prelinger Archives.</figcaption>
      </figure>
      <p class="w-io">A narrative game in development, painted and played on the raw-native engine.</p>
      <p class="w-go"><a class="w-try" href="/raw.html">The engine it runs on</a></p>`,
  },
  {
    id: "writing", title: "Essays and films",
    html: `<figure class="w-demo">
        <video controls preload="none" playsinline width="1920" height="1080" poster="media/explainers/checking-cost/poster.jpg"><source src="media/explainers/checking-cost/checking-cost.mp4" type="video/mp4"><track kind="captions" src="media/explainers/checking-cost/checking-cost.vtt" srclang="en" label="English"></video>
        <figcaption>Claiming got cheap. Checking did not. A film, with captions.</figcaption>
      </figure>
      <ul class="w-list-plain">
        <li><a href="/who-knew-first.html">Who Knew First</a></li>
        <li><a href="/checking-the-machines.html">An open letter on checking the machines</a></li>
        <li><a href="/night-school.html">Night School: how AI works, in short films and labs</a></li>
      </ul>
      <p class="w-go"><a class="w-try" href="/publications.html">Writing</a> <a href="/explainers.html">Films</a></p>`,
  },
  {
    id: "work", title: "Work and CV",
    html: `<ul class="w-list-plain">
        <li><a href="/flywheel-pilot.html">Flywheel verification pilot</a></li>
        <li><a href="/work-with-me.html">Work with me</a></li>
        <li><a href="/cv.html">Full CV</a></li>
        <li><a href="/resume.html">Resume</a></li>
      </ul>
      <p class="w-go"><a class="w-try" href="/hire.html">Hire or collaborate</a> <a href="mailto:zaindharper@gmail.com">Email</a></p>`,
  },
];

const num = (i) => String(i).padStart(2, "0");

// The section: the list (the keyboard and screen-reader path), the dial (pointer, drawn by work.js), the panels.
export function workSection() {
  const all = [HUB, ...PILLARS];
  const list = all.map((p, i) => `<li><a href="#w-${p.id}" data-pillar="${p.id}"><span class="w-num" aria-hidden="true">${num(i)}</span> ${esc(p.title)}</a></li>`).join("");
  const panels = all.map((p) => `
    <section class="w-panel" id="w-${p.id}" aria-labelledby="wh-${p.id}">
      <h2 id="wh-${p.id}" tabindex="-1">${esc(p.title)}</h2>
      ${p.html}
    </section>`).join("");
  return `<section class="work" id="work" aria-label="The work">
    <nav class="w-list" aria-label="The work"><ol>${list}</ol></nav>
    <div class="w-dial" aria-hidden="true" data-dial></div>
    <div class="w-panels">${panels}
    </div>
  </section>`;
}
