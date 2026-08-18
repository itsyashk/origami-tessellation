import { describe, expect, it } from "vitest";
import {
  angleDifference,
  degToRad,
  normalizeAngle,
  normalizeSignedAngle,
  radToDeg,
  sectorAnglesFromRays,
  snapAngleToStep,
  TAU,
} from "./angles";

describe("normalizeAngle", () => {
  it("maps into [0, 2π)", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(TAU)).toBeCloseTo(0, 12);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(normalizeAngle(5 * TAU + 0.25)).toBeCloseTo(0.25, 12);
  });
});

describe("normalizeSignedAngle", () => {
  it("maps into (-π, π]", () => {
    expect(normalizeSignedAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(normalizeSignedAngle((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 12);
    expect(normalizeSignedAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});

describe("angleDifference", () => {
  it("returns the smallest separation", () => {
    expect(angleDifference(0.1, TAU - 0.1)).toBeCloseTo(0.2, 12);
    expect(angleDifference(0, Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});

describe("sectorAnglesFromRays", () => {
  it("computes sectors for a symmetric cross", () => {
    const sectors = sectorAnglesFromRays([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
    expect(sectors).toHaveLength(4);
    for (const s of sectors) expect(s).toBeCloseTo(Math.PI / 2, 12);
  });

  it("computes sectors for an asymmetric fan and sums to 2π", () => {
    const rays = [degToRad(10), degToRad(100), degToRad(190), degToRad(300)];
    const sectors = sectorAnglesFromRays(rays);
    expect(sectors.reduce((a, b) => a + b, 0)).toBeCloseTo(TAU, 12);
    expect(sectors[0]).toBeCloseTo(degToRad(90), 12);
    expect(sectors[3]).toBeCloseTo(degToRad(70), 12);
  });

  it("handles unsorted input", () => {
    const sectors = sectorAnglesFromRays([Math.PI, 0]);
    expect(sectors[0]).toBeCloseTo(Math.PI, 12);
    expect(sectors[1]).toBeCloseTo(Math.PI, 12);
  });

  it("returns empty for fewer than 2 rays", () => {
    expect(sectorAnglesFromRays([])).toEqual([]);
    expect(sectorAnglesFromRays([1])).toEqual([]);
  });
});

describe("snapAngleToStep", () => {
  it("snaps within tolerance", () => {
    const snapped = snapAngleToStep(degToRad(44), degToRad(45), degToRad(3));
    expect(snapped).not.toBeNull();
    expect(radToDeg(snapped!)).toBeCloseTo(45, 10);
  });
  it("rejects outside tolerance", () => {
    expect(snapAngleToStep(degToRad(40), degToRad(45), degToRad(3))).toBeNull();
  });
});
