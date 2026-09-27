import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identPattern, identSource, markIdents, packageNames } from '../scripts/ident-tokens.mjs';

const registry = JSON.parse(readFileSync(new URL('../system/systems.json', import.meta.url), 'utf8'));
const names = packageNames(registry);
const pattern = identPattern(names);
const wrap = (token) => `<span class="ident" translate="no">${token}</span>`;

test('package names come from the registry and each one has a hyphen', () => {
  for (const name of [
    'gather-engine', 'forum-engine', 'flywheel-relay', 'flywheel-verify', 'crucible-bench',
    'flywheel-canon', 'flywheel-mneme', 'articulate-writing', 'index-graph', 'plexus-mesh',
    'chorus-discourse', 'public-surface-sweeper', 'relay-agent', 'canon-memory',
  ]) {
    assert.ok(names.includes(name), name);
  }
  assert.ok(names.every((name) => /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name)));
  assert.ok(!names.includes('emet'), 'a name with no hyphen cannot break and is left out');
});

test('advisory IDs and package names, with a pinned version, are wrapped whole', () => {
  assert.equal(markIdents('<p>Fixed by GHSA-82fg-qprm-q5r7.</p>', pattern), `<p>Fixed by ${wrap('GHSA-82fg-qprm-q5r7')}.</p>`);
  assert.equal(
    markIdents('<code>pip install forum-engine==1.15.1; forum demo</code>', pattern),
    `<code>pip install ${wrap('forum-engine==1.15.1')}; forum demo</code>`,
  );
  assert.equal(
    markIdents('<p>as flywheel-relay, then gather-engine 1.9.1.</p>', pattern),
    `<p>as ${wrap('flywheel-relay')}, then ${wrap('gather-engine')} 1.9.1.</p>`,
  );
  assert.equal(markIdents('<p>GHSA-aaaa-bbbb-cccc GHSA-dddd-eeee-ffff</p>', pattern),
    `<p>${wrap('GHSA-aaaa-bbbb-cccc')} ${wrap('GHSA-dddd-eeee-ffff')}</p>`);
});

test('names inside URLs, paths and longer words are left as they are', () => {
  for (const text of [
    'https://pypi.org/project/gather-engine/1.9.1/',
    'vendor/flywheel-relay/src',
    'my-gather-engine',
    'gather-engine-extra',
    'relay_agent-0.2.0.tar.gz',
    'XGHSA-82fg-qprm-q5r7',
  ]) {
    assert.equal(markIdents(`<p>${text}</p>`, pattern), `<p>${text}</p>`, text);
  }
});

test('tags, attributes, head, script, style, svg, title and textarea are never changed', () => {
  const untouched = [
    '<a href="https://github.com/HarperZ9/relay/security/advisories/GHSA-82fg-qprm-q5r7" aria-label="GHSA-82fg-qprm-q5r7 flywheel-relay">Advisory</a>',
    '<head><title>forum-engine</title><meta content="GHSA-82fg-qprm-q5r7"></head>',
    '<svg><text>flywheel-mneme</text></svg>',
    '<style>/* gather-engine */</style>',
    '<textarea>crucible-bench</textarea>',
  ];
  for (const html of untouched) assert.equal(markIdents(html, pattern), html, html);
});

test('a tag-like string in a script does not end the skip early', () => {
  const html = '<script>const s = "<svg>"; const t = "</p>";</script><p>flywheel-canon</p><script>x("<svg>forum-engine</svg>")</script>';
  assert.equal(
    markIdents(html, pattern),
    `<script>const s = "<svg>"; const t = "</p>";</script><p>${wrap('flywheel-canon')}</p><script>x("<svg>forum-engine</svg>")</script>`,
  );
});

test('pre text is marked, a classed element is not wrapped again, and a second run changes nothing', () => {
  assert.equal(markIdents('<pre>$ pip install index-graph==2.13.0</pre>', pattern), `<pre>$ pip install ${wrap('index-graph==2.13.0')}</pre>`);
  const classed = '<code class="ident" translate="no">gather-engine</code>';
  assert.equal(markIdents(classed, pattern), classed);
  const once = markIdents('<li>flywheel-relay 0.2.5 and GHSA-xxcc-grhg-v9g7</li>', pattern);
  assert.equal(markIdents(once, pattern), once);
});

test('the pattern uses no lookbehind, so older browsers can compile it in the home bundle', () => {
  assert.ok(!identSource(names).includes('(?<'));
  assert.doesNotThrow(() => new RegExp(identSource(names), 'g'));
});
