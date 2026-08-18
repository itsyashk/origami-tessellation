/**
 * EditorController: all pointer/keyboard interaction logic for the canvas.
 *
 * Framework-free (talks to Zustand stores directly, never to React), so the
 * DRAW → ANALYZE → FEEDBACK → SNAP loop runs outside the render cycle and
 * the same behavior spec can be ported to native gesture recognizers.
 *
 * Gesture model:
 *  - select: click selects; dragging a vertex previews continuously with
 *    snapping (alignment, grid, Kawasaki) and commits one undo step on drop.
 *  - vertex: click places a vertex (snapped); clicking a crease splits it.
 *  - crease: click-click or press-drag between endpoints; chains from the
 *    last endpoint; Escape cancels. New endpoints may split creases or
 *    create vertices as needed.
 *  - pan: drag pans. In any tool: wheel zooms about the cursor, middle-drag
 *    or space-drag pans, two-pointer touch pinches (zoom + pan).
 */

import type { Vec2 } from "@/geometry/vec2";
import { distance } from "@/geometry/vec2";
import { computeSnap, type SnapHit } from "@/geometry/snap";
import {
  addCrease,
  addVertex,
  clampToPaper,
  deleteGeometry,
  findVertexAt,
  moveVertex,
  setCreaseAssignment,
  splitCreaseAt,
  type CreaseAssignment,
  type OrigamiDocument,
} from "@/origami/model";
import { findKawasakiSnap } from "@/origami/kawasakiSnap";
import { hitTest } from "./hitTest";
import { panBy, screenLengthToPaper, screenToPaper, zoomAt } from "./viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore, type ToolId } from "@/state/editorStore";

const SNAP_TOLERANCE_PX = 9;
const VERTEX_HIT_PX = 10;
const CREASE_HIT_PX = 7;
const DRAG_THRESHOLD_PX = 4;
/** Max distance (px) the Kawasaki snap may pull the pointer. */
const KAWASAKI_SNAP_PX = 14;
const GRID_SIZE = 10;

type PointerRole =
  | { kind: "idle" }
  | { kind: "maybe-drag-vertex"; vertexId: string; startScreen: Vec2 }
  | { kind: "drag-vertex"; vertexId: string }
  | { kind: "maybe-draw-crease"; startScreen: Vec2 }
  | { kind: "pan"; lastScreen: Vec2 }
  | { kind: "pinch" };

interface ActivePointer {
  id: number;
  screen: Vec2;
}

/** Light haptic tap where supported (Android Chrome); silently a no-op elsewhere. */
const hapticTick = (): void => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.(8);
    } catch {
      // Haptics are purely additive; never let them break interaction.
    }
  }
};

export class EditorController {
  private role: PointerRole = { kind: "idle" };
  private pointers = new Map<number, ActivePointer>();
  private pinchStart: { dist: number; zoom: number } | null = null;
  private spaceHeld = false;
  /** Snap kind of the previous frame, to fire feedback only on transitions. */
  private lastSnapKind: string | null = null;

  private get docStore() {
    return useDocumentStore.getState();
  }
  private get editor() {
    return useEditorStore.getState();
  }

  // -------------------------------------------------------------- helpers

  private toPaper(screen: Vec2): Vec2 {
    return screenToPaper(this.editor.viewport, screen);
  }

  private tolerance(px: number): number {
    return screenLengthToPaper(this.editor.viewport, px);
  }

  private setSnap(snap: SnapHit | null): void {
    const kind = snap ? `${snap.kind}:${snap.vertexIds.join(",")}` : null;
    if (kind !== this.lastSnapKind) {
      this.lastSnapKind = kind;
      if (snap && (snap.kind === "vertex" || snap.kind === "kawasaki")) {
        hapticTick();
      }
    }
    this.editor.setActiveSnap(snap);
  }

  /**
   * Resolve a paper position into a vertex id, creating geometry as needed:
   * an existing vertex within tolerance, a split of a snapped crease, or a
   * brand-new vertex. Returns the (possibly new) document and vertex id.
   */
  private resolveEndpoint(
    doc: OrigamiDocument,
    pos: Vec2,
    snap: SnapHit | null,
  ): { doc: OrigamiDocument; vertexId: string } {
    if (snap?.kind === "vertex" && snap.vertexIds.length > 0) {
      return { doc, vertexId: snap.vertexIds[0] };
    }
    const near = findVertexAt(doc, pos, this.tolerance(VERTEX_HIT_PX));
    if (near) return { doc, vertexId: near.id };
    if (snap?.kind === "on-crease" && snap.creaseId) {
      const result = splitCreaseAt(doc, snap.creaseId, snap.position);
      return { doc: result.doc, vertexId: result.vertex.id };
    }
    const clamped = clampToPaper(doc.paper, pos);
    const result = addVertex(doc, clamped);
    return { doc: result.doc, vertexId: result.vertex.id };
  }

