#!/usr/bin/env node
// The site's pointer: a stylus made of measured materials, rendered once per state and setting as cursor images.
//
//   node scripts/build-pointer.cjs             write world/ui/shell/pointer/ (PNG at 1x and 2x, pointer.css, pointer.json)
//   node scripts/build-pointer.cjs --check     render again and compare with the committed images, pixel for pixel
//   node scripts/build-pointer.cjs --sheet F   write a sheet of every state on five grounds, real size and four times
//
// One source: scripts/pointer/forms.cjs holds the forms, the states and which material record each surface is made
// of; scripts/pointer/surface.cjs shades them from the records' measured n and k (site-src/pointer/records.json).
// The operating system moves a cursor image, so the pointer never waits on the page.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const F = require('./pointer/forms.cjs'), { render } = require('./pointer/scene.cjs'), PNG = require('./pointer/png.cjs');
const { css } = require('./pointer/css.cjs');
const site = path.dirname(__dirname), OUT = path.join(site, 'world/ui/shell/pointer');

// every image: setting, state, frame (busy turns through four), file name
function jobs() {
  const out = [];
  for (const setting of Object.keys(F.SETTINGS)) for (const [state, st] of Object.entries(F.STATES)) {
    if (F.SETTINGS[setting].hue && !F.HUE_STATES.includes(state)) continue;
    for (let f = 0; f < (st.frames || 1); f++) out.push({ setting, state, frame: f, name: `${setting}-${state}${st.frames ? `-${f}` : ''}` });
  }
  return out;
}

// the image must not touch its border (the form is whole) and its hot spot must sit on the form
function audit(name, img, hot, scale) {
  const { w, rgba } = img, A = (x, y) => rgba[(y * w + x) * 4 + 3];
  for (let i = 0; i < w; i++) if (A(i, 0) || A(i, w - 1) || A(0, i) || A(w - 1, i)) throw new Error(`pointer: ${name} at ${scale}x touches its border`);
  const [hx, hy] = hot.map((v) => v * scale);
  if (A(hx, hy) < 128) throw new Error(`pointer: ${name} at ${scale}x has no form under its hot spot (${hx}, ${hy})`);
}

function build(check) {
  const list = jobs();
  let differ = 0;
  if (!check) fs.mkdirSync(OUT, { recursive: true });
  for (const j of list) for (const scale of [1, 2]) {
    const img = render(F.sceneFor(j.setting, j.state, j.frame), scale);
    audit(j.name, img, F.STATES[j.state].hot, scale);
    const file = path.join(OUT, `${j.name}${scale === 2 ? '@2x' : ''}.png`);
    if (!check) { fs.writeFileSync(file, PNG.encode(img.w, img.h, img.rgba)); continue; }
    const had = fs.existsSync(file) ? PNG.decode(fs.readFileSync(file)) : null;
    if (!had || !had.rgba.equals(img.rgba)) { differ++; console.error(`pointer: ${path.basename(file)} differs from a fresh render`); }
  }
  const record = {
    about: 'Written by scripts/build-pointer.cjs; do not edit by hand.',
    size: F.SIZE, scales: [1, 2],
    states: Object.fromEntries(Object.entries(F.STATES).map(([s, v]) => [s, { hot: v.hot, ...(v.frames ? { frames: v.frames } : {}) }])),
    settings: Object.fromEntries(Object.keys(F.SETTINGS).map((s) => [s, { states: Object.keys(F.STATES).filter((st) => !F.SETTINGS[s].hue || F.HUE_STATES.includes(st)), made_of: F.recordOf(s) }])),
    records: require('../site-src/pointer/records.json').source,
  };
  const files = { 'pointer.css': css(), 'pointer.json': JSON.stringify(record, null, 1) + '\n' };
  for (const [n, text] of Object.entries(files)) {
    const file = path.join(OUT, n);
    if (!check) fs.writeFileSync(file, text);
    else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { differ++; console.error(`pointer: ${n} differs from a fresh build`); }
  }
  if (check) { if (differ) { console.error(`pointer: ${differ} files differ; run node scripts/build-pointer.cjs`); process.exit(1); } console.log(`pointer: ${list.length * 2} images and 2 files match a fresh render`); }
  else console.log(`pointer: ${list.length} images at two scales`);
}

async function sheet(file) {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const uri = (img) => `data:image/png;base64,${PNG.encode(img.w, img.h, img.rgba).toString('base64')}`;
  const grounds = [['#e8e3d9', '#16130f', 'light wall'], ['#0c1620', '#f4efe6', 'the field, deep water'], ['#3a6fb5', '#fff', 'the field, lit water'], ['#f9f4e8', '#16130f', 'a picture, cream'], ['#e24f32', '#fff', 'a picture, red']];
  const cells = {};
  for (const j of jobs()) if (j.frame === 0 || j.state === 'busy') {
    const sc = F.sceneFor(j.setting, j.state, j.frame);
    cells[j.name] = { real: uri(render(sc, 1)), four: uri(render(sc, 4)), setting: j.setting, state: j.state };
  }
  const base = ['day', 'night', 'sky'], states = Object.keys(F.STATES).map((s) => (F.STATES[s].frames ? `${s}-0` : s));
  let html = '<style>body{margin:0;font:13px/1.3 system-ui,sans-serif}section{padding:16px 20px}h2{font-size:14px;margin:0 0 10px}table{border-collapse:collapse}td{padding:4px 10px 4px 0;vertical-align:middle}img{display:block}.q{image-rendering:pixelated}</style>';
  for (const [bg, fg, gname] of grounds) {
    html += `<section style="background:${bg};color:${fg}"><h2>${gname}: each setting's states at real size (32 px), then at four times rendered, then the 32 px image enlarged four times</h2><table>`;
    for (const s of base) {
      const row = states.map((st) => cells[`${s}-${st}`]);
      html += `<tr><td>${s}<br><small>${Object.values(F.recordOf(s)).slice(0, 4).join(', ')}</small></td>${row.map((c) => `<td><img src="${c.real}" width="32" height="32"></td>`).join('')}</tr>`;
      html += `<tr><td></td>${row.map((c) => `<td><img src="${c.four}" width="128" height="128"></td>`).join('')}</tr>`;
      html += `<tr><td></td>${row.map((c) => `<td><img class="q" src="${c.real}" width="128" height="128"></td>`).join('')}</tr>`;
    }
    html += `<tr><td>platform lacquers<br><small>site colour tokens, not measured dyes</small></td>${Object.keys(F.HUES).map((h) => `<td><img src="${cells[`${h}-give`].real}" width="32" height="32"></td>`).join('')}</tr>`;
    html += `<tr><td></td>${Object.keys(F.HUES).map((h) => `<td><img src="${cells[`${h}-rest`].four}" width="128" height="128"></td>`).join('')}</tr>`;
    html += `<tr><td>busy, four frames</td>${[0, 1, 2, 3].map((f) => `<td><img src="${cells[`day-busy-${f}`].four}" width="128" height="128"></td>`).join('')}</tr></table></section>`;
  }
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  try { const page = await browser.newPage({ viewport: { width: 1400, height: 900 } }); await page.setContent(html); await page.screenshot({ path: file, fullPage: true }); } finally { await browser.close(); }
  console.log('pointer: sheet written to', file);
}

const s = process.argv.indexOf('--sheet');
if (s > 0) sheet(process.argv[s + 1]).catch((e) => { console.error(e); process.exit(1); });
else build(process.argv.includes('--check'));
