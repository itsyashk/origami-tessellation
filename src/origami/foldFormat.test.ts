import { describe, expect, it } from "vitest";
import {
  documentToFold,
  foldToDocument,
  isFoldDocument,
  serializeFold,
} from "./foldFormat";
import {
  ingestImportedDocument,
  parseImportedDocument,
  parseDocument,
  serializeDocument,
  DocumentParseError,
} from "./serialization";
import { squareTwist } from "./examples";
import { planarizeDocument } from "./planarize";
import { emptyDocument, addVertex, addCrease } from "./model";

describe("FOLD format", () => {
  it("round-trips the square twist through FOLD", () => {
    const doc = squareTwist();
    const fold = documentToFold(doc);
    expect(fold.file_spec).toBe(1.1);
    expect(fold.vertices_coords).toHaveLength(doc.vertices.length);
    expect(fold.edges_vertices).toHaveLength(doc.creases.length);
    expect(fold.edges_assignment).toContain("M");
    expect(fold.edges_assignment).toContain("V");

    const back = foldToDocument(fold);
    expect(back.vertices).toHaveLength(doc.vertices.length);
    expect(back.creases).toHaveLength(doc.creases.length);
    expect(back.creases.filter((c) => c.assignment === "mountain")).toHaveLength(
      doc.creases.filter((c) => c.assignment === "mountain").length,
    );
    expect(back.paper.width).toBe(doc.paper.width);
    expect(back.paper.height).toBe(doc.paper.height);
  });

  it("detects FOLD vs native JSON", () => {
    expect(isFoldDocument(documentToFold(squareTwist()))).toBe(true);
    expect(isFoldDocument(squareTwist())).toBe(false);
  });

  it("parseImportedDocument accepts both native JSON and FOLD", () => {
    const native = parseImportedDocument(serializeDocument(squareTwist()));
    expect(native.name).toBe("Square Twist");
    const fromFold = parseImportedDocument(serializeFold(squareTwist()));
    expect(fromFold.creases).toHaveLength(12);
  });

  it("maps F (flat) to unassigned and skips C (cut) edges", () => {
    const raw = {
      vertices_coords: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      edges_vertices: [
        [0, 1],
        [1, 2],
      ],
      edges_assignment: ["F", "C"],
    };
    const doc = foldToDocument(raw);
    expect(doc.creases).toHaveLength(1);
    expect(doc.creases[0].assignment).toBe("unassigned");
  });

  it("rejects FOLD edges that point off the vertex list", () => {
    expect(() =>
      parseImportedDocument(
        JSON.stringify({
          vertices_coords: [[0, 0], [1, 0]],
          edges_vertices: [[0, 9]],
        }),
      ),
    ).toThrow(DocumentParseError);
  });
});

describe("ingestImportedDocument", () => {
  it("planarizes crossings on import", () => {
    let doc = emptyDocument("cross");
    doc = addVertex(doc, { x: 50, y: 100 }, "a").doc;
    doc = addVertex(doc, { x: 150, y: 100 }, "b").doc;
    doc = addVertex(doc, { x: 100, y: 50 }, "c").doc;
    doc = addVertex(doc, { x: 100, y: 150 }, "d").doc;
    doc = addCrease(doc, "a", "b").doc;
    doc = addCrease(doc, "c", "d").doc;

    const ingested = ingestImportedDocument(serializeDocument(doc));
    expect(ingested.vertices).toHaveLength(5);
    expect(ingested.creases).toHaveLength(4);
    expect(planarizeDocument(ingested)).toBe(ingested);
  });

  it("leaves an already-planar native file as a no-op planarize", () => {
    const json = serializeDocument(squareTwist());
    const ingested = ingestImportedDocument(json);
    expect(ingested.vertices).toHaveLength(12);
    expect(parseDocument(json).name).toBe(ingested.name);
  });
});