  private snapForPlacement(pos: Vec2, angleOrigin: Vec2 | null = null): SnapHit | null {
    return computeSnap(this.docStore.doc, pos, {
      vertices: true,
      creases: true,
      alignments: true,
      gridSize: GRID_SIZE,
      angleOrigin,
      angleStepDegrees: 15,
      tolerance: this.tolerance(SNAP_TOLERANCE_PX),
    });
  }

  // ------------------------------------------------------------- pointers

  pointerDown(screen: Vec2, ev: { pointerId: number; button: number; shiftKey: boolean; pointerType: string }): void {
    this.pointers.set(ev.pointerId, { id: ev.pointerId, screen });

    // Second touch → switch to pinch, cancelling any in-flight edit gesture.
    if (this.pointers.size === 2) {
      this.cancelGesture();
      this.role = { kind: "pinch" };
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = {
        dist: Math.max(20, distance(a.screen, b.screen)),
        zoom: this.editor.viewport.zoom,
      };
      return;
    }
    if (this.pointers.size > 2) return;

    // Middle mouse or space always pans.
    if (ev.button === 1 || this.spaceHeld) {
      this.role = { kind: "pan", lastScreen: screen };
      return;
    }
    if (ev.button !== 0) return;

    const tool = this.editor.tool;
    if (tool === "pan") {
      this.role = { kind: "pan", lastScreen: screen };
      return;
    }

    const paper = this.toPaper(screen);
    const doc = this.docStore.doc;

    if (tool === "select") {
      const hit = hitTest(
        doc,
        paper,
        this.tolerance(VERTEX_HIT_PX),
        this.tolerance(CREASE_HIT_PX),
      );
      if (hit?.type === "vertex") {
        this.editor.selectVertex(hit.id, ev.shiftKey);
        this.role = { kind: "maybe-drag-vertex", vertexId: hit.id, startScreen: screen };
      } else if (hit?.type === "crease") {
        this.editor.selectCrease(hit.id, ev.shiftKey);
        hapticTick();
      } else if (!ev.shiftKey) {
        this.editor.clearSelection();
      }
      return;
    }

    if (tool === "vertex") {
      const snap = this.snapForPlacement(paper);
      const pos = snap ? snap.position : clampToPaper(doc.paper, paper);
      // Clicking an existing vertex with the vertex tool just selects it.
      if (snap?.kind === "vertex") {
        this.editor.selectVertex(snap.vertexIds[0]);
        return;
      }
      let next = doc;
      let newId: string;
      if (snap?.kind === "on-crease" && snap.creaseId) {
        const result = splitCreaseAt(doc, snap.creaseId, snap.position);
        next = result.doc;
        newId = result.vertex.id;
      } else {
        const result = addVertex(doc, pos);
        next = result.doc;
        newId = result.vertex.id;
      }
      this.docStore.commit(next);
      this.editor.selectVertex(newId);
      hapticTick();
      return;
    }

    if (tool === "crease") {
      const draft = this.editor.creaseDraft;
      if (!draft) {
        this.role = { kind: "maybe-draw-crease", startScreen: screen };
      }
      // With an active draft, pointerUp completes the crease (click-click).
    }
  }

