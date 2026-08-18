import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "./documentStore";
import { addVertex, emptyDocument, moveVertex } from "@/origami/model";

const store = () => useDocumentStore.getState();

describe("documentStore undo/redo", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      doc: emptyDocument("test"),
      past: [],
      future: [],
      transactionBase: null,
    });
  });

  it("commit pushes history and clears the redo stack", () => {
    const d1 = addVertex(store().doc, { x: 1, y: 1 }).doc;
    store().commit(d1);
    const d2 = addVertex(store().doc, { x: 2, y: 2 }).doc;
    store().commit(d2);

    expect(store().doc.vertices).toHaveLength(2);
    store().undo();
    expect(store().doc.vertices).toHaveLength(1);
    store().redo();
    expect(store().doc.vertices).toHaveLength(2);

    // A new commit after undo clears redo.
    store().undo();
    store().commit(addVertex(store().doc, { x: 9, y: 9 }).doc);
    expect(store().canRedo()).toBe(false);
  });

  it("a preview gesture is one undo step", () => {
    const d1 = addVertex(store().doc, { x: 5, y: 5 }, "v1").doc;
    store().commit(d1);

    // Simulate a drag: many previews, single commit.
    store().beginPreview();
    for (let i = 0; i < 10; i++) {
      store().preview(moveVertex(store().doc, "v1", { x: 5 + i, y: 5 }));
    }
    store().commitPreview();
    expect(store().doc.vertices[0].x).toBe(14);

    store().undo();
    expect(store().doc.vertices[0].x).toBe(5);
  });

  it("cancelPreview restores the baseline", () => {
    const d1 = addVertex(store().doc, { x: 5, y: 5 }, "v1").doc;
    store().commit(d1);
    store().beginPreview();
    store().preview(moveVertex(store().doc, "v1", { x: 50, y: 50 }));
    store().cancelPreview();
    expect(store().doc.vertices[0]).toMatchObject({ x: 5, y: 5 });
    // Nothing was added to history.
    store().undo();
    expect(store().doc.vertices).toHaveLength(0);
  });

  it("an unchanged preview transaction adds no history", () => {
    const d1 = addVertex(store().doc, { x: 5, y: 5 }).doc;
    store().commit(d1);
    store().beginPreview();
    store().commitPreview();
    expect(store().past).toHaveLength(1);
  });

  it("undo with nothing to undo is a no-op", () => {
    const doc = store().doc;
    store().undo();
    expect(store().doc).toBe(doc);
  });

  it("loadDocument clears history", () => {
    store().commit(addVertex(store().doc, { x: 1, y: 1 }).doc);
    store().loadDocument(emptyDocument("loaded"));
    expect(store().canUndo()).toBe(false);
    expect(store().canRedo()).toBe(false);
    expect(store().doc.name).toBe("loaded");
  });
});
