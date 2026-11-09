#!/usr/bin/env node
// Build index.html, the world's entrance: the arrival, the universe's road (taken from the imported
// world/universe/proto/path.html, so the road agent's new stops arrive with the next import), then the bazaar of
// places from site-src/world/bazaar.mjs. Run after scripts/import-mission-control.mjs.
//
//   node scripts/build-world-home.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACES } from "../site-src/world/bazaar.mjs";
import { PLATFORMS, LANDMARKS, CHECKED } from "../site-src/world/platforms.mjs";
import { menuDialog } from "./hand-menu.mjs";
import { workSection } from "../site-src/world/work.mjs";
import { labelHand } from "./hand-labels.mjs";
import { backdrop } from "./field-backdrop.mjs";
import { supergraphic } from "./supergraphic.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(path.join(site, p), "utf8");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ROAD = "/world/universe/proto/";

// Relative links in the road's markup become absolute, since the road now sits at the site root.
function absolute(html) {
  return html.replace(/\b(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, (m, a, v) => `${a}="${new URL(v, "https://x" + ROAD).pathname}${new URL(v, "https://x" + ROAD).search}${new URL(v, "https://x" + ROAD).hash}"`);
}
function pick(html, re, what) { const m = html.match(re); if (!m) throw new Error(`home: ${what} not found in path.html`); return m[0]; }

function roadParts() {
  const p = read("world/universe/proto/path.html");
  let hand = absolute(pick(p, /<header class="o-hand"[\s\S]*?<\/header>/, "the hand"));
  hand = hand.replace(/<a class="skip" href="[^"]*">/, '<a class="skip" href="/floor.html">')
    .replace(/<a class="o-home" href="[^"]*">/, '<a class="o-home" href="/" aria-current="page">')
    .replace(/data-o="record" data-sound/, 'data-o="record" data-hum')
    // the home's hand keeps what has a job there: the menu, the lamp (light or dark), motion and plain view.
    // Find and Back serve the map and its places; the sound control repeats the press in the Sound place.
    .replace(/\s*<form class="find"[\s\S]*?<\/form>/, "")
    .replace(/\s*<button type="button" id="back"[^>]*>[\s\S]*?<\/button>/, "")
    .replace(/\s*<button type="button" data-o="record"[\s\S]*?<\/button>/, "");
  hand = labelHand(hand);
  // the menu is the site's one list: the six landmarks in the author's order, then the rest (scripts/hand-menu.mjs)
  const menu = menuDialog({ here: "/" });
  const canvases = (p.match(/<canvas id="[^"]+" class="[^"]+" data-art aria-hidden="true"><\/canvas>/g) || []).join("\n");
  const main = pick(p, /<main id="main">[\s\S]*?<\/main>/, "the road");
  // the road's stops, each heading given the living-type hook (Hanken underneath until the engine paints it)
  const stops = absolute(main.replace(/^<main id="main">/, "").replace(/<\/main>$/, "")
    .replace(/<h1 class="sr-only">[^<]*<\/h1>/, "")
    // living type stays off the home for now: its engine paints a paper sheet behind each heading, a box the
    // author ruled out on 2026-11-02; it returns once the type engine can paint on a clear ground
    // the road's plates sit far below the first screen: they load as the visitor nears them
    .replace(/<img class="plate" (?![^>]*loading=)/g, '<img class="plate" loading="lazy" decoding="async" '));
  const bodyClass = (p.match(/<body class="([^"]+)"/) || [, "path"])[1];
  return { hand, menu, canvases, stops, bodyClass };
}

// a name set in capitals (EMET) gets the tracking capitals need
const caps = (t) => (/^[A-Z0-9 ]{3,}$/.test(t) ? ' class="caps"' : "");
function lawsOf(ids, rules) {
  const list = ids.map((id) => rules.get(id)).filter(Boolean);
  return list.length ? `<ul class="laws">${list.map((r) => `<li>${esc(r.statement)}</li>`).join("")}</ul>` : "";
}
// a loop's sources: the 640 px encodes on phones, the full ones elsewhere; AV1 in WebM first, H.264 for Safari
export function sources(src) {
  return `<source src="${src}-640.webm" type='video/webm; codecs="av01.0.04M.08"' media="(max-width: 860px)"><source src="${src}-640.mp4" type="video/mp4" media="(max-width: 860px)">` +
    `<source src="${src}.webm" type='video/webm; codecs="av01.0.08M.08"'><source src="${src}.mp4" type="video/mp4">`;
}
function lead(pl) {
  const L = pl.lead;
  if (L.kind === "loop") return `<video class="lead" muted loop playsinline preload="none" data-poster="${L.src}" width="1280" height="720" aria-label="${esc(L.alt)}" data-loop>
      ${sources(L.src)}</video>`;
  if (L.kind === "hum") return `<div class="lead hum"><canvas class="hum-wave" aria-hidden="true"></canvas><button type="button" class="hum-press" data-hum aria-pressed="false" aria-describedby="hum-what">Hum v4</button><span id="hum-what" class="sr-only">${esc(L.alt)}</span></div>`;
  if (L.kind === "living") return `<div class="lead" data-alive="livestill"><img src="${L.src}" width="${L.w}" height="${L.h}" alt="${esc(L.alt)}" loading="lazy" decoding="async"></div>`;
  return `<img class="lead" src="${L.src}" width="${L.w}" height="${L.h}" alt="${esc(L.alt)}" loading="lazy" decoding="async" data-uncover>`;
}
// each place on the front door states its first law; the rest live in the place itself, so the home reads as media first
function bazaar(rules) {
  return PLACES.map((pl, i) => `
  <article class="place" id="p-${pl.id}" data-place="${pl.id}" data-form="${pl.form}" data-medium="${pl.medium}" aria-labelledby="hp-${pl.id}">
    <div class="place-in">
      <figure class="lead-box">${lead(pl)}</figure>
      <div class="place-words">
        <h3 id="hp-${pl.id}">${esc(pl.title)}</h3>
        ${lawsOf(pl.laws.slice(0, 1), rules)}
        <nav class="ways" aria-label="${esc(pl.title)}">${pl.ways.map(([href, t]) => `<a href="${href}"${caps(t)}>${esc(t)}</a>`).join("")}</nav>
      </div>
    </div>
  </article>`).join("\n");
}

// a defined term, written [[term]] in the words, becomes <dfn class="term"> in its platform's colour (depth.css)
const terms = (t, hue) => esc(t).replace(/\[\[(.+?)\]\]/g, (m, w) => `<dfn class="term" data-hue="${hue || "brass"}">${w}</dfn>`);

// the front door: the six landmarks in the author's order, each with the work under it. Site carries the places
// (the bazaar); Everything carries the rest of the work and the way to every piece.
const ident = (t) => esc(t).replace(/(^|[\s(])([a-z0-9]+(?:-[a-z0-9.]+)+)(?=$|[\s),])/g, '$1<span class="ident" translate="no">$2</span>');
function row(p) {
  // package and file names stay whole on narrow screens (scripts/ident-tokens.mjs, tests/ident-narrow-reading.cjs)
  const run = p.run ? `<p class="pf-run">${p.runIsProse ? ident(p.run) : `<code>${ident(p.run)}</code>`}${p.then ? `, then <code>${ident(p.then)}</code>` : ""}${p.note ? ` <span class="pf-note">(${esc(p.note)})</span>` : ""}</p>` : "";
  // the version opens to its release: every number on the front door leads to where it came from
  const ver = p.version ? ` <a class="pf-ver" href="${p.releaseUrl}">${esc(p.version)}</a>` : "";
  // "See it work" opens the dial's panel for this piece in place (site-src/world/work.mjs), so every row leads to
  // something to play with before a page of words
  const ways = [p.try ? `<a class="pf-go" href="${p.try}">See it work</a>` : "", `<a${p.try ? "" : ' class="pf-go"'} href="${p.see[0]}">${esc(p.see[1])}</a>`, p.repo ? `<a href="${p.repo}">Source</a>` : ""].join("");
  const name = p.name ? `<span class="pf-name d-fine" data-hue="${p.hue || "brass"}">${esc(p.name)}</span>${p.mark ? `<span class="pf-mark">${esc(p.mark)}</span>` : ""}` : "";
  return `
      <div class="pf" id="pf-${p.id}">
        <div class="pf-words">
          <h3 id="hpf-${p.id}">${name}<span class="pf-product">${esc(p.product)}${ver}</span></h3>
          <p class="pf-what">${terms(p.what, p.hue)}</p>
          ${run}
          <nav class="pf-ways" aria-labelledby="hpf-${p.id}">${ways}</nav>
          ${p.verified ? `<p class="pf-verified"><b>Verified</b> ${esc(CHECKED)}: ${esc(p.verified)}</p>` : ""}
        </div>
      </div>`;
}
export function ways() {
  return LANDMARKS.map((l) => `<a href="#${l.id === "site" ? "site" : l.id === "everything" ? "everything" : "lm-" + l.id}">${esc(l.word)}</a>`).join("");
}
function landmarks(rules) {
  // each landmark word is fixed before it is used: one line saying what we mean by it and what it leaves out
  const head = (l) => `<h2 id="h-${l.id}" class="lm-word"><span class="d-3d" data-hue="${l.hue}">${esc(l.word)}</span>${l.mark ? ` <span class="pf-mark">${esc(l.mark)}</span>` : ""}</h2>${l.def ? `<p class="lm-def">${terms(l.def, l.hue)}</p>` : ""}`;
  const rows = (l) => l.rows.map((id) => row(PLATFORMS.find((p) => p.id === id))).join("");
  const work = LANDMARKS.filter((l) => !["site", "everything"].includes(l.id)).map((l) => `
    <section class="lm" id="lm-${l.id}" aria-labelledby="h-${l.id}"><div class="lm-in">
      ${head(l)}${rows(l)}
    </div></section>`).join("");
  const site = LANDMARKS.find((l) => l.id === "site"), all = LANDMARKS.find((l) => l.id === "everything");
  return `<div class="landmarks" id="work" data-medium="viscous">${work}
  </div>
  <section class="lm lm-site" id="site" aria-labelledby="h-site">
    <div class="lm-in">${head(site)}${rows(site)}</div>
    <div class="bazaar" aria-label="Places">
${bazaar(rules)}
    </div>
  </section>
  <section class="lm lm-everything" id="everything" aria-labelledby="h-everything"><div class="lm-in">
    ${head(all)}${rows(all)}
    <p class="lm-floor"><a href="/floor.html">Every piece of work, current and past, and every page of the site</a></p>
  </div></section>`;
}

function build() {
  const r = roadParts(), world = JSON.parse(read("world/universe/proto/world.json"));
  const rules = new Map(world.rules.map((x) => [x.id, x]));
  const html = read("site-src/world/home.html.tmpl")
    .replace("{{BODY_CLASS}}", r.bodyClass).replace("{{HAND}}", r.hand).replace("{{MENU}}", r.menu)
    .replace("{{CANVASES}}", r.canvases).replace("{{ROAD}}", r.stops).replace("{{LANDMARKS}}", landmarks(rules)).replace("{{WORK}}", workSection()).replace("{{SUPER}}", supergraphic(JSON.parse(read("world/site/crossover/colour-tokens.json")).platform)).replace("{{WAYS}}", ways()).replace("{{BACKDROP}}", backdrop({ priority: "high", live: true })).replace("{{ARRIVAL_SOURCES}}", sources("/media/world/name-art/glass-tubes"));
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("home: a placeholder was left unfilled");
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads)/.test(html) || html.includes("—")) throw new Error("home: a local path or an em dash reached the page");
  writeFileSync(path.join(site, "index.html"), html);
  console.log(`home: index.html with the glass-and-water field and ${PLACES.length} places`);
}
build();