  pointerMove(screen: Vec2, ev: { pointerId: number }): void {
    const tracked = this.pointers.get(ev.pointerId);
    if (tracked) tracked.screen = screen;

    const paper = this.toPaper(screen);
    this.editor.setPointerPaper(paper);

    if (this.role.kind === "pinch") {
      this.updatePinch();
      return;
    }
    if (this.role.kind === "pan") {
      const delta = {
        x: screen.x - this.role.lastScreen.x,
        y: screen.y - this.role.lastScreen.y,
      };
      this.editor.setViewport(panBy(this.editor.viewport, delta));
      this.role = { kind: "pan", lastScreen: screen };
      return;
    }

    if (this.role.kind === "maybe-drag-vertex") {
      if (distance(screen, this.role.startScreen) >= DRAG_THRESHOLD_PX) {
        this.docStore.beginPreview();
        this.editor.setDraggingVertexId(this.role.vertexId);
        this.role = { kind: "drag-vertex", vertexId: this.role.vertexId };
      } else {
        return;
      }
    }

    if (this.role.kind === "drag-vertex") {
      this.dragVertexTo(this.role.vertexId, paper);
      return;
    }

    if (this.role.kind === "maybe-draw-crease") {
      if (distance(screen, this.role.startScreen) >= DRAG_THRESHOLD_PX) {
        // Press-drag drawing: materialize the start endpoint now.
        this.beginCreaseDraft(this.toPaper(this.role.startScreen));
        this.role = { kind: "idle" };
      }
    }

    // Hover + draft feedback (no buttons pressed or draft active).
    const tool = this.editor.tool;
    if (tool === "select") {
      const hit = hitTest(
        this.docStore.doc,
        paper,
        this.tolerance(VERTEX_HIT_PX),
        this.tolerance(CREASE_HIT_PX),
      );
      const prev = this.editor.hovered;
      if (hit?.type !== prev?.type || hit?.id !== prev?.id) {
        this.editor.setHovered(hit ? { type: hit.type, id: hit.id } : null);
      }
    } else if (tool === "vertex") {
      this.setSnap(this.snapForPlacement(paper));
    } else if (tool === "crease") {
      const draft = this.editor.creaseDraft;
      if (draft) {
        const startVertex = this.docStore.doc.vertices.find(
          (v) => v.id === draft.startVertexId,
        );
        const snap = this.snapForPlacement(
          paper,
          startVertex ? { x: startVertex.x, y: startVertex.y } : null,
        );
        const end = snap ? snap.position : clampToPaper(this.docStore.doc.paper, paper);
        this.editor.setCreaseDraft({
          ...draft,
          end,
          endVertexId: snap?.kind === "vertex" ? snap.vertexIds[0] : null,
        });
        this.setSnap(snap);
      } else {
        this.setSnap(this.snapForPlacement(paper));
      }
    }
  }

  pointerUp(screen: Vec2, ev: { pointerId: number }): void {
    this.pointers.delete(ev.pointerId);
    if (this.role.kind === "pinch") {
      if (this.pointers.size < 2) {
        this.role = { kind: "idle" };
        this.pinchStart = null;
      }
      return;
    }

    if (this.role.kind === "drag-vertex") {
      this.docStore.commitPreview();
      this.editor.setDraggingVertexId(null);
      this.setSnap(null);
      this.role = { kind: "idle" };
      return;
    }
    if (this.role.kind === "maybe-drag-vertex") {
      this.role = { kind: "idle" };
      return;
    }
    if (this.role.kind === "pan") {
      this.role = { kind: "idle" };
      return;
    }
    if (this.role.kind === "maybe-draw-crease") {
      // A clean click: start the draft at the (snapped) click position.
      this.beginCreaseDraft(this.toPaper(this.role.startScreen));
      this.role = { kind: "idle" };
      return;
    }

    // Click-click or drag-release completion of an active crease draft.
    if (this.editor.tool === "crease" && this.editor.creaseDraft) {
      this.completeCreaseDraft(this.toPaper(screen));
    }
  }

  pointerCancel(ev: { pointerId: number }): void {
    this.pointers.delete(ev.pointerId);
    this.cancelGesture();
  }

  wheel(screen: Vec2, deltaY: number): void {
    const vp = this.editor.viewport;
    const factor = Math.exp(-deltaY * 0.0015);
    this.editor.setViewport(zoomAt(vp, screen, vp.zoom * factor));
  }

  resize(width: number, height: number): void {
    this.editor.setViewport({ ...this.editor.viewport, width, height });
  }

  // -------------------------------------------------------------- gestures

  private updatePinch(): void {
    if (this.pointers.size < 2 || !this.pinchStart) return;
    const [a, b] = [...this.pointers.values()];
    const dist = Math.max(20, distance(a.screen, b.screen));
    const center = {
      x: (a.screen.x + b.screen.x) / 2,
      y: (a.screen.y + b.screen.y) / 2,
    };
    const vp = this.editor.viewport;
    const nextZoom = this.pinchStart.zoom * (dist / this.pinchStart.dist);
    this.editor.setViewport(zoomAt(vp, center, nextZoom));
  }

  private dragVertexTo(vertexId: string, paperPos: Vec2): void {
    const doc = this.docStore.doc;
    const clamped = clampToPaper(doc.paper, paperPos);

    let snap = computeSnap(doc, clamped, {
      vertices: false, // merging vertices by drop is a future op
      alignments: true,
      gridSize: GRID_SIZE,
      excludeVertexIds: [vertexId],
      tolerance: this.tolerance(SNAP_TOLERANCE_PX),
    });

    // Mathematical snap: pull onto the flat-foldable locus when close.
    const kawasaki = findKawasakiSnap(
      doc,
      vertexId,
      snap ? snap.position : clamped,
      this.tolerance(KAWASAKI_SNAP_PX),
    );
    if (kawasaki) {
      snap = {
        kind: "kawasaki",
        position: kawasaki.position,
        distance: distance(clamped, kawasaki.position),
        vertexIds: kawasaki.affectedVertexIds,
        label: "Kawasaki ✓",
        guides: snap?.guides ?? [],
      };
    }

    const target = snap ? snap.position : clamped;
    this.docStore.preview(moveVertex(doc, vertexId, target));
    this.setSnap(snap);
  }

