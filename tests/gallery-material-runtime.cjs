const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:8802';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.goto(base+'/gallery.html?seed=material-test&layers=flow');
    await page.waitForFunction(()=>document.querySelector('#desk-canvas')?.dataset.specimenRendered==='true');
    const pngs=await page.evaluate(()=>['red','blue'].map(color=>{const c=document.createElement('canvas');c.width=128;c.height=80;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,128,80);return c.toDataURL();}));
    const upload=(name,index)=>page.locator('#desk-import-file').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(pngs[index].split(',')[1],'base64')});
    const gate=()=>page.evaluate(()=>{
      const original=window.createImageBitmap;let first=true;window.materialWaiting=false;window.materialBitmaps=[];
      window.createImageBitmap=async(...args)=>{
        const delay=first;first=false;const bitmap=await original(...args);window.materialBitmaps.push(bitmap);
        if(delay){window.staleMaterialBitmap=bitmap;await new Promise(resolve=>{window.releaseMaterial=resolve;window.materialWaiting=true;});}
        return bitmap;
      };
    });
    const release=()=>page.evaluate(async()=>{window.releaseMaterial();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    await gate();await upload('older.png',0);await page.waitForFunction(()=>window.materialWaiting);
    await upload('newer.png',1);await page.waitForFunction(()=>document.querySelector('#desk-title').textContent.includes('newer.png'));
    const newest=await page.locator('#desk-canvas').evaluate(c=>c.toDataURL());await release();
    assert.match(await page.locator('#desk-title').textContent(),/newer.png/,'Late decode cannot replace newer material');
    assert.equal(await page.locator('#desk-canvas').evaluate(c=>c.toDataURL()),newest);
    assert.equal(await page.evaluate(()=>window.staleMaterialBitmap.width),0,'Rejected stale bitmap is closed');
    const newerHandle=await page.evaluateHandle(()=>window.materialBitmaps.at(-1));
    await gate();await upload('pending.png',0);await page.waitForFunction(()=>window.materialWaiting);
    await page.locator('#desk-clear-material').click();const cleared=await page.locator('#desk-canvas').evaluate(c=>c.toDataURL());await release();
    assert.equal(await page.locator('#desk-canvas').evaluate(c=>c.toDataURL()),cleared,'Clear cancels a pending adoption');
    assert.equal(await page.evaluate(()=>window.staleMaterialBitmap.width),0);
    assert.equal(await newerHandle.evaluate(bitmap=>bitmap.width),0,'Clear releases the active image');await newerHandle.dispose();
    await page.evaluate(()=>{
      window.createImageBitmap=undefined;window.materialUrls=[];window.revokedMaterialUrls=[];
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
      URL.createObjectURL=blob=>{const url=create(blob);window.materialUrls.push(url);return url;};
      URL.revokeObjectURL=url=>{window.revokedMaterialUrls.push(url);return revoke(url);};
    });
    await upload('fallback.png',1);await page.waitForFunction(()=>document.querySelector('#desk-title').textContent.includes('fallback.png'));
    const fallback=await page.locator('#desk-canvas').evaluate(c=>c.toDataURL());
    await page.locator('#desk-import-file').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    await page.waitForFunction(()=>document.querySelector('#desk-status').textContent.includes('could not be loaded'));
    assert.equal(await page.locator('#desk-canvas').evaluate(c=>c.toDataURL()),fallback,'Failed candidate preserves active artwork');
    assert.deepEqual(await page.evaluate(()=>window.revokedMaterialUrls),await page.evaluate(()=>window.materialUrls),'Fallback URLs are revoked on success and failure');
    console.log('Gallery latest-choice, clear cancellation, bitmap disposal, failed-image preservation and fallback URL cleanup passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
