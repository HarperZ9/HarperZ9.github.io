// tools/render.mjs: render a brush scene to a lossless PNG from node.
// usage: node tools/render.mjs <scene> <width> <out.png> [16]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { SCENES, render, encodePNG } from '../brush/index.js';

const [name = 'nocturne', width = '600', out = `${name}.png`, bits = '8'] = process.argv.slice(2);
if (!SCENES[name]) { console.error(`render: unknown scene ${name}; have ${Object.keys(SCENES).join(', ')}`); process.exit(1); }
const t0 = performance.now();
const s = await render(SCENES[name](), Number(width));
const ms = performance.now() - t0;
const px = bits === '16' ? s.toRGBA16() : s.toRGBA8();
writeFileSync(out, await encodePNG(s.w, s.h, px, (b) => deflateSync(b, { level: 6 })));
console.log(JSON.stringify({ scene: name, w: s.w, h: s.h, bits: Number(bits), dabs: s.dabs, renderMs: Math.round(ms), out }));
