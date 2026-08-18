import { describe, expect, it } from "vitest";
import { planarizeDocument } from "./planarize";
import {
  addCrease,
  addVertex,
  emptyDocument,
  findVertexAt,
  validateDocument,
  type OrigamiDocument,
} from "./model";
import { analyzeDocument } from "./analysis";

/** Build a document from labeled points and crease pairs. */
const build = (
  points: Record<string, [number, number]>,
  creases: [string, string, ("mountain" | "valley" | "unassigned")?][],
): OrigamiDocument => {
  let doc = emptyDocument("planarize-test");
  for (const [id, [x, y]] of Object.entries(points)) {
    doc = addVertex(doc, { x, y }, id).doc;
  }
  for (const [a, b, assignment] of creases) {
    doc = addCrease(doc, a, b, assignment ?? "unassigned").doc;
  }
  return doc;
};

describe("planarizeDocument", () => {
  it("splits two crossing creases at their intersection", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], c: [100, 50], d: [100, 150] },
      [["a", "b", "mountain"], ["c", "d", "valley"]],
    );
    const planar = planarizeDocument(doc);

    expect(validateDocument(planar)).toEqual([]);
    expect(planar.vertices).toHaveLength(5);
    expect(planar.creases).toHaveLength(4);

    const center = findVertexAt(planar, { x: 100, y: 100 }, 1e-6);
    expect(center).toBeDefined();
    const centerAnalysis = analyzeDocument(planar).byVertex.get(center!.id)!;
    expect(centerAnalysis.degree).toBe(4);
    // A perpendicular cross has four 90° sectors — Kawasaki holds.
    expect(centerAnalysis.kawasaki.status).toBe("valid");
  });

  it("preserves assignments on all split halves", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], c: [100, 50], d: [100, 150] },
      [["a", "b", "mountain"], ["c", "d", "valley"]],
    );
    const planar = planarizeDocument(doc);
    expect(planar.creases.filter((c) => c.assignment === "mountain")).toHaveLength(2);
    expect(planar.creases.filter((c) => c.assignment === "valley")).toHaveLength(2);
  });

  it("chains a crease crossing several others", () => {
    const doc = build(
      {
        v1a: [80, 50],
        v1b: [80, 150],
        v2a: [120, 50],
        v2b: [120, 150],
        h1: [50, 100],
        h2: [150, 100],
      },
      [["v1a", "v1b"], ["v2a", "v2b"], ["h1", "h2"]],
    );
    const planar = planarizeDocument(doc);
    expect(validateDocument(planar)).toEqual([]);
    // 6 endpoints + 2 crossings; each of the 3 creases splits at its cuts:
    // horizontal → 3 segments, each vertical → 2. Total 7 creases.
    expect(planar.vertices).toHaveLength(8);
    expect(planar.creases).toHaveLength(7);
  });

  it("splits a crease through a vertex lying on its interior", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], loose: [100, 100] },
      [["a", "b", "mountain"]],
    );
    const planar = planarizeDocument(doc);
    expect(planar.vertices).toHaveLength(3);
    expect(planar.creases).toHaveLength(2);
    expect(planar.creases.every((c) => c.assignment === "mountain")).toBe(true);
    // No new vertices — the loose one was reused.
    expect(planar.vertices.map((v) => v.id).sort()).toEqual(["a", "b", "loose"]);
  });

  it("resolves a T-junction drawn from an unsplit crease", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], t: [100, 100], up: [100, 150] },
      [["a", "b"], ["t", "up"]],
    );
    const planar = planarizeDocument(doc);
    expect(validateDocument(planar)).toEqual([]);
    expect(planar.vertices).toHaveLength(4);
    // a–t, t–b, t–up
    expect(planar.creases).toHaveLength(3);
  });

  it("leaves creases sharing a vertex alone", () => {
    const doc = build(
      { a: [50, 50], b: [100, 100], c: [150, 50] },
      [["a", "b"], ["b", "c"]],
    );
    expect(planarizeDocument(doc)).toBe(doc);
  });

  it("merges collinear overlapping creases into a clean chain", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], c: [80, 100], d: [180, 100] },
      [["a", "b"], ["c", "d"]],
    );
    // The overlap has no crossing point, but the endpoint-on-interior rule
    // still resolves it: a–c, c–b, b–d with the duplicate overlap dropped.
    const planar = planarizeDocument(doc);
    expect(validateDocument(planar)).toEqual([]);
    expect(planar.vertices).toHaveLength(4);
    expect(planar.creases).toHaveLength(3);
  });

  it("is idempotent and returns the same reference when already planar", () => {
    const doc = build(
      { a: [50, 100], b: [150, 100], c: [100, 50], d: [100, 150] },
      [["a", "b"], ["c", "d"]],
    );
    const once = planarizeDocument(doc);
    expect(planarizeDocument(once)).toBe(once);
  });

  it("handles many mutual crossings (a grid)", () => {
    // 3 horizontals × 3 verticals = 9 crossings.
    const points: Record<string, [number, number]> = {};
    const creases: [string, string][] = [];
    for (let i = 0; i < 3; i++) {
      const y = 60 + i * 40;
      points[`h${i}a`] = [40, y];
      points[`h${i}b`] = [160, y];
      creases.push([`h${i}a`, `h${i}b`]);
      const x = 60 + i * 40;
      points[`v${i}a`] = [x, 40];
      points[`v${i}b`] = [x, 160];
      creases.push([`v${i}a`, `v${i}b`]);
    }
    const planar = planarizeDocument(build(points, creases));
    expect(validateDocument(planar)).toEqual([]);
    expect(planar.vertices).toHaveLength(12 + 9);
    // Each of the 6 creases is cut 3 times → 4 segments each.
    expect(planar.creases).toHaveLength(24);
    // Every crossing vertex is a valid degree-4 flat-foldable candidate.
    const analysis = analyzeDocument(planar);
    expect(analysis.interiorVertexCount).toBe(9);
    expect(analysis.validVertexCount).toBe(9);
  });
});
