"use client";

import { paperToScreen } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { creaseStyles } from "@/design-system/tokens";

/** The sheet of origami paper: bright surface, ink boundary, soft shadow. */
export function PaperLayer() {
  const paper = useDocumentStore((s) => s.doc.paper);
  const viewport = useEditorStore((s) => s.viewport);

  const topLeft = paperToScreen(viewport, { x: 0, y: paper.height });
  const w = paper.width * viewport.zoom;
  const h = paper.height * viewport.zoom;

  return (
    <g data-testid="paper-layer">
      {/* Offset shadow suggests a sheet resting on the desk */}
      <rect
        x={topLeft.x + 4}
        y={topLeft.y + 6}
        width={w}
        height={h}
        rx={2}
        fill="rgba(43, 42, 40, 0.10)"
      />
      <rect
        x={topLeft.x}
        y={topLeft.y}
        width={w}
        height={h}
        rx={1.5}
        fill="#ffffff"
        stroke={creaseStyles.boundary.stroke}
        strokeWidth={creaseStyles.boundary.width}
      />
    </g>
  );
}
