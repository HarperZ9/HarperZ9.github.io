// Real-browser checks for the career pages. SITE_BASE_URL may be a preview or live site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const root = (process.env.SITE_BASE_URL || 'http://127.0.0.1:8802').replace(/\/$/, '');
  const output = process.env.QA_OUTPUT || 'qa/career-browser';
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome', headless:true});
  const routes = ['hire.html', 'resume.html', 'resume-support-operations.html', 'resume-evaluation-tooling.html', 'resume-grounds.html', 'resume-public-operations.html', 'cv.html'];
  const results = [], downloads = new Set();
  for (const width of [390, 1440]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of routes) {
      const response = await page.goto(`${root}/${route}`, {waitUntil:'networkidle'});
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator('main h1').count(), 1, route);
      assert.equal(await page.locator('#site-nav a').count() > 0, true, route + ': navigation');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ': horizontal overflow');
      const body = await page.locator('main').innerText();
      assert.ok(body.includes('2026-09-20'), route + ': stale release');
      for (const link of await page.locator('a[download]').evaluateAll(a => a.map(x => x.href))) downloads.add(link);
      await page.screenshot({path:path.join(output,`${route.replace('.html','')}-${width}.png`),fullPage:true});
      results.push({route,width,status:response.status(),horizontalOverflow:false});
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const request = await browser.newContext();
  const downloaded = [];
  for (const url of downloads) {
    const response = await request.request.get(url);
    assert.equal(response.status(), 200, url);
    const bytes = await response.body();
    assert.ok(bytes.length > 100, url);
    downloaded.push({url,bytes:bytes.length,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')});
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,downloads:downloaded},null,2));
  await browser.close();
  console.log(`PASS: ${results.length} page/viewport checks and ${downloads.size} downloads`);
})().catch(error => {console.error(error);process.exitCode=1;});
