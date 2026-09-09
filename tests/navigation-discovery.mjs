import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNav } from '../system/nav.js';

test('shared menu exposes the font routes through the existing route catalog', () => {
  const mount = { innerHTML: '', querySelector() { return null; } };
  renderNav({ location: { pathname: '/catalog.html' }, getElementById() { return mount; } });
  const menu = mount.innerHTML.split('<div class="sn-more-list"')[1];
  assert.ok(menu, 'shared menu renders');
  const hrefs = [...menu.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(hrefs).size, hrefs.length, 'Menu repeats destinations');
  for (const href of ['flywheel.html', 'fonts.html', 'typeface.html', 'publications.html', 'bulletin.html', 'catalog.html']) {
    assert.ok(hrefs.includes(href), `Missing ${href}`);
  }
  assert.equal(hrefs.filter(href => href === 'fonts.html').length, 1, 'Fonts route should appear once');
  assert.equal(hrefs.filter(href => href === 'typeface.html').length, 1, 'Typography route should appear once');
  assert.doesNotMatch(menu, /workspace\.html/, 'Font discovery must not depend on the absent workspace route');
});
