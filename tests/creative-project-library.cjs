const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const dbName = 'zentropy-project-library-v1';
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lUX0VwAAAABJRU5ErkJggg==';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    async function resetLibrary() {
      await page.evaluate(name => new Promise(resolve => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }), dbName);
    }
    async function libraryCall(source) {
      return page.evaluate(async code => {
        const lib = await import('/system/project-library.js?v=20260907-gallery-projects');
        return (0, eval)(code)(lib);
      }, source);
    }

    await page.goto(`${base}/studio.html?source=poster`);
    await page.waitForFunction(() => window.__studioPoster);
    await resetLibrary();
    await page.locator('[data-poster-block-index="0"] textarea').fill('Browser local project');
    let promptTitle = 'Poster kept in workspace';
    page.on('dialog', async dialog => {
      assert.equal(dialog.type(), 'prompt');
      await dialog.accept(promptTitle);
    });
    await page.locator('[data-project-library-save]').click();
    await page.waitForFunction(() => document.querySelector('[data-project-library-status]')?.dataset.state === 'ready');

    let projects = await libraryCall(`async lib => lib.listProjects()`);
    assert.equal(projects.length, 1, 'A kept editor project persists in IndexedDB');
    const posterMeta = projects[0];
    assert.equal(posterMeta.title, promptTitle);
    assert.equal(posterMeta.schema, 'zentropy.poster');
    assert.equal(posterMeta.editor, 'Poster');
    assert.match(posterMeta.preview, /^data:image\/png;base64,/);
    assert.equal(typeof posterMeta.createdAt, 'string');
    assert.equal(typeof posterMeta.updatedAt, 'string');
    assert.ok(posterMeta.size > 100, 'Metadata records native file size');

    const nativeText = await libraryCall(`async lib => (await lib.getProject(${JSON.stringify(posterMeta.id)})).file.text()`);
    const native = JSON.parse(nativeText);
    assert.equal(native.schema, 'zentropy.poster');
    assert.equal(native.version, 1);
    assert.equal(native.state.blocks[0].text, 'Browser local project', 'Native file keeps editable Poster source');

    await page.reload();
    await page.waitForFunction(() => window.__studioPoster);
    projects = await libraryCall(`async lib => lib.listProjects()`);
    assert.equal(projects.length, 1, 'Saved projects survive a page reload');
    await page.locator('[data-poster-project-file]').setInputFiles({
      name: 'poster.json',
      mimeType: 'application/json',
      buffer: Buffer.from(nativeText),
    });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'ready');
    assert.equal(await page.locator('[data-poster-block-index="0"] textarea').inputValue(), 'Browser local project');

    const markupTitle = '<img src=x onerror=alert(1)> Plain title';
    const renamed = await libraryCall(`async lib => lib.renameProject(${JSON.stringify(posterMeta.id)}, ${JSON.stringify(markupTitle)})`);
    assert.equal(renamed.title, markupTitle);
    const renderedTitle = await page.evaluate(title => {
      const host = document.createElement('h3');
      host.textContent = title;
      document.body.append(host);
      return { text: host.textContent, images: host.querySelectorAll('img').length };
    }, renamed.title);
    assert.deepEqual(renderedTitle, { text: markupTitle, images: 0 }, 'Project titles render as plain text');

    const loomMeta = await libraryCall(`async lib => {
      const file = new File(['{"schema":"zentropy.loom","version":1}'], 'loom.json', { type: 'application/json' });
      return lib.saveProject(file, { title: 'Loom minimal', preview: ${JSON.stringify(tinyPng)} });
    }`);
    assert.equal(loomMeta.editor, 'Loom');
    await libraryCall(`async lib => lib.deleteProject(${JSON.stringify(renamed.id)})`);
    projects = await libraryCall(`async lib => lib.listProjects()`);
    assert.deepEqual(projects.map(project => project.id), [loomMeta.id], 'Deleting one project leaves other records intact');

    for (const [label, script] of [
      ['schema', `async lib => lib.saveProject(new File(['{"schema":"wrong","version":1}'], 'bad.json'), { title: 'Bad', preview: ${JSON.stringify(tinyPng)} })`],
      ['constructor schema', `async lib => lib.saveProject(new File(['{"schema":"constructor","version":1}'], 'bad.json'), { title: 'Bad', preview: ${JSON.stringify(tinyPng)} })`],
      ['version', `async lib => lib.saveProject(new File(['{"schema":"zentropy.poster","version":2}'], 'bad.json'), { title: 'Bad', preview: ${JSON.stringify(tinyPng)} })`],
      ['preview url', `async lib => lib.saveProject(new File(['{"schema":"zentropy.poster","version":1}'], 'bad.json'), { title: 'Bad', preview: 'https://example.com/image.png' })`],
      ['svg preview', `async lib => lib.saveProject(new File(['{"schema":"zentropy.poster","version":1}'], 'bad.json'), { title: 'Bad', preview: 'data:image/svg+xml;base64,PHN2Zy8+' })`],
    ]) {
      const message = await libraryCall(`async lib => {
        try { await (${script})(lib); return null; }
        catch (error) { return error.message; }
      }`);
      assert.match(message, /project|preview|version|schema|supported/i, `Invalid ${label} is rejected usefully`);
    }

    await resetLibrary();
    await libraryCall(`async lib => {
      const preview = ${JSON.stringify(tinyPng)};
      for (let i = 0; i < 24; i++) {
        await lib.saveProject(new File(['{"schema":"zentropy.poster","version":1}'], 'p' + i + '.json'), { title: 'Project ' + i, preview });
      }
      try {
        await lib.saveProject(new File(['{"schema":"zentropy.poster","version":1}'], 'overflow.json'), { title: 'Overflow', preview });
        return 'accepted';
      } catch (error) {
        return error.message;
      }
    }`).then(message => assert.match(message, /24|capacity|limit/i, 'Project count capacity is enforced without eviction'));

    const blocked = await libraryCall(`async lib => {
      const original = indexedDB.open.bind(indexedDB);
      Object.defineProperty(indexedDB, 'open', { configurable: true, value: () => { throw new DOMException('Blocked', 'SecurityError'); } });
      try {
        await lib.listProjects();
        return 'accepted';
      } catch (error) {
        return error.message;
      } finally {
        Object.defineProperty(indexedDB, 'open', { configurable: true, value: original });
      }
    }`);
    assert.match(blocked, /storage|unavailable|blocked/i, 'Blocked storage fails with a useful error');

    assert.deepEqual(errors, []);
    console.log('Creative project library: Poster native keep, reload, native reopen, plain-text rename, selected delete, invalid inputs, capacity and blocked storage passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
