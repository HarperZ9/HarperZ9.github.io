const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const source of [
      {path:'gallery.html?seed=ink-study&layers=flow',canvas:'#desk-canvas',button:'#desk-retro',ready:()=>document.querySelector('#desk-canvas')?.dataset.specimenRendered==='true'},
      {path:'loom.html',canvas:'#wv-out',button:'#wv-send-retro',ready:()=>document.querySelector('#wv-out')?.width>100&&document.querySelector('#wv-status')?.textContent.length>0},
    ]) {
      const context = await browser.newContext({reducedMotion:'reduce',acceptDownloads:true});
      try {
        const page = await context.newPage();
        await page.goto(base+'/'+source.path);await page.waitForFunction(source.ready);
        const expected = await page.locator(source.canvas).evaluate(canvas=>{
          const target=document.createElement('canvas');target.width=1280;target.height=800;
          const g=target.getContext('2d');g.fillStyle='#07070c';g.fillRect(0,0,1280,800);
          const scale=Math.min(1280/canvas.width,800/canvas.height),w=canvas.width*scale,h=canvas.height*scale;
          g.drawImage(canvas,(1280-w)/2,(800-h)/2,w,h);return target.toDataURL();
        });
        await page.locator(source.button).click();await page.waitForURL('**/retro.html?import=plate');
        await page.waitForFunction(()=>document.querySelector('.re-tab[data-src="upload"]')?.getAttribute('aria-selected')==='true');
        await page.locator('.re-tab[data-src="shader"]').click();
        await page.locator('#re-animate').uncheck();
        await page.locator('#re-image-study').selectOption('contour');
        await page.locator('#re-output-mode').selectOption('clean');
        const d=page.waitForEvent('download');await page.locator('#re-project-save').click();
        const record=JSON.parse(await readFile(await(await d).path()));
        assert.equal(record.assets.source,expected,'The actual handed-off material reaches the shader project');
        assert.match(record.patch.glsl,/texture2D\(iChannel0/);assert.equal(record.patch.outputMode,'clean');
        assert.equal(await page.evaluate(()=>sessionStorage.getItem('re.retro.handoff')),null);
        console.log(source.path.split('.')[0]+' → image-aware Shader Room → native project passed');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
