import { describe, expect, it } from "vitest";
import { paperRectFromScreenBox, selectInPaperRect } from "./marquee";
import { squareTwist } from "@/origami/examples";
import type { Viewport } from "./viewport";

describe("selectInPaperRect", () => {
  it("selects vertices inside the rectangle and creases whose both ends are in", () => {
    const doc = squareTwist();
    // Central square occupies [80,120]².
    const hit = selectInPaperRect(doc, { minX: 70, minY: 70, maxX: 130, maxY: 130 });
    expect(hit.vertexIds.sort()).toEqual(["sq_a", "sq_b", "sq_c", "sq_d"]);
    expect(hit.creaseIds.sort()).toEqual(["sq_ab", "sq_bc", "sq_cd", "sq_da"]);
  });

  it("returns empty sets when the rectangle misses everything", () => {
    const hit = selectInPaperRect(squareTwist(), {
      minX: 300,
      minY: 300,
      maxX: 310,
      maxY: 310,
    });
    expect(hit.vertexIds).toEqual([]);
    expect(hit.creaseIds).toEqual([]);
  });
});

describe("paperRectFromScreenBox", () => {
  it("converts a screen box through the y-up viewport into a paper AABB", () => {
    const viewport: Viewport = {
      pan: { x: 0, y: 0 },
      zoom: 2,
      width: 400,
      height: 400,
    };
    // Screen (0,400) is paper (0,0); screen (200,200) is paper (100, 100)
    // because screen.y = height - (paper.y - pan.y)*zoom.
    const rect = paperRectFromScreenBox(
      viewport,
      { x: 0, y: 400 },
      { x: 200, y: 200 },
    );
    expect(rect.minX).toBeCloseTo(0);
    expect(rect.minY).toBeCloseTo(0);
    expect(rect.maxX).toBeCloseTo(100);
    expect(rect.maxY).toBeCloseTo(100);
  });
});
