import { describe, expect, it } from "vitest";
import {
  addCrease,
  addVertex,
  emptyDocument,
  setCreaseAssignment,
  type OrigamiDocument,
} from "./model";
import { suggestAssignments } from "./suggestAssignment";
import { degToRad } from "@/geometry/angles";
import { squareTwist } from "./examples";
import { applyCreaseAssignments } from "./model";
import { analyzeDocument } from "./analysis";

const buildStar = (
  angles: number[],
  assignments?: ("mountain" | "valley" | "unassigned")[],
): OrigamiDocument => {
  let doc = emptyDocument("star");
  const { doc: d1 } = addVertex(doc, { x: 100, y: 100 }, "center");
  doc = d1;
  angles.forEach((deg, i) => {
    const rad = degToRad(deg);
    const pos = { x: 100 + Math.cos(rad) * 30, y: 100 + Math.sin(rad) * 30 };
    const res = addVertex(doc, pos, `ray${i}`);
    doc = res.doc;
    doc = addCrease(doc, "center", res.vertex.id, assignments?.[i] ?? "unassigned").doc;
  });
  return doc;
};

describe("suggestAssignments", () => {
  it("returns nothing when every crease is already assigned", () => {
    expect(suggestAssignments(squareTwist(), "sq_a")).toEqual([]);
  });

  it("returns nothing until Kawasaki holds", () => {
    const doc = buildStar([0, 80, 180, 270]);
    expect(suggestAssignments(doc, "center")).toEqual([]);
  });

  it("proposes Maekawa + BLB completions for a Kawasaki-valid vertex", () => {
    const doc = buildStar([0, 90, 225, 315]);
    const suggestions = suggestAssignments(doc, "center");
    expect(suggestions.length).toBeGreaterThan(0);
    // Every suggestion is 3-and-1 (Maekawa ±2 on a degree-4 vertex).
    for (const s of suggestions) {
      expect(Math.abs(s.maekawaDifference)).toBe(2);
      expect(s.mountains + s.valleys).toBe(4);
      expect(s.assignments).toHaveLength(4);
    }
    // Applying the first suggestion makes the vertex locally foldable.
    const applied = applyCreaseAssignments(doc, suggestions[0].assignments);
    const a = analyzeDocument(applied).byVertex.get("center")!;
    expect(a.kawasaki.status).toBe("valid");
    expect(a.maekawa.status).toBe("valid");
    expect(a.bigLittleBig.status).not.toBe("invalid");
    expect(a.locallyFlatFoldable).toBe(true);
  });

  it("respects already-assigned creases", () => {
    let doc = buildStar([0, 90, 225, 315]);
    const valleyRay = doc.creases.find((c) => c.endVertexId === "ray3" || c.startVertexId === "ray3")!;
    doc = setCreaseAssignment(doc, [valleyRay.id], "valley");
    const suggestions = suggestAssignments(doc, "center");
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.assignments.find((a) => a.creaseId === valleyRay.id)).toBeUndefined();
      expect(s.assignments.every((a) => a.assignment === "mountain" || a.assignment === "valley")).toBe(
        true,
      );
    }
  });
});
