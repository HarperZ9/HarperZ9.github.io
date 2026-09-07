const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:8802';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.goto(base+'/retro.html');
    await page.waitForFunction(()=>document.querySelector('#re-measure').textContent.includes('cells'));
    await page.locator('#re-animate').uncheck();
    await page.locator('#re-code').fill('void mainImage(out vec4 O,in vec2 U){O=vec4(vec3(iKnobC),1.0);}');
    await page.locator('#re-run').click();
    const knob=async value=>{await page.locator('#re-knobC').fill(value);await page.locator('#re-knobC').dispatchEvent('input');};
    const pixel=()=>page.locator('#re-out').evaluate(c=>[...c.getContext('2d').getImageData(5,5,1,1).data]);
    await knob('100');await page.locator('#re-output-mode').selectOption('clean');
    assert.deepEqual(await pixel(),[255,255,255,255]);
    await page.getByText('Saved settings & history',{exact:true}).click();
    await page.locator('#re-save-patch').click();
    await knob('0');assert.deepEqual(await pixel(),[0,0,0,255]);
    await page.locator('#re-output-mode').selectOption('retro');
    await page.locator('#re-patches').selectOption('0');
    assert.equal(await page.locator('#re-knobC').inputValue(),'100');
    assert.equal(await page.locator('#re-output-mode').inputValue(),'clean');
    assert.deepEqual(await pixel(),[255,255,255,255],'Paused saved settings must render their restored uniforms, not just update controls');
    await page.locator('#re-share-patch').click();
    const linked=await browser.newPage();await linked.goto(page.url());
    await linked.waitForFunction(()=>document.querySelector('#re-measure').textContent.includes('Clean output'));
    assert.equal(await linked.locator('#re-knobC').inputValue(),'100');
    assert.deepEqual(await linked.locator('#re-out').evaluate(c=>[...c.getContext('2d').getImageData(5,5,1,1).data]),[255,255,255,255],'A settings link initializes the first shader with restored uniforms');
    console.log('Paused settings restore applies source, output mode and knob uniforms before rendering.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
