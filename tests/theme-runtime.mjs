import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const themeRuntimePath = path.join(repoRoot, "system", "theme.js");
const harnessHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Theme runtime harness</title>
</head>
<body>
  <main id="theme-slot"></main>
  <script type="module">
    window.themeStatus = "loading";
    window.themeEvents = [];
    window.themeReady = (async () => {
      const theme = await import("/system/theme.js");
      window.addEventListener("themechange", (event) => {
        window.themeEvents.push(event.detail);
      });
      window.themeApi = theme;
      window.themeSelect = theme.mountThemeControl(document.querySelector("#theme-slot"));
      window.themeStatus = "ready";
    })().catch((error) => {
      window.themeError = error?.stack || error?.message || String(error);
      window.themeStatus = "error";
    });
  </script>
</body>
</html>`;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(`${message}\nactual: ${JSON.stringify(value)}`);
  }
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");

    if (url.pathname === "/" || url.pathname === "/harness.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(harnessHtml);
      return;
    }

    if (url.pathname === "/system/theme.js") {
      try {
        const body = await readFile(themeRuntimePath, "utf8");
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "application/javascript; charset=utf-8",
        });
        response.end(body);
      } catch (error) {
        const status = error?.code === "ENOENT" ? 404 : 500;
        response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
        response.end(`Unable to serve system/theme.js: ${error?.message || error}`);
      }
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function openHarness(page, baseUrl, query = "") {
  const url = `${baseUrl}/harness.html${query}`;
  const response = await page.goto(url);
  assertEqual(response?.status(), 200, "harness page returns HTTP 200");
  assertEqual(page.url(), url, "browser navigates to the isolated theme harness URL");

  await page.waitForFunction(() => window.themeStatus === "ready" || window.themeStatus === "error");
  const loadError = await page.evaluate(() => window.themeError || "");
  if (loadError) {
    throw new Error(`theme runtime failed to load\n${loadError}`);
  }
}

async function readThemeState(page) {
  return page.evaluate(() => ({
    preference: window.themeApi.getThemePreference(),
    resolved: document.documentElement.dataset.theme,
    dataPreference: document.documentElement.dataset.themePreference,
    selectValue: window.themeSelect?.value,
    stored: localStorage.getItem("site-theme"),
  }));
}

async function assertThemeState(page, expected, message) {
  assertDeepEqual(await readThemeState(page), expected, message);
}

async function assertControlMounted(page) {
  const control = await page.evaluate(() => {
    const label = document.querySelector(".theme-control");
    const select = document.querySelector(".theme-control select");
    return {
      hasLabel: label instanceof HTMLLabelElement,
      hasSelect: select instanceof HTMLSelectElement,
      ariaLabel: select?.getAttribute("aria-label"),
      options: Array.from(select?.options || []).map((option) => ({
        value: option.value,
        label: option.textContent,
      })),
      returnedMountedSelect: window.themeSelect === select,
      selectHasThemeLabel: Array.from(select?.labels || []).some((controlLabel) => {
        return controlLabel.classList.contains("theme-control") && controlLabel.textContent.includes("Theme");
      }),
      visible: Boolean(select && select.offsetParent !== null),
    };
  });

  assertTruthy(control.hasLabel, "theme control is a native label");
  assertTruthy(control.hasSelect, "theme control contains a native select");
  assertTruthy(control.selectHasThemeLabel, "theme select is labeled by the .theme-control label");
  assertEqual(control.ariaLabel, "Color theme", "theme select has an accessible label");
  assertDeepEqual(control.options, [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ], "theme select exposes exactly system, light, and dark options");
  assertTruthy(control.returnedMountedSelect, "mountThemeControl returns the mounted native select");
  assertTruthy(control.visible, "theme select is visible in the harness");
}

test("mounts a labeled native select and defaults to the system light theme", async ({ browser, baseUrl }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    const page = await context.newPage();
    await openHarness(page, baseUrl);
    await assertControlMounted(page);
    await assertThemeState(page, {
      preference: "system",
      resolved: "light",
      dataPreference: "system",
      selectValue: "system",
      stored: null,
    }, "system default applies light OS theme without writing localStorage");
  } finally {
    await context.close();
  }
});

test("persists manual choices and falls invalid modes back to system", async ({ browser, baseUrl }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    const page = await context.newPage();
    await openHarness(page, baseUrl);

    await page.evaluate(() => window.themeApi.setThemePreference("dark"));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await assertThemeState(page, {
      preference: "dark",
      resolved: "dark",
      dataPreference: "dark",
      selectValue: "dark",
      stored: "dark",
    }, "manual dark mode updates html data attributes, select state, and localStorage");

    await page.evaluate(() => window.themeApi.setThemePreference("cobalt"));
    await page.waitForFunction(() => document.documentElement.dataset.themePreference === "system");
    await assertThemeState(page, {
      preference: "system",
      resolved: "light",
      dataPreference: "system",
      selectValue: "system",
      stored: "system",
    }, "invalid theme modes fall back to system instead of persisting an unsupported value");
  } finally {
    await context.close();
  }
});

test("tracks OS color-scheme changes while using the system preference", async ({ browser, baseUrl }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    const page = await context.newPage();
    await openHarness(page, baseUrl);
    await assertThemeState(page, {
      preference: "system",
      resolved: "light",
      dataPreference: "system",
      selectValue: "system",
      stored: null,
    }, "system preference starts from the emulated light OS theme");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await assertThemeState(page, {
      preference: "system",
      resolved: "dark",
      dataPreference: "system",
      selectValue: "system",
      stored: null,
    }, "system preference follows OS color-scheme changes");

    await page.evaluate(() => window.themeApi.setThemePreference("light"));
    await page.waitForFunction(() => document.documentElement.dataset.themePreference === "light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => matchMedia("(prefers-color-scheme: light)").matches);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => matchMedia("(prefers-color-scheme: dark)").matches);
    await assertThemeState(page, {
      preference: "light",
      resolved: "light",
      dataPreference: "light",
      selectValue: "light",
      stored: "light",
    }, "manual light preference is not overwritten by a dark OS color scheme");
  } finally {
    await context.close();
  }
});

test("keeps manual theme switching working when localStorage is blocked", async ({ browser, baseUrl }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    await context.addInitScript(() => {
      const blocked = () => {
        throw new DOMException("localStorage is blocked", "SecurityError");
      };
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
    });

    const page = await context.newPage();
    await openHarness(page, baseUrl);
    await assertControlMounted(page);

    await page.evaluate(() => window.themeApi.setThemePreference("dark"));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    const actual = await page.evaluate(() => ({
      preference: window.themeApi.getThemePreference(),
      resolved: document.documentElement.dataset.theme,
      dataPreference: document.documentElement.dataset.themePreference,
      selectValue: window.themeSelect?.value,
      storageErrorName: (() => {
        try {
          localStorage.getItem("site-theme");
          return "";
        } catch (error) {
          return error.name;
        }
      })(),
    }));

    assertDeepEqual(actual, {
      preference: "dark",
      resolved: "dark",
      dataPreference: "dark",
      selectValue: "dark",
      storageErrorName: "SecurityError",
    }, "manual switching updates the current page even when localStorage reads and writes throw");
  } finally {
    await context.close();
  }
});

test("syncs manual preferences across same-origin tabs", async ({ browser, baseUrl }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  try {
    const firstPage = await context.newPage();
    const secondPage = await context.newPage();
    await openHarness(firstPage, baseUrl, "?tab=first");
    await openHarness(secondPage, baseUrl, "?tab=second");

    await firstPage.evaluate(() => window.themeApi.setThemePreference("dark"));
    await secondPage.waitForFunction(() => document.documentElement.dataset.themePreference === "dark");
    await assertThemeState(firstPage, {
      preference: "dark",
      resolved: "dark",
      dataPreference: "dark",
      selectValue: "dark",
      stored: "dark",
    }, "source tab applies its manual dark preference");
    await assertThemeState(secondPage, {
      preference: "dark",
      resolved: "dark",
      dataPreference: "dark",
      selectValue: "dark",
      stored: "dark",
    }, "same-origin tab receives the manual dark preference through storage sync");

    await secondPage.evaluate(() => window.themeApi.setThemePreference("light"));
    await firstPage.waitForFunction(() => document.documentElement.dataset.themePreference === "light");
    await assertThemeState(firstPage, {
      preference: "light",
      resolved: "light",
      dataPreference: "light",
      selectValue: "light",
      stored: "light",
    }, "same-origin sync works in both directions");
  } finally {
    await context.close();
  }
});

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const failures = [];

  try {
    for (const { name, fn } of tests) {
      try {
        await fn({ browser, baseUrl: server.baseUrl });
        console.log(`ok - ${name}`);
      } catch (error) {
        failures.push({ name, error });
        console.error(`not ok - ${name}`);
        console.error(error?.stack || error?.message || error);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }

  if (failures.length > 0) {
    console.error(`${failures.length} theme runtime test(s) failed`);
    process.exitCode = 1;
  } else {
    console.log(`${tests.length} theme runtime tests passed`);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
