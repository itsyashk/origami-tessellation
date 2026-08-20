// Dev helper: capture the running app for visual inspection.
// Usage: node scripts/screenshot.mjs <outfile.png> [width] [height]
import { chromium } from "@playwright/test";

const [, , out = "editor.png", w = "1440", h = "900"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
});
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));
await page.addInitScript(() => localStorage.setItem("origami.gallery.seen", "1"));
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
if (errors.length) {
  console.log("CONSOLE ERRORS:");
  for (const e of errors) console.log(" -", e.slice(0, 300));
} else {
  console.log("no console errors");
}
await browser.close();
