import { describe, expect, it } from "vitest";
import { PATTERNS } from "./library";
import { validateDocument } from "../model";
import { analyzeDocument } from "../analysis";
import { planarizeDocument } from "../planarize";
import { parseDocument, serializeDocument } from "../serialization";
import { buildFoldModel } from "../fold";

describe("pattern library", () => {
  it("has a rich library with unique slugs", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(25);
    const slugs = new Set(PATTERNS.map((p) => p.slug));
    expect(slugs.size).toBe(PATTERNS.length);
  });

  for (const pattern of PATTERNS) {
    describe(pattern.title, () => {
      const doc = pattern.build();

      it("is structurally valid and deterministic", () => {
        expect(validateDocument(doc)).toEqual([]);
        expect(pattern.build()).toEqual(doc);
        expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      });

      it("is already planar (creases only meet at vertices)", () => {
        expect(planarizeDocument(doc)).toBe(doc);
      });

      it("is fully flat-foldable at every interior vertex", () => {
        const analysis = analyzeDocument(doc);
          const broken = [...analysis.byVertex.values()].filter(
          (v) =>
            v.isInterior &&
            v.degree >= 2 &&
            (v.kawasaki.status === "invalid" ||
              v.kawasaki.status === "near" ||
              v.maekawa.status === "invalid" ||
              v.bigLittleBig.status === "invalid"),
        );
        expect(
          broken.map((v) => ({
            id: v.vertexId,
            kawasaki: v.kawasaki.status,
            err: v.kawasaki.errorDegrees.toFixed(2),
            maekawa: v.maekawa.status,
            diff: v.maekawa.difference,
          })),
        ).toEqual([]);
        expect(analysis.validVertexCount).toBe(analysis.interiorVertexCount);
      });

      it("produces a foldable face model", () => {
        const model = buildFoldModel(doc);
        expect(model.graph.faces.length).toBeGreaterThan(0);
        const total = model.graph.faces.reduce((sum, f) => sum + f.area, 0);
        expect(total).toBeCloseTo(doc.paper.width * doc.paper.height, 2);
        expect(model.unassignedHingeCount).toBe(0);
      });
    });
  }
});
