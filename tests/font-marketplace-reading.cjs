// No-JS rendering, theme contrast, and commerce boundary for fonts.html.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const artifactDir = '.superpowers/font-marketplace-reading';
const DEFAULT_TEXT = 'Letters should keep their shape when the work gets dense.';

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
  fs.mkdirSync(artifactDir, { recursive: true });
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
        const heroSpecimen = document.querySelector('.font-specimen-panel');
        const labCopy = document.querySelector('#font-lab .section-copy');
        const labLinks = document.querySelector('#font-lab .font-lab-links');
        const labPanel = document.querySelector('#font-lab .font-lab-panel');
        const visibleControls = [...document.querySelectorAll('[data-font-specimen-controls] :is(textarea, select, input, button)')]
          .filter(n => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
        const staticSpecimen = document.querySelector('[data-font-static-specimen]');
        return {
          heading: h1 ? h1.textContent.trim() : '',
          catalogState: document.body.getAttribute('data-font-catalog-state'),
          commerce: document.body.getAttribute('data-commerce-enabled'),
          catalogText: catalog ? catalog.textContent.trim() : '',
          collectionText: collection?.textContent.trim() || '',
          heroSpecimenText: heroSpecimen?.textContent.trim() || '',
          labIntroText: labCopy?.textContent.trim() || '',
          labLinksText: labLinks?.textContent.trim() || '',
          labLinkHrefs: labLinks ? [...labLinks.querySelectorAll('a')].map(a => a.getAttribute('href')) : [],
          labLinksAfterPanel: labPanel && labLinks ? Boolean(labPanel.compareDocumentPosition(labLinks) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
          processCopy: /Only reviewed|source-free|public page honest|approved for/i.test(collection?.textContent || ''),
          browserOnlyCount: (collection?.textContent.match(/Browser-only preview/g) || []).length,
          posterHandoffCount: (collection?.textContent.match(/Poster handoff/g) || []).length,
          collectionBoundaryPresent: Boolean(collection?.querySelector('.font-collection-boundary')),
          tryHref: collection?.querySelector('[data-font-try="editorial-preview"]')?.getAttribute('href'),
          productDetailsOpen: Boolean(collection?.querySelector('[data-font-product="editorial-regular"] details')?.open),
          visibleControlCount: visibleControls.length,
          staticSpecimenText: staticSpecimen ? staticSpecimen.textContent.trim() : '',
          staticFamilies: staticSpecimen ? [...staticSpecimen.querySelectorAll('.font-static-line')].map(line => getComputedStyle(line).fontFamily) : [],
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
      assert.match(proof.collectionText, /A serif for titles\. A mono for code and technical notes\./);
      assert.match(proof.collectionText, /Editorial serif/);
      assert.match(proof.collectionText, /Technical mono/);
      assert.doesNotMatch(proof.collectionText, /Regular preview/);
      assert.match(proof.collectionText, /High-contrast serif with curved terminals for titles and quotations/);
      assert.doesNotMatch(proof.collectionText, /compact reading moments|without turning the page into a poster/);
      assert.match(proof.collectionText, /Limited browser preview/);
      assert.doesNotMatch(proof.collectionText, /Limited preview, not for sale/);
      assert.match(proof.collectionText, /Printable ASCII plus editorial punctuation/);
      assert.match(proof.collectionText, /Try this face/);
      assert.match(proof.collectionText, /Browser-only preview/);
      assert.equal(proof.browserOnlyCount, 2, `${theme}/${width}: browser-only caveats should live in each preview detail`);
      assert.equal(proof.posterHandoffCount, 2, `${theme}/${width}: Poster/CSS caveats should live in each preview detail`);
      assert.equal(proof.collectionBoundaryPresent, false, `${theme}/${width}: collection should not add a third shared caveat row`);
      assert.doesNotMatch(proof.heroSpecimenText, /ASCII \+ quotes|symbols/);
      assert.match(proof.labIntroText, /Choose a face, set text and adjust size, spacing and rhythm/);
      assert.doesNotMatch(proof.labIntroText, /Poster and CSS export|unsupported/i);
      assert.match(proof.labLinksText, /Creative tools/);
      assert.deepEqual(proof.labLinkHrefs, ['gallery.html#printdesk', 'loom.html', 'workspace.html']);
      assert.equal(proof.labLinksAfterPanel, true, `${theme}/${width}: creative tool details should come after the live editor`);
      assert.equal(proof.processCopy, false, `${theme}/${width}: collection copy should be reader-facing, not internal process text`);
      assert.equal(proof.tryHref, '#font-lab');
      assert.equal(proof.productDetailsOpen, false, `${theme}/${width}: metadata details should stay collapsed by default`);
      assert.equal(proof.visibleControlCount, 0, `${theme}/${width}: no-JS must not expose dead specimen controls`);
      assert.match(proof.staticSpecimenText, /Static specimen/i);
      assert.match(proof.staticSpecimenText, /Zentropy Editorial/i);
      assert.match(proof.staticSpecimenText, /Zentropy Mono/i);
      assert.match(proof.staticFamilies[0], /Zentropy Editorial Preview/);
      assert.match(proof.staticFamilies[1], /Zentropy Mono Preview/);
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
      await page.screenshot({ path: `${artifactDir}/${theme}-${width}.png`, fullPage: true });

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
      assert.equal(collectionLayout.productBoxShadow, 'none',
        `${theme}/${width}: original font rows should stay open, not shadowed like retail cards`);

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
      assert.equal(resetProof.familyState, 'editorial-preview');
      assert.equal(resetProof.sizeOutput, '40 px');
      assert.equal(resetProof.lineOutput, '1.25');
      assert.equal(resetProof.trackOutput, '0.00 em');

      assert.equal(await page.locator('[data-font-compare]').isVisible(), false,
        `${theme}/${width}: compare panel starts closed`);
      assert.equal(await page.locator('[data-font-compare-toggle]').getAttribute('aria-expanded'), 'false');
      await page.click('[data-font-compare-toggle]');
      await page.waitForSelector('[data-font-compare]:not([hidden])');
      assert.equal(await page.locator('[data-font-compare-toggle]').getAttribute('aria-expanded'), 'true');
      const compareDefaults = await page.evaluate(() => {
        const left = document.querySelector('[data-font-compare-family="left"]');
        const right = document.querySelector('[data-font-compare-family="right"]');
        const rows = [...document.querySelectorAll('[data-font-compare-slot]')].map(row => ({
          slot: row.dataset.fontCompareSlot,
          name: row.querySelector('[data-font-compare-name]').textContent.trim(),
          context: row.querySelector('[data-font-compare-context]').textContent.trim(),
          text: row.querySelector('[data-font-compare-preview]').textContent,
          familyState: row.querySelector('[data-font-compare-preview]').dataset.fontFamily,
          notice: row.querySelector('[data-font-compare-notice]').textContent.trim(),
        }));
        return {
          left: left.value,
          right: right.value,
          groupLabels: [...left.querySelectorAll('optgroup')].map(group => group.label),
          rows,
        };
      });
      assert.equal(compareDefaults.left, 'editorial-preview');
      assert.equal(compareDefaults.right, 'mono-preview');
      assert.deepEqual(compareDefaults.groupLabels, [
        'Zentropy Editorial · Original preview',
        'Zentropy Mono · Original preview',
        'Existing site fonts · not original fonts for sale',
      ]);
      assert.deepEqual(compareDefaults.rows.map(row => row.familyState), ['editorial-preview', 'mono-preview']);
      assert(compareDefaults.rows.every(row => row.text === resetProof.text),
        `${theme}/${width}: compare rows inherit the current specimen text`);
      assert(compareDefaults.rows.every(row => /original preview/i.test(row.context) && /not for sale/i.test(row.context)),
        `${theme}/${width}: original compare rows need explicit preview boundaries`);

      const sampleControls = await page.evaluate(() =>
        [...document.querySelectorAll('[data-font-sample]')].map(button => ({
          key: button.dataset.fontSample,
          label: button.textContent.trim(),
          type: button.getAttribute('type'),
          sample: button.dataset.fontSampleText,
        }))
      );
      assert.deepEqual(sampleControls.map(control => control.key), ['headline', 'reading', 'characters']);
      assert.deepEqual(sampleControls.map(control => control.label), ['Headline', 'Reading', 'Characters']);
      assert(sampleControls.every(control => control.type === 'button'), `${theme}/${width}: sample controls must not submit the form`);
      assert(sampleControls.every(control => Array.from(control.sample).length <= 260),
        `${theme}/${width}: sample presets must fit the textarea limit`);

      await page.locator('#font-specimen-size').evaluate(input => {
        input.value = '62';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-line').evaluate(input => {
        input.value = '1.55';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-track').evaluate(input => {
        input.value = '0.08';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.fill('#font-specimen-text', 'Café 中');
      await page.waitForFunction(() => !document.querySelector('[data-font-coverage-warning]')?.hidden);
      await page.click('[data-font-sample="characters"]');
      await page.waitForFunction(() => document.querySelector('[data-font-specimen-preview]')?.textContent.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
      const sampleProof = await page.evaluate(() => {
        const main = document.querySelector('[data-font-specimen-preview]');
        const warning = document.querySelector('[data-font-coverage-warning]');
        return {
          text: document.querySelector('#font-specimen-text').value,
          family: document.querySelector('#font-specimen-family').value,
          preview: main.textContent,
          mainFamily: main.dataset.fontFamily,
          size: document.querySelector('#font-specimen-size').value,
          line: document.querySelector('#font-specimen-line').value,
          track: document.querySelector('#font-specimen-track').value,
          compareTexts: [...document.querySelectorAll('[data-font-compare-preview]')].map(node => node.textContent),
          compareSizes: [...document.querySelectorAll('[data-font-compare-preview]')].map(node => node.style.fontSize),
          warningHidden: warning.hidden,
          posterDisabled: document.querySelector('[data-font-specimen-poster]').disabled,
          cssDisabled: document.querySelector('[data-font-specimen-css]').disabled,
          network: window.__fontSpecimenNetwork,
        };
      });
      assert.match(sampleProof.text, /^ABCDEFGHIJKLMNOPQRSTUVWXYZ /);
      assert.equal(sampleProof.preview, sampleProof.text, `${theme}/${width}: sample button updates the main preview text`);
      assert.deepEqual(sampleProof.compareTexts, [sampleProof.text, sampleProof.text],
        `${theme}/${width}: sample button updates open comparison previews`);
      assert.equal(sampleProof.family, 'editorial-preview', `${theme}/${width}: sample button must preserve selected family`);
      assert.equal(sampleProof.mainFamily, 'editorial-preview');
      assert.equal(sampleProof.size, '62');
      assert.equal(sampleProof.line, '1.55');
      assert.equal(sampleProof.track, '0.08');
      assert.deepEqual(sampleProof.compareSizes, ['62px', '62px']);
      assert.equal(sampleProof.warningHidden, true, `${theme}/${width}: sample button must refresh coverage state`);
      assert.equal(sampleProof.posterDisabled, true, `${theme}/${width}: sample button must not enable Poster for originals`);
      assert.equal(sampleProof.cssDisabled, true, `${theme}/${width}: sample button must not enable CSS export for originals`);
      assert.deepEqual(sampleProof.network, [], `${theme}/${width}: sample buttons must not send visitor text`);

      const compareText = 'Café 中 i\u030A';
      await page.fill('#font-specimen-text', compareText);
      await page.locator('#font-specimen-size').evaluate(input => {
        input.value = '52';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-line').evaluate(input => {
        input.value = '1.35';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#font-specimen-track').evaluate(input => {
        input.value = '-0.02';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(value =>
        [...document.querySelectorAll('[data-font-compare-preview]')].every(node => node.textContent === value),
        compareText);
      const compareUpdated = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-font-compare-slot]')].map(row => {
          const preview = row.querySelector('[data-font-compare-preview]');
          return {
            slot: row.dataset.fontCompareSlot,
            familyState: preview.dataset.fontFamily,
            text: preview.textContent,
            fontSize: preview.style.fontSize,
            lineHeight: preview.style.lineHeight,
            letterSpacing: preview.style.letterSpacing,
            notice: row.querySelector('[data-font-compare-notice]').textContent.trim(),
          };
        });
        const boxes = rows.map(row => document.querySelector(`[data-font-compare-slot="${row.slot}"]`).getBoundingClientRect());
        return {
          rows,
          sideBySide: boxes[1].x >= boxes[0].x + boxes[0].width,
          stacked: boxes[1].y >= boxes[0].y + boxes[0].height,
          network: window.__fontSpecimenNetwork,
        };
      });
      assert(compareUpdated.rows.every(row =>
        row.text === compareText && row.fontSize === '52px' && row.lineHeight === '1.35' && row.letterSpacing === '-0.02em'),
        `${theme}/${width}: shared specimen controls must drive both compare rows`);
      assert.match(compareUpdated.rows[0].notice, /Unsupported in this preview: .*é.*中/s);
      assert.match(compareUpdated.rows[1].notice, /Unsupported in this preview: .*中/s);
      assert.doesNotMatch(compareUpdated.rows[1].notice, /é/);
      if (width >= 1000) {
        assert.equal(compareUpdated.sideBySide, true, `${theme}/${width}: compare rows should sit side by side`);
      } else {
        assert.equal(compareUpdated.stacked, true, `${theme}/${width}: compare rows should stack on mobile`);
      }
      assert.deepEqual(compareUpdated.network, [], `${theme}/${width}: compare updates must not send visitor text`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${artifactDir}/compare-${theme}-${width}.png`, fullPage: true });

      await page.selectOption('[data-font-compare-family="left"]', 'hanken');
      await page.selectOption('[data-font-compare-family="right"]', 'conso');
      const siteCompare = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-font-compare-slot]')].map(row => ({
          familyState: row.querySelector('[data-font-compare-preview]').dataset.fontFamily,
          context: row.querySelector('[data-font-compare-context]').textContent.trim(),
          notice: row.querySelector('[data-font-compare-notice]').textContent.trim(),
        }));
        return {
          mainFamily: document.querySelector('#font-specimen-family').value,
          rows,
          network: window.__fontSpecimenNetwork,
        };
      });
      assert.equal(siteCompare.mainFamily, 'editorial-preview', `${theme}/${width}: compare selectors must not change the primary specimen face`);
      assert.deepEqual(siteCompare.rows.map(row => row.familyState), ['hanken', 'conso']);
      assert(siteCompare.rows.every(row => /Existing site font/i.test(row.context) && /not an original font for sale/i.test(row.context)));
      assert(siteCompare.rows.every(row => /not sold here/i.test(row.notice)));
      assert.deepEqual(siteCompare.network, [], `${theme}/${width}: compare selectors must not send visitor text`);

      await page.click('[data-font-specimen-reset]');
      const compareReset = await page.evaluate(() => ({
        visible: !document.querySelector('[data-font-compare]').hidden,
        expanded: document.querySelector('[data-font-compare-toggle]').getAttribute('aria-expanded'),
        left: document.querySelector('[data-font-compare-family="left"]').value,
        right: document.querySelector('[data-font-compare-family="right"]').value,
        texts: [...document.querySelectorAll('[data-font-compare-preview]')].map(node => node.textContent),
        size: document.querySelector('[data-font-compare-preview]').style.fontSize,
      }));
      assert.equal(compareReset.visible, true, `${theme}/${width}: reset should keep the optional compare panel open`);
      assert.equal(compareReset.expanded, 'true');
      assert.equal(compareReset.left, 'editorial-preview');
      assert.equal(compareReset.right, 'mono-preview');
      assert.deepEqual(compareReset.texts, [DEFAULT_TEXT, DEFAULT_TEXT]);
      assert.equal(compareReset.size, '40px');
      await page.click('[data-font-compare-toggle]');
      assert.equal(await page.locator('[data-font-compare]').isVisible(), false,
        `${theme}/${width}: compare toggle closes the optional panel`);
      assert.equal(await page.locator('[data-font-compare-toggle]').getAttribute('aria-expanded'), 'false');

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

    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1265, height: 712 }, colorScheme: theme });
      const page = await context.newPage();
      await page.goto(`${base}/fonts.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-font-specimen-controls]:not([hidden])');
      await page.click('[data-font-compare-toggle]');
      await page.waitForSelector('[data-font-compare]:not([hidden])');
      await page.selectOption('[data-font-compare-family="left"]', 'editorial-preview');
      await page.locator('[data-font-compare-family="left"]').scrollIntoViewIfNeeded();

      const overlapProof = await page.evaluate(() => {
        const live = document.querySelector('[data-font-specimen-live]').getBoundingClientRect();
        const compareTargets = [
          document.querySelector('#font-compare-title'),
          document.querySelector('[data-font-compare-family="left"]'),
          document.querySelector('[data-font-compare-family="right"]'),
        ].map(node => {
          const rect = node.getBoundingClientRect();
          const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          const topElement = document.elementFromPoint(center.x, center.y);
          return {
            label: node.id || node.dataset.fontCompareFamily,
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
            intersectsLive: !(rect.right <= live.left || rect.left >= live.right || rect.bottom <= live.top || rect.top >= live.bottom),
            hitTargetOwnsPoint: node === topElement || node.contains(topElement),
            topElement: topElement?.tagName || null,
          };
        });
        return { live: { left: live.left, right: live.right, top: live.top, bottom: live.bottom }, compareTargets };
      });
      assert.deepEqual(overlapProof.compareTargets.filter(target => target.intersectsLive), [],
        `${theme}/1265x712: sticky primary preview must not intersect compare controls/headings: ${JSON.stringify(overlapProof)}`);
      assert.deepEqual(overlapProof.compareTargets.filter(target => !target.hitTargetOwnsPoint), [],
        `${theme}/1265x712: compare controls must remain topmost hit targets: ${JSON.stringify(overlapProof)}`);
      await page.screenshot({ path: `${artifactDir}/compare-scrolled-${theme}-1265x712.png`, fullPage: false });
      await context.close();
    }

    const broken = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await broken.route('**/type/preview/*.woff2*', route => route.abort());
    const failed = await broken.newPage();
    await failed.goto(`${base}/fonts.html`);
    for (const id of ['editorial-preview', 'mono-preview']) {
      const assetStatus = failed.locator(`[data-font-asset-status="${id}"]`);
      await assetStatus.waitFor({ state: 'visible' });
      assert.match(await assetStatus.textContent(), /could not|unavailable|failed|unable/i,
        `${id}: collection reports load failure before the sampler selection changes`);
    }
    await failed.waitForSelector('[data-font-specimen-controls]:not([hidden])');
    await failed.click('[data-font-compare-toggle]');
    await failed.waitForSelector('[data-font-compare]:not([hidden])');
    for (const slot of ['left', 'right']) {
      const notice = failed.locator(`[data-font-compare-slot="${slot}"] [data-font-compare-notice]`);
      await notice.waitFor({ state: 'visible' });
      assert.match(await notice.textContent(), /could not load|fallback text/i,
        `${slot}: compare row reports preview load failure instead of impersonating the original`);
    }
    await broken.close();

    console.log('Fonts marketplace: no-JS, preview collection, live specimen controls, unsupported-character warning, no checkout, 320/1280 reflow and both themes passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
