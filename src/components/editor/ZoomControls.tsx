"use client";

import { RefObject } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { fitToPaper, zoomAt } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";

export function ZoomControls({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);

  const zoomStep = (factor: number) => {
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    setViewport(zoomAt(viewport, center, viewport.zoom * factor));
  };

  const fit = () => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { paper } = useDocumentStore.getState().doc;
    setViewport(fitToPaper(width, height, paper.width, paper.height));
  };

  return (
    <div className="craft-card absolute bottom-20 right-3 flex items-center gap-0.5 p-1 md:bottom-4 md:right-4">
      <button
        type="button"
        className="btn btn-ghost h-8 w-8 px-0"
        onClick={() => zoomStep(1 / 1.25)}
        aria-label="Zoom out"
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className="btn btn-ghost tnum h-8 min-w-14 px-1 text-xs"
        onClick={fit}
        aria-label="Zoom level — click to fit paper"
        title="Fit paper"
      >
        {Math.round(viewport.zoom * 100)}%
      </button>
      <button
        type="button"
        className="btn btn-ghost h-8 w-8 px-0"
        onClick={() => zoomStep(1.25)}
        aria-label="Zoom in"
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className="btn btn-ghost h-8 w-8 px-0"
        onClick={fit}
        aria-label="Fit paper in view"
      >
        <Maximize2 size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
