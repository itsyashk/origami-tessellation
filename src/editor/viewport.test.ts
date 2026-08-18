import { describe, expect, it } from "vitest";
import {
  fitToPaper,
  panBy,
  paperToScreen,
  screenToPaper,
  zoomAt,
  type Viewport,
} from "./viewport";

const vp: Viewport = {
  pan: { x: -10, y: -20 },
  zoom: 2,
  width: 800,
  height: 600,
};

describe("viewport transforms", () => {
  it("round-trips paper ↔ screen", () => {
    const p = { x: 37.5, y: 81.25 };
    const back = screenToPaper(vp, paperToScreen(vp, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it("is y-up: increasing paper y decreases screen y", () => {
    const low = paperToScreen(vp, { x: 0, y: 0 });
    const high = paperToScreen(vp, { x: 0, y: 100 });
    expect(high.y).toBeLessThan(low.y);
  });

  it("zoomAt keeps the anchor point fixed on screen", () => {
    const anchor = { x: 333, y: 141 };
    const before = screenToPaper(vp, anchor);
    const zoomed = zoomAt(vp, anchor, 5);
    const after = screenToPaper(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomed.zoom).toBe(5);
  });

  it("zoomAt clamps the zoom range", () => {
    expect(zoomAt(vp, { x: 0, y: 0 }, 1e6).zoom).toBeLessThanOrEqual(40);
    expect(zoomAt(vp, { x: 0, y: 0 }, 1e-6).zoom).toBeGreaterThanOrEqual(0.1);
  });

  it("panBy shifts content with the pointer", () => {
    // Dragging right/down moves the view so the same screen point maps to
    // smaller paper x and larger paper y (y-flip).
    const panned = panBy(vp, { x: 40, y: 30 });
    const probe = { x: 100, y: 100 };
    const before = screenToPaper(vp, probe);
    const after = screenToPaper(panned, probe);
    expect(after.x).toBeCloseTo(before.x - 20, 9);
    expect(after.y).toBeCloseTo(before.y + 15, 9);
  });

  it("fitToPaper centers the sheet with margins", () => {
    const fitted = fitToPaper(1000, 800, 200, 200, 50);
    const center = paperToScreen(fitted, { x: 100, y: 100 });
    expect(center.x).toBeCloseTo(500, 6);
    expect(center.y).toBeCloseTo(400, 6);
    // The paper fits inside the viewport.
    const corner = paperToScreen(fitted, { x: 0, y: 0 });
    expect(corner.x).toBeGreaterThanOrEqual(0);
    expect(corner.y).toBeLessThanOrEqual(800);
  });
});
