// Dev helper: draw two crossing creases and screenshot the subdivided result.
// Usage: node scripts/inspect-crossing.mjs <outdir>
import { chromium } from "@playwright/test";

const outdir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
const hint = page.getByTestId("onboarding-hint");
if (await hint.isVisible().catch(() => false)) {
  await hint.getByRole("button", { name: "Dismiss hint" }).click();
}

await page.getByTestId("menu-file").click();
await page.getByTestId("menu-new").click();
const box = await page.getByTestId("editor-canvas").boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

await page.getByTestId("tool-crease").click();
await page.mouse.click(cx - 160, cy - 40);
await page.mouse.click(cx + 160, cy + 40);
await page.keyboard.press("Escape");
await page.mouse.click(cx - 120, cy + 110);
await page.mouse.click(cx + 120, cy - 110);
await page.keyboard.press("Escape");

// Select the junction vertex (canvas center-ish) to show its analysis.
await page.getByTestId("tool-select").click();
const counts = await page.getByTestId("status-counts").textContent();
console.log("counts:", counts);
const junction = page.locator("[data-vertex-id] circle");
// click the middle vertex: find the one nearest canvas center
const boxes = await page.locator("[data-vertex-id]").all();
let best = null;
for (const g of boxes) {
  const b = await g.boundingBox();
  const d = Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy);
  if (!best || d < best.d) best = { d, x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
void junction;
await page.mouse.click(best.x, best.y);
await page.waitForTimeout(400);
await page.screenshot({ path: `${outdir}/state-crossing-subdivided.png` });
await browser.close();
