#!/usr/bin/env node
// Build cmmns.html, the CMMNS tool page, in the world's shell. CMMNS was Daylight Commons until
// 2026-10-28, and Radar before that; daylight.html is a redirect stub to this page.
//
//   node scripts/build-cmmns.mjs && python tools/structured_data.py
//
// The version, licence and download come from the CMMNS record in discover.json, so a release bump is one
// edit there and a re-run. The copy follows the project's own README and release notes (v3.9.0, read
// 2026-10-28). tools/structured_data.py then writes the SoftwareApplication block from the same record.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";
import { page } from "./studies-shell.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tool = JSON.parse(readFileSync(path.join(site, "discover.json"), "utf8")).tools.find((t) => t.name === "CMMNS");
const v = tool.version, rel = `https://github.com/HarperZ9/cmmns/releases/tag/v${v}`, repo = "https://github.com/HarperZ9/cmmns";
const PAGES = "https://harperz9.github.io/cmmns";

const signs = [
  ["Place", "where the platform labels the account as based, and a reply that speaks as a local of somewhere else"],
  ["Account", "age, renames, sign-up handles and follow patterns"],
  ["Posting", "a 24-hour posting clock, the last 14 days, the apps it posts from and how fast it replies"],
  ["Coordination", "the same text from several accounts, the same upload carried by many, replies that arrive in bursts"],
  ["Language", "slurs, calls for violence, dehumanising language and spam patterns, each with the words that matched"],
  ["Sources", "who owns a linked outlet, and state links where a cited report names the site or account"],
  ["Fact-checked claims", "the fact-checker, their rating in their own words and a link, from about 19,000 reviews that ship inside the extension"],
  ["Media", "pictures first uploaded long before the post that shows them, with reverse image search"],
];

const body = `<article class="tool">
<h1>CMMNS</h1>
<p>Rest the pointer on a reply and a window opens beside it: where the account is placed, signs of coordination, how it posts, how the reply argues, and whether a fact-checker has reviewed the claim. It works on X, YouTube, Reddit, Facebook, Instagram, Bluesky, Threads, TikTok and any Mastodon server you turn it on for. On a phone, tap the post's CMMNS button.</p>
<p>CMMNS, spoken "commons", was formerly Daylight Commons, and Radar before that. An install from before the rename updates in place and keeps its settings, its saves and its save folder.</p>
<dl class="facts"><dt>Version</dt><dd><a href="${rel}">${esc(v)}</a></dd><dt>Browsers</dt><dd>${esc(tool.os)}</dd><dt>Licence</dt><dd><a href="${esc(tool.license)}">AGPL-3.0</a></dd><dt>Source</dt><dd><a href="${repo}">HarperZ9/cmmns</a></dd></dl>

<h2 id="install">Install</h2>
<h3>Chrome, Edge or Brave</h3>
<ol>
<li>Download <code>cmmns-chrome-${esc(v)}.zip</code> from <a href="${rel}">the ${esc(v)} release</a> and unzip it.</li>
<li>Open <code>chrome://extensions</code> (Edge: <code>edge://extensions</code>) and turn on Developer mode.</li>
<li>Choose Load unpacked and pick the unzipped folder.</li>
<li>Pick your sites on the first-run page and press Start CMMNS.</li>
</ol>
<p>To update, replace the folder and press Reload. Settings carry over, and pages left open get the new buttons without a reload.</p>
<h3>Firefox 128 or later</h3>
<ol>
<li>Download <code>cmmns-firefox-${esc(v)}.xpi</code> from the same release.</li>
<li>Open <code>about:debugging#/runtime/this-firefox</code>, choose Load Temporary Add-on and pick the file.</li>
</ol>
<p>Firefox removes temporary add-ons on restart until a signed build is published.</p>
<h3>Command line</h3>
<p>Unzip <code>cmmns-cli-${esc(v)}.zip</code> and run it with Node 22 or later on a saved thread or your own export:</p>
<pre class="cmd" tabindex="0" aria-label="Command"><code>node bin/radar.mjs analyze saved-thread.html</code></pre>

<h2 id="verify">Check the download</h2>
<p>Every file in the release is listed in <code>SHA256SUMS</code> and signed in <code>SHA256SUMS.sig</code> with the project key, key id <code>0e5e 1984 0565 840c 977e 0f03 6c9a c021</code>. Open <code>verify-offline.html</code> from the release to check the signature without a network, or use the <a href="${PAGES}/install.html">install page</a>.</p>

<h2 id="window">What the window shows</h2>
<dl class="facts">${signs.map(([k, d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join("")}</dl>
<p>Each sign shows its measured precision from the project's evaluation, or says it is not measured yet. The <a href="${PAGES}/how-it-works.html">how it works page</a> explains every finding type.</p>

<h2 id="media">Save, convert and keep media</h2>
<p>A Download button sits in the corner of any picture, GIF or video, even where the site blocks right-click. Save to CMMNS keeps a file as evidence in an investigation case, with its SHA-256, address, page and time. Convert or compress changes pictures among PNG, JPEG, WebP and AVIF and makes video smaller, in your browser with no upload. Protected media (DRM or encrypted streams) is never saved, and CMMNS says so.</p>

<h2 id="privacy">What it sends and keeps</h2>
<p>It reads what the site shows you and requests account details only from the site you are on. Other coverage and evidence lookups reach further, and only after you turn them on and click. Account details stay in your browser for 14 days and thread history for 60, both adjustable, and one control clears everything.</p>

<h2 id="new">New in ${esc(v)}</h2>
<p>The new name. Everything saved before, every case and every signed bundle still reads and verifies. New installs save into Downloads/CMMNS, and an install from before keeps Downloads/Daylight. The command line answers to <code>cmmns</code>, and <code>daylight</code> still works. Release files are named <code>cmmns-*</code>. <a href="${rel}">Release notes</a>.</p>
</article>`;

const description = "CMMNS (formerly Daylight Commons) is a browser extension that shows where social media replies come from: place, coordination, posting, language, fact-checks.";
writeFileSync(path.join(site, "cmmns.html"), page({ path: "cmmns.html", title: "CMMNS", description, body }));
console.log(`cmmns.html: CMMNS ${v}, ${description.length}-character description`);
