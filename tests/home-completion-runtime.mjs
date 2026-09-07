import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.HOME_BASE || "http://127.0.0.1:8787/";
const label = process.env.HOME_CHECK_LABEL || "home-runtime";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(root, ".superpowers", "home-completion-artifacts", label);
fs.mkdirSync(artifactDir, { recursive: true });

const configs = [
  { name: "mobile-light", width: 375, height: 900, colorScheme: "light" },
  { name: "mobile-dark", width: 375, height: 900, colorScheme: "dark" },
  { name: "desktop-light", width: 1280, height: 900, colorScheme: "light" },
  { name: "desktop-dark", width: 1280, height: 900, colorScheme: "dark" },
];

const requiredRoutes = [
  "/flywheel.html",
  "/career/Flywheel-Platform-Brief.pdf",
  "/bulletin.html",
  "/join.html",
  "/systems/bulletin.html",
  "/retro.html",
  "/engine-revival.html",
  "/security.html",
  "/private-practice.html",
  "/publications.html",
  "/hire.html",
];

const expectedFigureAccess = [
  { title: "164-task model pass@1 comparison", href: "/analytics/model-pass-at-1-comparison.html" },
  { title: "Current cross-harness run", href: "/analytics/current-cross-harness-pilot.html" },
  { title: "Recovered actions by day", href: "/figures/recovered-actions-by-day.html" },
  { title: "Reported motive labels", href: "/figures/motive-sample-nonexclusive.html" },
];

