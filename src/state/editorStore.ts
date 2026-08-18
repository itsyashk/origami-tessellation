/**
 * Editor (session) state: active tool, selection, viewport, hover, in-flight
 * gestures, and live snap feedback. None of this is part of the document —
 * it is never serialized.
 *
 * Selectors are kept narrow so pointer-move updates (hover/snap) don't
 * re-render panels that only care about the tool or selection.
 */

import { create } from "zustand";
import type { Vec2 } from "@/geometry/vec2";
import type { SnapHit } from "@/geometry/snap";
import type { Viewport } from "@/editor/viewport";

export type ToolId = "select" | "vertex" | "crease" | "pan";

export interface Selection {
  vertexIds: ReadonlySet<string>;
  creaseIds: ReadonlySet<string>;
}

export const emptySelection: Selection = {
  vertexIds: new Set(),
  creaseIds: new Set(),
};

/** In-flight crease drawing: first endpoint chosen, rubber-banding to pointer. */
export interface CreaseDraft {
  startVertexId: string;
  /** Live end position in paper coords (snapped). */
  end: Vec2;
  /** Vertex the pointer is snapped onto for the end, if any. */
  endVertexId: string | null;
}

interface EditorState {
  tool: ToolId;
  selection: Selection;
  hovered: { type: "vertex" | "crease"; id: string } | null;
  viewport: Viewport;
  creaseDraft: CreaseDraft | null;
  /** Live snap feedback for rendering guides + labels. */
  activeSnap: SnapHit | null;
  /** Id of the vertex currently being dragged, for styling. */
  draggingVertexId: string | null;
  /** Pointer position in paper coordinates (for status readouts). */
  pointerPaper: Vec2 | null;

  setTool: (tool: ToolId) => void;
  setSelection: (selection: Selection) => void;
  selectVertex: (id: string, additive?: boolean) => void;
  selectCrease: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setHovered: (hovered: EditorState["hovered"]) => void;
  setViewport: (viewport: Viewport) => void;
  setCreaseDraft: (draft: CreaseDraft | null) => void;
  setActiveSnap: (snap: SnapHit | null) => void;
  setDraggingVertexId: (id: string | null) => void;
  setPointerPaper: (pos: Vec2 | null) => void;
}

const toggle = (set: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export const useEditorStore = create<EditorState>((set) => ({
  tool: "select",
  selection: emptySelection,
  hovered: null,
  viewport: { pan: { x: 0, y: 0 }, zoom: 3, width: 800, height: 600 },
  creaseDraft: null,
  activeSnap: null,
  draggingVertexId: null,
  pointerPaper: null,

  setTool: (tool) =>
    set({ tool, creaseDraft: null, activeSnap: null }),

  setSelection: (selection) => set({ selection }),

  selectVertex: (id, additive = false) =>
    set((state) => ({
      selection: additive
        ? { ...state.selection, vertexIds: toggle(state.selection.vertexIds, id) }
        : { vertexIds: new Set([id]), creaseIds: new Set() },
    })),

  selectCrease: (id, additive = false) =>
    set((state) => ({
      selection: additive
        ? { ...state.selection, creaseIds: toggle(state.selection.creaseIds, id) }
        : { vertexIds: new Set(), creaseIds: new Set([id]) },
    })),

  clearSelection: () => set({ selection: emptySelection }),
  setHovered: (hovered) => set({ hovered }),
  setViewport: (viewport) => set({ viewport }),
  setCreaseDraft: (creaseDraft) => set({ creaseDraft }),
  setActiveSnap: (activeSnap) => set({ activeSnap }),
  setDraggingVertexId: (draggingVertexId) => set({ draggingVertexId }),
  setPointerPaper: (pointerPaper) => set({ pointerPaper }),
}));
