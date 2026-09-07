const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const transferredUrls=[];
    page.on('framenavigated',frame=>{if(frame===page.mainFrame() && frame.url().includes('project-transfer='))transferredUrls.push(frame.url());});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    let accept=true, dialogs=0;
    page.on('dialog',async d=>{dialogs++; if(accept)await d.accept();else await d.dismiss();});
    async function save(selector){const next=page.waitForEvent('download');await page.locator(selector).click();return readFile(await(await next).path());}
    const choose=(selector,bytes)=>page.locator(selector).setInputFiles({name:'creative.json',mimeType:'application/json',buffer:bytes});
    async function delayNextFileText(){
      await page.evaluate(()=>{
        const original=File.prototype.text;
        File.prototype.text=function(){
          File.prototype.text=original;
          const selected=this;
          return new Promise((resolve,reject)=>{
            window.finishClassification=()=>{
              delete window.finishClassification;
              return original.call(selected).then(resolve,reject);
            };
          });
        };
      });
    }
    async function expectStaleCancellation(trigger,label){
      await page.evaluate(()=>{const el=document.querySelector('#project-routing-status');if(el){el.dataset.state='';el.textContent='';}});
      const beforeDialogs=dialogs;
      await delayNextFileText();
      await choose('#wv-project-file',poster);
      await page.waitForFunction(()=>typeof window.finishClassification==='function');
      await trigger();
      await page.evaluate(()=>window.finishClassification());
      await page.waitForFunction(()=>document.querySelector('#project-routing-status')?.dataset.state==='cancelled');
      assert(new URL(page.url()).pathname.endsWith('/loom.html'),label+' stale cancellation stays in Loom');
      assert.equal(dialogs,beforeDialogs,label+' stale cancellation happens before the cross-editor warning');
      assert.equal(await page.locator('#wv-project-file').evaluate(el=>el.value),'',label+' stale cancellation clears the file input for retry');
    }
    await page.goto(base+'/studio.html?source=poster');
    await page.waitForFunction(()=>window.__studioPoster);
    await page.locator('[data-poster-block-index="0"] textarea').fill('A project that travels');
    const poster=await save('#poster-mount button:has-text("Save project")');
    await page.goto(base+'/loom.html');
    await page.waitForFunction(()=>document.querySelector('#wv-readout').textContent.includes('ends x'));
    await choose('#wv-project-file',poster);
    await page.waitForURL('**/studio.html?source=poster**',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('[data-poster-project-status]')?.dataset.state==='ready');
    assert.equal(await page.locator('[data-poster-block-index="0"] textarea').inputValue(),'A project that travels');
    assert.equal(dialogs,1,'Leaving a different editor requires a warning');
    assert(!page.url().includes('project-transfer'),'Consumed ticket leaves the address bar');
    const roundtrip=await save('#poster-mount button:has-text("Save project")');
    assert.deepEqual(JSON.parse(roundtrip),JSON.parse(poster),'Cross-editor open preserves editable state, not a flattened image');
    await page.goto(base+'/loom.html');
    await page.waitForFunction(()=>document.querySelector('#wv-readout').textContent.includes('ends x'));
    await page.locator('#wv-rack-weave').evaluate(el=>el.open=true);
    await page.locator('#wv-weaveit').uncheck();
    const loom=await save('#wv-project-save');
    await page.goto(base+'/retro.html');
    await page.waitForFunction(()=>document.querySelector('#re-code').value.length>0);
    await choose('#re-project-file',loom);
    await page.waitForURL('**/loom.html**',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#wv-project-status')?.dataset.state==='ready');
    assert.deepEqual(JSON.parse(await save('#wv-project-save')),JSON.parse(loom));
    accept=false;
    await choose('#wv-project-file',poster);
    await page.waitForFunction(()=>document.querySelector('#project-routing-status')?.dataset.state==='cancelled');
    assert(new URL(page.url()).pathname.endsWith('/loom.html'));
    accept=true;
    const beforeEditDialogs=dialogs;
    await page.evaluate(()=>{
      const original=File.prototype.text;
      File.prototype.text=function(){
        File.prototype.text=original;
        return new Promise((resolve,reject)=>{window.finishClassification=()=>original.call(this).then(resolve,reject);});
      };
    });
    await choose('#wv-project-file',poster);
    await page.waitForFunction(()=>typeof window.finishClassification==='function');
    await page.locator('#wv-tone').evaluate(el=>{el.value='45';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.evaluate(()=>window.finishClassification());
    await page.waitForFunction(()=>document.querySelector('#project-routing-status')?.dataset.state==='cancelled');
    assert.equal(dialogs,beforeEditDialogs,'A slow classification cannot navigate away from newer work');
    assert.equal(await page.locator('#wv-tone').inputValue(),'45');
    assert.equal(await page.locator('#wv-project-file').evaluate(el=>el.value),'','A stale cancellation clears the file input for same-file retry');
    await choose('#wv-project-file',poster);
    await page.waitForURL('**/studio.html?source=poster**',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('[data-poster-project-status]')?.dataset.state==='ready');
    assert.equal(await page.locator('[data-poster-block-index="0"] textarea').inputValue(),'A project that travels');
    await page.goto(base+'/loom.html');
    await page.waitForFunction(()=>document.querySelector('#wv-readout').textContent.includes('ends x'));
    await expectStaleCancellation(()=>page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))), 'Keyboard');
    await expectStaleCancellation(()=>page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:17,button:0,bubbles:true}))), 'Pointer');
    await expectStaleCancellation(()=>page.evaluate(()=>document.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'x',bubbles:true}))), 'Beforeinput');
    await page.evaluate(()=>{window.indexedDB.open=()=>{throw new DOMException('Blocked','SecurityError');};});
    const exportError=await page.evaluate(async ()=>{
      const {openProjectInEditor}=await import('/system/project-router.js?v=20260907-native-routing');
      const file=new File([JSON.stringify({schema:'zentropy.poster',version:1})],'creative.json',{type:'application/json'});
      try { await openProjectInEditor(file); return ''; }
      catch (error) { return error.message; }
    });
    assert.match(exportError,/Open this file directly in Poster/i,'Workspace open errors point to the native editor fallback');
    await choose('#wv-project-file',poster);
    await page.waitForFunction(()=>document.querySelector('#project-routing-status')?.dataset.state==='error');
    assert(new URL(page.url()).pathname.endsWith('/loom.html'),'Storage failure never navigates or discards the active work');
    await page.goto(base+'/retro.html');
    await page.waitForFunction(()=>document.querySelector('#re-code').value.length>0);
    await page.locator('#re-animate').uncheck();
    const shader=await save('#re-project-save');
    await page.goto(base+'/loom.html');
    await page.waitForFunction(()=>document.querySelector('#wv-readout').textContent.includes('ends x'));
    await choose('#wv-project-file',shader);
    await page.waitForURL('**/retro.html**',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#re-project-status')?.dataset.state==='ready');
    assert.deepEqual(JSON.parse(await save('#re-project-save')),JSON.parse(shader));
    assert(transferredUrls.length>=3);
    await page.goto(transferredUrls[0]);
    await page.waitForFunction(()=>document.querySelector('#project-routing-status')?.dataset.state==='error');
    assert.match(await page.locator('#project-routing-status').innerText(),/expired|unavailable/i);
    assert.deepEqual(errors,[]);
    console.log('Native Poster, Loom and Shader Room cross-editor opening, exact state, cancellation, storage failure and expired ticket passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