function failIf(condition, failures, message, detail = undefined) {
  if (!condition) return;
  failures.push(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
const failures = [];

try {
  for (const config of configs) {
    const page = await browser.newPage({
      viewport: { width: config.width, height: config.height },
      colorScheme: config.colorScheme,
      reducedMotion: "reduce",
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(artifactDir, `${config.name}.png`), fullPage: true });

    const snapshot = await page.evaluate(({ routes, figures }) => {
      const visible = (element) => {
        if (!element) return false;
        const closedDetails = element.closest("details:not([open])");
        if (closedDetails && !element.closest("summary")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const rgb = (value) => {
        const match = value.match(/[\d.]+/g);
        return match ? match.slice(0, 3).map(Number) : null;
      };
      const luminance = (color) => color
        .map((value) => {
          const v = value / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const contrast = (fg, bg) => {
        const f = rgb(fg);
        const b = rgb(bg);
        if (!f || !b) return 0;
        const a = luminance(f);
        const z = luminance(b);
        return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
      };
      const opaqueBackground = (element) => {
        for (let current = element; current; current = current.parentElement) {
          const background = getComputedStyle(current).backgroundColor;
          if (background !== "rgba(0, 0, 0, 0)") return background;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const measuredText = Array.from(document.querySelectorAll(".hero-line, .section-lead, .does-not-prove, .boundary-note, .btn, .text-link"))
        .filter(visible)
        .slice(0, 24)
        .map((element) => {
          const style = getComputedStyle(element);
          const background = opaqueBackground(element);
          return {
            selector: element.className || element.tagName.toLowerCase(),
            text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48),
            size: Number.parseFloat(style.fontSize),
            foreground: style.color,
            background,
            contrast: Number(contrast(style.color, background).toFixed(2)),
          };
        });
      const visibleCount = (selector) => Array.from(document.querySelectorAll(selector)).filter(visible).length;
      const hrefs = Array.from(document.querySelectorAll("a[href]")).map((link) => link.getAttribute("href") || "");
      const visibleProductStatuses = Array.from(document.querySelectorAll("#products article .product-status"))
        .filter(visible)
        .map((element) => (element.textContent || "").replace(/\s+/g, " ").trim());
      const figureAccess = figures.map((figure) => {
        const card = Array.from(document.querySelectorAll("#evidence-figures article"))
          .find((article) => (article.querySelector("h3")?.textContent || "").trim() === figure.title);
        const links = Array.from(card?.querySelectorAll("a[href]") || [])
          .filter(visible)
          .map((link) => ({
            href: link.getAttribute("href") || "",
            text: (link.textContent || "").replace(/\s+/g, " ").trim(),
            label: link.getAttribute("aria-label") || "",
          }));
        return {
          title: figure.title,
          expectedHref: figure.href,
          cardPresent: Boolean(card),
          imageHref: card?.querySelector("img")?.closest("a[href]")?.getAttribute("href") || "",
          readableLinkCount: links.filter((link) => (
            link.href === figure.href
            && /open .*chart and data table/i.test(`${link.text} ${link.label}`)
          )).length,
          visibleLinks: links,
        };
      });
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        groundFieldMounted: Boolean(document.querySelector(".ground-field")),
        productCount: document.querySelectorAll("#products article").length,
        visibleProductStatuses,
        visibleProductDefinitions: visibleCount("#products article dl"),
        productDisclosureCount: document.querySelectorAll("#products article details").length,
        visibleEvidenceTables: visibleCount("#evidence table"),
        evidenceDisclosureCount: document.querySelectorAll("#evidence details").length,
        visibleFigureFactLists: visibleCount(".figure-facts"),
        figureDisclosureCount: document.querySelectorAll("#evidence-figures details").length,
        visibleHiringActions: visibleCount("#hiring-collaboration .hiring-actions a"),
        hiringDisclosureCount: document.querySelectorAll("#hiring-collaboration details").length,
        footerLinks: visibleCount(".site-footer a"),
        footerDisclosureCount: document.querySelectorAll(".site-footer details").length,
        figureAccess,
        requiredRoutePresence: routes.map((route) => ({ route, present: hrefs.includes(route) })),
        measuredText,
      };
    }, { routes: requiredRoutes, figures: expectedFigureAccess });
    snapshot.config = config.name;
    results.push(snapshot);

    failIf(snapshot.documentOverflow, failures, `${config.name} overflows horizontally`);
    failIf(snapshot.groundFieldMounted, failures, `${config.name} mounts the hidden GroundField`);
    failIf(snapshot.visibleProductStatuses.length < snapshot.productCount, failures, `${config.name} hides release state or maturity before product details`, snapshot.visibleProductStatuses);
    for (const status of snapshot.visibleProductStatuses) {
      failIf(status.length < 6, failures, `${config.name} product visible status is not meaningful`, status);
    }
    failIf(snapshot.visibleProductDefinitions > 0, failures, `${config.name} shows repeated product definition metadata before disclosure`, snapshot.visibleProductDefinitions);
    failIf(snapshot.productDisclosureCount < 5, failures, `${config.name} does not keep product metadata behind per-product details`, snapshot.productDisclosureCount);
    failIf(snapshot.visibleEvidenceTables > 0, failures, `${config.name} shows evidence tables before disclosure`, snapshot.visibleEvidenceTables);
    failIf(snapshot.evidenceDisclosureCount < 1, failures, `${config.name} has no evidence disclosure`);
    failIf(snapshot.visibleFigureFactLists > 0, failures, `${config.name} shows figure fact ledgers before disclosure`, snapshot.visibleFigureFactLists);
    failIf(snapshot.figureDisclosureCount < 1, failures, `${config.name} has no figure metadata disclosure`);
    for (const figure of snapshot.figureAccess) {
      failIf(!figure.cardPresent, failures, `${config.name} missing evidence figure card`, figure.title);
      failIf(figure.imageHref !== figure.expectedHref, failures, `${config.name} evidence figure preview does not link to readable chart and table`, figure);
      failIf(figure.readableLinkCount < 1, failures, `${config.name} evidence figure lacks visible chart and data table link`, figure);
    }
    failIf(snapshot.visibleHiringActions > 4, failures, `${config.name} exposes too many hiring actions at once`, snapshot.visibleHiringActions);
    failIf(snapshot.hiringDisclosureCount < 1, failures, `${config.name} has no hiring route disclosure`);
    failIf(snapshot.footerLinks > 6, failures, `${config.name} exposes too many footer links`, snapshot.footerLinks);
    failIf(snapshot.footerDisclosureCount < 1, failures, `${config.name} has no footer route disclosure`);
    for (const item of snapshot.requiredRoutePresence) {
      failIf(!item.present, failures, `${config.name} lost required route`, item.route);
    }
    for (const item of snapshot.measuredText) {
      const large = item.size >= 24;
      failIf(item.contrast < (large ? 3 : 4.5), failures, `${config.name} low contrast text`, item);
    }
    await page.close();
  }

  const light = results.find((result) => result.config === "mobile-light");
  const dark = results.find((result) => result.config === "mobile-dark");
  failIf(Boolean(light && dark && light.bodyBg === dark.bodyBg), failures, "light and dark preferences resolve to the same body background", { light: light?.bodyBg, dark: dark?.bodyBg });

  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      colorScheme,
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(artifactDir, `noscript-${colorScheme}.png`), fullPage: true });
    const noScript = await page.evaluate((routes) => {
      const main = document.querySelector("#noscript-main");
      const style = main ? getComputedStyle(main) : null;
      const links = Array.from(document.querySelectorAll("#noscript-main a[href]")).map((link) => link.getAttribute("href") || "");
      const text = main?.textContent || "";
      return {
        present: Boolean(main),
        background: style?.backgroundColor || "",
        color: style?.color || "",
        hasProductPath: text.includes("Products to start with") && text.includes("Featured platform: Flywheel"),
        hasLiveBoardPath: text.includes("Live: the agent board") && links.includes("/bulletin.html") && links.includes("/join.html"),
        hasEvidencePath: text.includes("Evidence") && links.includes("/publications.html"),
        requiredRoutePresence: routes.map((route) => ({ route, present: links.includes(route) })),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    }, requiredRoutes.filter((route) => !route.startsWith("/career/")));
    results.push({ config: `noscript-${colorScheme}`, ...noScript });
    failIf(!noScript.present, failures, `noscript-${colorScheme} has no fallback main`);
    failIf(!noScript.hasProductPath, failures, `noscript-${colorScheme} loses product path`);
    failIf(!noScript.hasLiveBoardPath, failures, `noscript-${colorScheme} loses Bulletin path`);
    failIf(!noScript.hasEvidencePath, failures, `noscript-${colorScheme} loses evidence/publications path`);
    failIf(noScript.overflow, failures, `noscript-${colorScheme} overflows horizontally`);
    for (const item of noScript.requiredRoutePresence) {
      failIf(!item.present, failures, `noscript-${colorScheme} lost required route`, item.route);
    }
    await context.close();
  }

  const noScriptLight = results.find((result) => result.config === "noscript-light");
  const noScriptDark = results.find((result) => result.config === "noscript-dark");
  failIf(Boolean(noScriptLight && noScriptDark && noScriptLight.background === noScriptDark.background), failures, "no-JS light and dark preferences resolve to the same fallback background", { light: noScriptLight?.background, dark: noScriptDark?.background });

  fs.writeFileSync(path.join(artifactDir, "results.json"), JSON.stringify({ base, results, failures }, null, 2));
  if (failures.length) {
    console.error(JSON.stringify({ base, failureCount: failures.length, failures, artifactDir }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ base, checked: results.length, failureCount: 0, artifactDir }, null, 2));
  }
} finally {
  await browser.close();
}
