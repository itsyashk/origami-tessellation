// Dev helper: screenshot several patterns' folding at 50% and 100%.
// Usage: node scripts/inspect-fold-multi.mjs <outdir> [slug ...]
import { chromium } from "@playwright/test";

const [, , outdir = ".", ...slugArgs] = process.argv;
const slugs = slugArgs.length
  ? slugArgs
  : ["square-twist", "magic-ball-4x6", "fish-base", "accordion-8", "miura-4x5", "waterbomb-base"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem("origami.gallery.seen", "1");
  localStorage.setItem("origami.onboarding.dismissed", "1");
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

for (const slug of slugs) {
  await page.getByTestId("menu-patterns").click();
  await page.getByTestId("pattern-browser").waitFor();
  await page.getByTestId(`fold-pattern-${slug}`).click();
  await page.getByTestId("fold-preview").waitFor();
  // Let the autoplay fold run halfway, capture, then finish and settle.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${outdir}/sim-${slug}-mid.png` });
  await page.getByTestId("fold-folded").click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outdir}/sim-${slug}-end.png` });
  await page.getByTestId("fold-close").click();
}
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
