import { describe, expect, it } from "vitest";
import {
  addCrease,
  addVertex,
  applyCreaseAssignments,
  deleteGeometry,
  emptyDocument,
  findCreaseBetween,
  isOnPaperBoundary,
  mergeVertices,
  moveVertex,
  setCreaseAssignment,
  validateDocument,
} from "./model";
import { parseDocument, serializeDocument, DocumentParseError } from "./serialization";
import { squareTwist } from "./examples";
import { tileMotif } from "./tiling";

describe("document operations", () => {
  it("adds vertices and creases immutably", () => {
    const doc0 = emptyDocument();
    const { doc: doc1, vertex: a } = addVertex(doc0, { x: 10, y: 10 });
    const { doc: doc2, vertex: b } = addVertex(doc1, { x: 50, y: 10 });
    const { doc: doc3, crease } = addCrease(doc2, a.id, b.id, "mountain");

    expect(doc0.vertices).toHaveLength(0);
    expect(doc3.vertices).toHaveLength(2);
    expect(doc3.creases).toHaveLength(1);
    expect(crease.assignment).toBe("mountain");
    expect(validateDocument(doc3)).toEqual([]);
  });

  it("refuses self-loop creases", () => {
    const { doc, vertex } = addVertex(emptyDocument(), { x: 0, y: 0 });
    expect(() => addCrease(doc, vertex.id, vertex.id)).toThrow();
  });

  it("deduplicates creases between the same pair", () => {
    const { doc: d1, vertex: a } = addVertex(emptyDocument(), { x: 0, y: 0 });
    const { doc: d2, vertex: b } = addVertex(d1, { x: 10, y: 0 });
    const { doc: d3 } = addCrease(d2, a.id, b.id);
    const { doc: d4, crease } = addCrease(d3, b.id, a.id);
    expect(d4.creases).toHaveLength(1);
    expect(findCreaseBetween(d4, a.id, b.id)?.id).toBe(crease.id);
  });

  it("moves vertices", () => {
    const { doc, vertex } = addVertex(emptyDocument(), { x: 1, y: 2 });
    const moved = moveVertex(doc, vertex.id, { x: 30, y: 40 });
    expect(moved.vertices[0]).toMatchObject({ x: 30, y: 40 });
    expect(doc.vertices[0]).toMatchObject({ x: 1, y: 2 });
  });

  it("deletes a vertex along with its incident creases", () => {
    const doc = squareTwist();
    const next = deleteGeometry(doc, ["sq_a"]);
    expect(next.vertices.find((v) => v.id === "sq_a")).toBeUndefined();
    // sq_a had 4 incident creases (2 square sides + 2 pleats).
    expect(next.creases).toHaveLength(doc.creases.length - 4);
    expect(validateDocument(next)).toEqual([]);
  });

  it("sets crease assignments in bulk", () => {
    const doc = squareTwist();
    const ids = doc.creases.slice(0, 3).map((c) => c.id);
    const next = setCreaseAssignment(doc, ids, "valley");
    for (const id of ids) {
      expect(next.creases.find((c) => c.id === id)?.assignment).toBe("valley");
    }
  });

  it("detects boundary positions", () => {
    const paper = { width: 200, height: 200 };
    expect(isOnPaperBoundary(paper, { x: 0, y: 50 })).toBe(true);
    expect(isOnPaperBoundary(paper, { x: 200, y: 200 })).toBe(true);
    expect(isOnPaperBoundary(paper, { x: 100, y: 100 })).toBe(false);
    // Points outside the sheet are not boundary points.
    expect(isOnPaperBoundary(paper, { x: 0, y: 500 })).toBe(false);
    expect(isOnPaperBoundary(paper, { x: -3, y: 50 })).toBe(false);
  });

  it("refuses creases whose endpoints don't exist", () => {
    const { doc } = addVertex(emptyDocument(), { x: 0, y: 0 }, "a");
    expect(() => addCrease(doc, "a", "ghost")).toThrow(/existing/);
  });
});

