// tools/golden.mjs: write the golden image the visual test compares against (raw RGBA8, undithered).
// Run only when a change to the engine's look is intended: node tools/golden.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { render, starcloud } from '../brush/index.js';
const s = await render(starcloud(3), 160);
mkdirSync(new URL('../brush/test/golden/', import.meta.url), { recursive: true });
writeFileSync(new URL('../brush/test/golden/starcloud-160.rgba', import.meta.url), s.toRGBA8({ dither: false }));
console.log('golden written', s.w, 'x', s.h);
