import { describe, expect, it } from "vitest";
import { analyzeDocument, analyzeKawasaki, analyzeMaekawa } from "./analysis";
import {
  addCrease,
  addVertex,
  emptyDocument,
  moveVertex,
  vertexMap,
  type Crease,
  type OrigamiDocument,
  type Vertex,
} from "./model";
import { squareTwist, singleVertexPlayground } from "./examples";
import { degToRad } from "@/geometry/angles";

/** Build a star: one interior center plus rays at the given angles (degrees). */
const buildStar = (
  angles: number[],
  assignments?: ("mountain" | "valley" | "unassigned")[],
): OrigamiDocument => {
  let doc = emptyDocument("star");
  const { doc: d1, vertex: center } = addVertex(doc, { x: 100, y: 100 }, "center");
  doc = d1;
  angles.forEach((deg, i) => {
    const rad = degToRad(deg);
    const pos = {
      x: 100 + Math.cos(rad) * 30,
      y: 100 + Math.sin(rad) * 30,
    };
    const res = addVertex(doc, pos, `ray${i}`);
    doc = res.doc;
    const cr = addCrease(doc, center.id, res.vertex.id, assignments?.[i] ?? "unassigned");
    doc = cr.doc;
  });
  return doc;
};

const centerAnalysis = (doc: OrigamiDocument) =>
  analyzeDocument(doc).byVertex.get("center")!;

