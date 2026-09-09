const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {mkdir}=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const monoLatinProbe='Café São Paulo Ångström i\u030A ı Ÿ';
const monoMarks=[0x0300,0x0301,0x0302,0x0303,0x0308,0x030A,0x0327];

function monoLatinReady(record){
  const coverage=new Set(record.coverage);
  return record.coverage.length===171&&coverage.size===171&&
    [0x00E9,0x00C5,0x00E3,0x0131,0x0178,...monoMarks].every(code=>coverage.has(code));
}

(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
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
    assert.equal(await family.inputValue(),'editorial-preview','The foundry opens in its original face, not a third-party site font');
    await page.waitForFunction(()=>[...document.fonts].some(face=>face.family.replaceAll('"','')==='Zentropy Editorial Preview'&&face.status==='loaded'));
    assert.match(await page.locator('[data-font-specimen-preview]').evaluate(el=>getComputedStyle(el).fontFamily),/Zentropy Editorial Preview/);
    assert(await page.locator('[data-font-specimen-poster]').isDisabled(),'Initial original preview cannot be exported to Poster');
    assert(await page.locator('[data-font-specimen-css]').isDisabled(),'Initial original preview cannot export CSS');
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
    const mono=page.locator('[data-font-product="mono-regular"]');
    await mono.locator('[data-font-try="mono-preview"]').click();
    assert.equal(await family.inputValue(),'mono-preview');
    const monoRecord=await(await page.request.get(base+'/type/preview/mono.json')).json();
    const monoBinary=await(await page.request.get(base+'/type/preview/'+monoRecord.file)).body();
    assert.equal(createHash('sha256').update(monoBinary).digest('hex'),monoRecord.sha256);
    assert.equal(monoRecord.saleEnabled,false);
    assert(monoLatinReady(monoRecord),'Mono metadata must advertise the reviewed 171-codepoint Latin preview');
    await page.locator('[data-font-specimen-text]').fill('Illusion / Il1 / null\n0123456789 / 363969\nconst total = items.length;');
    await page.waitForFunction(()=>[...document.fonts].some(face=>face.family.replaceAll('"','')==='Zentropy Mono Preview'&&face.status==='loaded'));
    const monoMetrics=await page.locator('[data-font-specimen-preview]').evaluate(el=>{
      const ctx=document.createElement('canvas').getContext('2d');
      ctx.font='40px "Zentropy Mono Preview"';
      return {family:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight,
        widths:[...'Il1Wm0369'].map(char=>ctx.measureText(char).width)};
    });
    assert.match(monoMetrics.family,/Zentropy Mono Preview/);
    assert.equal(monoMetrics.weight,'400');
    assert(monoMetrics.widths.every(width=>Math.abs(width-24.8)<0.02),'All tested glyphs retain the 620-unit monospace advance');
    assert(await page.locator('[data-font-specimen-poster]').isDisabled());
    assert(await page.locator('[data-font-specimen-css]').isDisabled());
    await page.locator('[data-font-specimen-text]').fill(monoLatinProbe);
    await page.waitForFunction(()=>document.querySelector('[data-font-coverage-warning]')?.hidden);
    const latinRender=await page.evaluate(marks=>{
      const ctx=document.createElement('canvas').getContext('2d');
      ctx.font='40px "Zentropy Mono Preview"';
      const normal=['é','e\u0301','Å','A\u030A','ã','i\u030A','ı','Ÿ'].map(text=>ctx.measureText(text).width);
      const markWidths=marks.map(code=>ctx.measureText(String.fromCodePoint(code)).width);
      function alpha(text){
        const canvas=document.createElement('canvas');canvas.width=180;canvas.height=190;
        const local=canvas.getContext('2d');
        local.fillStyle='#000';local.font='150px "Zentropy Mono Preview"';local.textBaseline='alphabetic';
        local.fillText(text,30,160);
        return local.getImageData(0,0,canvas.width,canvas.height).data;
      }
      function alphaDiff(left,right){
        let total=0;
        for(let index=3;index<left.length;index+=4)total+=Math.abs(left[index]-right[index]);
        return total;
      }
      const dotted=alpha('i');
      const decomposedRing=alpha('i\u030A');
      const dotlessRing=alpha('ı\u030A');
      return {
        normal,markWidths,
        dotlessRingDiff:alphaDiff(decomposedRing,dotlessRing),
        dottedDiff:alphaDiff(decomposedRing,dotted),
      };
    },monoMarks);
    assert(latinRender.normal.every(width=>Math.abs(width-24.8)<0.02),'Composed and decomposed Latin stays on the 620-unit Mono advance');
    assert(latinRender.markWidths.every(width=>Math.abs(width)<0.02),'Combining marks do not add browser advance');
    assert(latinRender.dottedDiff>0,'Plain dotted i remains a positive control for the dotless substitution probe');
    assert.equal(latinRender.dotlessRingDiff,0,'i + ring renders exactly like dotless i + ring');
    await page.locator('[data-font-specimen-text]').fill('Café 中');
    assert.match(await warning.innerText(),/Unsupported/);
    await page.locator('[data-font-specimen-text]').fill('Illusion / Il1 / null\n0123456789 / 363969');
    for(const theme of ['light','dark'])for(const width of [1280,320]){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme}/${width} has no horizontal overflow`);
      await page.screenshot({path:`.superpowers/font-original-preview/${theme}-${width}.png`,fullPage:true});
    }
    await page.locator('[data-font-specimen-reset]').click();
    assert.equal(await family.inputValue(),'editorial-preview','Reset restores the original foundry specimen');
    assert(await page.locator('[data-font-specimen-poster]').isDisabled());
    assert(await page.locator('[data-font-specimen-css]').isDisabled());
    assert.match(await page.locator('#font-specimen-privacy').innerText(),/Poster transfer is not available yet/i);
    await family.selectOption('hanken');
    assert(await page.locator('[data-font-specimen-poster]').isDisabled(),'Existing site-face handoff is unavailable until a reviewed current-site path exists');
    assert.match(await page.locator('[data-font-specimen-poster]').getAttribute('title'),/Poster transfer is not available yet/i);
    assert(await page.locator('[data-font-specimen-css]').isEnabled());
    assert.deepEqual(errors,[]);

    // Failed font requests must surface a loading error instead of silently
    // presenting the system fallback as the original family.
    const broken=await browser.newContext();
    await broken.route('**/type/preview/zentropy-mono-regular.woff2*',route=>route.abort());
    const failed=await broken.newPage();await failed.goto(base+'/fonts.html');
    const failedMono=failed.locator('[data-font-asset-status="mono-preview"]');
    await failedMono.waitFor({state:'visible'});
    assert.match(await failedMono.innerText(),/could not|unavailable|failed|unable/i,'Mono reports its own failed asset');
    assert(await failed.locator('[data-font-asset-status="editorial-preview"]').isHidden(),'A failed mono does not mark the working serif as failed');
    await failed.locator('[data-font-specimen-family]').selectOption('mono-preview');
    await failed.waitForFunction(()=>/could not|unavailable|failed|unable/i.test(document.querySelector('[data-font-coverage-warning]')?.textContent || ''));
    await broken.close();
    console.log('Original font collection: real limited WOFF2, integrity/coverage, no false retail/export, missing glyph/load notices, mobile and both themes passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
