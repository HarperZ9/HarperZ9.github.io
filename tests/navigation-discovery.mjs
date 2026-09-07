import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNav } from '../system/nav.js';

test('shared menu is a short directory, not a repeated route catalog', () => {
  const mount = { innerHTML: '', querySelector() { return null; } };
  renderNav({ location: { pathname: '/catalog.html' }, getElementById() { return mount; } });
  const menu = mount.innerHTML.split('<div class="sn-more-list"')[1];
  const hrefs = [...menu.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(hrefs.length <= 18, `Menu has ${hrefs.length} links`);
  assert.equal(new Set(hrefs).size, hrefs.length, 'Menu repeats destinations');
  for (const href of ['flywheel.html', 'fonts.html', 'publications.html', 'bulletin.html', 'catalog.html', 'index.html#site-index']) {
    assert.ok(hrefs.includes(href), `Missing ${href}`);
  }
});
