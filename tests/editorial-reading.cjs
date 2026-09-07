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
      const shellIssues = [];
      const publicationsSealVisible = await page.locator('.frame > .seal').first().evaluate(e => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      });
      if (publicationsSealVisible) shellIssues.push(`publications/${colorScheme}: frame seal visible`);
      const bounds = await page.locator('.lead-story h3').first().boundingBox();
      assert.ok(bounds.width >= 270, `story collapsed to ${bounds.width}px`);
      await page.goto(`${base}/flywheel.html`);
      await page.evaluate(() => document.fonts.ready);
      const flywheelSeal = await page.locator('.frame .seal').first().evaluate(e => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return {
          text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
          visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          fontFamily: s.fontFamily,
          fontSize: parseFloat(s.fontSize),
          background: s.backgroundColor,
          borderTopWidth: parseFloat(s.borderTopWidth),
          borderTopStyle: s.borderTopStyle,
          borderTopColor: s.borderTopColor,
          borderRadius: parseFloat(s.borderTopLeftRadius),
        };
      });
      if (!flywheelSeal.visible) shellIssues.push(`flywheel/${colorScheme}: frame seal hidden`);
      if (!flywheelSeal.text.includes('FSL-1.1-MIT') || !flywheelSeal.text.includes('python scripts/run_harness_cli.py app --port 8799')) shellIssues.push(`flywheel/${colorScheme}: license or command text missing`);
      if (!/Hanken|system-ui|sans-serif/i.test(flywheelSeal.fontFamily)) shellIssues.push(`flywheel/${colorScheme}: ornate font ${flywheelSeal.fontFamily}`);
      if (flywheelSeal.fontSize < 13) shellIssues.push(`flywheel/${colorScheme}: small seal text ${flywheelSeal.fontSize}`);
      if (flywheelSeal.background !== 'rgba(0, 0, 0, 0)') shellIssues.push(`flywheel/${colorScheme}: decorative background ${flywheelSeal.background}`);
      if (!(flywheelSeal.borderTopWidth === 0 || flywheelSeal.borderTopStyle === 'none' || flywheelSeal.borderTopColor === 'rgba(0, 0, 0, 0)')) shellIssues.push(`flywheel/${colorScheme}: decorative border ${flywheelSeal.borderTopWidth}px ${flywheelSeal.borderTopStyle} ${flywheelSeal.borderTopColor}`);
      if (flywheelSeal.borderRadius !== 0) shellIssues.push(`flywheel/${colorScheme}: decorative radius ${flywheelSeal.borderRadius}`);
      for (const {route: briefingRoute, edition} of [
        {route: 'frontier-safety.html', edition: '2026-08-27'},
        {route: 'frontier-safety/archive/2026-08-27.html', edition: '2026-08-27'},
        {route: 'frontier-safety/archive/2026-08-25.html', edition: '2026-08-25'},
      ]) {
        await page.goto(`${base}/${briefingRoute}`);
        await page.evaluate(() => document.fonts.ready);
        const briefing = await page.evaluate(() => {
          const visible = e => {
            if (!e) return false;
            const s = getComputedStyle(e);
            const r = e.getBoundingClientRect();
            return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          };
          const editionReadout = document.querySelector('.edition-readout');
          const jsonLinks = Array.from(document.querySelectorAll('a[href$=".json"]'));
          return {
            plateVisible: visible(document.querySelector('.briefing-plate')),
            editionText: editionReadout ? editionReadout.textContent.replace(/\s+/g, ' ').trim() : '',
            editionVisible: visible(editionReadout),
            visibleJsonTexts: jsonLinks.filter(visible).map(a => a.textContent.replace(/\s+/g, ' ').trim()),
          };
        });
        if (briefing.plateVisible) shellIssues.push(`${briefingRoute}/${colorScheme}: decorative briefing plate visible`);
        if (!briefing.editionVisible || !briefing.editionText.includes(edition)) shellIssues.push(`${briefingRoute}/${colorScheme}: edition date inaccessible`);
        if (!briefing.visibleJsonTexts.some(text => /JSON edition|machine-readable edition/i.test(text))) shellIssues.push(`${briefingRoute}/${colorScheme}: JSON source link inaccessible`);
      }
      assert.deepEqual(shellIssues, [], `reading shell seal regressions: ${JSON.stringify(shellIssues)}`);
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
