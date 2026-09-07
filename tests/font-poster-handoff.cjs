const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/fonts.html#font-lab`);
    await page.waitForSelector('[data-font-specimen-controls]:not([hidden])');
    assert.equal(await page.getByRole('button', { name: 'Use in Poster', exact: true }).count(), 1, 'The specimen needs an explicit editable transfer action');
    const text = 'Keep <em>these</em> words\n& their spacing';
    await page.locator('#font-specimen-text').fill(text);
    await page.locator('#font-specimen-family').selectOption('conso');
    for (const [id, value] of [['size', '48'], ['line', '1.45'], ['track', '-0.03']]) {
      await page.locator(`#font-specimen-${id}`).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    }
    assert.equal(await page.evaluate(() => sessionStorage.getItem('wb.typography.v1')), null, 'Typing alone must not store the specimen');
    assert.equal(await page.getByRole('button', { name: 'Export CSS', exact: true }).count(), 1);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSS', exact: true }).click();
    const cssDownload = await downloadEvent;
    assert.equal(cssDownload.suggestedFilename(), 'zentropy-typography.css');
    const parts = [];
    for await (const part of await cssDownload.createReadStream()) parts.push(part);
    const css = Buffer.concat(parts).toString('utf8');
    for (const declaration of ['font-family: "Conso", serif;', 'font-size: 48px;', 'line-height: 1.45;', 'letter-spacing: -0.03em;']) assert(css.includes(declaration));
    assert(!css.includes(text) && !css.includes('@font-face') && !css.includes('url('), 'Export carries styles only, not private text or font files');
    await page.getByRole('button', { name: 'Use in Poster', exact: true }).click();
    await page.waitForURL('**/studio.html?source=poster&import=typography');
    await page.waitForFunction(() => document.querySelector('#poster-mount')?.dataset.typographyStatus === 'ready');
    assert(!page.url().includes('Keep'), 'Private text stays out of the URL');
    const block = page.locator('[data-poster-block-index="0"]');
    assert.equal(await block.locator('textarea').inputValue(), text);
    assert.equal(await block.getByRole('button', { name: 'Conso', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(Number(await block.getByLabel('headline tracking', { exact: true }).inputValue()), -0.03);
    assert.equal(Number(await block.getByLabel('headline line spacing', { exact: true }).inputValue()), 1.45);
    assert.equal(Number(await block.getByLabel('headline size', { exact: true }).inputValue()), 0.075);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('wb.typography.v1')), null, 'Receive consumes the handoff');
    assert.equal(await block.locator('em').count(), 0, 'The specimen remains text, never HTML');
    mkdirSync('.superpowers/font-type-transfer', { recursive: true });
    await page.screenshot({ path: '.superpowers/font-type-transfer/poster.png' });
    await block.locator('textarea').fill('Still editable');
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#poster-mount')?.dataset.typographyStatus === 'failed');
    assert.equal(await page.locator('#poster-mount [role="alert"]').count(), 1, 'An expired transfer must show its error next to the editor');
    assert.notEqual(await page.locator('[data-poster-block-index="0"] textarea').inputValue(), text, 'Reload must not replay consumed type');
    const boundaries = await page.evaluate(async () => {
      const wb = await import('/system/workbench.js?v=20260907-typography-handoff');
      const style = { text: 'A safe specimen', family: 'hanken', size: 40, line: 1.25, track: 0 };
      const invalidStyles = [
        { ...style, family: 'constructor' }, { ...style, text: 'x'.repeat(261) },
        { ...style, size: Infinity }, { ...style, size: '40' }, { ...style, track: -1 },
        { ...style, line: 0 }, { ...style, text: '' },
      ];
      const rejected = invalidStyles.every(s => !wb.sendTypography(s, false));
      const malformed = [
        '{', JSON.stringify({ version: 2, to: 'poster', at: Date.now(), style }),
        JSON.stringify({ version: 1, to: 'loom', at: Date.now(), style }),
        JSON.stringify({ version: 1, to: 'poster', at: Date.now() - 360000, style }),
        JSON.stringify({ version: 1, to: 'poster', at: Date.now() + 360000, style }),
        JSON.stringify({ version: 1, to: 'poster', at: Date.now(), style: { ...style, family: 'unknown' } }),
      ];
      const refused = malformed.every(raw => {
        sessionStorage.setItem('wb.typography.v1', raw);
        return wb.receiveTypography() === null && sessionStorage.getItem('wb.typography.v1') === null;
      });
      const original = Storage.prototype.setItem;
      let blocked;
      try {
        Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
        blocked = wb.sendTypography(style, false) === false;
      } finally { Storage.prototype.setItem = original; }
      return { rejected, refused, blocked };
    });
    assert.deepEqual(boundaries, { rejected: true, refused: true, blocked: true });
    const longLayout = await page.evaluate(async () => {
      const poster = await import('/system/poster.js?v=20260907-typography-handoff');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const draw = ctx.fillText.bind(ctx);
      let top = Infinity, bottom = 0;
      ctx.fillText = (text, x, y) => {
        const size = Number(ctx.font.match(/([\d.]+)px/)[1]);
        top = Math.min(top, y); bottom = Math.max(bottom, y + size);
        draw(text, x, y);
      };
      const state = poster.defaultPosterState('long-type');
      state.art = { layers: [], veil: 0 };
      state.blocks = [{ ...state.blocks[0], text: 'A full length specimen needs room to breathe. '.repeat(6).slice(0, 260), size: 88 / 640, leading: 1.8 }];
      poster.renderPoster(canvas, state);
      return { top, bottom, height: canvas.height, margin: state.margin };
    });
    assert(longLayout.top >= longLayout.height * longLayout.margin - 1, 'Long type must fit above the top margin');
    assert(longLayout.bottom <= longLayout.height * (1 - longLayout.margin) + 1, 'Long type must fit above the bottom margin');
    console.log('Font Lab → editable Poster: text, family, size, negative spacing, line spacing, privacy and one-shot transfer passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
