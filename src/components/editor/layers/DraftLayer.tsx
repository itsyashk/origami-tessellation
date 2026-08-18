"use client";

import { paperToScreen } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { cyan, ink } from "@/design-system/tokens";

/** Rubber-band preview while drawing a crease. */
export function DraftLayer() {
  const draft = useEditorStore((s) => s.creaseDraft);
  const viewport = useEditorStore((s) => s.viewport);
  const vertices = useDocumentStore((s) => s.doc.vertices);

  if (!draft) return null;
  const start = vertices.find((v) => v.id === draft.startVertexId);
  if (!start) return null;

  const sa = paperToScreen(viewport, start);
  const sb = paperToScreen(viewport, draft.end);

  return (
    <g data-testid="draft-layer">
      <line
        x1={sa.x}
        y1={sa.y}
        x2={sb.x}
        y2={sb.y}
        stroke={cyan}
        strokeWidth={2}
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <circle cx={sa.x} cy={sa.y} r={5.5} fill={cyan} stroke="#fff" strokeWidth={1.5} />
      <circle
        cx={sb.x}
        cy={sb.y}
        r={draft.endVertexId ? 7 : 5}
        fill="none"
        stroke={draft.endVertexId ? cyan : ink}
        strokeWidth={2}
      />
    </g>
  );
}
