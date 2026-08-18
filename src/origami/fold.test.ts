import { describe, expect, it } from "vitest";
import { extractFaces } from "./faces";
import { buildFoldModel, foldedFaceTransforms } from "./fold";
import { applyMat } from "@/geometry/mat3d";
import {
  addCrease,
  addVertex,
  emptyDocument,
  type OrigamiDocument,
} from "./model";
import { squareTwist } from "./examples";
import type { Vec2 } from "@/geometry/vec2";

const build = (
  points: Record<string, [number, number]>,
  creases: [string, string, ("mountain" | "valley" | "unassigned")?][],
): OrigamiDocument => {
  let doc = emptyDocument("fold-test");
  for (const [id, [x, y]] of Object.entries(points)) {
    doc = addVertex(doc, { x, y }, id).doc;
  }
  for (const [a, b, assignment] of creases) {
    doc = addCrease(doc, a, b, assignment ?? "unassigned").doc;
  }
  return doc;
};

const totalArea = (doc: OrigamiDocument): number =>
  extractFaces(doc).faces.reduce((sum, f) => sum + f.area, 0);

/** Fold the doc at t and return every transformed face vertex. */
const foldedPoints = (doc: OrigamiDocument, t: number) => {
  const model = buildFoldModel(doc);
  const transforms = foldedFaceTransforms(model, t);
  return model.graph.faces.flatMap((face, i) =>
    face.polygon.map((p) => applyMat(transforms[i], { x: p.x, y: p.y, z: 0 })),
  );
};

const faceContaining = (doc: OrigamiDocument, probe: Vec2) => {
  const model = buildFoldModel(doc);
  const index = model.graph.faces.findIndex(
    (f) => Math.hypot(f.centroid.x - probe.x, f.centroid.y - probe.y) < 30,
  );
  return { model, index };
};

describe("extractFaces", () => {
  it("finds the single face of an empty sheet", () => {
    const graph = extractFaces(emptyDocument());
    expect(graph.faces).toHaveLength(1);
    expect(graph.faces[0].area).toBeCloseTo(200 * 200, 6);
    expect(graph.adjacencies).toHaveLength(0);
  });

  it("splits the sheet along one crease into two faces", () => {
    const doc = build(
      { top: [100, 200], bottom: [100, 0] },
      [["top", "bottom", "valley"]],
    );
    const graph = extractFaces(doc);
    expect(graph.faces).toHaveLength(2);
    for (const face of graph.faces) expect(face.area).toBeCloseTo(100 * 200, 6);
    expect(graph.adjacencies).toHaveLength(1);
    expect(graph.adjacencies[0].assignment).toBe("valley");
  });

  it("handles a corner-to-corner diagonal", () => {
    const doc = build(
      { a: [0, 0], b: [200, 200] },
      [["a", "b", "mountain"]],
    );
    const graph = extractFaces(doc);
    expect(graph.faces).toHaveLength(2);
    for (const face of graph.faces) expect(face.area).toBeCloseTo(20000, 6);
  });

  it("extracts the nine faces of the square twist, conserving area", () => {
    const graph = extractFaces(squareTwist());
    expect(graph.faces).toHaveLength(9);
    const total = graph.faces.reduce((sum, f) => sum + f.area, 0);
    expect(total).toBeCloseTo(200 * 200, 4);
    // All 12 creases separate two interior faces.
    expect(graph.adjacencies).toHaveLength(12);
  });

  it("treats a dangling crease as a slit inside one face", () => {
    const doc = build(
      { edge: [0, 100], leaf: [80, 100] },
      [["edge", "leaf"]],
    );
    const graph = extractFaces(doc);
    expect(graph.faces).toHaveLength(1);
    expect(totalArea(doc)).toBeCloseTo(40000, 4);
    expect(graph.adjacencies).toHaveLength(0);
  });
});

