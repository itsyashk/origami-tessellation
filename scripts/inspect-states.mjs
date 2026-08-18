// Dev helper: exercise key interaction states and screenshot each one.
// Usage: node scripts/inspect-states.mjs <outdir>
import { chromium } from "@playwright/test";

const outdir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
const hint = page.getByTestId("onboarding-hint");
if (await hint.isVisible().catch(() => false)) {
  await hint.getByRole("button", { name: "Dismiss hint" }).click();
}

const shot = (name) => page.screenshot({ path: `${outdir}/${name}.png` });
const vertexPos = async (id) => {
  const box = await page.locator(`[data-vertex-id="${id}"] circle`).last().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// 1. Crease selected → inspector with assignment picker
const creaseBox = await page.locator('[data-crease-id="sq_ab"] line').last().boundingBox();
await page.mouse.click(creaseBox.x + creaseBox.width / 2, creaseBox.y + creaseBox.height / 2);
await page.waitForTimeout(400);
await shot("state-crease-selected");

// 2. Vertex selected → math inspector
const a = await vertexPos("sq_a");
await page.mouse.click(a.x, a.y);
await page.waitForTimeout(400);
await shot("state-vertex-selected");

// 3. Mid-drag with Kawasaki badge (drag sq_a away from valid position)
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move(a.x - 70, a.y - 45, { steps: 12 });
await page.waitForTimeout(250);
await shot("state-mid-drag");
await page.mouse.up();
await page.keyboard.press("Control+z");
await page.keyboard.press("Escape");

// 4. Crease tool rubber-band draft with angle snap
await page.getByTestId("tool-crease").click();
const b = await vertexPos("sq_b");
await page.mouse.click(b.x, b.y);
await page.mouse.move(b.x + 150, b.y - 148, { steps: 8 });
await page.waitForTimeout(250);
await shot("state-crease-draft");
await page.keyboard.press("Escape");

// 5. Empty document
await page.getByTestId("menu-file").click();
await page.getByTestId("menu-new").click();
await page.getByTestId("tool-vertex").click();
const canvas = await page.getByTestId("editor-canvas").boundingBox();
await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + canvas.height / 2 - 40);
await page.waitForTimeout(250);
await shot("state-empty-vertex-tool");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
