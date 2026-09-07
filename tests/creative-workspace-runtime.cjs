const assert = require('node:assert/strict');
const {readFile,mkdir} = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
function contrast(a,b){
  const light=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).reduce((sum,n,i)=>{
    const c=n/255;return sum+[.2126,.7152,.0722][i]*(c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  },0);
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/workspace.html');
    assert.equal(response.status(),200,'A real creative workspace is served');
    await page.locator('[data-workspace-empty]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-workspace-card]').count(),0,'No fake saved projects');
    assert.equal(await page.locator('.workspace-starts a').count(),6);
    assert.equal(await page.locator('.route-header__path,.export-bar').count(),0,'Workspace has no redundant document chrome');
    for(const mode of ['light','dark']){
      await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);
      await page.setViewportSize({width:320,height:740});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      const target=await page.locator('[data-workspace-open-file]').boundingBox();
      assert(target.height>=44,'Open project has a touch-sized target');
    }
    assert.deepEqual(errors,[]);
    await page.setViewportSize({width:1280,height:900});
    await page.goto(base+'/studio.html?source=poster');
    await page.waitForFunction(()=>window.__studioPoster);
    await page.locator('[data-poster-block-index="0"] textarea').fill('A thought worth keeping');
    let title='Quiet composition';
    page.on('dialog',async dialog=>dialog.accept(dialog.type()==='prompt'?title:undefined));
    await page.locator('[data-project-library-save]').click();
    await page.waitForFunction(()=>document.querySelector('[data-project-library-status]')?.dataset.state==='ready');
    const beforeDownload=page.waitForEvent('download');
    await page.locator('#poster-mount button:has-text("Save project")').click();
    const native=JSON.parse(await readFile(await (await beforeDownload).path(),'utf8'));
    await page.goto(base+'/workspace.html');
    const card=page.locator('[data-workspace-card]');await card.waitFor();
    assert.equal(await card.locator('h3').innerText(),title);
    assert(await card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),'Actual project preview is displayed');
    await mkdir('.superpowers/creative-workspace-qa',{recursive:true});
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>{localStorage.setItem('site-theme',theme);},theme);
      await page.reload();await card.waitFor();
      const colors=await page.locator('.workspace-intro p').evaluate(el=>({ink:getComputedStyle(el).color,paper:getComputedStyle(document.body).backgroundColor}));
      assert(contrast(colors.ink,colors.paper)>=4.5,`${theme} supporting text meets AA contrast`);
      await page.screenshot({path:`.superpowers/creative-workspace-qa/${theme}-desktop.png`,fullPage:true});
      await page.setViewportSize({width:320,height:740});
      await page.screenshot({path:`.superpowers/creative-workspace-qa/${theme}-mobile.png`,fullPage:true});
      const bounds=await page.locator('.workspace-card button,.workspace-starts a').evaluateAll(items=>items.map(x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right})));
      assert(bounds.every(x=>x.left>=0&&x.right<=320),'Interactive content remains inside mobile viewport');
      await page.setViewportSize({width:1280,height:900});
    }
    title='<img src=x onerror=alert(1)> My piece';
    await card.getByRole('button',{name:'Rename',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-workspace-card] h3')?.textContent.includes('<img'));
    assert.equal(await card.locator('h3 img').count(),0,'Project names stay plain text');
    await page.reload();await card.waitFor();
    assert.equal(await card.locator('h3').innerText(),title,'Name persists across reload');
    await card.locator('.workspace-open').click();
    await page.waitForURL('**/studio.html?source=poster**');
    await page.waitForFunction(()=>document.querySelector('[data-poster-project-status]')?.dataset.state==='ready');
    assert.equal(await page.locator('[data-poster-block-index="0"] textarea').inputValue(),'A thought worth keeping');
    const afterDownload=page.waitForEvent('download');
    await page.locator('#poster-mount button:has-text("Save project")').click();
    assert.deepEqual(JSON.parse(await readFile(await (await afterDownload).path(),'utf8')),native,'Library reopening preserves complete native project');
    await page.goto(base+'/workspace.html');await card.waitFor();
    await card.getByRole('button',{name:'Remove',exact:true}).click();
    await page.locator('[data-workspace-empty]').waitFor({state:'visible'});
    assert.equal(await card.count(),0,'Removal restores the honest empty state');
    for(const editor of [
      {name:'Loom',path:'loom.html',save:'#wv-project-save',status:'#wv-project-status'},
      {name:'Shader Room',path:'retro.html',save:'#re-project-save',status:'#re-project-status'},
    ]){
      await page.goto(base+'/'+editor.path);
      if(editor.name==='Loom'){
        await page.waitForFunction(()=>document.querySelector('#wv-readout').textContent.includes('ends x'));
        await page.locator('#wv-rack-weave').evaluate(el=>el.open=true);
        await page.locator('#wv-weaveit').uncheck();
      }else{
        await page.waitForFunction(()=>document.querySelector('#re-measure').textContent.includes('cells'));
        await page.locator('#re-animate').uncheck();
      }
      const readNative=async()=>{
        const next=page.waitForEvent('download');await page.locator(editor.save).click();
        return JSON.parse(await readFile(await(await next).path(),'utf8'));
      };
      const expected=await readNative();title=editor.name+' study';
      await page.locator('[data-project-library-save]').click();
      await page.waitForFunction(()=>document.querySelector('[data-project-library-status]')?.dataset.state==='ready');
      await page.goto(base+'/workspace.html');await card.waitFor();
      assert.equal(await card.locator('h3').innerText(),title);
      await card.locator('.workspace-open').click();
      await page.waitForURL('**/'+editor.path+'**');
      await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.state==='ready',editor.status);
      assert.deepEqual(await readNative(),expected,`${editor.name} library reopen preserves native state`);
      await page.goto(base+'/workspace.html');await card.waitFor();
      await card.getByRole('button',{name:'Remove',exact:true}).click();
      await page.locator('[data-workspace-empty]').waitFor({state:'visible'});
    }
    assert.deepEqual(errors,[]);
    const nojs=await browser.newContext({javaScriptEnabled:false});
    const staticPage=await nojs.newPage(); await staticPage.goto(base+'/workspace.html');
    assert(await staticPage.locator('noscript').innerText().then(t=>t.includes('JavaScript')));
    assert.equal(await staticPage.locator('.workspace-starts a').count(),6);
    const staticColors=await staticPage.locator('.workspace-intro p').evaluate(el=>({ink:getComputedStyle(el).color,paper:getComputedStyle(document.body).backgroundColor}));
    assert(contrast(staticColors.ink,staticColors.paper)>=4.5,'No-JS copy remains readable');
    await nojs.close();
    console.log('Creative workspace: Poster/Loom/Shader keep and native reopen equivalence; rename/reload/remove, empty state, light/dark mobile and no-JS passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