describe("Kawasaki analysis", () => {
  it("validates a symmetric degree-4 vertex", () => {
    const a = centerAnalysis(buildStar([0, 90, 180, 270]));
    expect(a.isInterior).toBe(true);
    expect(a.degree).toBe(4);
    expect(a.kawasaki.status).toBe("valid");
    expect(Math.abs(a.kawasaki.errorRadians)).toBeLessThan(1e-9);
    expect(a.kawasaki.sectorAngles).toHaveLength(4);
  });

  it("validates an asymmetric but Kawasaki-valid vertex (90/45/90/135)", () => {
    // Sorted rays 0°, 90°, 225°, 315° → sectors 90, 135, 90, 45.
    const a = centerAnalysis(buildStar([0, 90, 225, 315]));
    expect(a.kawasaki.status).toBe("valid");
    expect(a.kawasaki.oddSectorSum).toBeCloseTo(Math.PI, 9);
    expect(a.kawasaki.evenSectorSum).toBeCloseTo(Math.PI, 9);
  });

  it("rejects a clearly invalid vertex and reports the residual", () => {
    const a = centerAnalysis(buildStar([0, 80, 180, 270]));
    expect(a.kawasaki.status).toBe("invalid");
    expect(Math.abs(a.kawasaki.errorDegrees)).toBeCloseTo(10, 6);
    expect(a.kawasaki.explanation).toContain("10.0°");
  });

  it("reports near-miss status inside the near tolerance", () => {
    const a = centerAnalysis(buildStar([0, 88, 180, 270]));
    expect(a.kawasaki.status).toBe("near");
    expect(Math.abs(a.kawasaki.errorDegrees)).toBeCloseTo(2, 6);
  });

  it("marks odd-degree interior vertices invalid", () => {
    const a = centerAnalysis(buildStar([0, 120, 240]));
    expect(a.kawasaki.status).toBe("invalid");
    expect(a.kawasaki.explanation).toContain("even number");
  });

  it("is not applicable on boundary vertices", () => {
    let doc = emptyDocument();
    const { doc: d1 } = addVertex(doc, { x: 0, y: 100 }, "center");
    doc = d1;
    const { doc: d2 } = addVertex(doc, { x: 50, y: 100 }, "other");
    doc = d2;
    doc = addCrease(doc, "center", "other").doc;
    const a = analyzeDocument(doc).byVertex.get("center")!;
    expect(a.isInterior).toBe(false);
    expect(a.kawasaki.status).toBe("not-applicable");
  });

  it("keeps sector angles aligned with sorted crease ids", () => {
    const vertices = new Map<string, Vertex>([
      ["c", { id: "c", x: 0, y: 0 }],
      ["a", { id: "a", x: 10, y: 0 }],
      ["b", { id: "b", x: 0, y: 10 }],
      ["d", { id: "d", x: -10, y: 0 }],
      ["e", { id: "e", x: 0, y: -10 }],
    ]);
    const creases: Crease[] = [
      { id: "ce", startVertexId: "c", endVertexId: "e", assignment: "unassigned" },
      { id: "ca", startVertexId: "c", endVertexId: "a", assignment: "unassigned" },
      { id: "cd", startVertexId: "c", endVertexId: "d", assignment: "unassigned" },
      { id: "cb", startVertexId: "c", endVertexId: "b", assignment: "unassigned" },
    ];
    const k = analyzeKawasaki(vertices.get("c")!, creases, vertices, true);
    expect(k.sortedCreaseIds).toEqual(["ca", "cb", "cd", "ce"]);
    for (const s of k.sectorAngles) expect(s).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe("Maekawa analysis", () => {
  it("validates mountains − valleys = +2", () => {
    const a = centerAnalysis(
      buildStar([0, 90, 180, 270], ["mountain", "mountain", "mountain", "valley"]),
    );
    expect(a.maekawa.status).toBe("valid");
    expect(a.maekawa.difference).toBe(2);
  });

  it("validates mountains − valleys = −2", () => {
    const a = centerAnalysis(
      buildStar([0, 90, 180, 270], ["valley", "valley", "valley", "mountain"]),
    );
    expect(a.maekawa.status).toBe("valid");
    expect(a.maekawa.difference).toBe(-2);
  });

  it("rejects a balanced 2/2 assignment", () => {
    const a = centerAnalysis(
      buildStar([0, 90, 180, 270], ["mountain", "mountain", "valley", "valley"]),
    );
    expect(a.maekawa.status).toBe("invalid");
    expect(a.maekawa.explanation).toContain("±2");
  });

  it("stays open while creases are unassigned but satisfiable", () => {
    const a = centerAnalysis(
      buildStar([0, 90, 180, 270], ["mountain", "mountain", "mountain", "unassigned"]),
    );
    expect(a.maekawa.status).toBe("not-applicable");
    expect(a.maekawa.explanation).toContain("still");
  });

  it("flags unsatisfiable partial assignments", () => {
    // 4 mountains + 2 unassigned: best difference is 4−2=2? No: 4 assigned
    // mountains, 2 free. difference=4; adding both as valleys → 2. Reachable.
    // Use 6 mountains + 1 free: difference 6, free 1 → range [5,7], parity of
    // (2−6+1)=odd → cannot reach ±2.
    const a = centerAnalysis(
      buildStar(
        [0, 50, 100, 150, 200, 250, 300],
        [
          "mountain",
          "mountain",
          "mountain",
          "mountain",
          "mountain",
          "mountain",
          "unassigned",
        ],
      ),
    );
    expect(a.maekawa.status).toBe("invalid");
  });
});

describe("document analysis", () => {
  it("summarizes the square twist as fully valid", () => {
    const analysis = analyzeDocument(squareTwist());
    expect(analysis.interiorVertexCount).toBe(4);
    expect(analysis.validVertexCount).toBe(4);
    expect(analysis.invalidVertexCount).toBe(0);
  });

  it("summarizes the single-vertex study as valid", () => {
    const analysis = analyzeDocument(singleVertexPlayground());
    expect(analysis.interiorVertexCount).toBe(1);
    expect(analysis.validVertexCount).toBe(1);
  });

  it("updates when a vertex moves", () => {
    const doc = singleVertexPlayground();
    const before = analyzeDocument(doc).byVertex.get("center")!;
    expect(before.kawasaki.status).toBe("valid");
    const moved = moveVertex(doc, "east", { x: 200, y: 130 });
    const after = analyzeDocument(moved).byVertex.get("center")!;
    expect(after.kawasaki.status).not.toBe("valid");
    expect(Math.abs(after.kawasaki.errorDegrees)).toBeGreaterThan(1);
  });

  it("uses the vertex map for endpoint lookups", () => {
    const doc = squareTwist();
    expect(vertexMap(doc).size).toBe(doc.vertices.length);
  });
});
