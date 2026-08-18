"use client";

import { paperToScreen } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { useAnalysis } from "@/state/useAnalysis";
import { ink, statusColors, yellow } from "@/design-system/tokens";

/**
 * Vertices with math-aware styling: invalid interior vertices get a coral
 * ring, near-valid ones an amber ring. (The badge layer adds the numeric
 * details; rings alone stay subtle.)
 */
export function VertexLayer() {
  const vertices = useDocumentStore((s) => s.doc.vertices);
  const viewport = useEditorStore((s) => s.viewport);
  const selected = useEditorStore((s) => s.selection.vertexIds);
  const hovered = useEditorStore((s) => s.hovered);
  const draggingId = useEditorStore((s) => s.draggingVertexId);
  const analysis = useAnalysis();

  return (
    <g data-testid="vertex-layer">
      {vertices.map((v) => {
        const p = paperToScreen(viewport, v);
        const isSelected = selected.has(v.id);
        const isHovered = hovered?.type === "vertex" && hovered.id === v.id;
        const isDragging = draggingId === v.id;
        const va = analysis.byVertex.get(v.id);
        const kStatus = va?.kawasaki.status;
        const mStatus = va?.maekawa.status;
        const problem =
          kStatus === "invalid" || mStatus === "invalid"
            ? "invalid"
            : kStatus === "near"
              ? "near"
              : null;
        const r = isDragging ? 6.5 : isSelected || isHovered ? 6 : 4.5;
        return (
          <g key={v.id} data-vertex-id={v.id}>
            {problem && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 5}
                fill="none"
                stroke={statusColors[problem]}
                strokeWidth={2}
                opacity={0.8}
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={isSelected || isDragging ? yellow : "#ffffff"}
              stroke={ink}
              strokeWidth={isSelected || isHovered || isDragging ? 2.2 : 1.7}
            />
          </g>
        );
      })}
    </g>
  );
}
