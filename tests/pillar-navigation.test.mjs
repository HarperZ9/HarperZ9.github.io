import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderNav } from '../system/nav.js';
import { PRIMARY_ROUTES, ROUTE_REGISTRY } from '../system/routes.js';

const siteIndexSource = () => readFileSync(new URL('../site-index.html', import.meta.url), 'utf8');
const sitemapSource = () => readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');

function htmlText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&middot;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function publicSitemapRoutes() {
  return [...sitemapSource().matchAll(/<loc>https:\/\/harperz9\.github\.io\/([^<]*)<\/loc>/g)]
    .map(match => match[1] || 'index.html')
    .map(href => href === 'briefings/' ? 'briefings/index.html' : href)
    .filter(href => ![
      'index.html',
      'site-index.html',
      'orca.html',
    ].includes(href))
    .filter(href => !href.startsWith('frontier-safety/archive/'))
    .filter(href => !href.startsWith('private-practice.html#'));
}

function registryHrefs() {
  return new Set(ROUTE_REGISTRY.families.flatMap(family => family.routes.map(route => route.href)));
}

function indexEntries() {
  const source = siteIndexSource();
  return [...source.matchAll(/<li data-index-entry(?:\s+data-search-text="([^"]*)")?><a href="([^"]+)">([\s\S]*?)<\/a>(?:<p>([\s\S]*?)<\/p>)?<\/li>/g)]
    .map(match => ({
      searchText: htmlText(match[1]),
      href: htmlText(match[2]),
      label: htmlText(match[3]),
      summary: htmlText(match[4]),
    }));
}

function indexMatches(query) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return indexEntries()
    .filter(entry => {
      const text = `${entry.href} ${entry.label} ${entry.summary} ${entry.searchText}`.toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    })
    .map(entry => entry.href);
}

function writeFixture(root, path, source) {
  const fullPath = join(root, path);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, source, 'utf8');
}

function fixtureRoutesModule(registry) {
  return `// Generated fixture.\nexport const ROUTE_REGISTRY_JSON = ${JSON.stringify(JSON.stringify(registry, null, 2))};\nexport const ROUTE_REGISTRY = JSON.parse(ROUTE_REGISTRY_JSON);\n`;
}

