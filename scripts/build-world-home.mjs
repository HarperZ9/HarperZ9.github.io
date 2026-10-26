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
  const menu = absolute(pick(p, /<dialog id="o-menu"[\s\S]*?<\/dialog>/, "the menu"))
    .replace(/<p class="o-menu-foot">/, '<p class="o-menu-foot"><a href="/elements.html">Elements</a> <a href="/swatches.html">Swatches</a> <a href="/studies/">Studies</a> ');
  const canvases = (p.match(/<canvas id="[^"]+" class="[^"]+" data-art aria-hidden="true"><\/canvas>/g) || []).join("\n");
  const main = pick(p, /<main id="main">[\s\S]*?<\/main>/, "the road");
  // the road's stops, each heading given the living-type hook (Hanken underneath until the engine paints it)
  const stops = absolute(main.replace(/^<main id="main">/, "").replace(/<\/main>$/, "")
    .replace(/<h1 class="sr-only">[^<]*<\/h1>/, "")
    .replace(/<h2 id="([^"]+)" tabindex="-1">/g, '<h2 id="$1" tabindex="-1" data-living="ink charcoal plant paint">'));
  const bodyClass = (p.match(/<body class="([^"]+)"/) || [, "path"])[1];
  return { hand, menu, canvases, stops, bodyClass };
}

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
function bazaar(rules) {
  return PLACES.map((pl, i) => `
  <section class="place" id="p-${pl.id}" data-place="${pl.id}" data-form="${pl.form}" data-medium="${pl.medium}" aria-labelledby="h-${pl.id}">
    <div class="place-in">
      <figure class="lead-box">${lead(pl)}</figure>
      <div class="place-words">
        <h2 id="h-${pl.id}" data-living="${pl.living.join(" ")}">${esc(pl.title)}</h2>
        ${lawsOf(pl.laws, rules)}
        <nav class="ways" aria-label="${esc(pl.title)}">${pl.ways.map(([href, t]) => `<a href="${href}">${esc(t)}</a>`).join("")}</nav>
      </div>
    </div>
  </section>`).join("\n");
}

function build() {
  const r = roadParts(), world = JSON.parse(read("world/universe/proto/world.json"));
  const rules = new Map(world.rules.map((x) => [x.id, x]));
  const html = read("site-src/world/home.html.tmpl")
    .replace("{{BODY_CLASS}}", r.bodyClass).replace("{{HAND}}", r.hand).replace("{{MENU}}", r.menu)
    .replace("{{CANVASES}}", r.canvases).replace("{{ROAD}}", r.stops).replace("{{BAZAAR}}", bazaar(rules)).replace("{{ARRIVAL_SOURCES}}", sources("/media/world/name-art/glass-tubes"));
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("home: a placeholder was left unfilled");
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads)/.test(html) || html.includes("—")) throw new Error("home: a local path or an em dash reached the page");
  writeFileSync(path.join(site, "index.html"), html);
  console.log(`home: index.html with ${(r.stops.match(/class="stop"/g) || []).length} road stops and ${PLACES.length} places`);
}
build();
