// Dev helper: open the fold preview and capture frames of the fold.
// Usage: node scripts/inspect-fold.mjs <outdir>
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

await page.getByTestId("menu-fold").click();
await page.getByTestId("fold-preview").waitFor();
// Pause autoplay for deterministic frames.
const playButton = page.getByTestId("fold-play");
if ((await playButton.textContent())?.includes("Pause")) await playButton.click();

const setFold = async (value) => {
  const slider = page.getByTestId("fold-slider");
  const box = await slider.boundingBox();
  await page.mouse.click(box.x + box.width * value, box.y + box.height / 2);
  await page.waitForTimeout(250);
};

await page.getByTestId("fold-flat").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${outdir}/fold-00.png` });
await setFold(0.35);
await page.screenshot({ path: `${outdir}/fold-35.png` });
await setFold(0.7);
await page.screenshot({ path: `${outdir}/fold-70.png` });
await page.getByTestId("fold-folded").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${outdir}/fold-100.png` });
await page.getByTestId("fold-topview").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${outdir}/fold-100-top.png` });

console.log("faces:", await page.getByTestId("fold-face").count());
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
