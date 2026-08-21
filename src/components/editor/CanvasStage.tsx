"use client";

/**
 * The interactive SVG canvas. One pointer-event surface; all interaction
 * logic lives in EditorController, all math in the engines. Layers subscribe
 * to narrow store slices so pointer-move work stays cheap.
 */

import { useEffect, useMemo, useRef } from "react";
import { EditorController } from "@/editor/controller";
import { fitToPaper } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { PaperLayer } from "./layers/PaperLayer";
import { CreaseLayer } from "./layers/CreaseLayer";
import { VertexLayer } from "./layers/VertexLayer";
import { DraftLayer } from "./layers/DraftLayer";
import { SnapLayer } from "./layers/SnapLayer";
import { AnalysisBadgeLayer } from "./layers/AnalysisBadgeLayer";
import { PlacementPreviewLayer } from "./layers/PlacementPreviewLayer";
import { MarqueeLayer } from "./layers/MarqueeLayer";
import { SymmetryGuideLayer } from "./layers/SymmetryGuideLayer";
import { ZoomControls } from "./ZoomControls";
import { StatusBar } from "./StatusBar";
import { EmptyState } from "./EmptyState";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

const CURSOR_BY_TOOL: Record<string, string> = {
  select: "default",
  vertex: "crosshair",
  crease: "crosshair",
  pan: "grab",
};

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const controller = useMemo(() => new EditorController(), []);
  const fittedRef = useRef(false);
  const tool = useEditorStore((s) => s.tool);

  // Size tracking + one-time fit of the paper into view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      if (!fittedRef.current) {
        fittedRef.current = true;
        const { paper } = useDocumentStore.getState().doc;
        useEditorStore
          .getState()
          .setViewport(fitToPaper(width, height, paper.width, paper.height));
      } else {
        controller.resize(width, height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [controller]);

  // Refit when a different document is loaded. A load (example/import/new)
  // is the only transition that swaps the doc while clearing all history.
  useEffect(
    () =>
      useDocumentStore.subscribe((state, prev) => {
        const loaded =
          state.doc !== prev.doc &&
          state.past.length === 0 &&
          state.future.length === 0 &&
          (prev.past.length > 0 || prev.future.length > 0 || prev.doc.name !== state.doc.name);
        if (!loaded) return;
        const el = containerRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const { paper } = state.doc;
        useEditorStore
          .getState()
          .setViewport(fitToPaper(width, height, paper.width, paper.height));
      }),
    [],
  );

  // Non-passive wheel listener (React's synthetic wheel can't preventDefault).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = svg.getBoundingClientRect();
      controller.wheel(
        { x: ev.clientX - rect.left, y: ev.clientY - rect.top },
        ev.deltaY,
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [controller]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (isEditableTarget(ev.target)) return;
      if (controller.keyDown(ev)) ev.preventDefault();
    };
    const onKeyUp = (ev: KeyboardEvent) => controller.keyUp(ev);
    const onBlur = () => controller.windowBlur();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [controller]);

  const localPoint = (ev: React.PointerEvent) => {
    const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  return (
    <div
      ref={containerRef}
      className="graph-paper relative h-full w-full overflow-hidden"
      data-testid="canvas-container"
    >
      <svg
        ref={svgRef}
        data-testid="editor-canvas"
        className="absolute inset-0 h-full w-full select-none"
        style={{ touchAction: "none", cursor: CURSOR_BY_TOOL[tool] }}
        role="application"
        aria-label="Crease pattern canvas. V select, P place vertex, C draw crease, H pan. Enter places a vertex or completes a crease. Shift+2 and Shift+4 toggle rotational symmetry. Drag on empty paper to marquee-select. Arrow keys nudge selected vertices."
        onPointerDown={(ev) => {
          (ev.currentTarget as SVGSVGElement).setPointerCapture(ev.pointerId);
          controller.pointerDown(localPoint(ev), ev);
        }}
        onPointerMove={(ev) => controller.pointerMove(localPoint(ev), ev)}
        onPointerUp={(ev) => controller.pointerUp(localPoint(ev), ev)}
        onPointerCancel={(ev) => controller.pointerCancel(ev)}
        onPointerLeave={() => useEditorStore.getState().setPointerPaper(null)}
        onContextMenu={(ev) => {
          ev.preventDefault();
          controller.cancelGesture();
        }}
      >
        <PaperLayer />
        <CreaseLayer />
        <SnapLayer />
        <DraftLayer />
        <PlacementPreviewLayer />
        <VertexLayer />
        <AnalysisBadgeLayer />
        <SymmetryGuideLayer />
        <MarqueeLayer />
      </svg>
      <EmptyState />
      <ZoomControls containerRef={containerRef} />
      <StatusBar />
    </div>
  );
}
