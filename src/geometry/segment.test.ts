import { describe, expect, it } from "vitest";
import {
  closestPointOnSegment,
  distanceToSegment,
  pointOnSegment,
  segmentIntersection,
} from "./segment";
import { vec2 } from "./vec2";

describe("closestPointOnSegment", () => {
  it("projects onto the interior", () => {
    const p = closestPointOnSegment(vec2(5, 3), vec2(0, 0), vec2(10, 0));
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0);
  });
  it("clamps to endpoints", () => {
    const p = closestPointOnSegment(vec2(-4, 2), vec2(0, 0), vec2(10, 0));
    expect(p).toEqual({ x: 0, y: 0 });
  });
  it("handles degenerate segments", () => {
    const p = closestPointOnSegment(vec2(3, 3), vec2(1, 1), vec2(1, 1));
    expect(p).toEqual({ x: 1, y: 1 });
  });
});

describe("distanceToSegment", () => {
  it("measures perpendicular distance", () => {
    expect(distanceToSegment(vec2(5, 4), vec2(0, 0), vec2(10, 0))).toBeCloseTo(4);
  });
});

describe("segmentIntersection", () => {
  it("finds a crossing", () => {
    const hit = segmentIntersection(vec2(0, 0), vec2(10, 10), vec2(0, 10), vec2(10, 0));
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(5);
    expect(hit!.point.y).toBeCloseTo(5);
    expect(hit!.t).toBeCloseTo(0.5);
    expect(hit!.u).toBeCloseTo(0.5);
  });
  it("returns null for parallel segments", () => {
    expect(
      segmentIntersection(vec2(0, 0), vec2(10, 0), vec2(0, 1), vec2(10, 1)),
    ).toBeNull();
  });
  it("returns null for non-overlapping segments", () => {
    expect(
      segmentIntersection(vec2(0, 0), vec2(1, 1), vec2(5, 0), vec2(6, -3)),
    ).toBeNull();
  });
  it("counts endpoint touches", () => {
    const hit = segmentIntersection(vec2(0, 0), vec2(4, 4), vec2(4, 4), vec2(8, 0));
    expect(hit).not.toBeNull();
    expect(hit!.point.x).toBeCloseTo(4);
  });
});

describe("pointOnSegment", () => {
  it("accepts points within epsilon", () => {
    expect(pointOnSegment(vec2(5, 0.0000001), vec2(0, 0), vec2(10, 0), 1e-6)).toBe(true);
    expect(pointOnSegment(vec2(5, 0.1), vec2(0, 0), vec2(10, 0), 1e-6)).toBe(false);
  });
});
