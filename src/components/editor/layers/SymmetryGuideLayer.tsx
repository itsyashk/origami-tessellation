"use client";

import { paperToScreen } from "@/editor/viewport";
import { cyan } from "@/design-system/tokens";
import { paperCenter } from "@/origami/symmetry";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";

/** Dashed axes through the paper centre while construction symmetry is on. */
export function SymmetryGuideLayer() {
  const mode = useEditorStore((s) => s.symmetry);
  const viewport = useEditorStore((s) => s.viewport);
  const paper = useDocumentStore((s) => s.doc.paper);

  if (mode === "off") return null;

  const c = paperCenter(paper);
  const center = paperToScreen(viewport, c);
  const left = paperToScreen(viewport, { x: 0, y: c.y });
  const right = paperToScreen(viewport, { x: paper.width, y: c.y });
  const bottom = paperToScreen(viewport, { x: c.x, y: 0 });
  const top = paperToScreen(viewport, { x: c.x, y: paper.height });
  const showVertical = mode === "c2" || mode === "c4" || mode === "mx";
  const showHorizontal = mode === "c2" || mode === "c4" || mode === "my";

  return (
    <g data-testid="symmetry-guides" pointerEvents="none">
      {showHorizontal && (
        <line
          x1={left.x}
          y1={left.y}
          x2={right.x}
          y2={right.y}
          stroke={cyan}
          strokeWidth={1}
          strokeDasharray="5 4"
          opacity={0.7}
        />
      )}
      {showVertical && (
        <line
          x1={bottom.x}
          y1={bottom.y}
          x2={top.x}
          y2={top.y}
          stroke={cyan}
          strokeWidth={1}
          strokeDasharray="5 4"
          opacity={0.7}
        />
      )}
      <circle
        cx={center.x}
        cy={center.y}
        r={3.5}
        fill={cyan}
        opacity={0.9}
      />
    </g>
  );
}
