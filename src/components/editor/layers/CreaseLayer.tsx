"use client";

import { useMemo } from "react";
import { paperToScreen } from "@/editor/viewport";
import { vertexMap } from "@/origami/model";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { creaseStyles, yellow } from "@/design-system/tokens";

export function CreaseLayer() {
  const doc = useDocumentStore((s) => s.doc);
  const viewport = useEditorStore((s) => s.viewport);
  const selectedCreases = useEditorStore((s) => s.selection.creaseIds);
  const hovered = useEditorStore((s) => s.hovered);

  const vmap = useMemo(() => vertexMap(doc), [doc]);

  return (
    <g data-testid="crease-layer">
      {doc.creases.map((crease) => {
        const a = vmap.get(crease.startVertexId);
        const b = vmap.get(crease.endVertexId);
        if (!a || !b) return null;
        const sa = paperToScreen(viewport, a);
        const sb = paperToScreen(viewport, b);
        const style = creaseStyles[crease.assignment];
        const isSelected = selectedCreases.has(crease.id);
        const isHovered = hovered?.type === "crease" && hovered.id === crease.id;
        return (
          <g key={crease.id} data-crease-id={crease.id}>
            {isSelected && (
              <line
                x1={sa.x}
                y1={sa.y}
                x2={sb.x}
                y2={sb.y}
                stroke={yellow}
                strokeWidth={style.width + 5}
                strokeLinecap="round"
                opacity={0.55}
              />
            )}
            <line
              x1={sa.x}
              y1={sa.y}
              x2={sb.x}
              y2={sb.y}
              stroke={style.stroke}
              strokeWidth={isHovered ? style.width + 1 : style.width}
              strokeDasharray={style.dashArray}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}
