import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end tests of the full editing loop:
 * draw → analyze → feedback → snap → undo/redo → export.
 */

const dismissOnboarding = async (page: Page) => {
  const hint = page.getByTestId("onboarding-hint");
  if (await hint.isVisible().catch(() => false)) {
    await hint.getByRole("button", { name: "Dismiss hint" }).click();
    await expect(hint).toBeHidden();
  }
};

const vertexCenter = async (page: Page, vertexId: string) => {
  const el = page.locator(`[data-vertex-id="${vertexId}"] circle`).last();
  const box = await el.boundingBox();
  if (!box) throw new Error(`Vertex ${vertexId} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe("editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
  });

  test("opens into the square twist example with live analysis", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "12 vertices · 12 creases",
    );
    await expect(page.getByTestId("analysis-flat-foldable")).toContainText(
      "4/4 flat-foldable",
    );
    // Mountains and valleys are visually distinct layers.
    await expect(page.locator("[data-crease-id]")).toHaveCount(12);
  });

  test("full loop: draw, analyze, drag, undo, redo, export", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    // Start from a blank sheet.
    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-new").click();
    await expect(page.getByTestId("status-counts")).toHaveText(
      "0 vertices · 0 creases",
    );

    // Place two vertices with the vertex tool.
    await page.getByTestId("tool-vertex").click();
    const canvas = page.getByTestId("editor-canvas");
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx - 120, cy);
    await page.mouse.click(cx + 120, cy);
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 0 creases",
    );

    // Connect them with the crease tool (click-click).
    await page.getByTestId("tool-crease").click();
    await page.mouse.click(cx - 120, cy);
    await page.mouse.click(cx + 120, cy);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 1 creases",
    );

    // Select the crease and assign it as mountain via the inspector.
    await page.getByTestId("tool-select").click();
    await page.mouse.click(cx, cy);
    await expect(page.getByTestId("inspector-panel")).toBeVisible();
    await page.getByTestId("assign-mountain").click();
    await expect(page.getByTestId("assign-mountain")).toHaveAttribute(
      "data-active",
      "true",
    );

    // Drag a vertex and watch the position change live.
    const before = await page.getByTestId("status-counts").textContent();
    await page.mouse.move(cx - 120, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 60, cy - 80, { steps: 8 });
    await page.mouse.up();
    expect(before).toBe(await page.getByTestId("status-counts").textContent());

    // Undo the drag, the assignment, the crease, and both vertices.
    for (let i = 0; i < 5; i++) await page.keyboard.press("Control+z");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "0 vertices · 0 creases",
    );
    // Redo everything.
    for (let i = 0; i < 5; i++) await page.keyboard.press("Control+Shift+Z");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 1 creases",
    );

    // Export JSON and SVG.
    await page.getByTestId("menu-file").click();
    const jsonDownload = page.waitForEvent("download");
    await page.getByTestId("export-json").click();
    expect((await jsonDownload).suggestedFilename()).toMatch(/\.origami\.json$/);

    const svgDownload = page.waitForEvent("download");
    await page.getByTestId("export-primary").click();
    expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);
  });

  test("live Kawasaki feedback while dragging", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    // Load the single-vertex study.
    await page.getByTestId("menu-examples").click();
    await page.getByTestId("example-single-vertex").click();
    await expect(page.getByTestId("status-counts")).toHaveText(
      "5 vertices · 4 creases",
    );
    await expect(page.getByTestId("analysis-flat-foldable")).toContainText(
      "1/1 flat-foldable",
    );

    // Drag the east ray endpoint far off its valid angle.
    const start = await vertexCenter(page, "east");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 40, start.y - 90, { steps: 10 });

    // Mid-drag: the center vertex now shows a Kawasaki badge.
    await expect(page.getByTestId("analysis-badges")).toContainText("Kawasaki");
    await page.mouse.up();

    // The summary now reports broken vertices. (The dragged endpoint left
    // the paper edge, so it also became an interior vertex — don't pin the
    // exact denominator, just that nothing is valid and fixes are needed.)
    await expect(page.getByTestId("analysis-flat-foldable")).toContainText(
      /^0\/\d flat-foldable$/,
    );
    await expect(page.getByTestId("analysis-invalid")).toBeVisible();

    // Select the center vertex: the inspector explains the failure.
    const center = await vertexCenter(page, "center");
    await page.mouse.click(center.x, center.y);
    await expect(page.getByTestId("kawasaki-chip")).toContainText("off");

    // Undo restores validity.
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("analysis-flat-foldable")).toContainText(
      "1/1 flat-foldable",
    );
  });

  test("repeat tiles the pattern into a grid", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-repeat").click();
    await page.getByTestId("repeat-apply").click();
    // 2×2 square twists: 48 creases; shared boundary vertices merge.
    await expect(page.getByTestId("status-counts")).toContainText("48 creases");
  });

  test("mobile: editor loads with touch toolbar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-iphone", "mobile only");
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await expect(page.getByTestId("tool-crease-mobile")).toBeVisible();
    // The example is loaded and rendered.
    await expect(page.locator("[data-crease-id]")).toHaveCount(12);
  });
});