describe("fold model", () => {
  const singleValley = build(
    { top: [80, 200], bottom: [80, 0] },
    [["top", "bottom", "valley"]],
  );

  it("is the identity at t = 0", () => {
    for (const p of foldedPoints(singleValley, 0)) {
      expect(p.z).toBeCloseTo(0, 9);
    }
    const model = buildFoldModel(singleValley);
    const transforms = foldedFaceTransforms(model, 0);
    const probe = applyMat(transforms[0], { x: 10, y: 10, z: 0 });
    expect(probe).toMatchObject({ x: 10, y: 10 });
  });

  it("reflects the moving half across the crease at t = 1", () => {
    // Root is the larger right face (centroid nearer the paper center),
    // so the left half folds over: (0, y) → (160, y).
    const model = buildFoldModel(singleValley);
    const transforms = foldedFaceTransforms(model, 1);
    const left = model.graph.faces.findIndex((f) => f.centroid.x < 80);
    const folded = applyMat(transforms[left], { x: 0, y: 50, z: 0 });
    expect(folded.x).toBeCloseTo(160, 6);
    expect(folded.y).toBeCloseTo(50, 6);
    expect(folded.z).toBeCloseTo(0, 6);
  });

  it("lifts a valley child toward +z and a mountain child toward −z mid-fold", () => {
    const model = buildFoldModel(singleValley);
    const transforms = foldedFaceTransforms(model, 0.5);
    const left = model.graph.faces.findIndex((f) => f.centroid.x < 80);
    const lifted = applyMat(transforms[left], { x: 0, y: 50, z: 0 });
    expect(lifted.z).toBeGreaterThan(10);

    const singleMountain = build(
      { top: [80, 200], bottom: [80, 0] },
      [["top", "bottom", "mountain"]],
    );
    const mModel = buildFoldModel(singleMountain);
    const mTransforms = foldedFaceTransforms(mModel, 0.5);
    const mLeft = mModel.graph.faces.findIndex((f) => f.centroid.x < 80);
    const dropped = applyMat(mTransforms[mLeft], { x: 0, y: 50, z: 0 });
    expect(dropped.z).toBeLessThan(-10);
  });

  it("folds an accordion into a stack (composed reflections translate)", () => {
    // Creases at x=60 and x=130 so the paper center (100,100) is strictly
    // inside the middle strip, making it the root deterministically.
    const accordion = build(
      { t1: [60, 200], b1: [60, 0], t2: [130, 200], b2: [130, 0] },
      [["t1", "b1", "valley"], ["t2", "b2", "mountain"]],
    );
    const model = buildFoldModel(accordion);
    const transforms = foldedFaceTransforms(model, 1);
    // Left strip reflects across x=60: 0 → 120.
    const left = model.graph.faces.findIndex((f) => f.centroid.x < 60);
    const right = model.graph.faces.findIndex((f) => f.centroid.x > 130);
    const leftFolded = applyMat(transforms[left], { x: 0, y: 100, z: 0 });
    expect(leftFolded.x).toBeCloseTo(120, 6);
    // Right strip reflects across x=130: 200 → 60.
    const rightFolded = applyMat(transforms[right], { x: 200, y: 100, z: 0 });
    expect(rightFolded.x).toBeCloseTo(60, 6);
    // Everything lands back in the plane, inside the middle strip's span.
    for (const p of foldedPoints(accordion, 1)) {
      expect(p.z).toBeCloseTo(0, 6);
      expect(p.x).toBeGreaterThanOrEqual(60 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(130 + 1e-6);
    }
  });

  it("keeps unassigned subtrees flat", () => {
    const doc = build(
      { top: [80, 200], bottom: [80, 0] },
      [["top", "bottom", "unassigned"]],
    );
    const model = buildFoldModel(doc);
    expect(model.unassignedHingeCount).toBe(1);
    for (const p of foldedPoints(doc, 1)) expect(p.z).toBeCloseTo(0, 9);
  });

  it("folds the square twist completely flat", () => {
    const doc = squareTwist();
    const model = buildFoldModel(doc);
    const transforms = foldedFaceTransforms(model, 1);

    // Every face lands back in the z=0 plane and stays on the sheet's bbox
    // (this twist variant folds to a full-width but layered silhouette).
    const points = foldedPoints(doc, 1);
    for (const p of points) {
      expect(Math.abs(p.z)).toBeLessThan(1e-6);
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(200 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeLessThanOrEqual(200 + 1e-6);
    }

    // Known mapping: the left kite (bounded by the central square's DA edge,
    // x=80) reflects across it, sending the paper corner (0,0) to (160,0).
    const kite = model.graph.faces.findIndex(
      (f) =>
        f.polygon.some((p) => Math.hypot(p.x, p.y) < 1e-6) &&
        f.polygon.some((p) => Math.hypot(p.x, p.y - 40) < 1e-6),
    );
    expect(kite).toBeGreaterThanOrEqual(0);
    const corner = applyMat(transforms[kite], { x: 0, y: 0, z: 0 });
    expect(corner.x).toBeCloseTo(160, 6);
    expect(corner.y).toBeCloseTo(0, 6);

    // The paper genuinely moved: some face is displaced by more than 50.
    const maxDisplacement = Math.max(
      ...model.graph.faces.map((f, i) => {
        const image = applyMat(transforms[i], {
          x: f.centroid.x,
          y: f.centroid.y,
          z: 0,
        });
        return Math.hypot(image.x - f.centroid.x, image.y - f.centroid.y);
      }),
    );
    expect(maxDisplacement).toBeGreaterThan(50);
  });

  it("roots the square twist at its central square", () => {
    const { model, index } = faceContaining(squareTwist(), { x: 100, y: 100 });
    expect(index).toBeGreaterThanOrEqual(0);
    expect(model.root).toBe(index);
    expect(model.graph.faces[model.root].area).toBeCloseTo(40 * 40, 4);
  });
});