function readGeneratedRegistry(root) {
  const source = readFileSync(join(root, 'system', 'routes.js'), 'utf8');
  const encoded = source.match(/ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");/)?.[1];
  assert.ok(encoded, 'generated routes fixture did not contain ROUTE_REGISTRY_JSON');
  return JSON.parse(JSON.parse(encoded));
}

test('everyday menu offers pillars rather than the whole directory', () => {
  const mount = { innerHTML: '', querySelector() { return null; } };
  renderNav({ location: { pathname: '/catalog.html' }, getElementById() { return mount; } });
  const menu = mount.innerHTML.split('<div class="sn-more-list"')[1];
  const hrefs = [...menu.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.length <= 8, `menu exposes ${hrefs.length} destinations`);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(PRIMARY_ROUTES[0].href, 'flywheel.html');
  assert.ok(hrefs.includes('site-index.html'));
});

test('full static index retains every catalogued destination', () => {
  const source = siteIndexSource();
  for (const family of ROUTE_REGISTRY.families) {
    for (const route of family.routes) {
      const encoded = escapeAttribute(route.href);
      assert.ok(source.includes(`href="${encoded}"`), `missing ${route.href}`);
    }
  }
  assert.match(source, /type="search"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /href="flywheel.html"/);
});

test('route registry and full index cover the independent public sitemap inventory', () => {
  const expected = publicSitemapRoutes();
  assert.ok(expected.includes('research-quantum-error-correction.html'));
  assert.ok(expected.includes('analytics/current-cross-harness-pilot.html'));
  assert.ok(expected.includes('systems/bulletin.html'));
  assert.ok(expected.includes('demos/crucible-cleanroom/'));
  assert.ok(!expected.includes('frontier-safety/archive/2026-09-09.html'));
  assert.ok(!expected.includes('orca.html'));
  assert.ok(!expected.includes('private-practice.html#orca'));

  const registry = registryHrefs();
  const missingRegistry = expected.filter(href => !registry.has(href));
  assert.deepEqual(missingRegistry, [], `route registry missing public routes: ${missingRegistry.join(', ')}`);

  const indexed = new Set(indexEntries().map(entry => entry.href));
  const missingIndex = expected.filter(href => !indexed.has(href));
  assert.deepEqual(missingIndex, [], `site index missing public routes: ${missingIndex.join(', ')}`);
});

test('site index search includes reviewed route context beyond labels', () => {
  const entries = indexEntries();
  const mneme = entries.find(entry => entry.href === 'systems/mneme.html');
  assert.ok(mneme, 'Mneme route is missing from the site index');
  assert.match(mneme.searchText, /SQLite memory store/);
  assert.match(mneme.searchText, /recall receipts/);

  assert.ok(indexMatches('memory').includes('systems/mneme.html'));
  for (const href of ['flywheel.html', 'systems/mneme.html', 'emet.html']) {
    assert.ok(indexMatches('receipts').includes(href), `receipts search should include ${href}`);
  }
  assert.ok(indexMatches('quantum').includes('research-quantum-error-correction.html'));
  assert.ok(indexMatches('benchmark').includes('research-hyphal-context-benchmark.html'));
  assert.ok(indexMatches('benchmark').includes('analytics/current-cross-harness-pilot.html'));
  assert.ok(indexMatches('benchmark').includes('analytics/flywheel-benchmark-record.html'));
});

test('route renderer refreshes existing system summaries from canonical system purpose', () => {
  const root = mkdtempSync(join(tmpdir(), 'pillar-route-renderer-'));
  const oldPurpose = 'Old generated Mneme summary should not survive regeneration.';
  const newPurpose = 'Independent review synthetic changed-purpose sentinel with SQLite memory store and recall receipts.';
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'system'), { recursive: true });
    mkdirSync(join(root, 'home', 'src'), { recursive: true });
    mkdirSync(join(root, 'systems'), { recursive: true });
    cpSync(new URL('../scripts/render-route-registry.mjs', import.meta.url), join(root, 'scripts', 'render-route-registry.mjs'));
    cpSync(new URL('../scripts/render-site-index.mjs', import.meta.url), join(root, 'scripts', 'render-site-index.mjs'));
    writeFixture(root, 'system/routes.js', fixtureRoutesModule({
      families: [
        { label: 'Work', routes: [{ label: 'Work', href: 'hire.html' }] },
        {
          label: 'Systems',
          routes: [
            { label: 'Systems', href: 'overview.html' },
            { label: 'Catalog', href: 'catalog.html' },
            { label: 'Index', href: 'index-graph.html' },
            { label: 'Mneme', href: 'systems/mneme.html', summary: oldPurpose },
          ],
        },
        { label: 'Security', routes: [] },
        { label: 'Research', routes: [] },
        {
          label: 'Studio',
          routes: [
            { label: 'Elder ENB', href: 'elder-enb.html' },
            { label: 'Truth ENB', href: 'truth-enb.html' },
            { label: 'RAW', href: 'raw.html' },
            { label: 'Typography', href: 'typeface.html' },
          ],
        },
      ],
      externalActions: [],
    }));
    writeFixture(root, 'system/systems.json', JSON.stringify({
      domains: [
        { id: 'agent-systems', label: 'Agent systems' },
        { id: 'evaluation-verification', label: 'Evaluation and verification' },
        { id: 'graphics-media', label: 'Graphics and media' },
      ],
      systems: [
        {
          id: 'mneme',
          name: 'Mneme',
          href: 'systems/mneme.html',
          primaryDomain: 'agent-systems',
          domains: ['agent-systems', 'evaluation-verification'],
          maturity: 'active',
          purpose: newPurpose,
          useCases: ['memory retrieval'],
          productType: 'SQLite memory store',
          releaseState: 'active',
        },
        {
          id: 'raw',
          name: 'RAW',
          href: 'raw.html',
          primaryDomain: 'graphics-media',
          domains: ['graphics-media'],
          maturity: 'active',
          purpose: 'RAW fixture purpose.',
          useCases: ['graphics bridge inspection'],
          productType: 'renderer',
          releaseState: 'active',
        },
      ],
    }));
    writeFixture(root, 'sitemap.xml', '<urlset><url><loc>https://harperz9.github.io/systems/mneme.html</loc></url></urlset>');
    writeFixture(root, 'systems/mneme.html', '<!doctype html><title>Mneme</title><h1>Mneme</h1>');
    writeFixture(root, 'raw.html', '<!doctype html><title>RAW</title><h1>RAW</h1>');

    execFileSync(process.execPath, [join(root, 'scripts', 'render-route-registry.mjs')], { cwd: root, stdio: 'pipe' });

    const registry = readGeneratedRegistry(root);
    const mneme = registry.families.flatMap(family => family.routes).find(route => route.href === 'systems/mneme.html');
    assert.equal(mneme.summary, newPurpose);
    assert.doesNotMatch(mneme.summary, /Old generated Mneme summary/);
    const renderedIndex = readFileSync(join(root, 'site-index.html'), 'utf8');
    assert.match(renderedIndex, /Independent review synthetic changed-purpose sentinel/);
    assert.doesNotMatch(renderedIndex, /Old generated Mneme summary/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
