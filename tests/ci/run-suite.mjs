// Runs one browser suite from tests/ci/suites.json: starts the suite's static server, waits until it answers,
// runs each test file in turn, and prints how long each took.
//
//   node tests/ci/run-suite.mjs studio-chromium              the whole suite
//   node tests/ci/run-suite.mjs studio-chromium --shard 2/4  the second of four shares
//   node tests/ci/run-suite.mjs --plan studio-chromium 4     print the shares and stop
//   node tests/ci/run-suite.mjs --check                      every tests/*.cjs is in a suite or named in notInCi
//
// A share is fixed by the recorded seconds in the manifest (longest first, each to the lightest share), so the shares
// of a suite together hold every test of the suite exactly once, whatever the count. A test that fails does not stop
// the rest; the run fails at the end and names each one. Tests in a suite's reportOnly list are run and reported, and
// do not fail the run (the Firefox suite's WebGL sources on Linux, as before). There is no retry.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/ci/suites.json'), 'utf8'));
const DEFAULT_SECS = 60;
const SERVERS = { stock: (port) => ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], lib: (port) => ['tests/lib/serve.py', String(port), '.'], tools: (port) => ['tools/serve.py', '--port', String(port)] };

const label = (t) => path.basename(t.file).replace(/\.(cjs|mjs)$/, '') + (t.args.length ? ' ' + t.args.join(' ') : '');
function testsOf(name) {
  const suite = MANIFEST.suites[name];
  if (!suite) throw new Error(`no suite named ${name}; the manifest has ${Object.keys(MANIFEST.suites).join(', ')}`);
  let rows = (suite.tests || []).map(([file, secs, ...args]) => ({ file, secs, args }));
  if (suite.select) {   // every file that matches, so a new test joins the suite without an edit here
    const { dir, pattern, contains } = suite.select, known = suite.secs || {};
    rows = fs.readdirSync(path.join(ROOT, dir)).filter((f) => new RegExp(pattern).test(f)).sort().map((f) => `${dir}/${f}`)
      .filter((f) => !contains || fs.readFileSync(path.join(ROOT, f), 'utf8').includes(contains))
      .map((file) => ({ file, secs: known[path.basename(file).replace(/\.cjs$/, '')] ?? DEFAULT_SECS, args: [] }));
  }
  for (const t of rows) if (!fs.existsSync(path.join(ROOT, t.file))) throw new Error(`${name}: ${t.file} is in the manifest and not in the repository`);
  return { suite, rows };
}
function shares(rows, count) {
  const bins = Array.from({ length: count }, () => ({ secs: 0, rows: [] }));
  for (const t of [...rows].sort((a, b) => b.secs - a.secs || a.file.localeCompare(b.file))) { const bin = bins.reduce((a, b) => (b.secs < a.secs ? b : a)); bin.rows.push(t); bin.secs += t.secs; }
  return bins;
}
function check() {
  const listed = new Set(Object.keys(MANIFEST.suites).flatMap((n) => testsOf(n).rows.map((t) => t.file))), spare = new Set(MANIFEST.notInCi.files);
  const all = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.cjs')).map((f) => `tests/${f}`);
  const lost = all.filter((f) => !listed.has(f) && !spare.has(f)), both = all.filter((f) => listed.has(f) && spare.has(f)), gone = [...spare].filter((f) => !all.includes(f));
  for (const f of lost) console.error(`${f} is in no suite: add it to tests/ci/suites.json, or to notInCi with the reason`);
  for (const f of both) console.error(`${f} is in a suite and in notInCi`);
  for (const f of gone) console.error(`${f} is in notInCi and not in the repository`);
  if (lost.length || both.length || gone.length) process.exit(1);
  console.log(`suites: ${listed.size} browser tests in ${Object.keys(MANIFEST.suites).length} suites, ${spare.size} named as not in CI, none unlisted`);
}
const answers = (port) => new Promise((done) => { const req = http.get({ host: '127.0.0.1', port, path: '/robots.txt', timeout: 2000 }, (res) => { res.resume(); done(res.statusCode === 200); }); req.on('error', () => done(false)); req.on('timeout', () => { req.destroy(); done(false); }); });
async function serve(suite, log) {
  const out = fs.openSync(log, 'w'), child = spawn(process.env.PYTHON || 'python', SERVERS[suite.server](suite.port), { cwd: ROOT, stdio: ['ignore', out, out] });
  let dead = null; child.on('exit', (code) => { dead = code ?? 'a signal'; }); child.on('error', (e) => { dead = e.message; });
  for (const end = Date.now() + 30000; Date.now() < end;) {
    if (dead !== null) throw new Error(`the ${suite.server} server on port ${suite.port} stopped (${dead}); its log is ${log}`);
    if (await answers(suite.port)) return child;
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill(); throw new Error(`the ${suite.server} server on port ${suite.port} did not answer within 30 s`);
}
const runOne = (t, env) => new Promise((done) => { const at = Date.now(), child = spawn(process.execPath, [t.file, ...t.args], { cwd: ROOT, env, stdio: 'inherit' });
  child.on('exit', (code, signal) => done({ code: code ?? 1, signal, secs: (Date.now() - at) / 1000 })); child.on('error', (e) => { console.error(e); done({ code: 1, secs: (Date.now() - at) / 1000 }); }); });

function report(name, shard, rows, total, planned) {
  const lines = rows.map((r) => `| ${r.label} | ${r.secs.toFixed(0)} | ${r.planned} | ${r.result} |`);
  const table = [`### ${name}${shard ? ` (share ${shard})` : ''}: ${total.toFixed(0)} s, ${planned} s recorded`, '', '| test | seconds | recorded | result |', '|---|---:|---:|---|', ...lines, ''].join('\n');
  console.log('\n' + table);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--check') return check();
  if (argv[0] === '--plan') { const { rows } = testsOf(argv[1]); shares(rows, +argv[2] || 1).forEach((b, i) => console.log(`${i + 1}: ${b.secs} s  ${b.rows.map(label).join(', ')}`)); return; }
  const name = argv[0], at = argv.indexOf('--shard'), shard = at > 0 ? argv[at + 1] : '', { suite, rows } = testsOf(name);
  let mine = rows;
  if (shard) { const [i, n] = shard.split('/').map(Number); if (!(i >= 1 && i <= n)) throw new Error(`--shard takes i/n, got ${shard}`); mine = shares(rows, n)[i - 1].rows; mine = rows.filter((t) => mine.includes(t)); }
  console.log(`${name}${shard ? ` share ${shard}` : ''}: ${mine.map(label).join(', ') || 'nothing'}`);
  const log = path.join(process.env.RUNNER_TEMP || ROOT, `server-${name}.log`), server = await serve(suite, log);
  const env = { ...process.env, SITE_BASE_URL: `http://127.0.0.1:${suite.port}`, ...(suite.env || {}) }, done = [], began = Date.now(), reportOnly = suite.reportOnly || [];
  try {
    for (const t of mine) {
      console.log(`\n== ${label(t)}`);
      const r = await runOne(t, env), ok = r.code === 0, soft = !ok && reportOnly.includes(label(t));
      // slower than half again the recorded time, and by more than half a minute: say so where the summary is read
      const slow = r.secs > 1.5 * t.secs && r.secs > t.secs + 30;
      if (slow) console.log(`::warning title=Slower than recorded::${label(t)} took ${r.secs.toFixed(0)} s; tests/ci/suites.json records ${t.secs} s`);
      done.push({ label: label(t), secs: r.secs, planned: t.secs, ok, soft, result: (ok ? 'pass' : soft ? 'reported only' : `FAIL (exit ${r.signal || r.code})`) + (slow ? ', slow' : '') });
    }
  } finally { server.kill(); }
  report(name, shard, done, (Date.now() - began) / 1000, mine.reduce((s, t) => s + t.secs, 0));
  const soft = done.filter((r) => r.soft), failed = done.filter((r) => !r.ok && !r.soft);
  if (soft.length) console.log(`Reported only: ${soft.map((r) => r.label).join(', ')} (${suite.reportOnlyWhy || 'see the manifest'})`);
  if (failed.length) { console.error(`Failed in ${name}: ${failed.map((r) => r.label).join(', ')}`); try { console.error(`-- last lines of the server log\n${fs.readFileSync(log, 'utf8').split('\n').slice(-30).join('\n')}`); } catch { /* the log is a help, not the result */ } process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
