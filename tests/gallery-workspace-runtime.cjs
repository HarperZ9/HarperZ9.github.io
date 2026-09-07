const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';

function assertNativeEqual(actual, expected, message){
  assert(actual.project.baseImage.png===expected.project.baseImage.png,message+': embedded source PNG');
  const metadata=value=>({...value,project:{...value.project,baseImage:{...value.project.baseImage,png:'<embedded-png>'}}});
  assert.deepEqual(metadata(actual),metadata(expected),message);
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[], transferUrls=[];
    page.on('pageerror',e=>errors.push(e.message));
    // Capture the navigation request before history.replaceState consumes the
    // ticket. Production routing must not wait for test observers.
    page.on('request',request=>{
      if(request.isNavigationRequest() && request.frame()===page.mainFrame() && request.url().includes('project-transfer=')) transferUrls.push(request.url());
    });
    page.on('dialog',d=>d.accept(d.type()==='prompt'?'Material that travels':undefined));
    await page.goto(base+'/gallery.html#printdesk');
    await page.getByRole('button',{name:'Save project',exact:true}).waitFor({timeout:5000});
    await page.waitForFunction(()=>document.querySelector('#desk-canvas')?.dataset.specimenRendered==='true');
    const png=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=320;c.height=240;
      const x=c.getContext('2d');
      const g=x.createLinearGradient(0,0,320,240);g.addColorStop(0,'#18345b');g.addColorStop(1,'#e6af61');
      x.fillStyle=g;x.fillRect(0,0,320,240);x.fillStyle='#f5efe0';x.fillRect(45,55,95,110);
      x.fillStyle='#ad573d';x.beginPath();x.arc(225,150,48,0,Math.PI*2);x.fill();
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#desk-import-file').setInputFiles({name:'local-material.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await page.waitForFunction(()=>document.querySelector('#desk-status')?.textContent.includes('your image is loaded'));
    await page.locator('#desk-seed').fill('gallery-workspace-fixture');
    await page.locator('#desk-seed').press('Enter');
    await page.locator('#desk-influence').evaluate(el=>{el.value='0.35';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const pixels=()=>page.locator('#desk-canvas').evaluate(c=>c.toDataURL('image/png'));
    const save=async()=>{
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'Save project',exact:true}).click();
      return readFile(await(await download).path());
    };
    const expectedBytes=await save(), expected=JSON.parse(expectedBytes), expectedPixels=await pixels();
    assert.equal(expected.schema,'zentropy.gallery');
    assert.equal(expected.project.recipe.seed,'gallery-workspace-fixture');
    assert.equal(expected.project.baseImage.name,'local-material.png');
    assert.equal(expected.project.baseImage.influence,0.35);
    assert(expected.project.baseImage.png.startsWith('data:image/png;base64,'),'Native file retains the editable source image');
    assert.notEqual(expected.project.baseImage.png,expectedPixels,'Source material is not replaced by the flattened composition');
    await page.locator('[data-project-library-save]').click();
    await page.waitForFunction(()=>document.querySelector('[data-project-library-status]')?.dataset.state==='ready');
    await page.goto(base+'/workspace.html');
    const card=page.locator('[data-workspace-card]');await card.waitFor();
    assert.equal(await card.count(),1);
    assert.equal(await card.locator('h3').innerText(),'Material that travels');
    assert(await card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
    await card.locator('.workspace-open').click();
    await page.waitForURL('**/gallery.html**');
    await page.waitForFunction(()=>document.querySelector('[data-gallery-project-status]')?.dataset.state==='ready');
    assert(!page.url().includes('project-transfer='),'Consumed transfer ticket is removed');
    assertNativeEqual(JSON.parse(await save()),expected,'Workspace reopens the complete editable Gallery project');
    assert(await pixels()===expectedPixels,'Workspace reopens the exact rendered composition at the same viewport');

    // An actual native Gallery file chosen inside another editor must route,
    // not be flattened or silently imported as the wrong native schema.
    await page.goto(base+'/loom.html');
    await page.waitForFunction(()=>document.querySelector('#wv-readout')?.textContent.includes('ends x'));
    await page.locator('#wv-project-file').setInputFiles({name:'gallery.json',mimeType:'application/json',buffer:expectedBytes});
    await page.waitForURL('**/gallery.html**');
    await page.waitForFunction(()=>document.querySelector('[data-gallery-project-status]')?.dataset.state==='ready');
    assertNativeEqual(JSON.parse(await save()),expected,'Cross-editor open retains native state');
    assert(await pixels()===expectedPixels,'Cross-editor open retains the rendered composition');
    assert.equal(transferUrls.length,2,'Both workspace and native routing were exercised');
    for(const url of transferUrls){
      const parsed=new URL(url);
      assert.deepEqual([...parsed.searchParams.keys()],['project-transfer']);
      assert(!url.includes('data:')&&!url.includes('gallery-workspace-fixture'),'URL carries no project content');
    }
    assert.deepEqual(errors,[]);
    console.log('Gallery actual image/recipe: native save, workspace reopen, cross-editor routing, exact pixels and private opaque transfers passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
