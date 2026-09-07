const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {mkdir}=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/fonts.html');
    const original=page.locator('[data-font-product="editorial-regular"]');
    await original.waitFor({timeout:5000});
    assert.match(await original.innerText(),/preview/i);
    assert.equal(await page.locator('body').getAttribute('data-commerce-enabled'),'false');
    assert.equal(await original.getByRole('button',{name:/buy|purchase|checkout/i}).count(),0);
    const record=await(await page.request.get(base+'/type/preview/editorial.json')).json();
    const binary=await(await page.request.get(base+'/type/preview/'+record.file)).body();
    assert.equal(binary.length,record.bytes);
    assert.equal(createHash('sha256').update(binary).digest('hex'),record.sha256);
    assert.equal(record.status,'development-preview');assert.equal(record.saleEnabled,false);
    assert.equal(record.coverage.length,109);
    assert.equal(new Set(record.coverage).size,109);
    assert(!JSON.stringify(record).match(/C:[/\\]|\.scratch|masters[/\\]|source_sha256|\.ufo/i),'Public metadata contains no private source references');

    const family=page.locator('[data-font-specimen-family]');
    await original.locator('[data-font-try="editorial-preview"]').click();
    assert.equal(await family.inputValue(),'editorial-preview','Collection action opens the actual selected typeface in the lab');
    await page.locator('[data-font-specimen-text]').fill('Quiet forms. Clear ideas.');
    await page.waitForFunction(()=>[...document.fonts].some(face=>face.family.replaceAll('"','')==='Zentropy Editorial Preview'&&face.status==='loaded'));
    assert.match(await page.locator('[data-font-specimen-preview]').evaluate(el=>getComputedStyle(el).fontFamily),/Zentropy Editorial Preview/);
    const widths=await page.evaluate(()=>{
      const c=document.createElement('canvas'),x=c.getContext('2d');
      x.font='48px "Zentropy Editorial Preview"';const original=x.measureText('Quiet forms. Clear ideas.').width;
      x.font='48px serif';return {original,fallback:x.measureText('Quiet forms. Clear ideas.').width};
    });
    assert(Math.abs(widths.original-widths.fallback)>1,'Original file renders, not a fallback pretending to be inventory');
    assert(await page.locator('[data-font-specimen-poster]').isDisabled(),'Preview has no unsupported Poster handoff');
    assert(await page.locator('[data-font-specimen-css]').isDisabled(),'Preview is not offered as licensed export styling');
    await page.locator('[data-font-specimen-text]').fill('Café 中');
    const warning=page.locator('[data-font-coverage-warning]');await warning.waitFor({state:'visible'});
    assert.match(await warning.innerText(),/not|missing|unsupported|unavailable|outside/i);
    await page.locator('[data-font-specimen-text]').fill('Quiet forms. Clear ideas.');
    await mkdir('.superpowers/font-original-preview',{recursive:true});
    for(const theme of ['light','dark'])for(const width of [1280,320]){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme}/${width} has no horizontal overflow`);
      await page.screenshot({path:`.superpowers/font-original-preview/${theme}-${width}.png`,fullPage:true});
    }
    await family.selectOption('hanken');
    assert(await page.locator('[data-font-specimen-poster]').isEnabled(),'Existing site-face handoff remains available');
    assert(await page.locator('[data-font-specimen-css]').isEnabled());
    assert.deepEqual(errors,[]);

    // Failed font requests must surface a loading error instead of silently
    // presenting the system fallback as the original family.
    const broken=await browser.newContext();
    await broken.route('**/type/preview/*.woff2',route=>route.abort());
    const failed=await broken.newPage();await failed.goto(base+'/fonts.html');
    await failed.locator('[data-font-asset-status]').waitFor({state:'visible'});
    assert.match(await failed.locator('[data-font-asset-status]').innerText(),/could not|unavailable|failed|unable/i,'Original collection reports load failure before the sampler selection changes');
    await failed.locator('[data-font-specimen-family]').selectOption('editorial-preview');
    await failed.waitForFunction(()=>/could not|unavailable|failed|unable/i.test(document.querySelector('[data-font-coverage-warning]')?.textContent || ''));
    await broken.close();
    console.log('Original font collection: real limited WOFF2, integrity/coverage, no false retail/export, missing glyph/load notices, mobile and both themes passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
