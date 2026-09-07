import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = url === '/' || url === '/index.html' ? 'home/dist/index.html' : url.slice(1);
    if (url.startsWith('/assets/')) file = 'home/dist' + url;
    const full = path.resolve(root, file);
    if (!full.startsWith(root + path.sep)) throw new Error('outside root');
    const data = await fs.readFile(full);
    res.writeHead(200, {'Content-Type':types[path.extname(full)] || 'application/octet-stream'}); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  await fs.mkdir(path.join(root,'.superpowers/navigation'), {recursive:true});
  for (const width of [320, 820, 1280]) for (const theme of ['light','dark']) {
    const context = await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
    const page = await context.newPage();
    for (const route of ['/', '/flywheel.html', '/bulletin.html', '/fonts.html', '/typeface.html']) {
      await page.goto(base+route);
      if (route === '/') {
        assert.equal(await page.locator('#flywheel td a').first().textContent(), 'Flywheel v0.3.11', 'Flagship must select the newest recorded release, not the first evidence entry');
      }
      const menu = page.locator('.home-menu,.sn-more');
      await menu.locator('summary').click();
      await page.locator('.theme-control select').selectOption(theme);
      const links = menu.locator('a:visible');
      const hrefs = await links.evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname));
      assert.equal(new Set(hrefs).size,hrefs.length,'Duplicate visible menu destinations');
      assert.ok(hrefs.length <= 16,'Menu became a route dump');
      for (const flagship of ['flywheel.html','bulletin.html','fonts.html']) {
        assert.ok(await page.locator(`.topnav a[href$="${flagship}"]:visible,.site-nav a[href$="${flagship}"]:visible`).count(),`Missing ${flagship}`);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true,`${route} overflows ${width}`);
      const bounds = await menu.locator('.home-menu-list,.sn-more-list').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x+bounds.width <= width+1 && bounds.y+bounds.height <=900, 'Menu offscreen');
      await page.screenshot({path:path.join(root,`.superpowers/navigation/${route==='/'?'home':route.slice(1,-5)}-${width}-${theme}.png`)});
      await menu.locator('summary').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await links.first().evaluate(node=>node === document.activeElement),true,'Arrow navigation missed first visible link');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('open'),null,'Escape did not close menu');
      assert.equal(await menu.locator('summary').evaluate(node=>node === document.activeElement),true,'Escape lost focus');
      assert.equal(await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true});
        document.dispatchEvent(event);
        return event.defaultPrevented;
      }),false,'Closed menu must not consume Escape');
    }
    await page.goto(base + '/index.html#site-index');
    await page.locator('#site-index').waitFor();
    assert.equal(await page.locator('#site-index').getAttribute('open'), '', 'Full site index link must reveal its destinations');
    assert.ok(await page.locator('#site-index a:visible').count() > 50, 'Complete route index was lost');
    await context.close();
  }
  console.log('Navigation browser checks passed: home, Flywheel, Bulletin, Fonts, specimen; 320/820/1280; light/dark; keyboard, reflow, direct discovery.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
