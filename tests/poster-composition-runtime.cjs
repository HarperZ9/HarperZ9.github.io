const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    mkdirSync('.superpowers/poster-composition', { recursive: true });

    await page.goto(`${base}/studio.html?source=poster`);
    await page.waitForFunction(() => window.__studioPoster);

    const repairs = await page.evaluate(async () => {
      const { mountPosterWorkshop } = await import('/system/poster-panel.js?v=20260907-gallery-projects');
      const host = document.createElement('div');
      const canvas = document.createElement('canvas');
      document.body.append(host, canvas);
      const editor = mountPosterWorkshop({ mount: host, canvas, layerNames: [],
        getDetail: () => ({ grid3: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ edge: 1, hex: '#111111', luma: .1 }))) }) });
      try {
        editor.state.blocks = [0, 1].map(() => ({ ...editor.state.blocks[1], text: 'Repeated supporting text' }));
        editor.render(); editor.critique(false);
        const actions = [...host.querySelectorAll('.poster-apply')];
        const names = actions.map(item => item.getAttribute('aria-label'));
        const findings = actions.map(item => item.parentElement.querySelector('.poster-ftext').textContent);
        const overlap = [...host.querySelectorAll('.poster-ftext')].find(item => item.textContent.includes(' overlap '))?.textContent;
        actions[1].click();
        return { names, findings, overlap, cells: editor.state.blocks.map(block => block.cell) };
      } finally { editor.destroy(); host.remove(); canvas.remove(); }
    });
    assert.deepEqual(repairs.names, ['Move Supporting text 1 to top-left', 'Move Supporting text 2 to top-left']);
    assert(repairs.findings[0].includes('Supporting text 1') && repairs.findings[1].includes('Supporting text 2'));
    assert(repairs.overlap?.includes('Supporting text 1 and the Supporting text 2 overlap'), 'Overlap findings identify both same-role blocks');
    assert.deepEqual(repairs.cells, ['bottom-left', 'top-left'], 'A repeated-role repair changes only its named block');

    const codec = await page.evaluate(async () => {
      const poster = await import('/system/poster.js?v=20260907-flex-composition');
      const project = await import('/system/poster-project.js?v=20260907-flex-composition');
      const options = { layers: [], effects: [] };
      const baseState = poster.defaultPosterState('flex-codec');
      const four = {
        ...baseState,
        blocks: [
          ...baseState.blocks,
          { ...baseState.blocks[1], kind: 'standfirst', text: 'Fourth ordered block', cell: 'top-right', position: { x: 0.2, y: 0.3 } },
        ],
      };
      const encoded = project.encodePosterProject(four, null, options);
      const decoded = project.decodePosterProject(encoded, options);
      const canvas = document.createElement('canvas');
      const rendered = poster.renderPoster(canvas, decoded.state).boxes.map(box => ({ index: box.index, kind: box.kind }));
      const oldThree = project.decodePosterProject(project.encodePosterProject(baseState, null, options), options);
      const make = (count) => ({ ...baseState, blocks: Array.from({ length: count }, (_, index) => ({
        ...baseState.blocks[index % baseState.blocks.length],
        text: 'Block ' + (index + 1),
      })) });
      const rejects = (state) => {
        try { project.encodePosterProject(state, null, options); return false; }
        catch (_) { return true; }
      };
      return {
        count: decoded.state.blocks.length,
        texts: decoded.state.blocks.map(block => block.text),
        position: decoded.state.blocks[3].position,
        rendered,
        oldCount: oldThree.state.blocks.length,
        minOk: project.decodePosterProject(project.encodePosterProject(make(1), null, options), options).state.blocks.length,
        maxOk: project.decodePosterProject(project.encodePosterProject(make(8), null, options), options).state.blocks.length,
        rejectsZero: rejects(make(0)),
        rejectsNine: rejects(make(9)),
        rejectsRole: rejects({ ...four, blocks: four.blocks.map((block, index) => index === 3 ? { ...block, kind: 'constructor' } : block) }),
      };
    });
    assert.equal(codec.count, 4, 'A valid fourth block survives native project encode/decode');
    assert.deepEqual(codec.texts.slice(2), ['', 'Fourth ordered block']);
    assert.deepEqual(codec.position, { x: 0.2, y: 0.3 });
    assert.deepEqual(codec.rendered.map(box => box.index), [0, 1, 2, 3], 'Rendered layout boxes keep block indexes');
    assert.equal(codec.oldCount, 3, 'Old three-block v1 projects remain readable');
    assert.equal(codec.minOk, 1, 'One text block is valid');
    assert.equal(codec.maxOk, 8, 'Eight text blocks are valid');
    assert.equal(codec.rejectsZero, true, 'Zero blocks are rejected');
    assert.equal(codec.rejectsNine, true, 'Nine blocks are rejected');
    assert.equal(codec.rejectsRole, true, 'Unknown roles are rejected');

    const blockCount = () => page.locator('[data-poster-block-index]').count();
    const blockTexts = () => page.locator('[data-poster-block-index] textarea').evaluateAll(nodes => nodes.map(node => node.value));
    assert.equal(await blockCount(), 3, 'Poster default still starts with three blocks');

    const undo = page.getByRole('button', { name: 'Undo the last poster text position change', exact: true });
    await page.locator('[data-poster-box="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Undo position')?.disabled);
    assert.equal(await undo.isDisabled(), false, 'Moving text creates placement history');

    await page.getByRole('button', { name: 'Add text block', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-poster-block-index]').length === 4);
    for (const selector of ['textarea', 'input[type="range"]', 'output', '.poster-cellpick']) {
      const labels = await page.locator(`[data-poster-block-index] ${selector}`).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      assert(labels.every(Boolean), `${selector} controls have accessible names`);
      assert.equal(new Set(labels).size, labels.length, `${selector} names identify repeated blocks independently`);
    }
    assert.equal(await undo.isDisabled(), true, 'Structural edits clear index-based placement history');
    let block = page.locator('[data-poster-block-index="3"]');
    assert.equal(await block.locator('textarea').evaluate(node => document.activeElement === node), true, 'Added block receives focus');
    await block.locator('textarea').fill('Fourth editable block');
    await block.getByLabel('Block 4 role', { exact: true }).selectOption('folio');
    await page.waitForFunction(() => document.querySelector('[data-poster-block-index="3"] summary')?.textContent.includes('Caption'));

    await block.getByRole('button', { name: 'Duplicate block 4', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-poster-block-index]').length === 5);
    block = page.locator('[data-poster-block-index="4"]');
    assert.equal(await block.locator('textarea').inputValue(), 'Fourth editable block', 'Duplicate starts from the selected block');
    assert.equal(await block.locator('textarea').evaluate(node => document.activeElement === node), true, 'Duplicated block receives focus');
    await block.locator('textarea').fill('Duplicate changed');
    assert.equal((await blockTexts())[3], 'Fourth editable block', 'Duplicate text edits do not mutate the source block');

    await block.getByRole('button', { name: 'Move block 5 earlier', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-poster-block-index="3"] textarea')?.value === 'Duplicate changed');
    assert.deepEqual((await blockTexts()).slice(3), ['Duplicate changed', 'Fourth editable block'], 'Move earlier preserves block identity and order');
    await page.locator('[data-poster-block-index="3"]').getByRole('button', { name: 'Move block 4 later', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-poster-block-index="4"] textarea')?.value === 'Duplicate changed');
    assert.deepEqual((await blockTexts()).slice(3), ['Fourth editable block', 'Duplicate changed'], 'Move later restores the edited duplicate order');

    await page.locator('[data-poster-block-index="4"]').getByRole('button', { name: 'Remove block 5', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-poster-block-index]').length === 4);
    assert.equal(await page.locator('[data-poster-block-index="3"] textarea').evaluate(node => document.activeElement === node), true, 'Removing a block keeps focus on the nearest surviving block');
    assert.deepEqual((await blockTexts()).slice(3), ['Fourth editable block']);

    while (await blockCount() < 8) {
      await page.getByRole('button', { name: 'Add text block', exact: true }).click();
    }
    assert.equal(await page.getByRole('button', { name: 'Add text block', exact: true }).isDisabled(), true, 'Add is disabled at eight blocks');
    assert.equal(await page.locator('[data-poster-block-index="7"]').getByRole('button', { name: 'Duplicate block 8', exact: true }).isDisabled(), true, 'Duplicate is disabled at eight blocks');
    while (await blockCount() > 4) {
      const count = await blockCount();
      await page.locator(`[data-poster-block-index="${count - 1}"]`).evaluate(node => { node.open = true; });
      await page.locator(`[data-poster-block-index="${count - 1}"]`).getByRole('button', { name: `Remove block ${count}`, exact: true }).click();
    }

    const uploadPng = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#c9653b';
      ctx.fillRect(0, 0, 4, 4);
      return canvas.toDataURL('image/png');
    });
    await page.locator('input.poster-imgfile').setInputFiles({
      name: 'art.png',
      mimeType: 'image/png',
      buffer: Buffer.from(uploadPng.split(',')[1], 'base64'),
    });
    await page.getByRole('button', { name: 'Remove image', exact: true }).waitFor();
    await page.locator('[data-poster-box="3"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const before = await page.locator('#studio-canvas').evaluate(canvas => canvas.toDataURL());
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    const bytes = await readFile(await (await waiting).path());
    const record = JSON.parse(bytes.toString('utf8'));
    assert.equal(record.state.blocks.length, 4);
    assert.deepEqual(record.state.blocks.map(item => item.text).slice(3), ['Fourth editable block']);
    assert.equal(record.state.blocks[3].kind, 'folio');
    assert(record.state.blocks[3].position, 'Native save preserves free placement on added blocks');
    assert.match(record.image, /^data:image\/png;base64,/);
    await page.screenshot({ path: '.superpowers/poster-composition/four-block-light.png' });

    await page.reload();
    await page.waitForFunction(() => window.__studioPoster);
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'four-block.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'ready');
    assert.equal(await blockCount(), 4);
    assert.deepEqual((await blockTexts()).slice(3), ['Fourth editable block']);
    assert.equal(await page.locator('[data-poster-block-index="3"]').getByLabel('Block 4 role', { exact: true }).inputValue(), 'folio');
    assert.equal(await page.locator('#studio-canvas').evaluate(canvas => canvas.toDataURL()), before, 'Native roundtrip preserves pixels for ordered flexible blocks');

    await page.evaluate(() => {
      delete window.__resumeFlexiblePosterDecode;
      const original = Image.prototype.decode;
      Image.prototype.decode = function () {
        Image.prototype.decode = original;
        return new Promise((resolve, reject) => {
          window.__resumeFlexiblePosterDecode = () => original.call(this).then(resolve, reject);
        });
      };
    });
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'slow-four-block.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(() => typeof window.__resumeFlexiblePosterDecode === 'function');
    await page.locator('[data-poster-block-index="3"]').evaluate(node => { node.open = true; });
    await page.locator('[data-poster-block-index="3"] textarea').fill('Newer edit survives slow open');
    await page.evaluate(() => window.__resumeFlexiblePosterDecode());
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'cancelled');
    assert.equal(await page.locator('[data-poster-block-index="3"] textarea').inputValue(), 'Newer edit survives slow open');

    const oldThreeBytes = Buffer.from(JSON.stringify({ ...record, state: { ...record.state, blocks: record.state.blocks.slice(0, 3) } }));
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'old-three.json', mimeType: 'application/json', buffer: oldThreeBytes });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'ready');
    assert.equal(await blockCount(), 3, 'Old three-block project files still open');
    while (await blockCount() > 1) {
      const count = await blockCount();
      await page.locator(`[data-poster-block-index="${count - 1}"]`).evaluate(node => { node.open = true; });
      await page.locator(`[data-poster-block-index="${count - 1}"]`).getByRole('button', { name: `Remove block ${count}`, exact: true }).click();
    }
    assert.equal(await page.locator('[data-poster-block-index="0"]').getByRole('button', { name: 'Remove block 1', exact: true }).isDisabled(), true, 'Remove is disabled at one block');

    await page.setViewportSize({ width: 320, height: 780 });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.locator('#src-poster').scrollIntoViewIfNeeded();
    const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(widths.document <= widths.viewport + 1, 'Flexible block controls reflow without horizontal overflow');
    const projectControls = await page.locator('[data-project-library-save]').evaluate(node => [...node.parentElement.querySelectorAll('button,a')].map(item => ({ width: item.getBoundingClientRect().width, wordBreak: getComputedStyle(item).wordBreak, overflowWrap: getComputedStyle(item).overflowWrap })));
    assert(projectControls.every(item => item.width >= 110 && item.wordBreak === 'normal' && item.overflowWrap === 'normal'), 'Project actions have room for unbroken words');
    assert.deepEqual(await page.locator('.poster-block-tools button').allTextContents(), ['Move up', 'Move down', 'Duplicate', 'Remove']);
    await page.screenshot({ path: '.superpowers/poster-composition/flexible-mobile-dark.png' });

    assert.deepEqual(errors, []);
    console.log('Poster flexible composition: codec bounds, editable block operations, history reset, native roundtrip, stale open, old v1 files and mobile reflow passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
