/**
 * Document state: the current OrigamiDocument plus snapshot-based undo/redo.
 *
 * Documents are small immutable objects, so history entries are whole
 * snapshots — simple and correct. If patterns grow to thousands of creases,
 * swap the arrays for structural-sharing patches without touching callers
 * (`commit`/`undo`/`redo` keep the same signatures).
 *
 * Transient previews (mid-drag positions) go through `preview()` which does
 * NOT touch history; `commitPreview()` finalizes the gesture as one undo step.
 */

import { create } from "zustand";
import {
  emptyDocument,
  type OrigamiDocument,
} from "@/origami/model";
import { squareTwist } from "@/origami/examples";

const HISTORY_LIMIT = 200;

interface DocumentState {
  doc: OrigamiDocument;
  past: OrigamiDocument[];
  future: OrigamiDocument[];
  /** Baseline snapshot while a preview gesture (drag) is in flight. */
  transactionBase: OrigamiDocument | null;

  /** Replace the document as a single undoable step. */
  commit: (next: OrigamiDocument) => void;
  /** Update the document without recording history (mid-gesture). */
  preview: (next: OrigamiDocument) => void;
  /** Start a gesture: remember the pre-gesture document. */
  beginPreview: () => void;
  /** Finish a gesture: one undo step from baseline to the current doc. */
  commitPreview: () => void;
  /** Abandon a gesture: restore the baseline document. */
  cancelPreview: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Load a document and clear history (open example / import / new). */
  loadDocument: (doc: OrigamiDocument) => void;
  newDocument: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // Open into a real pattern, not an empty screen: the square twist shows
  // mountains/valleys/analysis immediately and is fully editable.
  doc: squareTwist(),
  past: [],
  future: [],
  transactionBase: null,

  commit: (next) =>
    set((state) => ({
      doc: next,
      // If a preview gesture is somehow still open, its baseline — not the
      // transient mid-gesture doc — is what undo must return to.
      past: [
        ...state.past.slice(-HISTORY_LIMIT + 1),
        state.transactionBase ?? state.doc,
      ],
      future: [],
      transactionBase: null,
    })),

  preview: (next) => set({ doc: next }),

  beginPreview: () => {
    const { transactionBase, doc } = get();
    if (transactionBase === null) set({ transactionBase: doc });
  },

  commitPreview: () =>
    set((state) => {
      if (state.transactionBase === null) return {};
      if (state.transactionBase === state.doc) return { transactionBase: null };
      return {
        past: [...state.past.slice(-HISTORY_LIMIT + 1), state.transactionBase],
        future: [],
        transactionBase: null,
      };
    }),

  cancelPreview: () =>
    set((state) =>
      state.transactionBase === null
        ? {}
        : { doc: state.transactionBase, transactionBase: null },
    ),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return {};
      return {
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        transactionBase: null,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      return {
        doc: next,
        past: [...state.past, state.doc],
        future: state.future.slice(1),
        transactionBase: null,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  loadDocument: (doc) =>
    set({ doc, past: [], future: [], transactionBase: null }),

  newDocument: () =>
    set({
      doc: emptyDocument(),
      past: [],
      future: [],
      transactionBase: null,
    }),
}));
