import { describe, expect, it } from "vitest";
import {
  addCrease,
  addVertex,
  emptyDocument,
  findVertexAt,
  validateDocument,
} from "./model";
import { planarizeDocument } from "./planarize";
import {
  assignOrbit,
  completeSymmetry,
  deleteOrbit,
  ensureVertexOrbit,
  moveOrbit,
  orbitVertexIds,
  paperCenter,
  type SymmetrySpec,
} from "./symmetry";
import { squareTwist } from "./examples";
import { distance } from "@/geometry/vec2";

const c4 = (doc = emptyDocument()): SymmetrySpec => ({
  kind: "c4",
  center: paperCenter(doc.paper),
});

describe("completeSymmetry", () => {
  it("fills a 4-fold orbit from a single off-center vertex", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 140, y: 100 }, "a").doc;
    const next = completeSymmetry(doc, c4(doc));
    expect(validateDocument(next)).toEqual([]);
    expect(next.vertices).toHaveLength(4);
    const center = paperCenter(doc.paper);
    for (const v of next.vertices) {
      expect(distance(v, center)).toBeCloseTo(40, 6);
    }
    expect(completeSymmetry(next, c4(next))).toBe(next);
  });

  it("copies a crease around 2-fold rotation", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 60, y: 80 }, "a").doc;
    doc = addVertex(doc, { x: 80, y: 80 }, "b").doc;
    doc = addCrease(doc, "a", "b", "mountain").doc;
    const spec: SymmetrySpec = { kind: "c2", center: paperCenter(doc.paper) };
    const next = completeSymmetry(doc, spec);
    expect(next.vertices).toHaveLength(4);
    expect(next.creases).toHaveLength(2);
    expect(next.creases.every((c) => c.assignment === "mountain")).toBe(true);
  });

  it("mirrors left–right across the paper midline", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 40, y: 70 }, "a").doc;
    const spec: SymmetrySpec = { kind: "mx", center: paperCenter(doc.paper) };
    const next = completeSymmetry(doc, spec);
    expect(next.vertices).toHaveLength(2);
    const mate = findVertexAt(next, { x: 160, y: 70 }, 1e-6);
    expect(mate).toBeDefined();
  });

  it("is a no-op on the square twist under 4-fold (already symmetric)", () => {
    const doc = squareTwist();
    const next = completeSymmetry(doc, c4(doc));
    expect(next).toBe(doc);
  });
});

describe("moveOrbit", () => {
  it("rotates sibling copies when one vertex is dragged", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 140, y: 100 }, "a").doc;
    doc = completeSymmetry(doc, c4(doc));
    const ids = orbitVertexIds(doc, "a", c4(doc));
    expect(ids).toHaveLength(4);

    const moved = moveOrbit(doc, "a", { x: 150, y: 110 }, c4(doc));
    const center = paperCenter(doc.paper);
    const radii = moved.vertices.map((v) => distance(v, center));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
    expect(findVertexAt(moved, { x: 150, y: 110 }, 1e-6)).toBeDefined();
  });

  it("swaps a 2-fold pair in one step without collapsing them", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 140, y: 100 }, "a").doc;
    const spec: SymmetrySpec = { kind: "c2", center: paperCenter(doc.paper) };
    doc = completeSymmetry(doc, spec);
    expect(doc.vertices).toHaveLength(2);
    const swapped = moveOrbit(doc, "a", { x: 60, y: 100 }, spec);
    expect(swapped.vertices).toHaveLength(2);
    expect(findVertexAt(swapped, { x: 60, y: 100 }, 1e-6)?.id).toBe("a");
    expect(findVertexAt(swapped, { x: 140, y: 100 }, 1e-6)).toBeDefined();
  });
});

describe("ensureVertexOrbit", () => {
  it("copies only the given vertex, not unrelated ones", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 140, y: 100 }, "a").doc;
    doc = addVertex(doc, { x: 140, y: 140 }, "b").doc;
    const next = ensureVertexOrbit(doc, "a", c4(doc));
    expect(next.vertices).toHaveLength(5);
    expect(findVertexAt(next, { x: 140, y: 140 }, 1e-6)?.id).toBe("b");
  });
});

describe("deleteOrbit / assignOrbit", () => {
  it("deletes the whole 4-fold orbit", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 140, y: 100 }, "a").doc;
    doc = completeSymmetry(doc, c4(doc));
    const next = deleteOrbit(doc, ["a"], [], c4(doc));
    expect(next.vertices).toHaveLength(0);
  });

  it("assigns every crease in the orbit", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 60, y: 80 }, "a").doc;
    doc = addVertex(doc, { x: 80, y: 80 }, "b").doc;
    doc = addCrease(doc, "a", "b", "unassigned").doc;
    const spec: SymmetrySpec = { kind: "c2", center: paperCenter(doc.paper) };
    doc = completeSymmetry(doc, spec);
    const next = assignOrbit(doc, [doc.creases[0].id], "valley", spec);
    expect(next.creases.every((c) => c.assignment === "valley")).toBe(true);
  });
});

describe("planarize fuses coincident vertices", () => {
  it("merges two vertices dropped on the same point", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 50, y: 50 }, "a").doc;
    doc = addVertex(doc, { x: 50, y: 50 }, "b").doc;
    doc = addVertex(doc, { x: 80, y: 50 }, "c").doc;
    doc = addCrease(doc, "b", "c", "mountain").doc;
    const planar = planarizeDocument(doc);
    expect(planar.vertices).toHaveLength(2);
    expect(planar.creases).toHaveLength(1);
    expect(validateDocument(planar)).toEqual([]);
  });
});
