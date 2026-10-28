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
import { stageSheets, stageHand, stageRoadPage } from "./stage-road.mjs";

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
    .replace(/data-o="record" data-sound/, 'data-o="record" data-hum');
  hand = stageHand(hand);  // the strip of stop squares goes; the worlds take its place (themes/switch.js)
  const menu = absolute(pick(p, /<dialog id="o-menu"[\s\S]*?<\/dialog>/, "the menu"))
    .replace(/<p class="o-menu-foot">/, '<p class="o-menu-foot"><a href="/elements.html">Elements</a> <a href="/swatches.html">Swatches</a> <a href="/studies/">Studies</a> ');
  // the road's own full-view canvases (road, strata, carry) fold into the one stage (world/site/stage.js)
  const canvases = '<canvas id="stage" aria-hidden="true"></canvas>';
  const main = pick(p, /<main id="main">[\s\S]*?<\/main>/, "the road");
  // the road's stops keep their still headings: living type on all 33 built and dropped a GL context per heading
  // while walking (the arrival and the places keep it)
  const stops = absolute(main.replace(/^<main id="main">/, "").replace(/<\/main>$/, "")
    .replace(/<h1 class="sr-only">[^<]*<\/h1>/, "")
    );
  const staged = stageSheets(stops);  // each sheet a box with an offscreen surface behind it; the records cut
  const bodyClass = (p.match(/<body class="([^"]+)"/) || [, "path"])[1];
  // the standalone road page walks the same road on the stage
  writeFileSync(path.join(site, "world/universe/proto/path.html"), stageRoadPage(p));
  return { hand, menu, canvases, stops: staged, bodyClass };
}

// a name set in capitals (EMET) gets the tracking capitals need
const caps = (t) => (/^[A-Z0-9 ]{3,}$/.test(t) ? ' class="caps"' : "");
function lawsOf(ids, rules) {
  const list = ids.map((id) => rules.get(id)).filter(Boolean);
  return list.length ? `<ul class="laws">${list.map((r) => `<li>${esc(r.statement)}</li>`).join("")}</ul>` : "";
}
// a loop's sources are filled by world/site/loops.js from the device pixels its slot needs (1280 or 1920 px, AV1 in
// WebM first, H.264 in MP4 for Safari); the markup carries the base path and the sizes on offer
export const LOOP_SIZES = "1280 1920";
function lead(pl) {
  const L = pl.lead;
  if (L.kind === "loop") return `<video class="lead" muted loop playsinline preload="none" data-src="${L.src}" data-sizes="${LOOP_SIZES}" width="1920" height="1080" aria-label="${esc(L.alt)}" data-loop></video>`;
  if (L.kind === "hum") return `<div class="lead hum"><div class="hum-wave" aria-hidden="true"></div><button type="button" class="hum-press" data-hum aria-pressed="false" aria-describedby="hum-what">Hum v4</button><span id="hum-what" class="sr-only">${esc(L.alt)}</span></div>`;
  if (L.kind === "living") return `<div class="lead" data-slot="render"><img src="${L.src}" width="${L.w}" height="${L.h}" alt="${esc(L.alt)}" loading="lazy" decoding="async"></div>`;
  return `<img class="lead" src="${L.src}" width="${L.w}" height="${L.h}" alt="${esc(L.alt)}" loading="lazy" decoding="async" data-uncover>`;
}
function bazaar(rules) {
  return PLACES.map((pl, i) => `
  <article class="place" id="p-${pl.id}" data-place="${pl.id}" data-form="${pl.form}" data-medium="${pl.medium}" aria-labelledby="hp-${pl.id}">
    <div class="place-in">
      <figure class="lead-box">${lead(pl)}</figure>
      <div class="place-words">
        <h2 id="hp-${pl.id}" data-living="${pl.living.join(" ")}">${esc(pl.title)}</h2>
        ${lawsOf(pl.laws, rules)}
        <nav class="ways" aria-label="${esc(pl.title)}">${pl.ways.map(([href, t]) => `<a href="${href}"${caps(t)}>${esc(t)}</a>`).join("")}</nav>
      </div>
    </div>
  </article>`).join("\n");
}

function build() {
  const r = roadParts(), world = JSON.parse(read("world/universe/proto/world.json"));
  const rules = new Map(world.rules.map((x) => [x.id, x]));
  const html = read("site-src/world/home.html.tmpl")
    .replace("{{BODY_CLASS}}", r.bodyClass).replace("{{HAND}}", r.hand).replace("{{MENU}}", r.menu)
    .replace("{{CANVASES}}", r.canvases).replace("{{ROAD}}", r.stops).replace("{{BAZAAR}}", bazaar(rules)).replace(/\{\{LOOP_SIZES\}\}/g, LOOP_SIZES);
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("home: a placeholder was left unfilled");
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads)/.test(html) || html.includes("—")) throw new Error("home: a local path or an em dash reached the page");
  writeFileSync(path.join(site, "index.html"), html);
  console.log(`home: index.html with ${(r.stops.match(/class="stop"/g) || []).length} road stops and ${PLACES.length} places`);
}
build();
