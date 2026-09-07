const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/workspace.html');
    const result = await page.evaluate(async () => {
      const lib = await import('/system/project-library.js?v=20260907-gallery-projects');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const preview = canvas.toDataURL('image/png');
      // Library owns only the envelope. The native editor owns full recipe/image validation.
      const envelope = JSON.stringify({ schema: 'zentropy.gallery', version: 1 });
      const file = new File([envelope], 'gallery.json', { type: 'application/json' });
      let saved;
      try { saved = await lib.saveProject(file, { title: 'Gallery envelope', preview }); }
      catch (error) { return { error: error.message }; }
      const record = await lib.getProject(saved.id);
      const rejects = [];
      for (const text of [JSON.stringify({ schema: 'zentropy.gallery', version: 2 }), envelope + ' '.repeat(12 * 1024 * 1024)]) {
        try { await lib.saveProject(new File([text], 'bad.json'), { title: 'Bad', preview }); rejects.push(false); }
        catch (_) { rejects.push(true); }
      }
      await lib.deleteProject(saved.id);
      return { editor: saved.editor, text: await record.file.text(), rejects, remaining: (await lib.listProjects()).length };
    });
    assert.equal(result.error, undefined, 'The shared library accepts the Gallery native envelope');
    assert.equal(result.editor, 'Gallery');
    assert.deepEqual(JSON.parse(result.text), { schema: 'zentropy.gallery', version: 1 });
    assert.deepEqual(result.rejects, [true, true], 'Unsupported versions and over-limit files cannot be saved');
    assert.equal(result.remaining, 0, 'Rejected inputs do not leave library records');
    const navigation = page.waitForRequest(request=>request.isNavigationRequest() && request.url().includes('/gallery.html?project-transfer='));
    const routeError = await page.evaluate(async () => {
      const { openProjectInEditor } = await import('/system/project-router.js?v=20260907-gallery-projects');
      const file = new File([JSON.stringify({ schema: 'zentropy.gallery', version: 1 })], 'gallery.json');
      try { await openProjectInEditor(file); return null; } catch (error) { return error.message; }
    });
    assert.equal(routeError, null, 'Workspace routes Gallery envelopes to their native editor');
    const destination = new URL((await navigation).url());
    await page.waitForURL('**/gallery.html**');
    assert.equal([...destination.searchParams.keys()].join(','), 'project-transfer', 'Navigation carries only an opaque local ticket, never project pixels');
    await page.waitForFunction(()=>document.querySelector('[data-gallery-project-status]')?.dataset.state==='error');
    assert(!page.url().includes('project-transfer='),'Envelope routing consumes its ticket even when the native payload is rejected');
    console.log('Gallery library envelope: retained File, strict version/12 MiB cap and selected deletion passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
