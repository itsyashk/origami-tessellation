"use client";

import { paperToScreen } from "@/editor/viewport";
import { useEditorStore } from "@/state/editorStore";
import { ink } from "@/design-system/tokens";

/** Ghost dot showing exactly where the vertex tool would place a point. */
export function PlacementPreviewLayer() {
  const tool = useEditorStore((s) => s.tool);
  const pointer = useEditorStore((s) => s.pointerPaper);
  const snap = useEditorStore((s) => s.activeSnap);
  const viewport = useEditorStore((s) => s.viewport);

  if (tool !== "vertex" || !pointer) return null;
  const p = paperToScreen(viewport, snap?.position ?? pointer);

  return (
    <g data-testid="placement-preview" pointerEvents="none">
      <circle
        cx={p.x}
        cy={p.y}
        r={4.5}
        fill="rgba(255,255,255,0.7)"
        stroke={ink}
        strokeWidth={1.5}
        strokeDasharray="2.5 2"
      />
    </g>
  );
}
