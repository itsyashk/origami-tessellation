import { describe, expect, it } from "vitest";
import { computeSnap, snapToAngle, snapToGrid } from "./snap";
import { squareTwist } from "@/origami/examples";
import { findKawasakiSnap } from "@/origami/kawasakiSnap";
import { analyzeDocument } from "@/origami/analysis";
import { moveVertex } from "@/origami/model";

describe("computeSnap", () => {
  const doc = squareTwist();

  it("prefers an existing vertex over everything else", () => {
    const hit = computeSnap(doc, { x: 81, y: 79 }, {
      vertices: true,
      alignments: true,
      gridSize: 10,
      tolerance: 4,
    });
    expect(hit?.kind).toBe("vertex");
    expect(hit?.position).toEqual({ x: 80, y: 80 });
    expect(hit?.vertexIds).toEqual(["sq_a"]);
  });

  it("snaps to axis alignment with a nearby vertex", () => {
    // Near x=80 (sq_a/sq_d column) but away from any vertex.
    const hit = computeSnap(doc, { x: 81.5, y: 55 }, {
      vertices: true,
      alignments: true,
      tolerance: 3,
    });
    expect(hit?.kind).toBe("align");
    expect(hit?.position.x).toBeCloseTo(80);
    expect(hit?.position.y).toBeCloseTo(55);
    expect(hit?.guides.length).toBeGreaterThan(0);
  });

  it("snaps to the grid when nothing better is near", () => {
    const hit = computeSnap(doc, { x: 51, y: 51 }, {
      gridSize: 10,
      tolerance: 3,
    });
    expect(hit?.kind).toBe("grid");
    expect(hit?.position).toEqual({ x: 50, y: 50 });
  });

  it("returns null when nothing is in range", () => {
    const hit = computeSnap(doc, { x: 53.7, y: 46.2 }, {
      vertices: true,
      tolerance: 2,
    });
    expect(hit).toBeNull();
  });

  it("excludes requested vertices (the dragged one)", () => {
    const hit = computeSnap(doc, { x: 80.5, y: 80.5 }, {
      vertices: true,
      excludeVertexIds: ["sq_a"],
      tolerance: 3,
    });
    expect(hit?.kind).not.toBe("vertex");
  });
});

describe("snapToAngle", () => {
  it("snaps a nearly-45° ray to exactly 45° and keeps the radius", () => {
    const origin = { x: 0, y: 0 };
    const hit = snapToAngle(origin, { x: 10, y: 9.6 }, 15, 2);
    expect(hit).not.toBeNull();
    expect(hit!.label).toBe("45°");
    const r = Math.hypot(hit!.position.x, hit!.position.y);
    expect(r).toBeCloseTo(Math.hypot(10, 9.6), 9);
    expect(hit!.position.x).toBeCloseTo(hit!.position.y, 9);
  });

  it("returns null far from any step", () => {
    expect(snapToAngle({ x: 0, y: 0 }, { x: 10, y: 4 }, 45, 0.5)).toBeNull();
  });
});

describe("snapToGrid", () => {
  it("snaps within tolerance only", () => {
    expect(snapToGrid({ x: 11, y: 19 }, 10, 2)?.position).toEqual({ x: 10, y: 20 });
    expect(snapToGrid({ x: 15, y: 15 }, 10, 2)).toBeNull();
  });
});

describe("findKawasakiSnap", () => {
  it("repairs an interior neighbor by snapping a dragged leaf endpoint", () => {
    // Perturb one crease endpoint of the square twist so corner sq_a breaks.
    const doc = moveVertex(squareTwist(), "ba_side", { x: 150, y: 0 });
    const broken = analyzeDocument(doc).byVertex.get("sq_a")!;
    expect(broken.kawasaki.status).not.toBe("valid");

    // Drag ba_side near its perturbed position; the valid set is the 315°
    // ray out of sq_a, whose closest point (≈155, 5) is within snap range.
    const snap = findKawasakiSnap(doc, "ba_side", { x: 150, y: 0 }, 8);
    expect(snap).not.toBeNull();
    expect(snap!.affectedVertexIds).toEqual(["sq_a"]);
    const snapped = moveVertex(doc, "ba_side", snap!.position);
    const fixed = analyzeDocument(snapped).byVertex.get("sq_a")!;
    expect(fixed.kawasaki.status).toBe("valid");
  });

  it("snaps a dragged interior vertex onto its own valid locus", () => {
    // Nudge sq_a off its valid position; its own Kawasaki breaks.
    const off = { x: 84, y: 77 };
    const doc = squareTwist();
    const broken = analyzeDocument(moveVertex(doc, "sq_a", off)).byVertex.get("sq_a")!;
    expect(broken.kawasaki.status).not.toBe("valid");

    const snap = findKawasakiSnap(doc, "sq_a", off, 10);
    expect(snap).not.toBeNull();
    const fixed = analyzeDocument(
      moveVertex(doc, "sq_a", snap!.position),
    ).byVertex.get("sq_a")!;
    expect(fixed.kawasaki.status).toBe("valid");
  });

  it("returns null when the vertex has no creases", () => {
    const doc = squareTwist();
    const snap = findKawasakiSnap(
      { ...doc, creases: [] },
      "sq_a",
      { x: 80, y: 80 },
      8,
    );
    expect(snap).toBeNull();
  });

  it("returns null when already valid (nothing to snap)", () => {
    const snap = findKawasakiSnap(squareTwist(), "sq_a", { x: 80, y: 80 }, 8);
    expect(snap).toBeNull();
  });
});
