// No-JS rendering, theme contrast, and commerce boundary for fonts.html.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8766';

function rgbParts(value) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  assert(match, `Expected an rgb color, got ${value}`);
  return match.slice(1, 4).map(Number).map(v => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

function luminance(value) {
  const [r, g, b] = rgbParts(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      const response = await page.goto(`${base}/fonts.html`);
      assert.equal(response.status(), 200, 'fonts.html must resolve');
      await page.evaluate(() => document.fonts.ready);

      const proof = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('main p, main h1, main h2, main h3, main a, main li, main dt, main dd')];
        const forbidden = document.body.textContent.match(/\b(buy now|checkout|add to cart|stripe|notify me|download font)\b/i);
        const catalog = document.querySelector('#font-catalog');
        const collection = document.querySelector('#font-collection');
        const h1 = document.querySelector('h1');
        const visibleControls = [...document.querySelectorAll('[data-font-specimen-controls] :is(textarea, select, input, button)')]
          .filter(n => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
        const staticSpecimen = document.querySelector('[data-font-static-specimen]');
        return {
          heading: h1 ? h1.textContent.trim() : '',
          catalogState: document.body.getAttribute('data-font-catalog-state'),
          commerce: document.body.getAttribute('data-commerce-enabled'),
          catalogText: catalog ? catalog.textContent.trim() : '',
          collectionText: collection?.textContent.trim() || '',
          processCopy: /Only reviewed|source-free|public page honest|approved for/i.test(collection?.textContent || ''),
          tryHref: collection?.querySelector('[data-font-try="editorial-preview"]')?.getAttribute('href'),
          productDetailsOpen: Boolean(collection?.querySelector('[data-font-product="editorial-regular"] details')?.open),
          visibleControlCount: visibleControls.length,
          staticSpecimenText: staticSpecimen ? staticSpecimen.textContent.trim() : '',
          background: getComputedStyle(document.body).backgroundColor,
          textColor: getComputedStyle(h1).color,
          clipped: nodes.filter(n => {
            const r = n.getBoundingClientRect();
            return r.left < -1 || r.right > innerWidth + 1;
          }).map(n => n.textContent.trim().slice(0, 40)),
          forbidden: forbidden && forbidden[0],
        };
      });

      assert.equal(proof.heading, 'Type with a point of view.');
      assert.equal(proof.catalogState, 'preview');
      assert.equal(proof.commerce, 'false');
      assert.match(proof.catalogText, /No fonts are available to purchase yet\./);
      assert.match(proof.collectionText, /Zentropy Editorial/);
      assert.match(proof.collectionText, /Limited preview, not for sale/);
      assert.match(proof.collectionText, /Printable ASCII plus editorial punctuation/);
      assert.match(proof.collectionText, /Try this face/);
      assert.match(proof.collectionText, /Browser-only preview/);
      assert.equal(proof.processCopy, false, `${theme}/${width}: collection copy should be reader-facing, not internal process text`);
      assert.equal(proof.tryHref, '#font-lab');
      assert.equal(proof.productDetailsOpen, false, `${theme}/${width}: metadata details should stay collapsed by default`);
      assert.equal(proof.visibleControlCount, 0, `${theme}/${width}: no-JS must not expose dead specimen controls`);
      assert.match(proof.staticSpecimenText, /Static specimen/i);
      assert.match(proof.staticSpecimenText, /Hanken Grotesk/i);
      assert.equal(proof.forbidden, null);
      assert.deepEqual(proof.clipped, [], `${theme}/${width}: content cannot be clipped offscreen`);
      assert.equal(proof.background, theme === 'light' ? 'rgb(250, 250, 248)' : 'rgb(16, 20, 22)');
      assert.notEqual(proof.textColor, proof.background, `${theme}/${width}: heading must separate from the background`);
      await context.close();
    }

    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, colorScheme: theme });
      await context.addInitScript(() => {
        window.__fontSpecimenNetwork = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = (...args) => {
          window.__fontSpecimenNetwork.push(`fetch:${String(args[0])}`);
          return originalFetch(...args);
        };
        const originalBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
        navigator.sendBeacon = (...args) => {
          window.__fontSpecimenNetwork.push(`beacon:${String(args[0])}`);
          return originalBeacon ? originalBeacon(...args) : false;
        };
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function XMLHttpRequest() {
          window.__fontSpecimenNetwork.push('xhr');
          return new OriginalXHR();
        };
      });
      const page = await context.newPage();
      await page.goto(`${base}/fonts.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);

      const baseProof = await page.evaluate(() => {
        const primary = document.querySelector('.font-action-primary');
        const mark = document.querySelector('.current-face-mark');
        const styles = getComputedStyle(primary);
        return {
          color: styles.color,
          background: styles.backgroundColor,
          markSize: parseFloat(getComputedStyle(mark).fontSize),
        };
      });
      await page.hover('.font-action-primary');
      const hoverProof = await page.evaluate(() => {
        const styles = getComputedStyle(document.querySelector('.font-action-primary'));
        return { color: styles.color, background: styles.backgroundColor };
      });
      await page.focus('.font-action-primary');
      const focusProof = await page.evaluate(() => {
        const styles = getComputedStyle(document.querySelector('.font-action-primary'));
        return { color: styles.color, background: styles.backgroundColor };
      });

      assert(contrast(baseProof.color, baseProof.background) >= 4.5, `${theme}/${width}: primary action base contrast`);
      assert(contrast(hoverProof.color, hoverProof.background) >= 4.5, `${theme}/${width}: primary action hover contrast`);
      assert(contrast(focusProof.color, focusProof.background) >= 4.5, `${theme}/${width}: primary action focus contrast`);
      assert(baseProof.markSize >= 48, `${theme}/${width}: current face marks must remain specimen-sized`);

      const collectionLayout = await page.evaluate(() => {
        const main = document.querySelector('.font-market').getBoundingClientRect();
        const collection = document.querySelector('#font-collection').getBoundingClientRect();
        const product = document.querySelector('[data-font-product="editorial-regular"]').getBoundingClientRect();
        const specimen = document.querySelector('.font-product-specimen');
        const specimenStyles = getComputedStyle(specimen);
        const productStyles = getComputedStyle(document.querySelector('[data-font-product="editorial-regular"]'));
        return {
          collectionWidth: collection.width,
          productWidth: product.width,
          mainWidth: main.width,
          specimenBorderTopWidth: specimenStyles.borderTopWidth,
          productBoxShadow: productStyles.boxShadow,
        };
      });
      if (width >= 1000) {
        assert(collectionLayout.collectionWidth >= collectionLayout.mainWidth * .96,
          `${theme}/${width}: original collection should span the main content width`);
        assert(collectionLayout.productWidth >= collectionLayout.mainWidth * .88,
          `${theme}/${width}: original specimen should not be squeezed into a narrow nested card`);
      }
      assert.equal(collectionLayout.specimenBorderTopWidth, '0px',
        `${theme}/${width}: specimen should use open space instead of nested card borders`);
      assert.notEqual(collectionLayout.productBoxShadow, 'none',
        `${theme}/${width}: card should use one visual container around the specimen`);

      const specimenVisible = await page.isVisible('[data-font-specimen-controls]');
      assert.equal(specimenVisible, true, `${theme}/${width}: JS must reveal live specimen controls`);
      await page.click('.font-action-primary');
      await page.waitForFunction(() => document.querySelector('#font-lab-title').getBoundingClientRect().top >= 80);
      const editorLayout = await page.evaluate(() => {
        const box = selector => {
          const {x,y,width,height} = document.querySelector(selector).getBoundingClientRect();
          return {x,y,width,height};
        };
        return {controls:box('[data-font-specimen-controls]'), preview:box('[data-font-specimen-live]')};
      });
      if (width >= 1000) {
        assert(editorLayout.preview.x >= editorLayout.controls.x + editorLayout.controls.width,
          'Desktop preview must sit beside controls, not below them');
        assert(Math.abs(editorLayout.preview.y-editorLayout.controls.y) < 4,
          'Desktop preview and controls must start together');
      } else {
        assert(editorLayout.preview.y + editorLayout.preview.height <= editorLayout.controls.y,
          'Mobile preview must precede controls without overlap');
      }
      const unlabelledControls = await page.evaluate(() =>
        [...document.querySelectorAll('[data-font-specimen-controls] textarea, [data-font-specimen-controls] select, [data-font-specimen-controls] input, [data-font-specimen-controls] button')]
          .filter(control => {
            if (control.tagName === 'BUTTON') return !control.textContent.trim() && !control.getAttribute('aria-label');
            return !control.labels || control.labels.length === 0;
          })
          .map(control => control.id || control.textContent.trim() || control.tagName)
      );
      assert.deepEqual(unlabelledControls, [], `${theme}/${width}: every live specimen control needs a native label`);

      const sampleText = 'Sphinx of black quartz, judge my vows. 012345 Il1 O0';
      await page.focus('#font-specimen-text');
      await page.keyboard.press('Control+A');
      await page.keyboard.type(sampleText);
      await page.selectOption('#font-specimen-family', 'conso');
      await page.locator('#font-specimen-size').evaluate(input => {
        input.value = '56';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-line').evaluate(input => {
        input.value = '1.10';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-track').evaluate(input => {
        input.value = '0.04';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const specimenProof = await page.evaluate(() => {
        const preview = document.querySelector('[data-font-specimen-preview]');
        const styles = getComputedStyle(preview);
        return {
          text: preview.textContent,
          family: styles.fontFamily,
          fontSize: styles.fontSize,
          familyState: preview.getAttribute('data-font-family'),
          sizeOutput: document.querySelector('#font-specimen-size-output').textContent.trim(),
          lineOutput: document.querySelector('#font-specimen-line-output').textContent.trim(),
          trackOutput: document.querySelector('#font-specimen-track-output').textContent.trim(),
          status: document.querySelector('#font-specimen-status').textContent.trim(),
          network: window.__fontSpecimenNetwork,
        };
      });
      assert.equal(specimenProof.text, sampleText);
      assert.match(specimenProof.family, /Conso/i);
      assert.equal(specimenProof.fontSize, '56px');
      assert.equal(specimenProof.familyState, 'conso');
      assert.equal(specimenProof.sizeOutput, '56 px');
      assert.equal(specimenProof.lineOutput, '1.10');
      assert.equal(specimenProof.trackOutput, '0.04 em');
      assert.match(specimenProof.status, /Conso, 56 px, line height 1\.10, tracking 0\.04 em/);
      assert.deepEqual(specimenProof.network, [], `${theme}/${width}: specimen editor must not send visitor text`);
      assert.equal(await page.locator('[data-font-specimen-controls]').evaluate(form => {
        let prevented = false;
        form.addEventListener('submit', event => { prevented = event.defaultPrevented; }, {once: true});
        form.requestSubmit();
        return prevented;
      }), true, 'Local specimen form must cancel submission rather than sending visitor text in a GET query');

      await page.click('[data-font-specimen-reset]');
      const resetProof = await page.evaluate(() => {
        const preview = document.querySelector('[data-font-specimen-preview]');
        return {
          text: preview.textContent,
          familyState: preview.getAttribute('data-font-family'),
          sizeOutput: document.querySelector('#font-specimen-size-output').textContent.trim(),
          lineOutput: document.querySelector('#font-specimen-line-output').textContent.trim(),
          trackOutput: document.querySelector('#font-specimen-track-output').textContent.trim(),
        };
      });
      assert.equal(resetProof.text, 'Letters should keep their shape when the work gets dense.');
      assert.equal(resetProof.familyState, 'hanken');
      assert.equal(resetProof.sizeOutput, '40 px');
      assert.equal(resetProof.lineOutput, '1.25');
      assert.equal(resetProof.trackOutput, '0.00 em');

      await page.click('[data-font-try="editorial-preview"]');
      await page.waitForFunction(() => document.querySelector('#font-specimen-family')?.value === 'editorial-preview');
      await page.focus('#font-specimen-text');
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Editorial proof — ± × ÷ ° … • é');
      await page.waitForFunction(() => document.querySelector('[data-font-coverage-warning]')?.textContent.includes('Unsupported in this preview'));
      const originalProof = await page.evaluate(() => {
        const preview = document.querySelector('[data-font-specimen-preview]');
        const warning = document.querySelector('[data-font-coverage-warning]');
        const status = document.querySelector('#font-specimen-status');
        return {
          family: getComputedStyle(preview).fontFamily,
          familyState: preview.getAttribute('data-font-family'),
          unsupported: warning.textContent.trim(),
          status: status.textContent.trim(),
          posterDisabled: document.querySelector('[data-font-specimen-poster]').disabled,
          cssDisabled: document.querySelector('[data-font-specimen-css]').disabled,
          network: window.__fontSpecimenNetwork,
        };
      });
      assert.equal(originalProof.familyState, 'editorial-preview');
      assert.match(originalProof.family, /Zentropy Editorial Preview/i);
      assert.match(originalProof.unsupported, /é/);
      assert.match(originalProof.unsupported, /Poster and CSS export stay off/i);
      assert.match(originalProof.status, /Zentropy Editorial Preview/);
      assert.equal(originalProof.posterDisabled, true, `${theme}/${width}: preview face must not be transferable to Poster`);
      assert.equal(originalProof.cssDisabled, true, `${theme}/${width}: preview face must not export CSS`);
      assert.deepEqual(originalProof.network, [], `${theme}/${width}: original preview must not send visitor text`);
      await context.close();
    }

    const broken = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await broken.route('**/type/preview/*.woff2', route => route.abort());
    const failed = await broken.newPage();
    await failed.goto(`${base}/fonts.html`);
    const assetStatus = failed.locator('[data-font-asset-status]');
    await assetStatus.waitFor({ state: 'visible' });
    assert.match(await assetStatus.textContent(), /could not|unavailable|failed|unable/i,
      'The collection must report original preview load failure before the sampler selection changes');
    await broken.close();

    console.log('Fonts marketplace: no-JS, preview collection, live specimen controls, unsupported-character warning, no checkout, 320/1280 reflow and both themes passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