  private beginCreaseDraft(paperPos: Vec2): void {
    const snap = this.snapForPlacement(paperPos);
    const pos = snap ? snap.position : clampToPaper(this.docStore.doc.paper, paperPos);
    const resolved = this.resolveEndpoint(this.docStore.doc, pos, snap);
    if (resolved.doc !== this.docStore.doc) {
      // Creating/splitting for the start point is part of the same gesture;
      // preview it so cancel (Escape) rolls everything back.
      this.docStore.beginPreview();
      this.docStore.preview(resolved.doc);
    } else {
      this.docStore.beginPreview();
    }
    this.editor.setCreaseDraft({
      startVertexId: resolved.vertexId,
      end: pos,
      endVertexId: null,
    });
  }

  private completeCreaseDraft(paperPos: Vec2): void {
    const draft = this.editor.creaseDraft;
    if (!draft) return;
    const doc = this.docStore.doc;
    const startVertex = doc.vertices.find((v) => v.id === draft.startVertexId);
    const snap = this.snapForPlacement(
      paperPos,
      startVertex ? { x: startVertex.x, y: startVertex.y } : null,
    );
    const pos = snap ? snap.position : clampToPaper(doc.paper, paperPos);

    const resolved = this.resolveEndpoint(doc, pos, snap);
    if (resolved.vertexId === draft.startVertexId) {
      // Zero-length crease: ignore the click, keep the draft alive.
      return;
    }
    const withCrease = addCrease(resolved.doc, draft.startVertexId, resolved.vertexId);
    this.docStore.preview(withCrease.doc);
    this.docStore.commitPreview();
    hapticTick();

    // Chain: continue drawing from the new endpoint.
    this.docStore.beginPreview();
    this.editor.setCreaseDraft({
      startVertexId: resolved.vertexId,
      end: pos,
      endVertexId: null,
    });
  }

  cancelGesture(): void {
    if (this.role.kind === "drag-vertex") {
      this.docStore.cancelPreview();
      this.editor.setDraggingVertexId(null);
    }
    if (this.editor.creaseDraft) {
      this.docStore.cancelPreview();
      this.editor.setCreaseDraft(null);
    }
    this.setSnap(null);
    this.role = { kind: "idle" };
  }

  // -------------------------------------------------------------- keyboard

  keyDown(ev: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    target?: EventTarget | null;
  }): boolean {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key;

    if (key === " ") {
      this.spaceHeld = true;
      return false;
    }

    if (mod && (key === "z" || key === "Z")) {
      if (ev.shiftKey) this.docStore.redo();
      else this.docStore.undo();
      return true;
    }
    if (mod && (key === "y" || key === "Y")) {
      this.docStore.redo();
      return true;
    }

    if (key === "Escape") {
      this.cancelGesture();
      this.editor.clearSelection();
      return true;
    }

    if (key === "Delete" || key === "Backspace") {
      const { vertexIds, creaseIds } = this.editor.selection;
      if (vertexIds.size === 0 && creaseIds.size === 0) return false;
      this.docStore.commit(
        deleteGeometry(this.docStore.doc, [...vertexIds], [...creaseIds]),
      );
      this.editor.clearSelection();
      return true;
    }

    const toolByKey: Record<string, ToolId> = {
      v: "select",
      p: "vertex",
      c: "crease",
      h: "pan",
    };
    const tool = toolByKey[key.toLowerCase()];
    if (!mod && tool) {
      this.cancelGesture();
      this.editor.setTool(tool);
      return true;
    }

    const assignmentByKey: Record<string, CreaseAssignment> = {
      "1": "mountain",
      "2": "valley",
      "3": "unassigned",
    };
    const assignment = assignmentByKey[key];
    if (!mod && assignment) {
      const ids = [...this.editor.selection.creaseIds];
      if (ids.length === 0) return false;
      this.docStore.commit(
        setCreaseAssignment(this.docStore.doc, ids, assignment),
      );
      return true;
    }

    return false;
  }

  keyUp(ev: { key: string }): void {
    if (ev.key === " ") this.spaceHeld = false;
  }
}
