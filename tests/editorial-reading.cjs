// Run against a local static server. PLAYWRIGHT_MODULE may point to an installed
// Playwright runtime; BROWSER_CHANNEL may select a locally installed browser.
// Catches a hidden grid marker collapsing story copy and unreadable theme text.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://localhost:8765';
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  try {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({colorScheme, viewport:{width:375,height:900}});
      await page.goto(`${base}/publications.html`);
      await page.evaluate(() => document.fonts.ready);
      const bounds = await page.locator('.lead-story h3').first().boundingBox();
      assert.ok(bounds.width >= 270, `story collapsed to ${bounds.width}px`);
      for (const route of ['publications.html','frontier-safety.html','growth-needs-a-before.html','no-receipt-no-accept.html']) {
        await page.goto(`${base}/${route}`);
        await page.evaluate(() => document.fonts.ready);
        const reading = await page.evaluate(() => {
          const e = document.querySelector('.lead-story p:not(.publication-meta), .record-body>p, .publication-article section>p, .article-body>p');
          const s = getComputedStyle(e);
          const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
          const luminance = c => c.map(v => {v/=255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
          let parent=e, bg;
          while(parent) {bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;}
          const a=luminance(rgb(s.color)), b=luminance(rgb(bg));
          return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:parseFloat(s.fontSize),overflow:document.documentElement.scrollWidth>innerWidth};
        });
        assert.ok(reading.contrast>=4.5, `${route}/${colorScheme}: contrast ${reading.contrast}`);
        assert.ok(reading.size>=17, `${route}: small body ${reading.size}`);
        assert.equal(reading.overflow,false,`${route}: horizontal overflow`);
      }
      await page.close();
    }
    console.log('Editorial reading: mobile measure, contrast, type and reflow pass in light/dark preferences.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
