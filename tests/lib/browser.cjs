// Which browser the Studio's tests drive (10 October 2026). BROWSER=firefox runs the same tests in
// Playwright's Firefox; the default is Chromium (with BROWSER_CHANNEL=chrome for installed Chrome).
// Firefox has no mobile emulation in Playwright, so isMobile is dropped there and the phone runs
// are a 390 px wide window with touch; the tests' phone checks are about layout, which holds.
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const name = (process.env.BROWSER || 'chromium').toLowerCase();
const engine = pw[name];
if (!engine) throw new Error('unknown BROWSER ' + name);

function wrap(browser) {
  if (name !== 'firefox') return browser;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = (opts = {}) => { const o = { ...opts }; delete o.isMobile; return newContext(o); };
  const newPage = browser.newPage.bind(browser);
  browser.newPage = (opts = {}) => { const o = { ...opts }; delete o.isMobile; return newPage(o); };
  return browser;
}
module.exports = {
  name,
  async launch(opts = {}) {
    const o = { ...opts };
    if (name !== 'chromium') delete o.channel;
    if (name === 'firefox') o.firefoxUserPrefs = { 'dom.webgpu.enabled': true, ...(o.firefoxUserPrefs || {}) };
    return wrap(await engine.launch(o));
  },
};
