// Dev helper: mobile-viewport interaction states.
// Usage: node scripts/inspect-mobile.mjs <outdir>
import { chromium, devices } from "@playwright/test";

const outdir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
const hint = page.getByTestId("onboarding-hint");
if (await hint.isVisible().catch(() => false)) {
  await hint.getByRole("button", { name: "Dismiss hint" }).click();
}
await page.screenshot({ path: `${outdir}/mobile-editor.png` });

// Tap a crease → inspector bottom sheet
const crease = await page.locator('[data-crease-id="sq_ab"] line').last().boundingBox();
await page.touchscreen.tap(crease.x + crease.width / 2, crease.y + crease.height / 2);
await page.waitForTimeout(400);
await page.screenshot({ path: `${outdir}/mobile-crease-selected.png` });

await browser.close();
console.log("done");