describe("mergeVertices", () => {
  it("rewires incident creases onto the surviving vertex", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 0, y: 0 }, "keep").doc;
    doc = addVertex(doc, { x: 10, y: 0 }, "from").doc;
    doc = addVertex(doc, { x: 20, y: 0 }, "other").doc;
    doc = addCrease(doc, "from", "other", "mountain").doc;

    const merged = mergeVertices(doc, "keep", "from");
    expect(merged.vertices.find((v) => v.id === "from")).toBeUndefined();
    expect(merged.vertices.find((v) => v.id === "keep")).toBeDefined();
    expect(findCreaseBetween(merged, "keep", "other")?.assignment).toBe("mountain");
    expect(findCreaseBetween(merged, "from", "other")).toBeUndefined();
    expect(validateDocument(merged)).toEqual([]);
    expect(doc.vertices).toHaveLength(3); // immutable
  });

  it("drops the self-loop that joined the pair", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 0, y: 0 }, "a").doc;
    doc = addVertex(doc, { x: 10, y: 0 }, "b").doc;
    doc = addCrease(doc, "a", "b", "valley").doc;
    const merged = mergeVertices(doc, "a", "b");
    expect(merged.creases).toHaveLength(0);
    expect(merged.vertices).toHaveLength(1);
  });

  it("collapses duplicate edges and prefers an assigned fold", () => {
    let doc = emptyDocument();
    doc = addVertex(doc, { x: 0, y: 0 }, "keep").doc;
    doc = addVertex(doc, { x: 0, y: 0 }, "from").doc;
    doc = addVertex(doc, { x: 40, y: 0 }, "tip").doc;
    doc = addCrease(doc, "keep", "tip", "unassigned").doc;
    doc = addCrease(doc, "from", "tip", "mountain").doc;

    const merged = mergeVertices(doc, "keep", "from");
    expect(merged.creases).toHaveLength(1);
    expect(merged.creases[0].assignment).toBe("mountain");
    expect(merged.creases[0].startVertexId === "keep" || merged.creases[0].endVertexId === "keep").toBe(
      true,
    );
  });

  it("is a no-op when the ids match or a vertex is missing", () => {
    const { doc, vertex } = addVertex(emptyDocument(), { x: 1, y: 1 }, "a");
    expect(mergeVertices(doc, vertex.id, vertex.id)).toBe(doc);
    expect(mergeVertices(doc, vertex.id, "ghost")).toBe(doc);
  });

  it("applies mixed assignments in one snapshot", () => {
    const doc = squareTwist();
    const [a, b] = doc.creases;
    const next = applyCreaseAssignments(doc, [
      { creaseId: a.id, assignment: "valley" },
      { creaseId: b.id, assignment: "unassigned" },
    ]);
    expect(next.creases.find((c) => c.id === a.id)?.assignment).toBe("valley");
    expect(next.creases.find((c) => c.id === b.id)?.assignment).toBe("unassigned");
    expect(doc.creases.find((c) => c.id === a.id)?.assignment).toBe(a.assignment);
  });
});

describe("serialization", () => {
  it("round-trips the square twist deterministically", () => {
    const doc = squareTwist();
    const json = serializeDocument(doc);
    const parsed = parseDocument(json);
    expect(parsed).toEqual(doc);
    expect(serializeDocument(parsed)).toBe(json);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseDocument("not json")).toThrow(DocumentParseError);
    expect(() => parseDocument("{}")).toThrow(DocumentParseError);
    expect(() =>
      parseDocument(
        JSON.stringify({
          version: 1,
          paper: { width: 100, height: 100 },
          vertices: [{ id: "a" }],
          creases: [],
        }),
      ),
    ).toThrow(DocumentParseError);
  });

  it("rejects documents with dangling crease references", () => {
    const json = JSON.stringify({
      version: 1,
      name: "bad",
      paper: { width: 100, height: 100 },
      vertices: [{ id: "a", x: 0, y: 0 }],
      creases: [
        { id: "c", startVertexId: "a", endVertexId: "ghost", assignment: "mountain" },
      ],
    });
    expect(() => parseDocument(json)).toThrow(DocumentParseError);
  });

  it("rejects future document versions", () => {
    const json = JSON.stringify({ ...squareTwist(), version: 99 });
    expect(() => parseDocument(json)).toThrow(/newer/);
  });
});

describe("tiling", () => {
  it("tiles the whole document into a grid and merges shared vertices", () => {
    const doc = squareTwist();
    const tiled = tileMotif(doc, { rows: 2, columns: 2 });
    expect(validateDocument(tiled)).toEqual([]);
    // 4 copies, but vertices on shared edges merge, so strictly fewer than 4×.
    expect(tiled.vertices.length).toBeGreaterThan(doc.vertices.length);
    expect(tiled.vertices.length).toBeLessThan(doc.vertices.length * 4);
    expect(tiled.creases.length).toBe(doc.creases.length * 4);
    expect(tiled.paper.width).toBeGreaterThan(doc.paper.width);
  });

  it("returns the document unchanged for a 1×1 tile", () => {
    const doc = squareTwist();
    expect(tileMotif(doc, { rows: 1, columns: 1 })).toBe(doc);
  });

  it("drops a degenerate tiling axis instead of stacking copies", () => {
    // A purely horizontal motif has zero y-extent; tiling it by rows would
    // stack copies in place. The row axis is dropped, columns still tile.
    let doc = emptyDocument();
    const a = addVertex(doc, { x: 0, y: 50 }, "a");
    doc = a.doc;
    const b = addVertex(doc, { x: 40, y: 50 }, "b");
    doc = b.doc;
    doc = addCrease(doc, "a", "b").doc;

    const tiled = tileMotif(doc, { rows: 3, columns: 2 });
    expect(tiled.creases).toHaveLength(2);
    expect(tiled.vertices).toHaveLength(3); // shared middle vertex merges

    const stacked = tileMotif(doc, { rows: 3, columns: 1 });
    expect(stacked).toBe(doc);
  });

  it("preserves assignments on copies", () => {
    const doc = squareTwist();
    const tiled = tileMotif(doc, { rows: 1, columns: 2 });
    const mountains = tiled.creases.filter((c) => c.assignment === "mountain");
    expect(mountains.length).toBe(
      doc.creases.filter((c) => c.assignment === "mountain").length * 2,
    );
  });
});
