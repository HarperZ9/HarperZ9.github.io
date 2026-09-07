const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const source of [
      { path: 'gallery.html?seed=handoff&layers=flow', button: '#desk-workshop', canvas: '#desk-canvas', family: 'gallery' },
      { path: 'retro.html', button: '#re-send-poster', canvas: '#re-out', ready: '#re-code', family: 'retro' },
      { path: 'loom.html', button: '#wv-send-poster', canvas: '#wv-out', ready: '#wv-status', family: 'loom' },
    ]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.addInitScript(() => { window.__handoffInputAtNavigation = sessionStorage.getItem('re.poster.handoff'); });
      await page.goto(`${base}/${source.path}`);
      if (source.family === 'retro') {
        await page.waitForFunction(() => document.querySelector('#re-code').value.length > 0);
        await page.locator('#re-animate').uncheck();
      } else if (source.family === 'gallery') {
        await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
        const image = await page.evaluate(() => {
          const c=document.createElement('canvas');c.width=128;c.height=80;
          const g=c.getContext('2d');g.fillStyle='#e87020';g.fillRect(0,0,128,80);g.fillStyle='#172a64';g.fillRect(20,15,70,45);
          return c.toDataURL('image/png');
        });
        await page.locator('#desk-import-file').setInputFiles({name:'local-art.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
        await page.waitForFunction(() => document.querySelector('#desk-title').textContent.includes('local-art.png'));
      } else {
        await page.waitForFunction(() => document.querySelector('#wv-out').width > 100 && document.querySelector('#wv-status').textContent.length > 0);
      }
      const drawnImage = source.family === 'gallery' ? await page.locator(source.canvas).evaluate(c => c.toDataURL('image/png')) : null;
      await page.locator(source.button).click();
      await page.waitForURL('**/studio.html?source=poster&import=workbench');
      await page.waitForFunction(() => document.querySelector('#poster-mount')?.dataset.importStatus === 'ready', null, { timeout: 30000 });
      const received = await page.evaluate(() => ({
        source: window.__studioPoster?.imageDataUrl,
        incoming: window.__handoffInputAtNavigation,
        imageKey: sessionStorage.getItem('re.poster.handoff'),
        trailKey: sessionStorage.getItem('wb.piece.v1'),
        width: document.querySelector('#studio-canvas').width,
      }));
      assert(received.incoming?.startsWith('data:image/png;base64,'), 'Sender carries an actual PNG');
      const hash = text => createHash('sha256').update(text || '').digest('hex');
      assert.equal(hash(received.source), hash(received.incoming), `${source.family} image arrives byte-for-byte`);
      if (drawnImage) assert.equal(hash(received.source), hash(drawnImage), 'Gallery transfers the composited local image, not a regenerated seed');
      assert.equal(received.imageKey, null, 'Image handoff is consumed once');
      assert.equal(received.trailKey, null, 'Trail is consumed once');
      assert(received.width > 100, 'Poster renders the received artwork');
      assert(await page.getByRole('button', { name: 'Remove image', exact: true }).isVisible());
      await context.close();
      console.log(`${source.family} → editable Poster artwork passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
