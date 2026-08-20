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
    // Skip the first-visit gallery so editor tests start on the canvas.
    await page.addInitScript(() =>
      localStorage.setItem("origami.gallery.seen", "1"),
    );
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

    // Load the single-vertex study from the pattern library.
    await page.getByTestId("menu-patterns").click();
    await page.getByTestId("open-pattern-birds-foot").click();
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

  test("kawasaki snap pulls a drag onto the valid locus", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-patterns").click();
    await page.getByTestId("open-pattern-birds-foot").click();
    await expect(page.getByTestId("status-counts")).toHaveText(
      "5 vertices · 4 creases",
    );

    // Drag the south-east pleat endpoint to a point just off the center
    // vertex's valid locus (the 315° ray, a diagonal — so no axis-alignment
    // snap can preempt the mathematical one). The solver should pull the
    // position onto the locus and label it.
    const start = await vertexCenter(page, "se");
    const east = await vertexCenter(page, "east");
    const center = await vertexCenter(page, "center");
    const zoom = (east.x - center.x) / 100; // screen px per paper unit
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Paper delta (−30, +33): 2.1 units off the diagonal, inside snap range.
    await page.mouse.move(start.x - 30 * zoom, start.y - 33 * zoom, { steps: 8 });
    await expect(page.getByTestId("snap-layer")).toContainText("Kawasaki ✓");
    await page.mouse.up();

    // The snapped drop leaves the center vertex exactly flat-foldable.
    const c = await vertexCenter(page, "center");
    await page.mouse.click(c.x, c.y);
    await expect(page.getByTestId("kawasaki-chip")).toContainText("180°");
  });

  test("drawing across an existing crease subdivides both", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-new").click();
    const box = (await page.getByTestId("editor-canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.getByTestId("tool-crease").click();
    // Horizontal crease…
    await page.mouse.click(cx - 150, cy);
    await page.mouse.click(cx + 150, cy);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 1 creases",
    );
    // …then a vertical one straight across it.
    await page.mouse.click(cx, cy - 120);
    await page.mouse.click(cx, cy + 120);
    await page.keyboard.press("Escape");

    // Both creases split at the crossing: 4 endpoints + 1 junction, 4 halves.
    await expect(page.getByTestId("status-counts")).toHaveText(
      "5 vertices · 4 creases",
    );
  });

  test("dropping a dragged vertex across a crease subdivides at the crossing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-new").click();
    const box = (await page.getByTestId("editor-canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.getByTestId("tool-crease").click();
    // A horizontal crease and a second one parallel above it.
    await page.mouse.click(cx - 150, cy);
    await page.mouse.click(cx + 150, cy);
    await page.keyboard.press("Escape");
    await page.mouse.click(cx - 150, cy - 100);
    await page.mouse.click(cx + 150, cy - 100);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "4 vertices · 2 creases",
    );

    // Drag the upper crease's right endpoint far below the horizontal one,
    // so the two creases cross. On drop, both must split at the crossing.
    await page.getByTestId("tool-select").click();
    await page.mouse.move(cx + 150, cy - 100);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy + 120, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId("status-counts")).toHaveText(
      "5 vertices · 4 creases",
    );

    // One undo reverses the drag AND the subdivision together.
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "4 vertices · 2 creases",
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

  test("fold preview animates the pattern and reaches the folded state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-fold").click();
    await expect(page.getByTestId("fold-preview")).toBeVisible();
    await expect(page.getByTestId("fold-layer-note")).toBeVisible();
    // The simulated mesh renders the square twist's faces as triangles.
    expect(await page.getByTestId("fold-face").count()).toBeGreaterThan(8);

    // Capture the flat geometry, jump to folded, and verify faces moved.
    const allPoints = async () => {
      const attrs = await page
        .getByTestId("fold-face")
        .evaluateAll((els) => els.map((el) => el.getAttribute("points")));
      return attrs.sort().join(" | ");
    };
    await page.getByTestId("fold-flat").click();
    const flat = await allPoints();
    await page.getByTestId("fold-folded").click();
    await expect(page.getByTestId("fold-canvas")).toHaveAttribute(
      "aria-label",
      /100 percent folded/,
    );
    expect(await allPoints()).not.toBe(flat);

    // Top view still renders the whole mesh.
    await page.getByTestId("fold-topview").click();
    expect(await page.getByTestId("fold-face").count()).toBeGreaterThan(8);

    await page.getByTestId("fold-close").click();
    await expect(page.getByTestId("fold-preview")).toBeHidden();
  });

  test("tutorial flow: browse the library and watch a tessellation fold", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-patterns").click();
    await expect(page.getByTestId("pattern-browser")).toBeVisible();

    // Filter down to tessellations and start the Miura-ori tutorial.
    await page.getByTestId("filter-tessellations").click();
    await expect(page.getByTestId("pattern-miura-4x5")).toBeVisible();
    await expect(page.getByTestId("pattern-kite-base")).toBeHidden();
    await page.getByTestId("fold-pattern-miura-4x5").click();

    // The gallery hands off to the fold preview with the pattern loaded.
    await expect(page.getByTestId("pattern-browser")).toBeHidden();
    await expect(page.getByTestId("fold-preview")).toBeVisible();
    expect(await page.getByTestId("fold-face").count()).toBeGreaterThan(10);
    await page.getByTestId("fold-close").click();

    await expect(page.getByTestId("doc-name")).toHaveValue("Miura-ori 5×4");
  });

  test("first visit opens straight into the pattern library", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    // Fresh context: no localStorage, so the gallery greets the user.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/");
    await expect(page.getByTestId("pattern-browser")).toBeVisible();
    await context.close();
  });

  test("dropping a vertex onto another merges them", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-new").click();
    const box = (await page.getByTestId("editor-canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.getByTestId("tool-vertex").click();
    await page.mouse.click(cx - 80, cy);
    await page.mouse.click(cx + 80, cy);
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 0 creases",
    );

    await page.getByTestId("tool-select").click();
    await page.mouse.move(cx - 80, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy, { steps: 12 });
    await expect(page.getByTestId("snap-layer")).toContainText("Merge");
    await page.mouse.up();
    await expect(page.getByTestId("status-counts")).toHaveText(
      "1 vertices · 0 creases",
    );

    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("status-counts")).toHaveText(
      "2 vertices · 0 creases",
    );
  });

  test("marquee selects vertices inside the rubber-band", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);

    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-new").click();
    const canvas = page.getByTestId("editor-canvas");
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.getByTestId("tool-vertex").click();
    await page.mouse.click(cx - 40, cy - 40);
    await page.mouse.click(cx + 40, cy - 40);
    await page.mouse.click(cx, cy + 40);
    await expect(page.getByTestId("status-counts")).toHaveText(
      "3 vertices · 0 creases",
    );

    await page.getByTestId("tool-select").click();
    await page.mouse.move(cx - 90, cy + 90);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy - 90, { steps: 8 });
    await expect(page.getByTestId("marquee-rect")).toBeVisible();
    await page.mouse.up();

    await expect(page.getByTestId("inspector-panel")).toBeVisible();
    await expect(page.getByTestId("inspector-panel")).toContainText("3 vertices selected");
  });

  test("exports a FOLD file", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-iphone", "desktop flow");
    await dismissOnboarding(page);
    await page.getByTestId("menu-file").click();
    const foldDownload = page.waitForEvent("download");
    await page.getByTestId("export-fold").click();
    expect((await foldDownload).suggestedFilename()).toMatch(/\.fold$/);
  });

  test("mobile: editor loads with touch toolbar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-iphone", "mobile only");
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await expect(page.getByTestId("tool-crease-mobile")).toBeVisible();
    // The example is loaded and rendered.
    await expect(page.locator("[data-crease-id]")).toHaveCount(12);
  });
});
