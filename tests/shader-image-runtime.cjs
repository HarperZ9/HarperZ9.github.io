const assert=require('node:assert/strict');
const {readFile,mkdir}=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:8802';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.goto(base+'/workspace.html');
    const diagnostic=await page.evaluate(async()=>{
      const {createShaderRunner}=await import('/system/shader-runner.js?v=20260907-image-input');
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=40;
      window.imageTestRunner=createShaderRunner(canvas);
      return window.imageTestRunner.setSource('// line\n'.repeat(16)+'this is not GLSL');
    });
    assert.equal(diagnostic.ok,false);
    assert.match(diagnostic.error,/line 17:/,'Diagnostics report the actual user source line');
    const result=await page.evaluate(()=>{
      const r=window.imageTestRunner;
      const source=document.createElement('canvas');source.width=63;source.height=35;
      const g=source.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,63,17);g.fillStyle='#0000ff';g.fillRect(0,17,63,18);
      const uploaded=r.setTexture(source);
      const compiled=r.setSource('void mainImage(out vec4 O,in vec2 U){O=texture2D(iChannel0,U/iResolution.xy);}');
      r.renderFrame(0);
      const pixel=(x,y)=>{const p=new Uint8Array(4);r.gl.readPixels(x,y,1,1,r.gl.RGBA,r.gl.UNSIGNED_BYTE,p);return [...p];};
      const first={top:pixel(8,32),bottom:pixel(8,8)};
      const rejected=r.setTexture({width:9999999,height:1});r.renderFrame(0);
      const preserved={top:pixel(8,32),bottom:pixel(8,8)};
      const wrongType=r.setTexture({width:64,height:40});r.renderFrame(0);
      const preservedAfterThrow={top:pixel(8,32),bottom:pixel(8,8)};
      source.width=37;source.height=21;g.fillStyle='#00ff00';g.fillRect(0,0,37,21);
      const replaced=r.setTexture(source);r.renderFrame(0);const green=pixel(8,8);
      const invalid=r.setSource('invalid');r.renderFrame(0);const lastGood=pixel(8,8);
      const error=r.gl.getError();r.destroy();return {uploaded,compiled,first,rejected,preserved,wrongType,preservedAfterThrow,replaced,green,invalid,lastGood,error};
    });
    assert.equal(result.uploaded.ok,true);assert.equal(result.compiled.ok,true);
    assert.deepEqual(result.first.top,[255,0,0,255]);assert.deepEqual(result.first.bottom,[0,0,255,255]);
    assert.equal(result.rejected.ok,false);assert.deepEqual(result.preserved,result.first);
    assert.equal(result.wrongType.ok,false);assert.deepEqual(result.preservedAfterThrow,result.first);
    assert.equal(result.replaced.ok,true);assert.deepEqual(result.green,[0,255,0,255]);
    assert.equal(result.invalid.ok,false);assert.deepEqual(result.lastGood,result.green);assert.equal(result.error,0);
    await page.goto(base+'/retro.html');
    await page.waitForFunction(()=>document.querySelector('#re-measure').textContent.includes('cells'));
    await page.locator('#re-animate').uncheck();
    assert.equal(await page.locator('#re-shader-image').count(),1,'Shader authoring exposes an image picker');
    const png=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=1280;c.height=800;const g=c.getContext('2d');
      g.fillStyle='#e66b44';g.fillRect(0,0,1280,800);g.fillStyle='#23384e';g.fillRect(100,160,780,360);return c.toDataURL();
    });
    const input=page.waitForEvent('filechooser');await page.locator('#re-shader-image').click();
    await (await input).setFiles({name:'study.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});
    await page.waitForFunction(()=>document.querySelector('#re-image-status').textContent.includes('ready'));
    await page.locator('#re-image-study').selectOption('image');
    assert.equal(await page.locator('#re-output-mode').count(),1,'Image studies can bypass the pixel and CRT treatment');
    await page.locator('#re-output-mode').selectOption('clean');
    assert.equal(await page.locator('#re-out').evaluate(c=>getComputedStyle(c).imageRendering),'auto');
    assert.deepEqual(await page.locator('#re-out').evaluate(c=>{
      const g=c.getContext('2d');return {w:c.width,h:c.height,corner:[...g.getImageData(10,10,1,1).data]};
    }),{w:1024,h:640,corner:[230,107,68,255]},'Clean shader output preserves source color at native shader resolution');
    const image=await page.locator('#re-out').evaluate(c=>c.toDataURL());
    const palette=await page.locator('#re-palette').inputValue();
    await page.locator('#re-output-mode').selectOption('retro');
    assert.notEqual(await page.locator('#re-out').evaluate(c=>c.toDataURL()),image);
    await page.locator('#re-output-mode').selectOption('clean');
    assert.equal(await page.locator('#re-out').evaluate(c=>c.toDataURL()),image,'Clean/retro toggles do not destroy the source');
    assert.equal(await page.locator('#re-palette').inputValue(),palette,'Output mode preserves treatment settings');
    await page.locator('#re-image-study').selectOption('contour');
    const contour=await page.locator('#re-out').evaluate(c=>c.toDataURL());assert.notEqual(image,contour,'Image studies change the rendered result');
    const save=async()=>{const d=page.waitForEvent('download');await page.locator('#re-project-save').click();return readFile(await(await d).path());};
    const bytes=await save();const record=JSON.parse(bytes);
    assert.match(record.patch.glsl,/iChannel0/);assert.equal(record.assets.source,png);
    assert.equal(record.patch.outputMode,'clean');
    await page.locator('#re-knobC').fill('100');await page.locator('#re-knobC').dispatchEvent('input');
    assert.notEqual(await page.locator('#re-out').evaluate(c=>c.toDataURL()),contour,'Paper warmth changes real output');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#re-code').value.length>0);
    await page.locator('#re-project-file').setInputFiles({name:'image-study.json',mimeType:'application/json',buffer:bytes});
    await page.waitForFunction(()=>document.querySelector('#re-project-status').dataset.state==='ready');
    assert.equal(await page.locator('#re-image-study').inputValue(),'contour');
    assert.match(await page.locator('#re-knobC').getAttribute('aria-label'),/paper warmth/);
    assert.equal(await page.locator('#re-out').evaluate(c=>c.toDataURL()),contour,'Native reopen restores the image-driven shader pixels');
    assert.deepEqual(JSON.parse(await save()),record,'Image source and editable program survive a native project round trip');
    const open=buffer=>page.locator('#re-project-file').setInputFiles({name:'study.json',mimeType:'application/json',buffer});
    await open(Buffer.from(JSON.stringify({...record,patch:{...record.patch,outputMode:'bogus'}})));
    await page.waitForFunction(()=>document.querySelector('#re-project-status').dataset.state==='error');
    assert.equal(await page.locator('#re-out').evaluate(c=>c.toDataURL()),contour,'Invalid output mode cannot replace current work');
    const legacy=structuredClone(record);delete legacy.patch.outputMode;
    await open(Buffer.from(JSON.stringify(legacy)));
    await page.waitForFunction(()=>document.querySelector('#re-project-status').dataset.state==='ready');
    assert.equal(await page.locator('#re-output-mode').inputValue(),'retro','Older v1 projects retain their original treatment');
    await open(bytes);await page.waitForFunction(()=>document.querySelector('#re-project-status').dataset.state==='ready');
    await mkdir('.superpowers/shader-image-qa',{recursive:true});
    for(const theme of ['light','dark'])for(const width of [1280,320]){
      await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
      await page.locator('#re-image-study').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
      assert.ok(await page.locator('#re-image-study').evaluate(e=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);}), 'Image controls remain reachable');
      await page.screenshot({path:`.superpowers/shader-image-qa/${theme}-${width}.png`});
    }
    // A shipped artwork provides a visual quality check beyond flat-color probes.
    await page.setViewportSize({width:1280,height:900});
    const oldFrame=await page.locator('#re-out').evaluate(c=>c.toDataURL());
    await page.locator('#re-file').setInputFiles(require('node:path').join(__dirname,'../art/spatial/crystal-city/source.png'));
    await page.waitForFunction(old=>document.querySelector('#re-out').toDataURL()!==old,oldFrame);
    for(const study of ['image','contour']){
      await page.locator('#re-image-study').selectOption(study);
      await page.locator('#re-out').screenshot({path:`.superpowers/shader-image-qa/crystal-${study}.png`});
    }
    console.log('Shader image runner/editor: diagnostics, NPOT orientation, invalid-input preservation, image studies/knobs, exact native roundtrip, mobile and both themes passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
